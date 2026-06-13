# Supabase Setup Instructions for HostelDesk

This guide walks you through configuring your Supabase project to support the HostelDesk offline-first application.

## 1. Create a Supabase Project
1. Go to [database.new](https://database.new) to create a new Supabase project.
2. Once provisioned, note your **Project URL** and **anon key** from the Project Settings > API section.

## 2. Configure Environment Variables
1. Copy the `.env.example` file in the root directory to `.env.local`.
2. Fill in the values:
```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```
*(Do not use the `service_role` key).*

## 3. Disable Public Sign-ups (Crucial)
Since this is a single-user system designed for you:
1. Go to **Authentication** > **Providers** > **Email**.
2. **Disable** "Confirm email" if you want simple login without email verification.
3. Sign yourself up once from the Supabase dashboard (Authentication > Users > Add User).
4. After creating your account, go to **Authentication** > **Providers** > **Email** and **Disable** "Enable Signups". This prevents strangers from registering.

## 4. Run the Schema Migrations
1. Open the Supabase Dashboard and go to the **SQL Editor**.
2. Copy the entire contents of `supabase/migrations/00001_initial_schema.sql` and paste it into the editor.
3. Click **Run**. This creates the tables, constraints, and triggers.

## 5. Create the Storage Bucket
Images are kept in a private storage bucket.
1. Go to **Storage** > **Buckets** in the Supabase Dashboard.
2. Click **New Bucket**.
3. Name it exactly: `hosteldesk-files`.
4. Leave "Public bucket" **unchecked** (it must be private).
5. Click **Save**.

## 6. Apply Row Level Security (RLS) Policies
1. Go back to the **SQL Editor**.
2. Copy the entire contents of `supabase/policies.sql` and paste it into the editor.
3. Click **Run**. This enables RLS on your tables and secures your `hosteldesk-files` bucket so only your account can access your data.

---
**Setup Complete.** Your cloud backend is now secured, constrained, and ready to accept offline-first sync connections.
