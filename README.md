# SPILL — Android voice dumps + persistent AI memory

SPILL turns voice notes and text dumps into searchable tasks, ideas, notes and follow-ups, then lets you ask questions across your saved memories.

## Stack
- Expo / React Native / TypeScript
- Supabase Auth, Postgres, Storage and Row Level Security
- Supabase Edge Functions + OpenAI for transcription, extraction, embeddings and grounded Q&A

## Setup

### 1. Run the Android app

Install Node.js LTS, Git, and Expo Go on your Android phone.

```bash
git clone https://github.com/AP-24001064/spill-android.git
cd spill-android
npm install
cp .env.example .env
```

Create a Supabase project, then put its project URL and anon/publishable key in `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

### 2. Configure Supabase

1. Open the Supabase SQL Editor and run `supabase/schema.sql`.
2. The SQL creates a private `dumps-audio` Storage bucket and policies.
3. Enable Email/password authentication in Supabase Auth settings.
4. Do not disable Row Level Security or put a service-role key in the mobile app.

### 3. Configure and deploy the backend

Install the Supabase CLI and link your project:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
supabase secrets set SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase functions deploy process-dump
supabase functions deploy ask-memory
```

Keep the OpenAI and service-role keys in Supabase secrets only.

### 4. Start the app

```bash
npx expo start
```

Scan the QR code with Expo Go. For a standalone Android build, configure EAS Build later. No paid domain is required.

## What works in this starter
- Email/password registration and sign-in
- Record a voice dump or enter text
- Submit a dump for transcription and extraction
- Store extracted memory items and embeddings
- Ask natural-language questions over retrieved memories

## Important
This is a starter scaffold, not a production-ready app. Configure and test Supabase before use. AI API calls may cost money. Audio is stored in your private bucket unless you add retention/deletion logic. Before public release add deletion/export controls, retries, rate limits, file-size limits, date-editing, and privacy messaging. No paid domain is required.