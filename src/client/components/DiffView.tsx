/**
 * Line-level diff viewer and the commit form.
 *
 * The diff renders FORWARD unified output (old → new) into two columns:
 * HEAD on the left, working tree on the right (IDEA orientation). The
 * optional `reversed` flag swaps them for embedders that need the opposite,
 * while the hunk indices stay byte-identical to the forward patch that
 * stageHunks / revertHunks rebuild.
 *
 * Interactive mode (Changes panel) adds: a whitespace-ignore toggle, per-hunk
 * stage/revert actions, hunk commit checkboxes (partial commit), unchanged-
 * fragment folding, and next/previous hunk navigation.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeRef, DiffFile, DiffHunk, DiffLine, WsFlags } from "../../types.js";
import { NO_WS_FLAGS } from "../../types.js";
import type { GitApi } from "../api.js";
import { Toast } from "./Toast.js";
import {
  adjustFontSize,
  loadDiffSettings,
  saveDiffSettings,
  type DiffSettings,
  type HighlightMode,
  type ViewMode
} from "../diffSettings.js";
import {
  COLLAPSE_MIN,
  buildSideLayout,
  diffWords,
  splitLayoutParts,
  type BlockInfo,
  type LayoutPart,
  type SideLine,
  type WordSeg
} from "../diffLayout.js";

export interface GitUiT {
  (key: string, params?: Record<string, unknown>): string;
}

/** File extensions that get an in-diff image preview (IDEA binary viewer). */
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i;

// ── side-by-side layout model ───────────────────────────────────────────────
// The canonical per-hunk layout (SideLine / BlockRow / BlockInfo / LayoutItem)
// lives in ../diffLayout.ts (pure, unit-tested). buildSideLayout() pairs
// deleted/added lines by block-local index from the Myers edit script (hunk
// line numbers); the renderer only consumes LayoutPart sequences from
// splitLayoutParts(). Rows are NEVER paired across columns by physical row
// number or DOM order.

interface Cell {
  no?: number;
  text: string;
  /** old = left content of a change (red), new = right content (green). */
  kind: "ctx" | "old" | "new";
  /** Word segments for changed cells (undefined = plain text). */
  segs?: WordSeg[];
}

// ── IDEA unified view ───────────────────────────────────────────────────────

interface UnifiedRow {
  marker: "+" | "-" | " ";
  oldNo?: number;
  newNo?: number;
  text: string;
  kind: "ctx" | "old" | "new";
  /** Word segments for paired changed rows (undefined = plain text). */
  segs?: WordSeg[];
}

/**
 * Build the IDEA unified layout from a hunk: context lines occupy one row;
 * deleted and added lines are paired block-wise (deleted row first, then the
 * added row), with intra-line highlights on paired changed rows. Pure
 * deletions/insertions get no word-level segments, like IDEA.
 */
function buildUnifiedRows(
  hunk: DiffHunk,
  granularity: "word" | "char",
  withIntra: boolean
): UnifiedRow[] {
  const rows: UnifiedRow[] = [];
  const dels: DiffLine[] = [];
  const adds: DiffLine[] = [];
  const flush = (): void => {
    const count = Math.max(dels.length, adds.length);
    for (let i = 0; i < count; i++) {
      const del = dels[i];
      const add = adds[i];
      const paired = withIntra && del !== undefined && add !== undefined && del.text !== add.text;
      if (del !== undefined) {
        rows.push({
          marker: "-",
          oldNo: del.oldNo,
          text: del.text,
          kind: "old",
          segs: paired ? diffWords(del.text, add.text as string, granularity).left : undefined
        });
      }
      if (add !== undefined) {
        rows.push({
          marker: "+",
          newNo: add.newNo,
          text: add.text,
          kind: "new",
          segs: paired ? diffWords(del.text as string, add.text, granularity).right : undefined
        });
      }
    }
    dels.length = 0;
    adds.length = 0;
  };
  for (const line of hunk.lines) {
    if (line.type === "ctx") {
      flush();
      rows.push({ marker: " ", oldNo: line.oldNo, newNo: line.newNo, text: line.text, kind: "ctx" });
    } else if (line.type === "del") {
      dels.push(line);
    } else {
      adds.push(line);
    }
  }
  flush();
  return rows;
}

/** Row class for one side's cell: whole change blocks share one type color. */
const sideRowClass = (line: SideLine, changeKind: BlockInfo["changeKind"] | undefined): string => {
  if (line.kind === "ctx" || changeKind === undefined) return "gitui-diff-cell";
  if (changeKind === "mod") return "gitui-diff-cell gitui-cell-mod";
  if (changeKind === "add") return "gitui-diff-cell gitui-cell-add";
  return "gitui-diff-cell gitui-cell-del";
};

interface EditLine {
  /** Working-tree line number of the edited cell (1-based, for write-back). */
  newNo: number;
  /** Input changed: schedule a debounced write-back. */
  onInput: (text: string) => void;
  /** Editing ended: flush the write-back and refresh the diff. */
  onBlur: (text: string) => void;
}

function renderText(cell: Cell, t: GitUiT, edit?: EditLine): JSX.Element {
  const editable = edit !== undefined;
  const className = editable ? "gitui-diff-text gitui-diff-editable" : "gitui-diff-text";
  const readText = (el: HTMLElement): string => (el.textContent ?? "").replace(/\u00a0/g, " ");
  const textOf = (): string => (cell.text === "" ? "\u00a0" : cell.text);
  const segs = cell.segs;
  const children =
    segs === undefined || segs.length === 0 ? (
      textOf()
    ) : (
      segs.map((seg, index) =>
        seg.t === "eq" ? (
          <span key={index}>{seg.s === "" ? (editable ? "\u00a0" : " ") : seg.s}</span>
        ) : (
          <span key={index} className={cell.kind === "old" ? "gitui-diff-word-del" : "gitui-diff-word-add"}>
            {seg.s === "" ? (editable ? "\u00a0" : " ") : seg.s}
          </span>
        )
      )
    );
  return (
    <span
      className={className}
      {...(editable
        ? {
            contentEditable: true,
            suppressContentEditableWarning: true,
            spellCheck: false,
            onInput: (event: React.FormEvent<HTMLSpanElement>) => {
              edit.onInput(readText(event.currentTarget));
            },
            onBlur: (event: React.FocusEvent<HTMLSpanElement>) => {
              edit.onBlur(readText(event.currentTarget));
            },
            onKeyDown: (event: React.KeyboardEvent<HTMLSpanElement>) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.currentTarget.textContent = cell.text;
                event.currentTarget.blur();
              }
            }
          }
        : {})}
    >
      {children}
    </span>
  );
}

// ── toolbar dropdown ────────────────────────────────────────────────────────

interface DropdownOption {
  value: string;
  label: string;
}

/**
 * Compact toolbar dropdown (view mode / whitespace / highlight selectors).
 * Click-outside and Escape close it, like IDEA's popup selectors.
 */
function Dropdown(props: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  title?: string;
}): JSX.Element {
  const { label, value, options, onChange, disabled = false, title } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="gitui-dd" ref={ref}>
      <button
        type="button"
        className="gitui-dd-btn"
        disabled={disabled}
        title={title}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="gitui-dd-label">{label}</span>
        <span className="gitui-dd-caret">▾</span>
      </button>
      {open && (
        <div className="gitui-dd-menu" role="menu">
          {options.map((option) => (
            <div
              key={option.value}
              role="menuitem"
              className={
                "gitui-dd-item" + (option.value === value ? " gitui-dd-item-sel" : "")
              }
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Whitespace flags dropdown: independent toggles (Trim whitespaces /
 * Ignore whitespaces / Ignore empty lines), like IDEA's selector but
 * combinable. Stays open while ticking so several flags can be switched.
 */
function WsFlagsDropdown(props: {
  flags: WsFlags;
  disabled?: boolean;
  onChange: (flags: WsFlags) => void;
  t: GitUiT;
}): JSX.Element {
  const { flags, disabled = false, onChange, t } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items: Array<{ key: "trimEol" | "ignoreWs" | "ignoreBlank"; label: string }> = [
    { key: "trimEol", label: t("diff.ws.trimEol") },
    { key: "ignoreWs", label: t("diff.ws.ignoreWs") },
    { key: "ignoreBlank", label: t("diff.ws.ignoreBlank") }
  ];
  const active = items.filter((item) => flags[item.key] === true).map((item) => item.label);
  const label = active.length === 0 ? t("diff.ws.none") : active.join(" · ");
  const toggle = (key: "trimEol" | "ignoreWs" | "ignoreBlank"): void => {
    onChange({ ...flags, [key]: !flags[key] });
  };

  return (
    <div className="gitui-dd" ref={ref}>
      <button
        type="button"
        className="gitui-dd-btn"
        disabled={disabled}
        title={t("diff.wsModeHint")}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="gitui-dd-label">{label}</span>
        <span className="gitui-dd-caret">▾</span>
      </button>
      {open && (
        <div className="gitui-dd-menu gitui-dd-menu-ws" role="menu">
          {items.map((item) => (
            <div
              key={item.key}
              role="menuitem"
              className={"gitui-dd-item" + (flags[item.key] === true ? " gitui-dd-item-sel" : "")}
              onClick={() => toggle(item.key)}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const HL_OPTIONS: DropdownOption[] = [
  { value: "line", label: "Highlight lines" },
  { value: "word", label: "Highlight words" },
  { value: "char", label: "Highlight characters" },
  { value: "none", label: "Do not highlight" }
];

const VIEW_OPTIONS: DropdownOption[] = [
  { value: "side", label: "Side-by-side viewer" },
  { value: "unified", label: "Unified viewer" }
];

type UnifiedPart =
  | { kind: "row"; row: UnifiedRow }
  | { kind: "fold"; key: string; count: number };

/** Foldable parts for the unified layout (context rows are foldable). */
function splitUnifiedParts(
  rows: UnifiedRow[],
  hunkIndex: number,
  expanded: Set<string>
): UnifiedPart[] {
  const parts: UnifiedPart[] = [];
  let ctxRun: UnifiedRow[] = [];
  let rowCursor = 0;
  const flushCtx = (): void => {
    if (ctxRun.length > 0) {
      if (ctxRun.length >= COLLAPSE_MIN) {
        const key = "u" + hunkIndex + ":r" + (rowCursor - ctxRun.length);
        if (!expanded.has(key)) {
          parts.push({ kind: "fold", key, count: ctxRun.length });
          ctxRun = [];
          return;
        }
      }
      for (const row of ctxRun) parts.push({ kind: "row", row });
      ctxRun = [];
    }
  };
  for (const row of rows) {
    if (row.kind === "ctx") {
      ctxRun.push(row);
    } else {
      flushCtx();
      parts.push({ kind: "row", row });
    }
    rowCursor++;
  }
  flushCtx();
  return parts;
}

/** One unified row: marker column, old/new line numbers, tinted text. */
function renderUnifiedRow(row: UnifiedRow, t: GitUiT): JSX.Element {
  const cell: Cell = { text: row.text, kind: row.kind, segs: row.segs };
  return (
    <div
      className={
        "gitui-diff-cell gitui-diff-cell-u" +
        (row.kind === "old" ? " gitui-cell-del" : row.kind === "new" ? " gitui-cell-add" : "")
      }
    >
      <div className="gitui-diff-cell-content">
        <div className="gitui-diff-cell-inner">
          <span className={"gitui-diff-marker gitui-diff-marker-" + row.marker}>{row.marker}</span>
          <span className="gitui-diff-no">{row.oldNo ?? ""}</span>
          <span className="gitui-diff-no gitui-diff-no-new">{row.newNo ?? ""}</span>
          {renderText(cell, t)}
        </div>
      </div>
    </div>
  );
}
/** Result of loading a file's edit baseline (lines + EOL, or why not). */
interface BaselineResult {
  base: { lines: string[]; eol: string } | null;
  blocked: string | null;
}

export function DiffView(props: {
  file: DiffFile | null;
  t: GitUiT;
  /** Column captions above the diff (e.g. "HEAD" / "Working Tree"). */
  leftLabel?: string;
  rightLabel?: string;
  /** Swap columns: render the NEW side on the left (worktree-first view). */
  reversed?: boolean;
  /** Interactive mode (Changes panel): toolbar + hunk actions + checkboxes. */
  interactive?: boolean;
  api?: GitApi;
  dir?: string;
  path?: string;
  /** Whitespace flags the displayed diff was fetched with (independent toggles). */
  wsFlags?: WsFlags;
  onWsFlagsChange?: (next: WsFlags) => void;
  /** File already has staged changes (hunk stage disabled). */
  hasStagedChanges?: boolean;
  /** Git refs for binary previews: left/right side ("HEAD" or a hash; omitted = working tree). */
  imageRefs?: { left?: string; right?: string };
  /** Hunk operations unavailable (untracked file / unborn HEAD). */
  hunkOpsDisabled?: boolean;
  hunkOpsDisabledReason?: string;
  /** Partial-commit checkboxes: hunk indices the user un-checked. */
  uncheckedHunks?: Set<number>;
  onToggleHunk?: (hunkIndex: number) => void;
  /** Called after a successful hunk/file operation (refresh + reload). */
  onChanged?: () => void;
  /** Owner-set handle: awaited before menu mutations so inline writes land first. */
  flushRef?: { current: (() => Promise<void>) | null };
}): JSX.Element {
  const {
    file, t, leftLabel, rightLabel, reversed = false, interactive = false,
    api, dir, path, wsFlags = NO_WS_FLAGS, onWsFlagsChange,
    hasStagedChanges = false, hunkOpsDisabled = false, hunkOpsDisabledReason,
    uncheckedHunks, onToggleHunk, onChanged, imageRefs, flushRef
  } = props;

  // Viewer display settings (persisted; whitespace mode is owned by the panel).
  const [settings, setSettings] = useState<DiffSettings>(loadDiffSettings);
  const applySettings = (next: DiffSettings): void => {
    setSettings(next);
    saveDiffSettings(next);
  };
  const { viewMode, highlight, softWrap, fontSize } = settings;
  /** Intra-line granularity derived from the highlight mode. */
  const granularity: "word" | "char" = highlight === "char" ? "char" : "word";
  /** Whether intra-line highlights are rendered at all. */
  const showIntra = highlight === "word" || highlight === "char";

  // Binary image preview: fetch both sides as object URLs.
  const [imageUrls, setImageUrls] = useState<{ left: string | null; right: string | null }>({
    left: null,
    right: null
  });
  const canPreviewImage =
    file !== null && file.binary && api !== undefined && dir !== "" && IMAGE_EXT.test(file.path);
  useEffect(() => {
    if (!canPreviewImage || api === undefined || file === null || dir === undefined) return;
    let alive = true;
    const urls: string[] = [];
    const load = async (ref: string | undefined, key: "left" | "right"): Promise<void> => {
      try {
        const result = await api.binaryContent(dir, file.path, ref);
        const bytes = Uint8Array.from(atob(result.base64), (ch) => ch.charCodeAt(0));
        const url = URL.createObjectURL(
          new Blob([bytes], { type: result.mime })
        );
        urls.push(url);
        if (alive) setImageUrls((prev) => ({ ...prev, [key]: url }));
      } catch {
        /* preview unavailable for this side */
      }
    };
    void load(imageRefs?.left, "left");
    void load(imageRefs?.right, "right");
    return () => {
      alive = false;
      for (const url of urls) URL.revokeObjectURL(url);
      setImageUrls({ left: null, right: null });
    };
  }, [canPreviewImage, api, dir, file, imageRefs]);

  const [foldExpanded, setFoldExpanded] = useState<Set<string>>(new Set());
  /** Bumped when fonts finish loading so row metrics re-measure at final metrics. */
  const [fontsTick, setFontsTick] = useState(0);
  const [opBusy, setOpBusy] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  /** Brief "saved" feedback after a debounced inline edit lands. */
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Reversible inline edits: per-path map of original text per line, recorded
   *  on first save. Path-keyed so a stale queued write from a previously
   *  edited file cannot pollute the new file's restore history. */
  const originalByLineRef = useRef<Map<string, Map<number, string>>>(new Map());
  const [editedCount, setEditedCount] = useState(0);
  const [restoredFlash, setRestoredFlash] = useState(false);
  const [currentHunk, setCurrentHunk] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);

  /**
   * IDEA diff behavior: the two columns have FIXED widths (50% each, aligned
   * with the side captions). Content scrolls INSIDE each column — the cell
   * background stays fixed (a short row that scrolls out of view still shows
   * its tinted background, never a blank gap) while a content layer inside
   * the cell scrolls. Every row's content layer shares the SAME width per
   * column (column width + that column's max overflow), so short rows scroll
   * in sync with long ones. A single scrollbar under the diff drives both
   * columns by the same amount.
   */
  const [colExtent, setColExtent] = useState<{ left: number; right: number } | null>(null);
  /** Max scrollable amount across both columns (drives the scrollbar width). */
  const [scrollMax, setScrollMax] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el === null || file === null) return;
    const measure = (): void => {
      // The line-number gutter is FIXED (outside the scrolling content layer),
      // so the content layer's visible width is the column minus the gutter.
      let baseL = 0;
      let baseR = 0;
      let maxL = 0;
      let maxR = 0;
      for (const content of el.querySelectorAll<HTMLElement>(".gitui-diff-col:first-child .gitui-diff-cell-content")) {
        baseL = content.clientWidth;
        const inner = content.firstElementChild as HTMLElement | null;
        if (inner !== null) maxL = Math.max(maxL, inner.scrollWidth - content.clientWidth);
      }
      for (const content of el.querySelectorAll<HTMLElement>(".gitui-diff-col:last-child .gitui-diff-cell-content")) {
        baseR = content.clientWidth;
        const inner = content.firstElementChild as HTMLElement | null;
        if (inner !== null) maxR = Math.max(maxR, inner.scrollWidth - content.clientWidth);
      }
      if (baseL === 0) baseL = Math.max(1, Math.floor(el.clientWidth / 2));
      if (baseR === 0) baseR = baseL;
      const next = { left: baseL + maxL, right: baseR + maxR };
      setColExtent((prev) =>
        prev !== null && prev.left === next.left && prev.right === next.right ? prev : next
      );
      const maxDelta = Math.max(maxL, maxR);
      setScrollMax((prev) => (prev === maxDelta ? prev : maxDelta));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    let fontsTimer: ReturnType<typeof setTimeout> | undefined;
    if (document.fonts?.ready !== undefined) {
      void document.fonts.ready.then(() => {
        fontsTimer = setTimeout(measure, 50);
        setFontsTick((tick) => tick + 1);
      });
    }
    return () => {
      observer.disconnect();
      if (fontsTimer !== undefined) clearTimeout(fontsTimer);
    };
  }, [file, foldExpanded]);

  /**
   * Equal-height columns: both columns render the SAME row sequence (missing
   * block sides are blank pad cells), so index-pair their rows and stretch
   * the shorter of each pair to the taller one. Soft wrap can make one side's
   * row taller; this keeps every row at the same y on both sides. A
   * ResizeObserver re-syncs when content heights change (guards prevent churn).
   */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el === null || file === null) return;
    const sync = (): void => {
      const leftCol = el.querySelector<HTMLElement>(".gitui-diff-col:first-child");
      const rightCol = el.querySelector<HTMLElement>(".gitui-diff-col:last-child");
      if (leftCol === null || rightCol === null) return;
      const rowSel = ".gitui-hunk-gap, .gitui-fold-row, .gitui-diff-cell";
      const leftRows = Array.from(leftCol.querySelectorAll<HTMLElement>(rowSel));
      const rightRows = Array.from(rightCol.querySelectorAll<HTMLElement>(rowSel));
      const n = Math.min(leftRows.length, rightRows.length);
      for (let i = 0; i < n; i++) {
        const h = Math.max(leftRows[i].offsetHeight, rightRows[i].offsetHeight);
        if (leftRows[i].offsetHeight !== h) leftRows[i].style.height = h + "px";
        if (rightRows[i].offsetHeight !== h) rightRows[i].style.height = h + "px";
      }
    };
    sync();
    const cols = el.querySelector<HTMLElement>(".gitui-diff-cols");
    if (cols !== null) {
      const observer = new ResizeObserver(sync);
      observer.observe(cols);
      return () => observer.disconnect();
    }
  }, [file, foldExpanded, softWrap, fontSize, fontsTick, colExtent]);



  /**
   * Keep the middle column's number strips in lockstep with the content
   * columns: each strip row mirrors the same row sequence, so heights are
   * copied 1:1 from the content cells (soft wrap makes rows taller). Runs
   * after layout; a ResizeObserver re-syncs when content heights change.
   */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el === null || file === null) return;
    const sync = (): void => {
      const pairs: Array<[string, string]> = [
        [".gitui-diff-col:first-child", ".gitui-diff-mid-ln"],
        [".gitui-diff-col:last-child", ".gitui-diff-mid-rn"]
      ];
      for (const [colSel, midSel] of pairs) {
        const col = el.querySelector<HTMLElement>(colSel);
        const mid = el.querySelector<HTMLElement>(midSel);
        if (col === null || mid === null) continue;
        // Same DOM order on both sides (no nesting of these classes), so the
        // simple selectors pair 1:1 without :scope (which is unreliable here).
        const colEls = Array.from(
          col.querySelectorAll<HTMLElement>(".gitui-hunk-gap, .gitui-fold-row, .gitui-diff-cell")
        );
        const midEls = Array.from(
          mid.querySelectorAll<HTMLElement>(".gitui-mid-head, .gitui-mid-fold, .gitui-mid-row")
        );
        const n = Math.min(colEls.length, midEls.length);
        for (let i = 0; i < n; i++) {
          const h = colEls[i].offsetHeight;
          if (midEls[i].offsetHeight !== h) midEls[i].style.height = h + "px";
        }
      }
    };
    sync();
    const cols = el.querySelector<HTMLElement>(".gitui-diff-cols");
    if (cols !== null) {
      const observer = new ResizeObserver(sync);
      observer.observe(cols);
      return () => observer.disconnect();
    }
  }, [file, foldExpanded, softWrap, fontSize, fontsTick, colExtent]);

  // One scrollbar drives every content layer of both columns by the same
  // amount (browsers clamp each layer to its own range).
  useEffect(() => {
    const bar = scrollbarRef.current;
    const el = scrollRef.current;
    if (bar === null || el === null) return;
    const onBarScroll = (): void => {
      const x = bar.scrollLeft;
      for (const layer of el.querySelectorAll<HTMLElement>(".gitui-diff-cell-content")) {
        layer.scrollLeft = x;
      }
    };
    bar.addEventListener("scroll", onBarScroll, { passive: true });
    return () => {
      bar.removeEventListener("scroll", onBarScroll);
    };
  }, [file, foldExpanded]);

  // F7 / Shift+F7: next / previous difference (IDEA navigation).
  useEffect(() => {
    if (!interactive) return;
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable === true) return;
      if (event.key === "F7") {
        event.preventDefault();
        const delta = event.shiftKey ? -1 : 1;
        setCurrentHunk((current) => {
          const total = file?.hunks.length ?? 1;
          const next = Math.max(0, Math.min(total - 1, current + delta));
          const el = scrollRef.current?.querySelector(`[data-hunk-index="${next}"]`);
          el?.scrollIntoView({ block: "nearest" });
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (file === null) {
    return <div className="gitui-diff-placeholder">{t("diff.noFile")}</div>;
  }
  if (file.binary) {
    if (canPreviewImage) {
      return (
        <div className="gitui-diff gitui-diff-images">
          {(leftLabel !== undefined || rightLabel !== undefined) && (
            <div className="gitui-diff-sides">
              <span className="gitui-diff-side">{leftLabel ?? ""}</span>
              <span className="gitui-diff-side">{rightLabel ?? ""}</span>
            </div>
          )}
          <div className="gitui-diff-img-row">
            <div className="gitui-diff-img-col">
              {imageUrls.left !== null ? (
                <img src={imageUrls.left} alt={t("diff.binary")} className="gitui-diff-img" />
              ) : (
                <div className="gitui-diff-placeholder">…</div>
              )}
            </div>
            <div className="gitui-diff-img-col">
              {imageUrls.right !== null ? (
                <img src={imageUrls.right} alt={t("diff.binary")} className="gitui-diff-img" />
              ) : (
                <div className="gitui-diff-placeholder">…</div>
              )}
            </div>
          </div>
          <div className="gitui-diff-img-notice">{t("diff.binaryDifferent")}</div>
        </div>
      );
    }
    return <div className="gitui-diff-placeholder">{t("diff.binary")}</div>;
  }
  if (file.hunks.length === 0) {
    return <div className="gitui-diff-placeholder">{t("diff.empty")}</div>;
  }

  const canOperate = interactive && api !== undefined && dir !== undefined && path !== undefined && !hunkOpsDisabled;

  /**
   * IDEA-style gutter action on the first row (of this side) of each changed
   * block:
   * - worktree side (the NEW side): an include checkbox (partial commit);
   * - HEAD side (the OLD side): an apply arrow (revert = apply HEAD's block
   *   to the worktree).
   * Rendered inside the fixed-width gutter-action column (.gitui-diff-gslot):
   * on the HEAD side it sits to the RIGHT of the number, on the worktree side
   * to the LEFT, so the six-column order holds and numbers stay aligned
   * whether or not a row carries an action.
   */
  const gutterAction = (
    side: "old" | "new",
    block: BlockInfo,
    isFirst: boolean,
    hunkIndex: number,
    checked: boolean
  ): JSX.Element | null => {
    if (!interactive || !isFirst) return null;
    const worktreeSide = side === "new";
    if (worktreeSide) {
      if (onToggleHunk === undefined || hunkOpsDisabled) return null;
      return (
        <input
          type="checkbox"
          className="gitui-diff-gcheck"
          checked={checked}
          title={t("tree.check")}
          onChange={(event) => {
            event.stopPropagation();
            onToggleHunk(hunkIndex);
          }}
          onClick={(event) => event.stopPropagation()}
        />
      );
    }
    // IDEA Diff.ArrowRight / Diff.Arrow: a slim arrow pointing from the
    // HEAD side toward the worktree (apply HEAD's block to the worktree).
    const pointsRight = !reversed;
    return (
      <button
        type="button"
        className="gitui-diff-gicon gitui-diff-gicon-apply"
        title={hunkOpsDisabled ? (hunkOpsDisabledReason ?? "") : t("diff.revertHunk")}
        disabled={opBusy || !canOperate}
        onClick={(event) => {
          event.stopPropagation();
          void runChangeOp(block.change);
        }}
      >
        {pointsRight ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <g fill="currentColor" fillRule="evenodd">
              <rect width="1" height="7" x="7.674" y=".38" transform="scale(-1 1) rotate(45 0 -15.853)" />
              <rect width="7" height="1" x="4.674" y="7.622" transform="scale(-1 1) rotate(45 0 -11.61)" />
              <rect width="1" height="7" x="3.431" y=".38" transform="scale(-1 1) rotate(45 0 -5.61)" />
              <rect width="7" height="1" x=".431" y="7.622" transform="scale(-1 1) rotate(45 0 -1.368)" />
            </g>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <g fill="currentColor" fillRule="evenodd">
              <rect width="1" height="7" x="3.328" y=".379" transform="rotate(45 3.828 3.879)" />
              <rect width="7" height="1" x=".328" y="7.621" transform="rotate(45 3.828 8.121)" />
              <rect width="1" height="7" x="7.571" y=".379" transform="rotate(45 8.071 3.879)" />
              <rect width="7" height="1" x="4.571" y="7.621" transform="rotate(45 8.071 8.121)" />
            </g>
          </svg>
        )}
      </button>
    );
  };
  // ── inline editing (worktree side, IDEA-style REAL-TIME save) ───────────
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  /**
   * Per-path baseline cache: key → the path's loaded content promise. Every
   * queued write binds to ITS OWN path's entry, so a write scheduled before a
   * file switch can never read another file's baseline (the old single-slot
   * ref allowed exactly that — a cross-file overwrite). The current path's
   * entry is deleted on every switch so revisits re-read the file from disk.
   */
  const baselineCacheRef = useRef<Map<string, Promise<BaselineResult>>>(new Map());
  /** Current path as seen by queued writes (updated during render). */
  const currentPathRef = useRef<string | undefined>(path);
  currentPathRef.current = path;
  /** Inline editing availability (the baseline loads asynchronously). */
  const [editLoading, setEditLoading] = useState(true);
  /** Why inline editing is unavailable (null = editable). */
  const [editBlocked, setEditBlocked] = useState<string | null>(null);
  const editReady = !editLoading && editBlocked === null;

  const baselineKey = (p: string | undefined): string => (dir ?? "") + "\u0000" + (p ?? "");

  /** Load a path's baseline once (cached); writes wait on their own entry. */
  const loadBaseline = (p: string | undefined): Promise<BaselineResult> => {
    if (api === undefined || dir === undefined || p === undefined) {
      return Promise.resolve({ base: null, blocked: null });
    }
    const key = baselineKey(p);
    let promise = baselineCacheRef.current.get(key);
    if (promise === undefined) {
      promise = (async () => {
        try {
          const file = await api.readFile(dir, p);
          if (file.binary) return { base: null, blocked: t("diff.binary") };
          if (file.truncated) return { base: null, blocked: t("diff.truncatedReadonly") };
          return {
            base: {
              lines: file.content.split(/\r\n|\n/),
              eol: file.content.includes("\r\n") ? "\r\n" : "\n"
            },
            blocked: null
          };
        } catch (caught) {
          return { base: null, blocked: (caught as Error).message };
        }
      })();
      baselineCacheRef.current.set(key, promise);
      // Bound the cache; clearing is safe — queued writes re-load their own path.
      if (baselineCacheRef.current.size > 16) {
        baselineCacheRef.current.clear();
        baselineCacheRef.current.set(key, promise);
      }
    }
    return promise;
  };

  // Expose a flush handle so the owner can order menu mutations after writes.
  useEffect(() => {
    if (flushRef === undefined) return;
    flushRef.current = () => saveChainRef.current;
    return () => {
      flushRef.current = null;
    };
  }, [flushRef]);

  // Switching files resets the restore history and re-reads the new file's
  // baseline (deleting its cache entry forces a fresh read on every visit).
  useEffect(() => {
    originalByLineRef.current = new Map();
    setEditedCount(0);
    setSavedFlash(false);
    setRestoredFlash(false);
    setEditLoading(true);
    setEditBlocked(null);
    baselineCacheRef.current.delete(baselineKey(path));
    void loadBaseline(path).then((result) => {
      if (path !== currentPathRef.current) return; // superseded by a newer switch
      setEditLoading(false);
      if (result.blocked !== null) setEditBlocked(result.blocked);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  /** Write one line back to the working-tree file. Bound to the captured
   *  path: a queued write always reads THAT path's baseline, never the
   *  current file's. Resolves false when nothing was written (baseline
   *  unavailable / line out of range) so callers can skip the "saved" flash. */
  const saveEditedLine = async (p: string, newNo: number, text: string): Promise<boolean> => {
    if (api === undefined || dir === undefined || p === undefined) return false;
    const result = await loadBaseline(p);
    const base = result.base;
    if (base === null) return false;
    if (newNo < 1 || newNo > base.lines.length) return false;
    // First edit of a line: keep the pre-edit text as the undo baseline.
    // Current-path only: a stale queued write from a previous file must not
    // pollute the new file's restore history.
    if (p === currentPathRef.current) {
      let lineOriginals = originalByLineRef.current.get(p);
      if (lineOriginals === undefined) {
        lineOriginals = new Map();
        originalByLineRef.current.set(p, lineOriginals);
      }
      if (!lineOriginals.has(newNo)) {
        lineOriginals.set(newNo, base.lines[newNo - 1] as string);
        setEditedCount(lineOriginals.size);
      }
    }
    base.lines[newNo - 1] = text;
    await api.writeFile(dir, p, base.lines.join(base.eol));
    return true;
  };

  /** Brief "saved" feedback after the write-back lands. */
  const flashSaved = (): void => {
    setSavedFlash(true);
    if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedFlash(false), 1200);
  };

  /** Every keystroke writes to disk immediately (serialized, no debounce). */
  const saveImmediate = (newNo: number, text: string): void => {
    if (path === undefined) return;
    const capturedPath = path;
    setSavedFlash(false);
    saveChainRef.current = saveChainRef.current
      .then(() => saveEditedLine(capturedPath, newNo, text))
      .then((written) => {
        if (written) flashSaved();
      })
      .catch(() => {
        /* a stale write is surfaced by the blur refresh */
      });
  };

  /** Flush pending writes on blur and refresh the diff (silent, no flash). */
  const flushSave = (newNo: number, text: string): void => {
    if (path === undefined) return;
    const capturedPath = path;
    saveChainRef.current = saveChainRef.current
      .then(() => saveEditedLine(capturedPath, newNo, text))
      .then(() => onChanged?.())
      .catch((caught: unknown) => {
        setOpError((caught as Error).message);
      });
  };

  /** Revert every inline edit of this file back to its pre-edit text. */
  const restoreEdits = (): void => {
    if (path === undefined) return;
    const originals = new Map(originalByLineRef.current.get(path) ?? new Map());
    if (originals.size === 0) return;
    saveChainRef.current = saveChainRef.current
      .then(async () => {
        for (const [no, text] of originals) {
          await saveEditedLine(path, no, text);
        }
        originalByLineRef.current.delete(path);
        setEditedCount(0);
        setRestoredFlash(true);
        window.setTimeout(() => setRestoredFlash(false), 1200);
        onChanged?.();
      })
      .catch((caught: unknown) => {
        setOpError((caught as Error).message);
      });
  };


  /** Revert exactly one visual change (IDEA change unit) and refresh. */
  async function runChangeOp(change: ChangeRef): Promise<void> {
    if (!canOperate || api === undefined || dir === undefined || path === undefined) return;
    setOpBusy(true);
    setOpError(null);
    try {
      // Pending inline writes must land before the revert reads the file.
      await saveChainRef.current;
      await api.revertChanges(dir, path, change, wsFlags);
      onChanged?.();
    } catch (caught) {
      setOpError((caught as Error).message);
    } finally {
      setOpBusy(false);
    }
  }

  async function runFileOp(kind: "stage" | "revert"): Promise<void> {
    if (api === undefined || dir === undefined || path === undefined) return;
    setOpBusy(true);
    setOpError(null);
    try {
      // Pending inline writes must land before stage/discard snapshots the file.
      await saveChainRef.current;
      if (kind === "stage") await api.stage(dir, [path]);
      else await api.discard(dir, [path], true);
      onChanged?.();
    } catch (caught) {
      setOpError((caught as Error).message);
    } finally {
      setOpBusy(false);
    }
  }

  /** Scroll to a hunk header (data-hunk-index). */
  function scrollToHunk(index: number): void {
    const el = scrollRef.current?.querySelector(`[data-hunk-index="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
    if (file !== null) setCurrentHunk(Math.max(0, Math.min(file.hunks.length - 1, index)));
  }

  /**
   * Render ONE column of the side-by-side view. Both columns share the same
   * row sequence (context rows, fold rows, hunk headers, and block rows at
   * max(del, add) pairs): a block row whose side has no line renders a BLANK
   * pad cell, so both columns stay equal height and vertically aligned.
   */
  const renderSideColumn = (side: "old" | "new"): JSX.Element => {
    const isLeft = (side === "new") === reversed;
    const extent = colExtent !== null ? (isLeft ? colExtent.left : colExtent.right) : undefined;
    const editProps = (line: SideLine): { newNo: number; onInput: (text: string) => void; onBlur: (text: string) => void } | undefined =>
      interactive && editReady && side === "new" // worktree side is editable (right column by default)
        ? {
            newNo: line.no,
            onInput: (text) => saveImmediate(line.no, text),
            onBlur: (text) => flushSave(line.no, text)
          }
        : undefined;
    return (
      <div className="gitui-diff-col">
        {file.hunks.map((hunk, hunkIndex) => {
          const hunkChecked = uncheckedHunks !== undefined && !uncheckedHunks.has(hunkIndex);
          const layout = buildSideLayout(hunk, hunkIndex, granularity, showIntra);
          const parts = splitLayoutParts(layout, hunkIndex, foldExpanded);
          return (
            <div key={hunkIndex}>
              {isLeft ? (
                <div
                  className={
                    "gitui-hunk-gap gitui-hunk-head" +
                    (interactive && currentHunk === hunkIndex ? " gitui-hunk-current" : "")
                  }
                  data-hunk-index={hunkIndex}
                >
                  <span style={{ flex: 1 }} />
                </div>
              ) : (
                <div className="gitui-hunk-gap" aria-hidden="true" />
              )}
              {parts.map((part, partIndex) => {
                if (part.kind === "fold") {
                  return (
                    <button
                      key={part.key}
                      type="button"
                      className="gitui-fold-row"
                      onClick={() => {
                        setFoldExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(part.key)) next.delete(part.key);
                          else next.add(part.key);
                          return next;
                        });
                      }}
                    >
                      {t("diff.unchanged", { n: String(part.count) })}
                    </button>
                  );
                }
                if (part.kind === "ctx") {
                  const line = side === "old" ? part.old : part.new;
                  return (
                    <div key={"c" + partIndex} className="gitui-diff-cell">
                      <div className="gitui-diff-cell-content">
                        <div
                          className="gitui-diff-cell-inner"
                          style={extent !== undefined ? { width: extent } : undefined}
                        >
                          {renderText(
                            { no: line.no, text: line.text, kind: line.kind, segs: line.segs },
                            t,
                            editProps(line)
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
                const { block } = part;
                return block.rows.map((row, pair) => {
                  const line = side === "old" ? row.del : row.add;
                  if (line === undefined) {
                    // Equal-height padding: the other side has a row at this
                    // pair, so render a BLANK placeholder row here. Both
                    // columns then share one row sequence and stay aligned.
                    // No background — IDEA-style empty side.
                    return (
                      <div key={pair} className="gitui-diff-cell gitui-diff-cell-pad">
                        <div className="gitui-diff-cell-content">
                          <div
                            className="gitui-diff-cell-inner"
                            style={extent !== undefined ? { width: extent } : undefined}
                          />
                        </div>
                      </div>
                    );
                  }
                  const className = sideRowClass(line, block.changeKind);
                  const content = (
                    <div className="gitui-diff-cell-content">
                      <div
                        className="gitui-diff-cell-inner"
                        style={extent !== undefined ? { width: extent } : undefined}
                      >
                        {renderText(
                          { no: line.no, text: line.text, kind: line.kind, segs: line.segs },
                          t,
                          editProps(line)
                        )}
                      </div>
                    </div>
                  );
                  return (
                    <div
                      key={pair}
                      className={className}
                    >
                      {content}
                    </div>
                  );
                });
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * Line-number strip of the middle gutter column for one side. Mirrors the
   * content column's row sequence EXACTLY (hunk-header / fold placeholders
   * plus ctx/block rows), so the height-sync effect can align them 1:1.
   * Gutter actions (include checkbox / apply arrow) live here next to the
   * number of the block's first row on this side.
   */
  const renderMidColumn = (side: "old" | "new"): JSX.Element => {
    const isOld = side === "old";
    /** One gutter row. The six-column order is HEAD:[text][number][apply]
     *  and worktree:[checkbox][number][text], so the HEAD strip renders the
     *  number BEFORE the action slot while the worktree strip renders it
     *  AFTER. The action slot is always reserved so the number column stays
     *  vertically aligned whether or not a row carries an action. */
    const midRow = (action: JSX.Element | null, no: number): JSX.Element => {
      const slot = <span className="gitui-diff-gslot">{action}</span>;
      const number = <span className="gitui-diff-no">{no}</span>;
      return isOld ? (
        <>
          {number}
          {slot}
        </>
      ) : (
        <>
          {slot}
          {number}
        </>
      );
    };
    return (
      <div className={"gitui-diff-mid-" + (isOld ? "ln" : "rn")}>
        {file.hunks.map((hunk, hunkIndex) => {
          const hunkChecked = uncheckedHunks !== undefined && !uncheckedHunks.has(hunkIndex);
          const layout = buildSideLayout(hunk, hunkIndex, granularity, showIntra);
          const parts = splitLayoutParts(layout, hunkIndex, foldExpanded);
          return (
            <div key={hunkIndex}>
              <div className="gitui-mid-head" />
              {parts.map((part, partIndex) => {
                if (part.kind === "fold") {
                  return <div key={part.key} className="gitui-mid-fold" />;
                }
                if (part.kind === "ctx") {
                  const line = isOld ? part.old : part.new;
                  return (
                    <div key={"c" + partIndex} className="gitui-mid-row">
                      {midRow(null, line.no)}
                    </div>
                  );
                }
                const { block } = part;
                const firstOnSide = block.rows.findIndex(
                  (row) => (isOld ? row.del : row.add) !== undefined
                );
                return block.rows.map((row, pair) => {
                  const line = isOld ? row.del : row.add;
                  if (line === undefined) {
                    // Blank pad row mirroring the content pad cell: keeps the
                    // strip's row sequence 1:1 with the columns (height-sync).
                    return <div key={pair} className="gitui-mid-row" />;
                  }
                  const isFirst = pair === firstOnSide;
                  return (
                    <div key={pair} className="gitui-mid-row">
                      {midRow(gutterAction(side, block, isFirst, hunkIndex, hunkChecked), line.no)}
                    </div>
                  );
                });
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const hunkCount = file.hunks.length;

  return (
    <div
      className={"gitui-diff" + (softWrap ? " gitui-diff-softwrap" : "")}
      style={{ fontSize: fontSize + "px" }}
    >
      <div className="gitui-diff-toolbar">
        <Dropdown
          label={t("diff.view." + viewMode)}
          value={viewMode}
          options={VIEW_OPTIONS}
          title={t("diff.viewModeHint")}
          onChange={(value) => applySettings({ ...settings, viewMode: value as ViewMode })}
        />
        <WsFlagsDropdown
          flags={wsFlags}
          disabled={onWsFlagsChange === undefined}
          onChange={(next) => onWsFlagsChange?.(next)}
          t={t}
        />
        <Dropdown
          label={t("diff.hl." + highlight)}
          value={highlight}
          options={HL_OPTIONS}
          title={t("diff.highlightHint")}
          onChange={(value) => applySettings({ ...settings, highlight: value as HighlightMode })}
        />
        <label className="gitui-merge-option" title={t("diff.softWrapHint")}>
          <input
            type="checkbox"
            checked={softWrap}
            onChange={(event) => applySettings({ ...settings, softWrap: event.target.checked })}
          />
          {t("diff.softWrap")}
        </label>
        <button
          type="button"
          className="gitui-btn gitui-font-btn"
          title={t("diff.fontSmaller")}
          disabled={fontSize <= 11}
          onClick={() => applySettings({ ...settings, fontSize: adjustFontSize(fontSize, -1) })}
        >
          A−
        </button>
        <button
          type="button"
          className="gitui-btn gitui-font-btn"
          title={t("diff.fontLarger")}
          disabled={fontSize >= 20}
          onClick={() => applySettings({ ...settings, fontSize: adjustFontSize(fontSize, 1) })}
        >
          A+
        </button>
        {interactive && (
          <>
            <span className="gitui-tb-sep" />
            <button
              type="button"
              className="gitui-btn"
              disabled={opBusy || dir === "" || path === undefined || hunkOpsDisabled}
              onClick={() => void runFileOp("stage")}
            >
              ⬆ {t("diff.stageFile")}
            </button>
            <button
              type="button"
              className="gitui-btn"
              disabled={opBusy || dir === "" || path === undefined || hunkOpsDisabled}
              onClick={() => void runFileOp("revert")}
            >
              ⤓ {t("diff.revertFile")}
            </button>
          </>
        )}
        <span style={{ flex: 1 }} />
        {interactive && (
          <>
            <button
              type="button"
              className="gitui-btn"
              title={t("diff.prevHunk")}
              disabled={hunkCount === 0}
              onClick={() => scrollToHunk(currentHunk - 1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="gitui-btn"
              title={t("diff.nextHunk")}
              disabled={hunkCount === 0}
              onClick={() => scrollToHunk(currentHunk + 1)}
            >
              ▼
            </button>
          </>
        )}
        <span className="gitui-diff-count" title={t("diff.countHint")}>
          {hunkCount > 0 ? t("diff.count", { n: String(hunkCount) }) : t("diff.countZero")}
          {interactive && hunkCount > 0 ? " · " + (currentHunk + 1) + "/" + hunkCount : ""}
        </span>
      </div>
      {(leftLabel !== undefined || rightLabel !== undefined) && (
        <div className="gitui-diff-sides">
          <span className="gitui-diff-side">{leftLabel ?? ""}</span>
          <span className="gitui-diff-side">{rightLabel ?? ""}</span>
        </div>
      )}
      <div className="gitui-diff-scroll" data-git-ui-diff="" ref={scrollRef}>
        {viewMode === "unified" ? (
          <div className="gitui-diff-cols gitui-diff-cols-unified">
            <div className="gitui-diff-col">
              {file.hunks.map((hunk, hunkIndex) => {
                const rows = buildUnifiedRows(hunk, granularity, showIntra);
                const parts = splitUnifiedParts(rows, hunkIndex, foldExpanded);
                return (
                  <div key={hunkIndex}>
                    <div
                      className={
                        "gitui-hunk-gap gitui-hunk-head" +
                        (interactive && currentHunk === hunkIndex ? " gitui-hunk-current" : "")
                      }
                      data-hunk-index={hunkIndex}
                    >
                      <span className="gitui-hunk-meta">
                        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
                      </span>
                      <span style={{ flex: 1 }} />
                    </div>
                    {parts.map((part, partIndex) =>
                      part.kind === "fold" ? (
                        <button
                          key={part.key}
                          type="button"
                          className="gitui-fold-row"
                          onClick={() => {
                            setFoldExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(part.key)) next.delete(part.key);
                              else next.add(part.key);
                              return next;
                            });
                          }}
                        >
                          {t("diff.unchanged", { n: String(part.count) })}
                        </button>
                      ) : (
                        <div key={partIndex}>{renderUnifiedRow(part.row as UnifiedRow, t)}</div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="gitui-diff-cols">
            {renderSideColumn("old")}
            <div className="gitui-diff-mid">
              <div className="gitui-diff-mid-ln">{renderMidColumn("old")}</div>
              <div className="gitui-diff-mid-rn">{renderMidColumn("new")}</div>
            </div>
            {renderSideColumn("new")}
          </div>
        )}
      </div>
      {!softWrap && (
        <div className="gitui-diff-scrollbar" ref={scrollbarRef}>
          <div style={{ width: `calc(100% + ${scrollMax}px)` }} />
        </div>
      )}
      {editedCount > 0 && (
        <div className="gitui-ok" style={{ padding: "2px 10px 6px" }}>
          <button type="button" className="gitui-btn" title={t("diff.restoreEditsHint")} onClick={restoreEdits}>
            ↩ {t("diff.restoreEdits", { n: String(editedCount) })}
          </button>
        </div>
      )}
      <Toast message={savedFlash ? t("diff.saved") : restoredFlash ? t("diff.restored") : null} />
      {editBlocked !== null && (
        <div className="gitui-tree-warn" style={{ padding: "2px 10px 6px" }}>{editBlocked}</div>
      )}
      {opError !== null && <div className="gitui-error" style={{ padding: "2px 10px 6px" }}>{opError}</div>}
    </div>
  );
}

// ── CommitBox ───────────────────────────────────────────────────────────────

export function CommitBox(props: {
  api: GitApi;
  dir: string;
  stagedCount: number;
  /** Checked-out branch name; needed for push. */
  branch: string | null;
  t: GitUiT;
  onCommitted: () => void;
  /** IDEA-style: paths the user checked; commit only these. */
  checkedPaths?: string[];
  /** Hunk-level selections (partial commit) for checked files. */
  partial?: Array<{ path: string; hunks: number[] }>;
}): JSX.Element {
  const { api, dir, stagedCount, branch, t, onCommitted, checkedPaths, partial } = props;
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<Array<{ name: string; url: string }>>([]);
  const [pushTarget, setPushTarget] = useState("");
  /** Remote-tracking branches of pushTarget (short names, same-name first). */
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [pushRemoteBranch, setPushRemoteBranch] = useState("");

  useEffect(() => {
    let alive = true;
    setRemotes([]);
    setPushTarget("");
    if (dir === "") return;
    api
      .remotes(dir)
      .then((list) => {
        if (!alive) return;
        setRemotes(list);
        if (list.length > 0) setPushTarget(list[0].name);
      })
      .catch(() => {
        /* no remotes is a valid state */
      });
    return () => {
      alive = false;
    };
  }, [api, dir]);

  // Remote-tracking branches for the chosen remote; the branch with the same
  // name as the local branch is moved to the front and selected by default.
  useEffect(() => {
    if (dir === "" || pushTarget === "") {
      setRemoteBranches([]);
      setPushRemoteBranch("");
      return;
    }
    let alive = true;
    void api
      .branches(dir)
      .then((value) => {
        if (!alive) return;
        const prefix = "remotes/" + pushTarget + "/";
        const names = value.branches
          .filter((b) => b.name.startsWith(prefix))
          .map((b) => b.name.slice(prefix.length));
        const sorted = [...new Set(names)].sort();
        if (branch !== null) {
          const idx = sorted.indexOf(branch);
          if (idx > 0) {
            sorted.splice(idx, 1);
            sorted.unshift(branch);
          }
        }
        setRemoteBranches(sorted);
        setPushRemoteBranch(branch !== null && sorted.includes(branch) ? branch : (sorted[0] ?? ""));
      })
      .catch(() => {
        if (alive) {
          setRemoteBranches([]);
          setPushRemoteBranch("");
        }
      });
    return () => {
      alive = false;
    };
  }, [api, dir, pushTarget, branch]);

  const canCommit = stagedCount > 0 && message.trim() !== "" && !busy;

  /** Commit the current message; clears the form on success. */
  async function doCommit(): Promise<{ hash: string; short: string }> {
    const result = await api.commit(dir, message, amend, checkedPaths, partial);
    setMessage("");
    setAmend(false);
    return result;
  }

  async function submit(): Promise<void> {
    if (!canCommit) return;
    setBusy(true);
    setError(null);
    setOk(null);
    const subject = message.split("\n")[0] ?? "";
    try {
      const result = await doCommit();
      setOk(t("commit.done", { short: result.short, subject }));
      onCommitted();
    } catch (caught) {
      const err = caught as { code?: string; message: string };
      setError(err.code === "identity-missing" ? t("commit.identity") : err.message);
    } finally {
      setBusy(false);
    }
  }

  /** Commit, then push the current branch to the chosen remote. */
  async function commitAndPush(): Promise<void> {
    if (!canCommit || pushTarget === "" || branch === null) return;
    setBusy(true);
    setError(null);
    setOk(null);
    const subject = message.split("\n")[0] ?? "";
    try {
      const result = await doCommit();
      try {
        await api.push(
          dir,
          pushTarget,
          branch,
          undefined,
          pushRemoteBranch === "" || pushRemoteBranch === branch ? undefined : pushRemoteBranch
        );
        setOk(
          pushRemoteBranch === "" || pushRemoteBranch === branch
            ? t("push.done", { branch, remote: pushTarget })
            : t("push.doneTarget", { local: branch, target: pushRemoteBranch, remote: pushTarget })
        );
      } catch (caught) {
        setOk(null);
        setError(
          t("push.commitOkPushFailed", {
            short: result.short,
            subject,
            message: (caught as Error).message
          })
        );
      }
      onCommitted();
    } catch (caught) {
      const err = caught as { code?: string; message: string };
      setError(err.code === "identity-missing" ? t("commit.identity") : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gitui-commit">
      {stagedCount === 0 ? (
        <div className="gitui-diff-placeholder" style={{ padding: "8px" }}>
          {t("commit.nothing")}
        </div>
      ) : (
        <>
          <textarea
            value={message}
            placeholder={t("commit.placeholder")}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void submit();
              }
            }}
            disabled={busy}
          />
          <div className="gitui-commit-row">
            <label>
              <input type="checkbox" checked={amend} onChange={(event) => setAmend(event.target.checked)} disabled={busy} />
              {t("commit.amend")}
            </label>
            <button
              type="button"
              className="gitui-btn gitui-btn-primary"
              disabled={!canCommit}
              onClick={() => void submit()}
            >
              {t("action.commit")} ({checkedPaths !== undefined ? checkedPaths.length : stagedCount})
            </button>
            {remotes.length > 0 && branch !== null && (
              <>
                <button
                  type="button"
                  className="gitui-btn"
                  title={t("push.hint", { branch, remote: pushTarget })}
                  disabled={!canCommit || pushTarget === ""}
                  onClick={() => void commitAndPush()}
                >
                  {t("push.andCommit")}
                </button>
                <select
                  className="gitui-dir"
                  style={{ flex: "0 1 110px" }}
                  value={pushTarget}
                  onChange={(event) => setPushTarget(event.target.value)}
                >
                  {remotes.map((remote) => (
                    <option key={remote.name} value={remote.name}>
                      {remote.name}
                    </option>
                  ))}
                </select>
                {remoteBranches.length > 0 ? (
                  <select
                    className="gitui-dir"
                    style={{ flex: "0 1 130px" }}
                    value={pushRemoteBranch}
                    title={t("push.remoteBranchSelect")}
                    onChange={(event) => setPushRemoteBranch(event.target.value)}
                  >
                    {remoteBranches.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="gitui-remote-url" title={t("push.noRemoteBranches")}>
                    {t("push.noRemoteBranches")}
                  </span>
                )}
              </>
            )}
          </div>
        </>
      )}
      {error !== null && <div className="gitui-error">{error}</div>}
      <Toast message={ok} />
    </div>
  );
}
