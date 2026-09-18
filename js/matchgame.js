// Shared drag-and-drop / tap-to-place wiring for matching games.
// Desktop (mouse) gets native HTML5 drag-drop. Touch devices get
// tap-chip-then-tap-cell instead, since HTML5 DnD doesn't fire from touch
// in mobile browsers.
const MatchGame = (() => {
  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  // chips/cells: NodeLists or arrays of elements.
  // isMatch(chip, cell) -> bool. onCorrect(chip, cell) / onWrong(chip, cell).
  function wire({ chips, cells, isMatch, onCorrect, onWrong }) {
    if (isTouchDevice()) {
      wireTap(chips, cells, isMatch, onCorrect, onWrong);
    } else {
      wireDrag(chips, cells, isMatch, onCorrect, onWrong);
    }
  }

  function wireTap(chips, cells, isMatch, onCorrect, onWrong) {
    let selected = null;

    function select(chip) {
      if (selected) selected.classList.remove("selected");
      if (selected === chip) {
        selected = null;
        return;
      }
      selected = chip;
      chip.classList.add("selected");
    }

    chips.forEach((chip) => {
      chip.addEventListener("click", () => select(chip));
    });

    cells.forEach((cell) => {
      cell.addEventListener("click", () => {
        if (cell.classList.contains("filled") || !selected) return;
        const chip = selected;
        chip.classList.remove("selected");
        selected = null;
        if (isMatch(chip, cell)) onCorrect(chip, cell);
        else onWrong(chip, cell);
      });
    });
  }

  function wireDrag(chips, cells, isMatch, onCorrect, onWrong) {
    chips.forEach((chip) => {
      chip.setAttribute("draggable", "true");
      chip.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", chip.id);
        chip.classList.add("dragging");
      });
      chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
    });

    cells.forEach((cell) => {
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
        const chip = document.getElementById(chipId);
        if (!chip) return;
        if (isMatch(chip, cell)) onCorrect(chip, cell);
        else onWrong(chip, cell);
      });
    });
  }

  return { isTouchDevice, wire };
})();
