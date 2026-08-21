/**
 * Diff viewer settings, persisted across sessions (IDEA DiffSettings parity).
 * View mode / highlighting / soft wrap / font size are pure display settings;
 * the whitespace mode is NOT stored here — it changes hunk boundaries, so it
 * lives in the panel that fetches the diff (GitPanel) and is passed down.
 */

export type ViewMode = "side" | "unified";
export type HighlightMode = "line" | "word" | "char" | "none";

export interface DiffSettings {
  viewMode: ViewMode;
  highlight: HighlightMode;
  softWrap: boolean;
  fontSize: number;
}

const STORAGE_KEY = "dsh-git-ui.diff.settings";
const FONT_MIN = 11;
const FONT_MAX = 20;
const FONT_DEFAULT = 13;

const DEFAULTS: DiffSettings = {
  viewMode: "side",
  highlight: "word",
  softWrap: false,
  fontSize: FONT_DEFAULT
};

function clampFont(size: number): number {
  if (!Number.isFinite(size)) return FONT_DEFAULT;
  return Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(size)));
}

export function loadDiffSettings(): DiffSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<DiffSettings>;
    return {
      viewMode: parsed.viewMode === "unified" ? "unified" : "side",
      highlight:
        parsed.highlight === "line" || parsed.highlight === "char" || parsed.highlight === "none"
          ? parsed.highlight
          : "word",
      softWrap: parsed.softWrap === true,
      fontSize: clampFont(parsed.fontSize ?? FONT_DEFAULT)
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveDiffSettings(settings: DiffSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode etc.) — settings stay in-memory */
  }
}

export function adjustFontSize(current: number, delta: number): number {
  return clampFont(current + delta);
}
