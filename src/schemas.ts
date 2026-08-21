/**
 * Zod schemas for the git Remote wire contract. Bundled into both faces:
 * the host typert manifest validates incoming args and outgoing results, and
 * the client contribution validates the same envelope on the browser side.
 */
import { z } from "zod";

export const gitErrorSchema = z.object({
  code: z.string(),
  message: z.string()
});

export function okSchema<T extends z.ZodType>(value: T) {
  return z.object({ ok: z.literal(true), value });
}

export function resultSchema<T extends z.ZodType>(value: T) {
  return z.union([
    okSchema(value),
    z.object({ ok: z.literal(false), error: gitErrorSchema })
  ]);
}

export const dirRequestSchema = z.object({
  dir: z.string().min(1)
});

// ── status ──────────────────────────────────────────────────────────────────

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

export const statusRequestSchema = dirRequestSchema;
export const statusResultSchema = resultSchema(repoStatusSchema);

// ── diff ────────────────────────────────────────────────────────────────────

const diffLineSchema = z.object({
  type: z.union([z.literal("ctx"), z.literal("add"), z.literal("del")]),
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

export const diffRequestSchema = dirRequestSchema.extend({
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

export const diffResultSchema = resultSchema(
  z.object({ files: z.array(diffFileSchema) })
);

// ── hunk-level operations (partial stage / revert) ─────────────────────────

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

export const stageHunksRequestSchema = hunkPatchRequestSchema;

export const stageHunksResultSchema = resultSchema(
  z.object({ applied: z.number() })
);

export const revertHunksRequestSchema = hunkPatchRequestSchema;

export const revertHunksResultSchema = resultSchema(
  z.object({ reverted: z.number() })
);

// ── change-level operations (IDEA change unit: one visual block) ────────

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

export const stageChangesRequestSchema = changePatchRequestSchema;
export const stageChangesResultSchema = resultSchema(
  z.object({ applied: z.number() })
);
export const revertChangesRequestSchema = changePatchRequestSchema;
export const revertChangesResultSchema = resultSchema(
  z.object({ reverted: z.number() })
);

// ── file tree (git-independent) ─────────────────────────────────────────────

const dirEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.union([z.literal("dir"), z.literal("file")])
});

export const listDirRequestSchema = dirRequestSchema.extend({
  /** Subdirectory path relative to dir; omitted = list dir itself. */
  path: z.string().optional()
});

export const listDirResultSchema = resultSchema(
  z.object({ entries: z.array(dirEntrySchema) })
);

export const readFileRequestSchema = dirRequestSchema.extend({
  /** File path relative to dir. */
  path: z.string().min(1)
});

export const binaryContentRequestSchema = dirRequestSchema.extend({
  /** File path relative to dir. */
  path: z.string().min(1),
  /** Git revision to read from ("HEAD", a hash, ...); omitted = working tree. */
  ref: z.string().optional()
});

export const binaryContentResultSchema = resultSchema(
  z.object({ mime: z.string(), base64: z.string() })
);

export const readFileResultSchema = resultSchema(
  z.object({
    content: z.string(),
    truncated: z.boolean(),
    binary: z.boolean()
  })
);

export const writeFileRequestSchema = dirRequestSchema.extend({
  path: z.string().min(1),
  content: z.string()
});

export const writeFileResultSchema = resultSchema(
  z.object({ path: z.string() })
);

export const deleteFileRequestSchema = dirRequestSchema.extend({
  path: z.string().min(1),
  /** Recursively delete a directory tree. */
  recursive: z.boolean().optional()
});

export const deleteFileResultSchema = resultSchema(
  z.object({ path: z.string() })
);

// ── stage / unstage / discard ───────────────────────────────────────────────

export const pathsRequestSchema = dirRequestSchema.extend({
  paths: z.array(z.string().min(1)).min(1),
  /** True when the discard must also clear the index (staged files). */
  staged: z.boolean().optional()
});

export const pathsResultSchema = resultSchema(
  z.object({ paths: z.array(z.string()) })
);

// ── commit ──────────────────────────────────────────────────────────────────

export const commitRequestSchema = dirRequestSchema.extend({
  message: z.string().min(1),
  amend: z.boolean().optional(),
  paths: z.array(z.string().min(1)).optional(),
  /** Hunk-level commit: only these hunks of these files enter the commit.
   *  The files must have no staged changes (the index is rebuilt exactly). */
  partial: z
    .array(
      z.object({
        path: z.string().min(1),
        hunks: z.array(z.number().int().min(0)).min(1),
        wsFlags: z.object({
    trimEol: z.boolean().optional(),
    ignoreWs: z.boolean().optional(),
    ignoreBlank: z.boolean().optional()
  }).optional()
      })
    )
    .optional()
});

export const commitResultSchema = resultSchema(
  z.object({
    hash: z.string(),
    short: z.string(),
    amended: z.boolean()
  })
);

// ── branches ────────────────────────────────────────────────────────────────

export const branchesRequestSchema = dirRequestSchema;

const branchInfoSchema = z.object({
  name: z.string(),
  current: z.boolean(),
  upstream: z.string().optional()
});

export const branchesResultSchema = resultSchema(
  z.object({
    current: z.union([z.string(), z.null()]),
    branches: z.array(branchInfoSchema),
    remotes: z.array(z.string())
  })
);

// ── branch management ───────────────────────────────────────────────────────

export const branchRenameRequestSchema = dirRequestSchema.extend({
  oldName: z.string().min(1),
  newName: z.string().min(1)
});

export const branchRenameResultSchema = resultSchema(
  z.object({ oldName: z.string(), newName: z.string() })
);

export const branchDeleteRequestSchema = dirRequestSchema.extend({
  name: z.string().min(1),
  force: z.boolean().optional()
});

export const branchDeleteResultSchema = resultSchema(
  z.object({ name: z.string() })
);

// ── checkout ────────────────────────────────────────────────────────────────

export const checkoutRequestSchema = dirRequestSchema.extend({
  branch: z.string().min(1),
  create: z.boolean().optional(),
  /** Ref to create the branch from (git checkout -b <branch> <startPoint>). */
  startPoint: z.string().optional()
});

export const checkoutResultSchema = resultSchema(
  z.object({ branch: z.string() })
);

// ── merge ───────────────────────────────────────────────────────────────────

export const mergeRequestSchema = dirRequestSchema.extend({
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

export const mergeResultSchema = resultSchema(
  z.object({
    merged: z.boolean(),
    kind: mergeKindSchema,
    hash: z.string().optional(),
    conflicts: z.array(z.string()).optional(),
    message: z.string().optional()
  })
);

// ── conflict contents / resolve ─────────────────────────────────────────────

export const conflictContentRequestSchema = dirRequestSchema.extend({
  path: z.string().min(1)
});

const conflictBlockSchema = z.object({
  oursStart: z.number(),
  oursEnd: z.number(),
  theirsStart: z.number(),
  theirsEnd: z.number(),
  resultStart: z.number(),
  resultEnd: z.number()
});

export const conflictContentResultSchema = resultSchema(
  z.object({
    ours: z.string(),
    theirs: z.string(),
    result: z.string(),
    markers: z.number(),
    blocks: z.array(conflictBlockSchema)
  })
);

export const resolveFileRequestSchema = dirRequestSchema.extend({
  path: z.string().min(1),
  content: z.string()
});

export const resolveFileResultSchema = resultSchema(
  z.object({ path: z.string() })
);

// ── repo discovery ──────────────────────────────────────────────────────────

export const reposRequestSchema = z.object({
  dirs: z.array(z.string().min(1)).min(1)
});

export const reposResultSchema = resultSchema(
  z.object({
    repos: z.array(
      z.object({
        input: z.string(),
        root: z.union([z.string(), z.null()])
      })
    )
  })
);

// ── git init ─────────────────────────────────────────────────────────────────

export const initRequestSchema = dirRequestSchema;

export const initResultSchema = resultSchema(
  z.object({ root: z.string() })
);

// ── clone ────────────────────────────────────────────────────────────────────

export const cloneRequestSchema = z.object({
  /** Remote repository URL (https, ssh, git, file…). */
  url: z.string().min(1),
  /** Target directory — git clone semantics: created when missing, must be
   *  empty when it already exists. */
  target: z.string().min(1)
});

export const cloneResultSchema = resultSchema(
  z.object({ root: z.string() })
);

// ── AI .gitignore (DSH LLM powered) ─────────────────────────────────────────

export const suggestGitignoreRequestSchema = dirRequestSchema;

export const suggestGitignoreResultSchema = resultSchema(
  z.object({ path: z.string(), changed: z.boolean() })
);

// ── AI one-click commit (LLM-planned commit groups) ──────────────────────────

export const commitGroupSchema = z.object({
  message: z.string().min(1),
  files: z.array(z.string().min(1)).min(1)
});

export const suggestCommitsRequestSchema = dirRequestSchema;

export const suggestCommitsResultSchema = resultSchema(
  z.object({
    groups: z.array(commitGroupSchema),
    totalFiles: z.number()
  })
);

export const executeCommitsRequestSchema = dirRequestSchema.extend({
  groups: z.array(commitGroupSchema).min(1)
});

export const executeCommitsResultSchema = resultSchema(
  z.object({
    commits: z.array(
      z.object({ message: z.string(), hash: z.string(), short: z.string() })
    )
  })
);

// ── commit detail / commit diff (IDEA Log details panel) ────────────────────

export const commitDetailRequestSchema = dirRequestSchema.extend({
  hash: z.string().min(1)
});

const commitFileSchema = z.object({
  path: z.string(),
  status: z.string(),
  additions: z.union([z.number(), z.null()]),
  deletions: z.union([z.number(), z.null()])
});

export const commitDetailResultSchema = resultSchema(
  z.object({
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
  })
);

export const commitDiffRequestSchema = dirRequestSchema.extend({
  hash: z.string().min(1),
  path: z.string().optional()
});

export const commitDiffResultSchema = resultSchema(
  z.object({ files: z.array(diffFileSchema) })
);

// ── remotes / push ────────────────────────────────────────────────────────────

const remoteInfoSchema = z.object({
  name: z.string(),
  url: z.string(),
  pushUrl: z.string().optional()
});

export const remotesRequestSchema = dirRequestSchema;

export const remotesResultSchema = resultSchema(
  z.object({ remotes: z.array(remoteInfoSchema) })
);

export const remoteAddRequestSchema = dirRequestSchema.extend({
  name: z.string().min(1),
  url: z.string().min(1)
});

export const remoteAddResultSchema = resultSchema(
  z.object({ name: z.string(), url: z.string() })
);

export const remoteRemoveRequestSchema = dirRequestSchema.extend({
  name: z.string().min(1)
});

export const remoteRemoveResultSchema = resultSchema(
  z.object({ name: z.string() })
);

export const pushRequestSchema = dirRequestSchema.extend({
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

export const pushResultSchema = resultSchema(
  z.object({
    pushed: z.boolean(),
    message: z.string().optional()
  })
);

// ── fetch / pull ─────────────────────────────────────────────────────────────

export const fetchRequestSchema = dirRequestSchema.extend({
  remote: z.string().optional()
});

export const fetchResultSchema = resultSchema(
  z.object({ fetched: z.boolean(), message: z.string().optional() })
);

export const pullRequestSchema = dirRequestSchema.extend({
  remote: z.string().min(1),
  branch: z.string().min(1),
  strategy: z.union([z.literal("merge"), z.literal("rebase")]).optional()
});

export const pullResultSchema = resultSchema(
  z.object({
    pulled: z.boolean(),
    kind: mergeKindSchema,
    hash: z.string().optional(),
    conflicts: z.array(z.string()).optional(),
    message: z.string().optional()
  })
);

// ── stash ────────────────────────────────────────────────────────────────────

export const stashListRequestSchema = dirRequestSchema;

export const stashListResultSchema = resultSchema(
  z.object({
    stashes: z.array(
      z.object({ index: z.number(), message: z.string(), date: z.string() })
    )
  })
);

export const stashPushRequestSchema = dirRequestSchema.extend({
  message: z.string().optional(),
  includeUntracked: z.boolean().optional()
});

export const stashPushResultSchema = resultSchema(
  z.object({ stashed: z.boolean(), message: z.string().optional() })
);

export const stashPopRequestSchema = dirRequestSchema.extend({
  index: z.number().int().min(0).optional()
});

export const stashPopResultSchema = resultSchema(
  z.object({
    popped: z.boolean(),
    conflicts: z.array(z.string()).optional(),
    message: z.string().optional()
  })
);

export const stashDropRequestSchema = dirRequestSchema.extend({
  index: z.number().int().min(0).optional()
});

export const stashDropResultSchema = resultSchema(
  z.object({ dropped: z.boolean() })
);


export const stashApplyRequestSchema = dirRequestSchema.extend({
  index: z.number().int().min(0).optional()
});

export const stashApplyResultSchema = resultSchema(
  z.object({
    applied: z.boolean(),
    conflicts: z.array(z.string()).optional(),
    message: z.string().optional()
  })
);

export const stashClearRequestSchema = dirRequestSchema;

export const stashClearResultSchema = resultSchema(
  z.object({ cleared: z.boolean() })
);

export const stashShowRequestSchema = dirRequestSchema.extend({
  index: z.number().int().min(0)
});

export const stashShowResultSchema = resultSchema(
  z.object({ lines: z.array(z.string()) })
);

export const stashBranchRequestSchema = dirRequestSchema.extend({
  index: z.number().int().min(0),
  name: z.string().min(1)
});

export const stashBranchResultSchema = resultSchema(
  z.object({ branch: z.string() })
);

// ── cherry-pick / revert / reset ─────────────────────────────────────────────

export const cherryPickRequestSchema = dirRequestSchema.extend({
  hash: z.string().min(1)
});

export const cherryPickResultSchema = resultSchema(
  z.object({
    picked: z.boolean(),
    conflicts: z.array(z.string()).optional(),
    message: z.string().optional()
  })
);

export const revertRequestSchema = dirRequestSchema.extend({
  hash: z.string().min(1)
});

export const revertResultSchema = resultSchema(
  z.object({
    reverted: z.boolean(),
    conflicts: z.array(z.string()).optional(),
    message: z.string().optional()
  })
);

export const resetRequestSchema = dirRequestSchema.extend({
  mode: z.union([z.literal("soft"), z.literal("mixed"), z.literal("hard")]),
  ref: z.string().optional()
});

export const resetResultSchema = resultSchema(
  z.object({ reset: z.boolean(), mode: z.string() })
);

export const operationAbortRequestSchema = dirRequestSchema;

export const operationAbortResultSchema = resultSchema(
  z.object({ aborted: z.boolean() })
);

export const operationContinueRequestSchema = dirRequestSchema.extend({
  message: z.string().optional()
});

export const operationContinueResultSchema = resultSchema(
  z.object({ continued: z.boolean(), hash: z.string().optional() })
);

export const operationSkipRequestSchema = dirRequestSchema;

export const operationSkipResultSchema = resultSchema(
  z.object({
    skipped: z.boolean(),
    conflicts: z.array(z.string()).optional()
  })
);

// ── tags ─────────────────────────────────────────────────────────────────────

export const tagsRequestSchema = dirRequestSchema;

export const tagsResultSchema = resultSchema(
  z.object({
    tags: z.array(
      z.object({
        name: z.string(),
        hash: z.string(),
        short: z.string(),
        subject: z.string().optional()
      })
    )
  })
);

export const tagCreateRequestSchema = dirRequestSchema.extend({
  name: z.string().min(1),
  hash: z.string().optional()
});

export const tagCreateResultSchema = resultSchema(
  z.object({ name: z.string() })
);

export const tagDeleteRequestSchema = dirRequestSchema.extend({
  name: z.string().min(1)
});

export const tagDeleteResultSchema = resultSchema(
  z.object({ name: z.string() })
);

// ── log graph / file history / compare ───────────────────────────────────────

const graphCharSchema = z.object({
  ch: z.string(),
  color: z.string().optional()
});

export const logGraphRequestSchema = dirRequestSchema.extend({
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

export const logGraphResultSchema = resultSchema(
  z.object({
    rows: z.array(
      z.object({
        graph: z.array(graphCharSchema),
        hash: z.string(),
        short: z.string(),
        subject: z.string(),
        refs: z.string(),
        author: z.string(),
        date: z.number()
      })
    )
  })
);

// ── log authors (for the author filter dropdown) ─────────────────────────────

export const logAuthorsRequestSchema = dirRequestSchema.extend({
  /** Restrict to commits reachable from this ref (matches the branch filter). */
  branch: z.string().optional()
});

export const logAuthorsResultSchema = resultSchema(
  z.object({
    authors: z.array(
      z.object({
        name: z.string(),
        email: z.string(),
        count: z.number()
      })
    )
  })
);

const commitInfoSchema = z.object({
  hash: z.string(),
  short: z.string(),
  subject: z.string(),
  author: z.string(),
  date: z.number(),
  refs: z.string()
});

export const fileLogRequestSchema = dirRequestSchema.extend({
  path: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional()
});

export const fileLogResultSchema = resultSchema(
  z.object({ commits: z.array(commitInfoSchema) })
);

export const compareRequestSchema = dirRequestSchema.extend({
  from: z.string().min(1),
  to: z.string().min(1)
});
// ── config ─────────────────────────────────────────────────────────────────

/** git config scope: system → global → local (later levels override). */
export const configScopeSchema = z.enum(["system", "global", "local"]);

export const configListRequestSchema = dirRequestSchema.extend({
  scope: configScopeSchema
});

export const configListResultSchema = resultSchema(
  z.object({
    entries: z.array(
      z.object({
        key: z.string(),
        value: z.string()
      })
    ),
    /** Real config-file path per scope (for display). */
    configFiles: z.object({
      system: z.string(),
      global: z.string(),
      local: z.string()
    })
  })
);

export const configSetRequestSchema = dirRequestSchema.extend({
  scope: configScopeSchema,
  key: z.string().min(1),
  value: z.string()
});

export const configSetResultSchema = resultSchema(
  z.object({ key: z.string(), value: z.string() })
);

export const configUnsetRequestSchema = dirRequestSchema.extend({
  scope: configScopeSchema,
  key: z.string().min(1)
});

export const configUnsetResultSchema = resultSchema(
  z.object({ key: z.string() })
);

// ── remote branch pull ────────────────────────────────────────────────────

export const pullRemoteBranchRequestSchema = dirRequestSchema.extend({
  /** Full remote ref name, e.g. "remotes/origin/main". */
  remoteRef: z.string().min(1)
});

export const pullRemoteBranchResultSchema = resultSchema(
  z.object({
    /** Local branch that ended up checked out. */
    branch: z.string(),
    pulled: z.boolean()
  })
);


export const compareResultSchema = resultSchema(
  z.object({
    files: z.array(
      z.object({
        path: z.string(),
        status: z.string(),
        additions: z.union([z.number(), z.null()]),
        deletions: z.union([z.number(), z.null()])
      })
    )
  })
);

// ── changelists ──────────────────────────────────────────────────────────────

const changelistEntrySchema = z.object({
  name: z.string().min(1),
  paths: z.array(z.string())
});

export const changelistListRequestSchema = dirRequestSchema;

export const changelistListResultSchema = resultSchema(
  z.object({
    changelists: z.array(changelistEntrySchema),
    active: z.string()
  })
);

export const changelistCreateRequestSchema = dirRequestSchema.extend({
  name: z.string().min(1).max(64)
});

export const changelistCreateResultSchema = resultSchema(
  z.object({ name: z.string() })
);

export const changelistRenameRequestSchema = dirRequestSchema.extend({
  oldName: z.string().min(1).max(64),
  newName: z.string().min(1).max(64)
});

export const changelistRenameResultSchema = resultSchema(
  z.object({ name: z.string() })
);

export const changelistDeleteRequestSchema = dirRequestSchema.extend({
  name: z.string().min(1).max(64)
});

export const changelistDeleteResultSchema = resultSchema(
  z.object({ name: z.string() })
);

export const changelistMoveRequestSchema = dirRequestSchema.extend({
  paths: z.array(z.string().min(1)).min(1),
  to: z.string().min(1).max(64)
});

export const changelistMoveResultSchema = resultSchema(
  z.object({ moved: z.number() })
);

export const changelistSetActiveRequestSchema = dirRequestSchema.extend({
  name: z.string().min(1).max(64)
});

export const changelistSetActiveResultSchema = resultSchema(
  z.object({ active: z.string() })
);

// ── ignore ───────────────────────────────────────────────────────────────────

export const ignoreAddRequestSchema = dirRequestSchema.extend({
  path: z.string().min(1),
  target: z.union([z.literal("gitignore"), z.literal("exclude")])
});

export const ignoreAddResultSchema = resultSchema(
  z.object({ path: z.string(), target: z.string() })
);

// ── push preview ─────────────────────────────────────────────────────────────

export const pushPreviewRequestSchema = dirRequestSchema.extend({
  remote: z.string().min(1),
  branch: z.string().min(1)
});

export const pushPreviewResultSchema = resultSchema(
  z.object({
    upstream: z.union([z.string(), z.null()]),
    ahead: z.array(commitInfoSchema)
  })
);

// ── interactive rebase ───────────────────────────────────────────────────────

export const rebaseListRequestSchema = dirRequestSchema;

export const rebaseListResultSchema = resultSchema(
  z.object({
    base: z.string(),
    commits: z.array(commitInfoSchema)
  })
);

const rebaseActionSchema = z.union([
  z.literal("pick"),
  z.literal("reword"),
  z.literal("squash"),
  z.literal("fixup"),
  z.literal("drop")
]);

export const rebaseStartRequestSchema = dirRequestSchema.extend({
  base: z.string().min(1),
  items: z
    .array(
      z.object({
        action: rebaseActionSchema,
        hash: z.string().min(1),
        message: z.string().optional()
      })
    )
    .min(1)
});

export const rebaseStartResultSchema = resultSchema(
  z.object({
    started: z.boolean(),
    conflicts: z.array(z.string()).optional(),
    message: z.string().optional()
  })
);

// ── diff with working tree ───────────────────────────────────────────────────

export const diffWithWorktreeRequestSchema = dirRequestSchema.extend({
  hash: z.string().min(1),
  /** Restrict the diff to one path. */
  path: z.string().optional()
});

export const diffWithWorktreeResultSchema = resultSchema(
  z.object({ files: z.array(diffFileSchema) })
);


