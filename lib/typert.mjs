import { n as gitErrorSchema, t as DESCRIPTORS } from "./descriptors-BAMB29Ae.mjs";
//#region src/typert.ts
/**
* Host typert artifact: discovered automatically by @deepseek-ai/dsh-typert-loader
* through the package's "./typert" export and registered into ctx.typert, which
* the typert gateway consults for strict dispatch codecs.
*/
const TYPERT = {
	package: "dsh-git-ui",
	face: "host",
	schemas: [{
		name: "gitError",
		schema: gitErrorSchema
	}],
	invocations: DESCRIPTORS,
	model: {
		services: [{
			description: "Local git operations for the Web UI: status, diff, staging, commit, branches, log, merge, and conflict resolution. Shells out to the system git executable in the requested working directory.",
			summary: "Local git operations backed by the git CLI.",
			tags: [],
			jsDoc: "/**\n * Local git operations for the Web UI.\n */",
			key: "git",
			exportName: "GitService",
			members: [
				{
					kind: "method",
					name: "status",
					signature: "async status(request: GitStatusRequest): Promise<GitStatusResult>"
				},
				{
					kind: "method",
					name: "diff",
					signature: "async diff(request: GitDiffRequest): Promise<GitDiffResult>"
				},
				{
					kind: "method",
					name: "stageHunks",
					signature: "async stageHunks(request: GitStageHunksRequest): Promise<GitStageHunksResult>"
				},
				{
					kind: "method",
					name: "revertHunks",
					signature: "async revertHunks(request: GitRevertHunksRequest): Promise<GitRevertHunksResult>"
				},
				{
					kind: "method",
					name: "stageChanges",
					signature: "async stageChanges(request: GitStageChangesRequest): Promise<GitStageChangesResult>"
				},
				{
					kind: "method",
					name: "revertChanges",
					signature: "async revertChanges(request: GitRevertChangesRequest): Promise<GitRevertChangesResult>"
				},
				{
					kind: "method",
					name: "stage",
					signature: "async stage(request: GitPathsRequest): Promise<GitPathsResult>"
				},
				{
					kind: "method",
					name: "unstage",
					signature: "async unstage(request: GitPathsRequest): Promise<GitPathsResult>"
				},
				{
					kind: "method",
					name: "discard",
					signature: "async discard(request: GitPathsRequest): Promise<GitPathsResult>"
				},
				{
					kind: "method",
					name: "commit",
					signature: "async commit(request: GitCommitRequest): Promise<GitCommitResult>"
				},
				{
					kind: "method",
					name: "branches",
					signature: "async branches(request: GitBranchesRequest): Promise<GitBranchesResult>"
				},
				{
					kind: "method",
					name: "branchRename",
					signature: "async branchRename(request: GitBranchRenameRequest): Promise<GitBranchRenameResult>"
				},
				{
					kind: "method",
					name: "branchDelete",
					signature: "async branchDelete(request: GitBranchDeleteRequest): Promise<GitBranchDeleteResult>"
				},
				{
					kind: "method",
					name: "checkout",
					signature: "async checkout(request: GitCheckoutRequest): Promise<GitCheckoutResult>"
				},
				{
					kind: "method",
					name: "merge",
					signature: "async merge(request: GitMergeRequest): Promise<GitMergeResult>"
				},
				{
					kind: "method",
					name: "conflictContent",
					signature: "async conflictContent(request: GitConflictContentRequest): Promise<GitConflictContentResult>"
				},
				{
					kind: "method",
					name: "resolveFile",
					signature: "async resolveFile(request: GitResolveFileRequest): Promise<GitResolveFileResult>"
				},
				{
					kind: "method",
					name: "repos",
					signature: "async repos(request: GitReposRequest): Promise<GitReposResult>"
				},
				{
					kind: "method",
					name: "findRepos",
					signature: "async findRepos(request: GitFindReposRequest): Promise<GitFindReposResult>"
				},
				{
					kind: "method",
					name: "init",
					signature: "async init(request: GitInitRequest): Promise<GitInitResult>"
				},
				{
					kind: "method",
					name: "clone",
					signature: "async clone(request: GitCloneRequest): Promise<GitCloneResult>"
				},
				{
					kind: "method",
					name: "suggestGitignore",
					signature: "async suggestGitignore(request: GitSuggestGitignoreRequest): Promise<GitSuggestGitignoreResult>"
				},
				{
					kind: "method",
					name: "commitDetail",
					signature: "async commitDetail(request: GitCommitDetailRequest): Promise<GitCommitDetailResult>"
				},
				{
					kind: "method",
					name: "commitDiff",
					signature: "async commitDiff(request: GitCommitDiffRequest): Promise<GitCommitDiffResult>"
				},
				{
					kind: "method",
					name: "suggestCommits",
					signature: "async suggestCommits(request: GitSuggestCommitsRequest): Promise<GitSuggestCommitsResult>"
				},
				{
					kind: "method",
					name: "executeCommits",
					signature: "async executeCommits(request: GitExecuteCommitsRequest): Promise<GitExecuteCommitsResult>"
				},
				{
					kind: "method",
					name: "listDir",
					signature: "async listDir(request: GitListDirRequest): Promise<GitListDirResult>"
				},
				{
					kind: "method",
					name: "readFile",
					signature: "async readFile(request: GitReadFileRequest): Promise<GitReadFileResult>"
				},
				{
					kind: "method",
					name: "binaryContent",
					signature: "async binaryContent(request: GitBinaryContentRequest): Promise<GitBinaryContentResult>"
				},
				{
					kind: "method",
					name: "writeFile",
					signature: "async writeFile(request: GitWriteFileRequest): Promise<GitWriteFileResult>"
				},
				{
					kind: "method",
					name: "deleteFile",
					signature: "async deleteFile(request: GitDeleteFileRequest): Promise<GitDeleteFileResult>"
				},
				{
					kind: "method",
					name: "changelistList",
					signature: "async changelistList(request: GitChangelistListRequest): Promise<GitChangelistListResult>"
				},
				{
					kind: "method",
					name: "changelistCreate",
					signature: "async changelistCreate(request: GitChangelistCreateRequest): Promise<GitChangelistCreateResult>"
				},
				{
					kind: "method",
					name: "changelistRename",
					signature: "async changelistRename(request: GitChangelistRenameRequest): Promise<GitChangelistRenameResult>"
				},
				{
					kind: "method",
					name: "changelistDelete",
					signature: "async changelistDelete(request: GitChangelistDeleteRequest): Promise<GitChangelistDeleteResult>"
				},
				{
					kind: "method",
					name: "changelistMove",
					signature: "async changelistMove(request: GitChangelistMoveRequest): Promise<GitChangelistMoveResult>"
				},
				{
					kind: "method",
					name: "changelistSetActive",
					signature: "async changelistSetActive(request: GitChangelistSetActiveRequest): Promise<GitChangelistSetActiveResult>"
				},
				{
					kind: "method",
					name: "ignoreAdd",
					signature: "async ignoreAdd(request: GitIgnoreAddRequest): Promise<GitIgnoreAddResult>"
				},
				{
					kind: "method",
					name: "pushPreview",
					signature: "async pushPreview(request: GitPushPreviewRequest): Promise<GitPushPreviewResult>"
				},
				{
					kind: "method",
					name: "rebaseList",
					signature: "async rebaseList(request: GitRebaseListRequest): Promise<GitRebaseListResult>"
				},
				{
					kind: "method",
					name: "rebaseStart",
					signature: "async rebaseStart(request: GitRebaseStartRequest): Promise<GitRebaseStartResult>"
				},
				{
					kind: "method",
					name: "operationSkip",
					signature: "async operationSkip(request: GitOperationSkipRequest): Promise<GitOperationSkipResult>"
				},
				{
					kind: "method",
					name: "logAuthors",
					signature: "async logAuthors(request: GitLogAuthorsRequest): Promise<GitLogAuthorsResult>"
				},
				{
					kind: "method",
					name: "diffWithWorktree",
					signature: "async diffWithWorktree(request: GitDiffWithWorktreeRequest): Promise<GitDiffWithWorktreeResult>"
				}
			],
			types: [
				{
					name: "GitStatusRequest",
					declaration: "export interface GitStatusRequest { readonly dir: string; }"
				},
				{
					name: "GitStatusResult",
					declaration: "export type GitStatusResult = GitResult<RepoStatus>;"
				},
				{
					name: "GitDiffRequest",
					declaration: "export interface GitDiffRequest { readonly dir: string; readonly path?: string; readonly staged?: boolean; readonly context?: number; readonly wsFlags?: WsFlags; }"
				},
				{
					name: "GitDiffResult",
					declaration: "export type GitDiffResult = GitResult<{ files: DiffFile[] }>;"
				},
				{
					name: "GitStageHunksRequest",
					declaration: "export interface GitStageHunksRequest { readonly dir: string; readonly path: string; readonly hunks: number[]; readonly wsFlags?: WsFlags; }"
				},
				{
					name: "GitStageHunksResult",
					declaration: "export type GitStageHunksResult = GitResult<{ applied: number }>;"
				},
				{
					name: "GitRevertHunksRequest",
					declaration: "export interface GitRevertHunksRequest { readonly dir: string; readonly path: string; readonly hunks: number[]; readonly wsFlags?: WsFlags; }"
				},
				{
					name: "GitRevertHunksResult",
					declaration: "export type GitRevertHunksResult = GitResult<{ reverted: number }>;"
				},
				{
					name: "GitChangeRef",
					declaration: "export interface GitChangeRef { readonly oldStart: number; readonly oldCount: number; readonly newStart: number; readonly newCount: number; }"
				},
				{
					name: "GitStageChangesRequest",
					declaration: "export interface GitStageChangesRequest { readonly dir: string; readonly path: string; readonly change: GitChangeRef; readonly wsFlags?: WsFlags; }"
				},
				{
					name: "GitStageChangesResult",
					declaration: "export type GitStageChangesResult = GitResult<{ applied: number }>;"
				},
				{
					name: "GitRevertChangesRequest",
					declaration: "export interface GitRevertChangesRequest { readonly dir: string; readonly path: string; readonly change: GitChangeRef; readonly wsFlags?: WsFlags; }"
				},
				{
					name: "GitRevertChangesResult",
					declaration: "export type GitRevertChangesResult = GitResult<{ reverted: number }>;"
				},
				{
					name: "GitPathsRequest",
					declaration: "export interface GitPathsRequest { readonly dir: string; readonly paths: string[]; }"
				},
				{
					name: "GitPathsResult",
					declaration: "export type GitPathsResult = GitResult<{ paths: string[] }>;"
				},
				{
					name: "GitCommitRequest",
					declaration: "export interface GitCommitRequest { readonly dir: string; readonly message: string; readonly amend?: boolean; readonly paths?: string[]; readonly partial?: Array<{ readonly path: string; readonly hunks: number[]; readonly wsFlags?: WsFlags }>; }"
				},
				{
					name: "GitCommitResult",
					declaration: "export type GitCommitResult = GitResult<{ hash: string; short: string; amended: boolean }>;"
				},
				{
					name: "GitBranchesRequest",
					declaration: "export interface GitBranchesRequest { readonly dir: string; }"
				},
				{
					name: "GitBranchesResult",
					declaration: "export type GitBranchesResult = GitResult<{ current: string | null; branches: BranchInfo[]; remotes: string[] }>;"
				},
				{
					name: "GitBranchRenameRequest",
					declaration: "export interface GitBranchRenameRequest { readonly dir: string; readonly oldName: string; readonly newName: string; }"
				},
				{
					name: "GitBranchRenameResult",
					declaration: "export type GitBranchRenameResult = GitResult<{ oldName: string; newName: string }>;"
				},
				{
					name: "GitBranchDeleteRequest",
					declaration: "export interface GitBranchDeleteRequest { readonly dir: string; readonly name: string; readonly force?: boolean; }"
				},
				{
					name: "GitBranchDeleteResult",
					declaration: "export type GitBranchDeleteResult = GitResult<{ name: string }>;"
				},
				{
					name: "GitCheckoutRequest",
					declaration: "export interface GitCheckoutRequest { readonly dir: string; readonly branch: string; readonly create?: boolean; readonly startPoint?: string; }"
				},
				{
					name: "GitCheckoutResult",
					declaration: "export type GitCheckoutResult = GitResult<{ branch: string }>;"
				},
				{
					name: "GitMergeRequest",
					declaration: "export interface GitMergeRequest { readonly dir: string; readonly branch: string; }"
				},
				{
					name: "GitMergeResult",
					declaration: "export type GitMergeResult = GitResult<MergeOutcome>;"
				},
				{
					name: "GitConflictContentRequest",
					declaration: "export interface GitConflictContentRequest { readonly dir: string; readonly path: string; }"
				},
				{
					name: "GitConflictContentResult",
					declaration: "export type GitConflictContentResult = GitResult<ConflictView>;"
				},
				{
					name: "GitResolveFileRequest",
					declaration: "export interface GitResolveFileRequest { readonly dir: string; readonly path: string; readonly content: string; }"
				},
				{
					name: "GitResolveFileResult",
					declaration: "export type GitResolveFileResult = GitResult<{ path: string }>;"
				},
				{
					name: "GitReposRequest",
					declaration: "export interface GitReposRequest { readonly dirs: string[]; }"
				},
				{
					name: "GitReposResult",
					declaration: "export type GitReposResult = GitResult<{ repos: RepoProbe[] }>;"
				},
				{
					name: "GitFindReposRequest",
					declaration: "export interface GitFindReposRequest { readonly dir: string; readonly maxDepth?: number; }"
				},
				{
					name: "GitFindReposResult",
					declaration: "export type GitFindReposResult = GitResult<{ repos: string[] }>;"
				},
				{
					name: "GitInitRequest",
					declaration: "export interface GitInitRequest { readonly dir: string; }"
				},
				{
					name: "GitInitResult",
					declaration: "export type GitInitResult = GitResult<{ root: string }>;"
				},
				{
					name: "GitCloneRequest",
					declaration: "export interface GitCloneRequest { readonly url: string; readonly target: string; }"
				},
				{
					name: "GitCloneResult",
					declaration: "export type GitCloneResult = GitResult<{ root: string }>;"
				},
				{
					name: "GitSuggestGitignoreRequest",
					declaration: "export interface GitSuggestGitignoreRequest { readonly dir: string; }"
				},
				{
					name: "GitSuggestGitignoreResult",
					declaration: "export type GitSuggestGitignoreResult = GitResult<{ path: string; changed: boolean }>;"
				},
				{
					name: "GitCommitDetailRequest",
					declaration: "export interface GitCommitDetailRequest { readonly dir: string; readonly hash: string; }"
				},
				{
					name: "GitCommitDetailResult",
					declaration: "export type GitCommitDetailResult = GitResult<CommitDetail>;"
				},
				{
					name: "GitCommitDiffRequest",
					declaration: "export interface GitCommitDiffRequest { readonly dir: string; readonly hash: string; readonly path?: string; }"
				},
				{
					name: "GitCommitDiffResult",
					declaration: "export type GitCommitDiffResult = GitResult<{ files: DiffFile[] }>;"
				},
				{
					name: "GitSuggestCommitsRequest",
					declaration: "export interface GitSuggestCommitsRequest { readonly dir: string; }"
				},
				{
					name: "GitSuggestCommitsResult",
					declaration: "export type GitSuggestCommitsResult = GitResult<{ groups: CommitGroup[]; totalFiles: number }>;"
				},
				{
					name: "GitExecuteCommitsRequest",
					declaration: "export interface GitExecuteCommitsRequest { readonly dir: string; readonly groups: CommitGroup[]; }"
				},
				{
					name: "GitExecuteCommitsResult",
					declaration: "export type GitExecuteCommitsResult = GitResult<{ commits: ExecutedCommit[] }>;"
				},
				{
					name: "CommitGroup",
					declaration: "export interface CommitGroup { readonly message: string; readonly files: string[]; }"
				},
				{
					name: "ExecutedCommit",
					declaration: "export interface ExecutedCommit { readonly message: string; readonly hash: string; readonly short: string; }"
				},
				{
					name: "CommitDetail",
					declaration: "export interface CommitDetail { readonly hash: string; readonly short: string; readonly subject: string; readonly body: string; readonly author: string; readonly authorEmail: string; readonly authorDate: number; readonly committer: string; readonly committerDate: number; readonly parents: string[]; readonly files: CommitFile[]; }"
				},
				{
					name: "CommitFile",
					declaration: "export interface CommitFile { readonly path: string; readonly status: string; readonly additions: number | null; readonly deletions: number | null; }"
				},
				{
					name: "GitResult",
					declaration: "export type GitResult<T> = { ok: true; value: T } | { ok: false; error: GitError };"
				},
				{
					name: "GitError",
					declaration: "export interface GitError { readonly code: string; readonly message: string; }"
				},
				{
					name: "RepoStatus",
					declaration: "export interface RepoStatus { readonly root: string; readonly branch: string | null; readonly head: string | null; readonly ahead: number; readonly behind: number; readonly state: 'clean' | 'merge' | 'rebase' | 'cherry-pick' | 'revert' | 'other'; readonly staged: ChangeFile[]; readonly unstaged: ChangeFile[]; readonly untracked: string[]; readonly conflicts: string[]; }"
				},
				{
					name: "ChangeFile",
					declaration: "export interface ChangeFile { readonly path: string; readonly status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'typechange' | 'unmerged'; readonly target?: string; }"
				},
				{
					name: "DiffFile",
					declaration: "export interface DiffFile { readonly path: string; readonly binary: boolean; readonly hunks: DiffHunk[]; }"
				},
				{
					name: "DiffHunk",
					declaration: "export interface DiffHunk { readonly oldStart: number; readonly oldCount: number; readonly newStart: number; readonly newCount: number; readonly lines: DiffLine[]; }"
				},
				{
					name: "DiffLine",
					declaration: "export interface DiffLine { readonly type: 'ctx' | 'add' | 'del'; readonly text: string; readonly oldNo?: number; readonly newNo?: number; }"
				},
				{
					name: "CommitInfo",
					declaration: "export interface CommitInfo { readonly hash: string; readonly short: string; readonly subject: string; readonly author: string; readonly date: number; readonly refs: string; }"
				},
				{
					name: "BranchInfo",
					declaration: "export interface BranchInfo { readonly name: string; readonly current: boolean; readonly upstream?: string; }"
				},
				{
					name: "ConflictView",
					declaration: "export interface ConflictView { readonly ours: string; readonly theirs: string; readonly markers: number; }"
				},
				{
					name: "MergeOutcome",
					declaration: "export interface MergeOutcome { readonly merged: boolean; readonly hash?: string; readonly conflicts?: string[]; readonly message?: string; }"
				},
				{
					name: "RepoProbe",
					declaration: "export interface RepoProbe { readonly input: string; readonly root: string | null; }"
				},
				{
					name: "GitListDirRequest",
					declaration: "export interface GitListDirRequest { readonly dir: string; readonly path?: string; }"
				},
				{
					name: "GitListDirResult",
					declaration: "export type GitListDirResult = GitResult<{ entries: DirEntry[] }>;"
				},
				{
					name: "GitReadFileRequest",
					declaration: "export interface GitReadFileRequest { readonly dir: string; readonly path: string; }"
				},
				{
					name: "GitBinaryContentRequest",
					declaration: "export interface GitBinaryContentRequest { readonly dir: string; readonly path: string; readonly ref?: string; }"
				},
				{
					name: "GitBinaryContentResult",
					declaration: "export type GitBinaryContentResult = GitResult<{ mime: string; base64: string }>;"
				},
				{
					name: "GitReadFileResult",
					declaration: "export type GitReadFileResult = GitResult<FileContent>;"
				},
				{
					name: "DirEntry",
					declaration: "export interface DirEntry { readonly name: string; readonly path: string; readonly kind: 'dir' | 'file'; }"
				},
				{
					name: "FileContent",
					declaration: "export interface FileContent { readonly content: string; readonly truncated: boolean; readonly binary: boolean; }"
				},
				{
					name: "GitWriteFileRequest",
					declaration: "export interface GitWriteFileRequest { readonly dir: string; readonly path: string; readonly content: string; }"
				},
				{
					name: "GitWriteFileResult",
					declaration: "export type GitWriteFileResult = GitResult<{ path: string }>;"
				},
				{
					name: "GitDeleteFileRequest",
					declaration: "export interface GitDeleteFileRequest { readonly dir: string; readonly path: string; readonly recursive?: boolean; }"
				},
				{
					name: "GitDeleteFileResult",
					declaration: "export type GitDeleteFileResult = GitResult<{ path: string }>;"
				},
				{
					name: "GitChangelistListRequest",
					declaration: "export interface GitChangelistListRequest { readonly dir: string; }"
				},
				{
					name: "GitChangelistListResult",
					declaration: "export type GitChangelistListResult = GitResult<{ changelists: ChangelistEntry[]; active: string }>;"
				},
				{
					name: "GitChangelistCreateRequest",
					declaration: "export interface GitChangelistCreateRequest { readonly dir: string; readonly name: string; }"
				},
				{
					name: "GitChangelistCreateResult",
					declaration: "export type GitChangelistCreateResult = GitResult<{ name: string }>;"
				},
				{
					name: "GitChangelistRenameRequest",
					declaration: "export interface GitChangelistRenameRequest { readonly dir: string; readonly oldName: string; readonly newName: string; }"
				},
				{
					name: "GitChangelistRenameResult",
					declaration: "export type GitChangelistRenameResult = GitResult<{ name: string }>;"
				},
				{
					name: "GitChangelistDeleteRequest",
					declaration: "export interface GitChangelistDeleteRequest { readonly dir: string; readonly name: string; }"
				},
				{
					name: "GitChangelistDeleteResult",
					declaration: "export type GitChangelistDeleteResult = GitResult<{ name: string }>;"
				},
				{
					name: "GitChangelistMoveRequest",
					declaration: "export interface GitChangelistMoveRequest { readonly dir: string; readonly paths: string[]; readonly to: string; }"
				},
				{
					name: "GitChangelistMoveResult",
					declaration: "export type GitChangelistMoveResult = GitResult<{ moved: number }>;"
				},
				{
					name: "GitChangelistSetActiveRequest",
					declaration: "export interface GitChangelistSetActiveRequest { readonly dir: string; readonly name: string; }"
				},
				{
					name: "GitChangelistSetActiveResult",
					declaration: "export type GitChangelistSetActiveResult = GitResult<{ active: string }>;"
				},
				{
					name: "GitIgnoreAddRequest",
					declaration: "export interface GitIgnoreAddRequest { readonly dir: string; readonly path: string; readonly target: 'gitignore' | 'exclude'; }"
				},
				{
					name: "GitIgnoreAddResult",
					declaration: "export type GitIgnoreAddResult = GitResult<{ path: string; target: string }>;"
				},
				{
					name: "GitPushPreviewRequest",
					declaration: "export interface GitPushPreviewRequest { readonly dir: string; readonly remote: string; readonly branch: string; }"
				},
				{
					name: "GitPushPreviewResult",
					declaration: "export type GitPushPreviewResult = GitResult<{ upstream: string | null; ahead: CommitInfo[] }>;"
				},
				{
					name: "GitRebaseListRequest",
					declaration: "export interface GitRebaseListRequest { readonly dir: string; }"
				},
				{
					name: "GitRebaseListResult",
					declaration: "export type GitRebaseListResult = GitResult<{ base: string; commits: CommitInfo[] }>;"
				},
				{
					name: "GitRebaseStartRequest",
					declaration: "export interface GitRebaseStartRequest { readonly dir: string; readonly base: string; readonly items: RebaseItem[]; }"
				},
				{
					name: "GitRebaseStartResult",
					declaration: "export type GitRebaseStartResult = GitResult<{ started: boolean; conflicts?: string[]; message?: string }>;"
				},
				{
					name: "GitOperationSkipRequest",
					declaration: "export interface GitOperationSkipRequest { readonly dir: string; }"
				},
				{
					name: "GitOperationSkipResult",
					declaration: "export type GitOperationSkipResult = GitResult<{ skipped: boolean; conflicts?: string[] }>;"
				},
				{
					name: "GitLogAuthorsRequest",
					declaration: "export interface GitLogAuthorsRequest { readonly dir: string; readonly branch?: string; }"
				},
				{
					name: "GitLogAuthorsResult",
					declaration: "export type GitLogAuthorsResult = GitResult<{ authors: LogAuthor[] }>;"
				},
				{
					name: "LogAuthor",
					declaration: "export interface LogAuthor { readonly name: string; readonly email: string; readonly count: number; }"
				},
				{
					name: "GitDiffWithWorktreeRequest",
					declaration: "export interface GitDiffWithWorktreeRequest { readonly dir: string; readonly hash: string; }"
				},
				{
					name: "GitDiffWithWorktreeResult",
					declaration: "export type GitDiffWithWorktreeResult = GitResult<{ files: DiffFile[] }>;"
				},
				{
					name: "ChangelistEntry",
					declaration: "export interface ChangelistEntry { readonly name: string; readonly paths: string[]; }"
				},
				{
					name: "RebaseItem",
					declaration: "export interface RebaseItem { readonly action: 'pick' | 'reword' | 'squash' | 'fixup' | 'drop'; readonly hash: string; readonly message?: string; }"
				}
			]
		}],
		events: [],
		objects: []
	}
};
//#endregion
export { TYPERT };
