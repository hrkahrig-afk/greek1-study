const Reference = (() => {
  let subview = "paradigms";

  function render(container) {
    const data = Content.getData();
    const chapter = SRS.getCurrentChapter();

    container.innerHTML = `
      <h1>Reference</h1>
      <div class="row" style="margin-bottom:1rem;">
        <button class="btn secondary" data-sub="paradigms">Paradigms</button>
        <button class="btn secondary" data-sub="vocab">Vocabulary</button>
        <button class="btn secondary" data-sub="alphabet">Alphabet</button>
        <button class="btn secondary" data-sub="quizzes">Official Quizzes</button>
        <button class="btn secondary" data-sub="practice">Practice Exercises</button>
      </div>
      <div id="ref-body"></div>
    `;

    container.querySelectorAll("[data-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        subview = btn.dataset.sub;
        renderBody(container, data, chapter);
      });
    });

    renderBody(container, data, chapter);
  }

  function renderBody(container, data, chapter) {
    const body = container.querySelector("#ref-body");
    if (subview === "paradigms") {
      const list = data.paradigms.filter((p) => p.chapter == null || p.chapter <= chapter);
      body.innerHTML = list.map((p) => paradigmCard(p)).join("");
    } else if (subview === "vocab") {
      const list = data.vocabulary.filter((v) => v.chapter <= chapter);
      body.innerHTML = `
        <div class="card">
          <p>${list.length} words through Chapter ${chapter}.</p>
          <table class="paradigm">
            <tbody>
              ${list.map((v) => `<tr><td class="greek">${esc(v.word)}</td><td>${esc(v.gloss)}</td><td>Ch. ${v.chapter}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    } else if (subview === "alphabet") {
      body.innerHTML = `
        <div class="card">
          <table class="paradigm">
            <thead><tr><th>Lower</th><th>Upper</th><th>Name</th><th>Erasmian</th><th>Koine</th><th>Modern</th></tr></thead>
            <tbody>
              ${data.alphabet.map((l) => `<tr><td class="greek">${esc(l.lower)}</td><td class="greek">${esc(l.upper)}</td><td>${esc(l.name)}</td><td>${esc(l.erasmian_pronunciation)}</td><td>${esc(l.koine_pronunciation)}</td><td>${esc(l.modern_pronunciation)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    } else if (subview === "quizzes") {
      const list = data.quizzes.filter((q) => q.chapter <= chapter);
      body.innerHTML = list.length
        ? list.map((q) => `<div class="card"><h2>${esc(q.title)} <span class="pill">Ch. ${q.chapter}</span></h2><div class="reference-text">${esc(q.text)}</div></div>`).join("")
        : `<div class="card"><p>No quizzes unlocked yet.</p></div>`;
    } else if (subview === "practice") {
      const list = data.practiceExercises.filter((p) => p.chapter <= chapter);
      body.innerHTML = list.length
        ? list.map((p) => `<div class="card"><h2>Chapter ${p.chapter} Practice</h2><div class="reference-text">${esc(p.text)}</div></div>`).join("")
        : `<div class="card"><p>No practice exercises unlocked yet.</p></div>`;
    }
  }

  function paradigmCard(p) {
    const parsed = Content.parseParadigmTable(p);
    const maxCols = Math.max(...parsed.rows.map((r) => r.groups.length), 0);
    let head = "<tr><th></th>";
    for (let g = 0; g < maxCols; g++) {
      const lbl = parsed.rows[0] && parsed.rows[0].groups[g] ? parsed.rows[0].groups[g].colLabel : "";
      const hasArticle = parsed.rows[0] && parsed.rows[0].groups[g] && parsed.rows[0].groups[g].article !== undefined;
      head += hasArticle ? `<th colspan="2">${esc(lbl)}</th>` : `<th>${esc(lbl)}</th>`;
    }
    head += "</tr>";

    const rowsHtml = parsed.rows
      .map((row) => {
        let cells = `<td class="label">${esc(row.label)}</td>`;
        row.groups.forEach((g) => {
          if (g.article !== undefined) cells += `<td class="greek">${esc(g.article)}</td>`;
          cells += `<td class="greek">${esc(g.form)}</td>`;
        });
        return `<tr>${cells}</tr>`;
      })
      .join("");

    return `
      <div class="card">
        <h2>${esc(p.title)} ${p.chapter != null ? `<span class="pill">Ch. ${p.chapter}</span>` : ""}</h2>
        <table class="paradigm"><thead>${head}</thead><tbody>${rowsHtml}</tbody></table>
      </div>`;
  }

  function esc(s) {
    const div = document.createElement("div");
    div.textContent = s ?? "";
    return div.innerHTML;
  }

  return { render };
})();
