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
  const userName = (ctx.profile.display_name || "").trim().toLowerCase();
  let q = sb.supabase.from("lessons").select("*");
  const { data, error } = await q.order("id", { ascending: true });
  if (error) throw error;
  return (data || []).filter(l => (l.for_user || "").trim().toLowerCase() === userName);
}

// From the view with attempts
async function listLessonsWithAttempts(userName) {
  const { data, error } = await sb.supabase
    .from("lesson_with_attempts")
    .select("*");
  if (error) throw error;
  return (data || []).filter(l => (l.for_user || "").trim().toLowerCase() === userName);
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
/*
async function listTestsAssignedToCurrentUser() {
  const ctx = await sb.currentUserWithProfile();
  if (!ctx?.profile) return [];
  const userName = (ctx.profile.display_name || "").trim().toLowerCase();
  let q = sb.supabase.from("tests").select("*");
  const { data, error } = await q.order("id", { ascending: true });
  if (error) throw error;
  return (data || []).filter(t => (t.for_user || "").trim().toLowerCase() === userName);
}*/

async function listTestsWithAttempts(userName) {
  const { data, error } = await sb.supabase
    .from("tests_with_attempts")
    .select("*");
  if (error) throw error;

  console.log("All tests_with_attempts rows:", data.map(t => ({
    slug: t.slug,
    for_user: t.for_user
  })));
  console.log("Comparing against userName =", userName);

  return (data || []).filter(t =>
    (t.for_user || "").trim().toLowerCase() === userName
  );
}



// From the view with attempts
async function listTestsWithAttempts(userName) {
  const { data, error } = await sb.supabase
    .from("tests_with_attempts")
    .select("*");
  if (error) throw error;
  return (data || []).filter(t => (t.for_user || "").trim().toLowerCase() === userName);
}

// ---------- Attempts ----------
async function upsertAttempt(mappingId, userId, score) {
  const { error } = await sb.supabase
    .from("attempts")
    .upsert(
      {
        mapping_id: mappingId,
        user_id: userId,
        score,
      },
      { onConflict: "user_id,mapping_id" }
    );
  if (error) throw error;
}

async function listAttemptsForUserAll(userId) {
  const { data, error } = await sb.supabase
    .from("attempts")
    .select("mapping_id, score")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

// ---------- Exports ----------
window.api = {
  // Auth
  signIn,
  signInWithPassword,
  signOut,

  // Date helpers
  todayLocalISO,

  // Content
  fetchSignedText,

  // Lessons
  getLessonBySlug,
  listLessonsAssignedToCurrentUser,
  listLessonsWithAttempts,

  // Tests
  getTestBySlug,
  listTestsAssignedToCurrentUser,
  listTestsWithAttempts,

  // Attempts
  upsertAttempt,
  listAttemptsForUserAll,
};
