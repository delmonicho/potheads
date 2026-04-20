# Debug Session — Fixing What's Broken

You are debugging an issue in the Potheads pottery tracker app.

**Step 1 — Read the error carefully**
Before suggesting anything, read the full error message or describe the observed behaviour precisely. Ask for:
- The exact error text (console, network, or visual)
- Which screen/action triggers it
- Whether it's consistent or intermittent

Do not suggest fixes based on partial information.

**Step 2 — Locate the issue**
Determine whether the problem is in:
- A `src/lib/` file (Supabase query, data transformation, auth)
- A component or page (state management, rendering, event handler)
- Configuration (vercel.json, vite.config.js, environment variables)

Read the relevant file(s) before proposing a fix. Do not guess at the cause.

**Step 3 — Propose the minimal fix**
State:
- The root cause (one sentence)
- The exact change needed (file, line, what to change)
- Why this fixes it

If multiple files need changing, list them all before touching any of them.

**Step 4 — Implement**
Make only the changes needed to fix the bug. Do not:
- Refactor surrounding code
- Add error handling for unrelated cases
- Rename variables or reformat files
- "Clean up while you're in there"

If you notice an unrelated issue while reading the file, mention it separately at the end — do not fix it as part of this session.

**Constraints:**
- Check `src/lib/` files first — most data bugs live there
- Supabase RLS issues look like silent empty responses, not errors
- Signed URL errors (photos not loading) usually mean the URL expired or the storage path is wrong
