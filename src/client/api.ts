/**
 * Browser-side client for the git Remote namespace. The namespace service is
 * mounted by apply() through ctx.remote.$mount(TYPERT_REMOTE); this class
 * unwraps the { ok, value | error } envelope into values or thrown errors with
 * a stable shape for the UI.
 */
import type {
  BranchInfo,
  ChangeRef,
  ChangelistEntry,
  CommitDetail,
  CommitGroup,
  CommitInfo,
  CompareFile,
  ConflictView,
  DiffFile,
  DirEntry,
  ExecutedCommit,
  FileContent,
  GitResult,
  GraphRow,
  LogAuthor,
  MergeOutcome,
  OperationOutcome,
  PartialHunkCommit,
  PullOutcome,
  PushOutcome,
  RebaseItem,
  RemoteInfo,
  RepoProbe,
  RepoStatus,
  StashEntry,
  TagInfo,
  WsFlags
} from "../types.js";
import { wsFlagsActive } from "../types.js";
import { gitUiSetStatus, gitUiSetStatusLoading, gitUiSetDir, getGitUiSnapshot } from "./store.js";

export class GitApiError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "GitApiError";
  }
}

type Namespace = {
  status(request: { dir: string }): Promise<GitResult<RepoStatus>>;
  diff(request: {
    dir: string;
    path?: string;
    staged?: boolean;
    context?: number;
    wsFlags?: WsFlags;
  }): Promise<GitResult<{ files: DiffFile[] }>>;
  stageHunks(request: {
    dir: string;
    path: string;
    hunks: number[];
    wsFlags?: WsFlags;
  }): Promise<GitResult<{ applied: number }>>;
  revertHunks(request: {
    dir: string;
    path: string;
    hunks: number[];
    wsFlags?: WsFlags;
  }): Promise<GitResult<{ reverted: number }>>;
  stageChanges(request: {
    dir: string;
    path: string;
    change: ChangeRef;
    wsFlags?: WsFlags;
  }): Promise<GitResult<{ applied: number }>>;
  revertChanges(request: {
    dir: string;
    path: string;
    change: ChangeRef;
    wsFlags?: WsFlags;
  }): Promise<GitResult<{ reverted: number }>>;
  stage(request: { dir: string; paths: string[] }): Promise<GitResult<{ paths: string[] }>>;
  unstage(request: { dir: string; paths: string[] }): Promise<GitResult<{ paths: string[] }>>;
  discard(request: { dir: string; paths: string[]; staged?: boolean }): Promise<GitResult<{ paths: string[] }>>;
  untrack(request: { dir: string; paths: string[] }): Promise<GitResult<{ paths: string[] }>>;
  listDir(request: { dir: string; path?: string }): Promise<GitResult<{ entries: DirEntry[] }>>;
  readFile(request: { dir: string; path: string }): Promise<GitResult<FileContent>>;
  binaryContent(request: {
    dir: string;
    path: string;
    ref?: string;
  }): Promise<GitResult<{ mime: string; base64: string }>>;
  writeFile(request: { dir: string; path: string; content: string }): Promise<GitResult<{ path: string }>>;
  deleteFile(request: { dir: string; path: string; recursive?: boolean }): Promise<GitResult<{ path: string }>>;
  commit(request: {
    dir: string;
    message: string;
    amend?: boolean;
    paths?: string[];
    partial?: PartialHunkCommit[];
  }): Promise<GitResult<{ hash: string; short: string; amended: boolean }>>;
  branches(request: {
    dir: string;
  }): Promise<GitResult<{ current: string | null; branches: BranchInfo[]; remotes: string[] }>>;
  branchRename(request: {
    dir: string;
    oldName: string;
    newName: string;
  }): Promise<GitResult<{ oldName: string; newName: string }>>;
  branchDelete(request: {
    dir: string;
    name: string;
    force?: boolean;
  }): Promise<GitResult<{ name: string }>>;
  checkout(request: { dir: string; branch: string; create?: boolean; startPoint?: string }): Promise<GitResult<{ branch: string }>>;
  merge(request: { dir: string; branch: string }): Promise<GitResult<MergeOutcome>>;
  conflictContent(request: { dir: string; path: string }): Promise<GitResult<ConflictView>>;
  resolveFile(request: {
    dir: string;
    path: string;
    content: string;
  }): Promise<GitResult<{ path: string }>>;
  repos(request: { dirs: string[] }): Promise<GitResult<{ repos: RepoProbe[] }>>;
  init(request: { dir: string }): Promise<GitResult<{ root: string }>>;
  suggestGitignore(request: { dir: string }): Promise<GitResult<{ path: string; changed: boolean }>>;
  commitDetail(request: { dir: string; hash: string }): Promise<GitResult<CommitDetail>>;
  commitDiff(request: { dir: string; hash: string; path?: string }): Promise<GitResult<{ files: DiffFile[] }>>;
  suggestCommits(request: { dir: string }): Promise<GitResult<{ groups: CommitGroup[]; totalFiles: number }>>;
  executeCommits(request: { dir: string; groups: CommitGroup[] }): Promise<GitResult<{ commits: ExecutedCommit[] }>>;
  remotes(request: { dir: string }): Promise<GitResult<{ remotes: RemoteInfo[] }>>;
  remoteAdd(request: { dir: string; name: string; url: string }): Promise<GitResult<{ name: string; url: string }>>;
  remoteRemove(request: { dir: string; name: string }): Promise<GitResult<{ name: string }>>;
  remoteRename(request: { dir: string; oldName: string; newName: string }): Promise<GitResult<{ name: string }>>;
  remoteSetUrl(request: { dir: string; name: string; url: string }): Promise<GitResult<{ name: string; url: string }>>;
  push(request: {
    dir: string;
    remote: string;
    branch: string;
    setUpstream?: boolean;
    remoteBranch?: string;
    force?: boolean;
    followTags?: boolean;
  }): Promise<GitResult<PushOutcome>>;
  fetch(request: { dir: string; remote?: string }): Promise<GitResult<{ fetched: boolean; message?: string }>>;
  pull(request: { dir: string; remote: string; branch: string; strategy?: "merge" | "rebase" }): Promise<GitResult<PullOutcome>>;
  configList(request: { dir: string; scope: "system" | "global" | "local" }): Promise<GitResult<{ entries: Array<{ key: string; value: string }>; configFiles: { system: string; global: string; local: string } }>>;
  configSet(request: { dir: string; scope: "system" | "global" | "local"; key: string; value: string }): Promise<GitResult<{ key: string; value: string }>>;
  configUnset(request: { dir: string; scope: "system" | "global" | "local"; key: string }): Promise<GitResult<{ key: string }>>;
  pullRemoteBranch(request: { dir: string; remoteRef: string }): Promise<GitResult<{ branch: string; pulled: boolean }>>;
  stashList(request: { dir: string }): Promise<GitResult<{ stashes: StashEntry[] }>>;
  stashPush(request: { dir: string; message?: string; includeUntracked?: boolean }): Promise<GitResult<{ stashed: boolean; message?: string }>>;
  stashPop(request: { dir: string; index?: number }): Promise<GitResult<{ popped: boolean; conflicts?: string[]; message?: string }>>;
  stashDrop(request: { dir: string; index?: number }): Promise<GitResult<{ dropped: boolean }>>;
  stashApply(request: { dir: string; index?: number }): Promise<GitResult<{ applied: boolean; conflicts?: string[]; message?: string }>>;
  stashClear(request: { dir: string }): Promise<GitResult<{ cleared: boolean }>>;
  stashShow(request: { dir: string; index: number }): Promise<GitResult<{ lines: string[] }>>;
  stashBranch(request: { dir: string; index: number; name: string }): Promise<GitResult<{ branch: string }>>;
  cherryPick(request: { dir: string; hash: string }): Promise<GitResult<OperationOutcome>>;
  revert(request: { dir: string; hash: string }): Promise<GitResult<OperationOutcome>>;
  reset(request: { dir: string; mode: "soft" | "mixed" | "hard"; ref?: string }): Promise<GitResult<{ reset: boolean; mode: string }>>;
  operationAbort(request: { dir: string }): Promise<GitResult<{ aborted: boolean }>>;
  operationContinue(request: { dir: string; message?: string }): Promise<GitResult<{ continued: boolean; hash?: string }>>;
  tags(request: { dir: string }): Promise<GitResult<{ tags: TagInfo[] }>>;
  tagCreate(request: { dir: string; name: string; hash?: string }): Promise<GitResult<{ name: string }>>;
  tagDelete(request: { dir: string; name: string }): Promise<GitResult<{ name: string }>>;
  logGraph(request: { dir: string; limit?: number; branch?: string; author?: string; since?: string; until?: string; path?: string }): Promise<GitResult<{ rows: GraphRow[] }>>;
  logAuthors(request: { dir: string; branch?: string }): Promise<GitResult<{ authors: LogAuthor[] }>>;
  fileLog(request: { dir: string; path: string; limit?: number }): Promise<GitResult<{ commits: CommitInfo[] }>>;
  compare(request: { dir: string; from: string; to: string }): Promise<GitResult<{ files: CompareFile[] }>>;
  changelistList(request: { dir: string }): Promise<GitResult<{ changelists: ChangelistEntry[]; active: string }>>;
  changelistCreate(request: { dir: string; name: string }): Promise<GitResult<{ name: string }>>;
  changelistRename(request: { dir: string; oldName: string; newName: string }): Promise<GitResult<{ name: string }>>;
  changelistDelete(request: { dir: string; name: string }): Promise<GitResult<{ name: string }>>;
  changelistMove(request: { dir: string; paths: string[]; to: string }): Promise<GitResult<{ moved: number }>>;
  changelistSetActive(request: { dir: string; name: string }): Promise<GitResult<{ active: string }>>;
  ignoreAdd(request: { dir: string; path: string; target: "gitignore" | "exclude" }): Promise<GitResult<{ path: string; target: string }>>;
  pushPreview(request: { dir: string; remote: string; branch: string }): Promise<GitResult<{ upstream: string | null; ahead: CommitInfo[] }>>;
  rebaseList(request: { dir: string }): Promise<GitResult<{ base: string; commits: CommitInfo[] }>>;
  rebaseStart(request: { dir: string; base: string; items: RebaseItem[] }): Promise<GitResult<{ started: boolean; conflicts?: string[]; message?: string }>>;
  operationSkip(request: { dir: string }): Promise<GitResult<{ skipped: boolean; conflicts?: string[] }>>;
  diffWithWorktree(request: { dir: string; hash: string; path?: string }): Promise<GitResult<{ files: DiffFile[] }>>;
};

export class GitApi {
  constructor(private readonly namespace: () => Namespace) {}

  private async call<T>(name: keyof Namespace, args: unknown): Promise<T> {
    const method = (this.namespace() as unknown as Record<string, unknown>)[name];
    if (typeof method !== "function") {
      throw new GitApiError("not-mounted", "Git 服务未就绪");
    }
    // Two envelopes: the RPC layer ({ ok, value } from the gateway) wraps the
    // business envelope the host service returned ({ ok, value | error }).
    const rpc = (await (method as (a: unknown) => Promise<{ ok: boolean; value?: unknown; error?: { message: string } }>)(args));
    if (!rpc.ok) {
      throw new GitApiError("rpc-failed", rpc.error?.message ?? "远程调用失败");
    }
    const business = rpc.value as GitResult<T>;
    if (business.ok) return business.value;
    throw new GitApiError(business.error.code, business.error.message);
  }

  async status(dir: string): Promise<RepoStatus> {
    return this.call<RepoStatus>("status", { dir });
  }

  async diff(
    dir: string,
    path?: string,
    staged?: boolean,
    wsFlags?: WsFlags
  ): Promise<DiffFile[]> {
    const value = await this.call<{ files: DiffFile[] }>("diff", {
      dir,
      ...(path !== undefined ? { path } : {}),
      ...(staged !== undefined ? { staged } : {}),
      ...(wsFlagsActive(wsFlags) ? { wsFlags } : {})
    });
    return value.files;
  }

  async stageHunks(dir: string, path: string, hunks: number[], wsFlags?: WsFlags): Promise<void> {
    await this.call("stageHunks", {
      dir,
      path,
      hunks,
      ...(wsFlagsActive(wsFlags) ? { wsFlags } : {})
    });
  }

  async revertHunks(dir: string, path: string, hunks: number[], wsFlags?: WsFlags): Promise<void> {
    await this.call("revertHunks", {
      dir,
      path,
      hunks,
      ...(wsFlagsActive(wsFlags) ? { wsFlags } : {})
    });
  }

  /** IDEA-style: operate on one visual change (block) instead of a whole hunk. */
  async stageChanges(dir: string, path: string, change: ChangeRef, wsFlags?: WsFlags): Promise<void> {
    await this.call("stageChanges", {
      dir,
      path,
      change,
      ...(wsFlagsActive(wsFlags) ? { wsFlags } : {})
    });
  }

  async revertChanges(dir: string, path: string, change: ChangeRef, wsFlags?: WsFlags): Promise<void> {
    await this.call("revertChanges", {
      dir,
      path,
      change,
      ...(wsFlagsActive(wsFlags) ? { wsFlags } : {})
    });
  }

  async stage(dir: string, paths: string[]): Promise<void> {
    await this.call("stage", { dir, paths });
  }

  async unstage(dir: string, paths: string[]): Promise<void> {
    await this.call("unstage", { dir, paths });
  }

  async discard(dir: string, paths: string[], staged?: boolean): Promise<void> {
    await this.call("discard", { dir, paths, ...(staged === true ? { staged } : {}) });
  }

  async untrack(dir: string, paths: string[]): Promise<void> {
    await this.call("untrack", { dir, paths });
  }

  async listDir(dir: string, path?: string): Promise<DirEntry[]> {
    const value = await this.call<{ entries: DirEntry[] }>("listDir", {
      dir,
      ...(path !== undefined && path !== "" ? { path } : {})
    });
    return value.entries;
  }

  async readFile(dir: string, path: string): Promise<FileContent> {
    return this.call<FileContent>("readFile", { dir, path });
  }

  async binaryContent(
    dir: string,
    path: string,
    ref?: string
  ): Promise<{ mime: string; base64: string }> {
    return this.call("binaryContent", { dir, path, ...(ref !== undefined && ref !== "" ? { ref } : {}) });
  }

  async writeFile(dir: string, path: string, content: string): Promise<void> {
    await this.call("writeFile", { dir, path, content });
  }

  async deleteFile(dir: string, path: string, recursive?: boolean): Promise<void> {
    await this.call("deleteFile", { dir, path, ...(recursive === true ? { recursive } : {}) });
  }

  async commit(
    dir: string,
    message: string,
    amend?: boolean,
    paths?: string[],
    partial?: PartialHunkCommit[]
  ): Promise<{ hash: string; short: string }> {
    const value = await this.call<{ hash: string; short: string; amended: boolean }>("commit", {
      dir,
      message,
      amend,
      ...(paths !== undefined && paths.length > 0 ? { paths } : {}),
      ...(partial !== undefined && partial.length > 0 ? { partial } : {})
    });
    return { hash: value.hash, short: value.short };
  }

  async branches(dir: string): Promise<{
    current: string | null;
    branches: BranchInfo[];
    remotes: string[];
  }> {
    return this.call<{ current: string | null; branches: BranchInfo[]; remotes: string[] }>("branches", { dir });
  }

  async renameBranch(dir: string, oldName: string, newName: string): Promise<void> {
    await this.call("branchRename", { dir, oldName, newName });
  }

  async deleteBranch(dir: string, name: string, force: boolean): Promise<void> {
    await this.call("branchDelete", { dir, name, force });
  }

  async checkout(dir: string, branch: string, create?: boolean, startPoint?: string): Promise<void> {
    await this.call("checkout", {
      dir,
      branch,
      ...(create === true ? { create } : {}),
      ...(startPoint !== undefined && startPoint !== "" ? { startPoint } : {})
    });
  }

  async merge(dir: string, branch: string, noFF?: boolean): Promise<MergeOutcome> {
    return this.call<MergeOutcome>("merge", {
      dir,
      branch,
      ...(noFF === true ? { noFF } : {})
    });
  }

  async conflictContent(dir: string, path: string): Promise<ConflictView> {
    return this.call<ConflictView>("conflictContent", { dir, path });
  }

  async resolveFile(dir: string, path: string, content: string): Promise<void> {
    await this.call("resolveFile", { dir, path, content });
  }

  async repos(dirs: string[]): Promise<RepoProbe[]> {
    const value = await this.call<{ repos: RepoProbe[] }>("repos", { dirs });
    return value.repos;
  }

  /** Run `git init` in `dir`; resolves to the repository root. */
  async init(dir: string): Promise<string> {
    const value = await this.call<{ root: string }>("init", { dir });
    return value.root;
  }

  /** Ask the shared LLM to analyze the repo and update `.gitignore`. */
  async suggestGitignore(dir: string): Promise<{ path: string; changed: boolean }> {
    return this.call<{ path: string; changed: boolean }>("suggestGitignore", { dir });
  }

  async commitDetail(dir: string, hash: string): Promise<CommitDetail> {
    return this.call<CommitDetail>("commitDetail", { dir, hash });
  }

  async commitDiff(dir: string, hash: string, path?: string): Promise<DiffFile[]> {
    const value = await this.call<{ files: DiffFile[] }>("commitDiff", {
      dir,
      hash,
      ...(path !== undefined ? { path } : {})
    });
    return value.files;
  }

  /** Ask the LLM to plan the working-tree changes into commit groups. */
  async suggestCommits(dir: string): Promise<CommitGroup[]> {
    const value = await this.call<{ groups: CommitGroup[]; totalFiles: number }>("suggestCommits", { dir });
    return value.groups;
  }

  /** Execute the planned commit groups in order. */
  async executeCommits(dir: string, groups: CommitGroup[]): Promise<ExecutedCommit[]> {
    const value = await this.call<{ commits: ExecutedCommit[] }>("executeCommits", { dir, groups });
    return value.commits;
  }

  async remotes(dir: string): Promise<RemoteInfo[]> {
    const value = await this.call<{ remotes: RemoteInfo[] }>("remotes", { dir });
    return value.remotes;
  }

  async remoteAdd(dir: string, name: string, url: string): Promise<void> {
    await this.call("remoteAdd", { dir, name, url });
  }

  async remoteRemove(dir: string, name: string): Promise<void> {
    await this.call("remoteRemove", { dir, name });
  }

  async remoteRename(dir: string, oldName: string, newName: string): Promise<void> {
    await this.call("remoteRename", { dir, oldName, newName });
  }

  async remoteSetUrl(dir: string, name: string, url: string): Promise<void> {
    await this.call("remoteSetUrl", { dir, name, url });
  }

  async push(
    dir: string,
    remote: string,
    branch: string,
    setUpstream?: boolean,
    remoteBranch?: string,
    force?: boolean,
    followTags?: boolean
  ): Promise<PushOutcome> {
    return this.call<PushOutcome>("push", {
      dir,
      remote,
      branch,
      ...(setUpstream === true ? { setUpstream } : {}),
      ...(remoteBranch !== undefined && remoteBranch !== "" ? { remoteBranch } : {}),
      ...(force === true ? { force } : {}),
      ...(followTags === true ? { followTags } : {})
    });
  }

  async fetch(dir: string, remote?: string): Promise<{ fetched: boolean; message?: string }> {
    return this.call("fetch", { dir, ...(remote !== undefined ? { remote } : {}) });
  }

  async pull(dir: string, remote: string, branch: string, strategy?: "merge" | "rebase"): Promise<PullOutcome> {
    return this.call<PullOutcome>("pull", {
      dir,
      remote,
      branch,
      ...(strategy !== undefined ? { strategy } : {})
    });
  }
  async configList(dir: string, scope: "system" | "global" | "local"): Promise<{
    entries: Array<{ key: string; value: string }>;
    configFiles: { system: string; global: string; local: string };
  }> {
    return this.call("configList", { dir, scope });
  }

  async configSet(dir: string, scope: "system" | "global" | "local", key: string, value: string): Promise<void> {
    await this.call("configSet", { dir, scope, key, value });
  }

  async configUnset(dir: string, scope: "system" | "global" | "local", key: string): Promise<void> {
    await this.call("configUnset", { dir, scope, key });
  }

  async pullRemoteBranch(dir: string, remoteRef: string): Promise<{ branch: string; pulled: boolean }> {
    return this.call<{ branch: string; pulled: boolean }>("pullRemoteBranch", { dir, remoteRef });
  }

  async stashList(dir: string): Promise<StashEntry[]> {
    const value = await this.call<{ stashes: StashEntry[] }>("stashList", { dir });
    return value.stashes;
  }

  async stashPush(dir: string, message?: string, includeUntracked?: boolean): Promise<{ stashed: boolean; message?: string }> {
    return this.call("stashPush", {
      dir,
      ...(message !== undefined && message !== "" ? { message } : {}),
      ...(includeUntracked === true ? { includeUntracked } : {})
    });
  }

  async stashPop(dir: string, index?: number): Promise<{ popped: boolean; conflicts?: string[]; message?: string }> {
    return this.call("stashPop", { dir, ...(index !== undefined ? { index } : {}) });
  }

  async stashDrop(dir: string, index?: number): Promise<void> {
    await this.call("stashDrop", { dir, ...(index !== undefined ? { index } : {}) });
  }
  async stashApply(dir: string, index?: number): Promise<{ applied: boolean; conflicts?: string[]; message?: string }> {
    return this.call("stashApply", { dir, ...(index !== undefined ? { index } : {}) });
  }

  async stashClear(dir: string): Promise<void> {
    await this.call("stashClear", { dir });
  }

  async stashShow(dir: string, index: number): Promise<string[]> {
    const value = await this.call<{ lines: string[] }>("stashShow", { dir, index });
    return value.lines;
  }

  async stashBranch(dir: string, index: number, name: string): Promise<void> {
    await this.call("stashBranch", { dir, index, name });
  }


  async cherryPick(dir: string, hash: string): Promise<OperationOutcome> {
    return this.call<OperationOutcome>("cherryPick", { dir, hash });
  }

  async revert(dir: string, hash: string): Promise<OperationOutcome> {
    return this.call<OperationOutcome>("revert", { dir, hash });
  }

  async reset(dir: string, mode: "soft" | "mixed" | "hard", ref?: string): Promise<void> {
    await this.call("reset", { dir, mode, ...(ref !== undefined ? { ref } : {}) });
  }

  async operationAbort(dir: string): Promise<void> {
    await this.call("operationAbort", { dir });
  }

  async operationContinue(dir: string, message?: string): Promise<{ continued: boolean; hash?: string }> {
    return this.call("operationContinue", { dir, ...(message !== undefined ? { message } : {}) });
  }

  async tags(dir: string): Promise<TagInfo[]> {
    const value = await this.call<{ tags: TagInfo[] }>("tags", { dir });
    return value.tags;
  }

  async tagCreate(dir: string, name: string, hash?: string): Promise<void> {
    await this.call("tagCreate", { dir, name, ...(hash !== undefined ? { hash } : {}) });
  }

  async tagDelete(dir: string, name: string): Promise<void> {
    await this.call("tagDelete", { dir, name });
  }

  async fileLog(dir: string, path: string, limit?: number): Promise<CommitInfo[]> {
    const value = await this.call<{ commits: CommitInfo[] }>("fileLog", { dir, path, limit });
    return value.commits;
  }

  async compare(dir: string, from: string, to: string): Promise<CompareFile[]> {
    const value = await this.call<{ files: CompareFile[] }>("compare", { dir, from, to });
    return value.files;
  }

  async logGraph(dir: string, limit?: number, filters?: { branch?: string; author?: string; since?: string; until?: string; path?: string }): Promise<GraphRow[]> {
    const value = await this.call<{ rows: GraphRow[] }>("logGraph", {
      dir,
      ...(limit !== undefined ? { limit } : {}),
      ...(filters?.branch !== undefined && filters.branch !== "" ? { branch: filters.branch } : {}),
      ...(filters?.author !== undefined && filters.author !== "" ? { author: filters.author } : {}),
      ...(filters?.since !== undefined && filters.since !== "" ? { since: filters.since } : {}),
      ...(filters?.until !== undefined && filters.until !== "" ? { until: filters.until } : {}),
      ...(filters?.path !== undefined && filters.path !== "" ? { path: filters.path } : {})
    });
    return value.rows;
  }

  async logAuthors(dir: string, branch?: string): Promise<LogAuthor[]> {
    const value = await this.call<{ authors: LogAuthor[] }>("logAuthors", {
      dir,
      ...(branch !== undefined && branch !== "" ? { branch } : {})
    });
    return value.authors;
  }

  async changelistList(dir: string): Promise<{ changelists: ChangelistEntry[]; active: string }> {
    return this.call("changelistList", { dir });
  }

  async changelistCreate(dir: string, name: string): Promise<void> {
    await this.call("changelistCreate", { dir, name });
  }

  async changelistRename(dir: string, oldName: string, newName: string): Promise<void> {
    await this.call("changelistRename", { dir, oldName, newName });
  }

  async changelistDelete(dir: string, name: string): Promise<void> {
    await this.call("changelistDelete", { dir, name });
  }

  async changelistMove(dir: string, paths: string[], to: string): Promise<void> {
    await this.call("changelistMove", { dir, paths, to });
  }

  async changelistSetActive(dir: string, name: string): Promise<void> {
    await this.call("changelistSetActive", { dir, name });
  }

  async ignoreAdd(dir: string, path: string, target: "gitignore" | "exclude"): Promise<void> {
    await this.call("ignoreAdd", { dir, path, target });
  }

  async pushPreview(dir: string, remote: string, branch: string): Promise<{ upstream: string | null; ahead: CommitInfo[] }> {
    return this.call("pushPreview", { dir, remote, branch });
  }

  async rebaseList(dir: string): Promise<{ base: string; commits: CommitInfo[] }> {
    return this.call("rebaseList", { dir });
  }

  async rebaseStart(dir: string, base: string, items: RebaseItem[]): Promise<{ started: boolean; conflicts?: string[]; message?: string }> {
    return this.call("rebaseStart", { dir, base, items });
  }

  async operationSkip(dir: string): Promise<{ skipped: boolean; conflicts?: string[] }> {
    return this.call("operationSkip", { dir });
  }

  async diffWithWorktree(dir: string, hash: string, path?: string): Promise<DiffFile[]> {
    const value = await this.call<{ files: DiffFile[] }>("diffWithWorktree", {
      dir,
      hash,
      ...(path !== undefined ? { path } : {})
    });
    return value.files;
  }

  /**
   * Refresh the shared status snapshot in the module store.
   * @returns the fresh status, or null when the dir is not a repository.
   */
  async refreshStatus(dir: string): Promise<RepoStatus | null> {
    gitUiSetStatusLoading(true);
    try {
      const status = await this.status(dir);
      gitUiSetStatus(status, null);
      return status;
    } catch (error) {
      gitUiSetStatus(
        null,
        (error as Error).message,
        error instanceof GitApiError ? error.code : null
      );
      return null;
    }
  }
}

/** Resolve the first workspace path when the user never chose a directory. */
export function defaultDirHint(workspaces: Array<{ path: string }> | undefined): string {
  if (workspaces !== undefined && workspaces.length > 0 && workspaces[0]?.path) {
    return workspaces[0].path;
  }
  return "";
}

/** Fill the dir with the hint only while the user has no explicit choice yet. */
export function applyDirHint(hint: string): void {
  if (getGitUiSnapshot().dir === "") gitUiSetDir(hint);
}
