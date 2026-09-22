-- Iru Manam — Supabase schema
-- Run this in Supabase Dashboard → SQL Editor (or `supabase db push` with the CLI).

-- ---------------------------------------------------------------------------
-- profiles
-- One row per user, keyed to auth.users. Created right after signup.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  age         integer not null check (age >= 18 and age <= 100),
  gender      text not null check (gender in ('Female', 'Male')),
  religion    text not null,
  location    text not null,
  profession  text not null,
  education   text not null,
  height      text not null,
  about       text not null default '',
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone (logged in or not) can browse visible profiles.
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (is_visible = true);

-- A user can insert only their own profile row (id must match their auth uid).
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- A user can update only their own profile row.
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- interests
-- "Express interest" clicks. from_profile -> to_profile, one per pair.
-- ---------------------------------------------------------------------------
create table if not exists public.interests (
  id            bigint generated always as identity primary key,
  from_profile  uuid not null references public.profiles(id) on delete cascade,
  to_profile    uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  created_at    timestamptz not null default now(),
  unique (from_profile, to_profile)
);

alter table public.interests enable row level security;

-- A user can see interests where they're the sender or the recipient.
create policy "Users can view their own interests"
  on public.interests for select
  using (auth.uid() = from_profile or auth.uid() = to_profile);

-- A user can only send interest as themselves, and not to themselves.
create policy "Users can send interest as themselves"
  on public.interests for insert
  with check (auth.uid() = from_profile and from_profile <> to_profile);

-- The recipient can update status (accept/decline).
create policy "Recipient can update interest status"
  on public.interests for update
  using (auth.uid() = to_profile);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_profiles_religion on public.profiles (religion);
create index if not exists idx_profiles_gender on public.profiles (gender);
create index if not exists idx_interests_to on public.interests (to_profile);
create index if not exists idx_interests_from on public.interests (from_profile);
