// assets/api.js

// ---------- Auth ----------
async function signIn(email) {
  return sb.supabase.auth.signInWithOtp({
    email,
    options: {
      // Always redirect back to the live GitHub Pages site, not localhost
      emailRedirectTo: window.location.origin + window.location.pathname,
    },
  });
}

async function signOut() {
  await sb.supabase.auth.signOut();
  location.reload();
}

async function signInWithPassword(email, password) {
  const { data, error } = await sb.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert("Login failed: " + error.message);
    return null;
  }
  return data;
}

// ---------- Date helpers ----------
function todayLocalISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // shift to local
  return d.toISOString().slice(0, 10); // YYYY-MM-DD in local time
}

// ---------- Content fetch ----------
async function fetchSignedText(path) {
  const { data, error } = await sb.supabase.storage.from("content").createSignedUrl(path, 120);
  if (error) throw error;
  const res = await fetch(data.signedUrl);
  return await res.text();
}

// ---------- Lessons ----------
/**
 * Get a lesson by numeric id
 */
async function getLesson(lessonId) {
  const { data, error } = await sb.supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle();
  if (error) {
    console.error("Error fetching lesson:", error.message);
    return null;
  }
  return data;
}
/**
 * Check that both markdown and quiz JSON exist for a lesson.
 * lesson.md_path and lesson.quiz_path should be storage paths like "lessons/lesson-01.md"
 */
async function checkLessonFilesExist(lesson) {
  const bucket = "content"; // change if your bucket is named differently

  // Try to create signed URLs for both files (if they don't exist, you'll get an error)
  const [mdRes, quizRes] = await Promise.all([
    sb.supabase.storage.from(bucket).createSignedUrl(lesson.md_path, 60),
    sb.supabase.storage.from(bucket).createSignedUrl(lesson.quiz_path, 60)
  ]);

  return !(mdRes.error || quizRes.error);
}

/**
 * Get a lesson by slug
 */
async function getLessonBySlug(slug) {
  const { data, error } = await sb.supabase.from("lessons").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    console.error("Error fetching lesson by slug:", error.message);
    return null;
  }
  return data;
}

/**
 * List ALL lessons in the site (unfiltered).
 * Use this with the Completed / Not completed dashboard filter.
 */
async function listAllLessonsForSite() {
  const { data, error } = await sb.supabase
    .from("lessons")
    .select("*")
    .order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * (Optional) Limit lessons to the current user if you use per-student assignment.
 * Call this if you want "students see only their own lessons".
 */
async function listLessonsAssignedToCurrentUser() {
  const ctx = await sb.currentUserWithProfile();
  if (!ctx?.profile) return [];
  let q = sb.supabase.from("lessons").select("*");
  if (ctx.profile.role === "student") q = q.eq("for_user", ctx.profile.display_name);
  const { data, error } = await q.order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Multiple-week helper (kept for compatibility). If you pass weekIds, we filter by them.
 * If you are moving away from weeks entirely, you can stop using this and remove later.
 */
async function listLessonsForCurrentUserMulti(weekIds) {
  const ctx = await sb.currentUserWithProfile();
  if (!ctx?.profile) return [];
  let q = sb.supabase.from("lessons").select("*");
  if (Array.isArray(weekIds) && weekIds.length) {
    q = q.in("week_id", weekIds);
  }
  if (ctx.profile.role === "student") q = q.eq("for_user", ctx.profile.display_name);
  const { data, error } = await q.order("week_id", { ascending: false }).order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ---------- Attempts / Completion ----------
/**
 * Start an attempt row (if you use a start/submit flow).
 */
async function startAttempt(lessonId) {
  const { data: { user } } = await sb.supabase.auth.getUser();
  const { data, error } = await sb.supabase
    .from("attempts")
    .insert({ user_id: user.id, lesson_id: lessonId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Submit an attempt (mark completed with score + detail).
 */
async function submitAttempt(attemptId, score, detail) {
  const { error } = await sb.supabase
    .from("attempts")
    .update({ submitted_at: new Date().toISOString(), score, detail })
    .eq("id", attemptId);
  if (error) throw error;
}

/**
 * Record a single attempt directly (used by lesson.html Submit).
 * Returns { data, error } so the caller can surface errors in the UI.
 */
async function recordAttempt(lessonId, userId, score) {
  const { data, error } = await sb.supabase
    .from("attempts")
    .insert([
      {
        lesson_id: lessonId,
        user_id: userId,
        score: score,
        submitted_at: new Date().toISOString(),
      },
    ])
    .select()
    .maybeSingle();
  return { data, error };
}

/**
 * List attempts for a specific user (all lessons).
 * Use this to compute Completed vs Not completed.
 */
async function listAttemptsForUserAll(userId) {
  const { data, error } = await sb.supabase
    .from("attempts")
    .select("lesson_id, submitted_at, score")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

/**
 * Existing helper: list attempts by many lesson ids (kept if used).
 */
async function listAttemptsForLessons(lessonIds) {
  if (!lessonIds?.length) return [];
  const { data, error } = await sb.supabase.from("attempts").select("*").in("lesson_id", lessonIds);
  if (error) throw error;
  return data || [];
}

/**
 * Existing helper: attempts (optionally filter by userId and/or weekId via join)
 * Kept for compatibility (parent dashboards etc). Safe to remove if unused.
 */
async function listAttemptsForUser(userId, weekId) {
  let q = sb.supabase.from("attempts").select("*, lessons(*)");
  if (userId) q = q.eq("user_id", userId);
  if (weekId) q = q.eq("lessons.week_id", weekId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ---------- Retake flow (unchanged) ----------
async function getRetakeStatus(userId, lessonId) {
  const [{ data: grants }, { data: attempts }] = await Promise.all([
    sb.supabase
      .from("retake_grants")
      .select("*")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .eq("used", false),
    sb.supabase
      .from("attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .not("submitted_at", "is", null),
  ]);
  return { canRetake: (attempts?.length ?? 0) > 0 && (grants?.length ?? 0) > 0 };
}

async function useOneRetake(userId, lessonId) {
  const { data, error } = await sb.supabase
    .from("retake_grants")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .eq("used", false)
    .limit(1);
  if (error || !data?.length) return false;
  const { error: updErr } = await sb.supabase.from("retake_grants").update({ used: true }).eq("id", data[0].id);
  return !updErr;
}

async function grantRetake(kidUserId, lessonId) {
  const { error } = await sb.supabase.from("retake_grants").insert({ user_id: kidUserId, lesson_id: lessonId });
  if (error) throw error;
}

// ---------- Weeks (DEPRECATED in UI; keep only if other pages still use) ----------
/**
 * DEPRECATED: prefer completion-based views. Left for compatibility.
 */
async function getActiveWeek() {
  const today = todayLocalISO(); // local date
  const { data } = await sb.supabase
    .from("weeks")
    .select("*")
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();
  return data;
}

/**
 * DEPRECATED: prefer completion-based views. Left for compatibility.
 */
async function listWeeks(limit = 12) {
  const { data } = await sb.supabase.from("weeks").select("*").order("start_date", { ascending: false }).limit(limit);
  return data || [];
}

/**
 * DEPRECATED: prefer listLessonsAssignedToCurrentUser() or listAllLessonsForSite().
 * Kept because other pages might still call this.
 */
async function listLessonsForCurrentUser(weekId) {
  const ctx = await sb.currentUserWithProfile();
  if (!ctx?.profile) return [];
  let q = sb.supabase.from("lessons").select("*").eq("week_id", weekId);
  if (ctx.profile.role === "student") q = q.eq("for_user", ctx.profile.display_name);
  const { data } = await q.order("id", { ascending: true });
  return data || [];
}

/**
 * DEPRECATED: week-scoped listing. Prefer all-lessons + completion filter.
 */
async function listAllLessons(weekId) {
  const { data } = await sb.supabase
    .from("lessons")
    .select("*")
    .eq("week_id", weekId)
    .order("for_user")
    .order("id");
  return data || [];
}

// ---------- Exports ----------
window.api = {
  // Auth
  signIn,
  signInWithPassword,
  signOut,

  // Date
  todayLocalISO,

  // Content
  fetchSignedText,

  // Lessons
  getLesson,
  getLessonBySlug,
  listAllLessonsForSite,
  listLessonsAssignedToCurrentUser,
  listLessonsForCurrentUserMulti, // new multi-week compatible
  checkLessonFilesExist,
  // Attempts / completion
  startAttempt,
  submitAttempt,
  recordAttempt,              // now returns { data, error }
  listAttemptsForUserAll,     // for Completed vs Not completed
  listAttemptsForLessons,
  listAttemptsForUser,
  
  // Retake
  getRetakeStatus,
  useOneRetake,
  grantRetake,

  // Weeks (deprecated in UI)
  getActiveWeek,
  listWeeks,
  listLessonsForCurrentUser,
  listAllLessons,
};
