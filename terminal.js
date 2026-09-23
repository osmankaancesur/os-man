import changelog from "./changelog.md";
import { getSocialLinks } from "./socials.config.js";
/* ================================================================
   terminal.js – File system, commands, per-instance terminal state
   ================================================================ */

import {
  currentThemeRGB,
  setThemeRGB,
  setRainbow,
  isCrtEnabled,
  setCrtEnabled,
} from "./theme.js";
import { updateFavicon } from "./favicon.js";
export { updateFavicon } from "./favicon.js";
export { currentThemeRGB } from "./theme.js";

import { spawnWindow } from "./window-manager.js";

// ─── Virtual File System ────────────────────────────────────────

const fileSystem = {
  "/": {
    type: "dir",
    contents: {
      "about.txt": {
        type: "file",
        content: "OS_MAN is an open source interactive desktop.",
      },
      "contact.txt": {
        type: "file",
        content: getSocialLinks()
          .map((link) => `${link.label}: ${link.url}`)
          .join("\n"),
      },
      "changelog.md": {
        type: "file",
        content: changelog,
      },
    },
  },
};

function getDirNode(pathStr) {
  if (pathStr === "/") return fileSystem["/"];
  if (pathStr.startsWith("/")) pathStr = pathStr.slice(1);
  if (pathStr.endsWith("/")) pathStr = pathStr.slice(0, -1);
  const parts = pathStr.split("/");
  let current = fileSystem["/"];
  for (const part of parts) {
    if (!part) continue;
    if (current.type !== "dir" || !current.contents[part]) return null;
    current = current.contents[part];
  }
  return current;
}

function resolvePath(base, targetPath) {
  if (targetPath.startsWith("/")) return normalizePath(targetPath);
  return normalizePath(base + (base.endsWith("/") ? "" : "/") + targetPath);
}

function normalizePath(pathStr) {
  const parts = pathStr.split("/").filter(Boolean);
  const resolved = [];
  for (const p of parts) {
    if (p === ".") continue;
    if (p === "..") {
      if (resolved.length > 0) resolved.pop();
    } else resolved.push(p);
  }
  return "/" + resolved.join("/");
}

// ─── Theme Color State ──────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  updateFavicon(currentThemeRGB);
  setCrtEnabled(isCrtEnabled(), false);
  if (localStorage.getItem("matrix_active") === "true") {
    toggleMatrixRain();
  }
});

// ─── Matrix Rain ────────────────────────────────────────────────

let matrixActive = false;
let matrixAnimId = null;
let matrixResize = null;

function toggleMatrixRain() {
  const canvas = document.getElementById("matrix-rain-canvas");
  if (!canvas) return "Error: matrix canvas not found.";

  if (matrixActive) {
    matrixActive = false;
    canvas.classList.remove("active");
    window.removeEventListener("resize", matrixResize);
    if (matrixAnimId) {
      cancelAnimationFrame(matrixAnimId);
      matrixAnimId = null;
    }
    localStorage.setItem("matrix_active", "false");
    return "Matrix rain deactivated.";
  }

  matrixActive = true;
  localStorage.setItem("matrix_active", "true");
  canvas.classList.add("active");
  const ctx = canvas.getContext("2d");

  const fontSize = 14;
  let drops = [];
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drops = new Array(Math.floor(canvas.width / fontSize)).fill(1);
  }
  resize();
  window.addEventListener("resize", resize);
  matrixResize = resize;
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?ァカサタナハマヤラワガザダバパ";

  let lastTime = 0;
  const frameInterval = 50; // ms between frames

  function draw(timestamp) {
    if (!matrixActive) return;

    if (timestamp - lastTime < frameInterval) {
      matrixAnimId = requestAnimationFrame(draw);
      return;
    }
    lastTime = timestamp;

    // Parse current theme color
    const rgb = currentThemeRGB.split(",").map((s) => parseInt(s.trim()));
    const r = rgb[0] || 0,
      g = rgb[1] || 0,
      b = rgb[2] || 0;

    ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = fontSize + 'px "Fira Code", monospace';

    for (let i = 0; i < drops.length; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      // Bright head
      ctx.fillStyle = `rgba(${Math.min(r + 100, 255)}, ${Math.min(g + 100, 255)}, ${Math.min(b + 100, 255)}, 0.95)`;
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
      ctx.shadowBlur = 8;
      ctx.fillText(char, x, y);

      // Reset shadow for trail
      ctx.shadowBlur = 0;

      // Trail characters (dimmer)
      if (Math.random() > 0.6) {
        const trailChar = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
        ctx.fillText(trailChar, x, y - fontSize);
      }

      if (y > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }

    matrixAnimId = requestAnimationFrame(draw);
  }

  matrixAnimId = requestAnimationFrame(draw);
  return 'Matrix rain activated. Type "matrix" again to stop.';
}

// ─── Dynamic Favicon ────────────────────────────────────────────

// ─── Per-Instance Terminal ──────────────────────────────────────

export function createTerminalState(outputEl, inputEl, contentEl, promptEl) {
  let currentPath = "/";
  let mode = "shell";
  let nanoFile = null;
  let nanoContent = [];
  const commandHistory = [];
  let historyIndex = -1;

  const systemUser = "guest";
  const systemSymbol = "$";

  promptEl.textContent = `${systemUser}@demo:${currentPath === "/" ? "~" : "~" + currentPath}${systemSymbol}`;

  function printLine(text, isCommand = false) {
    if (!text && text !== "") return;
    const div = document.createElement("div");
    if (isCommand) {
      const displayPath = currentPath === "/" ? "~" : "~" + currentPath;
      const prefix = document.createElement("span");
      prefix.className = "prompt";
      prefix.textContent = `${systemUser}@demo:${displayPath}${systemSymbol}`;
      div.append(prefix, document.createTextNode(" " + text));
    } else {
      div.textContent = text;
    }
    outputEl.appendChild(div);
    contentEl.scrollTop = contentEl.scrollHeight;
  }

  const cmds = {
    help: () => `Available commands:
  help       - Show this message
  clear      - Clear terminal output
  whoami     - Display current user
  date       - Display current date
  pwd        - Print working directory
  ls         - List directory contents
  cd         - Change directory
  mkdir      - Create directory
  rm         - Remove file or directory
  cat        - Read file content
  nano       - Edit file
  echo       - Print generic text
  matrix     - Toggle matrix rain background
  color      - Change website color (e.g., color #00ff00 / color rainbow)
  crt        - Toggle CRT effect



Apps:
  about      - Open About window
  clock      - Open Clock window
  guestbook  - Open Guestbook window
  socials    - Open social profiles and contact links
  shortcuts  - Open Shortcuts window
  terminal   - Open new Terminal window
  tesseract  - Open Tesseract visualizer
  shapelab   - Open interactive 3D Shape Lab
  calc       - Open Calculator
  background - Open Background Manager
  music      - Open Music Player`,
    clear: () => {
      outputEl.innerHTML = "";
      return "";
    },
    whoami: () => "guest\nAccess level: restricted",
    date: () => new Date().toString(),
    pwd: () => currentPath,
    ls: (args) => {
      const target = resolvePath(
        currentPath,
        args.length ? args[0] : currentPath,
      );
      const node = getDirNode(target);
      if (!node)
        return `ls: cannot access '${args.length ? args[0] : target}': No such file or directory`;
      if (node.type !== "dir") return args[0];
      return Object.keys(node.contents)
        .map((k) => (node.contents[k].type === "dir" ? k + "/" : k))
        .join("  ");
    },
    cd: (args) => {
      if (!args.length) {
        currentPath = "/";
        promptEl.textContent = "guest@demo:~$";
        return "";
      }
      const target = resolvePath(currentPath, args[0]);
      const node = getDirNode(target);
      if (!node) return `cd: ${args[0]}: No such file or directory`;
      if (node.type !== "dir") return `cd: ${args[0]}: Not a directory`;
      currentPath = target;
      promptEl.textContent = `guest@demo:${currentPath === "/" ? "~" : "~" + currentPath}$`;
      return "";
    },
    mkdir: (args) => {
      if (!args.length) return "mkdir: missing operand";
      const target = resolvePath(currentPath, args[0]);
      const lastSlash = target.lastIndexOf("/");
      const parentPath = lastSlash === 0 ? "/" : target.substring(0, lastSlash);
      const newDir = target.substring(lastSlash + 1);
      const parentNode = getDirNode(parentPath);
      if (!parentNode || parentNode.type !== "dir")
        return `mkdir: cannot create directory '${args[0]}': No such file or directory`;
      if (parentNode.contents[newDir])
        return `mkdir: cannot create directory '${args[0]}': File exists`;
      parentNode.contents[newDir] = { type: "dir", contents: {} };
      return "";
    },
    rm: (args) => {
      if (!args.length) return "rm: missing operand";
      const target = resolvePath(currentPath, args[0]);
      if (target === "/") return "rm: cannot remove root directory";
      const lastSlash = target.lastIndexOf("/");
      const parentPath = lastSlash === 0 ? "/" : target.substring(0, lastSlash);
      const toDelete = target.substring(lastSlash + 1);
      const parentNode = getDirNode(parentPath);
      if (!parentNode || parentNode.type !== "dir")
        return `rm: cannot remove '${args[0]}': No such file or directory`;
      if (!parentNode.contents[toDelete])
        return `rm: cannot remove '${args[0]}': No such file or directory`;
      delete parentNode.contents[toDelete];
      return "";
    },
    cat: (args) => {
      if (!args.length) return "cat: missing file operand";
      const target = resolvePath(currentPath, args[0]);
      const node = getDirNode(target);
      if (!node) return `cat: ${args[0]}: No such file or directory`;
      if (node.type !== "file") return `cat: ${args[0]}: Is a directory`;
      return node.content;
    },
    nano: (args) => {
      if (!args.length) return "nano: missing filename";
      nanoFile = resolvePath(currentPath, args[0]);
      const node = getDirNode(nanoFile);
      if (node && node.type === "dir") return `nano: ${args[0]} is a directory`;
      mode = "editor";
      nanoContent = node ? node.content.split("\n") : [];
      outputEl.innerHTML = "";
      printLine(
        `GNU nano - File: ${nanoFile}\n==========\n[Type your text. Hit Ctrl+X to SAVE and EXIT]\n`,
      );
      nanoContent.forEach((line) => printLine(line));
      return "";
    },
    color: (args) => {
      if (!args.length)
        return "color: missing color value (e.g. #00ff00, red, yellow)";
      if (args[0].toLowerCase() === "rainbow") {
        setRainbow(true);
        return "Spectrum unlocked. Try color red to return home.";
      }
      let val = args[0];
      let customVal = val;
      if (val === "red") customVal = "rgb(255, 51, 51)";
      else if (val === "green") customVal = "rgb(0, 255, 0)";
      else if (val === "blue") customVal = "rgb(0, 100, 255)";
      else if (val === "white") customVal = "rgb(255, 255, 255)";
      else if (val === "black") customVal = "rgb(0, 0, 0)";
      else if (val === "yellow") customVal = "rgb(255, 255, 0)";

      const temp = document.createElement("div");
      temp.style.color = customVal;
      if (temp.style.color === "") return `color: invalid color '${val}'`;

      document.body.appendChild(temp);
      const computed = getComputedStyle(temp).color;
      document.body.removeChild(temp);

      const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return `color: failed to parse color '${val}'`;

      setThemeRGB(`${match[1]}, ${match[2]}, ${match[3]}`);
      updateFavicon(currentThemeRGB);
      return "Theme color updated.";
    },
    crt: () => {
      const on = !isCrtEnabled();
      setCrtEnabled(on);
      return `CRT ${on ? "online" : "offline"}.`;
    },
    echo: (args) => args.join(" "),
    matrix: () => toggleMatrixRain(),
    about: () => {
      spawnWindow("about");
      return "";
    },
    clock: () => {
      spawnWindow("clock");
      return "";
    },
    guestbook: () => {
      spawnWindow("guestbook");
      return "";
    },
    socials: () => {
      spawnWindow("socials");
      return "";
    },
    shortcuts: () => {
      spawnWindow("shortcuts-help");
      return "";
    },
    terminal: () => {
      spawnWindow("terminal");
      return "";
    },
    tesseract: () => {
      spawnWindow("tesseract");
      return "";
    },
    shapelab: () => {
      spawnWindow("shapelab");
      return "";
    },
    calc: () => {
      spawnWindow("calculator");
      return "";
    },
    calculator: () => {
      spawnWindow("calculator");
      return "";
    },
    background: () => {
      spawnWindow("background");
      return "";
    },
    music: () => {
      spawnWindow("music");
      return "";
    },
  };

  printLine(
    'Welcome to OS_MAN [Version 2.0.1]\nA browser playground. Files here last until you reload.\n\nType "help" for a list of available commands.\n',
  );

  inputEl.addEventListener("keydown", async function (e) {
    if (e.altKey) return; // let WM shortcuts bubble

    if (mode === "editor") {
      if (e.ctrlKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        if (this.value) nanoContent.push(this.value);
        const lastSlash = nanoFile.lastIndexOf("/");
        const parentPath =
          lastSlash === 0 ? "/" : nanoFile.substring(0, lastSlash);
        const fileName = nanoFile.substring(lastSlash + 1);
        const parentNode = getDirNode(parentPath);
        if (parentNode && parentNode.type === "dir") {
          parentNode.contents[fileName] = {
            type: "file",
            content: nanoContent.join("\n"),
          };
        }
        mode = "shell";
        outputEl.innerHTML = "";
        printLine(`Saved ${nanoFile}`);
        this.value = "";
        return;
      }
      if (e.key === "Enter") {
        nanoContent.push(this.value);
        printLine(this.value);
        this.value = "";
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const val = this.value.trim();
      printLine(val, true);
      if (val) {
        commandHistory.push(val);
        historyIndex = commandHistory.length;
        const parts = val.split(" ");
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        if (cmds[cmd]) {
          try {
            let result = cmds[cmd](args);
            if (result instanceof Promise) {
              this.disabled = true;
              result = await result;
            }
            if (result) printLine(result);
          } catch (error) {
            printLine(error.message || "Command failed. Try again.");
          } finally {
            const wasDisabled = this.disabled;
            this.disabled = false;
            if (wasDisabled && this.isConnected)
              this.focus({ preventScroll: true });
          }
        } else {
          printLine(`${cmd}: command not found`);
        }
      }
      this.value = "";
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        this.value = commandHistory[historyIndex];
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        this.value = commandHistory[historyIndex];
      } else {
        historyIndex = commandHistory.length;
        this.value = "";
      }
    }
  });

  return { printLine, cmds };
}
