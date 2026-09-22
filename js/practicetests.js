// Practice versions of the actual course quizzes (Quiz 1-4), rebuilt from
// their real PDF text. Every paradigm/vocab section below reuses verified
// data already in content.json (same paradigm tables, same vocabulary list)
// so it's auto-gradable; the free-translation sections have no published
// answer key, so those are shown as reference only, not graded.
const PracticeTests = (() => {
  const ALPHABET_SEQUENCE = ["α","β","γ","δ","ε","ζ","η","θ","ι","κ","λ","μ","ν","ξ","ο","π","ρ","σ","τ","υ","φ","χ","ψ","ω"];
  const VOWELS = ["α","ε","η","ι","ο","υ","ω"];

  const TESTS = [
    {
      id: "quiz1", title: "Quiz 1", chapter: 2, totalPoints: 67,
      sections: [
        { type: "alphabet", points: 12 },
        { type: "vowels", points: 7 },
        { type: "paradigm", points: 14, paradigmTitle: "FIRST DECLENSION NOUN—ETA PATTERN", label: "1st declension: ἡ φωνή" },
        { type: "paradigm", points: 14, paradigmTitle: "SECOND DECLENSION NOUN—MASCULINE", label: "2nd declension: ὁ λόγος" },
        { type: "vocab", points: 16, words: ["εἰμί","γράφω","ἔρχομαι","ὅτι","ἀδελφός","θεός","κύριος","οὐρανός","υἱός","ἔργον","σημεῖον","τέκνον","ἀγάπη","φωνή","βασιλεία","ἡμέρα"] },
        { type: "article-match", points: 4, items: [
          { label: "masc. nom. sg.", answer: "ὁ" },
          { label: "masc. gen. pl.", answer: "τῶν" },
          { label: "masc. dat. pl.", answer: "τοῖς" },
          { label: "masc. acc. pl.", answer: "τούς" },
        ] },
      ],
    },
    {
      id: "quiz2", title: "Quiz 2", chapter: 5, totalPoints: 92,
      sections: [
        { type: "paradigm", points: 10, paradigmTitle: "PRESENT INDICATIVE—εἰμί", label: "Present indicative: εἰμί" },
        { type: "parsing", points: 49, chapterScope: 5 },
        { type: "vocab", points: 16, words: ["βλέπω","διδάσκω","δοῦλος","ὡς","ὥρα","θεός","βαπτίζω","ἄγγελος","ὄχλος","γάρ","οὖν","ποιέω","πληρόω","αἰτέω","ἀγαπάω","ζητέω"] },
        { type: "translation", points: 17, clauses: [
          "Ἰησοῦς οὐκ ἐβάπτιζεν.",
          "βλέπω τοὺς ἀνθρώπους.",
          "Ἀκούει Ἰησοῦς τὸν ὄχλον ἀλλὰ Πέτρος (Peter) τὸν ὄχλον οὐκ ἀκούει.",
          "υἱὸς τοῦ θεοῦ εἰμί.",
        ] },
      ],
    },
    {
      id: "quiz3", title: "Quiz 3", chapter: 9, totalPoints: 116,
      sections: [
        { type: "paradigm", points: 21, paradigmTitle: "RELATIVE PRONOUN", label: "Relative pronoun" },
        { type: "parsing", points: 49, chapterScope: 9 },
        { type: "vocab", points: 16, words: ["ἀπό","σύν","μετά","αὐτός","ἄρτος","θάλασσα","οἶκος","ὁδός","δικαιοσύνη","ἔτι","οὐκέτι","δοξάζω","σῴζω","τηρέω","ἐντολή"] },
        { type: "translation", points: 30, clauses: [
          "τὰ ἔργα τοῦ Ἀβραὰμ ἐποιεῖτε.",
          "αἰτεῖτε καὶ οὐ λαμβάνετε.",
          "εἰρήνην ἔχομεν πρὸς τὸν θεὸν διὰ τοῦ κυρίου ἡμῶν (our) Ἰησοῦ Χριστοῦ.",
          "λαμβανόμεθα ὑπὸ θεοῦ διὰ τὸν Χρίστον.",
          "πᾶς (everyone) οὖν ὅστις ἀκούει μου τοὺς λόγους…καὶ ποιεῖ αὐτούς.",
        ] },
      ],
    },
    {
      id: "quiz4", title: "Quiz 4", chapter: 11, totalPoints: 110,
      sections: [
        { type: "paradigm", points: 10, paradigmTitle: "AORIST ACTIVE INDICATIVE", label: "1st Aorist active indicative: λύω" },
        { type: "parsing", points: 49, chapterScope: 11 },
        { type: "vocab", points: 16, words: ["ἀνοίγω","προσεύχομαι","συνάγω","διδάσκαλος","ἱμάτιον","ἀναβαίνω","βάλλω","εἰσέρχομαι","εὑρίσκω","καταβαίνω","ἐπαγγελία","ἀπαγγέλλω","σπείρω","γραφή","σοφία","ναός"] },
        { type: "translation", points: 35, clauses: [
          "ἐγώ γὰρ διὰ νόμου νόμῳ ἀπέθανον.",
          "ἀνέβη Ἰησοῦς εἰς τὸ ἱερὸν καὶ ἐδίδασκεν.",
          "κατέβησαν οἱ μαθηταὶ αὐτοῦ ἐπὶ τὴν θάλασσαν.",
          "οὕτως γὰρ ἠγάπησεν ὁ θεὸς τὸν κόσμον.",
          "ἐν τῷ κόσμῳ ἦν, καὶ ὁ κόσμος δι᾽αὐτοῦ ἐγένετο, καὶ ὁ κόσμος αὐτὸν οὐκ ἔγνω.",
        ] },
      ],
    },
  ];

  function normalizeGreek(s) {
    return (s || "").trim().toLowerCase().normalize("NFC").replace(/ς$/, "σ").replace(/\s+/g, " ");
  }

  function findVocab(word) {
    const norm = (s) => {
      const first = (s || "").replace(/µ/g, "μ").split(/[,\s]/)[0] || "";
      return first.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    };
    const key = norm(word);
    return Content.getData().vocabulary.find((v) => norm(v.word) === key);
  }

  function findParadigm(title) {
    const paradigms = Content.getData().paradigms;
    const idx = paradigms.findIndex((p) => p.title === title);
    return idx === -1 ? null : { paradigm: paradigms[idx], idx };
  }

  function render(container) {
    const chapter = SRS.getCurrentChapter();
    container.innerHTML = `
      <h1>Practice Tests</h1>
      <p style="color:var(--text-dim);">Rebuilt from the actual course quizzes. Paradigm/parsing/vocab sections are auto-graded from the same verified data as the rest of the app; translation sections have no published answer key, so they're shown for self-check only, not graded.</p>
      <div id="pt-list"></div>
      <div id="pt-session"></div>
    `;
    renderList(container, chapter);
  }

  function renderList(container, chapter) {
    const list = container.querySelector("#pt-list");
    list.innerHTML = TESTS.map((t) => {
      const locked = chapter < t.chapter;
      return `
        <div class="card">
          <div class="row between">
            <div>
              <h2 style="margin:0;">${esc(t.title)}</h2>
              <p class="flash-meta" style="margin:0.25rem 0 0;">Covers through Chapter ${t.chapter} &middot; ${t.totalPoints} pts on the real quiz</p>
            </div>
            <button class="btn" data-quiz="${t.id}" ${locked ? "disabled" : ""}>${locked ? `Unlocks at Ch. ${t.chapter}` : "Start"}</button>
          </div>
        </div>`;
    }).join("");

    list.querySelectorAll("button[data-quiz]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const test = TESTS.find((t) => t.id === btn.dataset.quiz);
        renderTest(container, test);
      });
    });
  }

  function renderTest(container, test) {
    const session = container.querySelector("#pt-session");
    let html = `<div class="card"><h2>${esc(test.title)}</h2>`;
    test.sections.forEach((section, sIdx) => {
      html += renderSection(test, section, sIdx);
    });
    html += `
      <div class="row" style="margin-top:1.5rem;">
        <button class="btn" id="pt-check">Check Test</button>
        <span class="pill" id="pt-score"></span>
      </div>
    </div>`;
    session.innerHTML = html;
    session.scrollIntoView({ behavior: "smooth" });

    // Attach one shared Greek keyboard to whichever field is focused.
    const kbdHost = session.querySelector("#pt-kbd");
    session.querySelectorAll("input.greek-input").forEach((inp) => {
      inp.addEventListener("focus", () => GreekKeyboard.attach(kbdHost, inp));
    });

    session.querySelector("#pt-check").addEventListener("click", () => checkTest(session, test));
  }

  function renderSection(test, section, sIdx) {
    if (section.type === "alphabet") {
      return `
        <div class="card" style="background:var(--bg-alt);">
          <h3>Write out the Greek alphabet in lower case (${section.points} pts)</h3>
          <input type="text" class="greek-input" id="pt-s${sIdx}" style="width:100%;" placeholder="α β γ δ ..." />
          <div id="pt-kbd"></div>
        </div>`;
    }
    if (section.type === "vowels") {
      return `
        <div class="card" style="background:var(--bg-alt);">
          <h3>What are the Greek vowels? (${section.points} pts)</h3>
          <input type="text" class="greek-input" id="pt-s${sIdx}" style="width:100%;" placeholder="space separated" />
        </div>`;
    }
    if (section.type === "paradigm") {
      const found = findParadigm(section.paradigmTitle);
      if (!found) return `<div class="card"><p>${esc(section.label)} — paradigm data not found.</p></div>`;
      const parsed = Content.parseParadigmTable(found.paradigm);
      let rowsHtml = "";
      parsed.rows.forEach((row, rIdx) => {
        let cells = `<td class="label">${esc(row.label)}</td>`;
        row.groups.forEach((g, gIdx) => {
          if (g.article !== undefined) {
            cells += `<td><input class="blank greek-input" data-r="${rIdx}" data-g="${gIdx}" data-kind="article" placeholder="article" /></td>`;
          }
          cells += `<td><input class="blank greek-input" data-r="${rIdx}" data-g="${gIdx}" data-kind="form" placeholder="${esc(g.colLabel || "form")}" /></td>`;
        });
        rowsHtml += `<tr>${cells}</tr>`;
      });
      return `
        <div class="card" style="background:var(--bg-alt);" data-section-type="paradigm" data-paradigm-idx="${found.idx}" data-section-idx="${sIdx}">
          <h3>${esc(section.label)} (${section.points} pts)</h3>
          <table class="paradigm"><tbody>${rowsHtml}</tbody></table>
        </div>`;
    }
    if (section.type === "parsing") {
      const pool = Content.getItems().filter((i) => i.type === "parsing" && i.chapter <= section.chapterScope);
      const picked = SRS.shuffle([...pool]).slice(0, 7);
      const rows = picked.map((item, i) => {
        const blanks = item.fields.map((f) => `
          <select data-field="${f}" data-item="${i}">
            <option value="">—</option>
            ${Content.PARSE_FIELD_OPTIONS[f].map((o) => `<option value="${escAttr(o)}">${esc(o)}</option>`).join("")}
          </select>`).join(" ");
        return `<div class="row" style="margin:0.5rem 0; align-items:center;"><div class="greek" style="min-width:120px;">${esc(item.prompt)}</div>${blanks}</div>`;
      }).join("");
      return `
        <div class="card" style="background:var(--bg-alt);" data-section-type="parsing" data-section-idx="${sIdx}" data-parsing-ids='${JSON.stringify(picked.map((p) => p.id))}'>
          <h3>Parse the following verbal forms (${section.points} pts on the real quiz)</h3>
          <p class="flash-meta">No published answer key for the exact quiz forms — these are verified parsing forms from the same material instead.</p>
          ${rows}
        </div>`;
    }
    if (section.type === "vocab") {
      const rows = section.words.map((w, i) => {
        const hit = findVocab(w);
        return `<div class="row" style="margin:0.4rem 0;"><div class="greek" style="min-width:110px;">${esc(w)}</div><input type="text" data-vocab-idx="${i}" data-answer="${escAttr(hit ? hit.gloss : "")}" placeholder="gloss" style="flex:1;" /></div>`;
      }).join("");
      return `
        <div class="card" style="background:var(--bg-alt);" data-section-type="vocab" data-section-idx="${sIdx}">
          <h3>Vocabulary glosses (${section.points} pts)</h3>
          ${rows}
        </div>`;
    }
    if (section.type === "article-match") {
      const options = section.items.map((it) => it.answer);
      const rows = section.items.map((it, i) => `
        <div class="row" style="margin:0.4rem 0;">
          <div style="min-width:120px;">${esc(it.label)}</div>
          <select data-article-idx="${i}" data-answer="${escAttr(it.answer)}">
            <option value="">—</option>
            ${options.map((o) => `<option value="${escAttr(o)}">${esc(o)}</option>`).join("")}
          </select>
        </div>`).join("");
      return `
        <div class="card" style="background:var(--bg-alt);" data-section-type="article-match" data-section-idx="${sIdx}">
          <h3>Match the article form (${section.points} pts)</h3>
          ${rows}
        </div>`;
    }
    if (section.type === "translation") {
      const rows = section.clauses.map((c) => `<p class="greek" style="margin:0.5rem 0;">${esc(c)}</p>`).join("");
      return `
        <div class="card" style="background:var(--bg-alt);">
          <h3>Translation (${section.points} pts on the real quiz — not auto-graded)</h3>
          <p class="flash-meta">No verified answer key for these sentences. Translate on paper and self-check with your professor/notes.</p>
          ${rows}
        </div>`;
    }
    return "";
  }

  function checkTest(session, test) {
    let correct = 0, total = 0;

    session.querySelectorAll('[data-section-type="paradigm"]').forEach((card) => {
      const pIdx = parseInt(card.dataset.paradigmIdx, 10);
      const paradigm = Content.getData().paradigms[pIdx];
      const parsed = Content.parseParadigmTable(paradigm);
      card.querySelectorAll("input.blank").forEach((inp) => {
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
        SRS.grade(`para:${pIdx}:${rIdx}:${gIdx}:${kind}`, ok ? 4 : 1);
      });
    });

    session.querySelectorAll('[data-section-type="parsing"]').forEach((card) => {
      const ids = JSON.parse(card.dataset.parsingIds);
      const items = ids.map((id) => Content.getItems().find((i) => i.id === id));
      items.forEach((item, i) => {
        let allOk = true;
        item.fields.forEach((f) => {
          const sel = card.querySelector(`select[data-field="${f}"][data-item="${i}"]`);
          const ok = sel.value === item.values[f];
          sel.style.borderColor = ok ? "var(--good)" : "var(--bad)";
          if (!ok) allOk = false;
        });
        total += 1;
        if (allOk) correct += 1;
        SRS.grade(item.id, allOk ? 4 : 1);
      });
    });

    session.querySelectorAll('[data-section-type="vocab"]').forEach((card) => {
      const sIdx = card.dataset.sectionIdx;
      card.querySelectorAll("input[data-vocab-idx]").forEach((inp) => {
        const expected = inp.dataset.answer;
        const given = inp.value.trim().toLowerCase();
        const accepted = expected.toLowerCase().split(/[,;]/).map((s) => s.trim());
        const ok = !!expected && accepted.some((a) => a && (given === a || given.includes(a) || a.includes(given)));
        inp.style.borderColor = ok ? "var(--good)" : "var(--bad)";
        total += 1;
        if (ok) correct += 1;
        SRS.grade(`test:${test.id}:vocab:${sIdx}:${inp.dataset.vocabIdx}`, ok ? 4 : 1);
      });
    });

    session.querySelectorAll('[data-section-type="article-match"]').forEach((card) => {
      const sIdx = card.dataset.sectionIdx;
      card.querySelectorAll("select[data-article-idx]").forEach((sel) => {
        const ok = sel.value === sel.dataset.answer;
        sel.style.borderColor = ok ? "var(--good)" : "var(--bad)";
        total += 1;
        if (ok) correct += 1;
        SRS.grade(`test:${test.id}:article:${sIdx}:${sel.dataset.articleIdx}`, ok ? 4 : 1);
      });
    });

    // Alphabet + vowels sections aren't wrapped in a data-section-type card
    // (single free-text input) — grade them directly by section index.
    test.sections.forEach((section, sIdx) => {
      const inp = session.querySelector(`#pt-s${sIdx}`);
      if (!inp) return;
      total += 1;
      let ok = false;
      if (section.type === "alphabet") {
        const given = inp.value.replace(/\s+/g, "").trim();
        ok = normalizeGreek(given) === ALPHABET_SEQUENCE.join("");
      } else if (section.type === "vowels") {
        const given = new Set(inp.value.split(/\s+/).map((s) => normalizeGreek(s)).filter(Boolean));
        ok = given.size === VOWELS.length && VOWELS.every((v) => given.has(v));
      }
      inp.style.borderColor = ok ? "var(--good)" : "var(--bad)";
      if (ok) correct += 1;
      SRS.grade(`test:${test.id}:${section.type}`, ok ? 4 : 1);
    });

    session.querySelector("#pt-score").textContent = `${correct} / ${total} auto-graded correct`;
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
