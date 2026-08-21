/**
 * Shared wire types for the dsh-git-ui Remote.
 * These mirror the zod schemas in schemas.ts and are bundled into both faces.
 */

/** Uniform result envelope: business outcomes ride `error`, never exceptions. */
export type GitResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GitError };

export interface GitError {
  code: string;
  message: string;
}

/** One entry in a directory listing (git-independent file tree). */
export interface DirEntry {
  name: string;
  /** Path relative to the panel dir, forward slashes. */
  path: string;
  kind: "dir" | "file";
}

/** Result of reading a text file for preview. */
export interface FileContent {
  content: string;
  /** True when the file exceeded the preview size cap. */
  truncated: boolean;
  /** True when the file looks binary (NUL bytes); content is empty then. */
  binary: boolean;
}

export interface RepoStatus {
  /** Absolute path of the repository root. */
  root: string;
  /** Current branch name, or null when detached HEAD. */
  branch: string | null;
  /** Short HEAD hash, or null on an unborn branch. */
  head: string | null;
  ahead: number;
  behind: number;
  /** In-progress operation, if any. */
  state: "clean" | "merge" | "rebase" | "cherry-pick" | "revert" | "other";
  /** Branch being merged in (source), non-null while state === "merge". */
  mergeSource: string | null;
  staged: ChangeFile[];
  unstaged: ChangeFile[];
  untracked: string[];
  conflicts: string[];
}

export interface ChangeFile {
  path: string;
  status:
    | "added"
    | "modified"
    | "deleted"
    | "renamed"
    | "copied"
    | "typechange"
    | "unmerged";
  /** Rename/copy destination path (porcelain v2 `->` target). */
  target?: string;
}

/**
 * Whitespace comparison flags (IDEA "Do not ignore" dropdown, independent
 * toggles). They map to git diff options and may be combined freely.
 */
export interface WsFlags {
  /** Ignore leading/trailing whitespace differences (--ignore-space-at-eol --ignore-cr-at-eol). */
  trimEol: boolean;
  /** Ignore all whitespace differences (-w). */
  ignoreWs: boolean;
  /** Ignore blank-line changes (--ignore-blank-lines). */
  ignoreBlank: boolean;
}

export const NO_WS_FLAGS: WsFlags = { trimEol: false, ignoreWs: false, ignoreBlank: false };

/** True when at least one whitespace flag is active. */
export function wsFlagsActive(flags: WsFlags | undefined): boolean {
  return flags !== undefined && (flags.trimEol || flags.ignoreWs || flags.ignoreBlank);
}

export interface DiffLine {
  type: "ctx" | "add" | "del";
  text: string;
  oldNo?: number;
  newNo?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  binary: boolean;
  hunks: DiffHunk[];
}

export interface CommitInfo {
  hash: string;
  short: string;
  subject: string;
  author: string;
  date: number;
  refs: string;
}

/** Full commit details for the Log details panel (IDEA-style). */
export interface CommitDetail {
  hash: string;
  short: string;
  subject: string;
  body: string;
  author: string;
  authorEmail: string;
  authorDate: number;
  committer: string;
  committerDate: number;
  parents: string[];
  files: CommitFile[];
}

export interface CommitFile {
  path: string;
  status: string;
  /** null for binary files. */
  additions: number | null;
  deletions: number | null;
}

/** One LLM-planned commit: message + the files it commits. */
export interface CommitGroup {
  message: string;
  files: string[];
}

export interface ExecutedCommit {
  message: string;
  hash: string;
  short: string;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  upstream?: string;
}

export interface RemoteInfo {
  name: string;
  url: string;
  /** Different URL used for pushing, when configured. */
  pushUrl?: string;
}

export interface PushOutcome {
  pushed: boolean;
  /** Human-readable progress from git (e.g. "branch -> branch"). */
  message?: string;
}

/** One conflict block: line ranges (0-based, inclusive of marker lines). */
export interface ConflictBlock {
  /** Range in the ours (HEAD) file. */
  oursStart: number;
  oursEnd: number;
  /** Range in the theirs (incoming) file. */
  theirsStart: number;
  theirsEnd: number;
  /** Range in the working file (with conflict markers). */
  resultStart: number;
  resultEnd: number;
}

export interface ConflictView {
  /** Full content of the "ours" (HEAD) side of the conflict. */
  ours: string;
  /** Full content of the "theirs" (incoming) side of the conflict. */
  theirs: string;
  /** Current working-file content (with conflict markers). */
  result: string;
  /** Number of conflict marker blocks found. */
  markers: number;
  /** Per-block line ranges in ours / theirs / the working file. */
  blocks: ConflictBlock[];
}

export type MergeKind = "already-up-to-date" | "fast-forward" | "merge" | "conflicts" | "error";

export interface MergeOutcome {
  merged: boolean;
  /** What actually happened — lets the UI report the result precisely. */
  kind: MergeKind;
  hash?: string;
  /** Conflicting paths when the merge stopped on conflicts. */
  conflicts?: string[];
  /** Failure text when the merge could not start (e.g. local changes). */
  message?: string;
}

export interface RepoProbe {
  /** The input directory that was probed. */
  input: string;
  /** Repository root when `input` lives inside a git work tree, else null. */
  root: string | null;
}

/** Result of `git pull`: mirrors MergeOutcome kinds. */
export interface PullOutcome {
  pulled: boolean;
  kind: MergeKind;
  hash?: string;
  conflicts?: string[];
  message?: string;
}

export interface StashEntry {
  index: number;
  message: string;
  /** Stash (committer) date, ISO-ish from git. */
  date?: string;
}
export interface TagInfo {
  name: string;
  hash: string;
  short: string;
  subject?: string;
}

/** One graph character with its git-assigned color (hex), if any. */
export interface GraphChar {
  ch: string;
  color?: string;
}

/** One author in the log author list (for the filter dropdown). */
export interface LogAuthor {
  name: string;
  email: string;
  /** Number of commits by this author in the filtered range. */
  count: number;
}

/** One row of `git log --graph` with the colored graph prefix. */
export interface GraphRow {
  /** Colored graph prefix (| * / \ _ . spaces). */
  graph: GraphChar[];
  hash: string;
  short: string;
  subject: string;
  refs: string;
  author: string;
  date: number;
}

/** A named changelist with its explicit file membership. */
export interface ChangelistEntry {
  name: string;
  /** Paths explicitly assigned to this changelist. */
  paths: string[];
}

export interface RebaseItem {
  action: "pick" | "reword" | "squash" | "fixup" | "drop";
  hash: string;
  /** New message for reword; squash message when provided. */
  message?: string;
}

export interface CompareFile {
  path: string;
  status: string;
  /** null for binary files. */
  additions: number | null;
  deletions: number | null;
}

export interface OperationOutcome {
  done: boolean;
  conflicts?: string[];
  message?: string;
}

/** Hunk-level commit selection: only these hunks of `path` enter the commit. */
export interface PartialHunkCommit {
  path: string;
  /** 0-based hunk indices as shown in the display diff. */
  hunks: number[];
  /** Whitespace flags of the display diff the indices refer to. */
  wsFlags?: WsFlags;
}

/** Shared request shape for stageHunks / revertHunks. */
export interface HunkPatchRequest {
  dir: string;
  path: string;
  hunks: number[];
  /** Whitespace flags the display diff used (hunk boundaries must match). */
  wsFlags?: WsFlags;
}

/**
 * One visually separate change inside a hunk (IDEA change unit): a run of
 * deleted lines paired with a run of added lines, delimited by context.
 * Line numbers come from the display diff; the host re-derives the same
 * numbers from a fresh git diff to extract the patch.
 */
export interface ChangeRef {
  /** First deleted line old-side number (or the block old cursor). */
  oldStart: number;
  oldCount: number;
  /** First added line new-side number (or the block new cursor). */
  newStart: number;
  newCount: number;
}

/** Shared request shape for stageChanges / revertChanges (IDEA change unit). */
export interface ChangePatchRequest {
  dir: string;
  path: string;
  change: ChangeRef;
  /** Whitespace flags the display diff used (change boundaries must match). */
  wsFlags?: WsFlags;
}
