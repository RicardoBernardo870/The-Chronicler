# Quickstart: The Chronicler

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS or later |
| npm / pnpm | latest |
| Supabase CLI | latest (`npm i -g supabase`) |
| Anthropic API key | Required for recap generation |

---

## 1. Clone and install

```bash
git clone <repo-url>
cd BookHero
pnpm install        # or: npm install
```

---

## 2. Configure environment variables

Copy the example env file:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase (find in Supabase Dashboard > Project Settings > API)
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Claude API — used in the Edge Function (NOT exposed to the browser)
# Set this in Supabase Dashboard > Edge Functions > Environment Variables
ANTHROPIC_API_KEY=<your-anthropic-api-key>

# Google Books API key (optional — improves ISBN fallback coverage)
VITE_GOOGLE_BOOKS_API_KEY=<optional>
```

> **Security**: `ANTHROPIC_API_KEY` must only be set as a Supabase Edge Function secret,
> never in the frontend `.env` file.

---

## 3. Set up Supabase

### Option A — Local development (recommended)

```bash
supabase start                           # starts local Postgres + Auth + Studio
supabase db push                         # applies migrations in supabase/migrations/
supabase functions serve generate-recap  # serves the Edge Function locally
```

Local Studio: http://localhost:54323
Local API: http://localhost:54321

### Option B — Remote project

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy generate-recap \
  --env-file .env.local
```

---

## 4. Run the dev server

```bash
pnpm dev   # http://localhost:5173
```

The app is a Vite PWA. To test PWA features (service worker, offline mode):

```bash
pnpm build && pnpm preview   # http://localhost:4173
```

Install the PWA via the browser's install prompt to test the home screen experience.

---

## 5. Validate the core flows

### Add a book (ISBN scan)
1. Click "Add Book" on the dashboard.
2. Allow camera access when prompted.
3. Point the camera at any book's ISBN barcode.
4. Confirm the pre-filled metadata and save.

**Expected**: Book appears in library with cover art and page count.

### Update progress
1. Select a book from the library.
2. Enter your current page number and save.
3. Open a second browser tab / incognito window with the same account.

**Expected**: Updated progress visible in both tabs within ~5 seconds.

### Generate a recap
1. Select a book with recorded progress > 0.
2. Tap "Get Recap".
3. Watch the three sections stream in.

**Expected**: Recap persists in the book's history after completion.

### Offline progress update
1. Open DevTools → Network → set to "Offline".
2. Update a book's page number.
3. Restore network.

**Expected**: Progress syncs to Supabase automatically once online.

---

## 6. Run tests

```bash
pnpm test          # Vitest unit + component tests
pnpm test:e2e      # Playwright E2E (requires dev server running)
```

---

## 7. Build for production

```bash
pnpm build         # outputs to dist/
```

Deploy `dist/` to Vercel, Netlify, or any static CDN. The `vite-plugin-pwa` generates the
service worker and web app manifest automatically.

```bash
vercel deploy --prod   # example deployment
```
