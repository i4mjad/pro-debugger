# Pro-Debugger

> **Debug Mode for Claude Code** — hypothesis-driven, evidence-based debugging with runtime log instrumentation.

Inspired by [Cursor's Debug Mode](https://cursor.com/blog/debug-mode), built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) as a hybrid **skill + MCP server** plugin.

Stop guessing at bugs. Hypothesize, instrument, observe, fix.

---

## The Problem

Traditional AI debugging is a guessing game: you paste an error into chat, the AI speculates about the cause, and you go back and forth hoping it lands on the right fix. This works for simple bugs but fails for anything involving timing, state, or complex interactions.

## The Solution

Pro-Debugger enforces a **structured, evidence-based debugging workflow** — the same discipline experienced engineers use, automated and systematized:

```
 /debug "payment form submits twice when clicking fast"
                        |
              +---------v----------+
              |   0. SAFETY SETUP  |  git stash, start log server,
              |                    |  detect stack (monorepo-aware)
              +---------+----------+
                        |
              +---------v----------+
              |   1. UNDERSTAND    |  gather bug description, read code,
              |                    |  check git history
              +---------+----------+
                        |
              +---------v----------+
              |   2. HYPOTHESIZE   |  generate 3-5 testable theories
              |                    |  (H1, H2, H3...)
              +---------+----------+
                        |
              +---------v----------+
              |   3. INSTRUMENT    |  inject tagged logging at key
              |                    |  points using stack-aware templates
              +---------+----------+
                        |
              +---------v----------+
              |   4. REPRODUCE     |  YOU trigger the bug while
              |                    |  logs are collected
              +---------+----------+
                        |
              +---------v----------+
              |   5. ANALYZE       |  map runtime evidence to
              |                    |  hypotheses (confirm/eliminate)
              +---------+----------+
                        |
           not fixed?   |   confirmed?
         +----<---------+---------v----------+
         |              |   6. FIX           |  minimal, targeted fix
         |              |                    |  based on evidence
         |              +---------+----------+
         |                        |
         |              +---------v----------+
         +------<-------|   7. VERIFY        |  you test again
                        |                    |  (max 3 iterations)
                        +---------+----------+
                                  |
                        +---------v----------+
                        |   8. CLEANUP       |  git restore removes ALL
                        |                    |  instrumentation, re-apply
                        +--------------------+  only the fix. Clean diff.
```

## Key Features

### Monorepo-Aware Stack Detection

Walks up from the target file to detect language, framework, and package manager. In a monorepo, different subdirectories get different detection:

```
monorepo/
├── apps/
│   ├── web/          → Next.js (TypeScript)
│   ├── api/          → FastAPI (Python)
│   └── mobile/       → Flutter (Dart)
└── services/
    └── processor/    → Gin (Go)
```

The detected stack shapes everything: log templates, instrumentation style, hypothesis generation, and reproduction hints.

**Supported ecosystems:** JavaScript/TypeScript, Python, Go, Rust, Ruby, PHP, Java, Kotlin, Dart, C#, Elixir, Shell — with framework detection for 40+ frameworks including Next.js, Express, Django, FastAPI, Rails, Laravel, Spring Boot, Flutter, Gin, Actix, and more.

### HTTP Log Collection Server

- Structured NDJSON logs with hypothesis tagging and timestamps
- CORS-enabled for browser-side code
- Batch endpoint for high-throughput logging
- File-based fallback when the server can't start

### Git-Based Cleanup

All instrumentation is removed via `git restore .` — bulletproof regardless of language or marker formatting. The fix is then re-applied cleanly on the restored tree.

### Context Window Protection

Logs are always read through the MCP tool with filtering and truncation. Raw log files are never dumped into the conversation. This prevents the context window from being flooded with noise.

### Safety Guardrails

- **3-iteration cap** — escalates to the user after 3 instrumentation rounds
- **Git safety stash** — uncommitted changes are stashed before any instrumentation
- **Emergency abort** — `debug_abort` tool kills everything and restores git state
- **Human-in-the-loop** — only the user confirms a fix works, never the AI

---

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI or IDE extension
- Node.js 18+
- Git (required for safe instrumentation cleanup)

## Installation

### Option 1: As a Claude Code Plugin

```bash
git clone https://github.com/i4mjad/pro-debugger.git
cd pro-debugger/mcp-server
npm install
npm run build
```

Then register the plugin in Claude Code.

### Option 2: Manual Setup

**1. Copy the skill:**
```bash
cp -r skills/debug ~/.claude/skills/debug
```

**2. Build the MCP server:**
```bash
cd mcp-server
npm install
npm run build
```

**3. Add to your Claude Code MCP config** (in `~/.claude/settings.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "pro-debugger": {
      "command": "node",
      "args": ["/absolute/path/to/pro-debugger/mcp-server/dist/index.js"]
    }
  }
}
```

---

## Usage

Invoke the debug skill in Claude Code:

```
/debug the login form fails silently when password contains special characters
```

Or describe a bug naturally — the skill activates when Claude detects debugging intent.

### Example Session

```
You:    /debug the checkout total is wrong when applying a percentage discount

Claude: Starting debug session...
        Stack detected: TypeScript / Next.js / npm
        Log server running on port 54321

        Phase 1 — Understanding the bug...
        I've read the checkout logic. Let me form hypotheses.

        Phase 2 — Hypotheses:
        H1: Discount is applied to the pre-tax total instead of post-tax
        H2: Floating point rounding error in percentage calculation
        H3: Discount stacks incorrectly when multiple coupons are applied

        Phase 3 — Instrumenting H1, H2, H3 with tagged logging...
        [adds debug logs to checkout calculation functions]

        Phase 4 — Please reproduce the bug:
        Add items to cart, apply a 15% discount code, and proceed to checkout.

You:    Done, the total shows $92.65 instead of $85.00

Claude: Phase 5 — Analyzing logs...
        H1: ELIMINATED — discount correctly targets post-tax total
        H2: CONFIRMED — Math.round() is called on the percentage (0.15)
            instead of the final amount. Logs show: discount = 0 (rounded 0.15 to 0)
        H3: inconclusive

        Phase 6 — Fix: Change Math.round(discount) to Math.round(total * discount)
        in src/lib/checkout.ts:47

        Phase 7 — Please test again with the same steps.

You:    Total is now $85.00, correct!

Claude: Phase 8 — Cleaning up...
        Removed all instrumentation via git restore.
        Re-applied the one-line fix.
        Final diff: src/lib/checkout.ts — 1 line changed.
```

---

## MCP Tools Reference

| Tool | Description |
|------|-------------|
| `debug_detect_stack` | Detect language, framework, and stack from a file path (monorepo-aware) |
| `debug_start_session` | Start a debug session: git safety stash, log server, stack detection |
| `debug_get_session_status` | Get current phase, hypotheses, iteration count, stack info |
| `debug_add_hypothesis` | Register a hypothesis with an ID (H1, H2, etc.) |
| `debug_update_hypothesis` | Update status: confirmed, eliminated, or inconclusive |
| `debug_get_log_templates` | Get language-appropriate HTTP and file logging snippets |
| `debug_clear_logs` | Clear logs before a reproduction run |
| `debug_read_logs` | Read logs with hypothesis filtering and truncation |
| `debug_update_phase` | Transition to a new workflow phase |
| `debug_increment_iteration` | Increment round counter (warns at limit) |
| `debug_end_session` | Clean up: git restore, stop server, remove .debug/ |
| `debug_abort` | Emergency: kill everything, restore git state |

---

## Architecture

```
pro-debugger/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── .mcp.json                    # MCP server registration
├── skills/
│   └── debug/
│       ├── SKILL.md             # The brain — 8-phase workflow orchestration
│       └── references/
│           └── log-templates.md # Framework-specific instrumentation patterns
├── mcp-server/                  # The hands — structured debug tooling
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # MCP server + all 12 tool registrations
│       ├── stack-detection.ts   # Monorepo-aware language/framework detection
│       ├── session.ts           # Session lifecycle, git safety, state persistence
│       ├── log-server.ts        # HTTP log collection server (NDJSON)
│       └── log-templates.ts     # Per-language logging code snippets
├── package.json                 # Root workspace
└── README.md
```

### How It Differs from Existing Approaches

| Feature | Pro-Debugger | [doraemonkeys](https://github.com/doraemonkeys/claude-code-debug-mode) | [franzenzenhofer](https://github.com/franzenzenhofer/debug-mode-skill) | [vltansky](https://github.com/vltansky/debug-skill) |
|---------|:---:|:---:|:---:|:---:|
| Skill (workflow prompt) | Yes | Yes | Yes | Yes |
| MCP server (structured tools) | Yes | No | No | No |
| HTTP log server | Yes | No | No | Yes |
| Git-based cleanup | Yes | No | Yes | No |
| Monorepo stack detection | Yes | No | No | No |
| Framework-aware templates | Yes | No | Partial | No |
| Context window protection | Yes | No | Yes | No |
| Session state persistence | Yes | No | No | Yes |
| Iteration cap | Yes | No | Yes | No |

---

## Contributing

Contributions are welcome! Areas of interest:

- Additional framework-specific log templates
- DAP (Debug Adapter Protocol) integration for breakpoint-based debugging
- Browser DevTools Protocol integration for frontend debugging
- Test runner integration for automated reproduction

## License

MIT
