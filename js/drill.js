const Drill = (() => {
  let mode = "type"; // "type" | "match"

  function render(container) {
    const data = Content.getData();
    const chapter = SRS.getCurrentChapter();
    const paradigms = data.paradigms
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => p.drillable && p.chapter != null && p.chapter <= chapter);

    container.innerHTML = `
      <h1>Paradigm Drill</h1>
      <div class="card">
        <p>Fill in a full declension/conjugation table from memory. Available through <strong>Chapter ${chapter}</strong>.</p>
        <div class="row">
          <select id="dr-pick" style="min-width:280px">
            ${paradigms.map(({ p, idx }) => `<option value="${idx}">${esc(p.title)} (Ch. ${p.chapter})</option>`).join("")}
          </select>
          <button class="btn" id="dr-start">Drill This Table</button>
        </div>
        <div class="row" style="margin-top:0.5rem;">
          <label><input type="radio" name="dr-mode" value="type" ${mode === "type" ? "checked" : ""} /> Type answers</label>
          <label><input type="radio" name="dr-mode" value="match" ${mode === "match" ? "checked" : ""} /> Drag &amp; match</label>
        </div>
      </div>
      <div id="dr-session"></div>
    `;

    container.querySelector("#dr-start").addEventListener("click", () => {
      mode = container.querySelector('input[name="dr-mode"]:checked').value;
      const idx = parseInt(container.querySelector("#dr-pick").value, 10);
      startTable(container, data.paradigms[idx], idx);
    });

    if (paradigms.length) {
      startTable(container, paradigms[0].p, paradigms[0].idx);
    } else {
      container.querySelector("#dr-session").innerHTML = `<div class="card"><p>No paradigms unlocked yet — advance your chapter in Settings.</p></div>`;
    }
  }

  function startTable(container, paradigm, pIdx) {
    if (mode === "match") renderMatchTable(container, paradigm, pIdx);
    else renderTypeTable(container, paradigm, pIdx);
  }

  function normalizeGreek(s) {
    return (s || "").trim().toLowerCase().normalize("NFC").replace(/ς$/, "σ").replace(/\s+/g, " ");
  }

  // ---- Type-answers mode ----------------------------------------------------
  function renderTypeTable(container, paradigm, pIdx) {
    const target = container.querySelector("#dr-session");
    const parsed = Content.parseParadigmTable(paradigm);

    let rowsHtml = "";
    parsed.rows.forEach((row, rIdx) => {
      let cells = `<td class="label">${esc(row.label)}</td>`;
      row.groups.forEach((g, gIdx) => {
        if (g.article !== undefined) {
          cells += `<td><input class="blank greek" data-kind="article" data-r="${rIdx}" data-g="${gIdx}" placeholder="article" /></td>`;
        }
        cells += `<td><input class="blank greek" data-kind="form" data-r="${rIdx}" data-g="${gIdx}" placeholder="${esc(g.colLabel || "form")}" /></td>`;
      });
      rowsHtml += `<tr>${cells}</tr>`;
    });

    target.innerHTML = `
      <div class="card">
        <h2>${esc(paradigm.title)}</h2>
        <div id="dr-kbd"></div>
        <table class="paradigm">
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="row">
          <button class="btn" id="dr-check">Check Answers</button>
          <button class="btn secondary" id="dr-reveal">Reveal All</button>
          <span class="pill" id="dr-score"></span>
        </div>
      </div>`;

    const inputs = target.querySelectorAll("input.blank");
    if (inputs.length) GreekKeyboard.attach(target.querySelector("#dr-kbd"), inputs[0]);
    inputs.forEach((inp) => {
      inp.addEventListener("focus", () => GreekKeyboard.attach(target.querySelector("#dr-kbd"), inp));
    });

    target.querySelector("#dr-check").addEventListener("click", () => {
      let correct = 0, total = 0;
      inputs.forEach((inp) => {
        const rIdx = parseInt(inp.dataset.r, 10);
        const gIdx = parseInt(inp.dataset.g, 10);
        const kind = inp.dataset.kind;
        const group = parsed.rows[rIdx].groups[gIdx];
        const expected = kind === "article" ? group.article : group.form;
        const ok = normalizeGreek(inp.value) === normalizeGreek(expected);
        inp.classList.remove("correct", "incorrect");
        inp.classList.add(ok ? "correct" : "incorrect");
        total += 1;
        if (ok) correct += 1;
        const itemId = `para:${pIdx}:${rIdx}:${gIdx}:${kind}`;
        SRS.grade(itemId, ok ? 4 : 1);
      });
      target.querySelector("#dr-score").textContent = `${correct} / ${total} correct`;
    });

    target.querySelector("#dr-reveal").addEventListener("click", () => {
      inputs.forEach((inp) => {
        const rIdx = parseInt(inp.dataset.r, 10);
        const gIdx = parseInt(inp.dataset.g, 10);
        const kind = inp.dataset.kind;
        const group = parsed.rows[rIdx].groups[gIdx];
        inp.value = kind === "article" ? group.article : group.form;
      });
    });
  }

  // ---- Drag & match mode -----------------------------------------------------
  function renderMatchTable(container, paradigm, pIdx) {
    const target = container.querySelector("#dr-session");
    const parsed = Content.parseParadigmTable(paradigm);

    // Build one chip per blank (article / Greek form / English gloss are
    // all separate chips, each with their own bank).
    const chips = [];
    let rowsHtml = "";
    parsed.rows.forEach((row, rIdx) => {
      let cells = `<td class="label">${esc(row.label)}</td>`;
      row.groups.forEach((g, gIdx) => {
        if (g.article !== undefined) {
          const cellId = `${rIdx}:${gIdx}:article`;
          chips.push({ chipId: `chip-${chips.length}`, cellId, text: g.article, kind: "article", greek: true });
          cells += `<td class="drop-target" data-cell-id="${cellId}"></td>`;
        }
        const formCellId = `${rIdx}:${gIdx}:form`;
        chips.push({ chipId: `chip-${chips.length}`, cellId: formCellId, text: g.form, kind: "form", greek: true });
        cells += `<td class="drop-target" data-cell-id="${formCellId}"></td>`;
        if (g.gloss) {
          const glossCellId = `${rIdx}:${gIdx}:gloss`;
          chips.push({ chipId: `chip-${chips.length}`, cellId: glossCellId, text: g.gloss, kind: "gloss", greek: false });
          cells += `<td class="drop-target" data-cell-id="${glossCellId}"></td>`;
        }
      });
      rowsHtml += `<tr>${cells}</tr>`;
    });

    const articleChips = chips.filter((c) => c.kind === "article");
    const formChips = chips.filter((c) => c.kind === "form");
    const glossChips = chips.filter((c) => c.kind === "gloss");
    SRS.shuffle(articleChips);
    SRS.shuffle(formChips);
    SRS.shuffle(glossChips);
    const attempted = new Set(); // cellIds already graded on first attempt

    const chipHtml = (c) =>
      `<div class="chip ${c.greek ? "greek" : ""}" draggable="true" id="${c.chipId}" data-text="${escAttr(c.text)}">${esc(c.text)}</div>`;

    const bank = (label, id, list) => list.length ? `
      <div style="flex:1; min-width:0;">
        <div class="flash-meta" style="text-align:left; margin-bottom:0.25rem;">${label}</div>
        <div class="chip-bank" id="${id}">${list.map(chipHtml).join("")}</div>
      </div>` : "";

    target.innerHTML = `
      <div class="card">
        <h2>${esc(paradigm.title)}</h2>
        <p style="color:var(--text-dim); font-size:0.85rem;">Drag each piece from its bank into the matching blank. Wrong drops snap back.</p>
        <table class="paradigm">
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="row" style="align-items:stretch; flex-wrap:nowrap;">
          ${bank("Articles", "dr-bank-article", articleChips)}
          ${bank("Greek Words", "dr-bank-form", formChips)}
          ${bank("English Meanings", "dr-bank-gloss", glossChips)}
        </div>
        <div class="row" style="margin-top:1.25rem;">
          <button class="btn secondary" id="dr-reset">Reset</button>
          <span class="pill" id="dr-score">0 / ${chips.length} placed</span>
        </div>
      </div>`;

    let placedCount = 0;

    function updateScore() {
      target.querySelector("#dr-score").textContent = `${placedCount} / ${chips.length} placed`;
    }

    target.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", chip.id);
        chip.classList.add("dragging");
      });
      chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
    });

    target.querySelectorAll("td.drop-target").forEach((cell) => {
      cell.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!cell.classList.contains("filled")) cell.classList.add("hover");
      });
      cell.addEventListener("dragleave", () => cell.classList.remove("hover"));
      cell.addEventListener("drop", (e) => {
        e.preventDefault();
        cell.classList.remove("hover");
        if (cell.classList.contains("filled")) return;
        const chipId = e.dataTransfer.getData("text/plain");
        const chipEl = document.getElementById(chipId);
        if (!chipEl) return;
        const chipText = chipEl.dataset.text;
        const cellId = cell.dataset.cellId;
        const [rIdx, gIdx, kind] = cellId.split(":");
        const group = parsed.rows[rIdx].groups[gIdx];
        const expected = kind === "article" ? group.article : kind === "gloss" ? group.gloss : group.form;
        const ok = kind === "gloss"
          ? chipText.trim().toLowerCase() === (expected || "").trim().toLowerCase()
          : normalizeGreek(chipText) === normalizeGreek(expected);

        if (!attempted.has(cellId)) {
          attempted.add(cellId);
          SRS.grade(`para:${pIdx}:${cellId}`, ok ? 4 : 1);
        }

        if (ok) {
          cell.classList.add("filled");
          cell.innerHTML = `<span class="placed-chip ${kind === "gloss" ? "" : "greek"}">${esc(chipText)}</span>`;
          chipEl.remove();
          placedCount += 1;
          updateScore();
        } else {
          chipEl.classList.add("wrong-shake");
          setTimeout(() => chipEl.classList.remove("wrong-shake"), 300);
        }
      });
    });

    target.querySelector("#dr-reset").addEventListener("click", () => renderMatchTable(container, paradigm, pIdx));
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
