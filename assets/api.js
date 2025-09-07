// ---------- Auth ----------
async function signIn(email) {
  return sb.supabase.auth.signInWithOtp({
    email,
    options: {
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
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// ---------- Content fetch ----------
async function fetchSignedText(path) {
  const { data, error } = await sb.supabase.storage.from("content").createSignedUrl(path, 120);
  if (error) throw error;
  const res = await fetch(data.signedUrl);
  return await res.text();
}

// ---------- Lessons ----------
async function getLessonBySlug(slug) {
  const { data, error } = await sb.supabase.from("lessons").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    console.error("Error fetching lesson by slug:", error.message);
    return null;
  }
  return data;
}

async function listLessonsAssignedToCurrentUser() {
  const ctx = await sb.currentUserWithProfile();
  if (!ctx?.profile) return [];
  let q = sb.supabase.from("lessons").select("*");
  if (ctx.profile.role === "student") q = q.eq("for_user", ctx.profile.display_name);
  const { data, error } = await q.order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ---------- Tests ----------
async function getTestBySlug(slug) {
  const { data, error } = await sb.supabase.from("tests").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    console.error("Error fetching test by slug:", error.message);
    return null;
  }
  return data;
}

async function listTestsAssignedToCurrentUser() {
  const ctx = await sb.currentUserWithProfile();
  if (!ctx?.profile) return [];
  let q = sb.supabase.from("tests").select("*");
  if (ctx.profile.role === "student") q = q.eq("for_user", ctx.profile.display_name);
  const { data, error } = await q.order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ---------- Attempts ----------
async function recordAttempt(itemId, userId, score, isTest = false) {
  const { data, error } = await sb.supabase
    .from("attempts")
    .insert([
      {
        lesson_id: isTest ? null : itemId,
        test_id: isTest ? itemId : null,
        user_id: userId,
        score,
        submitted_at: new Date().toISOString(),
      },
    ])
    .select()
    .maybeSingle();
  return { data, error };
}

async function listAttemptsForUserAll(userId) {
  const { data, error } = await sb.supabase
    .from("attempts")
    .select("lesson_id, test_id, submitted_at, score")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

// ---------- Exports ----------
window.api = {
  signIn,
  signInWithPassword,
  signOut,

  todayLocalISO,
  fetchSignedText,

  // Lessons
  getLessonBySlug,
  listLessonsAssignedToCurrentUser,

  // Tests
  getTestBySlug,
  listTestsAssignedToCurrentUser,

  // Attempts
  recordAttempt,
  listAttemptsForUserAll,
};
