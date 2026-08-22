/**
 * GitPanel — the dock occupant: opened via the session-header Git action (no
 * collapsed bar is rendered while closed). A three-tab workspace (Changes /
 * Merge / History) with a file list + diff viewer + commit form, IDEA-style.
 *
 * The panel has a FIXED user-resizable height (drag the bottom handle) — it
 * never auto-resizes with content. The title bar carries window controls
 * (minimize / fullscreen / close); the panel can also detach into a floating
 * window (drag the title bar) like an IDE tool window.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GitApi } from "../api.js";
import type { ChangelistEntry, ChangeFile, DiffFile, PartialHunkCommit, RemoteInfo, RepoStatus, WsFlags } from "../../types.js";
import { NO_WS_FLAGS, wsFlagsActive } from "../../types.js";
import { Menu, type MenuItem } from "./Menu.js";
import { PushDialog } from "./PushDialog.js";
import { RebaseDialog } from "./RebaseDialog.js";
import { CloneDialog } from "./CloneDialog.js";
import { GetFromRevisionDialog } from "./GetFromRevisionDialog.js";
import { createPortal } from "react-dom";
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  GIT_UI_MAX_HEIGHT,
  GIT_UI_MAX_WIDTH,
  GIT_UI_MIN_HEIGHT,
  GIT_UI_MIN_WIDTH,
  SPLIT_DEFAULTS,
  SPLIT_MIN,
  gitUiAddRecentDir,
  gitUiAdjustFontScale,
  gitUiFollowCwd,
  gitUiRemoveRecentDir,
  gitUiSetDir,
  gitUiSetFloating,
  gitUiSetFloatMaximized,
  gitUiSetFloatPos,
  gitUiSetFloatWidth,
  gitUiSetFollowSession,
  gitUiSetFullscreen,
  gitUiSetOpen,
  gitUiSetPanelHeight,
  gitUiSetSplitWidth,
  gitUiSetStatus,
  useGitUi
} from "../store.js";
import { PaneMinBar, PaneRestoreBar, Splitter } from "./Splitter.js";
import { Toast } from "./Toast.js";
import { DiffView, CommitBox, type GitUiT } from "./DiffView.js";
import { MergeView } from "./MergeView.js";
import { HistoryView } from "./HistoryView.js";
import { StashView } from "./StashView.js";
import { BranchesView } from "./BranchesView.js";
import { CommitPlan } from "./CommitPlan.js";
import { RemoteView } from "./RemoteView.js";
import { ConfigView } from "./ConfigView.js";
import { FileTreeView } from "./FileTreeView.js";
import type { ExecutedCommit } from "../../types.js";

const STATUS_GLYPH: Record<ChangeFile["status"], string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
  typechange: "T",
  unmerged: "U"
};

const STATUS_CLASS: Record<ChangeFile["status"], string> = {
  added: "gitui-st-added",
  modified: "gitui-st-modified",
  deleted: "gitui-st-deleted",
  renamed: "gitui-st-modified",
  copied: "gitui-st-modified",
  typechange: "gitui-st-modified",
  unmerged: "gitui-st-unmerged"
};

/** Compact a long path for the titlebar input: keep only the tail segments
 *  (e.g. C:/a/b/c/d → …/c/d). The full path stays in the title tooltip. */
function shortenPath(path: string, maxSegments = 2): string {
  if (path === "") return path;
  const parts = path.split(/[\\/]/).filter((part) => part !== "");
  if (parts.length <= maxSegments + 1) return path;
  return "…/" + parts.slice(-maxSegments).join("/");
}

/** Measure the host conversation's content area for resize clamping:
 *  the header/tabs bottom (top) and the composer input-card top (bottom). */
function measureContentBounds(): { top: number; bottom: number } {
  const seat = document.querySelector("[data-composer-seat]");
  const root = seat?.parentElement?.parentElement;
  const header = root?.querySelector(":scope > header") ?? root?.querySelector("header");
  const card = document.querySelector("[data-composer-card]") ?? seat?.querySelector("[data-composer-card]");
  const top = header?.getBoundingClientRect().bottom ?? 0;
  const bottom = card?.getBoundingClientRect().top ?? window.innerHeight;
  return { top, bottom };
}

interface FileRowProps {
  file: ChangeFile;
  /** Leaf name shown in the tree; full path stays in the title. */
  displayName?: string;
  selected: boolean;
  t: GitUiT;
  onSelect: (event: React.MouseEvent) => void;
  actions?: Array<{ label: string; danger?: boolean; title?: string; run: () => void }>;
  /** Tree nesting depth; 0 = top level. */
  depth?: number;
  /** IDEA-style commit checkbox. */
  checked?: boolean;
  onToggleChecked?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}

function FileRow(props: FileRowProps): JSX.Element {
  const { file, selected, t, onSelect, actions, displayName, depth = 0, checked, onToggleChecked, onContextMenu } = props;
  return (
    <div
      className={"gitui-file" + (selected ? " gitui-file-selected" : "")}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      title={file.path}
      style={{ paddingLeft: 12 + depth * 14 }}
    >
      <input
        type="checkbox"
        className="gitui-check"
        checked={checked !== false}
        title={t("tree.check")}
        onChange={(event) => {
          event.stopPropagation();
          onToggleChecked?.();
        }}
        onClick={(event) => event.stopPropagation()}
      />
      <span className={"gitui-file-status " + (STATUS_CLASS[file.status] ?? "")}>
        {STATUS_GLYPH[file.status] ?? "?"}
      </span>
      <span className="gitui-file-path">{displayName ?? file.path}</span>
      {actions?.map((action) => (
        <button
          key={action.label}
          type="button"
          className={"gitui-file-action" + (action.danger === true ? " gitui-btn-danger" : "")}
          title={action.title ?? action.label}
          onClick={(event) => {
            event.stopPropagation();
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

// ── directory tree over a change list ────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  /** null = file leaf; array = directory node. */
  children: TreeNode[] | null;
  file: ChangeFile | null;
}

/** Build a sorted directory tree (directories first, then files, both by name). */
function buildTree(files: ChangeFile[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const byPath = new Map<string, TreeNode>();
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    const parts = file.path.split("/");
    let level = roots;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? "";
      acc = acc === "" ? part : `${acc}/${part}`;
      if (i === parts.length - 1) {
        level.push({ name: part, path: acc, children: null, file });
      } else {
        let node = byPath.get(acc);
        if (node === undefined) {
          node = { name: part, path: acc, children: [], file: null };
          byPath.set(acc, node);
          level.push(node);
        }
        level = node.children as TreeNode[];
      }
    }
  }
  const sortLevel = (nodes: TreeNode[]): void => {
    nodes.sort((a, b) => {
      const aDir = a.children !== null ? 0 : 1;
      const bDir = b.children !== null ? 0 : 1;
      return aDir - bDir || a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children !== null) sortLevel(node.children);
    }
  };
  sortLevel(roots);
  return roots;
}

/** Collect every directory path in the tree (for expand/collapse-all). */
function collectDirs(nodes: TreeNode[], into: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children !== null) {
      into.push(node.path);
      collectDirs(node.children, into);
    }
  }
  return into;
}

/** IDEA-style tree arrow: solid triangle, down when expanded, right when collapsed. */
function TreeArrow(props: { expanded: boolean }): JSX.Element {
  const { expanded } = props;
  return (
    <svg
      className="gitui-dir-arrow"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      {expanded ? (
        // ▼ down triangle
        <path d="M2.6 4.2 L6 8.2 L9.4 4.2 Z" fill="currentColor" />
      ) : (
        // ▶ right triangle
        <path d="M4.2 2.6 L8.2 6 L4.2 9.4 Z" fill="currentColor" />
      )}
    </svg>
  );
}

/**
 * IDEA expand-all / collapse-all glyphs (copied from IntelliJ IDEA's official
 * expandAll.svg / collapseAll.svg): two stroked chevrons — pointing right for
 * expand, pointing down for collapse.
 */
function GroupChevron(props: { down?: boolean }): JSX.Element {
  const { down } = props;
  return (
    <svg className="gitui-group-chev" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {down === true ? (
        <>
          <path d="M4.5 2.5 L8 6 L11.5 2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.5 13.5 L8 10 L11.5 13.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M4.5 5.5 L8 2 L11.5 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.5 10.5 L8 14 L11.5 10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

// ── virtualized change tree ─────────────────────────────────────────────────
// The change list flattens to fixed-height rows (group titles + tree rows) and
// only the viewport slice is rendered, so thousands of files stay smooth.

/** Fixed row height shared by every tree row (kept in sync with the CSS). */
const ROW_HEIGHT = 24;

interface TreeRow {
  key: string;
  kind: "title" | "dir" | "file";
  title?: string;
  count?: number;
  dirs?: string[];
  node?: TreeNode;
  file?: ChangeFile;
  displayName?: string;
  /** Tree nesting depth: 0 for top-level entries, +1 per ancestor dir. */
  depth: number;
  /** Scoped collapse key (group + dir path). */
  collapseKey?: string;
  /** Changelist name for title rows. */
  changelist?: string;
}

/** Flatten a tree into rows, skipping collapsed subtrees entirely.
 *  Collapse keys are scoped per group (changelist), so the same directory in
 *  two changelists folds independently. */
function flattenTreeRows(nodes: TreeNode[], collapsed: Set<string>, out: TreeRow[], group: string, depth = 0): void {
  for (const node of nodes) {
    if (node.children === null) {
      out.push({ key: `f:${group}:${node.path}`, kind: "file", file: node.file as ChangeFile, displayName: node.name, depth });
    } else {
      const ckey = group + "\u0000" + node.path;
      out.push({ key: `d:${group}:${node.path}`, kind: "dir", node, depth, collapseKey: ckey });
      if (!collapsed.has(ckey)) flattenTreeRows(node.children, collapsed, out, group, depth + 1);
    }
  }
}

/** Fixed-height windowed list: renders only the viewport slice + buffer. */
function VirtualRows(props: {
  rows: TreeRow[];
  rowHeight: number;
  renderRow: (row: TreeRow) => JSX.Element;
  /** Extra styles for the scroll container (e.g. the resizable list width). */
  style?: React.CSSProperties;
}): JSX.Element {
  const { rows, rowHeight, renderRow, style } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el === null) return;
    const update = (): void => setViewport(el.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const total = rows.length * rowHeight;
  const buffer = 10;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewport) / rowHeight) + buffer);
  const slice = rows.slice(start, end);

  return (
    <div
      ref={scrollRef}
      className="gitui-files"
      style={style}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: total, position: "relative" }}>
        <div style={{ position: "absolute", top: start * rowHeight, left: 0, right: 0 }}>
          {slice.map(renderRow)}
        </div>
      </div>
    </div>
  );
}

/** IDEA refresh glyph (refresh.svg): two circular arrows with arrowheads. */
function RefreshIcon(): JSX.Element {
  return (
    <svg className="gitui-group-chev" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 9 V8 C2.5 4.96243 4.96243 2.5 8 2.5 C9.10679 2.5 10.1372 2.82692 11 3.38947" stroke="currentColor" strokeLinecap="round" />
      <path d="M5 12.6105 C5.86278 13.1731 6.89321 13.5 8 13.5 C11.0376 13.5 13.5 11.0376 13.5 8 V7" stroke="currentColor" strokeLinecap="round" />
      <path d="M0.49997 7.50027 L2.5 9.5 L4.49998 7.50023" stroke="currentColor" strokeLinecap="round" />
      <path d="M11.5 8.49982 L13.5 6.5 L15.5 8.49982" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function TitleRow(props: {
  row: TreeRow;
  t: GitUiT;
  onExpandAll: (dirs: string[]) => void;
  onCollapseAll: (dirs: string[]) => void;
  onRefresh: () => void;
  onMenu?: (event: React.MouseEvent) => void;
}): JSX.Element {
  const { row, t, onExpandAll, onCollapseAll, onRefresh, onMenu } = props;
  const dirs = row.dirs ?? [];
  return (
    <div className="gitui-group-title" style={{ height: ROW_HEIGHT }}>
      <span title={row.changelist}>{row.title}{row.changelist !== undefined && row.changelist !== "Default" ? "" : ""}</span>
      <span className="gitui-group-actions">
        {onMenu !== undefined && (
          <button type="button" className="gitui-group-menu-btn" title={t("menu.more")} onClick={onMenu}>⋮</button>
        )}
        <button type="button" title={t("tree.refresh")} onClick={onRefresh}>
          <RefreshIcon />
        </button>
        {dirs.length > 0 && (
          <>
            <button type="button" title={t("tree.expandAll")} onClick={() => onExpandAll(dirs)}>
              <GroupChevron />
            </button>
            <button type="button" title={t("tree.collapseAll")} onClick={() => onCollapseAll(dirs)}>
              <GroupChevron down />
            </button>
          </>
        )}
        <span className="gitui-group-count">{row.count}</span>
      </span>
    </div>
  );
}

function DirRow(props: {
  row: TreeRow;
  collapsed: Set<string>;
  onToggleDir: (key: string) => void;
  actions?: Array<{ label: string; danger?: boolean; title?: string; run: () => void }>;
  /** IDEA-style commit checkbox (true = every file under dir checked). */
  checked?: boolean;
  onToggleChecked?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  t: GitUiT;
}): JSX.Element {
  const { row, collapsed, onToggleDir, actions, checked, onToggleChecked, onContextMenu, t } = props;
  const node = row.node as TreeNode;
  return (
    <div
      className="gitui-dir-node"
      style={{ height: ROW_HEIGHT, paddingLeft: 4 + row.depth * 14 }}
      onClick={() => onToggleDir(row.collapseKey ?? row.key)}
      onContextMenu={onContextMenu}
      title={node.path}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onToggleDir(row.collapseKey ?? row.key);
      }}
    >
      <input
        type="checkbox"
        className="gitui-check"
        checked={checked === true}
        title={t("tree.check")}
        onChange={(event) => {
          event.stopPropagation();
          onToggleChecked?.();
        }}
        onClick={(event) => event.stopPropagation()}
      />
      <TreeArrow expanded={row.collapseKey !== undefined && !collapsed.has(row.collapseKey)} />
      <span className="gitui-dir-name">{node.name}</span>
      <span className="gitui-dir-count">{(node.children as TreeNode[]).length}</span>
      <span style={{ flex: 1 }} />
      {actions?.map((action) => (
        <button
          key={action.label}
          type="button"
          className={"gitui-file-action" + (action.danger === true ? " gitui-btn-danger" : "")}
          title={action.title ?? action.label}
          onClick={(event) => {
            event.stopPropagation();
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

/** Window-level drag helper: tracks a mousemove delta until mouseup. */
function startDrag(
  startClientX: number,
  startClientY: number,
  onMove: (dx: number, dy: number) => void
): void {
  const onMouseMove = (event: MouseEvent): void => {
    onMove(event.clientX - startClientX, event.clientY - startClientY);
  };
  const onMouseUp = (): void => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "";
  };
  document.body.style.userSelect = "none";
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}

export function GitPanel(props: {
  t: GitUiT;
  api: GitApi;
  useSessions?: (selector: (state: { current?: string; byId: Record<string, { cwd?: string }> }) => string) => string;
  useWorkspaces?: (selector: (state: { items: Array<{ path: string }> }) => string[]) => string[];
}): JSX.Element {
  const { t, api, useSessions, useWorkspaces } = props;
  const snapshot = useGitUi();
  const { open, dir, followSession, floating, fullscreen, panelHeight, floatPos, floatMaximized, floatWidth, status, statusLoading, statusError, statusErrorCode, fontScale, recentDirs } = snapshot;

  const [dirDraft, setDirDraft] = useState(dir);
  const [tab, setTab] = useState<"changes" | "files" | "merge" | "history" | "branches" | "stash" | "remotes" | "config">("changes");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  /** Multi-select of changed-file paths (Ctrl/Cmd toggle, Shift range). */
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  /** Anchor path for Shift+click range selection. */
  const [anchorPath, setAnchorPath] = useState<string | null>(null);
  /** "Get from revision" dialog state (the target selected paths). */
  const [getFromRevision, setGetFromRevision] = useState<{ paths: string[] } | null>(null);
  const [diffFiles, setDiffFiles] = useState<DiffFile[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  /** Whitespace flags of the currently displayed diff (independent toggles). */
  const [wsFlags, setWsFlags] = useState<WsFlags>(NO_WS_FLAGS);
  /**
   * Partial-commit hunk checkboxes per file: hunk indices the user un-checked.
   * `total` is the hunk count of the last loaded diff for that path; indices
   * are reset whenever the count changes (hunk boundaries shifted).
   */
  const [uncheckedHunks, setUncheckedHunks] = useState<
    Map<string, { total: number; unchecked: Set<number> }>
  >(new Map());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Which titlebar quick-op dropdown is open ("pull" | "stash" | null). */
  const [commitPlanOpen, setCommitPlanOpen] = useState(false);
  const [commitPlanResults, setCommitPlanResults] = useState<ExecutedCommit[] | null>(null);
  /** Context menu state (file/dir/group rows). */
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  /** Push preview dialog. */
  const [pushOpen, setPushOpen] = useState(false);
  /** Clone repository dialog. */
  const [cloneOpen, setCloneOpen] = useState(false);
  /** Interactive rebase dialog. */
  const [rebaseOpen, setRebaseOpen] = useState(false);
  const [rebaseBaseHint, setRebaseBaseHint] = useState("");
  /** History tab file filter requested from a context menu. */
  const [historyFileFilter, setHistoryFileFilter] = useState<string | null>(null);
  /** Changelist membership (per-repo, .git/dsh/changelists.json). */
  const [changelists, setChangelists] = useState<ChangelistEntry[]>([]);
  const [activeChangelist, setActiveChangelist] = useState("Default");
  /** DiffView's inline-write flush handle (menu mutations await it). */
  const diffFlushRef = useRef<(() => Promise<void>) | null>(null);

  /** Diff-only mode for the Changes tab: hides the file list and commit box
   * so the diff fills the panel (panel goes fullscreen too). */
  const [changesDiffFullscreen, setChangesDiffFullscreen] = useState(false);
  /** The changes directory pane is hidden (− button); show the restore strip. */
  const [changesListHidden, setChangesListHidden] = useState(false);
  /** Same for the Files tab tree (kept here so it survives tab switches). */
  const [filesListHidden, setFilesListHidden] = useState(false);

  // Exiting panel fullscreen elsewhere (e.g. the titlebar ⛶) must leave the
  // diff-only mode too.
  useEffect(() => {
    if (!fullscreen && changesDiffFullscreen) setChangesDiffFullscreen(false);
  }, [fullscreen, changesDiffFullscreen]);

  // Switching away from the Changes tab exits the mode and restores the panel.
  useEffect(() => {
    if (tab !== "changes" && changesDiffFullscreen) {
      setChangesDiffFullscreen(false);
      gitUiSetFullscreen(false);
    }
  }, [tab, changesDiffFullscreen]);

  const toggleChangesDiffFullscreen = (): void => {
    const next = !changesDiffFullscreen;
    setChangesDiffFullscreen(next);
    gitUiSetFullscreen(next);
  };

  const loadChangelists = (): void => {
    if (dir === "") return;
    void api
      .changelistList(dir)
      .then((value) => {
        setChangelists(value.changelists);
        setActiveChangelist(value.active);
      })
      .catch(() => setChangelists([]));
  };
  useEffect(() => {
    loadChangelists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, dir]);

  function commitPlanDone(results: ExecutedCommit[]): void {
    setCommitPlanResults(results);
    setCommitPlanOpen(false);
    void api.refreshStatus(dir);
  }

  // Branch lists for the title-bar switcher: local and remote, kept apart.
  const [titleBranches, setTitleBranches] = useState<{ local: string[]; remote: string[] }>({ local: [], remote: [] });
  /** Configured remotes of the repo (pull/push availability). */
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  /** Stash count for the tab badge. */
  const [stashesCount, setStashesCount] = useState(0);

  // Collapsed directory keys in the change tree, scoped per changelist group.
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const toggleDir = (key: string): void => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const expandDirs = (dirs: string[]): void => {
    if (dirs.length === 0) return;
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      for (const dir of dirs) next.delete(dir);
      return next;
    });
  };
  const collapseDirs = (dirs: string[]): void => {
    if (dirs.length === 0) return;
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      for (const dir of dirs) next.add(dir);
      return next;
    });
  };

  // Flatten the changelist groups into one virtual row list. Membership:
  // files explicitly listed in a changelist belong to it; changed files not
  // listed anywhere are shown under the ACTIVE changelist (IDEA semantics).
  const changeRows = useMemo(() => {
    if (status === null) return [];
    const rows: TreeRow[] = [];
    const listOf = (path: string): string => {
      for (const entry of changelists) {
        if (entry.paths.includes(path)) return entry.name;
      }
      return activeChangelist;
    };
    const byList = new Map<string, ChangeFile[]>();
    // A file can appear in both `staged` and `unstaged` (git status MM:
    // staged then edited in the worktree). Show it ONCE in the tree - the
    // staged status wins for the row glyph, and the combined diff already
    // covers both sides. Duplicate rows would also collide React keys.
    const seenPaths = new Set<string>();
    const addFile = (file: ChangeFile): void => {
      if (seenPaths.has(file.path)) return;
      seenPaths.add(file.path);
      const name = listOf(file.path);
      const arr = byList.get(name);
      if (arr === undefined) byList.set(name, [file]);
      else arr.push(file);
    };
    for (const file of status.staged) addFile(file);
    for (const file of status.unstaged) addFile(file);
    for (const path of status.untracked) addFile({ path, status: "added" });
    const names = [...byList.keys()].sort((a, b) =>
      a === "Default" ? -1 : b === "Default" ? 1 : a.localeCompare(b)
    );
    for (const name of names) {
      const files = byList.get(name) ?? [];
      const group = "cl:" + name;
      const tree = buildTree(files);
      const dirs = collectDirs(tree).map((dir) => group + "\u0000" + dir);
      rows.push({
        key: `t:${group}`,
        kind: "title",
        title: name,
        count: files.length,
        dirs,
        depth: 0,
        changelist: name
      });
      flattenTreeRows(tree, collapsedDirs, rows, group);
    }
    return rows;
  }, [status, collapsedDirs, t, changelists, activeChangelist]);

  // File paths in display order — the range a Shift+click extends over.
  const filePathsInOrder = useMemo(
    () => changeRows.filter((row) => row.kind === "file").map((row) => (row.file as ChangeFile).path),
    [changeRows]
  );

  // Per-directory aggregation of the three change groups: which file paths
  // under each directory are staged / unstaged / untracked. Directory rows
  // use this to offer stage / unstage / track / untrack actions.
  interface DirAgg {
    staged: string[];
    unstaged: string[];
    untracked: string[];
    /** Every changed file path under this directory (for checkbox bulk). */
    all: string[];
  }
  const dirAgg = useMemo(() => {
    const map = new Map<string, DirAgg>();
    const addToAncestors = (path: string, key: keyof DirAgg): void => {
      const parts = path.split("/");
      let acc = "";
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc === "" ? parts[i] : acc + "/" + parts[i];
        let entry = map.get(acc);
        if (entry === undefined) {
          entry = { staged: [], unstaged: [], untracked: [], all: [] };
          map.set(acc, entry);
        }
        entry[key].push(path);
        entry.all.push(path);
      }
    };
    for (const file of status?.staged ?? []) addToAncestors(file.path, "staged");
    for (const file of status?.unstaged ?? []) addToAncestors(file.path, "unstaged");
    for (const path of status?.untracked ?? []) addToAncestors(path, "untracked");
    return map;
  }, [status]);

  // IDEA-style checkboxes: everything is checked by default; this set
  // holds the paths the user un-checked. Only checked paths are committed.
  const [uncheckedPaths, setUncheckedPaths] = useState<Set<string>>(new Set());
  const allChangedPaths = useMemo(() => {
    const paths = new Set<string>();
    for (const file of status?.staged ?? []) paths.add(file.path);
    for (const file of status?.unstaged ?? []) paths.add(file.path);
    for (const path of status?.untracked ?? []) paths.add(path);
    return paths;
  }, [status]);
  const toggleChecked = (path: string): void => {
    setUncheckedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const toggleDirChecked = (paths: string[]): void => {
    if (paths.length === 0) return;
    setUncheckedPaths((prev) => {
      const next = new Set(prev);
      // If every file in the dir is checked → uncheck them all;
      // otherwise check them all.
      const allChecked = paths.every((p) => !next.has(p));
      for (const p of paths) {
        if (allChecked) next.add(p);
        else next.delete(p);
      }
      return next;
    });
  };
  const checkedPaths = useMemo(() => {
    const paths: string[] = [];
    for (const path of allChangedPaths) {
      if (!uncheckedPaths.has(path)) paths.push(path);
    }
    return paths;
  }, [allChangedPaths, uncheckedPaths]);

  /** Context menu for a file or directory (all files under a dir). */
  function changeMenuItems(paths: string[], label: string, ignorePath?: string): MenuItem[] {
    const tracked = paths.some((p) =>
      (status?.staged ?? []).some((f) => f.path === p) ||
      (status?.unstaged ?? []).some((f) => f.path === p)
    );
    const staged = paths.some((p) => (status?.staged ?? []).some((f) => f.path === p));
    // "Get from revision" only applies to tracked files (untracked files exist
    // in no revision, so git checkout <rev> -- <path> would fail).
    const allTracked =
      paths.length > 0 &&
      paths.every((p) =>
        (status?.staged ?? []).some((f) => f.path === p) ||
        (status?.unstaged ?? []).some((f) => f.path === p)
      );
    // For a directory row, `paths` lists every changed file under it — the
    // ignore rule must target the directory itself (`dir/`), not its first
    // file, or only that one file would be ignored.
    const ignoreTarget = ignorePath ?? paths[0] ?? "";
    // Ignore rules never apply to tracked files: if the target still contains
    // any, say so explicitly so they do not look like a failed ignore.
    const ignoreNotice = tracked ? t("menu.ignoredTracked") : t("menu.ignored");
    return [
      { label: t("menu.showDiff"), onClick: () => void selectFile({ path: paths[0] ?? "", status: "modified" }) },
      ...(allTracked
        ? [{ label: t("getFromRevision.title"), onClick: () => setGetFromRevision({ paths }) }]
        : []),
      ...(tracked && !staged
        ? [{ label: t("menu.stage"), onClick: () => void runMutation(t("menu.stage"), () => api.stage(dir, paths)) }]
        : []),
      ...(staged
        ? [{ label: t("menu.unstage"), onClick: () => void runMutation(t("menu.unstage"), () => api.unstage(dir, paths)) }]
        : []),
      tracked
        ? {
            label: t("menu.rollback"),
            danger: true,
            onClick: () => {
              if (window.confirm(t("discard.confirm", { path: label }))) {
                void runMutation(t("action.discard"), () => api.discard(dir, paths, true));
              }
            }
          }
        : { label: t("action.track"), onClick: () => void runMutation(t("action.track"), () => api.stage(dir, paths)) },
      {
        label: t("menu.ignore"),
        children: [
          {
            label: ".gitignore",
            onClick: () => void runMutation(ignoreNotice, () => api.ignoreAdd(dir, ignoreTarget, "gitignore"))
          },
          {
            label: ".git/info/exclude",
            onClick: () => void runMutation(ignoreNotice, () => api.ignoreAdd(dir, ignoreTarget, "exclude"))
          }
        ]
      },
      {
        label: t("menu.showHistory"),
        onClick: () => {
          setHistoryFileFilter(paths[0] ?? null);
          setTab("history");
        }
      },
      {
        label: t("menu.moveTo"),
        children: changelists.map((entry) => ({
          label: entry.name + (entry.name === activeChangelist ? " ✓" : ""),
          onClick: () =>
            void runMutation(t("changelist.moved"), () => api.changelistMove(dir, paths, entry.name))
        }))
      },
      {
        label: t("menu.copyPath"),
        onClick: () => {
          void navigator.clipboard?.writeText(paths[0] ?? "").catch(() => {});
        }
      }
    ];
  }

  /** Group-header menu: manage the changelist itself. */
  function changelistMenuItems(name: string): MenuItem[] {
    return [
      {
        label: t("changelist.new"),
        onClick: () => {
          const input = window.prompt(t("changelist.newPrompt"), "");
          if (input !== null && input.trim() !== "") {
            void runMutation(t("changelist.created"), () => api.changelistCreate(dir, input.trim()));
          }
        }
      },
      {
        label: t("changelist.setActive"),
        disabled: name === activeChangelist,
        onClick: () => void runMutation(t("changelist.activated"), () => api.changelistSetActive(dir, name))
      },
      {
        label: t("changelist.moveCheckedHere"),
        disabled: checkedPaths.length === 0,
        onClick: () => void runMutation(t("changelist.moved"), () => api.changelistMove(dir, checkedPaths, name))
      },
      { separator: true, label: "" },
      {
        label: t("changelist.rename"),
        disabled: name === "Default",
        onClick: () => {
          const input = window.prompt(t("changelist.renamePrompt"), name);
          if (input !== null && input.trim() !== "" && input.trim() !== name) {
            void runMutation(t("changelist.renamed"), () => api.changelistRename(dir, name, input.trim()));
          }
        }
      },
      {
        label: t("changelist.delete"),
        danger: true,
        disabled: name === "Default",
        onClick: () => {
          if (window.confirm(t("changelist.deleteConfirm", { name }))) {
            void runMutation(t("changelist.deleted"), () => api.changelistDelete(dir, name));
          }
        }
      }
    ];
  }

  const renderChangeRow = (row: TreeRow): JSX.Element => {
    if (row.kind === "title") {
      return (
        <TitleRow
          key={row.key}
          row={row}
          t={t}
          onExpandAll={expandDirs}
          onCollapseAll={collapseDirs}
          onRefresh={() => void refresh()}
          onMenu={
            row.changelist !== undefined
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setMenu({ x: event.clientX, y: event.clientY, items: changelistMenuItems(row.changelist as string) });
                }
              : undefined
          }
        />
      );
    }
    if (row.kind === "dir") {
      const dirPath = (row.node as TreeNode).path;
      const agg = dirAgg.get(dirPath);
      const dirFiles = agg?.all ?? [];
      const dirChecked = dirFiles.length > 0 && dirFiles.every((p) => !uncheckedPaths.has(p));
      const actions: FileRowProps["actions"] = [];
      if (agg !== undefined) {
        if (agg.untracked.length > 0) {
          actions.push({
            label: t("action.track"),
            run: () => void runMutation(t("action.track"), () => api.stage(dir, agg.untracked))
          });
        }
        const tracked = [...agg.staged, ...agg.unstaged];
        if (tracked.length > 0) {
          actions.push({
            label: t("action.discard"),
            danger: true,
            run: () => {
              if (!window.confirm(t("discard.confirm", { path: dirPath }))) return;
              // Full restore (index + worktree) for every tracked file
              // under the directory — matches IDE rollback.
              void runMutation(t("action.discard"), () => api.discard(dir, tracked, true));
            }
          });
        }
      }
      return (
        <DirRow
          key={row.key}
          row={row}
          collapsed={collapsedDirs}
          onToggleDir={toggleDir}
          actions={actions}
          checked={dirChecked}
          onToggleChecked={() => toggleDirChecked(dirFiles)}
          onContextMenu={(event) => {
            event.preventDefault();
            if (dirFiles.length > 0) {
              setMenu({ x: event.clientX, y: event.clientY, items: changeMenuItems(dirFiles, dirPath, dirPath) });
            }
          }}
          t={t}
        />
      );
    }
    const file = row.file as ChangeFile;
    const tracked = status !== null && (
      status.staged.some((item) => item.path === file.path) ||
      status.unstaged.some((item) => item.path === file.path)
    );
    const actions: FileRowProps["actions"] = [];
    if (tracked) {
      actions.push({
        label: t("action.discard"),
        title: t("action.discardWhole"),
        danger: true,
        run: () => {
          if (!window.confirm(t("discard.confirm", { path: file.path }))) return;
          void runMutation(t("action.discard"), () => api.discard(dir, [file.path], true));
        }
      });
    } else {
      actions.push({
        label: t("action.track"),
        run: () => void runMutation(t("action.track"), () => api.stage(dir, [file.path]))
      });
    }
    return (
      <FileRow
        key={row.key}
        file={file}
        displayName={row.displayName}
        selected={selectedPaths.includes(file.path)}
        t={t}
        onSelect={(event) => selectFile(file, event)}
        actions={actions}
        depth={row.depth}
        checked={!uncheckedPaths.has(file.path)}
        onToggleChecked={() => toggleChecked(file.path)}
        onContextMenu={(event) => {
          event.preventDefault();
          const paths = selectedPaths.includes(file.path) ? selectedPaths : [file.path];
          setMenu({ x: event.clientX, y: event.clientY, items: changeMenuItems(paths, file.path) });
        }}
      />
    );
  };

  // Follow the current session's cwd while the user has not pinned a dir.
  const sessionCwd =
    useSessions !== undefined
      ? useSessions((state) => state.byId[state.current ?? ""]?.cwd ?? "")
      : "";
  // Follow the session cwd only when it actually changes. A manual dir
  // switch clears the pin (gitUiSetDir) but must NOT be yanked back by the
  // follow effect firing on followSession flipping true; unpinning via the
  // 📌 button explicitly applies the cwd itself.
  useEffect(() => {
    if (!followSession || sessionCwd === "") return;
    gitUiFollowCwd(sessionCwd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCwd]);

  // Session-dir repo discovery: when the session cwd is NOT itself a git
  // repository root, scan its subdirectories (max 3 levels) and offer every
  // found repo root as a dropdown candidate. When it IS the root the plain
  // session-cwd entry is enough and no scan runs.
  const [sessionRepoOptions, setSessionRepoOptions] = useState<string[]>([]);
  useEffect(() => {
    if (sessionCwd === "") {
      setSessionRepoOptions([]);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const probes = await api.repos([sessionCwd]);
        const root = probes[0]?.root ?? null;
        if (!alive) return;
        if (root === sessionCwd) {
          setSessionRepoOptions([]);
          return;
        }
        const repos = await api.findRepos(sessionCwd, 3);
        if (!alive) return;
        setSessionRepoOptions(repos);
      } catch {
        if (alive) setSessionRepoOptions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, sessionCwd]);

  // Dropdown options: current dir + current session cwd + every workspace dir.
  const workspaceDirs =
    useWorkspaces !== undefined ? useWorkspaces((state) => state.items.map((item) => item.path)) : [];
  const dirOptions = Array.from(
    new Set(
      [
        ...workspaceDirs,
        ...(sessionCwd !== "" ? [sessionCwd] : []),
        ...sessionRepoOptions,
        ...(dir !== "" ? [dir] : []),
        ...recentDirs
      ].filter((path) => path !== "")
    )
  );
  const [dirMenuOpen, setDirMenuOpen] = useState(false);
  const [dirEditing, setDirEditing] = useState(false);
  const dirInputRef = useRef<HTMLInputElement>(null);
  // Shortened path while idle; full draft while focused/typing.
  const displayValue = dirEditing ? dirDraft : shortenPath(dirDraft);
  // Show ALL options while the input echoes the applied dir (or is empty);
  // filter only while the user is actively typing something different.
  const isEditingDir = dirDraft !== dir;
  const filteredDirs = isEditingDir
    ? dirOptions.filter((path) => path.toLowerCase().includes(dirDraft.toLowerCase()))
    : dirOptions;

  // Keep the draft in sync when the store dir changes elsewhere.
  useEffect(() => {
    setDirDraft(dir);
  }, [dir]);

  // Load status whenever the dir changes.
  useEffect(() => {
    if (dir === "") return;
    let alive = true;
    void (async () => {
      try {
        const loaded = await api.status(dir);
        if (!alive) return;
        gitUiSetStatus(loaded, null);
      } catch (caught) {
        if (!alive) return;
        const message = (caught as { code?: string; message: string }).message;
        // Not a repo from a subdirectory? Walk up to find the root.
        try {
          const probes = await api.repos([dir]);
          const root = probes[0]?.root ?? null;
          if (!alive) return;
          if (root !== null && root !== dir) {
            gitUiSetDir(root);
            return;
          }
        } catch {
          /* fall through to the error */
        }
        gitUiSetStatus(null, message, (caught as { code?: string }).code ?? null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, dir]);

  // The Changes tab must always show the freshest list: refresh whenever the
  // user lands on the tab (click, Ctrl+D, or any other programmatic switch).
  // Re-clicking the already-active tab is handled in the tab button onClick.
  useEffect(() => {
    if (tab === "changes" && dir !== "") {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, api, dir]);

  // Reopening the panel while the Changes tab is active must re-fetch too —
  // files may have changed while the panel was closed.
  useEffect(() => {
    if (open && tab === "changes" && dir !== "") {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Remote list drives the pull/push button availability.
  useEffect(() => {
    if (dir === "") { setRemotes([]); return; }
    let alive = true;
    api.remotes(dir)
      .then((list) => { if (alive) setRemotes(list); })
      .catch(() => { if (alive) setRemotes([]); });
    api
      .stashList(dir)
      .then((list) => { if (alive) setStashesCount(list.length); })
      .catch(() => { if (alive) setStashesCount(0); });
    return () => { alive = false; };
  }, [api, dir]);

  // Keep the title-bar branch switcher in sync with the repo.
  useEffect(() => {
    if (dir === "" || status === null) return;
    let alive = true;
    void api
      .branches(dir)
      .then((value) => {
        if (!alive) return;
        setTitleBranches({
          local: value.branches
            .filter((branch) => !branch.name.startsWith("remotes/"))
            .map((branch) => branch.name),
          remote: value.branches
            .filter((branch) => branch.name.startsWith("remotes/"))
            .map((branch) => branch.name)
        });
      })
      .catch(() => {
        if (alive) setTitleBranches({ local: [], remote: [] });
      });
    return () => {
      alive = false;
    };
  }, [api, dir, status?.branch]);

  /** Check out a branch picked in the title-bar switcher. */
  async function switchTitleBranch(name: string): Promise<void> {
    if (name === "" || name === status?.branch) return;
    setBusy(true);
    setNotice(null);
    try {
      if (name.startsWith("remotes/")) {
        // Remote branch: check out its local counterpart (created when
        // missing) and pull the latest — same path as the Branches tab.
        const outcome = await api.pullRemoteBranch(dir, name);
        setNotice(t("remoteBranch.pulled", { branch: outcome.branch }));
      } else {
        await api.checkout(dir, name);
        setNotice(t("branch.switched", { name }));
      }
      await api.refreshStatus(dir);
    } catch (caught) {
      setNotice((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Pull the current branch from the first remote — one click, no dialog. */
  async function doPullNow(): Promise<void> {
    if (dir === "" || status === null || status.branch === null || remotes.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await api.pull(dir, remotes[0].name, status.branch, "merge");
      if (outcome.kind === "already-up-to-date") {
        setNotice(t("pull.upToDate"));
      } else if (outcome.kind === "conflicts") {
        setNotice(t("pull.conflicts", { n: outcome.conflicts?.length ?? 0 }));
      } else if (outcome.kind === "error") {
        setNotice(outcome.message ?? t("pull.failed"));
      } else {
        setNotice(t("pull.done"));
      }
      await api.refreshStatus(dir);
      // The notice promises resolution on the Merge tab — actually go there.
      if (outcome.kind === "conflicts") setTab("merge");
    } catch (caught) {
      setNotice((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const conflicts = status?.conflicts ?? [];
  const totalChanges =
    (status?.staged?.length ?? 0) + (status?.unstaged?.length ?? 0) + (status?.untracked?.length ?? 0);

  // Splitter widths: the left list may be dragged narrower/wider; the right
  // pane always keeps ~260px (the drag clamp enforces the same bound).
  const panelWidth = floating && !fullscreen ? floatWidth : window.innerWidth;
  const splitMax = Math.max(SPLIT_MIN, panelWidth - 260);
  const changesSplit = Math.min(snapshot.splitWidths.changes, splitMax);
  const fileTreeSplit = Math.min(snapshot.splitWidths.files, splitMax);
  const historySplit = Math.min(snapshot.splitWidths.history, splitMax);
  const filesStyle: React.CSSProperties = {
    width: changesSplit,
    flex: "none",
    maxWidth: "none",
    minWidth: 0
  };
  /** Inner scroll area of the directory pane: fills the pane column below the bar. */
  const listInnerStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: "100%",
    maxWidth: "none"
  };

  async function refresh(): Promise<void> {
    if (dir === "") return;
    await api.refreshStatus(dir);
    loadChangelists();
    if (selectedPath !== null) void loadDiff(selectedPath);
  }

  // IDEA-style keyboard shortcuts (active while the panel is open and the
  // focus is not inside a form control): Ctrl+K commit, Ctrl+Shift+K push,
  // Ctrl+Alt+A stage selected, Ctrl+Alt+Z rollback selected, Ctrl+D Changes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!open) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable === true) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && !event.shiftKey && !event.altKey && key === "k") {
        event.preventDefault();
        document.querySelector<HTMLTextAreaElement>("[data-git-ui-root] .gitui-commit textarea")?.focus();
      } else if (mod && event.shiftKey && !event.altKey && key === "k") {
        event.preventDefault();
        setPushOpen(true);
      } else if (mod && event.altKey && key === "a") {
        event.preventDefault();
        if (selectedPath !== null) {
          void runMutation(t("menu.stage"), () => api.stage(dir, [selectedPath]));
        }
      } else if (mod && event.altKey && key === "z") {
        event.preventDefault();
        if (selectedPath !== null && window.confirm(t("discard.confirm", { path: selectedPath }))) {
          void runMutation(t("action.discard"), () => api.discard(dir, [selectedPath], true));
        }
      } else if (mod && !event.shiftKey && !event.altKey && key === "d") {
        event.preventDefault();
        setTab("changes");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  /** Run `git init` in the current dir, then reload the status. */
  async function runInit(): Promise<void> {
    if (dir === "") return;
    setBusy(true);
    setNotice(null);
    try {
      await api.init(dir);
      setNotice(t("repo.gitInitDone"));
      await api.refreshStatus(dir);
    } catch (caught) {
      setNotice((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Ask the shared LLM to analyze the project and update `.gitignore`. */
  async function runSuggestGitignore(): Promise<void> {
    if (dir === "") return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await api.suggestGitignore(dir);
      setNotice(result.changed ? t("gitignore.updated") : t("gitignore.unchanged"));
      await api.refreshStatus(dir);
    } catch (caught) {
      setNotice((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Load the working-tree vs HEAD diff for one file (IDEA-style). */
  async function loadDiff(path: string, flags: WsFlags = wsFlags, silent = false): Promise<void> {
    if (dir === "") return;
    if (!silent) setDiffLoading(true);
    setDiffError(null);
    try {
      const files = await api.diff(dir, path, undefined, flags);
      setDiffFiles(files);
      // Keep the hunk-checkbox bookkeeping in sync with the hunk count.
      const total = files.length > 0 ? files[0].hunks.length : 0;
      setUncheckedHunks((prev) => {
        const entry = prev.get(path);
        if (entry !== undefined && entry.total === total) return prev;
        const next = new Map(prev);
        next.set(path, { total, unchecked: new Set() });
        return next;
      });
    } catch (caught) {
      setDiffFiles(null);
      setDiffError((caught as Error).message);
    } finally {
      setDiffLoading(false);
    }
  }

  /** Switch the whitespace flags and reload the selected file's diff. */
  function changeWsFlags(next: WsFlags): void {
    setWsFlags(next);
    if (selectedPath !== null) void loadDiff(selectedPath, next);
  }

  /** Toggle one hunk's commit checkbox (partial commit). */
  function toggleHunk(path: string, hunkIndex: number): void {
    setUncheckedHunks((prev) => {
      const entry = prev.get(path);
      if (entry === undefined) return prev;
      const unchecked = new Set(entry.unchecked);
      if (unchecked.has(hunkIndex)) unchecked.delete(hunkIndex);
      else unchecked.add(hunkIndex);
      const next = new Map(prev);
      next.set(path, { ...entry, unchecked });
      return next;
    });
  }

  /** Hunk-level commit selections derived from the checkboxes. */
  const partialCommits = useMemo<PartialHunkCommit[]>(() => {
    const list: PartialHunkCommit[] = [];
    for (const path of checkedPaths) {
      const entry = uncheckedHunks.get(path);
      if (entry === undefined || entry.total === 0) continue;
      const checked: number[] = [];
      for (let i = 0; i < entry.total; i++) {
        if (!entry.unchecked.has(i)) checked.push(i);
      }
      // Only a strict subset counts as a partial commit; fully-checked files
      // commit normally, fully-unchecked files are left out entirely.
      if (checked.length > 0 && checked.length < entry.total) {
        list.push({
          path,
          hunks: checked,
          ...(wsFlagsActive(wsFlags) ? { wsFlags } : {})
        });
      }
    }
    return list;
  }, [uncheckedHunks, checkedPaths, wsFlags]);

  function selectFile(file: ChangeFile, event?: React.MouseEvent): void {
    const path = file.path;
    if (event !== undefined && (event.ctrlKey || event.metaKey)) {
      // Ctrl/Cmd+click toggles membership in the multi-selection.
      setSelectedPaths((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
      setAnchorPath(path);
      setSelectedPath(path);
      void loadDiff(path);
    } else if (event !== undefined && event.shiftKey) {
      // Shift+click range-selects files between the anchor and this one.
      const anchor = anchorPath ?? path;
      const ia = filePathsInOrder.indexOf(anchor);
      const ib = filePathsInOrder.indexOf(path);
      const sel = ia >= 0 && ib >= 0 ? filePathsInOrder.slice(Math.min(ia, ib), Math.max(ia, ib) + 1) : [path];
      setSelectedPaths(sel);
      setAnchorPath(path);
      setSelectedPath(path);
      void loadDiff(path);
    } else {
      setSelectedPaths([path]);
      setAnchorPath(path);
      setSelectedPath(path);
      void loadDiff(path);
      // Clicking a file means "start comparing": enter the maximized state by
      // default — the same effect as the titlebar ⛶ button next to float/dock.
      if (!fullscreen) gitUiSetFullscreen(true);
    }
  }

  async function runMutation(successLabel: string, operation: () => Promise<void>): Promise<void> {
    setBusy(true);
    setNotice(null);
    try {
      // Pending inline diff edits must land before the mutation reads/writes
      // the file (stage/discard would otherwise snapshot stale content).
      if (diffFlushRef.current !== null) await diffFlushRef.current();
      await operation();
      setNotice(successLabel);
      await api.refreshStatus(dir);
      loadChangelists();
      if (selectedPath !== null) void loadDiff(selectedPath);
    } catch (caught) {
      setNotice((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stageAll = (): void => {
    const paths = [
      ...(status?.unstaged.map((file) => file.path) ?? []),
      ...(status?.untracked ?? [])
    ];
    if (paths.length === 0) return;
    void runMutation(t("action.stageAll"), () => api.stage(dir, paths));
  };


  // Bottom edge: dragging UP grows the panel (dy < 0 → height increases).
  // On a maximized floating window the resize starts from the full height.
  const startResize = (event: React.MouseEvent): void => {
    event.preventDefault();
    let baseHeight = panelHeight;
    if (floatMaximized) {
      gitUiSetFloatMaximized(false);
      gitUiSetFloatPos(8, 8);
      baseHeight = Math.min(GIT_UI_MAX_HEIGHT, Math.max(GIT_UI_MIN_HEIGHT, window.innerHeight - 16));
      gitUiSetPanelHeight(baseHeight);
    }
    // Clamp the upward drag so the panel's top never rises above the host
    // header/tabs bottom (it would otherwise be covered by the tabs).
    const bounds = measureContentBounds();
    const maxHeight = Math.max(GIT_UI_MIN_HEIGHT, Math.min(GIT_UI_MAX_HEIGHT, bounds.bottom - bounds.top));
    startDrag(0, event.clientY, (_dx, dy) => gitUiSetPanelHeight(Math.min(baseHeight - dy, maxHeight)));
  };

  /** Shared clamp: keep the floating window inside the viewport. */
  const clampFloat = (x: number, width: number): { x: number; width: number } => {
    const minX = 8;
    const viewportWidth = window.innerWidth;
    // Width never exceeds the viewport (with 8px margins on both sides).
    const maxWidth = Math.max(GIT_UI_MIN_WIDTH, viewportWidth - 16);
    const clampedWidth = Math.min(GIT_UI_MAX_WIDTH, Math.max(GIT_UI_MIN_WIDTH, width), maxWidth);
    const maxX = Math.max(minX + GIT_UI_MIN_WIDTH, viewportWidth - 8);
    const x2 = Math.min(maxX - clampedWidth, Math.max(minX, x));
    return { x: x2, width: clampedWidth };
  };

  // Left edge: dragging LEFT grows the window (dx < 0 → width increases);
  // the left edge follows the cursor, the right edge stays put.
  const startResizeLeft = (event: React.MouseEvent): void => {
    event.preventDefault();
    let baseX = floatPos.x;
    let baseWidth = floatWidth;
    // Snapshot the y once: after a maximized-window restore it must stay at
    // the restore position (8), not the stale pre-drag snapshot.
    const baseY = floatMaximized ? 8 : floatPos.y;
    if (floatMaximized) {
      gitUiSetFloatMaximized(false);
      gitUiSetFloatPos(8, 8);
      baseX = 8;
      baseWidth = Math.min(GIT_UI_MAX_WIDTH, Math.max(GIT_UI_MIN_WIDTH, window.innerWidth - 16));
      gitUiSetFloatWidth(baseWidth);
    }
    startDrag(event.clientX, event.clientY, (dx) => {
      const { x, width } = clampFloat(baseX + dx, baseWidth - dx);
      gitUiSetFloatPos(x, baseY);
      gitUiSetFloatWidth(width);
    });
  };

  // Right edge: dragging RIGHT grows the window (dx > 0 → width increases).
  const startResizeRight = (event: React.MouseEvent): void => {
    event.preventDefault();
    let baseWidth = floatWidth;
    const baseY = floatMaximized ? 8 : floatPos.y;
    if (floatMaximized) {
      gitUiSetFloatMaximized(false);
      gitUiSetFloatPos(8, 8);
      baseWidth = Math.min(GIT_UI_MAX_WIDTH, Math.max(GIT_UI_MIN_WIDTH, window.innerWidth - 16));
      gitUiSetFloatWidth(baseWidth);
    }
    startDrag(event.clientX, event.clientY, (dx) => {
      const { x, width } = clampFloat(floatPos.x, baseWidth + dx);
      gitUiSetFloatPos(x, baseY);
      gitUiSetFloatWidth(width);
    });
  };

  const startMove = (event: React.MouseEvent): void => {
    event.preventDefault();
    const maximized = floatMaximized === true;
    const baseX = maximized ? 8 : floatPos.x;
    const baseY = maximized ? 8 : floatPos.y;
    let restored = !maximized;
    startDrag(event.clientX, event.clientY, (dx, dy) => {
      if (!restored) {
        // A drag on the maximized window restores it first, then moves it.
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        restored = true;
        gitUiSetFloatMaximized(false);
        gitUiSetFloatPos(8, 8);
      }
      const maxY = Math.max(8, window.innerHeight - 64 - 8);
      const { x } = clampFloat(baseX + dx, floatWidth);
      gitUiSetFloatPos(x, Math.min(maxY, Math.max(8, baseY + dy)));
    });
  };

  /** Shared expanded-panel content (toolbar + tabs + body). */
  const content = (
    <>
      {statusError !== null && statusErrorCode === "not-a-repo" ? (
        <div className="gitui-notrepo">
          <div className="gitui-notrepo-text">{t("repo.notRepo", { dir })}</div>
          <button
            type="button"
            className="gitui-btn gitui-btn-primary"
            disabled={busy || dir === ""}
            onClick={() => void runInit()}
          >
            {t("action.gitInit")}
          </button>
        </div>
      ) : statusError !== null ? (
        <div className="gitui-error">{statusError}</div>
      ) : null}
      <Toast message={notice} />
      {commitPlanOpen ? (
        <CommitPlan
          api={api}
          dir={dir}
          t={t}
          onDone={commitPlanDone}
          onCancel={() => setCommitPlanOpen(false)}
        />
      ) : (
        <>
      <div className="gitui-tabs">
        <button
          type="button"
          className={"gitui-tab" + (tab === "changes" ? " gitui-tab-active" : "")}
          onClick={() => {
            if (tab === "changes") {
              // Re-clicking the active tab: force a refresh (setTab with the
              // same value is a no-op, so the list would otherwise stay stale).
              void refresh();
            } else {
              setTab("changes");
            }
          }}
        >
          {t("tabs.changes")}
          {totalChanges > 0 && <span className="gitui-tab-count">{totalChanges}</span>}
        </button>
        <button type="button" className={"gitui-tab" + (tab === "files" ? " gitui-tab-active" : "")} onClick={() => setTab("files")}>
          {t("tabs.files")}
        </button>
        <button type="button" className={"gitui-tab" + (tab === "merge" ? " gitui-tab-active" : "")} onClick={() => setTab("merge")}>
          {t("tabs.merge")}
          {conflicts.length > 0 && <span className="gitui-tab-count">{conflicts.length}</span>}
        </button>
        <button type="button" className={"gitui-tab" + (tab === "history" ? " gitui-tab-active" : "")} onClick={() => setTab("history")}>
          {t("tabs.history")}
        </button>
        <button type="button" className={"gitui-tab" + (tab === "branches" ? " gitui-tab-active" : "")} onClick={() => setTab("branches")}>
          {t("tabs.branches")}
        </button>
        <button type="button" className={"gitui-tab" + (tab === "stash" ? " gitui-tab-active" : "")} onClick={() => setTab("stash")}>
          {t("tabs.stash")}
          {stashesCount > 0 && <span className="gitui-tab-count">{stashesCount}</span>}
        </button>
        <button type="button" className={"gitui-tab" + (tab === "remotes" ? " gitui-tab-active" : "")} onClick={() => setTab("remotes")}>
          {t("tabs.remotes")}
        </button>
        <button type="button" className={"gitui-tab" + (tab === "config" ? " gitui-tab-active" : "")} onClick={() => setTab("config")}>
          {t("tabs.config")}
        </button>
      </div>
      <div className="gitui-body">
        {tab === "files" ? (
          <FileTreeView
            api={api}
            dir={dir}
            t={t}
            splitWidth={fileTreeSplit}
            onSplitWidth={(width) => gitUiSetSplitWidth("files", width)}
            onSplitReset={() => gitUiSetSplitWidth("files", SPLIT_DEFAULTS.files)}
            listHidden={filesListHidden}
            onToggleListHidden={() => setFilesListHidden((hidden) => !hidden)}
            onChanged={() => void api.refreshStatus(dir)}
          />
        ) : tab === "merge" ? (
          <MergeView
            api={api}
            dir={dir}
            status={status}
            t={t}
            onChanged={() => void api.refreshStatus(dir)}
            onOpenRebase={(base) => {
              setRebaseBaseHint(base ?? "");
              setRebaseOpen(true);
            }}
          />
        ) : tab === "history" ? (
          <HistoryView
            api={api}
            dir={dir}
            t={t}
            onChanged={() => void api.refreshStatus(dir)}
            splitWidth={historySplit}
            onSplitWidth={(width) => gitUiSetSplitWidth("history", width)}
            onSplitReset={() => gitUiSetSplitWidth("history", SPLIT_DEFAULTS.history)}
            fileFilterInit={historyFileFilter}
            onFileFilterConsumed={() => setHistoryFileFilter(null)}
            fullscreen={fullscreen}
            currentBranch={status?.branch ?? null}
            onOpenRebase={(base) => {
              setRebaseBaseHint(base ?? "");
              setRebaseOpen(true);
            }}
            onOpenConflicts={() => setTab("merge")}
          />
        ) : tab === "branches" ? (
          <BranchesView
            api={api}
            dir={dir}
            t={t}
            onChanged={() => void api.refreshStatus(dir)}
            onOpenRebase={(base) => {
              setRebaseBaseHint(base ?? "");
              setRebaseOpen(true);
            }}
            onOpenConflicts={() => setTab("merge")}
          />
        ) : tab === "stash" ? (
          <StashView
            api={api}
            dir={dir}
            t={t}
            onChanged={() => {
              void api.refreshStatus(dir);
              void api.stashList(dir).then((list) => setStashesCount(list.length)).catch(() => {});
            }}
          />
        ) : tab === "remotes" ? (
          <RemoteView api={api} dir={dir} t={t} onChanged={() => void api.refreshStatus(dir)} />
        ) : tab === "config" ? (
          <ConfigView api={api} dir={dir} t={t} onChanged={() => void api.refreshStatus(dir)} />
        ) : (
          <>
            {!changesDiffFullscreen && (
            <>
            {changesListHidden ? (
              <PaneRestoreBar title={t("pane.restore")} onRestore={() => setChangesListHidden(false)} />
            ) : (
              <>
              {dir === "" ? (
                <div className="gitui-pane-col" style={filesStyle}>
                  <PaneMinBar
                    title={t("pane.collapse")}
                    onNarrow={() => setChangesListHidden(true)}
                  />
                  <div className="gitui-files" style={listInnerStyle}>
                    <div className="gitui-diff-placeholder">{t("repo.placeholder")}</div>
                  </div>
                </div>
              ) : status !== null ? (
                <div className="gitui-pane-col" style={filesStyle}>
                  <PaneMinBar
                    title={t("pane.collapse")}
                    onNarrow={() => setChangesListHidden(true)}
                  />
                  <VirtualRows rows={changeRows} rowHeight={ROW_HEIGHT} renderRow={renderChangeRow} style={listInnerStyle} />
                </div>
              ) : null}
              <Splitter
                width={changesSplit}
                onChange={(width) => gitUiSetSplitWidth("changes", width)}
                onReset={() => gitUiSetSplitWidth("changes", SPLIT_DEFAULTS.changes)}
                title={t("splitter.resize")}
              />
              </>
            )}
            </>
            )}
            <div className="gitui-detail">
              <div className="gitui-detail-header">
                <span className="gitui-file-path">{selectedPath ?? ""}</span>
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  className={"gitui-btn" + (changesDiffFullscreen ? " gitui-active" : "")}
                  title={changesDiffFullscreen ? t("win.exitFullscreen") : t("win.fullscreen")}
                  onClick={toggleChangesDiffFullscreen}
                >
                  {changesDiffFullscreen ? "🗗" : "⛶"}
                </button>
              </div>
              {diffLoading ? (
                <div className="gitui-diff-placeholder">…</div>
              ) : diffError !== null ? (
                <div className="gitui-error">{diffError}</div>
              ) : (
                <DiffView
                  file={diffFiles !== null && diffFiles.length > 0 ? diffFiles[0] : null}
                  t={t}
                  leftLabel={
                    selectedPath !== null &&
                    (status?.head === null || (status?.untracked ?? []).includes(selectedPath))
                      ? t("diff.emptyTree")
                      : "HEAD"
                  }
                  rightLabel={t("diff.worktree")}
                  interactive
                  api={api}
                  dir={dir}
                  path={selectedPath ?? undefined}
                  wsFlags={wsFlags}
                  onWsFlagsChange={changeWsFlags}
                  imageRefs={{ left: "HEAD", right: undefined }}
                  hasStagedChanges={
                    selectedPath !== null &&
                    (status?.staged ?? []).some((item) => item.path === selectedPath)
                  }
                  hunkOpsDisabled={
                    selectedPath === null ||
                    status?.head === null ||
                    (status?.untracked ?? []).includes(selectedPath)
                  }
                  hunkOpsDisabledReason={
                    selectedPath !== null && (status?.untracked ?? []).includes(selectedPath)
                      ? t("diff.untracked")
                      : t("diff.noHead")
                  }
                  uncheckedHunks={
                    selectedPath !== null
                      ? uncheckedHunks.get(selectedPath)?.unchecked
                      : undefined
                  }
                  onToggleHunk={(index) => {
                    if (selectedPath !== null) toggleHunk(selectedPath, index);
                  }}
                  onChanged={() => {
                    void api.refreshStatus(dir);
                    if (selectedPath !== null) void loadDiff(selectedPath, wsFlags, true);
                  }}
                  flushRef={diffFlushRef}
                />
              )}
              {!changesDiffFullscreen && (
              <CommitBox
                api={api}
                dir={dir}
                stagedCount={checkedPaths.length}
                branch={status?.branch ?? null}
                t={t}
                checkedPaths={checkedPaths}
                partial={partialCommits}
                onCommitted={() => {
                  void api.refreshStatus(dir);
                  setNotice(null);
                }}
              />
              )}
            </div>
          </>
        )}
        </div>
        </>
      )}
      {menu !== null && <Menu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      {pushOpen && status !== null && status.branch !== null && (
        <PushDialog
          api={api}
          dir={dir}
          branch={status.branch}
          t={t}
          onDone={() => void refresh()}
          onClose={() => setPushOpen(false)}
        />
      )}
      {rebaseOpen && (
        <RebaseDialog
          api={api}
          dir={dir}
          t={t}
          baseHint={rebaseBaseHint}
          onDone={() => void refresh()}
          onConflicts={() => {
            setTab("merge");
            void api.refreshStatus(dir);
          }}
          onClose={() => setRebaseOpen(false)}
        />
      )}
      {cloneOpen && (
        <CloneDialog
          api={api}
          t={t}
          sessionDir={sessionCwd}
          onDone={(root) => {
            setCloneOpen(false);
            gitUiSetDir(root);
            gitUiSetFollowSession(false);
            gitUiAddRecentDir(root);
            setNotice(t("clone.done", { root }));
          }}
          onClose={() => setCloneOpen(false)}
        />
      )}
      {getFromRevision !== null && (
        <GetFromRevisionDialog
          api={api}
          t={t}
          dir={dir}
          paths={getFromRevision.paths}
          onDone={() => {
            setGetFromRevision(null);
            void refresh();
          }}
          onClose={() => setGetFromRevision(null)}
        />
      )}
    </>
  );

  // Global panel font-scale is a CSS custom property applied on the root so
  // every derived font-size in the stylesheet scales with it (1 = default).
  const fontScaleStyle: React.CSSProperties = {
    "--git-ui-font-scale": String(fontScale)
  } as unknown as React.CSSProperties;

  const resizeHandle = (
    <div
      className="gitui-resize"
      title={t("resize.hint")}
      onMouseDown={startResize}
    />
  );

  // Window chrome: title + drag (floating) + minimize / fullscreen / close.
  const titleBar = (
    <div
      className={"gitui-titlebar" + (floating && !fullscreen ? " gitui-titlebar-movable" : "")}
      onMouseDown={floating && !fullscreen ? startMove : undefined}
    >
      <span className="gitui-glyph">⑂</span>
      {status !== null && status.branch !== null && (titleBranches.local.length > 0 || titleBranches.remote.length > 0) ? (
        <select
          className="gitui-titlebar-branch"
          value={status.branch}
          title={t("branch.switchHint")}
          disabled={busy}
          onChange={(event) => void switchTitleBranch(event.target.value)}
        >
          <optgroup label={t("branch.local")}>
            {titleBranches.local.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("branch.remote")}>
            {titleBranches.remote.map((name) => (
              <option key={name} value={name}>
                {name.replace(/^remotes\//, "")}
              </option>
            ))}
          </optgroup>
        </select>
      ) : (
        <span className="gitui-titlebar-label">{status?.branch ?? t("panel.title")}</span>
      )}
      {status !== null && status.branch !== null && (status.ahead > 0 || status.behind > 0) && (
        <span className="gitui-titlebar-ahead">↑{status.ahead}↓{status.behind}</span>
      )}
      <div className="gitui-dir-wrap">
        <input
          ref={dirInputRef}
          className="gitui-dir"
          value={displayValue}
          placeholder={t("repo.placeholder")}
          title={dirDraft + " · " + (followSession ? t("repo.following") : t("repo.pinned"))}
          onChange={(event) => {
            setDirDraft(event.target.value);
            setDirMenuOpen(true);
          }}
          onFocus={() => {
            setDirEditing(true);
            setDirMenuOpen(true);
          }}
          onClick={() => setDirMenuOpen(true)}
          onBlur={() => {
            // Leave edit mode (shortened display) and close the menu only when
            // focus truly left the input; clicking it again (already focused)
            // must reopen the list via onClick.
            window.setTimeout(() => {
              setDirEditing(false);
              if (dirInputRef.current !== document.activeElement) setDirMenuOpen(false);
            }, 120);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const target = dirDraft.trim();
              gitUiSetDir(target);
              if (target !== "" && !workspaceDirs.includes(target) && target !== sessionCwd) {
                gitUiAddRecentDir(target);
              }
              setDirMenuOpen(false);
            } else if (event.key === "Escape") {
              setDirMenuOpen(false);
            }
          }}
          spellCheck={false}
        />
        {dirMenuOpen && filteredDirs.length > 0 && (
          <div className="gitui-dir-menu" role="listbox">
            {filteredDirs.map((path) => (
              <div
                key={path}
                role="option"
                aria-selected={path === dir}
                title={path}
                className={
                  "gitui-dir-option" + (path === dir ? " gitui-dir-option-selected" : "")
                }
                onMouseDown={(event) => {
                  event.preventDefault();
                  gitUiSetDir(path);
                  setDirMenuOpen(false);
                }}
              >
                <span className="gitui-dir-option-label">{path}</span>
                {recentDirs.includes(path) && !workspaceDirs.includes(path) && (
                  <button
                    type="button"
                    className="gitui-dir-option-del"
                    title={t("menu.removeRecentDir")}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      gitUiRemoveRecentDir(path);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className={"gitui-btn" + (followSession ? "" : " gitui-active")}
        title={followSession ? t("repo.following") : t("repo.pinned")}
        onClick={() => {
          if (followSession) {
            gitUiSetFollowSession(false);
          } else {
            gitUiSetFollowSession(true);
            if (sessionCwd !== "") gitUiFollowCwd(sessionCwd);
          }
        }}
      >
        📌
      </button>
      <button type="button" className="gitui-btn" disabled={busy || statusLoading || dir === ""} onClick={() => void refresh()}>
        ↻
      </button>
      <button
        type="button"
        className="gitui-btn"
        title={t("clone.title")}
        disabled={busy}
        onClick={() => setCloneOpen(true)}
      >
        ⤓ {t("clone.action")}
      </button>
      {status !== null && (
        <button
          type="button"
          className="gitui-btn"
          title={t("gitignore.title")}
          disabled={busy || dir === ""}
          onClick={() => void runSuggestGitignore()}
        >
          ✨.gitignore
        </button>
      )}

      {status !== null && (
        <button
          type="button"
          className="gitui-btn"
          title={t("pull.title")}
          disabled={busy || dir === "" || remotes.length === 0}
          onClick={() => void doPullNow()}
        >
          ⇣ {t("pull.action")}
        </button>
      )}
      {status !== null && (
        <button
          type="button"
          className="gitui-btn"
          title={t("push.preview") + " (Ctrl+Shift+K)"}
          disabled={busy || dir === "" || status.branch === null || remotes.length === 0}
          onClick={() => setPushOpen(true)}
        >
          ⇡ {t("remote.push")}
        </button>
      )}
      {(status?.unstaged?.length ?? 0) + (status?.untracked?.length ?? 0) > 0 && (
        <button type="button" className="gitui-btn" disabled={busy || dir === ""} onClick={stageAll}>
          {t("action.stageAll")}
        </button>
      )}
      {status !== null && (
        <button
          type="button"
          className="gitui-btn gitui-btn-primary"
          title={t("commit.autoTitle")}
          disabled={busy || dir === ""}
          onClick={() => {
            setCommitPlanResults(null);
            setCommitPlanOpen(true);
          }}
        >
          {t("commit.auto")}
        </button>
      )}

      <span className="gitui-tb-sep" />
      <button
        type="button"
        className="gitui-btn gitui-font-btn"
        title={t("panel.fontScaleSmaller")}
        disabled={fontScale <= FONT_SCALE_MIN}
        onClick={() => gitUiAdjustFontScale(-FONT_SCALE_STEP)}
      >
        A−
      </button>
      <button
        type="button"
        className="gitui-btn gitui-font-btn"
        title={t("panel.fontScaleLarger")}
        disabled={fontScale >= FONT_SCALE_MAX}
        onClick={() => gitUiAdjustFontScale(FONT_SCALE_STEP)}
      >
        A+
      </button>

      <div className="gitui-win-controls">
        <button
          type="button"
          className="gitui-win-btn"
          title={t("win.minimize")}
          onClick={() => gitUiSetOpen(false)}
        >
          –
        </button>
        <button
          type="button"
          className={"gitui-win-btn" + (fullscreen ? " gitui-active" : "")}
          title={fullscreen ? t("win.exitFullscreen") : t("win.fullscreen")}
          onClick={() => gitUiSetFullscreen(!fullscreen)}
        >
          ⛶
        </button>
        <button
          type="button"
          className="gitui-win-btn gitui-win-close"
          title={t("win.close")}
          onClick={() => gitUiSetOpen(false)}
        >
          ✕
        </button>
      </div>
    </div>
  );

  // Closed → render nothing (the panel is opened via the header Git action).
  if (!open) return <div data-git-ui-root="" />;

  if (floating && !fullscreen) {
    // Detach opens maximized (fills the viewport); drag/resize restore it.
    const maximized = floatMaximized === true;
    return (
      <div data-git-ui-root="" style={fontScaleStyle}>
        <div
          className="gitui-float"
          style={
            maximized
              ? {
                  left: 8,
                  top: 8,
                  width: Math.max(GIT_UI_MIN_WIDTH, window.innerWidth - 16),
                  height: Math.max(GIT_UI_MIN_HEIGHT, window.innerHeight - 16)
                }
              : {
                  left: Math.min(Math.max(8, floatPos.x), Math.max(8, window.innerWidth - floatWidth - 8)),
                  top: Math.min(Math.max(8, floatPos.y), Math.max(8, window.innerHeight - 64 - 8)),
                  width: Math.min(floatWidth, Math.max(GIT_UI_MIN_WIDTH, window.innerWidth - 16)),
                  height: panelHeight
                }
          }
        >
          <div
            className="gitui-resize-x gitui-resize-x-l"
            title={t("resize.width")}
            onMouseDown={startResizeLeft}
          />
          <div
            className="gitui-resize-x gitui-resize-x-r"
            title={t("resize.width")}
            onMouseDown={startResizeRight}
          />
          {resizeHandle}
          {titleBar}
          <div className="gitui-float-body">{content}</div>
        </div>
      </div>
    );
  }

  const panel = (
    <div data-git-ui-root="" style={fontScaleStyle}>
      <div
        className={"gitui-panel" + (fullscreen ? " gitui-fullscreen" : "")}
        style={
          fullscreen
            ? { position: "fixed", inset: 0, zIndex: 2147483000 }
            : { height: `${panelHeight}px` }
        }
      >
        {!fullscreen && resizeHandle}
        {titleBar}
        {content}
      </div>
    </div>
  );

  return fullscreen ? createPortal(panel, document.body) : panel;
}

export { GIT_UI_MAX_HEIGHT };