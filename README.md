# Pro-Debugger

**Debug Mode for Claude Code** — hypothesis-driven, evidence-based debugging with runtime log instrumentation.

Inspired by [Cursor's Debug Mode](https://cursor.com/blog/debug-mode), adapted for Claude Code as a hybrid skill + MCP server plugin.

## What It Does

When you encounter a difficult bug, Pro-Debugger enforces a disciplined debugging workflow:

1. **Hypothesize** — Generate 3-5 testable theories about the root cause
2. **Instrument** — Inject tagged logging at key code points
3. **Reproduce** — You trigger the bug while logs are collected
4. **Analyze** — Map runtime evidence to hypotheses
5. **Fix** — Apply a minimal, targeted fix based on evidence
6. **Verify** — Confirm the fix works
7. **Cleanup** — Remove all instrumentation via `git restore`, leaving only the fix

## Key Features

- **Monorepo-aware stack detection** — Walks up from the target file to detect language, framework, and stack. Different subdirectories in a monorepo get different detection.
- **HTTP log collection server** — Structured NDJSON logs with hypothesis tagging, CORS support for browser-side code, with file-based fallback.
- **13+ language support** — JavaScript, TypeScript, Python, Go, Rust, Ruby, PHP, Java, Kotlin, Dart, C#, Elixir, Shell, plus framework-specific patterns for Next.js, Express, Django, FastAPI, Rails, Laravel, Flutter, Spring Boot, and more.
- **Git-based cleanup** — All instrumentation is removed via `git restore .`, which is bulletproof regardless of language or marker formatting.
- **Context window protection** — Logs are always read through the MCP tool with filtering and truncation, never dumped raw.
- **3-iteration cap** — Escalates to the user after 3 instrumentation rounds to prevent infinite loops.

## Installation

### As a Claude Code Plugin

1. Clone or copy this repository
2. Register it in your Claude Code settings or install via the plugin marketplace

### Manual Setup

1. Copy the `skills/debug/` directory to `~/.claude/skills/debug/`
2. Add the MCP server to your Claude Code configuration:

```json
{
  "mcpServers": {
    "pro-debugger": {
      "command": "node",
      "args": ["/path/to/pro-debugger/mcp-server/dist/index.js"]
    }
  }
}
```

3. Build the MCP server:
```bash
cd mcp-server
npm install
npm run build
```

## Usage

In Claude Code, use the `/debug` command:

```
/debug the login form fails silently when password contains special characters
```

Or describe a bug naturally — the skill activates when it detects debugging intent.

## MCP Tools

| Tool | Description |
|------|-------------|
| `debug_detect_stack` | Detect language, framework, and stack from a file path |
| `debug_start_session` | Start a debug session with git safety and log server |
| `debug_add_hypothesis` | Register a hypothesis with an ID |
| `debug_update_hypothesis` | Update hypothesis status (confirmed/eliminated/inconclusive) |
| `debug_get_log_templates` | Get language-appropriate logging snippets |
| `debug_clear_logs` | Clear logs before reproduction |
| `debug_read_logs` | Read logs with filtering and truncation |
| `debug_get_session_status` | Get current session state |
| `debug_update_phase` | Transition to a new workflow phase |
| `debug_increment_iteration` | Increment the instrumentation round counter |
| `debug_end_session` | Clean up: git restore, stop server, remove artifacts |
| `debug_abort` | Emergency cleanup |

## Architecture

```
pro-debugger/
├── skills/debug/           # Skill prompt (the brain)
│   ├── SKILL.md            # 8-phase workflow orchestration
│   └── references/
│       └── log-templates.md
├── mcp-server/             # MCP server (the hands)
│   └── src/
│       ├── index.ts        # Tool registrations
│       ├── stack-detection.ts
│       ├── session.ts
│       ├── log-server.ts
│       └── log-templates.ts
└── .claude-plugin/
    └── plugin.json
```

## License

MIT
