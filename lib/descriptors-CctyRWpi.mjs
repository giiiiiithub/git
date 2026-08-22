import { z } from "zod";
//#region src/schemas.ts
/**
* Zod schemas for the git Remote wire contract. Bundled into both faces:
* the host typert manifest validates incoming args and outgoing results, and
* the client contribution validates the same envelope on the browser side.
*/
const gitErrorSchema = z.object({
	code: z.string(),
	message: z.string()
});
function okSchema(value) {
	return z.object({
		ok: z.literal(true),
		value
	});
}
function resultSchema(value) {
	return z.union([okSchema(value), z.object({
		ok: z.literal(false),
		error: gitErrorSchema
	})]);
}
const dirRequestSchema = z.object({ dir: z.string().min(1) });
const changeStatusSchema = z.union([
	z.literal("added"),
	z.literal("modified"),
	z.literal("deleted"),
	z.literal("renamed"),
	z.literal("copied"),
	z.literal("typechange"),
	z.literal("unmerged")
]);
const changeFileSchema = z.object({
	path: z.string(),
	status: changeStatusSchema,
	target: z.string().optional()
});
const repoStatusSchema = z.object({
	root: z.string(),
	branch: z.union([z.string(), z.null()]),
	head: z.union([z.string(), z.null()]),
	ahead: z.number(),
	behind: z.number(),
	state: z.union([
		z.literal("clean"),
		z.literal("merge"),
		z.literal("rebase"),
		z.literal("cherry-pick"),
		z.literal("revert"),
		z.literal("other")
	]),
	/** Branch being merged in (source), non-null while state === "merge". */
	mergeSource: z.union([z.string(), z.null()]),
	staged: z.array(changeFileSchema),
	unstaged: z.array(changeFileSchema),
	untracked: z.array(z.string()),
	conflicts: z.array(z.string())
});
const statusRequestSchema = dirRequestSchema;
const statusResultSchema = resultSchema(repoStatusSchema);
const diffLineSchema = z.object({
	type: z.union([
		z.literal("ctx"),
		z.literal("add"),
		z.literal("del")
	]),
	text: z.string(),
	oldNo: z.number().optional(),
	newNo: z.number().optional()
});
const diffHunkSchema = z.object({
	oldStart: z.number(),
	oldCount: z.number(),
	newStart: z.number(),
	newCount: z.number(),
	lines: z.array(diffLineSchema)
});
const diffFileSchema = z.object({
	path: z.string(),
	binary: z.boolean(),
	hunks: z.array(diffHunkSchema)
});
const diffRequestSchema = dirRequestSchema.extend({
	path: z.string().optional(),
	staged: z.boolean().optional(),
	context: z.number().int().min(0).max(20).optional(),
	/**
	* Whitespace flags (IDEA "Do not ignore" dropdown, independent toggles).
	* Hunk boundaries change with the flags, so every hunk-indexed operation
	* must use the same flags.
	*/
	wsFlags: z.object({
		trimEol: z.boolean().optional(),
		ignoreWs: z.boolean().optional(),
		ignoreBlank: z.boolean().optional()
	}).optional()
});
const diffResultSchema = resultSchema(z.object({ files: z.array(diffFileSchema) }));
const hunkPatchRequestSchema = dirRequestSchema.extend({
	/** Tracked file path relative to dir. */
	path: z.string().min(1),
	/** Indices of the hunks to operate on (0-based, as shown in the diff). */
	hunks: z.array(z.number().int().min(0)).min(1),
	/** Must match the display diff's whitespace flags (hunk boundaries). */
	wsFlags: z.object({
		trimEol: z.boolean().optional(),
		ignoreWs: z.boolean().optional(),
		ignoreBlank: z.boolean().optional()
	}).optional()
});
const stageHunksRequestSchema = hunkPatchRequestSchema;
const stageHunksResultSchema = resultSchema(z.object({ applied: z.number() }));
const revertHunksRequestSchema = hunkPatchRequestSchema;
const revertHunksResultSchema = resultSchema(z.object({ reverted: z.number() }));
const changeRefSchema = z.object({
	oldStart: z.number().int().min(0),
	oldCount: z.number().int().min(0),
	newStart: z.number().int().min(0),
	newCount: z.number().int().min(0)
});
const changePatchRequestSchema = dirRequestSchema.extend({
	/** Tracked file path relative to dir. */
	path: z.string().min(1),
	/** The visual change (block) to operate on, as shown in the diff. */
	change: changeRefSchema,
	/** Must match the display diff's whitespace flags (change boundaries). */
	wsFlags: z.object({
		trimEol: z.boolean().optional(),
		ignoreWs: z.boolean().optional(),
		ignoreBlank: z.boolean().optional()
	}).optional()
});
const stageChangesRequestSchema = changePatchRequestSchema;
const stageChangesResultSchema = resultSchema(z.object({ applied: z.number() }));
const revertChangesRequestSchema = changePatchRequestSchema;
const revertChangesResultSchema = resultSchema(z.object({ reverted: z.number() }));
const dirEntrySchema = z.object({
	name: z.string(),
	path: z.string(),
	kind: z.union([z.literal("dir"), z.literal("file")])
});
const listDirRequestSchema = dirRequestSchema.extend({ 
/** Subdirectory path relative to dir; omitted = list dir itself. */
path: z.string().optional() });
const listDirResultSchema = resultSchema(z.object({ entries: z.array(dirEntrySchema) }));
const readFileRequestSchema = dirRequestSchema.extend({ 
/** File path relative to dir. */
path: z.string().min(1) });
const binaryContentRequestSchema = dirRequestSchema.extend({
	/** File path relative to dir. */
	path: z.string().min(1),
	/** Git revision to read from ("HEAD", a hash, ...); omitted = working tree. */
	ref: z.string().optional()
});
const binaryContentResultSchema = resultSchema(z.object({
	mime: z.string(),
	base64: z.string()
}));
const readFileResultSchema = resultSchema(z.object({
	content: z.string(),
	truncated: z.boolean(),
	binary: z.boolean()
}));
const writeFileRequestSchema = dirRequestSchema.extend({
	path: z.string().min(1),
	content: z.string()
});
const writeFileResultSchema = resultSchema(z.object({ path: z.string() }));
const deleteFileRequestSchema = dirRequestSchema.extend({
	path: z.string().min(1),
	/** Recursively delete a directory tree. */
	recursive: z.boolean().optional()
});
const deleteFileResultSchema = resultSchema(z.object({ path: z.string() }));
const pathsRequestSchema = dirRequestSchema.extend({
	paths: z.array(z.string().min(1)).min(1),
	/** True when the discard must also clear the index (staged files). */
	staged: z.boolean().optional()
});
const pathsResultSchema = resultSchema(z.object({ paths: z.array(z.string()) }));
/** Checkout the selected file(s) at a given revision into the worktree+index. */
const getFromRevisionRequestSchema = dirRequestSchema.extend({
	paths: z.array(z.string().min(1)).min(1),
	revision: z.string().min(1)
});
const getFromRevisionResultSchema = pathsResultSchema;
const commitRequestSchema = dirRequestSchema.extend({
	message: z.string().min(1),
	amend: z.boolean().optional(),
	paths: z.array(z.string().min(1)).optional(),
	/** Hunk-level commit: only these hunks of these files enter the commit.
	*  The files must have no staged changes (the index is rebuilt exactly). */
	partial: z.array(z.object({
		path: z.string().min(1),
		hunks: z.array(z.number().int().min(0)).min(1),
		wsFlags: z.object({
			trimEol: z.boolean().optional(),
			ignoreWs: z.boolean().optional(),
			ignoreBlank: z.boolean().optional()
		}).optional()
	})).optional()
});
const commitResultSchema = resultSchema(z.object({
	hash: z.string(),
	short: z.string(),
	amended: z.boolean()
}));
const branchesRequestSchema = dirRequestSchema;
const branchInfoSchema = z.object({
	name: z.string(),
	current: z.boolean(),
	upstream: z.string().optional()
});
const branchesResultSchema = resultSchema(z.object({
	current: z.union([z.string(), z.null()]),
	branches: z.array(branchInfoSchema),
	remotes: z.array(z.string())
}));
const branchRenameRequestSchema = dirRequestSchema.extend({
	oldName: z.string().min(1),
	newName: z.string().min(1)
});
const branchRenameResultSchema = resultSchema(z.object({
	oldName: z.string(),
	newName: z.string()
}));
const branchDeleteRequestSchema = dirRequestSchema.extend({
	name: z.string().min(1),
	force: z.boolean().optional()
});
const branchDeleteResultSchema = resultSchema(z.object({ name: z.string() }));
const checkoutRequestSchema = dirRequestSchema.extend({
	branch: z.string().min(1),
	create: z.boolean().optional(),
	/** Ref to create the branch from (git checkout -b <branch> <startPoint>). */
	startPoint: z.string().optional()
});
const checkoutResultSchema = resultSchema(z.object({ branch: z.string() }));
const mergeRequestSchema = dirRequestSchema.extend({
	branch: z.string().min(1),
	/** Force a merge commit instead of fast-forwarding (git merge --no-ff). */
	noFF: z.boolean().optional()
});
const mergeKindSchema = z.union([
	z.literal("already-up-to-date"),
	z.literal("fast-forward"),
	z.literal("merge"),
	z.literal("conflicts"),
	z.literal("error")
]);
const mergeResultSchema = resultSchema(z.object({
	merged: z.boolean(),
	kind: mergeKindSchema,
	hash: z.string().optional(),
	conflicts: z.array(z.string()).optional(),
	message: z.string().optional()
}));
const conflictContentRequestSchema = dirRequestSchema.extend({ path: z.string().min(1) });
const conflictBlockSchema = z.object({
	oursStart: z.number(),
	oursEnd: z.number(),
	theirsStart: z.number(),
	theirsEnd: z.number(),
	resultStart: z.number(),
	resultEnd: z.number()
});
const conflictContentResultSchema = resultSchema(z.object({
	ours: z.string(),
	theirs: z.string(),
	result: z.string(),
	markers: z.number(),
	blocks: z.array(conflictBlockSchema)
}));
const resolveFileRequestSchema = dirRequestSchema.extend({
	path: z.string().min(1),
	content: z.string()
});
const resolveFileResultSchema = resultSchema(z.object({ path: z.string() }));
const reposRequestSchema = z.object({ dirs: z.array(z.string().min(1)).min(1) });
const reposResultSchema = resultSchema(z.object({ repos: z.array(z.object({
	input: z.string(),
	root: z.union([z.string(), z.null()])
})) }));
/**
* Find git repositories inside the subdirectories of `dir` (never `dir`
* itself). Used by the directory dropdown: when the session cwd is not itself
* a repository root, its nested repos (up to maxDepth levels) are offered as
* candidates instead.
*/
const findReposRequestSchema = z.object({
	dir: z.string().min(1),
	/** Maximum subdirectory depth to scan (1..10, default 3). */
	maxDepth: z.number().int().min(1).max(10).optional()
});
const findReposResultSchema = resultSchema(z.object({ 
/** Absolute paths of the repository roots found under `dir`. */
repos: z.array(z.string()) }));
const initRequestSchema = dirRequestSchema;
const initResultSchema = resultSchema(z.object({ root: z.string() }));
const cloneRequestSchema = z.object({
	/** Remote repository URL (https, ssh, git, file…). */
	url: z.string().min(1),
	/** Target directory — git clone semantics: created when missing, must be
	*  empty when it already exists. */
	target: z.string().min(1)
});
const cloneResultSchema = resultSchema(z.object({ root: z.string() }));
const suggestGitignoreRequestSchema = dirRequestSchema;
const suggestGitignoreResultSchema = resultSchema(z.object({
	path: z.string(),
	changed: z.boolean()
}));
const commitGroupSchema = z.object({
	message: z.string().min(1),
	files: z.array(z.string().min(1)).min(1)
});
const suggestCommitsRequestSchema = dirRequestSchema;
const suggestCommitsResultSchema = resultSchema(z.object({
	groups: z.array(commitGroupSchema),
	totalFiles: z.number()
}));
const executeCommitsRequestSchema = dirRequestSchema.extend({ groups: z.array(commitGroupSchema).min(1) });
const executeCommitsResultSchema = resultSchema(z.object({ commits: z.array(z.object({
	message: z.string(),
	hash: z.string(),
	short: z.string()
})) }));
const commitDetailRequestSchema = dirRequestSchema.extend({ hash: z.string().min(1) });
const commitFileSchema = z.object({
	path: z.string(),
	status: z.string(),
	additions: z.union([z.number(), z.null()]),
	deletions: z.union([z.number(), z.null()])
});
const commitDetailResultSchema = resultSchema(z.object({
	hash: z.string(),
	short: z.string(),
	subject: z.string(),
	body: z.string(),
	author: z.string(),
	authorEmail: z.string(),
	authorDate: z.number(),
	committer: z.string(),
	committerDate: z.number(),
	parents: z.array(z.string()),
	files: z.array(commitFileSchema)
}));
const commitDiffRequestSchema = dirRequestSchema.extend({
	hash: z.string().min(1),
	path: z.string().optional()
});
const commitDiffResultSchema = resultSchema(z.object({ files: z.array(diffFileSchema) }));
const remoteInfoSchema = z.object({
	name: z.string(),
	url: z.string(),
	pushUrl: z.string().optional()
});
const remotesRequestSchema = dirRequestSchema;
const remotesResultSchema = resultSchema(z.object({ remotes: z.array(remoteInfoSchema) }));
const remoteAddRequestSchema = dirRequestSchema.extend({
	name: z.string().min(1),
	url: z.string().min(1)
});
const remoteAddResultSchema = resultSchema(z.object({
	name: z.string(),
	url: z.string()
}));
const remoteRemoveRequestSchema = dirRequestSchema.extend({ name: z.string().min(1) });
const remoteRemoveResultSchema = resultSchema(z.object({ name: z.string() }));
const pushRequestSchema = dirRequestSchema.extend({
	remote: z.string().min(1),
	branch: z.string().min(1),
	setUpstream: z.boolean().optional(),
	/** Remote-side branch name; defaults to the local branch name. */
	remoteBranch: z.string().optional(),
	/** Force push (--force-with-lease). */
	force: z.boolean().optional(),
	/** Also push tags pointing into the pushed commits (--follow-tags). */
	followTags: z.boolean().optional()
});
const pushResultSchema = resultSchema(z.object({
	pushed: z.boolean(),
	message: z.string().optional()
}));
const fetchRequestSchema = dirRequestSchema.extend({ remote: z.string().optional() });
const fetchResultSchema = resultSchema(z.object({
	fetched: z.boolean(),
	message: z.string().optional()
}));
const pullRequestSchema = dirRequestSchema.extend({
	remote: z.string().min(1),
	branch: z.string().min(1),
	strategy: z.union([z.literal("merge"), z.literal("rebase")]).optional()
});
const pullResultSchema = resultSchema(z.object({
	pulled: z.boolean(),
	kind: mergeKindSchema,
	hash: z.string().optional(),
	conflicts: z.array(z.string()).optional(),
	message: z.string().optional()
}));
const stashListRequestSchema = dirRequestSchema;
const stashListResultSchema = resultSchema(z.object({ stashes: z.array(z.object({
	index: z.number(),
	message: z.string(),
	date: z.string()
})) }));
const stashPushRequestSchema = dirRequestSchema.extend({
	message: z.string().optional(),
	includeUntracked: z.boolean().optional()
});
const stashPushResultSchema = resultSchema(z.object({
	stashed: z.boolean(),
	message: z.string().optional()
}));
const stashPopRequestSchema = dirRequestSchema.extend({ index: z.number().int().min(0).optional() });
const stashPopResultSchema = resultSchema(z.object({
	popped: z.boolean(),
	conflicts: z.array(z.string()).optional(),
	message: z.string().optional()
}));
const stashDropRequestSchema = dirRequestSchema.extend({ index: z.number().int().min(0).optional() });
const stashDropResultSchema = resultSchema(z.object({ dropped: z.boolean() }));
dirRequestSchema.extend({ index: z.number().int().min(0).optional() });
resultSchema(z.object({
	applied: z.boolean(),
	conflicts: z.array(z.string()).optional(),
	message: z.string().optional()
}));
resultSchema(z.object({ cleared: z.boolean() }));
dirRequestSchema.extend({ index: z.number().int().min(0) });
resultSchema(z.object({ lines: z.array(z.string()) }));
dirRequestSchema.extend({
	index: z.number().int().min(0),
	name: z.string().min(1)
});
resultSchema(z.object({ branch: z.string() }));
const cherryPickRequestSchema = dirRequestSchema.extend({ 
/** Single commit, or several to apply in one cherry-pick run. */
hash: z.union([z.string().min(1), z.array(z.string().min(1))]) });
const cherryPickResultSchema = resultSchema(z.object({
	picked: z.boolean(),
	conflicts: z.array(z.string()).optional(),
	message: z.string().optional()
}));
const revertRequestSchema = dirRequestSchema.extend({ 
/** Single commit, or several to revert in one run. */
hash: z.union([z.string().min(1), z.array(z.string().min(1))]) });
const revertResultSchema = resultSchema(z.object({
	reverted: z.boolean(),
	conflicts: z.array(z.string()).optional(),
	message: z.string().optional()
}));
const squashCommitsRequestSchema = dirRequestSchema.extend({
	/** Commits to fold into one, oldest first. Must be a contiguous run ending at HEAD. */
	hashes: z.array(z.string().min(1)).min(2),
	message: z.string()
});
const squashCommitsResultSchema = resultSchema(z.object({
	hash: z.string(),
	short: z.string()
}));
const resetRequestSchema = dirRequestSchema.extend({
	mode: z.union([
		z.literal("soft"),
		z.literal("mixed"),
		z.literal("hard")
	]),
	ref: z.string().optional()
});
const resetResultSchema = resultSchema(z.object({
	reset: z.boolean(),
	mode: z.string()
}));
const operationAbortRequestSchema = dirRequestSchema;
const operationAbortResultSchema = resultSchema(z.object({ aborted: z.boolean() }));
const operationContinueRequestSchema = dirRequestSchema.extend({ message: z.string().optional() });
const operationContinueResultSchema = resultSchema(z.object({
	continued: z.boolean(),
	hash: z.string().optional()
}));
const operationSkipRequestSchema = dirRequestSchema;
const operationSkipResultSchema = resultSchema(z.object({
	skipped: z.boolean(),
	conflicts: z.array(z.string()).optional()
}));
const tagsRequestSchema = dirRequestSchema;
const tagsResultSchema = resultSchema(z.object({ tags: z.array(z.object({
	name: z.string(),
	hash: z.string(),
	short: z.string(),
	subject: z.string().optional()
})) }));
const tagCreateRequestSchema = dirRequestSchema.extend({
	name: z.string().min(1),
	hash: z.string().optional()
});
const tagCreateResultSchema = resultSchema(z.object({ name: z.string() }));
const tagDeleteRequestSchema = dirRequestSchema.extend({ name: z.string().min(1) });
const tagDeleteResultSchema = resultSchema(z.object({ name: z.string() }));
const graphCharSchema = z.object({
	ch: z.string(),
	color: z.string().optional()
});
const logGraphRequestSchema = dirRequestSchema.extend({
	limit: z.number().int().min(1).max(300).optional(),
	/** Restrict to commits reachable from this ref. */
	branch: z.string().optional(),
	/** Commit author filter (substring or email pattern). */
	author: z.string().optional(),
	/** ISO date or "N days ago" style since filter. */
	since: z.string().optional(),
	/** ISO date or "N days ago" style until filter. */
	until: z.string().optional(),
	/** Restrict to commits touching this path. */
	path: z.string().optional()
});
const logGraphResultSchema = resultSchema(z.object({ rows: z.array(z.object({
	graph: z.array(graphCharSchema),
	hash: z.string(),
	short: z.string(),
	subject: z.string(),
	refs: z.string(),
	author: z.string(),
	date: z.number()
})) }));
const logAuthorsRequestSchema = dirRequestSchema.extend({ 
/** Restrict to commits reachable from this ref (matches the branch filter). */
branch: z.string().optional() });
const logAuthorsResultSchema = resultSchema(z.object({ authors: z.array(z.object({
	name: z.string(),
	email: z.string(),
	count: z.number()
})) }));
const commitInfoSchema = z.object({
	hash: z.string(),
	short: z.string(),
	subject: z.string(),
	author: z.string(),
	date: z.number(),
	refs: z.string()
});
const fileLogRequestSchema = dirRequestSchema.extend({
	path: z.string().min(1),
	limit: z.number().int().min(1).max(200).optional()
});
const fileLogResultSchema = resultSchema(z.object({ commits: z.array(commitInfoSchema) }));
const compareRequestSchema = dirRequestSchema.extend({
	from: z.string().min(1),
	to: z.string().min(1)
});
/** git config scope: system → global → local (later levels override). */
const configScopeSchema = z.enum([
	"system",
	"global",
	"local"
]);
const configListRequestSchema = dirRequestSchema.extend({ scope: configScopeSchema });
const configListResultSchema = resultSchema(z.object({
	entries: z.array(z.object({
		key: z.string(),
		value: z.string()
	})),
	/** Real config-file path per scope (for display). */
	configFiles: z.object({
		system: z.string(),
		global: z.string(),
		local: z.string()
	})
}));
const configSetRequestSchema = dirRequestSchema.extend({
	scope: configScopeSchema,
	key: z.string().min(1),
	value: z.string()
});
const configSetResultSchema = resultSchema(z.object({
	key: z.string(),
	value: z.string()
}));
dirRequestSchema.extend({
	scope: configScopeSchema,
	key: z.string().min(1)
});
resultSchema(z.object({ key: z.string() }));
const pullRemoteBranchRequestSchema = dirRequestSchema.extend({ 
/** Full remote ref name, e.g. "remotes/origin/main". */
remoteRef: z.string().min(1) });
const pullRemoteBranchResultSchema = resultSchema(z.object({
	/** Local branch that ended up checked out. */
	branch: z.string(),
	pulled: z.boolean()
}));
const compareResultSchema = resultSchema(z.object({ files: z.array(z.object({
	path: z.string(),
	status: z.string(),
	additions: z.union([z.number(), z.null()]),
	deletions: z.union([z.number(), z.null()])
})) }));
const changelistEntrySchema = z.object({
	name: z.string().min(1),
	paths: z.array(z.string())
});
const changelistListRequestSchema = dirRequestSchema;
const changelistListResultSchema = resultSchema(z.object({
	changelists: z.array(changelistEntrySchema),
	active: z.string()
}));
const changelistCreateRequestSchema = dirRequestSchema.extend({ name: z.string().min(1).max(64) });
const changelistCreateResultSchema = resultSchema(z.object({ name: z.string() }));
const changelistRenameRequestSchema = dirRequestSchema.extend({
	oldName: z.string().min(1).max(64),
	newName: z.string().min(1).max(64)
});
const changelistRenameResultSchema = resultSchema(z.object({ name: z.string() }));
const changelistDeleteRequestSchema = dirRequestSchema.extend({ name: z.string().min(1).max(64) });
const changelistDeleteResultSchema = resultSchema(z.object({ name: z.string() }));
const changelistMoveRequestSchema = dirRequestSchema.extend({
	paths: z.array(z.string().min(1)).min(1),
	to: z.string().min(1).max(64)
});
const changelistMoveResultSchema = resultSchema(z.object({ moved: z.number() }));
const changelistSetActiveRequestSchema = dirRequestSchema.extend({ name: z.string().min(1).max(64) });
const changelistSetActiveResultSchema = resultSchema(z.object({ active: z.string() }));
const ignoreAddRequestSchema = dirRequestSchema.extend({
	path: z.string().min(1),
	target: z.union([z.literal("gitignore"), z.literal("exclude")])
});
const ignoreAddResultSchema = resultSchema(z.object({
	path: z.string(),
	target: z.string()
}));
const pushPreviewRequestSchema = dirRequestSchema.extend({
	remote: z.string().min(1),
	branch: z.string().min(1)
});
const pushPreviewResultSchema = resultSchema(z.object({
	upstream: z.union([z.string(), z.null()]),
	ahead: z.array(commitInfoSchema)
}));
const rebaseListRequestSchema = dirRequestSchema.extend({ 
/** Explicit rebase base (e.g. "rebase X onto <base>"); auto-detected when omitted. */
base: z.string().optional() });
const rebaseListResultSchema = resultSchema(z.object({
	base: z.string(),
	commits: z.array(commitInfoSchema)
}));
const rebaseActionSchema = z.union([
	z.literal("pick"),
	z.literal("reword"),
	z.literal("squash"),
	z.literal("fixup"),
	z.literal("drop")
]);
const rebaseStartRequestSchema = dirRequestSchema.extend({
	base: z.string().min(1),
	items: z.array(z.object({
		action: rebaseActionSchema,
		hash: z.string().min(1),
		message: z.string().optional()
	})).min(1)
});
const rebaseStartResultSchema = resultSchema(z.object({
	started: z.boolean(),
	conflicts: z.array(z.string()).optional(),
	message: z.string().optional()
}));
const diffWithWorktreeRequestSchema = dirRequestSchema.extend({
	hash: z.string().min(1),
	/** Restrict the diff to one path. */
	path: z.string().optional()
});
const diffWithWorktreeResultSchema = resultSchema(z.object({ files: z.array(diffFileSchema) }));
//#endregion
//#region src/descriptors.ts
/**
* Invocation descriptors for the `git` Remote — one source of truth consumed
* by both the host TYPERT manifest (typert.ts) and the client contribution
* (remote.ts), mirroring the shape the repo's typert generator emits.
*/
const PACKAGE = "dsh-git-ui";
const NS = "git";
function def(method, requestSchema, requestType, resultSchema, resultType) {
	return {
		id: `${PACKAGE}#${NS}/${method}`,
		service: NS,
		namespace: NS,
		method,
		invocation: { kind: "direct" },
		parameters: [{
			name: "request",
			wire: "request",
			source: "json",
			codec: {
				mode: "strict",
				typeSymbol: `${PACKAGE}/types#${requestType}`,
				schema: requestSchema
			}
		}],
		result: {
			mode: "strict",
			typeSymbol: `${PACKAGE}/types#${resultType}`,
			schema: resultSchema
		},
		sourceLocation: {
			file: "src/index.ts",
			line: 1,
			column: 1
		}
	};
}
const DESCRIPTORS = [
	def("status", statusRequestSchema, "GitStatusRequest", statusResultSchema, "GitStatusResult"),
	def("diff", diffRequestSchema, "GitDiffRequest", diffResultSchema, "GitDiffResult"),
	def("stageHunks", stageHunksRequestSchema, "GitStageHunksRequest", stageHunksResultSchema, "GitStageHunksResult"),
	def("revertHunks", revertHunksRequestSchema, "GitRevertHunksRequest", revertHunksResultSchema, "GitRevertHunksResult"),
	def("stageChanges", stageChangesRequestSchema, "GitStageChangesRequest", stageChangesResultSchema, "GitStageChangesResult"),
	def("revertChanges", revertChangesRequestSchema, "GitRevertChangesRequest", revertChangesResultSchema, "GitRevertChangesResult"),
	def("stage", pathsRequestSchema, "GitPathsRequest", pathsResultSchema, "GitPathsResult"),
	def("unstage", pathsRequestSchema, "GitPathsRequest", pathsResultSchema, "GitPathsResult"),
	def("discard", pathsRequestSchema, "GitPathsRequest", pathsResultSchema, "GitPathsResult"),
	def("untrack", pathsRequestSchema, "GitPathsRequest", pathsResultSchema, "GitPathsResult"),
	def("getFromRevision", getFromRevisionRequestSchema, "GitGetFromRevisionRequest", getFromRevisionResultSchema, "GitGetFromRevisionResult"),
	def("commit", commitRequestSchema, "GitCommitRequest", commitResultSchema, "GitCommitResult"),
	def("branches", branchesRequestSchema, "GitBranchesRequest", branchesResultSchema, "GitBranchesResult"),
	def("branchRename", branchRenameRequestSchema, "GitBranchRenameRequest", branchRenameResultSchema, "GitBranchRenameResult"),
	def("branchDelete", branchDeleteRequestSchema, "GitBranchDeleteRequest", branchDeleteResultSchema, "GitBranchDeleteResult"),
	def("checkout", checkoutRequestSchema, "GitCheckoutRequest", checkoutResultSchema, "GitCheckoutResult"),
	def("merge", mergeRequestSchema, "GitMergeRequest", mergeResultSchema, "GitMergeResult"),
	def("conflictContent", conflictContentRequestSchema, "GitConflictContentRequest", conflictContentResultSchema, "GitConflictContentResult"),
	def("resolveFile", resolveFileRequestSchema, "GitResolveFileRequest", resolveFileResultSchema, "GitResolveFileResult"),
	def("repos", reposRequestSchema, "GitReposRequest", reposResultSchema, "GitReposResult"),
	def("findRepos", findReposRequestSchema, "GitFindReposRequest", findReposResultSchema, "GitFindReposResult"),
	def("init", initRequestSchema, "GitInitRequest", initResultSchema, "GitInitResult"),
	def("clone", cloneRequestSchema, "GitCloneRequest", cloneResultSchema, "GitCloneResult"),
	def("suggestGitignore", suggestGitignoreRequestSchema, "GitSuggestGitignoreRequest", suggestGitignoreResultSchema, "GitSuggestGitignoreResult"),
	def("commitDetail", commitDetailRequestSchema, "GitCommitDetailRequest", commitDetailResultSchema, "GitCommitDetailResult"),
	def("commitDiff", commitDiffRequestSchema, "GitCommitDiffRequest", commitDiffResultSchema, "GitCommitDiffResult"),
	def("suggestCommits", suggestCommitsRequestSchema, "GitSuggestCommitsRequest", suggestCommitsResultSchema, "GitSuggestCommitsResult"),
	def("executeCommits", executeCommitsRequestSchema, "GitExecuteCommitsRequest", executeCommitsResultSchema, "GitExecuteCommitsResult"),
	def("remotes", remotesRequestSchema, "GitRemotesRequest", remotesResultSchema, "GitRemotesResult"),
	def("remoteAdd", remoteAddRequestSchema, "GitRemoteAddRequest", remoteAddResultSchema, "GitRemoteAddResult"),
	def("remoteRemove", remoteRemoveRequestSchema, "GitRemoteRemoveRequest", remoteRemoveResultSchema, "GitRemoteRemoveResult"),
	def("push", pushRequestSchema, "GitPushRequest", pushResultSchema, "GitPushResult"),
	def("fetch", fetchRequestSchema, "GitFetchRequest", fetchResultSchema, "GitFetchResult"),
	def("pull", pullRequestSchema, "GitPullRequest", pullResultSchema, "GitPullResult"),
	def("stashList", stashListRequestSchema, "GitStashListRequest", stashListResultSchema, "GitStashListResult"),
	def("stashPush", stashPushRequestSchema, "GitStashPushRequest", stashPushResultSchema, "GitStashPushResult"),
	def("stashPop", stashPopRequestSchema, "GitStashPopRequest", stashPopResultSchema, "GitStashPopResult"),
	def("stashDrop", stashDropRequestSchema, "GitStashDropRequest", stashDropResultSchema, "GitStashDropResult"),
	def("cherryPick", cherryPickRequestSchema, "GitCherryPickRequest", cherryPickResultSchema, "GitCherryPickResult"),
	def("revert", revertRequestSchema, "GitRevertRequest", revertResultSchema, "GitRevertResult"),
	def("squashCommits", squashCommitsRequestSchema, "GitSquashCommitsRequest", squashCommitsResultSchema, "GitSquashCommitsResult"),
	def("reset", resetRequestSchema, "GitResetRequest", resetResultSchema, "GitResetResult"),
	def("operationAbort", operationAbortRequestSchema, "GitOperationAbortRequest", operationAbortResultSchema, "GitOperationAbortResult"),
	def("operationContinue", operationContinueRequestSchema, "GitOperationContinueRequest", operationContinueResultSchema, "GitOperationContinueResult"),
	def("operationSkip", operationSkipRequestSchema, "GitOperationSkipRequest", operationSkipResultSchema, "GitOperationSkipResult"),
	def("tags", tagsRequestSchema, "GitTagsRequest", tagsResultSchema, "GitTagsResult"),
	def("tagCreate", tagCreateRequestSchema, "GitTagCreateRequest", tagCreateResultSchema, "GitTagCreateResult"),
	def("tagDelete", tagDeleteRequestSchema, "GitTagDeleteRequest", tagDeleteResultSchema, "GitTagDeleteResult"),
	def("logGraph", logGraphRequestSchema, "GitLogGraphRequest", logGraphResultSchema, "GitLogGraphResult"),
	def("logAuthors", logAuthorsRequestSchema, "GitLogAuthorsRequest", logAuthorsResultSchema, "GitLogAuthorsResult"),
	def("fileLog", fileLogRequestSchema, "GitFileLogRequest", fileLogResultSchema, "GitFileLogResult"),
	def("compare", compareRequestSchema, "GitCompareRequest", compareResultSchema, "GitCompareResult"),
	def("configList", configListRequestSchema, "GitConfigListRequest", configListResultSchema, "GitConfigListResult"),
	def("configSet", configSetRequestSchema, "GitConfigSetRequest", configSetResultSchema, "GitConfigSetResult"),
	def("pullRemoteBranch", pullRemoteBranchRequestSchema, "GitPullRemoteBranchRequest", pullRemoteBranchResultSchema, "GitPullRemoteBranchResult"),
	def("changelistList", changelistListRequestSchema, "GitChangelistListRequest", changelistListResultSchema, "GitChangelistListResult"),
	def("changelistCreate", changelistCreateRequestSchema, "GitChangelistCreateRequest", changelistCreateResultSchema, "GitChangelistCreateResult"),
	def("changelistRename", changelistRenameRequestSchema, "GitChangelistRenameRequest", changelistRenameResultSchema, "GitChangelistRenameResult"),
	def("changelistDelete", changelistDeleteRequestSchema, "GitChangelistDeleteRequest", changelistDeleteResultSchema, "GitChangelistDeleteResult"),
	def("changelistMove", changelistMoveRequestSchema, "GitChangelistMoveRequest", changelistMoveResultSchema, "GitChangelistMoveResult"),
	def("changelistSetActive", changelistSetActiveRequestSchema, "GitChangelistSetActiveRequest", changelistSetActiveResultSchema, "GitChangelistSetActiveResult"),
	def("ignoreAdd", ignoreAddRequestSchema, "GitIgnoreAddRequest", ignoreAddResultSchema, "GitIgnoreAddResult"),
	def("pushPreview", pushPreviewRequestSchema, "GitPushPreviewRequest", pushPreviewResultSchema, "GitPushPreviewResult"),
	def("rebaseList", rebaseListRequestSchema, "GitRebaseListRequest", rebaseListResultSchema, "GitRebaseListResult"),
	def("rebaseStart", rebaseStartRequestSchema, "GitRebaseStartRequest", rebaseStartResultSchema, "GitRebaseStartResult"),
	def("diffWithWorktree", diffWithWorktreeRequestSchema, "GitDiffWithWorktreeRequest", diffWithWorktreeResultSchema, "GitDiffWithWorktreeResult"),
	def("listDir", listDirRequestSchema, "GitListDirRequest", listDirResultSchema, "GitListDirResult"),
	def("readFile", readFileRequestSchema, "GitReadFileRequest", readFileResultSchema, "GitReadFileResult"),
	def("binaryContent", binaryContentRequestSchema, "GitBinaryContentRequest", binaryContentResultSchema, "GitBinaryContentResult"),
	def("writeFile", writeFileRequestSchema, "GitWriteFileRequest", writeFileResultSchema, "GitWriteFileResult"),
	def("deleteFile", deleteFileRequestSchema, "GitDeleteFileRequest", deleteFileResultSchema, "GitDeleteFileResult")
];
//#endregion
export { gitErrorSchema as n, DESCRIPTORS as t };
