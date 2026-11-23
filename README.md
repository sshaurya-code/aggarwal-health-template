# Family Health

A private records app for one family: health reports, IDs, bills and warranties, insurance, cars and investments. It's built for iPhone (open in Safari → Share → Add to Home Screen) and gated by one family PIN.

**Stack:** Next.js 16 (`src/proxy.ts` is the PIN gate), Supabase (Postgres + a private `records` storage bucket), Vercel.

## Make it yours

1. **Name and photo**
   - Set `FAMILY_NAME` and `SITE_URL` in `src/lib/brand.ts`.
   - Replace `public/lock.jpg` with your own photo (4:3 landscape), which is shown on the lock screen.

2. **Supabase**
   - Create a project (for India, pick region Mumbai).
   - In the SQL Editor, run every file in `supabase/migrations/` in order: `0001` → `0008`. Or use `npx supabase link` + `npx supabase db push`.
   - Copy the project URL, the anon/publishable key and the service-role/secret key.

3. **Env**
   - `cp .env.example .env.local` and fill it in.
   - Required: the three Supabase values, `FAMILY_PIN` (6+ digits) and `AUTH_SECRET` (any long random string: `openssl rand -hex 32`).
   - Everything else is optional and switches off when it's empty:
     - **Push reminders:** `npx web-push generate-vapid-keys` → `VAPID_*`, plus `CRON_SECRET`.
     - **Helper login:** `HELPER_PIN` + `HELPER_MEMBER_ID` (the member's id from the `members` table). It opens only that person's daily-care screen.
     - **Claude reading:** `ANTHROPIC_API_KEY`. Spending is capped by `SPEND_CAP_INR` in `src/lib/claude.ts`.
     - **Google Drive copy:** create a Google Cloud OAuth "Desktop" client → `GOOGLE_CLIENT_ID`/`SECRET`, then run `node scripts/drive-signin.mjs`.

4. **Run it:** `npm install && npm run dev`, open http://localhost:3000 and enter your PIN. Add family members from the home screen.

5. **Deploy:** push to your own GitHub repo, import it in Vercel and add the same env vars there. `vercel.json` sets the Mumbai region and the daily reminder cron. After that, every push to `main` deploys.

Keep `.env.local` out of git (it's already in `.gitignore`). Never share the service-role key.
