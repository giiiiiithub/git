/**
 * MergeRevisions — IDEA-style three-pane conflict resolution:
 * left = ours (current branch), middle = Result, right = theirs (incoming
 * branch). Conflict blocks carry per-block buttons on hover: » accept left,
 * « accept right, × remove from Result. The toolbar navigates blocks and
 * accepts the current one wholesale (Accept Left / Accept Right). The Result
 * pane can also be edited as plain text (edit mode).
 *
 * Block bookkeeping: the static host ranges (view.blocks) highlight the side
 * panes; live blocks are re-parsed from the result text after every edit.
 * Side buttons map to live blocks by content equality (git conflict content
 * is verbatim from each side, so this is reliable).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { GitApi } from "../api.js";
import type { ConflictView } from "../../types.js";
import type { GitUiT } from "./DiffView.js";

export interface LiveBlock {
  /** 0-based range in the result text, marker lines inclusive. */
  start: number;
  end: number;
  ours: string[];
  theirs: string[];
  /** Full original block lines including the conflict markers. */
  raw: string[];
}

/** Parse conflict blocks (marker lines inclusive) from result text lines. */
export function parseLiveBlocks(lines: string[]): LiveBlock[] {
  const blocks: LiveBlock[] = [];
  let side: "ours" | "theirs" | null = null;
  let start = 0;
  let ours: string[] = [];
  let theirs: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.startsWith("<<<<<<<")) {
      start = i;
      side = "ours";
      ours = [];
      theirs = [];
      continue;
    }
    if (line.startsWith("=======")) {
      side = "theirs";
      continue;
    }
    if (line.startsWith(">>>>>>>")) {
      blocks.push({ start, end: i, ours, theirs, raw: lines.slice(start, i + 1) });
      side = null;
      continue;
    }
    if (side === "ours") ours.push(line);
    else if (side === "theirs") theirs.push(line);
  }
  return blocks;
}

function LineList(props: {
  lines: string[];
  /** Highlight class per line: "ours" | "theirs" | "result" | null. */
  highlight: (index: number) => "ours" | "theirs" | "result" | null;
  /** Block-first-line action buttons (forward + restore), or empty. */
  actionsAt: (index: number) => Array<{ glyph: string; title: string; cls: string; onClick: () => void }>;
  currentAt: (index: number) => boolean;
  onLineClick?: (index: number) => void;
}): JSX.Element {
  const { lines, highlight, actionsAt, currentAt, onLineClick } = props;
  return (
    <div className="gitui-mr-lines">
      {lines.map((line, i) => {
        const cls = highlight(i);
        const actions = actionsAt(i);
        return (
          <div
            key={i}
            className={
              "gitui-mr-line" +
              (cls !== null ? " gitui-mr-line-" + cls : "") +
              (currentAt(i) ? " gitui-mr-line-block-current" : "")
            }
            onClick={onLineClick !== undefined ? () => onLineClick(i) : undefined}
          >
            <span className="gitui-mr-no">{i + 1}</span>
            {actions.map((action, ai) => (
              <button
                key={ai}
                type="button"
                className={"gitui-mr-act " + action.cls}
                title={action.title}
                onClick={(event) => {
                  event.stopPropagation();
                  action.onClick();
                }}
              >
                {action.glyph}
              </button>
            ))}
            <span className="gitui-mr-text" title={line}>{line === "" ? " " : line}</span>
          </div>
        );
      })}
    </div>
  );
}

const joinLines = (lines: string[]): string => lines.join("\n");

/** First index of a target line sequence at or after 'from', else -1. */
function findLines(lines: string[], target: string[], from: number): number {
  if (target.length === 0) return -1;
  for (let i = Math.max(0, from); i <= lines.length - target.length; i++) {
    if ((lines[i] ?? "") === target[0]) {
      let ok = true;
      for (let j = 1; j < target.length; j++) {
        if ((lines[i + j] ?? "") !== target[j]) {
          ok = false;
          break;
        }
      }
      if (ok) return i;
    }
  }
  return -1;
}

export function MergeRevisions(props: {
  api: GitApi;
  dir: string;
  path: string;
  t: GitUiT;
  view: ConflictView;
  /** Column label for the ours (current branch) side. */
  oursLabel: string;
  /** Column label for the theirs (incoming branch) side. */
  theirsLabel: string;
  /** Called after a successful save (e.g. to refresh status). */
  onSaved: () => void;
}): JSX.Element {
  const { api, dir, path, t, view, oursLabel, theirsLabel, onSaved } = props;

  const [resultText, setResultText] = useState(view.result);
  const [current, setCurrent] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  /** Undo/redo history: snapshots of resultText with a cursor. */
  const [hist, setHist] = useState<{ stack: string[]; index: number }>({
    stack: [view.result],
    index: 0
  });
  /** Last edit timestamp, for debouncing history snapshots while typing. */
  const lastEditRef = useRef(0);
  /** Which pristine blocks were applied into the result, and from which side. */
  const [applied, setApplied] = useState<Record<number, "ours" | "theirs">>({});

  // Reset everything when the conflict file changes.
  useEffect(() => {
    setResultText(view.result);
    setHist({ stack: [view.result], index: 0 });
    setCurrent(0);
    setSaved(null);
  }, [view.result]);

  const blocks = useMemo(() => parseLiveBlocks(resultText.split("\n")), [resultText]);
  const resultLines = useMemo(() => resultText.split("\n"), [resultText]);
  const oursLines = useMemo(() => view.ours.split("\n"), [view.ours]);
  const theirsLines = useMemo(() => view.theirs.split("\n"), [view.theirs]);
  /** Blocks as parsed from the pristine result — 1:1 with view.blocks. */
  const initialBlocks = useMemo(() => parseLiveBlocks(view.result.split("\n")), [view.result]);

  const inOursBlock = (i: number): boolean =>
    view.blocks.some((b) => b.oursEnd >= b.oursStart && i >= b.oursStart && i <= b.oursEnd);
  const inTheirsBlock = (i: number): boolean =>
    view.blocks.some((b) => b.theirsEnd >= b.theirsStart && i >= b.theirsStart && i <= b.theirsEnd);
  const inResultBlock = (i: number): boolean =>
    blocks.some((b) => i >= b.start && i <= b.end);

  /** Record a new snapshot; discards any redo tail. */
  function pushHist(next: string): void {
    setHist((h) => {
      const stack = [...h.stack.slice(0, h.index + 1), next];
      if (stack.length > 50) stack.shift();
      return { stack, index: stack.length - 1 };
    });
  }

  function undo(): void {
    setHist((h) => {
      if (h.index <= 0) return h;
      const index = h.index - 1;
      setResultText(h.stack[index] ?? "");
      setSaved(null);
      return { ...h, index };
    });
  }

  function redo(): void {
    setHist((h) => {
      if (h.index >= h.stack.length - 1) return h;
      const index = h.index + 1;
      setResultText(h.stack[index] ?? "");
      setSaved(null);
      return { ...h, index };
    });
  }

  function applyBlock(index: number, side: "ours" | "theirs"): void {
    const block = blocks[index];
    if (block === undefined) return;
    const content = side === "ours" ? block.ours : block.theirs;
    const initIdx = initialBlocks.findIndex(
      (init) =>
        joinLines(init.ours) === joinLines(block.ours) &&
        joinLines(init.theirs) === joinLines(block.theirs)
    );
    const lines = resultText.split("\n");
    const next = [...lines.slice(0, block.start), ...content, ...lines.slice(block.end + 1)];
    const nextText = next.join("\n");
    setResultText(nextText);
    pushHist(nextText);
    if (initIdx >= 0) setApplied((a) => ({ ...a, [initIdx]: side }));
    setCurrent(Math.min(index, parseLiveBlocks(next).length - 1));
    setSaved(null);
  }

  /**
   * Reverse operation: undo a block merge-in by locating the applied content
   * in the result and restoring the original conflict block (markers intact).
   */
  function restoreBlock(initIdx: number, side: "ours" | "theirs"): void {
    const init = initialBlocks[initIdx];
    if (init === undefined) return;
    const content = side === "ours" ? init.ours : init.theirs;
    const lines = resultText.split("\n");
    const at = findLines(lines, content, 0);
    if (at < 0) return;
    const next = [...lines.slice(0, at), ...init.raw, ...lines.slice(at + content.length)];
    const nextText = next.join("\n");
    setResultText(nextText);
    pushHist(nextText);
    setApplied((a) => {
      const copy = { ...a };
      delete copy[initIdx];
      return copy;
    });
    setCurrent(0);
    setSaved(null);
  }

  function removeBlock(index: number): void {
    const block = blocks[index];
    if (block === undefined) return;
    const lines = resultText.split("\n");
    const next = [...lines.slice(0, block.start), ...lines.slice(block.end + 1)];
    const nextText = next.join("\n");
    setResultText(nextText);
    pushHist(nextText);
    setCurrent(Math.min(index, parseLiveBlocks(next).length - 1));
    setSaved(null);
  }

  /** Apply a side's original block content (matched by content) to the live block. */
  function applySideByContent(index: number, side: "ours" | "theirs"): void {
    const initial = initialBlocks[index];
    if (initial === undefined) return;
    const target = side === "ours" ? initial.ours : initial.theirs;
    const idx = blocks.findIndex((b) => joinLines(b.ours) === joinLines(target) || joinLines(b.theirs) === joinLines(target));
    if (idx >= 0) applyBlock(idx, side);
    else if (blocks.length > 0) applyBlock(0, side);
  }

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await api.resolveFile(dir, path, resultText);
      setSaved(t("conflict.resolved"));
      onSaved();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const currentBlock = blocks[current];
  const allResolved = blocks.length === 0;

  return (
    <div className="gitui-mr">
      <div className="gitui-mr-toolbar">
        <button type="button" className="gitui-btn" title={t("merge.prev")} disabled={blocks.length === 0 || current <= 0} onClick={() => setCurrent((c) => Math.max(0, c - 1))}>
          ◀
        </button>
        <button type="button" className="gitui-btn" title={t("merge.next")} disabled={blocks.length === 0 || current >= blocks.length - 1} onClick={() => setCurrent((c) => Math.min(blocks.length - 1, c + 1))}>
          ▶
        </button>
        <button type="button" className="gitui-btn gitui-mr-accept-ours" title={t("merge.acceptLeftHint")} disabled={currentBlock === undefined} onClick={() => applyBlock(current, "ours")}>
          {t("merge.acceptLeft")}
        </button>
        <button type="button" className="gitui-btn gitui-mr-accept-theirs" title={t("merge.acceptRightHint")} disabled={currentBlock === undefined} onClick={() => applyBlock(current, "theirs")}>
          {t("merge.acceptRight")}
        </button>
        <button type="button" className="gitui-btn" title={t("merge.undo")} disabled={hist.index <= 0} onClick={undo}>
          ↶
        </button>
        <button type="button" className="gitui-btn" title={t("merge.redo")} disabled={hist.index >= hist.stack.length - 1} onClick={redo}>
          ↷
        </button>
        <button type="button" className="gitui-btn" disabled={busy} onClick={() => setEditMode(!editMode)}>
          {editMode ? t("merge.viewMode") : t("merge.editMode")}
        </button>
        <span className="gitui-mr-count">
          {allResolved ? t("merge.allResolved") : t("merge.remaining", { n: blocks.length })}
        </span>
      </div>
      {editMode ? (
        <textarea
          className="gitui-mr-edit"
          value={resultText}
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value;
            setResultText(next);
            setSaved(null);
            // Debounce: continuous typing counts as one snapshot.
            const now = Date.now();
            if (now - lastEditRef.current > 800) pushHist(next);
            lastEditRef.current = now;
          }}
        />
      ) : (
        <div className="gitui-mr-cols">
          <div className="gitui-mr-col">
            <div className="gitui-mr-col-title gitui-mr-title-ours">{oursLabel}</div>
            <LineList
              lines={oursLines}
              highlight={(i) => (inOursBlock(i) ? "ours" : null)}
              currentAt={() => false}
              actionsAt={(i) => {
                const j = view.blocks.findIndex((b) => b.oursEnd >= b.oursStart && i === b.oursStart);
                if (j < 0) return [];
                const done = applied[j] !== undefined;
                return [
                  {
                    // Single toggle at the boundary: » = accept, « = undo.
                    glyph: done ? "«" : "»",
                    title: done ? t("merge.restore") : t("merge.acceptLeftHint"),
                    cls:
                      "gitui-mr-act-accept-ours gitui-mr-act-edge-r" +
                      (done ? " gitui-mr-act-done" : ""),
                    onClick: () =>
                      done ? restoreBlock(j, applied[j] as "ours" | "theirs") : applySideByContent(j, "ours")
                  }
                ];
              }}
            />
          </div>
          <div className="gitui-mr-col">
            <div className="gitui-mr-col-title">{t("merge.resultTitle")}</div>
            <LineList
              lines={resultLines}
              highlight={(i) => (inResultBlock(i) ? "result" : null)}
              currentAt={(i) => currentBlock !== undefined && i >= currentBlock.start && i <= currentBlock.end}
              onLineClick={(i) => {
                const idx = blocks.findIndex((b) => i >= b.start && i <= b.end);
                if (idx >= 0) setCurrent(idx);
              }}
              actionsAt={(i) => {
                const idx = blocks.findIndex((b) => b.start === i);
                return idx >= 0
                  ? [
                      {
                        glyph: "×",
                        title: t("merge.removeBlock"),
                        cls: "gitui-mr-act-remove",
                        onClick: () => removeBlock(idx)
                      }
                    ]
                  : [];
              }}
            />
          </div>
          <div className="gitui-mr-col">
            <div className="gitui-mr-col-title gitui-mr-title-theirs">{theirsLabel}</div>
            <LineList
              lines={theirsLines}
              highlight={(i) => (inTheirsBlock(i) ? "theirs" : null)}
              currentAt={() => false}
              actionsAt={(i) => {
                const j = view.blocks.findIndex((b) => b.theirsEnd >= b.theirsStart && i === b.theirsStart);
                if (j < 0) return [];
                const done = applied[j] !== undefined;
                return [
                  {
                    // Single toggle at the boundary: « = accept, » = undo.
                    glyph: done ? "»" : "«",
                    title: done ? t("merge.restore") : t("merge.acceptRightHint"),
                    cls:
                      "gitui-mr-act-accept-theirs gitui-mr-act-edge-l" +
                      (done ? " gitui-mr-act-done" : ""),
                    onClick: () =>
                      done ? restoreBlock(j, applied[j] as "ours" | "theirs") : applySideByContent(j, "theirs")
                  }
                ];
              }}
            />
          </div>
        </div>
      )}
      <div className="gitui-mr-footer">
        {error !== null && <span className="gitui-error" style={{ padding: 0 }}>{error}</span>}
        {saved !== null && <span className="gitui-ok" style={{ padding: 0 }}>{saved}</span>}
        <span style={{ flex: 1 }} />
        <button type="button" className="gitui-btn gitui-btn-primary" disabled={busy} onClick={() => void save()}>
          {t("conflict.save")}
        </button>
      </div>
    </div>
  );
}
