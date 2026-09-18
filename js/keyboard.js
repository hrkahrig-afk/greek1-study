// On-screen polytonic Greek keyboard: base letters + combining diacritics,
// since most keyboards can't type breathing marks / accents directly.
const GreekKeyboard = (() => {
  const LOWER = ["α","β","γ","δ","ε","ζ","η","θ","ι","κ","λ","μ","ν","ξ","ο","π","ρ","σ","τ","υ","φ","χ","ψ","ω","ς"];
  const DIACRITICS = [
    { mark: "́", label: "´", title: "acute" },
    { mark: "̀", label: "`", title: "grave" },
    { mark: "͂", label: "^", title: "circumflex" },
    { mark: "̓", label: "ʼ", title: "smooth breathing" },
    { mark: "̔", label: "ʽ", title: "rough breathing" },
    { mark: "ͅ", label: "ιͅ", title: "iota subscript" },
    { mark: "̈", label: "¨", title: "diaeresis" },
  ];

  function insertAtCursor(input, text) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const pos = start + text.length;
    input.setSelectionRange(pos, pos);
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function applyDiacritic(input, mark) {
    const pos = input.selectionStart ?? input.value.length;
    if (pos === 0) return;
    const before = input.value.slice(0, pos - 1);
    const target = input.value.slice(pos - 1, pos);
    const after = input.value.slice(pos);
    const combined = (target + mark).normalize("NFC");
    input.value = before + combined + after;
    const newPos = before.length + combined.length;
    input.setSelectionRange(newPos, newPos);
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function attach(container, input) {
    container.innerHTML = "";
    container.className = "greek-kbd";

    const letterRow = document.createElement("div");
    letterRow.style.display = "contents";
    LOWER.forEach((ch) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = ch;
      btn.addEventListener("click", () => insertAtCursor(input, ch));
      container.appendChild(btn);
    });

    const label1 = document.createElement("div");
    label1.className = "kbd-group-label";
    label1.textContent = "letters (tap a letter, then a mark below to accent it)";
    container.appendChild(label1);

    DIACRITICS.forEach((d) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = d.title;
      btn.textContent = d.label;
      btn.addEventListener("click", () => applyDiacritic(input, d.mark));
      container.appendChild(btn);
    });

    const spBtn = document.createElement("button");
    spBtn.type = "button";
    spBtn.textContent = "space";
    spBtn.addEventListener("click", () => insertAtCursor(input, " "));
    container.appendChild(spBtn);

    const bsBtn = document.createElement("button");
    bsBtn.type = "button";
    bsBtn.textContent = "⌫";
    bsBtn.title = "backspace";
    bsBtn.addEventListener("click", () => {
      const pos = input.selectionStart ?? input.value.length;
      if (pos === 0) return;
      input.value = input.value.slice(0, pos - 1) + input.value.slice(pos);
      input.setSelectionRange(pos - 1, pos - 1);
      input.focus();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    container.appendChild(bsBtn);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "clear";
    clearBtn.addEventListener("click", () => {
      input.value = "";
      input.focus();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    container.appendChild(clearBtn);
  }

  return { attach };
})();
