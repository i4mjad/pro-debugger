import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join } from "node:path";
import { detectStack } from "./stack-detection.js";
import {
  startSession,
  getSession,
  requireSession,
  updatePhase,
  addHypothesis,
  updateHypothesisStatus,
  incrementIteration,
  endSession,
  abortSession,
  setLogServer,
  setLogServerStop,
} from "./session.js";
import { startLogServer, clearLogs, readLogs } from "./log-server.js";
import { getLogTemplates } from "./log-templates.js";

const server = new McpServer({
  name: "pro-debugger",
  version: "0.1.0",
});

server.tool(
  "debug_detect_stack",
  "Analyze a file or directory path to detect the programming language, framework, package manager, and test command. Monorepo-aware — walks up from the target path to find the nearest project config.",
  { targetPath: z.string().describe("Absolute path to the file or directory to analyze") },
  async ({ targetPath }) => {
    const stack = await detectStack(targetPath);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(stack, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "debug_start_session",
  "Start a new debug session. Detects the project stack, creates a git safety stash if needed, and initializes the debug log directory. Must be called before any other debug tools.",
  {
    targetPath: z.string().describe("Absolute path to the file or directory being debugged"),
    maxIterations: z.number().optional().describe("Maximum instrumentation rounds before escalating (default: 3)"),
  },
  async ({ targetPath, maxIterations }) => {
    const session = await startSession(targetPath, { maxIterations });

    // Start the log collection HTTP server
    let logServerPort: number | null = null;
    try {
      const logDir = join(session.debugDir, "logs");
      const logSrv = await startLogServer(logDir);
      setLogServer(logSrv.port, logSrv.pid);
      setLogServerStop(logSrv.stop);
      logServerPort = logSrv.port;
    } catch {
      // Log server failed to start — file-based fallback will be used
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              sessionId: session.id,
              projectDir: session.projectDir,
              stack: session.stack,
              safetyBranch: session.safetyBranch,
              debugDir: session.debugDir,
              logServerPort,
              message: logServerPort
                ? `Debug session started. Log server running on port ${logServerPort}. Proceed to Phase 1: Understand the bug.`
                : "Debug session started (log server unavailable — use file-based logging). Proceed to Phase 1: Understand the bug.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "debug_get_session_status",
  "Get the current state of the active debug session including phase, hypotheses, iteration count, and detected stack.",
  {},
  async () => {
    const session = requireSession();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              sessionId: session.id,
              phase: session.phase,
              iteration: session.iteration,
              maxIterations: session.maxIterations,
              hypotheses: session.hypotheses,
              stack: session.stack,
              logServerPort: session.logServerPort,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "debug_add_hypothesis",
  "Register a hypothesis about the root cause of the bug. Each hypothesis gets a unique ID (e.g., H1, H2) for tagging log statements.",
  {
    id: z.string().describe("Short hypothesis ID, e.g., 'H1', 'H2'"),
    description: z.string().describe("Description of the hypothesis — what you think might be causing the bug"),
  },
  async ({ id, description }) => {
    const hypothesis = await addHypothesis(id, description);
    return {
      content: [
        {
          type: "text" as const,
          text: `Hypothesis ${hypothesis.id} registered: "${hypothesis.description}"`,
        },
      ],
    };
  }
);

server.tool(
  "debug_update_phase",
  "Update the current phase of the debug session. Phases: setup, understand, hypothesize, instrument, reproduce, analyze, fix, verify, cleanup, done.",
  {
    phase: z.enum([
      "setup", "understand", "hypothesize", "instrument",
      "reproduce", "analyze", "fix", "verify", "cleanup", "done",
    ]).describe("The new phase"),
  },
  async ({ phase }) => {
    await updatePhase(phase);
    return {
      content: [{ type: "text" as const, text: `Phase updated to: ${phase}` }],
    };
  }
);

server.tool(
  "debug_end_session",
  "End the debug session cleanly. Runs git restore to remove ALL instrumentation, restores any stashed changes, stops the log server, and removes the .debug directory. Call this after the fix is verified.",
  {},
  async () => {
    const result = await endSession();
    return {
      content: [{ type: "text" as const, text: result.message }],
    };
  }
);

server.tool(
  "debug_abort",
  "Emergency abort: kill the log server, git restore all changes, restore stashed changes, and clean up. Use when something goes wrong and you need to bail out.",
  {},
  async () => {
    const result = await abortSession();
    return {
      content: [{ type: "text" as const, text: result.message }],
    };
  }
);

server.tool(
  "debug_get_log_templates",
  "Get language-appropriate logging code snippets for instrumenting code. Uses the detected stack to return the right template. Returns both HTTP (preferred) and file-based (fallback) snippets with region markers.",
  {
    language: z.string().optional().describe("Override language (default: auto-detected from session stack)"),
    hypothesis: z.string().describe("Hypothesis ID to tag logs with, e.g., 'H1'"),
  },
  async ({ language, hypothesis }) => {
    const session = requireSession();
    const lang = language ?? session.stack.language;
    const logFile = join(session.debugDir, "logs", "debug.ndjson");
    const result = getLogTemplates(lang, session.logServerPort, logFile, hypothesis);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "debug_clear_logs",
  "Clear all collected logs before a new reproduction run. Call this before asking the user to reproduce the bug.",
  {},
  async () => {
    const session = requireSession();
    const logDir = join(session.debugDir, "logs");
    await clearLogs(logDir);
    return {
      content: [{ type: "text" as const, text: "Logs cleared. Ready for reproduction." }],
    };
  }
);

server.tool(
  "debug_read_logs",
  "Read collected debug logs. Returns entries filtered by hypothesis and truncated to protect context window. Always use this instead of reading log files directly.",
  {
    hypothesisFilter: z.string().optional().describe("Filter logs to a specific hypothesis ID, e.g., 'H1'"),
    maxLines: z.number().optional().describe("Maximum number of log entries to return (default: 100)"),
  },
  async ({ hypothesisFilter, maxLines }) => {
    const session = requireSession();
    const logDir = join(session.debugDir, "logs");
    const { entries, total, truncated } = await readLogs(logDir, {
      hypothesisFilter,
      maxLines,
    });

    const summary = [
      `Total log entries: ${total}`,
      hypothesisFilter ? `Filtered to hypothesis: ${hypothesisFilter}` : "Showing all hypotheses",
      truncated ? `Truncated to ${maxLines ?? 100} most recent entries` : "All entries shown",
      "---",
    ];

    const formattedEntries = entries.map((e) => {
      const parts = [`[${e.hypothesis}] ${e.message}`];
      if (e.data !== undefined) parts.push(`  data: ${JSON.stringify(e.data)}`);
      if (e.file) parts.push(`  at: ${e.file}${e.line ? `:${e.line}` : ""}`);
      return parts.join("\n");
    });

    return {
      content: [
        {
          type: "text" as const,
          text: summary.join("\n") + "\n" + formattedEntries.join("\n\n"),
        },
      ],
    };
  }
);

server.tool(
  "debug_update_hypothesis",
  "Update the status of a hypothesis after analyzing logs. Status: confirmed, eliminated, or inconclusive.",
  {
    id: z.string().describe("Hypothesis ID, e.g., 'H1'"),
    status: z.enum(["confirmed", "eliminated", "inconclusive"]).describe("New status based on log evidence"),
  },
  async ({ id, status }) => {
    await updateHypothesisStatus(id, status);
    return {
      content: [{ type: "text" as const, text: `Hypothesis ${id} marked as: ${status}` }],
    };
  }
);

server.tool(
  "debug_increment_iteration",
  "Increment the instrumentation iteration counter. Call this when going back to the instrument phase for deeper logging. Returns the new iteration count and warns if approaching the limit.",
  {},
  async () => {
    const session = requireSession();
    const iteration = await incrementIteration();
    const atLimit = iteration >= session.maxIterations;
    return {
      content: [
        {
          type: "text" as const,
          text: atLimit
            ? `Iteration ${iteration}/${session.maxIterations} — LIMIT REACHED. Present findings to the user and ask for guidance before continuing.`
            : `Iteration ${iteration}/${session.maxIterations}. Proceeding with deeper instrumentation.`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
