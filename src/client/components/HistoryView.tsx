/**
 * History tab — modeled after the IntelliJ IDEA Git tool window's Log tab:
 * a colored commit graph on the left; filters (branch / author / date / text /
 * file); selecting a commit opens a details panel with the full commit
 * message, metadata, Changed Files, and the selected file's diff. A context
 * menu on each commit offers IDEA-style actions, including reset / checkout /
 * "show diff with working tree".
 */
import { useEffect, useRef, useState } from "react";
import type { GitApi } from "../api.js";
import type { CommitDetail, CommitInfo, DiffFile, GraphRow } from "../../types.js";
import { DiffView, type GitUiT } from "./DiffView.js";
import { Splitter } from "./Splitter.js";
import { SPLIT_MIN, gitUiSetFullscreen } from "../store.js";
import { Menu, type MenuItem } from "./Menu.js";

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  const [copied, setCopied] = useState(false);
  /** Compare mode: show the diff between this commit and the working tree. */
  const [worktreeMode, setWorktreeMode] = useState(false);
  /** Files of the worktree diff (all paths when worktreeMode). */
  const [worktreeFiles, setWorktreeFiles] = useState<Array<{ path: string }>>([]);
  /** Expand the commit body + full metadata (compact by default: bigger diff). */
  const [showInfo, setShowInfo] = useState(false);

  const [fileLimit, setFileLimit] = useState(200);
  const FILE_PAGE = 200;

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError(null);
    setFilePath(null);
    setDiffFiles(null);
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

  async function copyHash(): Promise<void> {
    try {
      await navigator.clipboard.writeText(detail?.hash ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

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
      <div className="gitui-detail-summary">
        <div className="gitui-commit-subject">{detail.subject}</div>
        <div className="gitui-commit-oneliner">
          <button type="button" className="gitui-meta-hash" onClick={() => void copyHash()} title={detail.hash}>
            {detail.short}
            {copied ? ` ✓` : ""}
          </button>
          <span>· {detail.author}{detail.authorEmail !== "" ? ` <${detail.authorEmail}>` : ""}</span>
          <span>· {formatDate(detail.authorDate)}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="gitui-btn" onClick={() => setShowInfo((current) => !current)}>
            {showInfo ? "▾" : "▸"} {showInfo ? t("history.hideInfo") : t("history.showInfo")}
          </button>
        </div>
        {showInfo && (
          <>
            {detail.body !== "" && <pre className="gitui-commit-body">{detail.body}</pre>}
            <div className="gitui-commit-meta">
              <div className="gitui-meta-row">
                <span className="gitui-meta-key">{t("log.author")}</span>
                <span>{detail.author}{detail.authorEmail !== "" ? ` <${detail.authorEmail}>` : ""}</span>
              </div>
              <div className="gitui-meta-row">
                <span className="gitui-meta-key">{t("log.date")}</span>
                <span>{formatDate(detail.authorDate)}</span>
              </div>
              {detail.parents.length > 0 && (
                <div className="gitui-meta-row">
                  <span className="gitui-meta-key">{t("log.parents")}</span>
                  <span className="gitui-meta-parents">
                    {detail.parents.map((parent) => (
                      <span key={parent} className="gitui-meta-hash">{parent.slice(0, 7)}</span>
                    ))}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      )}
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
                className={"gitui-changed-file" + (file.path === filePath ? " gitui-changed-file-selected" : "")}
                onClick={() => openFile(file.path)}
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
}): JSX.Element {
  const { api, dir, t, onChanged, splitWidth, onSplitWidth, onSplitReset, fileFilterInit, onFileFilterConsumed, fullscreen } = props;
  const [rows, setRows] = useState<GraphRow[] | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  /** Handle CommitDetailPanel's worktree-compare toggle for the context menu. */
  const detailWorktreeRef = useRef<(() => void) | undefined>(undefined);
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
  /** Context menu on a commit row. */
  const [menu, setMenu] = useState<{ x: number; y: number; hash: string } | null>(null);

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

  /** IDEA-style commit context menu. */
  function commitMenuItems(hash: string): MenuItem[] {
    return [
      {
        label: t("menu.copyHash"),
        onClick: () => void navigator.clipboard?.writeText(hash).catch(() => {})
      },
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
      },
      { separator: true, label: "" },
      {
        label: t("cherryPick"),
        onClick: () => {
          void api.cherryPick(dir, hash).then(onChanged).catch((caught) => setError((caught as Error).message));
        }
      },
      {
        label: t("revert"),
        onClick: () => {
          void api.revert(dir, hash).then(onChanged).catch((caught) => setError((caught as Error).message));
        }
      },
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
      }
    ];
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
            title={t("action.refresh")}
            onClick={() => {
              setRows(null);
              void (async () => {
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
              })();
            }}
          >
            {t("action.refresh")}
          </button>
          <input
            className="gitui-dir"
            value={query}
            placeholder={t("history.search")}
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
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
            rows
              .filter((row) => {
                const q = query.trim().toLowerCase();
                if (q === "") return true;
                return (
                  row.subject.toLowerCase().includes(q) ||
                  row.author.toLowerCase().includes(q) ||
                  row.short.toLowerCase().includes(q) ||
                  row.hash.toLowerCase().includes(q)
                );
              })
              .map((row) => (
              <div
                key={row.hash}
                className={"gitui-log-row" + (row.hash === selectedHash ? " gitui-log-row-selected" : "")}
                onClick={() => setSelectedHash(row.hash)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({ x: event.clientX, y: event.clientY, hash: row.hash });
                }}
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
                <span className="gitui-commit-meta">{formatDate(row.date)}</span>
              </div>
            ))}
          {error !== null && <div className="gitui-error">{error}</div>}
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
        <Menu x={menu.x} y={menu.y} items={commitMenuItems(menu.hash)} onClose={() => setMenu(null)} />
      )}
    </div>
    </div>
  );
}
