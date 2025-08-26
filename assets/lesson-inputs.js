
/**
 * lesson-inputs.js
 * Autosaves <textarea data-question-id> answers from Markdown lessons.
 * - LocalStorage by default
 * - Optional Supabase sync if ENABLE_SUPABASE === true and window.supabase is available
 *
 * USAGE:
 *   1) Include this script after your Markdown render.
 *   2) Call: window.attachLessonInputs({ lessonId, userId })
 *      - lessonId: string, e.g., "69" or "Lesson 69"
 *      - userId: string (Supabase auth user id), optional. If omitted, Supabase sync is skipped.
 */
(function () {
  const ENABLE_SUPABASE = true; // set false to disable Supabase syncing globally

  const log = (...args) => console.debug("[lesson-inputs]", ...args);

  function keyFor(lessonId, qid) {
    return `lesson:${lessonId}:answer:${qid}`;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function getLessonIdFromDOM() {
    const el = document.querySelector('[data-lesson-id]') || document.querySelector('#lesson[data-lesson-id]');
    if (el && el.dataset.lessonId) return el.dataset.lessonId;
    const h1 = document.querySelector("#lesson-title");
    if (h1 && h1.textContent) return h1.textContent.trim();
    return "unknown-lesson";
  }

  function loadLocal(lessonId, qid) {
    const raw = localStorage.getItem(keyFor(lessonId, qid));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function saveLocal(lessonId, qid, value, ts = nowISO()) {
    const payload = JSON.stringify({ value, updated_at: ts });
    localStorage.setItem(keyFor(lessonId, qid), payload);
  }

  async function loadAllFromSupabase(userId, lessonId) {
    if (!window.supabase) return {};
    const { data, error } = await window.supabase
      .from("lesson_responses")
      .select("question_id, answer, updated_at")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);
    if (error) {
      log("Supabase load error", error);
      return {};
    }
    const map = {};
    (data || []).forEach(r => {
      map[r.question_id] = { value: r.answer, updated_at: r.updated_at };
    });
    return map;
  }

  async function saveOneToSupabase(userId, lessonId, qid, value) {
    if (!window.supabase) return;
    const ts = nowISO();
    const { error } = await window.supabase
      .from("lesson_responses")
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        question_id: qid,
        answer: value,
        updated_at: ts
      }, { onConflict: "user_id,lesson_id,question_id" });
    if (error) log("Supabase save error", error);
    return ts;
  }

  function debounce(fn, wait = 350) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  async function attachLessonInputs({ lessonId, userId } = {}) {
    const resolvedLessonId = lessonId || getLessonIdFromDOM();
    const enableSupabase = ENABLE_SUPABASE && !!userId && !!window.supabase;

    // 1) Load Supabase answers (if enabled)
    let supabaseAnswers = {};
    if (enableSupabase) {
      try {
        supabaseAnswers = await loadAllFromSupabase(userId, resolvedLessonId);
      } catch (e) {
        log("Supabase pre-load failed", e);
      }
    }

    // 2) Bind textareas
    const inputs = document.querySelectorAll('textarea[data-question-id]');
    inputs.forEach((ta) => {
      const qid = (ta.dataset.questionId || "").trim();
      if (!qid) return;

      // Hydrate from Supabase or localStorage with newest wins
      const local = loadLocal(resolvedLessonId, qid); // { value, updated_at }
      const remote = supabaseAnswers[qid];           // { value, updated_at }

      let initial = "";
      if (local && remote) {
        initial = (new Date(remote.updated_at) > new Date(local.updated_at)) ? remote.value : local.value;
      } else if (remote) {
        initial = remote.value;
      } else if (local) {
        initial = local.value;
      }
      if (typeof initial === "string" && initial.length) {
        ta.value = initial;
      }

      const doSave = debounce(async () => {
        const val = ta.value;
        // Always save locally
        saveLocal(resolvedLessonId, qid, val);
        // Optionally sync to Supabase
        if (enableSupabase) {
          try {
            const ts = await saveOneToSupabase(userId, resolvedLessonId, qid, val);
            if (ts) saveLocal(resolvedLessonId, qid, val, ts); // update local timestamp after cloud save
          } catch (e) {
            log("Supabase save failed", e);
          }
        }
      }, 400);

      ta.addEventListener("input", doSave);
      ta.addEventListener("blur", doSave);
    });

    log(`Attached ${document.querySelectorAll('textarea[data-question-id]').length} inputs for lesson '${resolvedLessonId}'. Supabase: ${enableSupabase ? "on" : "off"}`);
  }

  // Expose globally
  window.attachLessonInputs = attachLessonInputs;
})();
