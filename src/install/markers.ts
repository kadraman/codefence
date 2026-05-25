export const MARKER_START = "<!-- codefence-guardrails:start -->";
export const MARKER_END = "<!-- codefence-guardrails:end -->";

const LEGACY_MARKER_PAIRS: ReadonlyArray<{ start: string; end: string }> = [
  { start: "<!-- codefence:start -->", end: "<!-- codefence:end -->" }
];

/** Upgrade legacy install markers so re-install replaces the old block instead of appending. */
function normalizeLegacyMarkers(content: string): string {
  let normalized = content;
  for (const { start, end } of LEGACY_MARKER_PAIRS) {
    normalized = normalized.replaceAll(start, MARKER_START).replaceAll(end, MARKER_END);
  }
  return normalized;
}

export type MergeAction = "created" | "updated" | "appended" | "unchanged";

export function hasMarkedBlock(content: string): boolean {
  const normalized = normalizeLegacyMarkers(content);
  return normalized.includes(MARKER_START) && normalized.includes(MARKER_END);
}

export function extractMarkedBlock(content: string): string | null {
  const normalized = normalizeLegacyMarkers(content);
  const start = normalized.indexOf(MARKER_START);
  const end = normalized.indexOf(MARKER_END);
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  return normalized.slice(start, end + MARKER_END.length);
}

/** Insert or replace the marked codefence guardrails block without touching other content. */
export function mergeMarkedBlock(existing: string, fragment: string): { content: string; action: MergeAction } {
  const block = fragment.trim();
  if (!hasMarkedBlock(block)) {
    throw new Error("Install fragment must include codefence-guardrails markers");
  }

  if (!existing.trim()) {
    return { content: `${block}\n`, action: "created" };
  }

  const normalizedExisting = normalizeLegacyMarkers(existing);

  if (hasMarkedBlock(normalizedExisting)) {
    const before = normalizedExisting.slice(0, normalizedExisting.indexOf(MARKER_START));
    const after = normalizedExisting.slice(
      normalizedExisting.indexOf(MARKER_END) + MARKER_END.length
    );
    const next = `${before}${block}${after}`.replace(/\n{3,}/g, "\n\n");
    const unchanged = extractMarkedBlock(normalizedExisting)?.trim() === block;
    return { content: next, action: unchanged ? "unchanged" : "updated" };
  }

  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  return { content: `${existing}${separator}${block}\n`, action: "appended" };
}
