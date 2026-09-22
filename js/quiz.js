const Quiz = (() => {
  let queue = [];
  let idx = 0;
  let sessionMode = "mcq"; // fixed for the whole session — no per-question mixing
  let sessionStats = { correct: 0, total: 0 };
  let currentAnswered = false;

  function availableGroups(pool) {
    return [...new Set(pool.map((i) => i.group))].sort();
  }

  function render(container) {
    const currentChapter = SRS.getCurrentChapter();
    const pool = Content.itemsUpToChapter(currentChapter);
    const groups = availableGroups(pool);

    container.innerHTML = `
      <h1>Quiz</h1>
      <div class="card">
        <p>Auto-generated from material through <strong>Chapter ${currentChapter}</strong>.</p>
        <div class="row">
          <label>Focus: <select id="qz-group">
            <option value="">All (weakest &amp; due first)</option>
            ${groups.map((g) => `<option value="${g}">${g}</option>`).join("")}
          </select></label>
          <label>Chapter: <select id="qz-chapter">
            <option value="">All chapters</option>
            ${Array.from({ length: currentChapter }, (_, i) => i + 1)
              .map((n) => `<option value="${n}">Chapter ${n}</option>`)
              .join("")}
          </select></label>
          <label id="qz-size-label">Questions: <input type="number" id="qz-size" value="15" min="5" max="60" style="width:70px" /></label>
        </div>
        <div class="row" style="margin-top:0.5rem;">
          <label><input type="radio" name="qz-mode" value="mcq" checked /> Multiple Choice</label>
          <label><input type="radio" name="qz-mode" value="typed" /> Typed / Fill-in-the-blank</label>
          <label><input type="radio" name="qz-mode" value="match" /> Drag &amp; Match</label>
        </div>
        <div class="row" id="qz-match-controls" style="display:none; margin-top:0.5rem;">
          <label>Match: <select id="qz-match-pool">
            <option value="vocab">Vocabulary</option>
            <option value="concept">Grammar Concepts (voice/mood/tense)</option>
          </select></label>
        </div>
        <p id="qz-match-note" class="flash-meta" style="display:none;">Match mode ignores Focus/Questions — it uses every item of the chosen type in the chapter(s) picked above.</p>
        <div class="row" style="margin-top:0.5rem;">
          <button class="btn" id="qz-start">Start Quiz</button>
        </div>
      </div>
      <div id="qz-session"></div>
    `;

    container.querySelectorAll('input[name="qz-mode"]').forEach((r) => {
      r.addEventListener("change", () => {
        const isMatch = r.checked && r.value === "match";
        if (!r.checked) return;
        container.querySelector("#qz-group").closest("label").style.display = isMatch ? "none" : "";
        container.querySelector("#qz-size-label").style.display = isMatch ? "none" : "";
        container.querySelector("#qz-match-note").style.display = isMatch ? "" : "none";
        container.querySelector("#qz-match-controls").style.display = isMatch ? "" : "none";
      });
    });

    container.querySelector("#qz-start").addEventListener("click", () => {
      const group = container.querySelector("#qz-group").value;
      const chapter = container.querySelector("#qz-chapter").value;
      const size = parseInt(container.querySelector("#qz-size").value, 10) || 15;
      sessionMode = container.querySelector('input[name="qz-mode"]:checked').value;

      if (sessionMode === "match") {
        const matchType = container.querySelector("#qz-match-pool").value;
        let matchPool = pool.filter((i) => i.type === matchType);
        if (chapter) matchPool = matchPool.filter((i) => i.chapter === parseInt(chapter, 10));
        renderMatchPairs(container, matchPool, matchType);
        return;
      }

      let filtered = group ? pool.filter((i) => i.group === group) : pool;
      if (chapter) filtered = filtered.filter((i) => i.chapter === parseInt(chapter, 10));
      queue = SRS.buildQueue(filtered, size).map((item) => ({ item, pool: filtered }));
      idx = 0;
      sessionStats = { correct: 0, total: 0 };
      renderQuestion(container);
    });
  }

  // ---- Generic drag & match: any item pool with prompt/answer/id ----------
  const MATCH_COPY = {
    vocab: { title: "Match the Meaning", instructions: "Drag each English meaning onto its matching Greek word.", bankLabel: "Meanings", empty: "No vocabulary in that chapter selection.", promptClass: "greek" },
    concept: { title: "Match the Definition", instructions: "Drag each definition onto its matching term.", bankLabel: "Definitions", empty: "No grammar concepts in that chapter selection.", promptClass: "" },
  };

  function renderMatchPairs(container, itemPool, matchType) {
    const copy = MATCH_COPY[matchType];
    const target = container.querySelector("#qz-session");
    if (!itemPool.length) {
      target.innerHTML = `<div class="card"><p>${esc(copy.empty)}</p></div>`;
      return;
    }

    const leftItems = SRS.shuffle([...itemPool]);
    const rightChips = SRS.shuffle(leftItems.map((w, i) => ({ chipId: `chip-${i}`, itemId: w.id, text: w.answer })));
    const attempted = new Set();
    let placedCount = 0;

    const rowsHtml = leftItems
      .map((w) => `
        <tr>
          <td class="${copy.promptClass}" style="text-align:left; padding:0.5rem;">${esc(w.prompt)}</td>
          <td class="drop-target" data-item-id="${escAttr(w.id)}" style="min-width:200px;"></td>
        </tr>`)
      .join("");

    target.innerHTML = `
      <div class="card">
        <h2>${esc(copy.title)}</h2>
        <p style="color:var(--text-dim); font-size:0.85rem;">${esc(copy.instructions)} Wrong drops snap back.</p>
        <table class="paradigm"><tbody>${rowsHtml}</tbody></table>
        <div class="flash-meta" style="text-align:left; margin:0.75rem 0 0.25rem;">${esc(copy.bankLabel)}</div>
        <div class="chip-bank" id="qz-match-bank">
          ${rightChips.map((g) => `<div class="chip" id="${g.chipId}" data-item-id="${escAttr(g.itemId)}">${esc(g.text)}</div>`).join("")}
        </div>
        <div class="row" style="margin-top:1.25rem;">
          <button class="btn secondary" id="qz-match-reset">New Round</button>
          <span class="pill" id="qz-match-score">0 / ${leftItems.length} matched</span>
        </div>
      </div>`;

    MatchGame.wire({
      chips: [...target.querySelectorAll(".chip")],
      cells: [...target.querySelectorAll("td.drop-target")],
      isMatch: (chipEl, cell) => chipEl.dataset.itemId === cell.dataset.itemId,
      onCorrect(chipEl, cell) {
        const itemId = cell.dataset.itemId;
        if (!attempted.has(itemId)) {
          attempted.add(itemId);
          SRS.grade(itemId, 4);
        }
        cell.classList.add("filled");
        cell.innerHTML = `<span class="placed-chip">${esc(chipEl.textContent)}</span>`;
        chipEl.remove();
        placedCount += 1;
        target.querySelector("#qz-match-score").textContent = `${placedCount} / ${leftItems.length} matched`;
      },
      onWrong(chipEl, cell) {
        const itemId = cell.dataset.itemId;
        if (!attempted.has(itemId)) {
          attempted.add(itemId);
          SRS.grade(itemId, 1);
        }
        chipEl.classList.add("wrong-shake");
        setTimeout(() => chipEl.classList.remove("wrong-shake"), 300);
      },
    });

    target.querySelector("#qz-match-reset").addEventListener("click", () => renderMatchPairs(container, itemPool, matchType));
  }

  function normalizeGreek(s) {
    return (s || "")
      .trim()
      .toLowerCase()
      .normalize("NFC")
      .replace(/ς$/, "σ")
      .replace(/\s+/g, " ");
  }

  function isCorrect(item, answer) {
    if (item.type === "vocab" || item.type === "concept") {
      // answer is English text (gloss or definition) — accept if the given
      // answer is a reasonably close substring match against it.
      const norm = (s) => s.trim().toLowerCase();
      const given = norm(answer);
      const accepted = norm(item.answer).split(/[,;]/).map((s) => s.trim());
      return accepted.some((a) => a && (given === a || given.includes(a) || a.includes(given)));
    }
    return normalizeGreek(answer) === normalizeGreek(item.answer);
  }

  function buildMcqOptions(item, pool) {
    const distractorPool = pool.filter((i) => i.type === item.type && i.id !== item.id && i.answer !== item.answer);
    SRS.shuffle(distractorPool);
    const distractors = distractorPool.slice(0, 3).map((i) => i.answer);
    const options = SRS.shuffle([item.answer, ...distractors]);
    return options;
  }

  function renderQuestion(container) {
    const target = container.querySelector("#qz-session");
    if (!queue.length) {
      target.innerHTML = `<div class="card"><p>No items match this filter yet.</p></div>`;
      return;
    }
    if (idx >= queue.length) {
      target.innerHTML = `
        <div class="card">
          <h2>Quiz complete</h2>
          <p>${sessionStats.correct} / ${sessionStats.total} correct.</p>
          <button class="btn" id="qz-again">New Quiz</button>
        </div>`;
      target.querySelector("#qz-again").addEventListener("click", () => render(container));
      return;
    }

    const { item, pool } = queue[idx];
    currentAnswered = false;

    if (item.type === "parsing") {
      renderParsingQuestion(container, target, item, pool);
    } else if (sessionMode === "mcq") {
      renderMcqQuestion(container, target, item, pool);
    } else {
      renderTypedQuestion(container, target, item);
    }
  }

  function questionShell(container, target, item, bodyHtml) {
    target.innerHTML = `
      <div class="card">
        <div class="row between">
          <span class="pill">${item.group} · Ch. ${item.chapter}</span>
          <span class="pill">${idx + 1} / ${queue.length}</span>
        </div>
        ${bodyHtml}
        <div class="row" style="justify-content:center; margin-top:0.75rem;">
          <button class="btn secondary" id="qz-next" disabled>Next</button>
        </div>
      </div>`;
    const nextBtn = target.querySelector("#qz-next");
    nextBtn.addEventListener("click", () => {
      idx += 1;
      renderQuestion(container);
    });
    return nextBtn;
  }

  function renderMcqQuestion(container, target, item, pool) {
    const options = buildMcqOptions(item, pool);
    const nextBtn = questionShell(container, target, item, `
      <div class="flash-front"><div class="${item.promptGreek ? "greek" : ""}">${esc(item.prompt)}</div></div>
      <div class="mcq-options" id="qz-options">
        ${options.map((o) => `<button class="mcq-option ${item.promptGreek ? "" : "greek"}" data-val="${escAttr(o)}">${esc(o)}</button>`).join("")}
      </div>
      <div id="qz-feedback"></div>`);

    target.querySelectorAll(".mcq-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (currentAnswered) return;
        currentAnswered = true;
        const val = btn.dataset.val;
        const correct = normCompare(val) === normCompare(item.answer);
        grade(item, correct);
        target.querySelectorAll(".mcq-option").forEach((b) => {
          if (normCompare(b.dataset.val) === normCompare(item.answer)) b.classList.add("correct");
          else if (b === btn) b.classList.add("incorrect");
          b.disabled = true;
        });
        showFeedback(target, correct, item);
        nextBtn.disabled = false;
      });
    });
  }

  function renderTypedQuestion(container, target, item) {
    const nextBtn = questionShell(container, target, item, `
      <div class="flash-front"><div class="${item.promptGreek ? "greek" : ""}">${esc(item.prompt)}</div></div>
      <div class="row" style="justify-content:center">
        <input type="text" id="qz-input" placeholder="Type your answer" autocomplete="off" />
        <button class="btn" id="qz-submit">Check</button>
      </div>
      <div id="qz-kbd"></div>
      <div id="qz-feedback"></div>`);

    const input = target.querySelector("#qz-input");
    GreekKeyboard.attach(target.querySelector("#qz-kbd"), input);
    const submit = () => {
      if (currentAnswered) return;
      currentAnswered = true;
      const correct = isCorrect(item, input.value);
      grade(item, correct);
      input.disabled = true;
      showFeedback(target, correct, item);
      nextBtn.disabled = false;
    };
    target.querySelector("#qz-submit").addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    input.focus();
  }

  // ---- parsing questions: identify grammatical form of an inflected word --
  function renderParsingQuestion(container, target, item, pool) {
    if (sessionMode === "mcq") {
      const options = buildMcqOptions(item, pool);
      const nextBtn = questionShell(container, target, item, `
        <div class="flash-front">
          <div class="greek">${esc(item.prompt)}</div>
          <div class="flash-meta greek">${esc(item.lexical)}</div>
        </div>
        <div class="mcq-options" id="qz-options">
          ${options.map((o) => `<button class="mcq-option" data-val="${escAttr(o)}">${esc(o)}</button>`).join("")}
        </div>
        <div id="qz-feedback"></div>`);

      target.querySelectorAll(".mcq-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (currentAnswered) return;
          currentAnswered = true;
          const correct = normCompare(btn.dataset.val) === normCompare(item.answer);
          grade(item, correct);
          target.querySelectorAll(".mcq-option").forEach((b) => {
            if (normCompare(b.dataset.val) === normCompare(item.answer)) b.classList.add("correct");
            else if (b === btn) b.classList.add("incorrect");
            b.disabled = true;
          });
          showFeedback(target, correct, item);
          nextBtn.disabled = false;
        });
      });
      return;
    }

    // Typed mode = fill-in-the-blank: one dropdown per grammatical slot
    // (tense/voice/mood/person-or-gender+case/number), graded per slot.
    const blanksHtml = item.fields
      .map((f, i) => {
        const options = Content.PARSE_FIELD_OPTIONS[f];
        return `
          <label style="display:flex; flex-direction:column; gap:0.25rem; font-size:0.8rem; color:var(--text-dim); text-transform:capitalize;">
            ${f}
            <select data-field="${f}" id="qz-blank-${i}">
              <option value="">—</option>
              ${options.map((o) => `<option value="${escAttr(o)}">${esc(o)}</option>`).join("")}
            </select>
          </label>`;
      })
      .join("");

    const nextBtn = questionShell(container, target, item, `
      <div class="flash-front">
        <div class="greek">${esc(item.prompt)}</div>
        <div class="flash-meta greek">${esc(item.lexical)}</div>
      </div>
      <div class="row" style="justify-content:center; flex-wrap:wrap; gap:0.75rem;">${blanksHtml}</div>
      <div class="row" style="justify-content:center; margin-top:0.75rem;">
        <button class="btn" id="qz-submit">Check</button>
      </div>
      <div id="qz-feedback"></div>`);

    target.querySelector("#qz-submit").addEventListener("click", () => {
      if (currentAnswered) return;
      currentAnswered = true;
      let allCorrect = true;
      item.fields.forEach((f, i) => {
        const sel = target.querySelector(`#qz-blank-${i}`);
        const ok = sel.value === item.values[f];
        sel.style.borderColor = ok ? "var(--good)" : "var(--bad)";
        sel.disabled = true;
        if (!ok) allCorrect = false;
      });
      grade(item, allCorrect);
      showFeedback(target, allCorrect, item);
      nextBtn.disabled = false;
    });
  }

  function normCompare(s) {
    return (s || "").trim().toLowerCase();
  }

  function grade(item, correct) {
    SRS.grade(item.id, correct ? 4 : 1);
    sessionStats.total += 1;
    if (correct) sessionStats.correct += 1;
  }

  function showFeedback(target, correct, item) {
    const fb = target.querySelector("#qz-feedback");
    fb.className = `feedback ${correct ? "correct" : "incorrect"}`;
    fb.innerHTML = correct
      ? "Correct!"
      : `Not quite — correct answer: <span class="greek">${esc(item.answer)}</span>${item.detail ? " (" + esc(item.detail) + ")" : ""}`;
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
