/**
 * FileTreeView — a git-independent directory tree for the panel's "Files"
 * tab: lazy-loading tree on the left, editable text preview on the right.
 * Supports creating, deleting, and editing text files (browse-only for
 * binary files). Everything is relative to the panel's current dir.
 */
import { useEffect, useRef, useState } from "react";
import type { GitApi } from "../api.js";
import type { DirEntry, FileContent } from "../../types.js";
import type { GitUiT } from "./DiffView.js";
import { PaneMinBar, PaneRestoreBar, Splitter } from "./Splitter.js";

interface FileTreeViewProps {
  api: GitApi;
  dir: string;
  t: GitUiT;
  /** Left tree width in px (user-resizable). */
  splitWidth: number;
  onSplitWidth: (width: number) => void;
  /** Double-click on the splitter: back to the default width. */
  onSplitReset: () => void;
  /** Tree pane hidden (− button); the restore strip is shown instead. */
  listHidden?: boolean;
  onToggleListHidden?: () => void;
  /** Called after an autosave flush lands (panel refreshes the repo status). */
  onChanged?: () => void;
}

/** IDEA-style chevron for tree disclosure (same paths as GroupChevron). */
function Chevron(props: { down?: boolean }): JSX.Element {
  const { down } = props;
  return (
    <svg className="gitui-tree-chev" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {down === true ? (
        <path d="M4.5 6 L8 9.5 L11.5 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M6 4.5 L9.5 8 L6 11.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function FileTreeView(props: FileTreeViewProps): JSX.Element {
  const { api, dir, t, splitWidth, onSplitWidth, onSplitReset, listHidden = false, onToggleListHidden, onChanged } = props;
  const [rootEntries, setRootEntries] = useState<DirEntry[] | null>(null);
  const [children, setChildren] = useState<Map<string, DirEntry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Brief "saved" feedback after a keystroke write lands (diff-editor style). */
  const [savedFlash, setSavedFlash] = useState(false);
  /** Autosave failure shown inline (keeps the editor visible, unlike open errors). */
  const [saveError, setSaveError] = useState<string | null>(null);
  const listSeq = useRef(0);
  /** Serialized autosave queue — every keystroke writes to disk immediately. */
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped on every file switch / dir change; stale write completions skip state updates. */
  const openSeqRef = useRef(0);

  // Reset everything when the panel dir changes.
  useEffect(() => {
    openSeqRef.current += 1;
    setRootEntries(null);
    setChildren(new Map());
    setExpanded(new Set());
    setSelectedPath(null);
    setFileContent(null);
    setDraft("");
    setError(null);
    setNotice(null);
    setSaveError(null);
    setSavedFlash(false);
    if (dir === "") return;
    let alive = true;
    api
      .listDir(dir)
      .then((entries) => {
        if (!alive) return;
        setRootEntries(entries);
      })
      .catch((caught) => {
        if (!alive) return;
        setError((caught as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [api, dir]);

  async function loadChildren(path: string): Promise<void> {
    const seq = ++listSeq.current;
    try {
      const entries = await api.listDir(dir, path);
      if (seq !== listSeq.current) return;
      setChildren((prev) => {
        const next = new Map(prev);
        next.set(path, entries);
        return next;
      });
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  function toggleDir(entry: DirEntry): void {
    const path = entry.path;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        void loadChildren(path);
      }
      return next;
    });
  }

  async function openFile(entry: DirEntry): Promise<void> {
    // Let any pending autosave of the previous file land before reading.
    await saveChainRef.current;
    openSeqRef.current += 1;
    setSelectedPath(entry.path);
    setError(null);
    setNotice(null);
    setSaveError(null);
    setSavedFlash(false);
    setFileContent(null);
    setDraft("");
    try {
      const content = await api.readFile(dir, entry.path);
      setFileContent(content);
      setDraft(content.binary ? "" : content.content);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  /** Every keystroke writes to disk immediately (serialized, no debounce). */
  const autosave = (text: string): void => {
    // Truncated previews are read-only: writing the preview back would destroy
    // the rest of the file.
    if (selectedPath === null || fileContent === null || fileContent.binary || fileContent.truncated) return;
    const path = selectedPath;
    const seq = openSeqRef.current;
    setSavedFlash(false);
    setSaveError(null);
    saveChainRef.current = saveChainRef.current
      .then(async () => {
        await api.writeFile(dir, path, text);
        // Keep the baseline in sync so a later re-read matches the disk.
        if (openSeqRef.current === seq) {
          setFileContent((prev) => (prev === null ? prev : { ...prev, content: text }));
        }
      })
      .then(() => {
        if (openSeqRef.current === seq) flashSaved();
      })
      .catch((caught: unknown) => {
        if (openSeqRef.current === seq) setSaveError((caught as Error).message);
      });
  };

  /** Brief "saved" feedback after the write-back lands. */
  const flashSaved = (): void => {
    setSavedFlash(true);
    if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedFlash(false), 1200);
  };

  /** New file lives under the selected dir, else the selected file's dir, else root. */
  function newFile(): void {
    if (dir === "") return;
    let base = "";
    if (selectedPath !== null) {
      const lastSlash = selectedPath.lastIndexOf("/");
      base = lastSlash >= 0 ? selectedPath.slice(0, lastSlash) : "";
    }
    const name = window.prompt(t("files.newPrompt", { base: base === "" ? "/" : base }));
    if (name === null || name.trim() === "") return;
    const path = base === "" ? name.trim() : base + "/" + name.trim();
    setBusy(true);
    setError(null);
    setNotice(null);
    void (async () => {
      try {
        await api.writeFile(dir, path, "");
        setNotice(t("files.created", { path }));
        // Refresh the parent listing and open the new file.
        const parent = base;
        if (parent === "") {
          const entries = await api.listDir(dir);
          setRootEntries(entries);
        } else {
          await loadChildren(parent);
          setExpanded((prev) => new Set(prev).add(parent));
        }
        setSelectedPath(path);
        const content = await api.readFile(dir, path);
        openSeqRef.current += 1;
        setFileContent(content);
        setDraft("");
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setBusy(false);
      }
    })();
  }

  /** Delete the selected file, or a directory tree after confirmation. */
  function removeSelected(): void {
    if (selectedPath === null) return;
    const isDir = expanded.has(selectedPath);
    const message = isDir
      ? t("files.deleteDirConfirm", { path: selectedPath })
      : t("files.deleteConfirm", { path: selectedPath });
    if (!window.confirm(message)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    void (async () => {
      try {
        // Let any pending autosave land first so the delete cannot race a write.
        await saveChainRef.current;
        await api.deleteFile(dir, selectedPath, isDir ? true : undefined);
        setNotice(t("files.deleted", { path: selectedPath }));
        setSelectedPath(null);
        setFileContent(null);
        setDraft("");
        const lastSlash = selectedPath.lastIndexOf("/");
        const parent = lastSlash >= 0 ? selectedPath.slice(0, lastSlash) : "";
        if (parent === "") {
          const entries = await api.listDir(dir);
          setRootEntries(entries);
        } else {
          await loadChildren(parent);
        }
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setBusy(false);
      }
    })();
  }

  async function refresh(): Promise<void> {
    if (dir === "") return;
    setError(null);
    setNotice(null);
    try {
      const entries = await api.listDir(dir);
      setRootEntries(entries);
      setChildren(new Map());
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  /** Render one level of the tree (recursive through expanded dirs). */
  function renderLevel(entries: DirEntry[], depth: number): JSX.Element[] {
    const out: JSX.Element[] = [];
    for (const entry of entries) {
      const isDir = entry.kind === "dir";
      const isExpanded = isDir && expanded.has(entry.path);
      const childList = isDir ? children.get(entry.path) : undefined;
      const selected = entry.path === selectedPath;
      out.push(
        <div
          key={entry.path}
          className={"gitui-file" + (selected && !isDir ? " gitui-file-selected" : "")}
          style={{ paddingLeft: 12 + depth * 14 }}
          title={entry.path}
          onClick={() => {
            if (isDir) toggleDir(entry);
            else void openFile(entry);
          }}
        >
          <span className="gitui-tree-glyph">
            {isDir ? (
              <span className={isExpanded ? "gitui-tree-chev-rot" : ""}><Chevron down={isExpanded} /></span>
            ) : (
              <span className="gitui-tree-blank" />
            )}
          </span>
          <span className="gitui-tree-name">{isDir ? "📁 " + entry.name : "📄 " + entry.name}</span>
        </div>
      );
      if (isDir && isExpanded) {
        if (childList === undefined) {
          out.push(
            <div key={entry.path + ":loading"} className="gitui-tree-loading" style={{ paddingLeft: 26 + depth * 14 }}>
              …
            </div>
          );
        } else {
          out.push(...renderLevel(childList, depth + 1));
        }
      }
    }
    return out;
  }

  return (
    <div className="gitui-filetree">
      <div className="gitui-filetree-toolbar">
        <span className="gitui-filetree-dir" title={dir}>{dir === "" ? t("files.noDir") : dir}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="gitui-btn" disabled={dir === "" || busy} title={t("files.refresh")} onClick={() => void refresh()}>
          ↻
        </button>
        <button type="button" className="gitui-btn" disabled={dir === "" || busy} onClick={newFile}>
          {t("files.new")}
        </button>
        <button
          type="button"
          className="gitui-btn gitui-btn-danger"
          disabled={dir === "" || busy || selectedPath === null}
          onClick={removeSelected}
        >
          {t("files.delete")}
        </button>
      </div>
      <div className="gitui-filetree-body">
        {listHidden ? (
          <PaneRestoreBar
            title={t("pane.restore")}
            onRestore={() => onToggleListHidden?.()}
          />
        ) : (
          <>
          <div className="gitui-pane-col" style={{ width: splitWidth, flex: "none", maxWidth: "none", minWidth: 0 }}>
            <PaneMinBar title={t("pane.collapse")} onNarrow={() => onToggleListHidden?.()} />
            <div className="gitui-filetree-tree" style={{ flex: 1, minHeight: 0, minWidth: 0, width: "100%" }}>
              {dir === "" ? (
                <div className="gitui-diff-placeholder">{t("files.noDir")}</div>
              ) : rootEntries === null ? (
                <div className="gitui-diff-placeholder">…</div>
              ) : rootEntries.length === 0 ? (
                <div className="gitui-diff-placeholder">{t("files.empty")}</div>
              ) : (
                renderLevel(rootEntries, 0)
              )}
            </div>
          </div>
          <Splitter
            width={splitWidth}
            onChange={onSplitWidth}
            onReset={onSplitReset}
            title={t("splitter.resize")}
          />
          </>
        )}
        <div className="gitui-filetree-editor">
          {error !== null ? (
            <div className="gitui-error">{error}</div>
          ) : fileContent === null ? (
            <div className="gitui-diff-placeholder">{t("files.placeholder")}</div>
          ) : fileContent.binary ? (
            <div className="gitui-diff-placeholder">{t("files.binary")}</div>
          ) : (
            <>
              <div className="gitui-filetree-editor-header">
                <span className="gitui-file-path" title={selectedPath ?? ""}>{selectedPath}</span>
                <span style={{ flex: 1 }} />
                {fileContent.truncated && <span className="gitui-tree-warn">{t("files.truncated")}</span>}
                {saveError !== null && <span className="gitui-error">{saveError}</span>}
                {savedFlash && <span className="gitui-ok">{t("files.savedFlash")}</span>}
                {notice !== null && <span className="gitui-ok">{notice}</span>}
              </div>
              <textarea
                className="gitui-filetree-textarea"
                value={draft}
                spellCheck={false}
                disabled={busy}
                readOnly={fileContent.truncated}
                onChange={(event) => {
                  const text = event.target.value;
                  setDraft(text);
                  autosave(text);
                }}
                onBlur={() => {
                  // Flush pending writes, then let the panel refresh the status.
                  void saveChainRef.current.then(() => onChanged?.());
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
