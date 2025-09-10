# Math Lessons & Tests (GitHub Pages + Supabase)

A lightweight web app to publish weekly **math lessons, quizzes, and tests** for multiple students, with login, scoring, and **parent-granted retakes**.

## What lives where?

- **GitHub Pages (this repo)** — static frontend (HTML/CSS/JS).
- **Supabase** — 
  - Authentication (password or magic link),
  - Postgres database (`lessons`, `tests`, `attempts`, `profiles` + `lesson_with_attempts` and `tests_with_attempts` views),
  - Storage for Markdown (`.md`) and Quiz/Test JSON (`.json`).

## Quick start

1. **Create a Supabase project.**
2. In **Authentication**, enable email/password (or magic links).
3. In **SQL Editor**, paste the SQL from `admin/seed.sql` to create tables + views.
4. Create users: one **parent** and two **students** (emails). Then insert rows into `profiles` mapping each `auth.users.id` to `display_name` (e.g., `"Daniel"`, `"Norah"`, `"Daddy"`).
5. In **Storage**, create a private bucket named `content`.
6. Upload lesson/test files:
   - Lessons → `content/{student}/lessons/*.md`
   - Quizzes → `content/{student}/quizzes/*.json`
   - Tests → `content/{student}/tests/*.md`
   - Test questions → `content/{student}/tests/questions/*.json`
7. Insert rows into `lessons` and `tests` tables pointing at those paths, with `for_user` matching the student’s `display_name`.
8. In this repo, edit `assets/supabaseClient.js` with your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
9. Enable **GitHub Pages** for this repo.

Visit `index.html` (student dashboard) and `parent.html` (parent controls).

## RLS Policies

Enable RLS and add policies so students only see their own rows:

```sql
alter table lesson_with_attempts enable row level security;
alter table tests_with_attempts enable row level security;

create policy "Students can only read their own lessons"
on lesson_with_attempts
for select
to authenticated
using (
  exists (
    select 1
    from profiles p
    where p.user_id = auth.uid()
      and lower(trim(p.display_name)) = lower(trim(for_user))
  )
);

create policy "Students can only read their own tests"
on tests_with_attempts
for select
to authenticated
using (
  exists (
    select 1
    from profiles p
    where p.user_id = auth.uid()
      and lower(trim(p.display_name)) = lower(trim(for_user))
  )
);
```

(Optionally add a parent policy if a parent account should see all students.)

## File formats

**Lesson/Test markdown (`.md`)** — plain Markdown, rendered with [marked.js].  
Images can be referenced with Markdown syntax:

```md
![Triangle](/assets/images/triangle.png)
```

**Quiz/Test JSON (`.json`)**

```json
{
  "title": "Adding Fractions — Quiz",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "2/7 + 3/7 = ?",
      "choices": ["4/7","5/7","6/7","2/14"],
      "answerIndex": 1
    }
  ]
}
```

## Dashboard behavior

- Students log in and only see rows where `for_user` matches their `display_name`.
- Lessons and tests are **ordered by `id`** in the dashboard.
- Incomplete rows are marked "Incomplete"; completed rows show ✅ and the score.
- ⚠️ badge shows if either the Markdown or JSON file is missing in storage.

## Retakes

- By default, students can submit once per lesson/test.
- A parent grants a retake from **Parent Dashboard**.
- The student can then re-open and resubmit; the retake is marked used.

## Privacy & Security

- Keep the bucket **private**; the app requests **signed URLs** at runtime.
- The **anon** key is safe **with RLS** (policies restrict data per user).  
- Never expose the service role key on the frontend.
