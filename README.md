# Iru Manam &mdash; matrimony site (Supabase-backed)

Plain HTML/CSS/JS, no build step. Frontend deploys to Vercel; data and auth run on Supabase.

## Pages
- `index.html` &mdash; home, hero with the Tamil blessing + two-hearts animation
- `browse.html` &mdash; browse profiles, filtered live against Supabase (religion, gender in the query; city/profession search client-side)
- `profile.html` &mdash; profile detail, reads `?id=` from the URL, "Express interest" writes to the `interests` table
- `login.html` &mdash; login/signup; signup creates a Supabase auth user **and** a matching row in `profiles`

## 1. Create the Supabase project
1. Go to [supabase.com](https://supabase.com) → New project.
2. In **Settings → API**, copy the **Project URL** and the **anon public** key.
3. Open **SQL Editor**, paste the contents of `schema.sql`, and run it. This creates:
   - `profiles` &mdash; one row per user (id matches `auth.users.id`), with RLS so everyone can read visible profiles but only the owner can insert/update their own.
   - `interests` &mdash; "express interest" records, with RLS so only the sender and recipient can see a given row.
4. (Optional, recommended for a real dating/matrimony site) In **Authentication → Providers → Email**, decide whether to require email confirmation before login. It's on by default.

## 2. Fill in your credentials
Edit `config.js`:
```js
window.SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
window.SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```
The anon key is safe to ship in client-side code — every table it can touch is locked down by the RLS policies in `schema.sql`, not by keeping the key secret.

**Don't commit real credentials to a public repo.** For a private repo it's fine as-is; for a public one, swap `config.js` for a build step or environment-variable injection later.

## 3. Run locally
Any static file server works, e.g.:
```bash
npx serve .
```
Then visit `http://localhost:3000`.

## 4. Deploy to Vercel
1. Push this folder to a GitHub repo (or run `vercel` from inside it with the Vercel CLI).
2. In Vercel, import the repo. Framework preset: **Other** (static site) &mdash; no build command needed.
3. `vercel.json` enables clean URLs, so `/browse` and `/profile` work without `.html`.
4. `config.js` ships as a plain static file, so it deploys with everything else &mdash; no env var setup needed on Vercel's side.

## How the pieces fit together
- **Auth**: `supabase.auth.signUp()` / `signInWithPassword()` / `signOut()`, called directly from `app.js`. Session is checked with `supabase.auth.getSession()` on every page load.
- **Profiles**: the signup form collects the full profile (age, religion, location, profession, education, height, about) and inserts it in the same step as account creation.
- **Browse**: `browse.html` queries `profiles` with `.eq('religion', ...)` / `.eq('gender', ...)` server-side; the free-text search box filters the fetched results client-side.
- **Express interest**: requires login; inserts a row into `interests` (`from_profile`, `to_profile`). A unique constraint stops duplicate interest on the same profile.

## What's still manual / a good next step
- No "edit your own profile" page yet — profiles are set once at signup.
- No page to view interests you've sent or received (the data's there in `interests`, just not surfaced in the UI).
- No photo upload (Supabase Storage would be the natural fit).
- Flask can still be added later for anything that needs custom server logic (e.g. horoscope matching), deployed separately (Render, Railway, EC2) and called from this frontend via `fetch()`.
