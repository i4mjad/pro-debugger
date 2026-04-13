import { execFile } from "node:child_process";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { detectStack, type StackInfo } from "./stack-detection.js";

const execFileAsync = promisify(execFile);

export interface Hypothesis {
  id: string;
  description: string;
  status: "pending" | "confirmed" | "eliminated" | "inconclusive";
}

export interface DebugSession {
  id: string;
  projectDir: string;
  debugDir: string;
  stack: StackInfo;
  phase: "setup" | "understand" | "hypothesize" | "instrument" | "reproduce" | "analyze" | "fix" | "verify" | "cleanup" | "done";
  hypotheses: Hypothesis[];
  iteration: number;
  maxIterations: number;
  safetyBranch: string | null;
  originalBranch: string;
  logServerPort: number | null;
  logServerPid: number | null;
  createdAt: string;
}

// In-memory session store (single session at a time)
let activeSession: DebugSession | null = null;

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await git(dir, "rev-parse", "--is-inside-work-tree");
    return true;
  } catch {
    return false;
  }
}

async function hasUncommittedChanges(dir: string): Promise<boolean> {
  const status = await git(dir, "status", "--porcelain");
  return status.length > 0;
}

export async function startSession(
  targetPath: string,
  options: { maxIterations?: number } = {}
): Promise<DebugSession> {
  if (activeSession) {
    throw new Error(
      `A debug session is already active (id: ${activeSession.id}). ` +
      `End it with debug_end_session or debug_abort before starting a new one.`
    );
  }

  const stack = await detectStack(targetPath);
  const projectDir = stack.configDir;

  if (!(await isGitRepo(projectDir))) {
    throw new Error(
      `The project at ${projectDir} is not a git repository. ` +
      `Debug mode requires git for safe instrumentation cleanup.`
    );
  }

  // Get current branch name
  let originalBranch: string;
  try {
    originalBranch = await git(projectDir, "rev-parse", "--abbrev-ref", "HEAD");
  } catch {
    originalBranch = "HEAD";
  }

  // Create safety branch
  let safetyBranch: string | null = null;
  if (await hasUncommittedChanges(projectDir)) {
    // Stash uncommitted changes for safety
    await git(projectDir, "stash", "push", "-m", "pro-debugger: safety stash before debug session");
    safetyBranch = "stash";
  }

  // Create the .debug directory for logs
  const debugDir = join(projectDir, ".debug");
  await mkdir(join(debugDir, "logs"), { recursive: true });

  const session: DebugSession = {
    id: randomUUID().slice(0, 8),
    projectDir,
    debugDir,
    stack,
    phase: "setup",
    hypotheses: [],
    iteration: 0,
    maxIterations: options.maxIterations ?? 3,
    safetyBranch,
    originalBranch,
    logServerPort: null,
    logServerPid: null,
    createdAt: new Date().toISOString(),
  };

  // Persist session state to disk for crash recovery
  await writeFile(
    join(debugDir, "session.json"),
    JSON.stringify(session, null, 2)
  );

  activeSession = session;
  return session;
}

export function getSession(): DebugSession | null {
  return activeSession;
}

export function requireSession(): DebugSession {
  if (!activeSession) {
    throw new Error("No active debug session. Start one with debug_start_session.");
  }
  return activeSession;
}

export async function updatePhase(phase: DebugSession["phase"]): Promise<void> {
  const session = requireSession();
  session.phase = phase;
  await persistSession();
}

export async function addHypothesis(id: string, description: string): Promise<Hypothesis> {
  const session = requireSession();
  const existing = session.hypotheses.find((h) => h.id === id);
  if (existing) {
    throw new Error(`Hypothesis ${id} already exists: "${existing.description}"`);
  }
  const hypothesis: Hypothesis = { id, description, status: "pending" };
  session.hypotheses.push(hypothesis);
  await persistSession();
  return hypothesis;
}

export async function updateHypothesisStatus(
  id: string,
  status: Hypothesis["status"]
): Promise<void> {
  const session = requireSession();
  const hypothesis = session.hypotheses.find((h) => h.id === id);
  if (!hypothesis) {
    throw new Error(`Hypothesis ${id} not found`);
  }
  hypothesis.status = status;
  await persistSession();
}

export async function incrementIteration(): Promise<number> {
  const session = requireSession();
  session.iteration++;
  await persistSession();
  return session.iteration;
}

export function setLogServer(port: number, pid: number): void {
  const session = requireSession();
  session.logServerPort = port;
  session.logServerPid = pid;
}

export async function endSession(): Promise<{ cleanedUp: boolean; message: string }> {
  const session = requireSession();

  // Kill log server if running
  if (session.logServerPid) {
    try {
      process.kill(session.logServerPid, "SIGTERM");
    } catch {
      // Process may already be dead
    }
  }

  // Restore git state: remove all instrumentation
  try {
    await git(session.projectDir, "restore", ".");
  } catch {
    // May fail if there are no changes to restore
  }

  // Restore stashed changes if we stashed them
  if (session.safetyBranch === "stash") {
    try {
      await git(session.projectDir, "stash", "pop");
    } catch {
      // Stash may conflict — leave it for the user
    }
  }

  // Clean up .debug directory
  try {
    await rm(session.debugDir, { recursive: true, force: true });
  } catch {
    // Best effort
  }

  const message = `Debug session ${session.id} ended. All instrumentation removed via git restore.`;
  activeSession = null;
  return { cleanedUp: true, message };
}

export async function abortSession(): Promise<{ message: string }> {
  const session = activeSession;
  if (!session) {
    return { message: "No active session to abort." };
  }

  // Kill log server
  if (session.logServerPid) {
    try {
      process.kill(session.logServerPid, "SIGTERM");
    } catch { /* ignore */ }
  }

  // Hard restore
  try {
    await git(session.projectDir, "restore", ".");
  } catch { /* ignore */ }

  // Restore stash
  if (session.safetyBranch === "stash") {
    try {
      await git(session.projectDir, "stash", "pop");
    } catch { /* ignore */ }
  }

  // Clean up
  try {
    await rm(session.debugDir, { recursive: true, force: true });
  } catch { /* ignore */ }

  activeSession = null;
  return { message: `Debug session aborted. Git state restored.` };
}

async function persistSession(): Promise<void> {
  if (!activeSession) return;
  try {
    await writeFile(
      join(activeSession.debugDir, "session.json"),
      JSON.stringify(activeSession, null, 2)
    );
  } catch {
    // Best effort — don't fail the operation if we can't persist
  }
}
