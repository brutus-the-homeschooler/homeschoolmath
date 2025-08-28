// /assets/js/parent-controls.js
import { supabase } from './supabaseClient.js'; // <-- update path/name if needed

async function saveParentOverride({ lessonId, studentId, completed, score, attempts, note }) {
  // Send NULLs when fields are empty
  const payload = {
    lesson_id: lessonId,
    student_id: studentId,
    completed,
    score_override: (score === '' || score === null) ? null : Number(score),
    attempts_override: (attempts === '' || attempts === null) ? null : Number(attempts),
    notes: note || null
  };

  const { data, error } = await supabase
    .from('lesson_parent_overrides')
    .upsert(payload, { onConflict: 'lesson_id,student_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function initParentControls(root) {
  const lessonId = root.dataset.lessonId;
  const studentId = root.dataset.studentId;

  const doneEl = root.querySelector('[data-pc-done]');
  const scoreEl = root.querySelector('[data-pc-score]');
  const attemptsEl = root.querySelector('[data-pc-attempts]');
  const noteEl = root.querySelector('[data-pc-note]');
  const saveBtn = root.querySelector('[data-pc-save]');
  const revertBtn = root.querySelector('[data-pc-revert]');
  const sourceBadge = root.querySelector('[data-source-badge]');

  // Seed initial values (from server-rendered data-*)
  if (root.dataset.initialDone) {
    doneEl.checked = root.dataset.initialDone === 'true';
  }
  if (root.dataset.initialScore && root.dataset.initialScore !== 'null') {
    scoreEl.value = root.dataset.initialScore;
  }
  if (root.dataset.initialAttempts && root.dataset.initialAttempts !== 'null') {
    attemptsEl.value = root.dataset.initialAttempts;
  }

  function setSavingState(isSaving) {
    saveBtn.disabled = isSaving;
    saveBtn.textContent = isSaving ? 'Saving…' : 'Save';
  }

  saveBtn.addEventListener('click', async () => {
    try {
      setSavingState(true);
      const row = await saveParentOverride({
        lessonId,
        studentId,
        completed: !!doneEl.checked,
        score: scoreEl.value,
        attempts: attemptsEl.value,
        note: noteEl.value
      });
      sourceBadge.textContent = 'Parent override';
    } catch (e) {
      alert(e.message || 'Save failed');
    } finally {
      setSavingState(false);
    }
  });

  // Revert just clears inputs (your RLS/trigger will keep historical data server-side)
  revertBtn.addEventListener('click', () => {
    doneEl.checked = false;
    scoreEl.value = '';
    attemptsEl.value = '';
    noteEl.value = '';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.parent-controls').forEach(initParentControls);
});
