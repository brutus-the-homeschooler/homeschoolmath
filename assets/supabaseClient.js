
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co"; // <-- replace
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";             // <-- replace (safe with RLS)

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function currentUserWithProfile(){
  const { data: { user } } = await supabase.auth.getUser();
  if(!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  return { user, profile };
}

window.sb = { supabase, currentUserWithProfile };
