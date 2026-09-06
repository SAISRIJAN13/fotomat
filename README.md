# FotoMat 2000

A Y2K-inspired online photobooth. Four shots into a downloadable strip, twenty filters, ten-second timer between shots, Supabase auth.

## Stack
- Vanilla HTML / CSS / JS — no build step
- Supabase (auth + Postgres) for accounts and saved strips

## Setup
1. Create a Supabase project.
2. Run the schema in `supabase/setup.sql` against it.
3. Open `script.js` and replace the `SUPABASE_URL` and `SUPABASE_KEY` constants with your project's URL and publishable key.
4. Serve the folder (Vercel, Netlify, or any static host).

## Supabase schema
`supabase/setup.sql` creates:
- `fotomat_profiles` — one row per user with their username
- `fotomat_strips` — every captured strip (4 photo data URLs + filter name + username)
- an auto-confirm trigger on `auth.users` so sign-ups don't need email verification