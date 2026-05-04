# Potheads — Planned Work

## Next up: Clay & Glaze Catalogs

**Primary prompt:** `add-catalogs-prompt.md`
Start here. This is the full implementation brief for adding browsable clay body and glaze reference catalogs with per-user favorites.

**Supporting files:**
- `002_catalog_tables.sql` — Supabase migration to run before building (creates `clay_bodies`, `glazes`, `user_clay_favorites`, `user_glaze_favorites` tables)
- `clay_bodies_seed.json` — 28 clay body entries from TPS 9th St to seed
- `glazes_seed.json` — 27 glaze entries from TPS 9th St to seed

**Order of operations:**
1. Run `002_catalog_tables.sql` migration in Supabase
2. Seed both JSON files into their tables
3. Implement per `add-catalogs-prompt.md`

---

## Future: Clay × Glaze Compatibility

**Plan:** `clay-glaze-compatibility-plan.md`
Depends on catalog v1 shipping first. Adds a `clay_glaze_pairings` table and surfaces editorial compatibility notes between specific clay bodies and glazes.

**Status:** planned — do not build until catalogs are live
