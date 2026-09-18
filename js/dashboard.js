const Dashboard = (() => {
  function render(container) {
    const chapter = SRS.getCurrentChapter();
    const pool = Content.itemsUpToChapter(chapter);
    const overall = SRS.overallStats(pool);
    const byGroup = SRS.statsFor(pool, (i) => i.group);
    const byChapter = SRS.statsFor(pool, (i) => `Ch. ${i.chapter}`);

    const overallPct = overall.correct + overall.incorrect > 0
      ? Math.round((100 * overall.correct) / (overall.correct + overall.incorrect))
      : null;

    container.innerHTML = `
      <h1>Dashboard</h1>
      <div class="card">
        <div class="stat-grid">
          <div class="stat-tile"><div class="num">${chapter}</div><div class="label">Current chapter</div></div>
          <div class="stat-tile"><div class="num">${overall.total}</div><div class="label">Items unlocked</div></div>
          <div class="stat-tile"><div class="num">${overall.due}</div><div class="label">Due for review</div></div>
          <div class="stat-tile"><div class="num">${overallPct === null ? "—" : overallPct + "%"}</div><div class="label">Overall accuracy</div></div>
        </div>
      </div>

      <div class="card">
        <h2>Weak areas by topic</h2>
        <p style="color:var(--text-dim); font-size:0.85rem;">Percentage = % of answers correct so far, not % mastered. Click a bar to drill it. A muted <strong>*</strong> means too few attempts yet to trust the number.</p>
        <div id="dash-groups"></div>
      </div>

      <div class="card">
        <h2>Accuracy by chapter</h2>
        <div id="dash-chapters"></div>
      </div>
    `;

    renderBars(container.querySelector("#dash-groups"), byGroup, true);
    renderBars(container.querySelector("#dash-chapters"), byChapter, false);
  }

  // Below this many graded attempts, a percentage is just noise (one lucky
  // or unlucky answer swings it to 0%/100%) — show it muted with the raw
  // count instead of a confident-looking colored bar.
  const MIN_ATTEMPTS_FOR_CONFIDENT_PCT = 5;

  function renderBars(target, buckets, clickable) {
    const rows = Object.entries(buckets)
      .map(([key, b]) => {
        const total = b.correct + b.incorrect;
        const pct = total > 0 ? Math.round((100 * b.correct) / total) : null;
        return { key, b, pct, attempts: total };
      })
      .sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999));

    if (!rows.length) {
      target.innerHTML = `<p style="color:var(--text-dim)">Nothing studied yet.</p>`;
      return;
    }

    target.innerHTML = rows
      .map(({ key, b, pct, attempts }) => {
        const lowSample = pct !== null && attempts < MIN_ATTEMPTS_FOR_CONFIDENT_PCT;
        const color = pct === null || lowSample ? "var(--text-dim)" : pct < 60 ? "var(--bad)" : pct < 80 ? "var(--warn)" : "var(--good)";
        const width = pct === null ? 0 : pct;
        const pctLabel = pct === null ? "—" : `${pct}%`;
        return `
          <div class="bar-row ${clickable ? "clickable" : ""}" data-key="${escAttr(key)}" style="${clickable ? "cursor:pointer" : ""}">
            <div class="bar-label">${esc(key)} <span style="color:var(--text-dim)">(${b.seen}/${b.total} words/forms seen${pct !== null ? `, ${b.correct}/${attempts} answers correct` : ""})</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${width}%; background:${color}"></div></div>
            <div class="bar-pct">${pctLabel}${lowSample ? '<span title="Only a few attempts so far — not enough to be a reliable number yet." style="cursor:help">*</span>' : ""}</div>
          </div>`;
      })
      .join("");

    if (clickable) {
      target.querySelectorAll(".bar-row").forEach((row) => {
        row.addEventListener("click", () => {
          App.focusGroupAndGo(row.dataset.key);
        });
      });
    }
  }

  function esc(s) {
    const div = document.createElement("div");
    div.textContent = s ?? "";
    return div.innerHTML;
  }
  function escAttr(s) {
    return esc(s).replace(/"/g, "&quot;");
  }

  return { render };
})();
