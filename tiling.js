/* ================================================================
   tiling.js – Binary-split dwindle tiling tree (Hyprland style)
   ================================================================ */

import { isMobile } from "./config.js";

// ─── Tree Nodes ─────────────────────────────────────────────────

export function makeLeaf(windowId) {
  return { type: "leaf", windowId };
}

function makeBranch(split, a, b, ratio = 0.5) {
  return { type: "branch", split, children: [a, b], ratio };
}

// ─── Tiling State ───────────────────────────────────────────────

let treeRoot = null;

export function getTreeRoot() {
  return treeRoot;
}
export function setTreeRoot(r) {
  treeRoot = r;
}

// ─── Depth & Split Direction ────────────────────────────────────

function getDepth(root, targetId) {
  function _search(node, depth) {
    if (!node) return -1;
    if (node.type === "leaf") return node.windowId === targetId ? depth : -1;
    const left = _search(node.children[0], depth + 1);
    if (left >= 0) return left;
    return _search(node.children[1], depth + 1);
  }
  return _search(root, 0);
}

function decideSplitAtDepth(depth) {
  if (isMobile) return depth % 2 === 0 ? "v" : "h";
  return depth % 2 === 0 ? "h" : "v";
}

// ─── Insert / Remove ────────────────────────────────────────────

function findLastLeaf(node) {
  if (node.type === "leaf") return node.windowId;
  return findLastLeaf(node.children[1]);
}

function _insertAt(parent, childIdx, node, targetId, newLeaf, split) {
  if (node.type === "leaf") {
    if (node.windowId === targetId) {
      const branch = makeBranch(split, { ...node }, newLeaf);
      if (!parent) {
        treeRoot = branch;
      } else {
        parent.children[childIdx] = branch;
      }
      return true;
    }
    return false;
  }
  const { children } = node;
  if (_insertAt(node, 0, children[0], targetId, newLeaf, split)) return true;
  return _insertAt(node, 1, children[1], targetId, newLeaf, split);
}

export function insertLeaf(newLeaf, focusedId) {
  if (!treeRoot) {
    treeRoot = newLeaf;
    return;
  }
  const targetId = focusedId || findLastLeaf(treeRoot);
  const depth = getDepth(treeRoot, targetId);
  const split = decideSplitAtDepth(depth);
  _insertAt(null, null, treeRoot, targetId, newLeaf, split);
}

function _insertNextTo(
  parent,
  childIdx,
  node,
  targetId,
  newLeaf,
  splitDir,
  position,
) {
  if (node.type === "leaf") {
    if (node.windowId === targetId) {
      const first = position === "before" ? newLeaf : { ...node };
      const second = position === "before" ? { ...node } : newLeaf;
      const branch = makeBranch(splitDir, first, second);
      if (!parent) {
        treeRoot = branch;
      } else {
        parent.children[childIdx] = branch;
      }
      return true;
    }
    return false;
  }
  const { children } = node;
  if (
    _insertNextTo(node, 0, children[0], targetId, newLeaf, splitDir, position)
  )
    return true;
  return _insertNextTo(
    node,
    1,
    children[1],
    targetId,
    newLeaf,
    splitDir,
    position,
  );
}

export function insertLeafNextTo(newLeaf, targetId, splitDir, position) {
  if (!treeRoot) {
    treeRoot = newLeaf;
    return;
  }
  _insertNextTo(null, null, treeRoot, targetId, newLeaf, splitDir, position);
}

function _removeFrom(parent, childIdx, node, windowId) {
  if (node.type === "leaf") return false;
  for (let i = 0; i < 2; i++) {
    const child = node.children[i];
    if (child.type === "leaf" && child.windowId === windowId) {
      const sibling = node.children[1 - i];
      if (!parent) {
        treeRoot = sibling;
      } else {
        parent.children[childIdx] = sibling;
      }
      return true;
    }
    if (_removeFrom(node, i, child, windowId)) return true;
  }
  return false;
}

export function removeLeaf(windowId) {
  if (!treeRoot) return;
  if (treeRoot.type === "leaf" && treeRoot.windowId === windowId) {
    treeRoot = null;
    return;
  }
  _removeFrom(null, null, treeRoot, windowId);
}

// ─── Layout Math ────────────────────────────────────────────────

const gap = isMobile ? 6 : 10;

function splitRect(rect, split, ratio) {
  if (split === "h") {
    const w1 = rect.w * ratio - gap / 2;
    const w2 = rect.w * (1 - ratio) - gap / 2;
    return [
      { x: rect.x, y: rect.y, w: w1, h: rect.h },
      { x: rect.x + w1 + gap, y: rect.y, w: w2, h: rect.h },
    ];
  }
  const h1 = rect.h * ratio - gap / 2;
  const h2 = rect.h * (1 - ratio) - gap / 2;
  return [
    { x: rect.x, y: rect.y, w: rect.w, h: h1 },
    { x: rect.x, y: rect.y + h1 + gap, w: rect.w, h: h2 },
  ];
}

function _applyNode(node, rect, windows) {
  if (node.type === "leaf") {
    const win = windows[node.windowId];
    if (!win) return;
    const el = win.el;
    if (el.classList.contains("wm-fullscreen")) return;
    el.style.left = rect.x + "px";
    el.style.top = rect.y + "px";
    el.style.width = rect.w + "px";
    el.style.height = rect.h + "px";
    win.rect = rect;
    if (win.onResize) win.onResize(rect.w, rect.h);
    return;
  }
  const { split, ratio, children } = node;
  const [r0, r1] = splitRect(rect, split, ratio);
  _applyNode(children[0], r0, windows);
  _applyNode(children[1], r1, windows);
}

export function applyLayout(viewport, windows) {
  if (!treeRoot || innerWidth <= 700) return;
  const vp = { x: 0, y: 0, w: viewport.clientWidth, h: viewport.clientHeight };
  _applyNode(treeRoot, vp, windows);
}

export { gap as GAP };
