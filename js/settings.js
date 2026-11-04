const Settings = (() => {
  // Counts of raw input events the page receives (capture phase), so a phone
  // that isn't delivering taps can be told apart from code that isn't reacting.
  const seen = { pointerdown: 0, touchstart: 0, touchend: 0, click: 0 };
  Object.keys(seen).forEach((type) =>
    document.addEventListener(type, () => { seen[type] += 1; }, true)
  );
  let testTaps = 0;

  function storageNote() {
    const mode = SRS.getStorageMode();
    if (mode === "claude") return "Saving: progress is stored with Claude and survives reloads.";
    if (mode === "browser") return "Saving: progress is stored in this browser only.";
    return "Saving: progress can't be saved in this view, so it resets when you close it. Use Download Progress to keep a copy.";
  }

  function render(container) {
    const data = Content.getData();
    const chapter = SRS.getCurrentChapter();

    container.innerHTML = `
      <h1>Settings</h1>

      <div class="card">
        <h2>Current chapter</h2>
        <p style="color:var(--text-dim)">Content is only introduced once you've set your current chapter to it or beyond — this matches where you actually are in the book.</p>
        <div class="row">
          <input type="range" id="st-chapter" min="1" max="24" value="${chapter}" style="max-width:400px" />
          <strong id="st-chapter-label">Chapter ${chapter}</strong>
        </div>
        <p class="flash-meta" id="st-chapter-title">${esc(data.chapters[chapter - 1]?.title || "")}</p>
      </div>

      <div class="card">
        <h2>Troubleshooting</h2>
        <p class="flash-meta">If buttons aren't responding, tap the test button below five times, then read me the numbers.</p>
        <button class="btn" id="st-taptest">Tap test</button>
        <p class="flash-meta" id="st-tapstats"></p>
        <p class="flash-meta" id="st-env"></p>
        <p class="flash-meta" id="st-errors"></p>
      </div>

      <div class="card">
        <h2>Progress backup</h2>
        <p style="color:var(--text-dim)">Export your progress to keep a backup or move to another machine.</p>
        <p class="flash-meta" id="st-storage">${esc(storageNote())}</p>
        <div class="row">
          <button class="btn" id="st-export">Download Progress</button>
          <button class="btn secondary" id="st-reset">Reset All Progress</button>
        </div>
        <p style="margin-top:1rem;">Import from a file:</p>
        <textarea class="import-box" id="st-import-box" placeholder="Paste exported JSON here, or use the file picker below"></textarea>
        <div class="row" style="margin-top:0.5rem;">
          <input type="file" id="st-import-file" accept="application/json" />
          <button class="btn secondary" id="st-import-btn">Import</button>
        </div>
        <div id="st-msg"></div>
      </div>
    `;

    function paintDiagnostics() {
      const stats = container.querySelector("#st-tapstats");
      if (!stats) return false;
      stats.textContent = `Taps on the test button: ${testTaps}. Events the page received: pointerdown ${seen.pointerdown}, touchstart ${seen.touchstart}, touchend ${seen.touchend}, click ${seen.click}.`;
      container.querySelector("#st-env").textContent =
        `Touch device: ${MatchGame.isTouchDevice() ? "yes" : "no"}. Claude runtime: ${window.claude ? "present" : "absent"}. Saving mode: ${SRS.getStorageMode()}.`;
      const errs = window.__appErrors || [];
      container.querySelector("#st-errors").textContent = errs.length
        ? `Errors since load (${errs.length}): ${errs.slice(-3).join(" | ")}`
        : "Errors since load: none.";
      return true;
    }
    paintDiagnostics();
    const timer = setInterval(() => { if (!paintDiagnostics()) clearInterval(timer); }, 500);
    container.querySelector("#st-taptest").addEventListener("click", () => {
      testTaps += 1;
      paintDiagnostics();
    });

    const slider = container.querySelector("#st-chapter");
    slider.addEventListener("input", () => {
      const ch = parseInt(slider.value, 10);
      container.querySelector("#st-chapter-label").textContent = `Chapter ${ch}`;
      container.querySelector("#st-chapter-title").textContent = data.chapters[ch - 1]?.title || "";
      SRS.setCurrentChapter(ch);
    });

    container.querySelector("#st-export").addEventListener("click", () => {
      const blob = new Blob([SRS.exportProgress()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `greek1-progress-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    container.querySelector("#st-reset").addEventListener("click", () => {
      if (confirm("This clears all study progress in this browser. Continue?")) {
        SRS.resetProgress();
        render(container);
      }
    });

    container.querySelector("#st-import-file").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      file.text().then((text) => (container.querySelector("#st-import-box").value = text));
    });

    container.querySelector("#st-import-btn").addEventListener("click", () => {
      const msg = container.querySelector("#st-msg");
      try {
        SRS.importProgress(container.querySelector("#st-import-box").value);
        msg.innerHTML = `<div class="feedback correct">Progress imported.</div>`;
        render(container);
      } catch (e) {
        msg.innerHTML = `<div class="feedback incorrect">Import failed: ${esc(e.message)}</div>`;
      }
    });
  }

  function esc(s) {
    const div = document.createElement("div");
    div.textContent = s ?? "";
    return div.innerHTML;
  }

  return { render };
})();
