
# Math Lessons (GitHub Pages + Supabase)

A lightweight web app to publish weekly math lessons and multiple-choice quizzes for **two students at different levels**, with login, scoring, and **parent-granted retakes**.

## What lives where?

- **GitHub Pages (this repo)** — static frontend (HTML/CSS/JS).
- **Supabase** — authentication (magic links), Postgres database (weeks/lessons/attempts/retakes), and Storage (lesson `.md` and quiz `.json`).

## Quick start

1. **Create a Supabase project.**
2. In **Authentication → Email**, enable **magic links**.
3. In **SQL Editor**, paste the SQL from `admin/seed.sql` to create tables + RLS.
4. Create users: one **parent** and two **students** (emails). Then insert rows into `profiles` mapping each `auth.users.id` to `display_name` `kid1`/`kid2` or any names you prefer.
5. In **Storage**, create a private bucket named `content`.
6. Upload weekly lesson/quiz files, e.g.:
   - `content/lessons/2025-W35/kid1/adding-fractions.md`
   - `content/quizzes/2025-W35/kid1/adding-fractions.json`
7. Insert `weeks` and `lessons` rows to point at those paths.
8. In this repo, edit `assets/supabaseClient.js` with your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
9. Enable **GitHub Pages** for this repo (from `main` or `/docs`).

Visit `index.html` (student dashboard) and `parent.html` (parent controls).

## Do I need separate lessons for Kid 1 / Kid 2?

Yes—**they can be on different levels**. Use the `for_user` field on each lesson (e.g., `kid1` or `kid2`) so each student only sees what is intended for them. You can name the students anything as long as it matches `profiles.display_name`.

**Example:** two different lessons in the same week:
```sql
insert into weeks (label, start_date, end_date) values ('2025-W35','2025-08-25','2025-08-31');

insert into lessons (week_id, slug, title, for_user, md_path, quiz_path, points, due_date)
values
((select id from weeks where label='2025-W35'),'adding-fractions','Adding Fractions','kid1',
 'content/lessons/2025-W35/kid1/adding-fractions.md',
 'content/quizzes/2025-W35/kid1/adding-fractions.json',100,'2025-08-31'),
((select id from weeks where label='2025-W35'),'place-value','Place Value','kid2',
 'content/lessons/2025-W35/kid2/place-value.md',
 'content/quizzes/2025-W35/kid2/place-value.json',100,'2025-08-31');
```

## File formats

**Lesson markdown (`.md`)** — any Markdown content.

**Quiz JSON (`.json`)**
```json
{
  "title": "Adding Fractions — Quiz",
  "questions": [
    { "id": "q1", "prompt": "2/7 + 3/7 = ?", "choices": ["4/7","5/7","6/7","2/14"], "answerIndex": 1, "explain": "Add the numerators; denominator stays 7." }
  ]
}
```

## Retakes

- By default, students can submit once per lesson.
- A parent grants a retake from **Parent Dashboard** → selects Student + Week + Lesson → **Grant Retake**.
- The student can then re-open the lesson and submit again; the grant is marked **used**.

## Privacy & Security

- Keep the bucket **private**; the app requests **signed URLs** at runtime.
- The **anon** key is safe **with RLS** (policies restrict data per user). Never expose the service role key on the frontend.
