/**
 * Invocation descriptors for the `git` Remote — one source of truth consumed
 * by both the host TYPERT manifest (typert.ts) and the client contribution
 * (remote.ts), mirroring the shape the repo's typert generator emits.
 */
import * as S from "./schemas.js";

const PACKAGE = "dsh-git-ui";
const NS = "git";

interface Descriptor {
  id: string;
  service: string;
  namespace: string;
  method: string;
  invocation: { kind: "direct" };
  parameters: Array<{
    name: string;
    wire: string;
    source: "json";
    codec: { mode: "strict"; typeSymbol: string; schema: unknown };
  }>;
  result: { mode: "strict"; typeSymbol: string; schema: unknown };
  sourceLocation: { file: string; line: number; column: number };
}

function def(
  method: string,
  requestSchema: unknown,
  requestType: string,
  resultSchema: unknown,
  resultType: string
): Descriptor {
  return {
    id: `${PACKAGE}#${NS}/${method}`,
    service: NS,
    namespace: NS,
    method,
    invocation: { kind: "direct" },
    parameters: [
      {
        name: "request",
        wire: "request",
        source: "json",
        codec: { mode: "strict", typeSymbol: `${PACKAGE}/types#${requestType}`, schema: requestSchema }
      }
    ],
    result: {
      mode: "strict",
      typeSymbol: `${PACKAGE}/types#${resultType}`,
      schema: resultSchema
    },
    sourceLocation: { file: "src/index.ts", line: 1, column: 1 }
  };
}

export const DESCRIPTORS: Descriptor[] = [
  def("status", S.statusRequestSchema, "GitStatusRequest", S.statusResultSchema, "GitStatusResult"),
  def("diff", S.diffRequestSchema, "GitDiffRequest", S.diffResultSchema, "GitDiffResult"),
  def("stageHunks", S.stageHunksRequestSchema, "GitStageHunksRequest", S.stageHunksResultSchema, "GitStageHunksResult"),
  def("revertHunks", S.revertHunksRequestSchema, "GitRevertHunksRequest", S.revertHunksResultSchema, "GitRevertHunksResult"),
  def("stageChanges", S.stageChangesRequestSchema, "GitStageChangesRequest", S.stageChangesResultSchema, "GitStageChangesResult"),
  def("revertChanges", S.revertChangesRequestSchema, "GitRevertChangesRequest", S.revertChangesResultSchema, "GitRevertChangesResult"),
  def("stage", S.pathsRequestSchema, "GitPathsRequest", S.pathsResultSchema, "GitPathsResult"),
  def("unstage", S.pathsRequestSchema, "GitPathsRequest", S.pathsResultSchema, "GitPathsResult"),
  def("discard", S.pathsRequestSchema, "GitPathsRequest", S.pathsResultSchema, "GitPathsResult"),
  def("untrack", S.pathsRequestSchema, "GitPathsRequest", S.pathsResultSchema, "GitPathsResult"),
  def("getFromRevision", S.getFromRevisionRequestSchema, "GitGetFromRevisionRequest", S.getFromRevisionResultSchema, "GitGetFromRevisionResult"),
  def("commit", S.commitRequestSchema, "GitCommitRequest", S.commitResultSchema, "GitCommitResult"),
  def("branches", S.branchesRequestSchema, "GitBranchesRequest", S.branchesResultSchema, "GitBranchesResult"),
  def("branchRename", S.branchRenameRequestSchema, "GitBranchRenameRequest", S.branchRenameResultSchema, "GitBranchRenameResult"),
  def("branchDelete", S.branchDeleteRequestSchema, "GitBranchDeleteRequest", S.branchDeleteResultSchema, "GitBranchDeleteResult"),
  def("checkout", S.checkoutRequestSchema, "GitCheckoutRequest", S.checkoutResultSchema, "GitCheckoutResult"),
  def("merge", S.mergeRequestSchema, "GitMergeRequest", S.mergeResultSchema, "GitMergeResult"),
  def("conflictContent", S.conflictContentRequestSchema, "GitConflictContentRequest", S.conflictContentResultSchema, "GitConflictContentResult"),
  def("resolveFile", S.resolveFileRequestSchema, "GitResolveFileRequest", S.resolveFileResultSchema, "GitResolveFileResult"),
  def("repos", S.reposRequestSchema, "GitReposRequest", S.reposResultSchema, "GitReposResult"),
  def("findRepos", S.findReposRequestSchema, "GitFindReposRequest", S.findReposResultSchema, "GitFindReposResult"),
  def("init", S.initRequestSchema, "GitInitRequest", S.initResultSchema, "GitInitResult"),
  def("clone", S.cloneRequestSchema, "GitCloneRequest", S.cloneResultSchema, "GitCloneResult"),
  def("suggestGitignore", S.suggestGitignoreRequestSchema, "GitSuggestGitignoreRequest", S.suggestGitignoreResultSchema, "GitSuggestGitignoreResult"),
  def("commitDetail", S.commitDetailRequestSchema, "GitCommitDetailRequest", S.commitDetailResultSchema, "GitCommitDetailResult"),
  def("commitDiff", S.commitDiffRequestSchema, "GitCommitDiffRequest", S.commitDiffResultSchema, "GitCommitDiffResult"),
  def("suggestCommits", S.suggestCommitsRequestSchema, "GitSuggestCommitsRequest", S.suggestCommitsResultSchema, "GitSuggestCommitsResult"),
  def("executeCommits", S.executeCommitsRequestSchema, "GitExecuteCommitsRequest", S.executeCommitsResultSchema, "GitExecuteCommitsResult"),
  def("remotes", S.remotesRequestSchema, "GitRemotesRequest", S.remotesResultSchema, "GitRemotesResult"),
  def("remoteAdd", S.remoteAddRequestSchema, "GitRemoteAddRequest", S.remoteAddResultSchema, "GitRemoteAddResult"),
  def("remoteRemove", S.remoteRemoveRequestSchema, "GitRemoteRemoveRequest", S.remoteRemoveResultSchema, "GitRemoteRemoveResult"),
  def("push", S.pushRequestSchema, "GitPushRequest", S.pushResultSchema, "GitPushResult"),
  def("fetch", S.fetchRequestSchema, "GitFetchRequest", S.fetchResultSchema, "GitFetchResult"),
  def("pull", S.pullRequestSchema, "GitPullRequest", S.pullResultSchema, "GitPullResult"),
  def("stashList", S.stashListRequestSchema, "GitStashListRequest", S.stashListResultSchema, "GitStashListResult"),
  def("stashPush", S.stashPushRequestSchema, "GitStashPushRequest", S.stashPushResultSchema, "GitStashPushResult"),
  def("stashPop", S.stashPopRequestSchema, "GitStashPopRequest", S.stashPopResultSchema, "GitStashPopResult"),
  def("stashDrop", S.stashDropRequestSchema, "GitStashDropRequest", S.stashDropResultSchema, "GitStashDropResult"),
  def("cherryPick", S.cherryPickRequestSchema, "GitCherryPickRequest", S.cherryPickResultSchema, "GitCherryPickResult"),
  def("revert", S.revertRequestSchema, "GitRevertRequest", S.revertResultSchema, "GitRevertResult"),
  def("squashCommits", S.squashCommitsRequestSchema, "GitSquashCommitsRequest", S.squashCommitsResultSchema, "GitSquashCommitsResult"),
  def("reset", S.resetRequestSchema, "GitResetRequest", S.resetResultSchema, "GitResetResult"),
  def("operationAbort", S.operationAbortRequestSchema, "GitOperationAbortRequest", S.operationAbortResultSchema, "GitOperationAbortResult"),
  def("operationContinue", S.operationContinueRequestSchema, "GitOperationContinueRequest", S.operationContinueResultSchema, "GitOperationContinueResult"),
  def("operationSkip", S.operationSkipRequestSchema, "GitOperationSkipRequest", S.operationSkipResultSchema, "GitOperationSkipResult"),
  def("tags", S.tagsRequestSchema, "GitTagsRequest", S.tagsResultSchema, "GitTagsResult"),
  def("tagCreate", S.tagCreateRequestSchema, "GitTagCreateRequest", S.tagCreateResultSchema, "GitTagCreateResult"),
  def("tagDelete", S.tagDeleteRequestSchema, "GitTagDeleteRequest", S.tagDeleteResultSchema, "GitTagDeleteResult"),
  def("logGraph", S.logGraphRequestSchema, "GitLogGraphRequest", S.logGraphResultSchema, "GitLogGraphResult"),
  def("logAuthors", S.logAuthorsRequestSchema, "GitLogAuthorsRequest", S.logAuthorsResultSchema, "GitLogAuthorsResult"),
  def("fileLog", S.fileLogRequestSchema, "GitFileLogRequest", S.fileLogResultSchema, "GitFileLogResult"),
  def("compare", S.compareRequestSchema, "GitCompareRequest", S.compareResultSchema, "GitCompareResult"),
  def("configList", S.configListRequestSchema, "GitConfigListRequest", S.configListResultSchema, "GitConfigListResult"),
  def("configSet", S.configSetRequestSchema, "GitConfigSetRequest", S.configSetResultSchema, "GitConfigSetResult"),
  def("pullRemoteBranch", S.pullRemoteBranchRequestSchema, "GitPullRemoteBranchRequest", S.pullRemoteBranchResultSchema, "GitPullRemoteBranchResult"),
  def("changelistList", S.changelistListRequestSchema, "GitChangelistListRequest", S.changelistListResultSchema, "GitChangelistListResult"),
  def("changelistCreate", S.changelistCreateRequestSchema, "GitChangelistCreateRequest", S.changelistCreateResultSchema, "GitChangelistCreateResult"),
  def("changelistRename", S.changelistRenameRequestSchema, "GitChangelistRenameRequest", S.changelistRenameResultSchema, "GitChangelistRenameResult"),
  def("changelistDelete", S.changelistDeleteRequestSchema, "GitChangelistDeleteRequest", S.changelistDeleteResultSchema, "GitChangelistDeleteResult"),
  def("changelistMove", S.changelistMoveRequestSchema, "GitChangelistMoveRequest", S.changelistMoveResultSchema, "GitChangelistMoveResult"),
  def("changelistSetActive", S.changelistSetActiveRequestSchema, "GitChangelistSetActiveRequest", S.changelistSetActiveResultSchema, "GitChangelistSetActiveResult"),
  def("ignoreAdd", S.ignoreAddRequestSchema, "GitIgnoreAddRequest", S.ignoreAddResultSchema, "GitIgnoreAddResult"),
  def("pushPreview", S.pushPreviewRequestSchema, "GitPushPreviewRequest", S.pushPreviewResultSchema, "GitPushPreviewResult"),
  def("rebaseList", S.rebaseListRequestSchema, "GitRebaseListRequest", S.rebaseListResultSchema, "GitRebaseListResult"),
  def("rebaseStart", S.rebaseStartRequestSchema, "GitRebaseStartRequest", S.rebaseStartResultSchema, "GitRebaseStartResult"),
  def("diffWithWorktree", S.diffWithWorktreeRequestSchema, "GitDiffWithWorktreeRequest", S.diffWithWorktreeResultSchema, "GitDiffWithWorktreeResult"),
  def("listDir", S.listDirRequestSchema, "GitListDirRequest", S.listDirResultSchema, "GitListDirResult"),
  def("readFile", S.readFileRequestSchema, "GitReadFileRequest", S.readFileResultSchema, "GitReadFileResult"),
  def("binaryContent", S.binaryContentRequestSchema, "GitBinaryContentRequest", S.binaryContentResultSchema, "GitBinaryContentResult"),
  def("writeFile", S.writeFileRequestSchema, "GitWriteFileRequest", S.writeFileResultSchema, "GitWriteFileResult"),
  def("deleteFile", S.deleteFileRequestSchema, "GitDeleteFileRequest", S.deleteFileResultSchema, "GitDeleteFileResult")
];