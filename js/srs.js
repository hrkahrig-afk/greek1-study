// SM-2 spaced repetition scheduling + localStorage-backed progress store.
const SRS = (() => {
  const STORAGE_KEY = "greek1_study_progress_v1";

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(iso, days) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function defaultState() {
    return {
      currentChapter: 1,
      items: {}, // id -> { ease, interval, reps, due, correct, incorrect, lastResult }
    };
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, items: parsed.items || {} };
    } catch (e) {
      console.error("Failed to load progress, starting fresh.", e);
      return defaultState();
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getItemState(id) {
    if (!state.items[id]) {
      state.items[id] = { ease: 2.5, interval: 0, reps: 0, due: todayISO(), correct: 0, incorrect: 0, lastResult: null };
    }
    return state.items[id];
  }

  // grade: 0 (again) .. 5 (easy). Anything < 3 counts as incorrect/lapse.
  function grade(id, quality) {
    const it = getItemState(id);
    const correct = quality >= 3;
    if (correct) it.correct += 1;
    else it.incorrect += 1;
    it.lastResult = correct;

    if (quality < 3) {
      it.reps = 0;
      it.interval = 1;
    } else {
      if (it.reps === 0) it.interval = 1;
      else if (it.reps === 1) it.interval = 6;
      else it.interval = Math.round(it.interval * it.ease);
      it.reps += 1;
    }
    it.ease = Math.max(1.3, it.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    it.due = addDays(todayISO(), it.interval);
    persist();
    return it;
  }

  function isDue(id) {
    const it = state.items[id];
    if (!it) return true; // never studied = due now
    return it.due <= todayISO();
  }

  function setCurrentChapter(chapter) {
    state.currentChapter = chapter;
    persist();
  }

  function getCurrentChapter() {
    return state.currentChapter;
  }

  // Build a study queue from a pool of items: due/never-seen items ranked
  // first (weakest accuracy first, never-seen treated as weakest), but if
  // everything in the pool has already been reviewed today (nothing due
  // until tomorrow), fall back to the whole pool ranked the same way —
  // otherwise a session started right after finishing one on the same
  // filter would come back empty, which reads as "the quiz won't start."
  function rank(pool) {
    const scored = pool.map((item) => {
      const st = state.items[item.id];
      const total = st ? st.correct + st.incorrect : 0;
      const acc = total > 0 ? st.correct / total : -1; // never-studied ranks as weakest
      return { item, due: isDue(item.id), acc };
    });
    shuffle(scored);
    scored.sort((a, b) => {
      if (a.due !== b.due) return a.due ? -1 : 1;
      return a.acc - b.acc;
    });
    return scored.map((s) => s.item);
  }

  function buildQueue(pool, limit) {
    return rank(pool).slice(0, limit || 20);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---- stats aggregation for the dashboard --------------------------------
  function statsFor(items, keyFn) {
    const buckets = {};
    for (const item of items) {
      const st = state.items[item.id];
      const key = keyFn(item);
      if (!buckets[key]) buckets[key] = { correct: 0, incorrect: 0, seen: 0, total: 0 };
      buckets[key].total += 1;
      if (st && st.correct + st.incorrect > 0) {
        buckets[key].seen += 1;
        buckets[key].correct += st.correct;
        buckets[key].incorrect += st.incorrect;
      }
    }
    return buckets;
  }

  function overallStats(items) {
    let correct = 0, incorrect = 0, seen = 0, due = 0;
    for (const item of items) {
      const st = state.items[item.id];
      if (st) {
        seen += 1;
        correct += st.correct;
        incorrect += st.incorrect;
        if (isDue(item.id)) due += 1;
      } else {
        due += 1;
      }
    }
    return { correct, incorrect, seen, due, total: items.length };
  }

  function exportProgress() {
    return JSON.stringify(state, null, 2);
  }

  function importProgress(json) {
    const parsed = JSON.parse(json);
    state = { ...defaultState(), ...parsed, items: parsed.items || {} };
    persist();
  }

  function resetProgress() {
    state = defaultState();
    persist();
  }

  return {
    grade,
    isDue,
    getItemState,
    setCurrentChapter,
    getCurrentChapter,
    buildQueue,
    statsFor,
    overallStats,
    exportProgress,
    importProgress,
    resetProgress,
    shuffle,
  };
})();
