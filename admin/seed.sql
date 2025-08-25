
-- Run in Supabase SQL Editor

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('parent','student')),
  created_at timestamptz default now()
);
create table if not exists weeks (
  id bigserial primary key,
  label text not null,
  start_date date not null,
  end_date date not null
);
create table if not exists lessons (
  id bigserial primary key,
  week_id bigint not null references weeks(id) on delete cascade,
  slug text not null,
  title text not null,
  for_user text not null,
  md_path text not null,
  quiz_path text not null,
  points int not null default 100,
  due_date date
);
create table if not exists attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id bigint not null references lessons(id) on delete cascade,
  started_at timestamptz default now(),
  submitted_at timestamptz,
  score int,
  detail jsonb
);
create table if not exists retake_grants (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id bigint not null references lessons(id) on delete cascade,
  granted_at timestamptz default now(),
  used boolean default false
);

alter table profiles enable row level security;
alter table weeks enable row level security;
alter table lessons enable row level security;
alter table attempts enable row level security;
alter table retake_grants enable row level security;

create policy "read own profile or parent sees self" on profiles
  for select using (auth.uid() = user_id);

create policy "weeks readable by anyone signed in" on weeks
  for select using (true);

create policy "lessons read" on lessons
  for select using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid()
        and (p.role = 'parent' or lessons.for_user = p.display_name)
    )
  );

create policy "attempts read" on attempts for select using (
  exists (select 1 from profiles where user_id = auth.uid() and role='parent')
  or user_id = auth.uid()
);
create policy "attempts insert" on attempts for insert with check (
  user_id = auth.uid()
  or exists (select 1 from profiles where user_id = auth.uid() and role='parent')
);
create policy "attempts update" on attempts for update using (
  user_id = auth.uid()
  or exists (select 1 from profiles where user_id = auth.uid() and role='parent')
);

create policy "retake read" on retake_grants
  for select using (
    exists (select 1 from profiles where user_id = auth.uid() and role='parent')
    or user_id = auth.uid()
  );
create policy "retake write" on retake_grants
  for insert with check (exists (select 1 from profiles where user_id = auth.uid() and role='parent'))
  for update using (exists (select 1 from profiles where user_id = auth.uid() and role='parent'));
