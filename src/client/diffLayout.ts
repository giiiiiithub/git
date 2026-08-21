/**
 * Pure layout/mapping helpers for the side-by-side diff viewer.
 *
 * The model is the pair table of the Myers edit script: context lines occupy
 * both sides, changed lines group into blocks whose rows pair dels/adds by
 * block-local index (a side may be absent for that pair). The renderer pads
 * absent sides with blank placeholder rows so BOTH columns render the same
 * row sequence at equal heights (see DiffView); the pairing never relies on
 * physical row number or DOM order.
 *
 * No react dependency: unit-testable in plain Node (scripts/test-side-layout.mjs).
 */

// ── word-level (intra-line) diff ────────────────────────────────────────────

export interface WordSeg {
  t: "eq" | "chg";
  s: string;
}

/** Tokens: runs of word characters (incl. CJK) plus single separators. */
const TOKEN_RE = /[A-Za-z0-9_\u4e00-\u9fff]+|[^A-Za-z0-9_\u4e00-\u9fff]/g;
const WORD_LCS_CAP = 500;
/** Character-level tokens: each grapheme cluster (surrogate pairs stay whole). */
const CHAR_TOKEN_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g;
const CHAR_LCS_CAP = 2000;

/**
 * Token-level LCS over two line texts. Returns per-side segments: "eq" tokens
 * matched on both sides, "chg" tokens unique to one side (highlighted as
 * deletions on the old side, additions on the new side).
 */
export function diffWords(
  a: string,
  b: string,
  granularity: "word" | "char"
): { left: WordSeg[]; right: WordSeg[] } {
  if (a === b) return { left: [{ t: "eq", s: a }], right: [{ t: "eq", s: b }] };
  const ta = a.match(granularity === "char" ? CHAR_TOKEN_RE : TOKEN_RE) ?? [a];
  const tb = b.match(granularity === "char" ? CHAR_TOKEN_RE : TOKEN_RE) ?? [b];
  const cap = granularity === "char" ? CHAR_LCS_CAP : WORD_LCS_CAP;
  if (ta.length > cap || tb.length > cap) {
    return { left: [{ t: "chg", s: a }], right: [{ t: "chg", s: b }] };
  }
  const n = ta.length;
  const m = tb.length;
  const dp = new Uint16Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const cell = i * (m + 1) + j;
      dp[cell] =
        ta[i] === tb[j]
          ? dp[(i + 1) * (m + 1) + j + 1] + 1
          : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1]);
    }
  }
  const left: WordSeg[] = [];
  const right: WordSeg[] = [];
  const flush = (segs: WordSeg[], type: WordSeg["t"], s: string): void => {
    if (s === "") return;
    const last = segs[segs.length - 1];
    if (last !== undefined && last.t === type) last.s += s;
    else segs.push({ t: type, s });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ta[i] === tb[j]) {
      flush(left, "eq", ta[i] as string);
      flush(right, "eq", tb[j] as string);
      i++;
      j++;
    } else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) {
      flush(left, "chg", ta[i] as string);
      i++;
    } else {
      flush(right, "chg", tb[j] as string);
      j++;
    }
  }
  while (i < n) {
    flush(left, "chg", ta[i] as string);
    i++;
  }
  while (j < m) {
    flush(right, "chg", tb[j] as string);
    j++;
  }
  return { left, right };
}

// ── side layout model ───────────────────────────────────────────────────────

import type { ChangeRef, DiffHunk, DiffLine } from "../types.js";

/** One physical row on ONE side (old side: ctx/del lines; new side: ctx/add). */
export interface SideLine {
  /** Line number on this side (oldNo for old side, newNo for new side). */
  no: number;
  text: string;
  kind: "ctx" | "old" | "new";
  /** Word segments for paired changed rows (undefined = plain text). */
  segs?: WordSeg[];
}

/**
 * One row of the mapping table: the i-th deleted line paired with the i-th
 * added line of a change block. Either side may be absent (0 rows there).
 */
export interface BlockRow {
  del?: SideLine;
  add?: SideLine;
}

/** A visual change block (IDEA change unit): runs of del/add delimited by ctx. */
export interface BlockInfo {
  /** Stable identity used to pair cells across the two columns. */
  key: string;
  rows: BlockRow[];
  change: ChangeRef;
  changeKind: "mod" | "add" | "del";
}

/** Canonical per-hunk layout shared by both columns. */
export type LayoutItem =
  | { kind: "ctx"; old: SideLine; new: SideLine }
  | { kind: "block"; block: BlockInfo };

/**
 * Build the canonical layout of a hunk. Context lines occupy both sides (same
 * text, own line numbers); changed lines are grouped into blocks and paired
 * by block-local index (deleted[i] ↔ added[i]), exactly like IDEA's change
 * units. Unpaired lines leave the other side empty (0 rows).
 */
export function buildSideLayout(
  hunk: DiffHunk,
  hunkIndex: number,
  granularity: "word" | "char",
  withIntra: boolean
): LayoutItem[] {
  const items: LayoutItem[] = [];
  let delBlock: DiffLine[] = [];
  let addBlock: DiffLine[] = [];
  let blockIndex = 0;
  let oldCursor = hunk.oldStart;
  let newCursor = hunk.newStart;
  let blockOldStart = hunk.oldStart;
  let blockNewStart = hunk.newStart;
  const flush = (): void => {
    if (delBlock.length === 0 && addBlock.length === 0) return;
    const changeKind: "mod" | "add" | "del" =
      delBlock.length > 0 && addBlock.length > 0
        ? "mod"
        : addBlock.length > 0
          ? "add"
          : "del";
    const count = Math.max(delBlock.length, addBlock.length);
    const rows: BlockRow[] = [];
    for (let i = 0; i < count; i++) {
      const del = delBlock[i];
      const add = addBlock[i];
      if (del === undefined && add === undefined) continue;
      const oldText = del?.text ?? "";
      const newText = add?.text ?? "";
      let leftSegs: WordSeg[] | undefined;
      let rightSegs: WordSeg[] | undefined;
      if (withIntra && del !== undefined && add !== undefined && oldText !== newText) {
        const words = diffWords(oldText, newText, granularity);
        leftSegs = words.left;
        rightSegs = words.right;
      }
      rows.push({
        del:
          del !== undefined
            ? { no: del.oldNo as number, text: oldText, kind: "old", segs: leftSegs }
            : undefined,
        add:
          add !== undefined
            ? { no: add.newNo as number, text: newText, kind: "new", segs: rightSegs }
            : undefined
      });
    }
    items.push({
      kind: "block",
      block: {
        key: hunkIndex + ":" + blockIndex,
        rows,
        change: {
          oldStart: blockOldStart,
          oldCount: delBlock.length,
          newStart: blockNewStart,
          newCount: addBlock.length
        },
        changeKind
      }
    });
    blockIndex++;
    delBlock = [];
    addBlock = [];
  };
  for (const line of hunk.lines) {
    if (line.type === "ctx") {
      flush();
      items.push({
        kind: "ctx",
        old: { no: line.oldNo as number, text: line.text, kind: "ctx" },
        new: { no: line.newNo as number, text: line.text, kind: "ctx" }
      });
      oldCursor++;
      newCursor++;
    } else if (line.type === "del") {
      if (delBlock.length === 0 && addBlock.length === 0) {
        blockOldStart = oldCursor;
        blockNewStart = newCursor;
      }
      delBlock.push(line);
      oldCursor++;
    } else {
      if (delBlock.length === 0 && addBlock.length === 0) {
        blockOldStart = oldCursor;
        blockNewStart = newCursor;
      }
      addBlock.push(line);
      newCursor++;
    }
  }
  flush();
  return items;
}

/**
 * Explicit bidirectional line mapping derived from the edit script
 * (the user-visible contract: oldLineNumber ↔ newLineNumber, null for
 * deleted/added). Used by tests to pin the mapping; the renderer consumes
 * the same information through LayoutItem.
 */
export function buildMapping(hunk: DiffHunk): {
  oldToNew: Map<number, number | null>;
  newToOld: Map<number, number | null>;
} {
  const oldToNew = new Map<number, number | null>();
  const newToOld = new Map<number, number | null>();
  for (const line of hunk.lines) {
    if (line.type === "ctx") {
      if (line.oldNo !== undefined && line.newNo !== undefined) {
        oldToNew.set(line.oldNo, line.newNo);
        newToOld.set(line.newNo, line.oldNo);
      }
    } else if (line.type === "del") {
      if (line.oldNo !== undefined) oldToNew.set(line.oldNo, null);
    } else {
      if (line.newNo !== undefined) newToOld.set(line.newNo, null);
    }
  }
  return { oldToNew, newToOld };
}

// ── folding ─────────────────────────────────────────────────────────────────

/** Runs of pure-context rows this long get folded into one clickable row. */
export const COLLAPSE_MIN = 10;

export type LayoutPart =
  | { kind: "ctx"; old: SideLine; new: SideLine }
  | { kind: "block"; block: BlockInfo }
  | { kind: "fold"; key: string; count: number };

/** Split a hunk's layout, folding long unchanged runs (shared by both columns). */
export function splitLayoutParts(
  items: LayoutItem[],
  hunkIndex: number,
  expanded: Set<string>
): LayoutPart[] {
  const parts: LayoutPart[] = [];
  let ctxRun: LayoutItem[] = [];
  let itemCursor = 0;
  const flushCtx = (): void => {
    if (ctxRun.length > 0) {
      if (ctxRun.length >= COLLAPSE_MIN) {
        const key = "h" + hunkIndex + ":r" + (itemCursor - ctxRun.length);
        if (!expanded.has(key)) {
          parts.push({ kind: "fold", key, count: ctxRun.length });
          ctxRun = [];
          return;
        }
      }
      for (const item of ctxRun) {
        if (item.kind === "ctx") parts.push({ kind: "ctx", old: item.old, new: item.new });
      }
      ctxRun = [];
    }
  };
  for (const item of items) {
    if (item.kind === "ctx") {
      ctxRun.push(item);
    } else {
      flushCtx();
      parts.push({ kind: "block", block: item.block });
    }
    itemCursor++;
  }
  flushCtx();
  return parts;
}
