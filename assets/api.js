
async function signIn(email) {
  return sb.supabase.auth.signInWithOtp({
    email,
    options: {
      // Always redirect back to the live GitHub Pages site, not localhost
      emailRedirectTo: window.location.origin + window.location.pathname
    }
  });
}
async function signOut(){ await sb.supabase.auth.signOut(); location.reload(); }

async function getActiveWeek(){
  const today = new Date().toISOString().slice(0,10);
  const { data } = await sb.supabase.from('weeks')
    .select('*').lte('start_date', today).gte('end_date', today).maybeSingle();
  return data;
}
async function listWeeks(limit=12){
  const { data } = await sb.supabase.from('weeks').select('*').order('start_date',{ascending:false}).limit(limit);
  return data||[];
}
async function listLessonsForCurrentUser(weekId){
  const ctx = await sb.currentUserWithProfile();
  if(!ctx?.profile) return [];
  let q = sb.supabase.from('lessons').select('*').eq('week_id', weekId);
  if(ctx.profile.role === 'student') q = q.eq('for_user', ctx.profile.display_name);
  const { data } = await q.order('id', { ascending: true });
  return data||[];
}
async function listAllLessons(weekId){
  const { data } = await sb.supabase.from('lessons').select('*').eq('week_id', weekId).order('for_user').order('id');
  return data||[];
}
async function listStudents(){
  const { data } = await sb.supabase.from('profiles').select('*').eq('role','student');
  return data||[];
}
async function listAttemptsForLessons(lessonIds){
  if(!lessonIds.length) return [];
  const { data } = await sb.supabase.from('attempts').select('*').in('lesson_id', lessonIds);
  return data||[];
}
async function listAttemptsForUser(userId, weekId){
  let q = sb.supabase.from('attempts').select('*, lessons(*)');
  if(userId) q = q.eq('user_id', userId);
  if(weekId) q = q.eq('lessons.week_id', weekId);
  const { data } = await q;
  return data||[];
}
async function fetchSignedText(path){
  const { data, error } = await sb.supabase.storage.from('content').createSignedUrl(path, 120);
  if(error) throw error;
  const res = await fetch(data.signedUrl);
  return await res.text();
}
async function startAttempt(lessonId){
  const { data: { user } } = await sb.supabase.auth.getUser();
  const { data, error } = await sb.supabase.from('attempts')
    .insert({ user_id: user.id, lesson_id: lessonId }).select().single();
  if(error) throw error;
  return data;
}
async function submitAttempt(attemptId, score, detail){
  const { error } = await sb.supabase.from('attempts')
    .update({ submitted_at: new Date().toISOString(), score, detail })
    .eq('id', attemptId);
  if(error) throw error;
}
async function getRetakeStatus(userId, lessonId){
  const [{ data: grants }, { data: attempts }] = await Promise.all([
    sb.supabase.from('retake_grants').select('*').eq('user_id', userId).eq('lesson_id', lessonId).eq('used', false),
    sb.supabase.from('attempts').select('id').eq('user_id', userId).eq('lesson_id', lessonId).not('submitted_at','is', null)
  ]);
  return { canRetake: (attempts?.length ?? 0) > 0 && (grants?.length ?? 0) > 0 };
}
async function useOneRetake(userId, lessonId){
  const { data, error } = await sb.supabase
    .from('retake_grants').select('*')
    .eq('user_id', userId).eq('lesson_id', lessonId).eq('used', false).limit(1);
  if(error || !data?.length) return false;
  const { error: updErr } = await sb.supabase.from('retake_grants').update({ used:true }).eq('id', data[0].id);
  return !updErr;
}
async function grantRetake(kidUserId, lessonId){
  const { error } = await sb.supabase.from('retake_grants').insert({ user_id: kidUserId, lesson_id: lessonId });
  if(error) throw error;
}
async function recordAttempt(lessonId, userId, score) {
  const { data, error } = await sb.supabase
    .from("attempts")
    .insert([
      {
        lesson_id: lessonId,
        user_id: userId,
        score: score,
        submitted_at: new Date().toISOString()
      }
    ]);

  if (error) {
    console.error("Error recording attempt:", error.message);
    alert("Could not save your score. Please try again.");
  }
  return data;
}

window.api = { 
  signIn, 
  signOut, 
  getActiveWeek, 
  listWeeks, 
  listLessonsForCurrentUser, 
  listAllLessons, 
  listStudents, 
  listAttemptsForLessons, 
  listAttemptsForUser, 
  fetchSignedText, 
  startAttempt, 
  submitAttempt, 
  getRetakeStatus, 
  useOneRetake, 
  grantRetake, 
  recordAttempt   
};
