// Errors seen since page load, shown in Settings > Troubleshooting.
window.__appErrors = [];
window.addEventListener("error", (e) => window.__appErrors.push(String(e.message)));
window.addEventListener("unhandledrejection", (e) =>
  window.__appErrors.push("promise: " + String((e.reason && e.reason.message) || e.reason))
);

const App = (() => {
  let pendingFocusGroup = null;

  const views = {
    dashboard: Dashboard,
    flashcards: Flashcards,
    quiz: Quiz,
    boss: BossBattle,
    drill: Drill,
    tests: PracticeTests,
    reference: Reference,
    settings: Settings,
  };

  function setActiveTab(view) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  }

  function go(view) {
    setActiveTab(view);
    const app = document.getElementById("app");
    views[view].render(app);
    location.hash = view;
  }

  function focusGroupAndGo(group) {
    pendingFocusGroup = group;
    go("flashcards");
  }

  function consumePendingFocusGroup() {
    const g = pendingFocusGroup;
    pendingFocusGroup = null;
    return g;
  }

  async function init() {
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => go(btn.dataset.view));
    });

    try {
      await Promise.all([Content.load(), SRS.init()]);
    } catch (e) {
      document.getElementById("app").innerHTML = `<div class="card"><p>Failed to load content.json / reference.json. Make sure you're serving this folder (not opening index.html via file://), or run a local server.</p><p style="color:var(--bad)">${e}</p></div>`;
      return;
    }

    const initial = (location.hash || "#dashboard").slice(1);
    go(views[initial] ? initial : "dashboard");
  }

  return { init, focusGroupAndGo, consumePendingFocusGroup };
})();

document.addEventListener("DOMContentLoaded", App.init);
