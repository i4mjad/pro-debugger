import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
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
} from "./session.js";

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
              message: "Debug session started. Proceed to Phase 1: Understand the bug.",
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
