# Visual Update — Implementing UI Changes from Mockups

You are updating the Potheads UI to match new design mockups or screenshots.

**Step 1 — Read context**
Read `CLAUDE.md`. Pay attention to: Design Tokens, Development Rules (mobile-first, Tailwind only, no custom CSS), and the Current App State table.

**Step 2 — Audit current components against the mockups**
For each screen shown in the mockup, read the corresponding component/page file and list deviations. Format your output as:

```
## [Screen name] — [file path]
- [ ] Deviation 1: current state → what mockup shows
- [ ] Deviation 2: ...
```

Do not guess. If a mockup detail is ambiguous, flag it with a question.

**Step 3 — Propose changes**
For each deviation, state:
- Which file to change
- What specifically to change (class names, markup structure, colours using design tokens)
- Whether it requires any new component or just edits to existing ones

Do not modify any files yet. Present the full proposal and wait for explicit approval.

**Step 4 — Implement screen by screen**
After approval, implement one screen at a time. After each screen, summarise what changed. Do not move to the next screen until the previous one is confirmed.

**Constraints:**
- Tailwind utility classes only — no new CSS files, no style attributes (unless using inline hex for dynamic tag colours)
- Mobile-first: 390px base width, use `pb-safe`/`pt-safe` for safe areas
- Do not refactor any logic while updating visuals
