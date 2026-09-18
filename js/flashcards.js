const Flashcards = (() => {
  let queue = [];
  let idx = 0;
  let showingAnswer = false;
  let sessionStats = { correct: 0, total: 0 };

  function availableGroups(pool) {
    return [...new Set(pool.map((i) => i.group))].sort();
  }

  function render(container) {
    const currentChapter = SRS.getCurrentChapter();
    const pool = Content.itemsUpToChapter(currentChapter);
    const groups = availableGroups(pool);

    const preselect = App.consumePendingFocusGroup();

    container.innerHTML = `
      <h1>Flashcards</h1>
      <div class="card">
        <p>Studying material through <strong>Chapter ${currentChapter}</strong>. ${pool.length} items available.</p>
        <div class="row">
          <label>Focus: <select id="fc-group">
            <option value="">All (weakest &amp; due first)</option>
            ${groups.map((g) => `<option value="${g}" ${g === preselect ? "selected" : ""}>${g}</option>`).join("")}
          </select></label>
          <label>Chapter: <select id="fc-chapter">
            <option value="">All chapters</option>
            ${Array.from({ length: currentChapter }, (_, i) => i + 1)
              .map((n) => `<option value="${n}">Chapter ${n}</option>`)
              .join("")}
          </select></label>
          <label>Session size: <input type="number" id="fc-size" value="20" min="5" max="100" style="width:70px" /></label>
          <button class="btn" id="fc-start">Start Session</button>
        </div>
      </div>
      <div id="fc-session"></div>
    `;

    container.querySelector("#fc-start").addEventListener("click", () => {
      const group = container.querySelector("#fc-group").value;
      const chapter = container.querySelector("#fc-chapter").value;
      const size = parseInt(container.querySelector("#fc-size").value, 10) || 20;
      let filtered = group ? pool.filter((i) => i.group === group) : pool;
      if (chapter) filtered = filtered.filter((i) => i.chapter === parseInt(chapter, 10));
      queue = SRS.buildQueue(filtered, size);
      idx = 0;
      showingAnswer = false;
      sessionStats = { correct: 0, total: 0 };
      renderCard(container);
    });

    if (preselect) container.querySelector("#fc-start").click();
  }

  function renderCard(container) {
    const target = container.querySelector("#fc-session");
    if (!queue.length) {
      target.innerHTML = `<div class="card"><p>No items match this filter yet.</p></div>`;
      return;
    }
    if (idx >= queue.length) {
      target.innerHTML = `
        <div class="card">
          <h2>Session complete</h2>
          <p>${sessionStats.correct} / ${sessionStats.total} correct.</p>
          <button class="btn" id="fc-again">Study Again</button>
        </div>`;
      target.querySelector("#fc-again").addEventListener("click", () => render(container));
      return;
    }

    const item = queue[idx];
    target.innerHTML = `
      <div class="card">
        <div class="row between">
          <span class="pill">${item.group} · Ch. ${item.chapter}</span>
          <span class="pill">${idx + 1} / ${queue.length}</span>
        </div>
        <div class="flash-front">
          <div class="${item.promptGreek ? "greek" : ""}">${escapeHtml(item.prompt)}</div>
        </div>
        <div id="fc-back" style="display:none">
          <div class="flash-back">
            <div class="greek">${escapeHtml(item.answer)}</div>
            ${item.detail ? `<div class="flash-meta">${escapeHtml(item.detail)}</div>` : ""}
          </div>
          <p style="text-align:center; color:var(--text-dim); font-size:0.82rem; margin:0.75rem 0 0.25rem;">How did that go? (First three count as "knew it" — they only change how soon it comes back.)</p>
          <div class="grade-row">
            <button class="grade-btn again" data-q="1">Again<br /><small>Didn't know it</small></button>
            <button class="grade-btn hard" data-q="3">Hard<br /><small>Knew it, struggled</small></button>
            <button class="grade-btn good" data-q="4">Good<br /><small>Knew it</small></button>
            <button class="grade-btn easy" data-q="5">Easy<br /><small>Knew it instantly</small></button>
          </div>
        </div>
        <div class="row" style="justify-content:center" id="fc-reveal-row">
          <button class="btn" id="fc-reveal">Show Answer</button>
        </div>
      </div>`;

    target.querySelector("#fc-reveal").addEventListener("click", () => {
      target.querySelector("#fc-back").style.display = "block";
      target.querySelector("#fc-reveal-row").style.display = "none";
    });

    target.querySelectorAll(".grade-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const q = parseInt(btn.dataset.q, 10);
        SRS.grade(item.id, q);
        sessionStats.total += 1;
        if (q >= 3) sessionStats.correct += 1;
        idx += 1;
        renderCard(container);
      });
    });
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s ?? "";
    return div.innerHTML;
  }

  return { render };
})();
