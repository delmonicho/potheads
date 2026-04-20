# Session Debrief — Run This at the End of Every Session

You are wrapping up a Claude Code session on the Potheads pottery tracker app.

Complete all steps below in order.

**Step 1 — Decisions made this session**
List every meaningful decision made during this session. One sentence each. Format:
```
- [Topic]: [decision made and brief reason]
```
Only include decisions that affect future development (architecture, UX behaviour, what was deferred). Skip implementation details that are obvious from the code.

**Step 2 — Files changed this session**
List every file that was created or modified. Format:
```
- [path] — [what changed, one phrase]
```

**Step 3 — Update DECISIONS.md**
Open `DECISIONS.md`. If it doesn't exist, create it with this header:
```markdown
# Decisions Log

Chronological record of decisions made during development.
Format: YYYY-MM-DD — [topic] — [decision]
```
Add one line per decision from Step 1, dated today (2026-04-20 format). Append to the bottom — never edit existing entries.

**Step 4 — Suggest a git commit message**
Write a conventional commit message covering everything changed this session. Format:
```
[type]: [short summary under 72 chars]

- [bullet for significant change 1]
- [bullet for significant change 2]
```
Types: `feat`, `fix`, `refactor`, `docs`, `chore`. Use `feat` if any user-visible change was made.

**Step 5 — Flag incomplete work**
List anything that was started but not finished, or that needs follow-up next session. Format:
```
- [item] — [what's left to do / why it was left incomplete]
```
If nothing is incomplete, write "Nothing left incomplete."
