/** Strip string/char literals before counting braces (conservative heuristic). */
export function stripJavaStringLiterals(line: string): string {
  return line
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

export function countBraces(line: string): { open: number; close: number } {
  const stripped = stripJavaStringLiterals(line);
  let open = 0;
  let close = 0;
  for (const char of stripped) {
    if (char === "{") {
      open++;
    } else if (char === "}") {
      close++;
    }
  }
  return { open, close };
}

/**
 * Returns lines belonging to the innermost `{ ... }` block that contains {@code lineIndex}.
 * Used to limit look-ahead/look-behind hardening checks to the enclosing method body.
 */
export function getMethodBlockLines(lines: string[], lineIndex: number): string[] {
  if (lines.length === 0) {
    return [];
  }

  const index = Math.min(Math.max(lineIndex, 0), lines.length - 1);
  let start = index;
  let backwardDepth = 0;

  for (let i = index; i >= 0; i--) {
    const { open, close } = countBraces(lines[i]);
    backwardDepth += close;
    backwardDepth -= open;
    if (backwardDepth > 0) {
      backwardDepth = 0;
      start = i;
    }
    if (backwardDepth < 0) {
      start = i;
      break;
    }
  }

  let forwardDepth = 0;
  for (let i = start; i < lines.length; i++) {
    const { open, close } = countBraces(lines[i]);
    forwardDepth += open;
    forwardDepth -= close;
    if (forwardDepth === 0 && i >= index) {
      return lines.slice(start, i + 1);
    }
  }

  return lines.slice(start);
}
