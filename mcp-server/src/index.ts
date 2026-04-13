import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { detectStack } from "./stack-detection.js";

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
