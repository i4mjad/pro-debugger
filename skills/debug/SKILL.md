---
name: debug
description: "Use this skill when the user asks to debug a bug, investigate a runtime error, diagnose a failing test, trace a regression, or says /debug. Activates hypothesis-driven debugging with runtime log instrumentation. This skill is for genuinely difficult bugs — not typos or obvious syntax errors."
version: 0.1.0
argument-hint: "<description of the bug>"
---

# Debug Mode — Hypothesis-Driven Debugging with Runtime Log Instrumentation

You are now in **Debug Mode**. This is a structured, disciplined debugging workflow. You will NOT guess at fixes. You will hypothesize, instrument, observe, and fix based on evidence.

## Iron Laws

These rules are non-negotiable. Violating them will produce bad outcomes.

1. **Never skip phases.** Every phase exists for a reason. Do not jump from "understand" to "fix."
2. **Never declare victory.** Only the USER confirms a fix works. You propose, they verify.
3. **Never remove instrumentation early.** Debug logs stay until the user confirms the fix, then cleanup removes everything via `git restore .`
4. **Never dump raw logs.** Always use `debug_read_logs` with filtering. Never `cat` or `Read` log files directly — this floods the context window.
5. **Never run long processes synchronously.** If you need to start a server or watcher, use `nohup ... &` or run it in the background. Never hang the terminal.
6. **Respect the iteration limit.** After 3 instrumentation rounds, stop and escalate to the user. Do not loop forever.
7. **Never instrument without a hypothesis.** Every log statement must be tagged with a hypothesis ID. Untargeted logging is noise.

## Phase 0: Safety Setup

**Goal:** Create a safe environment where instrumentation can be freely added and cleanly removed.

1. Call `debug_start_session` with the path to the file or directory being debugged.
   - This auto-detects the language, framework, and stack (monorepo-aware).
   - It creates a git safety stash if there are uncommitted changes.
   - It starts the HTTP log collection server.
   - It initializes the `.debug/` directory.

2. Note the returned `logServerPort` and `stack` info — you'll need these.

3. Call `debug_update_phase` with phase `"setup"`.

## Phase 1: Understand

**Goal:** Build a complete picture of the bug before forming any hypotheses.

1. Ask the user (or read from their initial message):
   - What is the **expected** behavior?
   - What is the **actual** behavior?
   - Any **error messages** or stack traces?
   - What are the **reproduction steps**?
   - When did this **start happening**? (regression? always broken?)

2. Read the relevant source code. Follow the code path from the entry point to where the bug manifests.

3. Check recent git history for related changes (`git log --oneline -20`).

4. Call `debug_update_phase` with phase `"understand"`.

## Phase 2: Hypothesize

**Goal:** Generate multiple testable theories about the root cause.

1. Generate **3-5 hypotheses**. Consider both obvious and non-obvious causes:
   - The obvious: wrong variable, missing null check, off-by-one
   - The subtle: race condition, stale cache, framework quirk, environment difference
   - The framework-specific: use the detected stack to think about common pitfalls
     (e.g., React re-render loops, Django ORM N+1, Go goroutine leaks, Next.js SSR/client mismatch)

2. For each hypothesis, call `debug_add_hypothesis` with:
   - A short ID: `H1`, `H2`, `H3`, etc.
   - A clear description of what you think might be wrong

3. Rank hypotheses by likelihood. Start instrumentation with the most likely.

4. Call `debug_update_phase` with phase `"hypothesize"`.

## Phase 3: Instrument

**Goal:** Add targeted logging to test your hypotheses.

1. Call `debug_get_log_templates` for each hypothesis you want to test. This returns:
   - **HTTP snippet** (preferred): Sends structured logs to the debug server
   - **File snippet** (fallback): Appends to a log file
   - **Region markers**: `#region DEBUG` / `#endregion DEBUG` for your language

2. Inject log statements at key points in the code:
   - **Wrap each block** in region markers so they're clearly identifiable
   - **Tag every log** with the hypothesis ID
   - **Log the minimum needed**: variable values, branch taken, timing
   - Place logs at decision points, function entries/exits, and data transformations

3. Example instrumentation pattern:
   ```
   // #region DEBUG
   fetch('http://127.0.0.1:PORT/log', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({
       hypothesis: 'H1',
       message: 'cart items at checkout',
       data: { items: cart.items, total: cart.total }
     })
   }).catch(() => {});
   // #endregion DEBUG
   ```

4. Call `debug_update_phase` with phase `"instrument"`.

## Phase 4: Reproduce

**Goal:** Collect runtime data by having the user trigger the bug.

1. Call `debug_clear_logs` to start with a clean slate.

2. **Always ask the user** to reproduce the bug. Provide specific instructions:
   - "Please trigger the bug by doing X, Y, Z"
   - "Run the failing test with: `npm test -- --grep 'test name'`"
   - "Navigate to the page and click the button that causes the error"

3. **Wait for the user to confirm** they have reproduced the bug.

4. Call `debug_update_phase` with phase `"reproduce"`.

## Phase 5: Analyze

**Goal:** Map runtime evidence to hypotheses and identify the root cause.

1. Call `debug_read_logs` to read the collected data:
   - First, read all logs to get an overview
   - Then filter by each hypothesis ID to examine evidence per theory

2. For each hypothesis, determine:
   - **Confirmed**: The logs clearly show this is the cause
   - **Eliminated**: The logs show this is NOT the cause (values are correct, path not taken)
   - **Inconclusive**: Not enough data to decide

3. Call `debug_update_hypothesis` for each hypothesis with the appropriate status.

4. **Decision point:**
   - If a hypothesis is **confirmed** → proceed to Phase 6 (Fix)
   - If all hypotheses are eliminated/inconclusive:
     - Call `debug_increment_iteration`
     - If under the limit → go back to Phase 2 (new hypotheses) or Phase 3 (deeper logging)
     - If at the limit → present your findings to the user and ask for guidance

5. Call `debug_update_phase` with phase `"analyze"`.

## Phase 6: Fix

**Goal:** Apply a minimal, targeted fix based on evidence.

1. Based on the confirmed hypothesis and log evidence, implement the **smallest possible fix**.
   - Do NOT refactor surrounding code
   - Do NOT add unrelated improvements
   - Fix exactly what is broken and nothing more

2. **Keep all instrumentation in place.** The debug logs stay so we can verify the fix works.

3. Explain to the user:
   - What the root cause is (with evidence from logs)
   - What the fix does
   - Why this fix is correct

4. Call `debug_update_phase` with phase `"fix"`.

## Phase 7: Verify

**Goal:** Confirm the fix works by having the user test again.

1. Call `debug_clear_logs` to clear old data.

2. Ask the user to **reproduce the original scenario** again:
   - "Please try the same steps that triggered the bug before"
   - "The fix is in place along with the debug logging. Please test it."

3. After the user tests:
   - If **fixed** → proceed to Phase 8 (Cleanup)
   - If **not fixed** → call `debug_increment_iteration`, go back to Phase 3
   - The logs from this run will show whether the fix addressed the right code path

4. Call `debug_update_phase` with phase `"verify"`.

## Phase 8: Cleanup

**Goal:** Remove all instrumentation, leaving only the clean fix.

1. **Before cleanup**, note exactly what the fix was (file, lines changed, what was changed). You'll need to re-apply it after git restore.

2. Call `debug_end_session`. This will:
   - Run `git restore .` to remove ALL changes (instrumentation AND fix)
   - Stop the log server
   - Remove the `.debug/` directory
   - Restore any stashed changes

3. **Re-apply only the fix** — the minimal change that resolves the bug.

4. Present the final diff to the user. It should be clean: just the fix, no debug artifacts.

5. Call `debug_update_phase` with phase `"done"`.

## Error Recovery

- If something goes wrong at any point, call `debug_abort` to emergency-cleanup.
- If the user wants to stop debugging, call `debug_end_session`.
- If the log server is unavailable, use file-based logging templates instead.
- If git restore fails, manually remove `#region DEBUG` / `#endregion DEBUG` blocks.

## Context Window Protection

- **Never** read log files with the Read tool or cat command. Always use `debug_read_logs`.
- **Never** run commands that produce unbounded output without piping through `head` or `grep`.
- When running the user's code, redirect verbose output to files and query them surgically.
- Use `debug_get_session_status` to check state instead of re-reading session files.
