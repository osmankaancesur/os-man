// A small arithmetic parser: expressions never execute JavaScript.
export function evaluateArithmetic(source) {
  const tokens =
    source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\*\*|[()+*/%\-]/gi) ||
    [];
  if (tokens.join("") !== source.replace(/\s/g, "")) return null;
  let index = 0;
  function atom() {
    const t = tokens[index++];
    if (t === "+" || t === "-") {
      const n = atom();
      return t === "-" ? -n : n;
    }
    if (t === "(") {
      const n = expression(0);
      if (tokens[index++] !== ")") throw Error();
      return n;
    }
    if (!t || !/^\d|^\./.test(t)) throw Error();
    return Number(t);
  }
  const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "**": 3 };
  function expression(min) {
    let left = atom();
    while (precedence[tokens[index]] >= min) {
      const op = tokens[index++],
        p = precedence[op],
        right = expression(p + (op === "**" ? 0 : 1));
      left =
        op === "+"
          ? left + right
          : op === "-"
            ? left - right
            : op === "*"
              ? left * right
              : op === "/"
                ? left / right
                : op === "%"
                  ? left % right
                  : left ** right;
    }
    return left;
  }
  try {
    const result = expression(0);
    return index === tokens.length && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
