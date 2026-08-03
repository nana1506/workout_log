# Training Log Dashboard

Interactive workout analytics dashboard built for a Supabase `workout_log` table.
Ships with generated sample data so it runs standalone — swap in your live
Supabase project whenever you're ready (see below).

## What's inside

- Progressive overload (est. 1RM) trend with PR + deload markers
- Volume by muscle group (stacked weekly bar chart)
- RPE / fatigue trend
- Acute:Chronic Workload Ratio (ACWR) with zone bands
- Deload week auto-detection
- Inter-session recovery time by muscle group
- Recent sets table

## Run it locally

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

## Connect your real Supabase data

The dashboard currently reads from `generateMockRows()` in `src/App.jsx`.
To go live:

1. Copy `.env.example` to `.env.local` and fill in your project's values:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
2. In `src/App.jsx`, uncomment the `createClient` block near the top and
   replace the body of `fetchWorkoutLogs()` with the real Supabase query
   (the exact snippet is also shown in-app under the "Data source" button).
3. Restart `npm run dev`.

Never commit `.env.local` — it's already in `.gitignore`.

## Deploy for free — Vercel

1. Push this project to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
   Vercel auto-detects Vite and sets the build command (`npm run build`) and
   output directory (`dist`) for you.
3. Under **Project → Settings → Environment Variables**, add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Every push to your main branch redeploys automatically.

Netlify works the same way if you'd rather use that instead — build command
`npm run build`, publish directory `dist`, same environment variables.
