import { evaluateArithmetic } from "./arithmetic.js";
/* ================================================================
   calculator.js – Calculator app with simple & scientific modes
   ================================================================ */

/**
 * Create and wire-up a calculator inside a WM window.
 * @param {object} win  Window object with { body, el, ... }
 */
export function createCalculator(win) {
  const container = document.createElement("div");
  container.className = "calc-body";

  // ── Display ──────────────────────────────────────────────────
  const display = document.createElement("div");
  display.className = "calc-display";

  const exprLine = document.createElement("div");
  exprLine.className = "calc-expr";
  exprLine.textContent = "\u00A0"; // non-breaking space placeholder

  const valueLine = document.createElement("div");
  valueLine.className = "calc-value";
  valueLine.textContent = "0";

  display.appendChild(exprLine);
  display.appendChild(valueLine);
  container.appendChild(display);

  // ── Scientific toggle ────────────────────────────────────────
  const toggleRow = document.createElement("div");
  toggleRow.className = "calc-toggle-row";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "calc-toggle-btn";
  toggleBtn.innerHTML = '<span class="calc-toggle-arrow">▼</span> Scientific';

  const degRadBtn = document.createElement("button");
  degRadBtn.className = "calc-deg-rad-btn";
  degRadBtn.textContent = "DEG";

  toggleRow.appendChild(toggleBtn);
  toggleRow.appendChild(degRadBtn);
  container.appendChild(toggleRow);

  // ── Scientific panel (hidden by default) ─────────────────────
  const sciPanel = document.createElement("div");
  sciPanel.className = "calc-sci-panel collapsed";
  sciPanel.hidden = true;
  toggleBtn.setAttribute("aria-expanded", "false");

  const sciBtns = [
    { label: "sin", cls: "fn" },
    { label: "cos", cls: "fn" },
    { label: "tan", cls: "fn" },
    { label: "asin", cls: "fn" },
    { label: "acos", cls: "fn" },
    { label: "atan", cls: "fn" },
    { label: "log", cls: "fn" },
    { label: "ln", cls: "fn" },
    { label: "√x", cls: "fn" },
    { label: "x²", cls: "fn" },
    { label: "x³", cls: "fn" },
    { label: "xⁿ", cls: "op" },
    { label: "10ˣ", cls: "fn" },
    { label: "eˣ", cls: "fn" },
    { label: "n!", cls: "fn" },
    { label: "1/x", cls: "fn" },
    { label: "|x|", cls: "fn" },
    { label: "mod", cls: "op" },
    { label: "π", cls: "const" },
    { label: "e", cls: "const" },
    { label: "(", cls: "paren" },
    { label: ")", cls: "paren" },
    { label: "⌊x⌋", cls: "fn" },
    { label: "⌈x⌉", cls: "fn" },
  ];

  sciBtns.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = `calc-btn calc-sci-btn sci-${b.cls}`;
    btn.textContent = b.label;
    btn.dataset.action = b.label;
    sciPanel.appendChild(btn);
  });

  container.appendChild(sciPanel);

  // ── Standard keypad ──────────────────────────────────────────
  const keypad = document.createElement("div");
  keypad.className = "calc-keypad";

  const stdKeys = [
    { label: "C", cls: "func" },
    { label: "CE", cls: "func" },
    { label: "⌫", cls: "func" },
    { label: "÷", cls: "operator" },
    { label: "7", cls: "num" },
    { label: "8", cls: "num" },
    { label: "9", cls: "num" },
    { label: "×", cls: "operator" },
    { label: "4", cls: "num" },
    { label: "5", cls: "num" },
    { label: "6", cls: "num" },
    { label: "−", cls: "operator" },
    { label: "1", cls: "num" },
    { label: "2", cls: "num" },
    { label: "3", cls: "num" },
    { label: "+", cls: "operator" },
    { label: "±", cls: "func" },
    { label: "0", cls: "num" },
    { label: ".", cls: "num" },
    { label: "=", cls: "equals" },
  ];

  stdKeys.forEach((k) => {
    const btn = document.createElement("button");
    btn.className = `calc-btn calc-${k.cls}`;
    btn.textContent = k.label;
    btn.dataset.key = k.label;
    keypad.appendChild(btn);
  });

  container.appendChild(keypad);
  win.body.appendChild(container);

  // ═════════════════════════════════════════════════════════════
  //  Calculator State
  // ═════════════════════════════════════════════════════════════

  let currentInput = "0";
  let tokens = []; // { display, eval } pairs
  let state = "INPUT"; // 'INPUT' | 'OP' | 'RESULT' | 'ERROR'
  let useDeg = true;
  let advancedOpen = false;
  let memoryOpenParens = 0;

  // ── Helpers ──────────────────────────────────────────────────

  function fmt(n) {
    if (typeof n !== "number") return String(n);
    if (!isFinite(n)) return "Error";
    if (Number.isNaN(n)) return "Error";
    // Avoid floating-point display artifacts
    const s = parseFloat(n.toPrecision(12));
    if (Math.abs(s) >= 1e15 || (Math.abs(s) < 1e-10 && s !== 0)) {
      return s.toExponential(6);
    }
    return String(s);
  }

  function updateUI() {
    const exprStr = tokens.map((t) => t.display).join(" ");
    exprLine.textContent = exprStr || "\u00A0";
    valueLine.textContent = currentInput;

    // Auto-shrink text if too long
    const len = currentInput.length;
    if (len > 14) valueLine.style.fontSize = "1.2rem";
    else if (len > 10) valueLine.style.fontSize = "1.6rem";
    else valueLine.style.fontSize = "";
  }

  function toRadians(v) {
    return useDeg ? (v * Math.PI) / 180 : v;
  }
  function fromRadians(v) {
    return useDeg ? (v * 180) / Math.PI : v;
  }

  function factorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    if (n > 170) return Infinity;
    if (!Number.isInteger(n)) return gamma(n + 1);
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // Stirling/Lanczos approx for non-integer factorial
  function gamma(z) {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    const g = 7;
    const c = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  function currentNum() {
    const v = parseFloat(currentInput);
    return isNaN(v) ? 0 : v;
  }

  const safeEval = evaluateArithmetic;

  // ── Input Handlers ───────────────────────────────────────────

  function inputDigit(d) {
    if (state === "ERROR") {
      allClear();
    }
    if (state === "RESULT") {
      tokens = [];
      currentInput = d;
      state = "INPUT";
    } else if (state === "OP") {
      currentInput = d;
      state = "INPUT";
    } else {
      if (currentInput === "0" && d !== "0") currentInput = d;
      else if (currentInput === "0" && d === "0") {
        /* stay at 0 */
      } else currentInput += d;
    }
    updateUI();
  }

  function inputDecimal() {
    if (state === "ERROR") {
      allClear();
    }
    if (state === "RESULT") {
      tokens = [];
      currentInput = "0.";
      state = "INPUT";
    } else if (state === "OP") {
      currentInput = "0.";
      state = "INPUT";
    } else {
      if (!currentInput.includes(".")) currentInput += ".";
    }
    updateUI();
  }

  function inputOperator(displayOp, evalOp) {
    if (state === "ERROR") return;
    if (state === "RESULT") tokens = [];

    if (state === "OP") {
      // Replace last operator
      tokens[tokens.length - 1] = { display: displayOp, eval: evalOp };
      updateUI();
      return;
    }

    // Commit current input
    const val = currentNum();
    if (state !== "CLOSED")
      tokens.push({ display: fmt(val), eval: String(val) });
    tokens.push({ display: displayOp, eval: evalOp });

    // If we have enough tokens, try intermediate evaluation for display
    if (tokens.length >= 3) {
      const evalStr = tokens.map((t) => t.eval).join(" ");
      // Remove trailing operator for eval
      const trimmed = evalStr.replace(/[\+\-\*\/\%\*]{1,2}\s*$/, "").trim();
      const intermediate = safeEval(trimmed);
      if (intermediate !== null) {
        currentInput = fmt(intermediate);
      }
    }

    state = "OP";
    updateUI();
  }

  function calculate() {
    if (state === "ERROR" || state === "OP" || state === "RESULT") return;

    const val = currentNum();
    if (state !== "CLOSED")
      tokens.push({ display: fmt(val), eval: String(val) });

    const evalStr = tokens.map((t) => t.eval).join(" ");
    const result = safeEval(evalStr);

    tokens.push({ display: "=", eval: "" });

    if (result === null) {
      currentInput = "Error";
      state = "ERROR";
    } else {
      currentInput = fmt(result);
      state = "RESULT";
    }
    updateUI();
  }

  function allClear() {
    currentInput = "0";
    tokens = [];
    state = "INPUT";
    memoryOpenParens = 0;
    updateUI();
  }

  function clearEntry() {
    if (state === "ERROR") {
      allClear();
      return;
    }
    currentInput = "0";
    if (state === "RESULT") {
      tokens = [];
      state = "INPUT";
    }
    updateUI();
  }

  function backspace() {
    if (state === "ERROR" || state === "RESULT" || state === "OP") return;
    if (currentInput.length > 1) {
      currentInput = currentInput.slice(0, -1);
    } else {
      currentInput = "0";
    }
    updateUI();
  }

  function negate() {
    if (state === "ERROR") return;
    if (currentInput === "0" || currentInput === "Error") return;
    if (state === "RESULT") {
      tokens = [];
      state = "INPUT";
    }
    if (currentInput.startsWith("-")) currentInput = currentInput.slice(1);
    else currentInput = "-" + currentInput;
    updateUI();
  }

  // ── Scientific Functions ─────────────────────────────────────

  function applyUnary(displayLabel, fn) {
    if (state === "ERROR") return;
    const val = currentNum();
    const result = fn(val);

    if (typeof result !== "number" || !isFinite(result) || isNaN(result)) {
      currentInput = "Error";
      state = "ERROR";
    } else {
      // Add to expression
      if (state === "RESULT") tokens = [];
      currentInput = fmt(result);
      state = "INPUT";
    }
    updateUI();
  }

  function insertConstant(displayLabel, val) {
    if (state === "ERROR") {
      allClear();
    }
    if (state === "RESULT") tokens = [];
    currentInput = fmt(val);
    state = "INPUT";
    updateUI();
  }

  function inputOpenParen() {
    if (state === "ERROR") {
      allClear();
    }
    if (state === "RESULT") tokens = [];
    tokens.push({ display: "(", eval: "(" });
    memoryOpenParens++;
    state = "OP"; // waiting for value
    updateUI();
  }

  function inputCloseParen() {
    if (memoryOpenParens <= 0) return;
    const val = currentNum();
    if (state !== "CLOSED")
      tokens.push({ display: fmt(val), eval: String(val) });
    tokens.push({ display: ")", eval: ")" });
    memoryOpenParens--;

    // Evaluate what's inside parens for display
    const evalStr = tokens.map((t) => t.eval).join(" ");
    const r = safeEval(evalStr);
    if (r !== null) currentInput = fmt(r);

    state = "CLOSED";
    updateUI();
  }

  function handleSciBtn(label) {
    switch (label) {
      case "sin":
        applyUnary("sin", (v) => Math.sin(toRadians(v)));
        break;
      case "cos":
        applyUnary("cos", (v) => Math.cos(toRadians(v)));
        break;
      case "tan":
        applyUnary("tan", (v) => Math.tan(toRadians(v)));
        break;
      case "asin":
        applyUnary("asin", (v) => fromRadians(Math.asin(v)));
        break;
      case "acos":
        applyUnary("acos", (v) => fromRadians(Math.acos(v)));
        break;
      case "atan":
        applyUnary("atan", (v) => fromRadians(Math.atan(v)));
        break;
      case "log":
        applyUnary("log", (v) => Math.log10(v));
        break;
      case "ln":
        applyUnary("ln", (v) => Math.log(v));
        break;
      case "√x":
        applyUnary("√", (v) => Math.sqrt(v));
        break;
      case "x²":
        applyUnary("sqr", (v) => v * v);
        break;
      case "x³":
        applyUnary("cube", (v) => v * v * v);
        break;
      case "xⁿ":
        inputOperator("^", "**");
        break;
      case "10ˣ":
        applyUnary("10^", (v) => Math.pow(10, v));
        break;
      case "eˣ":
        applyUnary("e^", (v) => Math.exp(v));
        break;
      case "n!":
        applyUnary("fact", (v) => factorial(v));
        break;
      case "1/x":
        applyUnary("1/", (v) => 1 / v);
        break;
      case "|x|":
        applyUnary("abs", (v) => Math.abs(v));
        break;
      case "mod":
        inputOperator("mod", "%");
        break;
      case "π":
        insertConstant("π", Math.PI);
        break;
      case "e":
        insertConstant("e", Math.E);
        break;
      case "(":
        inputOpenParen();
        break;
      case ")":
        inputCloseParen();
        break;
      case "⌊x⌋":
        applyUnary("floor", (v) => Math.floor(v));
        break;
      case "⌈x⌉":
        applyUnary("ceil", (v) => Math.ceil(v));
        break;
    }
  }

  // ── Event Delegation ─────────────────────────────────────────

  // Standard keypad
  keypad.addEventListener("click", (e) => {
    const btn = e.target.closest(".calc-btn");
    if (!btn) return;
    const key = btn.dataset.key;

    if (btn.classList.contains("calc-num")) {
      if (key === ".") inputDecimal();
      else inputDigit(key);
    } else if (btn.classList.contains("calc-operator")) {
      const map = {
        "+": ["+", "+"],
        "−": ["−", "-"],
        "×": ["×", "*"],
        "÷": ["÷", "/"],
      };
      const [d, ev] = map[key] || [key, key];
      inputOperator(d, ev);
    } else if (btn.classList.contains("calc-equals")) {
      calculate();
    } else if (btn.classList.contains("calc-func")) {
      if (key === "C") allClear();
      else if (key === "CE") clearEntry();
      else if (key === "⌫") backspace();
      else if (key === "±") negate();
    }
  });

  // Scientific panel
  sciPanel.addEventListener("click", (e) => {
    const btn = e.target.closest(".calc-sci-btn");
    if (!btn) return;
    handleSciBtn(btn.dataset.action);
  });

  // Toggle scientific
  toggleBtn.addEventListener("click", () => {
    advancedOpen = !advancedOpen;
    sciPanel.hidden = !advancedOpen;
    toggleBtn.setAttribute("aria-expanded", String(advancedOpen));
    sciPanel.classList.toggle("collapsed", !advancedOpen);
    toggleBtn.querySelector(".calc-toggle-arrow").textContent = advancedOpen
      ? "▲"
      : "▼";
    toggleBtn.innerHTML = `<span class="calc-toggle-arrow">${advancedOpen ? "▲" : "▼"}</span> ${advancedOpen ? "Simple" : "Scientific"}`;
  });

  // DEG / RAD toggle
  degRadBtn.addEventListener("click", () => {
    useDeg = !useDeg;
    degRadBtn.textContent = useDeg ? "DEG" : "RAD";
  });

  // ── Keyboard support ─────────────────────────────────────────
  function handleKeyboard(e) {
    if (
      !win.el.classList.contains("wm-focused") ||
      win.el.hidden ||
      document.querySelector(".overlay:not(.hidden)")
    )
      return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    const k = e.key;
    if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      inputDigit(k);
    } else if (k === ".") {
      e.preventDefault();
      inputDecimal();
    } else if (k === "+") {
      e.preventDefault();
      inputOperator("+", "+");
    } else if (k === "-") {
      e.preventDefault();
      inputOperator("−", "-");
    } else if (k === "*") {
      e.preventDefault();
      inputOperator("×", "*");
    } else if (k === "/") {
      e.preventDefault();
      inputOperator("÷", "/");
    } else if (k === "%") {
      e.preventDefault();
      inputOperator("mod", "%");
    } else if (k === "^") {
      e.preventDefault();
      inputOperator("^", "**");
    } else if (k === "Enter" || k === "=") {
      e.preventDefault();
      calculate();
    } else if (k === "Backspace") {
      e.preventDefault();
      backspace();
    } else if (k === "Escape") {
      e.preventDefault();
      allClear();
    } else if (k === "(") {
      e.preventDefault();
      inputOpenParen();
    } else if (k === ")") {
      e.preventDefault();
      inputCloseParen();
    }
  }

  // Attach keyboard when window is focused
  win.el.addEventListener("mousedown", () => {
    document.addEventListener("keydown", handleKeyboard);
  });

  // Cleanup on window close
  win.cleanup = () => {
    document.removeEventListener("keydown", handleKeyboard);
  };

  updateUI();
}
