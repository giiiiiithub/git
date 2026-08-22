/**
 * History tab — modeled after the IntelliJ IDEA Git tool window's Log tab:
 * a colored commit graph on the left; filters (branch / author / date / text /
 * file); selecting a commit opens a details panel with the full commit
 * message, metadata, Changed Files, and the selected file's diff. A context
 * menu on each commit offers IDEA-style actions, including reset / checkout /
 * "show diff with working tree".
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { GitApi } from "../api.js";
import type { CommitDetail, CommitInfo, DiffFile, GraphRow, OperationOutcome } from "../../types.js";
import { DiffView, type GitUiT } from "./DiffView.js";
import { Splitter } from "./Splitter.js";
import { SPLIT_MIN, gitUiSetFullscreen } from "../store.js";
import { Menu, type MenuItem } from "./Menu.js";
import { Toast } from "./Toast.js";

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(2);
  return yy + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

/** Readable key:value text block of a commit, for "copy metadata". */
function buildMetadataText(t: GitUiT, d: CommitDetail): string {
  const lines: string[] = [
    d.short + " · " + d.hash,
    t("log.author") + ": " + d.author + (d.authorEmail !== "" ? " <" + d.authorEmail + ">" : ""),
    t("log.authorDate") + ": " + formatDate(d.authorDate),
    t("log.committer") + ": " + d.committer,
    t("log.commitDate") + ": " + formatDate(d.committerDate)
  ];
  if (d.parents.length > 0) lines.push(t("log.parents") + ": " + d.parents.join(", "));
  lines.push("", d.subject);
  if (d.body !== "") lines.push(d.body);
  if (d.files.length > 0) {
    lines.push(t("log.files") + " (" + d.files.length + ")");
    for (const file of d.files) {
      const head = "  " + (STATUS_LABEL[file.status] ?? file.status) + "  " + file.path;
      lines.push(file.additions !== null ? head + "  +" + file.additions + "/-" + (file.deletions ?? 0) : head);
    }
  }
  return lines.join("\n");
}

/** The full commit message (subject + body), for "copy commit message". */
function commitMessageText(d: CommitDetail): string {
  return d.body !== "" ? d.subject + "\n\n" + d.body : d.subject;
}

const STATUS_LABEL: Record<string, string> = {
  A: "A",
  M: "M",
  D: "D",
  R: "R",
  C: "C",
  T: "T",
  U: "U"
};

function CommitDetailPanel(props: {
  api: GitApi;
  dir: string;
  hash: string;
  t: GitUiT;
  onChanged: () => void;
  /** Maximized: the panel goes fullscreen and the detail splits keep growing. */
  diffFullscreen: boolean;
  onToggleDiffFullscreen: () => void;
  /** Changed-file pane width in px (user-draggable). */
  filesWidth: number;
  onFilesWidth: (width: number) => void;
  /** Exposes the worktree-compare toggle to the History context menu. */
  worktreeToggleRef?: React.MutableRefObject<(() => void) | undefined>;
}): JSX.Element {
  const { api, dir, hash, t, onChanged, diffFullscreen, onToggleDiffFullscreen, filesWidth, onFilesWidth, worktreeToggleRef } = props;
  const [detail, setDetail] = useState<CommitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [diffFiles, setDiffFiles] = useState<DiffFile[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  /** Compare mode: show the diff between this commit and the working tree. */
  const [worktreeMode, setWorktreeMode] = useState(false);
  /** Files of the worktree diff (all paths when worktreeMode). */
  const [worktreeFiles, setWorktreeFiles] = useState<Array<{ path: string }>>([]);
  /** Multi-select of changed-file paths (Ctrl/Cmd toggle, Shift range). */
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  /** Anchor for Shift+click range selection. */
  const [anchorPath, setAnchorPath] = useState<string | null>(null);
  /** Context menu on the changed-file list. */
  const [fileMenu, setFileMenu] = useState<{ x: number; y: number; paths: string[] } | null>(null);
  /** Busy while a "get from revision" runs. */
  const [busy, setBusy] = useState(false);

  const [fileLimit, setFileLimit] = useState(200);
  const FILE_PAGE = 200;

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError(null);
    setFilePath(null);
    setDiffFiles(null);
    setSelectedPaths([]);
    setAnchorPath(null);
    setFileMenu(null);
    setWorktreeMode(false);
    setWorktreeFiles([]);
    setFileLimit(200);
    api
      .commitDetail(dir, hash)
      .then((value) => {
        if (!alive) return;
        setDetail(value);
        // IDEA pre-selects the first changed file's diff.
        if (value.files.length > 0) {
          const first = value.files[0];
          setFilePath(first.path);
          setSelectedPaths([first.path]);
          setDiffLoading(true);
          api
            .commitDiff(dir, hash, first.path)
            .then((files) => {
              if (!alive) return;
              setDiffFiles(files);
            })
            .catch((caught) => {
              if (!alive) return;
              setDiffFiles(null);
              setError((caught as Error).message);
            })
            .finally(() => {
              if (alive) setDiffLoading(false);
            });
        }
      })
      .catch((caught) => {
        if (!alive) return;
        setError((caught as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [api, dir, hash]);

  function openFile(path: string): void {
    setFilePath(path);
    setDiffLoading(true);
    setDiffFiles(null);
    const load = worktreeMode
      ? api.diffWithWorktree(dir, hash, path)
      : api.commitDiff(dir, hash, path);
    load
      .then((files) => setDiffFiles(files))
      .catch((caught) => {
        setDiffFiles(null);
        setError((caught as Error).message);
      })
      .finally(() => setDiffLoading(false));
  }

  /** Toggle the "show diff with working tree" mode. */
  function toggleWorktreeMode(): void {
    if (!worktreeMode) {
      setWorktreeMode(true);
      setDiffLoading(true);
      setError(null);
      setFilePath(null);
      setDiffFiles(null);
      api
        .diffWithWorktree(dir, hash)
        .then((files) => {
          setWorktreeFiles(files.map((f) => ({ path: f.path })));
          const first = files[0];
          if (first !== undefined) {
            setFilePath(first.path);
            setSelectedPaths([first.path]);
            return api.diffWithWorktree(dir, hash, first.path).then((one) => setDiffFiles(one));
          }
          setDiffFiles([]);
          return undefined;
        })
        .catch((caught) => {
          setDiffFiles(null);
          setError((caught as Error).message);
        })
        .finally(() => setDiffLoading(false));
    } else {
      setWorktreeMode(false);
      setWorktreeFiles([]);
      if (detail !== null && detail.files.length > 0) {
        openFile(detail.files[0]?.path ?? "");
      }
    }
  }

  // Let the History context menu trigger the worktree-compare mode for the
  // selected commit (the diff pane owns the toggle logic and state).
  useEffect(() => {
    if (worktreeToggleRef !== undefined) {
      worktreeToggleRef.current = toggleWorktreeMode;
      return () => {
        worktreeToggleRef.current = undefined;
      };
    }
    return;
  });

  /** Detail container, measured for the changed-pane width drag. */
  const detailRef = useRef<HTMLDivElement>(null);
  /** Drag the divider between the changed-files pane and the diff. */
  const startHSplit = (event: React.MouseEvent): void => {
    event.preventDefault();
    const container = detailRef.current;
    const startX = event.clientX;
    const startWidth = filesWidth;
    const onMove = (move: MouseEvent): void => {
      const width = container?.getBoundingClientRect().width ?? 800;
      // Keep the diff readable: the pane never passes (width - 260px), and never under SPLIT_MIN.
      const max = Math.max(SPLIT_MIN, width - 260);
      const next = Math.min(max, Math.max(SPLIT_MIN, startWidth + move.clientX - startX));
      onFilesWidth(Math.round(next));
    };
    const onUp = (): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };



  if (error !== null) {
    return <div className="gitui-error" style={{ padding: 12 }}>{error}</div>;
  }
  if (detail === null) {
    return <div className="gitui-diff-placeholder">…</div>;
  }

  const fileList = worktreeMode ? worktreeFiles : detail.files.map((f) => ({ path: f.path, status: f.status }));
  const fileOrder = fileList.map((f) => f.path);

  // Multi-select handler for the changed-file list (Ctrl/Cmd toggle, Shift
  // range); the primary (last-clicked) file drives the diff.
  function selectFile(path: string, event?: React.MouseEvent): void {
    if (event !== undefined && (event.ctrlKey || event.metaKey)) {
      setSelectedPaths((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
      setAnchorPath(path);
      openFile(path);
    } else if (event !== undefined && event.shiftKey) {
      const anchor = anchorPath ?? path;
      const ia = fileOrder.indexOf(anchor);
      const ib = fileOrder.indexOf(path);
      const sel = ia >= 0 && ib >= 0 ? fileOrder.slice(Math.min(ia, ib), Math.max(ia, ib) + 1) : [path];
      setSelectedPaths(sel);
      setAnchorPath(path);
      openFile(path);
    } else {
      setSelectedPaths([path]);
      setAnchorPath(path);
      openFile(path);
    }
  }

  /** Checkout the selected file(s) at this commit's revision into the worktree. */
  function doGetFromRevision(paths: string[]): void {
    if (paths.length === 0 || busy) return;
    if (!window.confirm(t("getFromRevision.confirm", { rev: detail?.short ?? hash }))) return;
    setBusy(true);
    setError(null);
    void api.getFromRevision(dir, paths, hash)
      .then(() => onChanged())
      .catch((caught) => setError((caught as Error).message))
      .finally(() => setBusy(false));
  }

  /** Context menu for the changed-file list (acts on the whole selection). */
  function changedFileMenuItems(paths: string[]): MenuItem[] {
    return [
      { label: t("menu.showDiff"), onClick: () => openFile(paths[0] ?? "") },
      { label: t("getFromRevision.title"), onClick: () => doGetFromRevision(paths) },
      { label: t("menu.copyPath"), onClick: () => { void navigator.clipboard?.writeText(paths.join("\\n")).catch(() => {}); } }
    ];
  }

  /** The diff pane shared by the inline row and the fullscreen mode. */
  const diffPane = (
    <div className="gitui-commit-diff" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      <div className="gitui-detail-header">
        <span className="gitui-file-path">{filePath ?? ""}</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className={"gitui-btn" + (diffFullscreen ? " gitui-active" : "")}
          title={diffFullscreen ? t("win.exitFullscreen") : t("win.fullscreen")}
          onClick={onToggleDiffFullscreen}
        >
          {diffFullscreen ? "🗗" : "⛶"}
        </button>
      </div>
      {diffLoading ? (
        <div className="gitui-diff-placeholder">…</div>
      ) : (
        <DiffView
          file={diffFiles !== null && diffFiles.length > 0 ? diffFiles[0] : null}
          t={t}
          leftLabel={worktreeMode ? detail.short : detail.parents.length > 0 ? detail.parents[0].slice(0, 7) : t("diff.emptyTree")}
          rightLabel={worktreeMode ? t("diff.worktree") : detail.short}
        />
      )}
    </div>
  );

  return (
    <div className="gitui-commit-detail" ref={detailRef}>
      {!diffFullscreen && (
      <div className="gitui-detail-row">
        <div className="gitui-changed-pane" style={{ width: filesWidth, flex: "none" }}>
          <div className="gitui-changed-title">
            {worktreeMode ? t("log.worktreeFiles") : t("log.changedFiles")} ({fileList.length})
          </div>
          <div className="gitui-changed-files">
            {fileList.slice(0, fileLimit).map((file) => (
              <div
                key={file.path}
                className={"gitui-changed-file" + (selectedPaths.includes(file.path) ? " gitui-changed-file-selected" : "") + (filePath === file.path ? " gitui-changed-file-primary" : "")}
                onClick={(event) => selectFile(file.path, event)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  const paths = selectedPaths.includes(file.path) ? selectedPaths : [file.path];
                  setFileMenu({ x: event.clientX, y: event.clientY, paths });
                }}
              >
                {!worktreeMode && (
                  <span className={"gitui-file-status " + ((file as { status?: string }).status === "D" ? "gitui-st-deleted" : (file as { status?: string }).status === "A" ? "gitui-st-added" : (file as { status?: string }).status === "M" ? "gitui-st-modified" : "")}>
                    {STATUS_LABEL[(file as { status?: string }).status ?? ""] ?? (file as { status?: string }).status ?? ""}
                  </span>
                )}
                <span className="gitui-file-path">{file.path}</span>
              </div>
            ))}
            {fileList.length > fileLimit && (
              <button
                type="button"
                className="gitui-btn"
                style={{ margin: "6px 8px", width: "calc(100% - 16px)" }}
                onClick={() => setFileLimit((current) => current + FILE_PAGE)}
              >
                {t("log.showMore", { n: String(fileList.length - fileLimit) })}
              </button>
            )}
          </div>
        </div>
        <div className="gitui-hsplit" title={t("history.filePaneResize")} onMouseDown={startHSplit} />
        {diffPane}
      </div>
      )}
      {diffFullscreen && diffPane}
      {fileMenu !== null && (
        <Menu x={fileMenu.x} y={fileMenu.y} items={changedFileMenuItems(fileMenu.paths)} onClose={() => setFileMenu(null)} />
      )}
    </div>
  );
}

export function HistoryView(props: {
  api: GitApi;
  dir: string;
  t: GitUiT;
  onChanged: () => void;
  /** Left commit-list width in px (user-resizable). */
  splitWidth: number;
  onSplitWidth: (width: number) => void;
  /** Double-click on the splitter: back to the default width. */
  onSplitReset: () => void;
  /** File filter requested from a context menu elsewhere (e.g. Changes). */
  fileFilterInit?: string | null;
  onFileFilterConsumed?: () => void;
  /** Panel-level fullscreen flag (used to sync the diff-only mode). */
  fullscreen: boolean;
  /** Current branch shown in the panel title bar — the merge/rebase target. */
  currentBranch?: string | null;
  /** Open the interactive rebase dialog (fallback when the host lacks base support). */
  onOpenRebase?: (base?: string) => void;
  /** A merge/rebase/cherry-pick/revert stopped on conflicts: jump to the
   *  Merge tab so the user can resolve them. */
  onOpenConflicts?: () => void;
}): JSX.Element {
  const { api, dir, t, onChanged, splitWidth, onSplitWidth, onSplitReset, fileFilterInit, onFileFilterConsumed, fullscreen, currentBranch, onOpenRebase, onOpenConflicts } = props;
  const [rows, setRows] = useState<GraphRow[] | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  /** Multi-selection (Ctrl/Shift+click): hashes in click order. */
  const [selectedCommits, setSelectedCommits] = useState<string[]>([]);
  /** Anchor row index for Shift+click range selection. */
  const anchorIndexRef = useRef<number>(-1);
  /** Handle CommitDetailPanel's worktree-compare toggle for the context menu. */
  const detailWorktreeRef = useRef<(() => void) | undefined>(undefined);
  /** Hover popup: lazily loads the commit metadata for the row under the cursor. */
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; hash: string; detail: CommitDetail | null } | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const showHover = (event: React.MouseEvent, hash: string): void => {
    const { clientX, clientY } = event;
    setHoverInfo({ x: clientX, y: clientY, hash, detail: null });
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      void api.commitDetail(dir, hash)
        .then((d) => setHoverInfo((cur) => (cur !== null && cur.hash === hash ? { ...cur, detail: d } : cur)))
        .catch(() => setHoverInfo((cur) => (cur !== null && cur.hash === hash ? { ...cur, detail: null } : cur)));
    }, 180);
  };
  const hideHover = (): void => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    setHoverInfo(null);
  };
  const [error, setError] = useState<string | null>(null);
  /** Search filter over subject / author / hash. */
  const [query, setQuery] = useState("");
  /** When set, the list shows this file's history instead of the whole log. */
  const [filePathFilter, setFilePathFilter] = useState<string | null>(null);
  const [filePathInput, setFilePathInput] = useState("");
  /** Maximized: the panel goes fullscreen; the left list stays visible. */
  const [diffFullscreen, setDiffFullscreen] = useState(false);
  /** Changed-file pane width in px (user-draggable). */
  const [filesWidth, setFilesWidth] = useState(240);
  /** Busy while a "更多" merge/rebase runs. */
  const [busy, setBusy] = useState(false);
  /** Success/conflict feedback for the "更多" operations. */
  const [notice, setNotice] = useState<string | null>(null);
  /** "更多" dropdown menu anchor. */
  const [moreMenu, setMoreMenu] = useState<{ x: number; y: number } | null>(null);

  // Entering diff-only mode also puts the whole panel in fullscreen; exiting
  // through the panel titlebar (⛶) must leave the diff-only mode too.
  useEffect(() => {
    if (!fullscreen && diffFullscreen) setDiffFullscreen(false);
  }, [fullscreen, diffFullscreen]);

  // Leaving the tab while diff-only is active restores the panel.
  useEffect(() => {
    return () => {
      if (diffFullscreen) gitUiSetFullscreen(false);
    };
  }, [diffFullscreen]);

  const toggleDiffFullscreen = (): void => {
    const next = !diffFullscreen;
    setDiffFullscreen(next);
    gitUiSetFullscreen(next);
  };
  /** Log filters. */
  const [branchFilter, setBranchFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [sinceFilter, setSinceFilter] = useState("");
  const [untilFilter, setUntilFilter] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  /** Authors of the current branch filter range (dropdown options). */
  const [authors, setAuthors] = useState<Array<{ name: string; email: string; count: number }>>([]);
  /** Context menu on a commit row (right-click inside the selection acts on all of it). */
  const [menu, setMenu] = useState<{ x: number; y: number; hashes: string[] } | null>(null);

  // Author list follows the branch filter; clear the selection when the
  // selected author no longer exists in the new range.
  useEffect(() => {
    let alive = true;
    void api
      .logAuthors(dir, branchFilter === "" ? undefined : branchFilter)
      .then((list) => {
        if (!alive) return;
        setAuthors(list);
        if (authorFilter !== "" && !list.some((a) => a.name === authorFilter)) {
          setAuthorFilter("");
        }
      })
      .catch(() => {
        if (alive) setAuthors([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, dir, branchFilter]);

  useEffect(() => {
    if (fileFilterInit !== undefined && fileFilterInit !== null && fileFilterInit !== "") {
      setFilePathFilter(fileFilterInit);
      setFilePathInput(fileFilterInit);
      onFileFilterConsumed?.();
    }
  }, [fileFilterInit, onFileFilterConsumed]);

  useEffect(() => {
    let alive = true;
    void api
      .branches(dir)
      .then((value) => {
        if (!alive) return;
        // Local branches (bare names) + remote-tracking branches (prefixed
        // "remotes/<remote>/<branch>", a valid git rev), so the branch filter
        // dropdown can also target a remote branch.
        const names = value.branches.map((b) => b.name);
        setBranches(names);
        // Default the branch filter to the CURRENT branch (IDEA behavior);
        // never override a filter the user already picked.
        const current = value.current ?? "";
        setBranchFilter((prev) =>
          prev === "" && current !== "" && names.includes(current) ? current : prev
        );
      })
      .catch(() => setBranches([]));
    return () => {
      alive = false;
    };
  }, [api, dir]);

  useEffect(() => {
    let alive = true;
    setError(null);
    const filters = {
      ...(branchFilter !== "" ? { branch: branchFilter } : {}),
      ...(authorFilter !== "" ? { author: authorFilter } : {}),
      ...(sinceFilter !== "" ? { since: sinceFilter } : {}),
      ...(untilFilter !== "" ? { until: untilFilter } : {})
    };
    const load = async (): Promise<void> => {
      if (filePathFilter !== null) {
        const fileRows = await api.fileLog(dir, filePathFilter, 50).then((commits: CommitInfo[]) =>
          commits.map((c) => ({ graph: [] as GraphRow["graph"], ...c }))
        );
        if (!alive) return;
        setRows(fileRows);
        if (fileRows.length > 0) setSelectedHash((current) => current ?? fileRows[0].hash);
      } else {
        const graphRows = await api.logGraph(dir, 100, filters);
        if (!alive) return;
        setRows(graphRows);
        if (graphRows.length > 0) setSelectedHash((current) => current ?? graphRows[0].hash);
      }
    };
    void load().catch((caught) => {
      if (alive) setError((caught as Error).message);
    });
    return () => {
      alive = false;
    };
  }, [api, dir, filePathFilter, branchFilter, authorFilter, sinceFilter, untilFilter]);

  /** Rows after the search filter — the range a Shift+click extends over. */
  const filteredRows = useMemo<GraphRow[]>(() => {
    if (rows === null) return [];
    const q = query.trim().toLowerCase();
    if (q === "") return rows;
    return rows.filter(
      (row) =>
        row.subject.toLowerCase().includes(q) ||
        row.author.toLowerCase().includes(q) ||
        row.short.toLowerCase().includes(q) ||
        row.hash.toLowerCase().includes(q)
    );
  }, [rows, query]);

  /** hash → row lookup, for ordering multi-selection actions oldest-first. */
  const rowByHash = useMemo(() => new Map(filteredRows.map((row) => [row.hash, row])), [filteredRows]);

  /** Drop stale selections when the visible log changes (filters, rewrites). */
  useEffect(() => {
    if (rows === null) return;
    const alive = new Set(rows.map((row) => row.hash));
    setSelectedCommits((prev) => prev.filter((hash) => alive.has(hash)));
  }, [rows]);

  /** Row click with Ctrl/Shift multi-selection (IDEA-style). */
  function onRowClick(event: React.MouseEvent, hash: string, index: number): void {
    if (event.ctrlKey || event.metaKey) {
      // Toggle one commit; the detail panel follows the clicked row.
      setSelectedHash(hash);
      setSelectedCommits((prev) =>
        prev.includes(hash) ? prev.filter((h) => h !== hash) : [...prev, hash]
      );
      anchorIndexRef.current = index;
    } else if (event.shiftKey) {
      // Extend the selection from the anchor row to this one (inclusive).
      const anchor = anchorIndexRef.current >= 0 ? anchorIndexRef.current : index;
      const start = Math.min(anchor, index);
      const end = Math.max(anchor, index);
      setSelectedHash(hash);
      setSelectedCommits(filteredRows.slice(start, end + 1).map((row) => row.hash));
      anchorIndexRef.current = index;
    } else {
      setSelectedHash(hash);
      setSelectedCommits([hash]);
      anchorIndexRef.current = index;
    }
  }

  /** IDEA-style commit context menu; `hashes` is the whole selection. */
  function commitMenuItems(hashes: string[]): MenuItem[] {
    const single = hashes.length <= 1;
    const hash = hashes[0] ?? "";
    const items: MenuItem[] = [];
    if (!single) {
      items.push({ label: t("history.selectedCount", { n: String(hashes.length) }), disabled: true });
    }
    items.push({
      label: single ? t("menu.copyHash") : t("menu.copyHashes"),
      onClick: () => void navigator.clipboard?.writeText(hashes.join("\n")).catch(() => {})
    });
    if (single) {
      items.push(
        { separator: true, label: "" },
        {
          label: t("menu.checkoutRevision"),
          onClick: () => {
            if (window.confirm(t("menu.checkoutRevisionConfirm", { hash: hash.slice(0, 7) }))) {
              void api.checkout(dir, hash).then(onChanged).catch((caught) => setError((caught as Error).message));
            }
          }
        },
        {
          label: t("menu.createBranchHere"),
          onClick: () => {
            const name = window.prompt(t("menu.createBranchHerePrompt"), "");
            if (name !== null && name.trim() !== "") {
              void api.checkout(dir, name.trim(), true, hash).then(onChanged).catch((caught) => setError((caught as Error).message));
            }
          }
        },
        {
          label: t("menu.resetToHere"),
          children: (["soft", "mixed", "hard"] as const).map((mode) => ({
            label: mode,
            danger: mode === "hard",
            onClick: () => void api.reset(dir, mode, hash).then(onChanged).catch((caught) => setError((caught as Error).message))
          }))
        }
      );
    }
    items.push({ separator: true, label: "" });
    // git applies multi-arg operations oldest-first — order the selection so.
    const ordered = [...hashes].sort(
      (a, b) => (rowByHash.get(a)?.date ?? 0) - (rowByHash.get(b)?.date ?? 0)
    );
    const runOperation = (operation: (list: string[]) => Promise<OperationOutcome>): void => {
      void (async () => {
        try {
          const outcome = await operation(ordered);
          if (outcome.done === false && (outcome.conflicts?.length ?? 0) > 0) {
            await api.refreshStatus(dir);
            onOpenConflicts?.();
          } else {
            onChanged();
          }
        } catch (caught) {
          setError((caught as Error).message);
        }
      })();
    };
    items.push(
      {
        label: single ? t("cherryPick") : t("cherryPick.multi", { n: String(hashes.length) }),
        onClick: () => runOperation((list) => api.cherryPick(dir, list))
      },
      {
        label: single ? t("revert") : t("revert.multi", { n: String(hashes.length) }),
        onClick: () => runOperation((list) => api.revert(dir, list))
      }
    );
    if (!single) {
      items.push({
        label: t("squash.multi", { n: String(hashes.length) }),
        onClick: () => {
          const first = rowByHash.get(ordered[0] ?? "");
          const message = window.prompt(t("squash.prompt"), first?.subject ?? "");
          if (message === null) return; // cancelled
          void (async () => {
            try {
              await api.squashCommits(dir, ordered, message);
              setNotice(t("squash.done"));
              await refreshRows();
              onChanged();
            } catch (caught) {
              setError((caught as Error).message);
            }
          })();
        }
      });
    }
    if (single) {
      items.push(
        {
          label: t("tag.create"),
          onClick: () => {
            const name = window.prompt(t("tag.createPrompt"), "");
            if (name !== null && name.trim() !== "") {
              void api.tagCreate(dir, name.trim(), hash).catch((caught) => setError((caught as Error).message));
            }
          }
        },
        {
          label: t("log.worktreeDiff"),
          disabled: hash !== selectedHash,
          onClick: () => detailWorktreeRef.current?.()
        },
        { separator: true, label: "" },
        {
          label: t("menu.copyMetadata"),
          onClick: () => {
            void api.commitDetail(dir, hash).then((d) => navigator.clipboard?.writeText(buildMetadataText(t, d))).catch(() => {});
          }
        },
        {
          label: t("menu.copyMessage"),
          onClick: () => {
            void api.commitDetail(dir, hash).then((d) => navigator.clipboard?.writeText(commitMessageText(d))).catch(() => {});
          }
        }
      );
    }
    return items;
  }

  /** Reload the commit list with the current filters. */
  async function refreshRows(): Promise<void> {
    try {
      const filters = {
        ...(branchFilter !== "" ? { branch: branchFilter } : {}),
        ...(authorFilter !== "" ? { author: authorFilter } : {}),
        ...(sinceFilter !== "" ? { since: sinceFilter } : {}),
        ...(untilFilter !== "" ? { until: untilFilter } : {})
      };
      const graphRows = filePathFilter !== null
        ? await api.fileLog(dir, filePathFilter, 50).then((cs: CommitInfo[]) => cs.map((c) => ({ graph: [] as GraphRow["graph"], ...c })))
        : await api.logGraph(dir, 100, filters);
      setRows(graphRows);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  /** Merge the branch selected in the branch filter into the current branch. */
  async function mergeToCurrentBranch(): Promise<void> {
    if (dir === "" || currentBranch === null || currentBranch === undefined) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const outcome = await api.merge(dir, branchFilter);
      if (outcome.kind === "conflicts") {
        await api.refreshStatus(dir);
        onOpenConflicts?.();
      } else if (outcome.kind === "error") {
        setError(outcome.message ?? "merge failed");
      } else {
        setNotice(t("history.merged", { from: branchFilter, to: currentBranch }));
      }
      await refreshRows();
      onChanged();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Check out the filtered branch and rebase it onto the current branch. */
  async function rebaseToCurrentBranch(): Promise<void> {
    if (dir === "" || currentBranch === null || currentBranch === undefined) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.checkout(dir, branchFilter);
      onChanged();
      // The host honors the explicit base only after the matching update is
      // loaded; otherwise (old host) fall back to the interactive dialog so no
      // rebase runs against a mismatched commit list.
      let list: { base: string; commits: CommitInfo[] } | null = null;
      try {
        list = await api.rebaseList(dir, currentBranch);
      } catch {
        list = null;
      }
      if (list === null || list.base !== currentBranch) {
        onOpenRebase?.(currentBranch);
        return;
      }
      if (list.commits.length === 0) {
        setNotice(t("rebase.nothing"));
        return;
      }
      const items = list.commits.map((c) => ({ action: "pick" as const, hash: c.hash }));
      const outcome = await api.rebaseStart(dir, currentBranch, items);
      if (outcome.conflicts !== undefined && outcome.conflicts.length > 0) {
        await api.refreshStatus(dir);
        onOpenConflicts?.();
      } else {
        setNotice(t("history.rebased", { from: branchFilter, to: currentBranch }));
      }
      await refreshRows();
      onChanged();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Check out the branch selected in the branch filter. */
  async function checkoutFilteredBranch(): Promise<void> {
    if (dir === "" || branchFilter === "") return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (branchFilter.startsWith("remotes/")) {
        // Remote branch: check out its local counterpart (created when
        // missing) and pull the latest — same path as the title-bar switcher.
        const outcome = await api.pullRemoteBranch(dir, branchFilter);
        setNotice(t("remoteBranch.pulled", { branch: outcome.branch }));
      } else {
        await api.checkout(dir, branchFilter);
        setNotice(t("branch.switched", { name: branchFilter }));
      }
      await refreshRows();
      onChanged();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Pull the branch selected in the branch filter. When it is not checked
   *  out yet, switch to it first so the pull applies to that branch. */
  async function pullFilteredBranch(): Promise<void> {
    if (dir === "" || branchFilter === "") return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (branchFilter.startsWith("remotes/")) {
        const outcome = await api.pullRemoteBranch(dir, branchFilter);
        setNotice(t("remoteBranch.pulled", { branch: outcome.branch }));
        await refreshRows();
        onChanged();
        return;
      }
      if (branchFilter !== currentBranch) {
        await api.checkout(dir, branchFilter);
      }
      const remotes = await api.remotes(dir);
      const remote = remotes[0]?.name ?? "";
      if (remote === "") {
        setError(t("pull.noRemote"));
        return;
      }
      const outcome = await api.pull(dir, remote, branchFilter, "merge");
      if (outcome.kind === "conflicts") {
        await api.refreshStatus(dir);
        onOpenConflicts?.();
      } else if (outcome.kind === "already-up-to-date") {
        setNotice(t("pull.upToDate"));
      } else if (outcome.kind === "error") {
        setError(outcome.message ?? t("pull.failed"));
      } else {
        setNotice(t("pull.done"));
      }
      await refreshRows();
      onChanged();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Branch filter options: local branches (bare names) + remote-tracking
  // branches (prefixed "remotes/<remote>/<branch>"), grouped in the dropdown.
  const localBranchOptions = branches.filter((b) => !b.startsWith("remotes/"));
  const remoteBranchOptions = branches.filter((b) => b.startsWith("remotes/"));

  return (
    <div className="gitui-history">
      <div className="gitui-history-tools">
          <button
            type="button"
            className="gitui-btn"
            title={t("history.moreHint")}
            disabled={busy || dir === ""}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setMoreMenu({ x: rect.left, y: rect.bottom + 4 });
            }}
          >
            🔀
          </button>
          <select
            className="gitui-dir"
            value={branchFilter}
            title={t("history.branch")}
            onChange={(event) => setBranchFilter(event.target.value)}
          >
            <option value="">{t("history.allBranches")}</option>
            <optgroup label={t("branch.local")}>
              {localBranchOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </optgroup>
            {remoteBranchOptions.length > 0 && (
              <optgroup label={t("branch.remote")}>
                {remoteBranchOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <select
            className="gitui-dir"
            value={authorFilter}
            title={t("history.author")}
            onChange={(event) => setAuthorFilter(event.target.value)}
          >
            <option value="">{t("history.allAuthors")}</option>
            {authors.map((author) => (
              <option key={author.name + "\u0000" + author.email} value={author.name}>
                {author.name} ({author.count})
              </option>
            ))}
          </select>
          <input
            className="gitui-dir"
            type="date"
            value={sinceFilter}
            title={t("history.since")}
            onChange={(event) => setSinceFilter(event.target.value)}
          />
          <input
            className="gitui-dir"
            type="date"
            value={untilFilter}
            title={t("history.until")}
            onChange={(event) => setUntilFilter(event.target.value)}
          />
          <input
            className="gitui-dir"
            value={query}
            placeholder={t("history.search")}
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
          <input
            className="gitui-dir"
            value={filePathInput}
            placeholder={t("history.fileFilter")}
            spellCheck={false}
            onChange={(event) => setFilePathInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setFilePathFilter(filePathInput.trim() === "" ? null : filePathInput.trim());
            }}
          />
          {filePathFilter !== null && (
            <button type="button" className="gitui-btn" onClick={() => { setFilePathFilter(null); setFilePathInput(""); }}>
              ✕ {t("history.fileFilterClear")}
            </button>
          )}
          <button
            type="button"
            className="gitui-btn"
            style={{ marginLeft: "auto" }}
            title={t("action.refresh")}
            onClick={() => {
              setRows(null);
              void refreshRows();
            }}
          >
            {t("action.refresh")}
          </button>
        </div>
        <div className="gitui-history-layout">
          <div
            className="gitui-history-side"
            style={{ width: splitWidth, minWidth: 0, maxWidth: "none" }}
          >
            <div className="gitui-history-list">
          {rows === null && <div className="gitui-diff-placeholder">…</div>}
          {rows !== null && rows.length === 0 && (
            <div className="gitui-diff-placeholder">{t("history.empty")}</div>
          )}
          {rows !== null &&
            filteredRows.map((row, index) => (
              <div
                key={row.hash}
                className={
                  "gitui-log-row" +
                  (row.hash === selectedHash ? " gitui-log-row-selected" : "") +
                  (selectedCommits.includes(row.hash) ? " gitui-log-row-multi" : "")
                }
                onClick={(event) => onRowClick(event, row.hash, index)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  // Right-clicking inside the selection acts on all of it.
                  const hashes = selectedCommits.includes(row.hash) ? selectedCommits : [row.hash];
                  setMenu({ x: event.clientX, y: event.clientY, hashes });
                }}
                onMouseEnter={(event) => showHover(event, row.hash)}
                onMouseLeave={hideHover}
              >
                <span className="gitui-log-graph" title={row.subject}>
                  {row.graph.length === 0
                    ? " "
                    : row.graph.map((char, index) => {
                        const isLine = "|/\\│├└┌┐┘┴┬┼╱╲".includes(char.ch);
                        const cls = isLine ? " gitui-graph-line" : "";
                        return char.color !== undefined ? (
                          <span key={index} className={cls} style={{ color: char.color }}>{char.ch}</span>
                        ) : (
                          <span key={index} className={cls}>{char.ch}</span>
                        );
                      })}
                </span>
                {row.refs !== "" && <span className="gitui-log-refs" title={row.refs}>{row.refs.split(", ").slice(0, 2).join(", ")}</span>}
                <span className="gitui-commit-subject" title={row.subject}>
                  {row.subject}
                </span>
                <span className="gitui-commit-meta">{row.author}</span>
                <span className="gitui-commit-meta">{formatShortDate(row.date)}</span>
              </div>
            ))}
        </div>
      </div>
      <Splitter
        width={splitWidth}
        onChange={onSplitWidth}
        onReset={onSplitReset}
        title={t("splitter.resize")}
      />
      <div className="gitui-history-detail">
        {selectedHash === null ? (
          <div className="gitui-diff-placeholder">{t("log.select")}</div>
        ) : (
          <CommitDetailPanel
            api={api}
            dir={dir}
            hash={selectedHash}
            t={t}
            onChanged={onChanged}
            diffFullscreen={diffFullscreen}
            onToggleDiffFullscreen={toggleDiffFullscreen}
            filesWidth={filesWidth}
            onFilesWidth={setFilesWidth}
            worktreeToggleRef={detailWorktreeRef}
          />
        )}
      </div>
      {menu !== null && (
        <Menu x={menu.x} y={menu.y} items={commitMenuItems(menu.hashes)} onClose={() => setMenu(null)} />
      )}
      {moreMenu !== null && (
        <Menu
          x={moreMenu.x}
          y={moreMenu.y}
          items={[
            {
              label: t("history.checkoutBranch", { branch: branchFilter }),
              disabled: busy || branchFilter === "" || branchFilter === currentBranch,
              onClick: () => void checkoutFilteredBranch()
            },
            {
              label: t("history.pullBranch", { branch: branchFilter }),
              disabled: busy || branchFilter === "",
              onClick: () => void pullFilteredBranch()
            },
            { separator: true, label: "" },
            {
              label: t("history.mergeToCurrent", { from: branchFilter, to: currentBranch ?? "" }),
              disabled: busy || branchFilter === "" || !currentBranch || branchFilter === currentBranch,
              onClick: () => void mergeToCurrentBranch()
            },
            {
              label: t("history.rebaseToCurrent", { from: branchFilter, to: currentBranch ?? "" }),
              disabled:
                busy ||
                branchFilter === "" ||
                !currentBranch ||
                branchFilter === currentBranch ||
                branchFilter.startsWith("remotes/"),
              onClick: () => void rebaseToCurrentBranch()
            }
          ]}
          onClose={() => setMoreMenu(null)}
        />
      )}
      <Toast message={error !== null ? error : notice} tone={error !== null ? "error" : "ok"} />
      </div>
      {hoverInfo !== null && (
        <div
          className="gitui-hover-card"
          style={{
            left: Math.min(hoverInfo.x + 14, window.innerWidth - 400),
            top: Math.min(hoverInfo.y + 10, window.innerHeight - (hoverInfo.detail ? 340 : 30))
          }}
        >
          {hoverInfo.detail === null ? (
            <span className="gitui-hover-more">…</span>
          ) : (
            <div className="gitui-hover-card-body">
              <div className="gitui-hover-hash">{hoverInfo.detail.short + " · " + hoverInfo.detail.hash}</div>
              <div className="gitui-hover-row"><span className="gitui-hover-k">{t("log.author")}</span><span className="gitui-hover-v">{hoverInfo.detail.author + (hoverInfo.detail.authorEmail !== "" ? " <" + hoverInfo.detail.authorEmail + ">" : "")}</span></div>
              <div className="gitui-hover-row"><span className="gitui-hover-k">{t("log.authorDate")}</span><span className="gitui-hover-v">{formatDate(hoverInfo.detail.authorDate)}</span></div>
              <div className="gitui-hover-row"><span className="gitui-hover-k">{t("log.committer")}</span><span className="gitui-hover-v">{hoverInfo.detail.committer}</span></div>
              <div className="gitui-hover-row"><span className="gitui-hover-k">{t("log.commitDate")}</span><span className="gitui-hover-v">{formatDate(hoverInfo.detail.committerDate)}</span></div>
              {hoverInfo.detail.parents.length > 0 && (
                <div className="gitui-hover-row"><span className="gitui-hover-k">{t("log.parents")}</span><span className="gitui-hover-v">{hoverInfo.detail.parents.join(", ")}</span></div>
              )}
              <div className="gitui-hover-msg">
                <div className="gitui-commit-subject">{hoverInfo.detail.subject}</div>
                {hoverInfo.detail.body !== "" && <div>{hoverInfo.detail.body}</div>}
              </div>
              {hoverInfo.detail.files.length > 0 && (
                <div className="gitui-hover-files">
                  <div className="gitui-hover-files-label">{t("log.files") + " (" + hoverInfo.detail.files.length + ")"}</div>
                  {hoverInfo.detail.files.slice(0, 20).map((file) => (
                    <div key={file.path} className="gitui-hover-file">
                      <span className="gitui-hover-st">{STATUS_LABEL[file.status] ?? file.status}</span>
                      <span className="gitui-hover-path">{file.path}</span>
                      {file.additions !== null && <span className="gitui-hover-num">{file.additions + " / -" + (file.deletions ?? 0)}</span>}
                    </div>
                  ))}
                  {hoverInfo.detail.files.length > 20 && <div className="gitui-hover-more">{t("log.showMore", { n: hoverInfo.detail.files.length - 20 })}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
