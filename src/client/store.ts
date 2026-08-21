/**
 * Module-level UI store for the Git panel: open/collapsed state, the active
 * repository directory, and the latest status snapshot. Both slot occupants
 * (header action + dock panel) share it via useSyncExternalStore; no cordis
 * service or slot store seat is needed.
 */
import { useSyncExternalStore } from "react";
import type { RepoStatus } from "../types.js";

/** Tabs with a user-resizable left list / right detail split. */
export type GitUiSplitTab = "changes" | "files" | "history";

export interface GitUiSnapshot {
  open: boolean;
  dir: string;
  /**
   * When true the dir follows the current session's cwd (and the initial
   * localStorage value only seeds before the first session cwd arrives).
   * Any manual dir edit pins the choice and clears this flag.
   */
  followSession: boolean;
  status: RepoStatus | null;
  statusLoading: boolean;
  statusError: string | null;
  /** Business error code of statusError (e.g. "not-a-repo"), null when none. */
  statusErrorCode: string | null;
  /** Panel height in pixels — user-resizable, never auto-changes. */
  panelHeight: number;
  /** Left-list widths (px) per split tab — user-resizable, persisted. */
  splitWidths: Record<GitUiSplitTab, number>;
  /** Fullscreen overlay mode (covers the whole viewport). */
  fullscreen: boolean;
  /** Floating-window mode (detached from the composer dock). */
  floating: boolean;
  floatPos: { x: number; y: number };
  /** Floating window starts maximized on detach; drag/resize restores it. */
  floatMaximized: boolean;
  /** Floating-window width in pixels — user-resizable via the side handles. */
  floatWidth: number;
  /** Monotonic refresh counter — bump to force a reload. */
  revision: number;
}

const DIR_KEY = "dsh-git-ui.dir";
/**
 * v2 key: the pre-v2 build wrote "0" (pinned) on every manual dir switch, so
 * browsers with that leftover were pinned by default. A fresh key makes the
 * default follow the session again; explicit pins use the new key.
 */
const FOLLOW_KEY = "dsh-git-ui.follow.v2";
const HEIGHT_KEY = "dsh-git-ui.height";
const WIDTH_KEY = "dsh-git-ui.width";
const FLOAT_KEY = "dsh-git-ui.float";
const POS_KEY = "dsh-git-ui.pos";
const SPLIT_KEY = "dsh-git-ui.splits";

const DEFAULT_HEIGHT = 320;
const MIN_HEIGHT = 240;
const MAX_HEIGHT = 720;
const DEFAULT_WIDTH = 760;
const MIN_WIDTH = 360;
const MAX_WIDTH = 1600;

/** Default left-list width per split tab (px); the CSS %-based fallback. */
export const SPLIT_DEFAULTS: Record<GitUiSplitTab, number> = {
  changes: 340,
  files: 320,
  history: 340
};
/** Narrowest the left list may be dragged to (px). */
export const SPLIT_MIN = 120;

function readNumber(key: string, fallback: number): number {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      const value = Number(saved);
      if (Number.isFinite(value)) return value;
    }
  } catch {
    /* storage unavailable */
  }
  return fallback;
}

function readPos(): { x: number; y: number } {
  try {
    const saved = localStorage.getItem(POS_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved) as { x?: number; y?: number };
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return { x: parsed.x, y: parsed.y };
      }
    }
  } catch {
    /* storage unavailable */
  }
  return { x: 96, y: 72 };
}

function initialFollow(): boolean {
  // Default is ON (follow the session cwd); "0" means the user pinned a dir.
  try {
    return localStorage.getItem(FOLLOW_KEY) !== "0";
  } catch {
    return true;
  }
}

function initialDir(): string {
  try {
    const saved = localStorage.getItem(DIR_KEY);
    if (saved !== null && saved !== "") return saved;
  } catch {
    /* storage unavailable */
  }
  return "";
}

function initialFloating(): boolean {
  try {
    return localStorage.getItem(FLOAT_KEY) === "1";
  } catch {
    return false;
  }
}

function readSplits(): Record<GitUiSplitTab, number> {
  const out = { ...SPLIT_DEFAULTS };
  try {
    const saved = localStorage.getItem(SPLIT_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved) as Partial<Record<GitUiSplitTab, unknown>>;
      for (const key of ["changes", "files", "history"] as const) {
        const value = parsed[key];
        if (typeof value === "number" && Number.isFinite(value)) {
          out[key] = Math.round(value);
        }
      }
    }
  } catch {
    /* storage unavailable */
  }
  return out;
}

let snapshot: GitUiSnapshot = {
  open: false,
  dir: initialDir(),
  followSession: initialFollow(),
  status: null,
  statusLoading: false,
  statusError: null,
  statusErrorCode: null,
  panelHeight: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, readNumber(HEIGHT_KEY, DEFAULT_HEIGHT))),
  splitWidths: readSplits(),
  fullscreen: false,
  floating: initialFloating(),
  floatPos: readPos(),
  floatMaximized: false,
  floatWidth: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, readNumber(WIDTH_KEY, DEFAULT_WIDTH))),
  revision: 0
};

const listeners = new Set<() => void>();

function set(patch: Partial<GitUiSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

export function getGitUiSnapshot(): GitUiSnapshot {
  return snapshot;
}

export function subscribeGitUi(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useGitUi(): GitUiSnapshot {
  return useSyncExternalStore(subscribeGitUi, getGitUiSnapshot);
}

export function gitUiSetOpen(open: boolean): void {
  set({ open });
}

/** Manual dir switch is a temporary view: the pin is cleared, so the panel
 * follows the session again unless the user explicitly re-pins. */
export function gitUiSetDir(dir: string): void {
  const normalized = dir.trim();
  set({ dir: normalized, status: null, statusError: null, statusErrorCode: null, followSession: true });
  try {
    if (normalized === "") localStorage.removeItem(DIR_KEY);
    else localStorage.setItem(DIR_KEY, normalized);
    localStorage.removeItem(FOLLOW_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Session-cwd follower: updates dir without clearing the follow flag. */
export function gitUiFollowCwd(cwd: string): void {
  const normalized = cwd.trim();
  if (normalized === "" || normalized === snapshot.dir) return;
  set({ dir: normalized, status: null, statusError: null, statusErrorCode: null });
}

/** Re-enable session following; the panel effect applies the current cwd.
 *  Persisted so a page reload does not silently unpin a manual dir. */
export function gitUiSetFollowSession(follow: boolean): void {
  set({ followSession: follow });
  try {
    if (follow) localStorage.removeItem(FOLLOW_KEY);
    else localStorage.setItem(FOLLOW_KEY, "0");
  } catch {
    /* storage unavailable */
  }
}

export function gitUiSetStatus(
  status: RepoStatus | null,
  error: string | null,
  errorCode: string | null = null
): void {
  set({
    status,
    statusError: error,
    statusErrorCode: errorCode,
    statusLoading: false,
    revision: snapshot.revision + 1
  });
}

export function gitUiSetStatusLoading(loading: boolean): void {
  set({ statusLoading: loading });
}

/** Clamp + persist a split-tab left-list width (double-click resets). */
export function gitUiSetSplitWidth(tab: GitUiSplitTab, width: number): void {
  const clamped = Math.max(SPLIT_MIN, Math.round(width));
  const splitWidths = { ...snapshot.splitWidths, [tab]: clamped };
  set({ splitWidths });
  try {
    localStorage.setItem(SPLIT_KEY, JSON.stringify(splitWidths));
  } catch {
    /* storage unavailable */
  }
}

/** Clamp + persist the user-resized panel height. */
export function gitUiSetPanelHeight(height: number): void {
  const clamped = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height)));
  set({ panelHeight: clamped });
  try {
    localStorage.setItem(HEIGHT_KEY, String(clamped));
  } catch {
    /* storage unavailable */
  }
}

export function gitUiSetFullscreen(fullscreen: boolean): void {
  set({ fullscreen });
}

export function gitUiSetFloating(floating: boolean): void {
  // Every detach starts maximized; the saved geometry is kept for the restore.
  set({ floating, floatMaximized: floating });
  try {
    if (floating) localStorage.setItem(FLOAT_KEY, "1");
    else localStorage.removeItem(FLOAT_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Restore the floating window from its maximized state (drag/resize). */
export function gitUiSetFloatMaximized(maximized: boolean): void {
  set({ floatMaximized: maximized });
}

export function gitUiSetFloatPos(x: number, y: number): void {
  set({ floatPos: { x, y } });
  try {
    localStorage.setItem(POS_KEY, JSON.stringify({ x, y }));
  } catch {
    /* storage unavailable */
  }
}

/** Clamp + persist the user-resized floating-window width. */
export function gitUiSetFloatWidth(width: number): void {
  const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
  set({ floatWidth: clamped });
  try {
    localStorage.setItem(WIDTH_KEY, String(clamped));
  } catch {
    /* storage unavailable */
  }
}

export {
  MIN_HEIGHT as GIT_UI_MIN_HEIGHT,
  MAX_HEIGHT as GIT_UI_MAX_HEIGHT,
  MIN_WIDTH as GIT_UI_MIN_WIDTH,
  MAX_WIDTH as GIT_UI_MAX_WIDTH
};
