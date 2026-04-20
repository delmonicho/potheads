# Feature Build — Adding Net-New Functionality

You are building a new feature for the Potheads pottery tracker app.

**Step 1 — Check constraints before proposing anything**
Read `CLAUDE.md` in full. Specifically check:
- "Explicitly Parked" section — if the requested feature is listed there, flag it immediately and stop.
- "Development Rules" — all constraints apply (mobile-first, no TypeScript, no form tags, lib files for Supabase calls).
- "Database Schema" — understand the current tables before proposing schema changes.

Read `DECISIONS.md` if it exists. Check whether this feature or a related one was previously considered and parked.

**Step 2 — Propose the implementation plan**
Before writing any code, propose:

1. **Files to create** (with path and purpose)
2. **Files to modify** (with what changes and why)
3. **Database changes** — any new tables, columns, or RLS policies needed. Flag explicitly if the change touches existing tables that have data.
4. **localStorage changes** — any new keys (update CLAUDE.md localStorage table)
5. **Edge cases or risks** — anything that could break existing functionality

Wait for explicit approval before writing any code.

**Step 3 — Implement**
After approval, implement the feature. Follow this order:
1. Database/schema changes first (provide SQL to run manually if needed)
2. lib/ helper functions
3. Components/pages
4. Update CLAUDE.md (File Structure, Current App State, localStorage table as needed)

**Constraints:**
- All Supabase calls go in `src/lib/`, never inline in components
- Compress images before upload (browser-image-compression, max 1600px, ~80% quality)
- Always handle loading and error states in UI
- Mobile-first: design for 390px width
