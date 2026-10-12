# SPILL — Android voice dumps + persistent AI memory

SPILL turns voice notes and text dumps into searchable tasks, ideas, notes and follow-ups, then lets you ask questions across your saved memories.

## Stack
- Expo / React Native / TypeScript
- Supabase Auth, Postgres, Storage and Row Level Security
- Supabase Edge Functions + OpenAI for transcription, extraction, embeddings and grounded Q&A

## Setup
1. Install Node.js LTS, Git, and the Expo Go app.
2. Create an Expo app and install dependencies:
   ```bash
   npx create-expo-app@latest spill --template blank-typescript
   cd spill
   npx expo install expo-audio expo-crypto @react-native-async-storage/async-storage
   npm install @supabase/supabase-js react-native-url-polyfill
   ```
3. Copy `App.tsx` from this repo into the project.
4. Create a Supabase project. Run `supabase/schema.sql` in SQL Editor and create a **private** Storage bucket named `dumps-audio`.
5. Copy `.env.example` to `.env` and fill in your Supabase URL and anon/publishable key. Never expose a service-role key in the app.
6. Install the Supabase CLI, link the project, set server-side secrets and deploy:
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
7. Start the app with `npx expo start`, then scan the QR code using Expo Go.

## What works in this starter
- Email/password registration and sign-in
- Record a voice dump or enter text
- Submit a dump for transcription and extraction
- Store extracted memory items and embeddings
- Ask natural-language questions over retrieved memories

## Important
This is a starter scaffold, not a production-ready app. Configure and test Supabase before use. AI API calls may cost money. Audio is stored in your private bucket unless you add retention/deletion logic. Before public release add deletion/export controls, retries, rate limits, file-size limits, date-editing, and privacy messaging. No paid domain is required.