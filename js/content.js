// Loads content.json + reference.json and builds a normalized study item bank.
const Content = (() => {
  let data = null; // { chapters, alphabet, vocabulary, paradigms, quizzes, practiceExercises }
  let items = null; // flat array of study items built from data

  async function load() {
    const [content, reference] = await Promise.all([
      fetch("data/content.json", { cache: "no-cache" }).then((r) => r.json()),
      fetch("data/reference.json", { cache: "no-cache" }).then((r) => r.json()),
    ]);
    data = {
      chapters: content.chapters,
      alphabet: content.alphabet,
      vocabulary: content.vocabulary,
      paradigms: content.paradigms,
      parsing: content.parsing || [],
      concepts: content.concepts || [],
      quizzes: reference.quizzes,
      practiceExercises: reference.practice_exercises,
    };
    items = buildItemBank(data);
    return data;
  }

  // ---- coarse topic grouping for the weak-area dashboard -----------------
  function groupForParadigmTitle(title) {
    const t = title.toUpperCase();
    if (t.includes("PARTICIPLE")) return "Participles";
    if (t.includes("INFINITIVE")) return "Infinitives";
    if (t.includes(" SUB") || t.includes("SUBJUNCTIVE")) return "Subjunctive";
    if (t.includes("IMPERATIVE")) return "Imperative";
    if (t.includes("PRONOUN")) return "Pronouns";
    if (t.includes("DECLENSION") || t.includes("ADJECTIVE")) return "Declensions & Adjectives";
    if (t.includes("INDICATIVE") || t.includes("ΔΙΔΩΜΙ") || t.includes("EIMI") || t.includes("ΕΙΜΙ"))
      return "Verb Conjugation";
    return "Other Paradigms";
  }

  // ---- generic paradigm table parsing -------------------------------------
  // Leading rows with zero greek cells are header/label rows; everything
  // after is data. Data-row cells (after the row's own label cell) are
  // grouped by adjacency: greek+greek+non-greek => {article, form, gloss};
  // greek+non-greek => {form, gloss}; a trailing/solo greek cell => {form}.
  function parseParadigmTable(paradigm) {
    const rows = paradigm.rows;
    let firstDataIdx = rows.findIndex((r) => r.some((c) => c.greek));
    if (firstDataIdx === -1) firstDataIdx = rows.length;
    const headerRows = rows.slice(0, firstDataIdx);
    const dataRows = rows.slice(firstDataIdx);
    const colCount = dataRows.length ? dataRows[0].length : 0;

    // column label per index (skip index 0, the row-label column)
    const colLabels = [];
    for (let c = 1; c < colCount; c++) {
      const parts = [];
      for (const hr of headerRows) {
        const txt = hr[c] ? hr[c].text : "";
        if (txt && parts[parts.length - 1] !== txt) parts.push(txt);
      }
      colLabels[c] = parts.join(" ");
    }

    const parsedRows = dataRows.map((row) => {
      const label = row[0].text;
      const groups = [];
      let i = 1;
      while (i < row.length) {
        const a = row[i];
        const b = row[i + 1];
        const c = row[i + 2];
        if (a.greek && b && b.greek && c && !c.greek) {
          groups.push({ colIndex: i, colLabel: colLabels[i] || "", article: a.text, form: b.text, gloss: c.text });
          i += 3;
        } else if (a.greek && b && !b.greek) {
          groups.push({ colIndex: i, colLabel: colLabels[i] || "", form: a.text, gloss: b.text });
          i += 2;
        } else if (a.greek) {
          groups.push({ colIndex: i, colLabel: colLabels[i] || "", form: a.text });
          i += 1;
        } else {
          i += 1;
        }
      }
      return { label, groups };
    });

    return { colLabels, rows: parsedRows };
  }

  // ---- parsing field vocab (mirrors build_content.py's token maps) --------
  const PARSE_FIELD_ORDER = ["tense", "voice", "mood", "person", "number", "gender", "case"];
  const PARSE_FIELD_OPTIONS = {
    tense: ["Present", "Imperfect", "Future", "Aorist", "Perfect", "Pluperfect"],
    voice: ["Active", "Middle", "Passive", "Middle/Passive"],
    mood: ["Indicative", "Subjunctive", "Imperative", "Infinitive", "Participle", "Optative"],
    person: ["1st", "2nd", "3rd"],
    number: ["Singular", "Plural"],
    gender: ["Masculine", "Feminine", "Neuter", "Masc/Fem", "Masc/Neut", "Fem/Neut", "Masc/Fem/Neut"],
    case: ["Nominative", "Genitive", "Dative", "Accusative"],
  };

  // ---- item bank ------------------------------------------------------------
  function buildItemBank(data) {
    const bank = [];

    for (const letter of data.alphabet) {
      bank.push({
        id: `alpha:${letter.lower}`,
        type: "alphabet",
        category: "Alphabet",
        group: "Alphabet",
        chapter: letter.chapter,
        prompt: `${letter.lower}  ${letter.upper}`,
        promptGreek: true,
        answer: letter.name,
        detail: [letter.erasmian_pronunciation, letter.koine_pronunciation, letter.modern_pronunciation]
          .filter(Boolean)
          .join(" / "),
      });
    }

    data.vocabulary.forEach((v, idx) => {
      bank.push({
        id: `vocab:${idx}`,
        type: "vocab",
        category: "Vocabulary",
        group: "Vocabulary",
        chapter: v.chapter,
        prompt: v.word,
        promptGreek: true,
        answer: v.gloss,
        detail: `Chapter ${v.chapter}`,
      });
    });

    data.paradigms.forEach((p, pIdx) => {
      if (!p.drillable || p.chapter == null) return;
      const parsed = parseParadigmTable(p);
      const group = groupForParadigmTitle(p.title);
      parsed.rows.forEach((row, rIdx) => {
        row.groups.forEach((g, gIdx) => {
          const context = [row.label, g.colLabel].filter(Boolean).join(" ");
          if (g.article !== undefined) {
            bank.push({
              id: `para:${pIdx}:${rIdx}:${gIdx}:article`,
              type: "paradigm",
              category: p.title,
              group,
              chapter: p.chapter,
              prompt: `${p.title} — ${context} — article`,
              answer: g.article,
              detail: `${g.form}${g.gloss ? " — " + g.gloss : ""}`,
            });
          }
          bank.push({
            id: `para:${pIdx}:${rIdx}:${gIdx}:form`,
            type: "paradigm",
            category: p.title,
            group,
            chapter: p.chapter,
            prompt: `${p.title} — ${context}`,
            answer: g.form,
            detail: g.gloss || "",
          });
        });
      });
    });

    data.parsing.forEach((p, idx) => {
      const fields = PARSE_FIELD_ORDER.filter((f) => p[f] !== undefined);
      bank.push({
        id: `parse:${idx}`,
        type: "parsing",
        category: "Parsing",
        group: "Parsing",
        chapter: p.chapter,
        prompt: p.form,
        promptGreek: true,
        lexical: p.lexical,
        fields,
        values: Object.fromEntries(fields.map((f) => [f, p[f]])),
        answer: fields.map((f) => p[f]).join(" "),
        detail: [p.lexical, p.translation].filter(Boolean).join(" — "),
      });
    });

    data.concepts.forEach((c, idx) => {
      bank.push({
        id: `concept:${idx}`,
        type: "concept",
        category: c.category,
        group: "Grammar Concepts",
        chapter: c.chapter,
        prompt: c.term,
        promptGreek: false,
        answer: c.definition,
        detail: c.category,
      });
    });

    return bank;
  }

  function getData() {
    return data;
  }

  function getItems() {
    return items;
  }

  function itemsUpToChapter(chapter) {
    return items.filter((it) => it.chapter <= chapter);
  }

  return {
    load, getData, getItems, itemsUpToChapter, parseParadigmTable, groupForParadigmTitle,
    PARSE_FIELD_ORDER, PARSE_FIELD_OPTIONS,
  };
})();
