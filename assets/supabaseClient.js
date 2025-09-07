if (!window.sb) {
  const SUPABASE_URL = "https://sbrknvtpeexfylbxyhkp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJh...";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function currentUserWithProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    return { user, profile };
  }

  window.sb = { supabase, currentUserWithProfile };
}
