// Boss Battle: one boss per chapter (plus a cumulative boss). Multiple choice,
// tap only, 3 hearts, no timer. Every question is a real item from the app's
// verified content, and every answer feeds the same spaced-repetition tracking.
//
// Two modes:
//   Full  - vocabulary, forms/paradigms, parsing, then a boss-rage round.
//   Vocab - vocabulary only: Greek -> meaning rounds, meaning -> Greek rounds
//           (so you have to know the word cold, not guess from a definition),
//           then a mixed boss-rage round of your weakest words.
const BossBattle = (() => {
  const EMOJI = ["🐉","👹","🦂","🐍","🦅","🐺","🧌","🦑","🐙","🦈","🐗","🦁","👻","💀","🕷️","🐲","🦇","🐊","🧟","🦖","🐻","🦍","🐅","👑"];
  // A chapter boss asks EVERY vocabulary word in that chapter (vocab: null =
  // all). The cumulative boss draws from hundreds of words, so it samples.
  const SIZES = {
    chapter: { vocab: null, terms: 6, forms: 6, parse: 5, rage: 5 },
    cumulative: { vocab: 12, terms: 4, forms: 8, parse: 6, rage: 6 },
  };
  const VOCAB_SIZES = {
    chapter: { words: null, rage: 6 },
    cumulative: { words: 12, rage: 8 },
  };
  const RAGE_NAME = "Boss Rage: your misses return (double damage)";
  const HP_FACTOR = 0.95; // boss HP vs. total possible damage — leaves room for a few misses
  const HEAL_ON_MISS = 0.5;
  const POWER_EVERY = 5; // every 5th correct in a row hits double
  const HEART_EVERY = 8; // every 8th correct in a row restores a heart (max 3)
  const MAX_HEARTS = 3;

  let token = 0; // bumped whenever a screen is left, so stale timers do nothing
  let mode = "full"; // "full" | "vocab"

  function esc(s) {
    const div = document.createElement("div");
    div.textContent = s ?? "";
    return div.innerHTML;
  }

  function stars(n) {
    return "★".repeat(n) + "☆".repeat(3 - n);
  }

  function starKey(key, vocab) {
    return vocab ? `v:${key}` : String(key);
  }

  function emojiFor(chapter, vocab) {
    return EMOJI[(chapter - 1 + (vocab ? 12 : 0)) % EMOJI.length];
  }

  // ---- chapter map -----------------------------------------------------------
  function render(container) {
    token++;
    renderMap(container);
  }

  function renderMap(container) {
    const cur = SRS.getCurrentChapter();
    const chapters = Content.getData().chapters;
    const vocab = mode === "vocab";

    const cards = chapters
      .map((ch) => {
        const locked = ch.number > cur;
        const earned = SRS.getBossStars(starKey(ch.number, vocab));
        return `
          <div class="boss-card ${locked ? "locked" : ""}">
            <div class="boss-card-emoji">${locked ? "🔒" : emojiFor(ch.number, vocab)}</div>
            <div class="boss-card-title">Ch. ${ch.number}: ${esc(ch.title)}</div>
            <div class="boss-stars">${stars(earned)}</div>
            <button class="btn ${locked ? "secondary" : ""}" data-boss="${ch.number}" ${locked ? "disabled" : ""}>${locked ? "Locked" : "Fight"}</button>
          </div>`;
      })
      .join("");

    container.innerHTML = `
      <h1>Boss Battle</h1>
      <div class="row" style="margin-bottom:0.75rem;">
        <button class="btn ${vocab ? "secondary" : ""}" data-mode="full">Full Boss</button>
        <button class="btn ${vocab ? "" : "secondary"}" data-mode="vocab">Vocab Boss</button>
      </div>
      <p style="color:var(--text-dim);">${
        vocab
          ? "Vocabulary only. Every word in the chapter is asked once showing the Greek word (you pick the meaning), then again showing the meaning (you pick the Greek word). The boss-rage round brings back the words you missed."
          : "Vocabulary, forms and parsing. Tap the right answer to hit the boss."
      } A wrong answer costs a heart and the boss heals a little. Five right in a row lands a power attack, and eight in a row restores a heart. Stars: 3 for a flawless win, 2 for one or two misses, 1 for more.</p>
      <div class="card">
        <div class="row between">
          <div>
            <h2 style="margin:0;">👑 Cumulative ${vocab ? "Vocab " : ""}Boss</h2>
            <p class="flash-meta" style="margin:0.25rem 0 0;">${vocab ? "Every vocabulary word" : "Everything"} unlocked through Chapter ${cur} &middot; <span class="boss-stars">${stars(SRS.getBossStars(starKey("all", vocab)))}</span></p>
          </div>
          <button class="btn" data-boss="all">Fight</button>
        </div>
      </div>
      <div class="boss-grid">${cards}</div>
    `;

    container.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode;
        renderMap(container);
      });
    });
    container.querySelectorAll("[data-boss]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.boss;
        startFromKey(container, key === "all" ? "all" : parseInt(key, 10), mode === "vocab");
      });
    });
  }

  // ---- building a battle ------------------------------------------------------
  function poolFor(key, vocab) {
    const cur = SRS.getCurrentChapter();
    const items = key === "all" ? Content.itemsUpToChapter(cur) : Content.getItems().filter((i) => i.chapter === key);
    if (vocab) return items.filter((i) => i.type === "vocab");
    // memory devices re-ask vocabulary, so they would double up the questions
    return items.filter((i) => i.type !== "mnemonic");
  }

  function bossInfo(key, vocab) {
    const tag = vocab ? "Vocab Boss" : "";
    if (key === "all") return { label: vocab ? "Cumulative Vocab Boss" : "Cumulative Boss", emoji: "👑" };
    const ch = Content.getData().chapters.find((c) => c.number === key);
    const title = ch ? ch.title : "";
    return { label: vocab ? `${tag}: Chapter ${key} ${title}` : `Chapter ${key}: ${title}`, emoji: emojiFor(key, vocab) };
  }

  function weakestFirst(list, n) {
    const scored = SRS.shuffle([...list]).map((item) => {
      const st = SRS.peekItem(item.id);
      const total = st ? st.correct + st.incorrect : 0;
      // seen-and-missed items rank first, then never-seen, then solid ones
      const acc = total ? st.correct / total : 0.75;
      return { item, acc };
    });
    scored.sort((a, b) => a.acc - b.acc);
    return scored.slice(0, n).map((s) => s.item);
  }

  function buildRounds(pool, sizes) {
    const rounds = [];
    const used = new Set();
    const byType = (types) => pool.filter((i) => types.includes(i.type));

    // Round 1: every vocab word (chapter boss) or a sample (cumulative),
    // plus a few alphabet letters / grammar terms where the chapter has them.
    const vocabPool = byType(["vocab"]);
    const termPool = byType(["alphabet", "concept"]);
    const vocabItems = sizes.vocab == null ? vocabPool : SRS.buildQueue(vocabPool, sizes.vocab);
    const termItems = termPool.length ? SRS.buildQueue(termPool, sizes.terms) : [];
    const r1 = SRS.shuffle([...vocabItems, ...termItems]);
    if (r1.length) {
      r1.forEach((i) => used.add(i.id));
      rounds.push({ name: "Vocabulary & Terms", items: r1, mult: 1, dir: "g2e" });
    }

    const add = (name, list, n) => {
      if (!list.length) return;
      const picked = SRS.buildQueue(list, n);
      picked.forEach((i) => used.add(i.id));
      rounds.push({ name, items: picked, mult: 1, dir: "g2e" });
    };
    add("Forms", byType(["paradigm"]), sizes.forms);
    add("Parsing", byType(["parsing"]), sizes.parse);

    const leftovers = pool.filter((i) => !used.has(i.id));
    const rage = weakestFirst(leftovers.length >= sizes.rage ? leftovers : pool, sizes.rage);
    if (rage.length) rounds.push({ name: RAGE_NAME, items: rage, mult: 2, dir: "g2e", rage: true });
    return rounds;
  }

  function buildVocabRounds(pool, sizes) {
    if (!pool.length) return [];
    // The same words are asked in both directions, so a word you miss going
    // one way comes back the other way later in the same fight.
    const words = sizes.words == null ? SRS.shuffle([...pool]) : SRS.buildQueue(pool, sizes.words);
    const reversed = SRS.shuffle([...words]);
    if (reversed.length > 1 && reversed[0].id === words[words.length - 1].id) {
      [reversed[0], reversed[1]] = [reversed[1], reversed[0]]; // no back-to-back repeat
    }
    return [
      { name: "Greek → Meaning", items: words, mult: 1, dir: "g2e" },
      { name: "Meaning → Greek", items: reversed, mult: 1, dir: "e2g" },
      { name: RAGE_NAME, items: weakestFirst(pool, sizes.rage), mult: 2, dir: "mixed", rage: true },
    ];
  }

  // Two glosses "share a meaning" if any comma/semicolon-separated part matches
  // ("I ask" vs "I ask, demand"), so a distractor can't also be a right answer.
  function glossParts(g) {
    return (g || "").toLowerCase().split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  function sharesMeaning(a, b) {
    const pb = new Set(glossParts(b));
    return glossParts(a).some((p) => pb.has(p));
  }

  function buildOptions(item, source, dir) {
    const reverse = item.type === "vocab" && dir === "e2g";
    const textOf = (i) => (reverse ? i.prompt : i.answer);
    const correct = textOf(item);

    let candidates = source.filter((i) => i.type === item.type && i.id !== item.id && textOf(i) !== correct);
    if (item.type === "vocab") candidates = candidates.filter((i) => !sharesMeaning(i.answer, item.answer));
    if (item.type === "paradigm") {
      const sameTable = candidates.filter((i) => i.category === item.category);
      if (new Set(sameTable.map(textOf)).size >= 3) candidates = sameTable;
    }

    const distractors = [];
    const seen = new Set([correct]);
    SRS.shuffle(candidates).forEach((c) => {
      const t = textOf(c);
      if (!seen.has(t) && distractors.length < 3) {
        seen.add(t);
        distractors.push(t);
      }
    });
    if (distractors.length < 1) return null;
    const options = SRS.shuffle([correct, ...distractors]);
    return { options, correctIdx: options.indexOf(correct), reverse };
  }

  function makeQuestion(item, round, rIdx, source) {
    let dir = round.dir || "g2e";
    if (dir === "mixed") dir = Math.random() < 0.5 ? "e2g" : "g2e";
    const opts = buildOptions(item, source, dir);
    if (!opts) return null;
    return {
      item,
      round: rIdx,
      mult: round.mult,
      ...opts,
      promptText: opts.reverse ? item.answer : item.prompt,
      promptGreek: opts.reverse ? false : item.promptGreek,
      greekOptions: opts.reverse || item.type === "paradigm",
    };
  }

  function makeBattle({ key, label, emoji, rounds, record, vocab }) {
    const source = Content.itemsUpToChapter(SRS.getCurrentChapter());
    const questions = [];
    rounds.forEach((round, rIdx) => {
      round.items.forEach((item) => {
        const q = makeQuestion(item, round, rIdx, source);
        if (q) questions.push(q);
      });
    });
    const totalPossible = questions.reduce((sum, q) => sum + q.mult, 0);
    const maxHp = totalPossible * HP_FACTOR;
    return {
      key, label, emoji, rounds, record, vocab, questions, source,
      rageIdx: rounds.findIndex((r) => r.rage), rageBuilt: false,
      maxHp, hp: maxHp, hearts: 3, streak: 0, i: 0,
      correctCount: 0, answeredCount: 0, missed: [], answered: false,
    };
  }

  // When the rage round starts, swap its pre-planned questions for the words
  // missed so far in THIS fight (topped up with the originally planned ones),
  // so a miss is re-tested in the same sitting.
  function rebuildRage(b) {
    b.rageBuilt = true;
    if (!b.missed.length) return;
    const start = b.i;
    const count = b.questions.length - start; // the rage round is always last
    const round = b.rounds[b.rageIdx];
    const picked = [];
    const seen = new Set();
    const take = (item) => {
      if (picked.length < count && !seen.has(item.id)) {
        seen.add(item.id);
        picked.push(item);
      }
    };
    SRS.shuffle([...b.missed]).forEach(take);
    b.questions.slice(start).forEach((q) => take(q.item));
    const fresh = picked.map((item) => makeQuestion(item, round, b.rageIdx, b.source)).filter(Boolean);
    if (fresh.length) b.questions.splice(start, count, ...fresh);
  }

  function startFromKey(container, key, vocab) {
    const pool = poolFor(key, vocab);
    const rounds = vocab
      ? buildVocabRounds(pool, key === "all" ? VOCAB_SIZES.cumulative : VOCAB_SIZES.chapter)
      : buildRounds(pool, key === "all" ? SIZES.cumulative : SIZES.chapter);
    const info = bossInfo(key, vocab);
    const battle = makeBattle({ key, label: info.label, emoji: info.emoji, rounds, record: true, vocab });
    if (battle.questions.length < 3) {
      container.innerHTML = `<div class="card"><p>Not enough material for this boss yet.</p><button class="btn secondary" id="bb-map">Back to map</button></div>`;
      container.querySelector("#bb-map").addEventListener("click", () => render(container));
      return;
    }
    token++;
    renderQuestion(container, battle);
  }

  function startRematch(container, parent) {
    const battle = makeBattle({
      key: parent.key,
      label: `Rematch: ${parent.label.replace(/^Rematch: /, "")}`,
      emoji: parent.emoji,
      rounds: [{
        name: "Rematch (your missed words)",
        items: SRS.shuffle([...parent.missed]),
        mult: 1,
        dir: parent.vocab ? "mixed" : "g2e",
      }],
      record: false,
      vocab: parent.vocab,
    });
    token++;
    renderQuestion(container, battle);
  }

  // ---- the fight ----------------------------------------------------------------
  function hearts(n) {
    return "❤️".repeat(Math.max(0, n)) + "🖤".repeat(Math.max(0, 3 - n));
  }

  function answerLine(q) {
    const correct = q.options[q.correctIdx];
    const extra = q.item.type !== "vocab" && q.item.detail ? ` (${q.item.detail})` : "";
    return `${correct}${extra}`;
  }

  function renderQuestion(container, b) {
    const q = b.questions[b.i];
    b.answered = false;
    const round = b.rounds[q.round];
    const hint = b.vocab ? (q.reverse ? "Which Greek word?" : "What does it mean?") : "";

    container.innerHTML = `
      <div class="card">
        <div class="row between">
          <button class="btn secondary" id="bb-flee">Flee</button>
          <span class="pill">Round ${q.round + 1} of ${b.rounds.length} &middot; ${esc(round.name)}</span>
        </div>
        <div class="boss-emoji" id="bb-boss">${b.emoji}</div>
        <div class="boss-name">${esc(b.label)}</div>
        <div class="hp-track"><div class="hp-fill" id="bb-hp" style="width:${(b.hp / b.maxHp) * 100}%"></div></div>
        <div class="row between" style="margin:0.5rem 0;">
          <span class="hearts" id="bb-hearts">${hearts(b.hearts)}</span>
          <span class="pill" id="bb-streak">🔥 ${b.streak}</span>
          <span class="pill">${b.i + 1} / ${b.questions.length}</span>
        </div>
        <div class="flash-front">
          ${hint ? `<div class="flash-meta" style="margin:0 0 0.4rem;">${hint}</div>` : ""}
          <div class="${q.promptGreek ? "greek" : ""}">${esc(q.promptText)}</div>
          ${q.item.type === "parsing" ? `<div class="flash-meta greek">${esc(q.item.lexical)}</div>` : ""}
        </div>
        <div class="mcq-options">
          ${q.options.map((o, idx) => `<button class="mcq-option ${q.greekOptions ? "greek" : ""}" data-idx="${idx}">${esc(o)}</button>`).join("")}
        </div>
        <div id="bb-feedback"></div>
        <div class="row" style="justify-content:center; margin-top:0.75rem;">
          <button class="btn" id="bb-next" hidden>Next</button>
        </div>
      </div>`;

    container.querySelector("#bb-flee").addEventListener("click", () => render(container));
    container.querySelectorAll(".mcq-option").forEach((btn) => {
      btn.addEventListener("click", () => answer(container, b, q, parseInt(btn.dataset.idx, 10)));
    });
  }

  function answer(container, b, q, chosenIdx) {
    if (b.answered) return;
    b.answered = true;
    b.answeredCount += 1;
    const ok = chosenIdx === q.correctIdx;
    SRS.grade(q.item.id, ok ? 4 : 1);

    const buttons = [...container.querySelectorAll(".mcq-option")];
    buttons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === q.correctIdx) btn.classList.add("correct");
      else if (idx === chosenIdx) btn.classList.add("incorrect");
    });

    const boss = container.querySelector("#bb-boss");
    const feedback = container.querySelector("#bb-feedback");

    if (ok) {
      b.correctCount += 1;
      b.streak += 1;
      const power = b.streak % POWER_EVERY === 0;
      const dmg = q.mult * (power ? 2 : 1);
      b.hp = Math.max(0, b.hp - dmg);
      boss.classList.add("hit");
      let restored = false;
      if (b.streak % HEART_EVERY === 0 && b.hearts < MAX_HEARTS) {
        b.hearts += 1;
        restored = true;
      }
      feedback.className = "feedback correct";
      feedback.textContent = (power ? `POWER ATTACK! −${dmg}` : `Hit! −${dmg}`) + (restored ? "  ❤️ Heart restored!" : "");
    } else {
      b.hearts -= 1;
      b.streak = 0;
      b.hp = Math.min(b.maxHp, b.hp + HEAL_ON_MISS);
      if (!b.missed.some((m) => m.id === q.item.id)) b.missed.push(q.item);
      feedback.className = "feedback incorrect";
      feedback.textContent = `Not quite. Answer: ${answerLine(q)}`;
    }

    container.querySelector("#bb-hp").style.width = `${(b.hp / b.maxHp) * 100}%`;
    container.querySelector("#bb-hearts").textContent = hearts(b.hearts);
    container.querySelector("#bb-streak").textContent = `🔥 ${b.streak}`;

    const next = container.querySelector("#bb-next");
    const won = b.hp <= 0;
    const dead = b.hearts <= 0;
    const lastQuestion = b.i >= b.questions.length - 1;

    const proceed = () => {
      if (won) finish(container, b, "win");
      else if (dead) finish(container, b, "dead");
      else if (lastQuestion) finish(container, b, "survived");
      else {
        b.i += 1;
        if (b.rageIdx !== -1 && !b.rageBuilt && b.questions[b.i].round === b.rageIdx) rebuildRage(b);
        renderQuestion(container, b);
      }
    };

    if (ok && !won && !lastQuestion) {
      const mine = token;
      setTimeout(() => {
        if (mine === token && b.answered) proceed();
      }, 750);
      return;
    }
    next.textContent = won ? "Claim victory" : dead || lastQuestion ? "See results" : "Next";
    next.hidden = false;
    next.addEventListener("click", proceed);
  }

  // ---- results ---------------------------------------------------------------------
  function finish(container, b, outcome) {
    token++;
    const win = outcome === "win";
    // hearts can regenerate, so stars count misses instead of hearts left
    const misses = b.answeredCount - b.correctCount;
    const earned = win ? (misses === 0 ? 3 : misses <= 2 ? 2 : 1) : 0;
    let bestLine = "";
    if (win && b.record) {
      const best = SRS.recordBoss(starKey(b.key, b.vocab), earned);
      bestLine = `<p class="flash-meta">Best on this boss: <span class="boss-stars">${stars(best)}</span></p>`;
    }

    const headline = win
      ? `🏆 ${esc(b.label)} defeated!`
      : outcome === "dead"
      ? "💀 You ran out of hearts"
      : "😈 The boss survived";

    const missedHtml = b.missed.length
      ? `<h3>Review these</h3>
         <div class="boss-missed">
           ${b.missed
             .map((m) => {
               const extra = m.type !== "vocab" && m.detail ? " &middot; " + esc(m.detail) : "";
               return `<div class="boss-missed-row"><div class="${m.promptGreek ? "greek" : ""}">${esc(m.prompt)}</div><div class="${m.type === "paradigm" ? "greek" : ""}" style="color:var(--text-dim);">${esc(m.answer)}${extra}</div></div>`;
             })
             .join("")}
         </div>`
      : `<p>No misses. Flawless.</p>`;

    container.innerHTML = `
      <div class="card">
        <div class="boss-emoji ${win ? "dead" : ""}">${b.emoji}</div>
        <h2 style="text-align:center;">${headline}</h2>
        ${win ? `<p style="text-align:center;" class="boss-stars big">${stars(earned)}</p>` : ""}
        <p style="text-align:center;">${b.correctCount} / ${b.answeredCount} correct &middot; ${hearts(b.hearts)}</p>
        <div style="text-align:center;">${bestLine}</div>
        ${missedHtml}
        <div class="row" style="justify-content:center; margin-top:1rem;">
          <button class="btn" id="bb-again">${win ? "Fight again" : "Try again"}</button>
          ${b.missed.length ? `<button class="btn secondary" id="bb-rematch">Retry missed words</button>` : ""}
          <button class="btn secondary" id="bb-map">Back to map</button>
        </div>
      </div>`;

    container.querySelector("#bb-map").addEventListener("click", () => render(container));
    container.querySelector("#bb-again").addEventListener("click", () => {
      if (b.record) startFromKey(container, b.key, b.vocab);
      else startRematch(container, b);
    });
    const rematch = container.querySelector("#bb-rematch");
    if (rematch) rematch.addEventListener("click", () => startRematch(container, b));
  }

  return { render };
})();
