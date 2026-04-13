import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { appendFile, writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface LogEntry {
  hypothesis: string;
  message: string;
  data?: unknown;
  file?: string;
  line?: number;
  timestamp: string;
}

interface LogServer {
  port: number;
  pid: number;
  stop: () => Promise<void>;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export async function startLogServer(logDir: string): Promise<LogServer> {
  await mkdir(logDir, { recursive: true });
  const logFile = join(logDir, "debug.ndjson");

  const httpServer: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/log") {
      try {
        const body = await readBody(req);
        const entry = JSON.parse(body) as Partial<LogEntry>;

        const logEntry: LogEntry = {
          hypothesis: entry.hypothesis ?? "unknown",
          message: entry.message ?? "",
          data: entry.data,
          file: entry.file,
          line: entry.line,
          timestamp: entry.timestamp ?? new Date().toISOString(),
        };

        await appendFile(logFile, JSON.stringify(logEntry) + "\n");

        res.writeHead(200, { ...corsHeaders(), "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { ...corsHeaders(), "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid log entry", details: String(err) }));
      }
      return;
    }

    if (req.method === "POST" && req.url === "/batch") {
      try {
        const body = await readBody(req);
        const entries = JSON.parse(body) as Partial<LogEntry>[];

        const lines = entries.map((entry) => {
          const logEntry: LogEntry = {
            hypothesis: entry.hypothesis ?? "unknown",
            message: entry.message ?? "",
            data: entry.data,
            file: entry.file,
            line: entry.line,
            timestamp: entry.timestamp ?? new Date().toISOString(),
          };
          return JSON.stringify(logEntry);
        });

        await appendFile(logFile, lines.join("\n") + "\n");

        res.writeHead(200, { ...corsHeaders(), "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, count: entries.length }));
      } catch (err) {
        res.writeHead(400, { ...corsHeaders(), "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid batch", details: String(err) }));
      }
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", logFile }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return new Promise<LogServer>((resolve, reject) => {
    // Try to find an available port starting from 0 (OS assigns)
    httpServer.listen(0, "127.0.0.1", () => {
      const addr = httpServer.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to get server address"));
        return;
      }
      resolve({
        port: addr.port,
        pid: process.pid,
        stop: () =>
          new Promise<void>((res) => {
            httpServer.close(() => res());
          }),
      });
    });
    httpServer.on("error", reject);
  });
}

export async function clearLogs(logDir: string): Promise<void> {
  const logFile = join(logDir, "debug.ndjson");
  await writeFile(logFile, "");
}

export async function readLogs(
  logDir: string,
  options: { hypothesisFilter?: string; maxLines?: number } = {}
): Promise<{ entries: LogEntry[]; total: number; truncated: boolean }> {
  const logFile = join(logDir, "debug.ndjson");
  let content: string;
  try {
    content = await readFile(logFile, "utf-8");
  } catch {
    return { entries: [], total: 0, truncated: false };
  }

  const lines = content.trim().split("\n").filter(Boolean);
  let entries: LogEntry[] = lines.map((line) => {
    try {
      return JSON.parse(line) as LogEntry;
    } catch {
      return { hypothesis: "unknown", message: line, timestamp: "" };
    }
  });

  const total = entries.length;

  if (options.hypothesisFilter) {
    entries = entries.filter((e) => e.hypothesis === options.hypothesisFilter);
  }

  const maxLines = options.maxLines ?? 100;
  const truncated = entries.length > maxLines;
  if (truncated) {
    entries = entries.slice(-maxLines); // Keep the most recent
  }

  return { entries, total, truncated };
}
