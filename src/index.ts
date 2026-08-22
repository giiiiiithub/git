/**
 * dsh-git-ui host half: a Typert Remote service named `git` that shells out to
 * the system git executable. The wire contract (strict zod codecs) is declared
 * by the ./typert artifact, so this class needs no decorators — the gateway
 * dispatches `git/<method>` onto the live service by method name.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, type Dirent } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { GitCli } from "./git.js";
import { parseUnifiedDiff } from "./diff.js";
import type {
  BranchInfo,
  ChangeFile,
  ChangePatchRequest,
  ChangeRef,
  ChangelistEntry,
  CommitGroup,
  CommitInfo,
  CompareFile,
  ConflictView,
  DiffFile,
  ExecutedCommit,
  GitError,
  GitResult,
  GraphChar,
  GraphRow,
  HunkPatchRequest,
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
  WsFlags,
  DirEntry,
  FileContent,} from "./types.js";
import { wsFlagsActive } from "./types.js";

/**
 * Map IDEA-style whitespace flags to git diff options (must follow the
 * "diff" verb). Hunk boundaries depend on this, so hunk-indexed operations
 * must use the same flags as the displayed diff.
 */
function wsModeArgs(flags: WsFlags | undefined): string[] {
  if (flags === undefined) return [];
  const args: string[] = [];
  if (flags.trimEol === true) args.push("--ignore-space-at-eol", "--ignore-cr-at-eol");
  if (flags.ignoreWs === true) args.push("-w");
  if (flags.ignoreBlank === true) args.push("--ignore-blank-lines");
  return args;
}

/** Guess a MIME type from the file extension (binary previews). */
function mimeForPath(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".svg": return "image/svg+xml";
    case ".bmp": return "image/bmp";
    case ".ico": return "image/x-icon";
    default: return "application/octet-stream";
  }
}

export interface GitServiceConfig {
  /** git executable path; defaults to "git" on PATH. */
  gitPath?: string;
}

/** Map a git exit code + stderr onto a business error. */
function fail(code: string, message: string): GitError {
  return { code, message };
}

/** Append a single-line excerpt of git's stderr to a user-facing message. */
function withGitDetail(message: string, stderr: string): string {
  const detail = stderr
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  return detail === "" ? message : message + "：" + detail.slice(0, 240);
}

// ── ANSI / colored-graph helpers ─────────────────────────────────────────────

const ANSI_RE = /\x1b\[([0-9;]*)m/g;

/** Strip every SGR escape sequence from a text. */
function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** Map a git SGR parameter string (e.g. "1;31", "32") to a CSS color. */
function sgrToColor(params: string): string | null {
  const parts = params.split(";").filter((p) => p !== "");
  if (parts.length === 0) return null;
  const bold = parts.includes("1");
  let code: string | null = null;
  for (const part of parts) {
    if (part === "0" || part === "22" || part === "39") return null;
    if (part === "31" || part === "91") { code = bold || part === "91" ? "#ff7b72" : "#e06c75"; break; }
    if (part === "32" || part === "92") { code = bold || part === "92" ? "#7ee787" : "#98c379"; break; }
    if (part === "33" || part === "93") { code = bold || part === "93" ? "#e5c07b" : "#d19a66"; break; }
    if (part === "34" || part === "94") { code = bold || part === "94" ? "#79c0ff" : "#61afef"; break; }
    if (part === "35" || part === "95") { code = bold || part === "95" ? "#d2a8ff" : "#c678dd"; break; }
    if (part === "36" || part === "96") { code = bold || part === "96" ? "#76e3ea" : "#56b6c2"; break; }
    if (part === "37" || part === "97") { code = bold || part === "97" ? "#ffffff" : "#abb2bf"; break; }
    if (part === "30" || part === "90") { code = bold || part === "90" ? "#bbbbbb" : "#6a737d"; break; }
  }
  return code;
}

/**
 * Split one `git log --graph --color=always` line into its colored graph
 * prefix (before the %x1e marker) and the plain formatted commit text.
 */
function parseGraphLine(line: string): { graph: GraphChar[]; rest: string } {
  const sepIndex = line.indexOf("\x1e");
  const graphPart = sepIndex === -1 ? line : line.slice(0, sepIndex);
  const rest = sepIndex === -1 ? "" : line.slice(sepIndex + 1);
  const graph: GraphChar[] = [];
  let color: string | null = null;
  let last = 0;
  let match: RegExpExecArray | null;
  ANSI_RE.lastIndex = 0;
  while ((match = ANSI_RE.exec(graphPart)) !== null) {
    for (let i = last; i < match.index; i++) {
      graph.push({ ch: graphPart[i] ?? "", ...(color !== null ? { color } : {}) });
    }
    const next = sgrToColor(match[1] ?? "");
    if (next !== null) color = next;
    else if (match[1] === "0") color = null;
    last = match.index + match[0].length;
  }
  for (let i = last; i < graphPart.length; i++) {
    graph.push({ ch: graphPart[i] ?? "", ...(color !== null ? { color } : {}) });
  }
  return { graph, rest: stripAnsi(rest) };
}

// ── rebase editor scripts (written into <gitdir>/dsh at rebaseStart) ────────

/**
 * GIT_SEQUENCE_EDITOR helper: replaces git's generated todo file with the
 * planned todo. Resolves its own location so it needs no arguments besides
 * the todo file path git appends.
 */
const SEQ_EDITOR_MJS = `import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(here, "todo-plan.json"), "utf8"));
writeFileSync(process.argv[2], (plan.todo ?? []).join("\\n") + "\\n");
`;

/**
 * core.editor helper: pops one message from the queue per invocation (reword /
 * squash with a custom message). Leaves the file untouched when the queue is
 * empty (git's default combined message).
 */
const MSG_EDITOR_MJS = `import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const qf = join(here, "msg-queue.json");
if (existsSync(qf)) {
  const q = JSON.parse(readFileSync(qf, "utf8"));
  if (Array.isArray(q) && q.length > 0) {
    const msg = q.shift();
    writeFileSync(process.argv[2], msg + "\\n");
    writeFileSync(qf, JSON.stringify(q));
  }
}
`;

const STATUS_MAP: Record<string, ChangeFile["status"]> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
  C: "copied",
  T: "typechange",
  U: "unmerged"
};

/** Default .gitignore written by the one-click action (Node/general project). */
const DEFAULT_GITIGNORE = `# Dependencies
node_modules/

# Build output
dist/
build/
out/
coverage/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Environment / secrets
.env
.env.*
!.env.example

# Editor / OS
.vscode/*
!.vscode/extensions.json
.idea/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
.DS_Store
Thumbs.db

# Runtime / misc
.tmp/
tmp/
*.pid
`;

export default class GitService extends TypertRemoteService {
  /** Agent delegation needs the agent registry and the subagent seam. */
  static inject = ["llm", "agentDefaultModel", "agents", "subagents"];

  private readonly cli: GitCli;

  constructor(ctx: Context, config: GitServiceConfig = {}) {
    super(ctx, "git");
    this.cli = new GitCli(config.gitPath);
  }

  // ── repo discovery ────────────────────────────────────────────────────────

  /** Probe each input directory (walking up to the drive root) for a git root. */
  async repos(request: { dirs: string[] }): Promise<GitResult<{ repos: RepoProbe[] }>> {
    const repos: RepoProbe[] = [];
    for (const input of request.dirs) {
      let cursor = resolve(input);
      let root: string | null = null;
      for (let depth = 0; depth < 64; depth++) {
        const gitDir = join(cursor, ".git");
        if (existsSync(gitDir)) {
          root = cursor;
          break;
        }
        const parent = dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
      }
      if (root === null) {
        // Fall back to git itself (worktrees, .git files, unusual layouts).
        const probe = await this.cli.run(["rev-parse", "--show-toplevel"], { cwd: resolve(input) });
        if (probe.code === 0) root = probe.stdout.trim();
      }
      repos.push({ input, root });
    }
    return { ok: true, value: { repos } };
  }

  /**
   * Scan the subdirectories of `dir` (at most `maxDepth` levels, default 3)
   * for git repositories and return their roots. `dir` itself is never
   * reported — the caller probes whether it is a repo root via `repos`. A
   * found repo is not descended into (submodules / nested repos stay hidden),
   * and noisy entries (node_modules, dot-dirs, symlinks) are skipped so the
   * scan stays fast even when `dir` is a large directory.
   */
  async findRepos(request: { dir: string; maxDepth?: number }): Promise<GitResult<{ repos: string[] }>> {
    const root = resolve(request.dir);
    if (!existsSync(root)) return { ok: true, value: { repos: [] } };
    const maxDepth = Math.min(10, Math.max(1, Math.floor(request.maxDepth ?? 3)));
    const found: string[] = [];
    // Bounded scan: stop after this many visited directories so a huge tree
    // (e.g. a home directory) cannot hang the call.
    const MAX_SCANNED = 2000;
    let scanned = 0;
    const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
    while (queue.length > 0 && scanned < MAX_SCANNED) {
      const current = queue.shift() as { dir: string; depth: number };
      if (current.depth >= maxDepth) continue;
      let dirents: Dirent[] = [];
      try {
        dirents = readdirSync(current.dir, { withFileTypes: true });
      } catch {
        continue; // unreadable directory — skip
      }
      scanned += 1;
      for (const entry of dirents) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
        const name = entry.name;
        if (name === "node_modules" || name.startsWith(".")) continue;
        const candidate = join(current.dir, name);
        if (existsSync(join(candidate, ".git"))) {
          found.push(candidate);
        } else {
          queue.push({ dir: candidate, depth: current.depth + 1 });
        }
      }
    }
    found.sort();
    return { ok: true, value: { repos: found } };
  }

  // ── git init ───────────────────────────────────────────────────────────────

  /**
   * Initialize a git repository in `dir` with `main` as the initial
   * branch. Refuses when the directory already lives inside a repository;
   * returns the resolved repository root on success.
   */
  async init(request: { dir: string }): Promise<GitResult<{ root: string }>> {
    const cwd = resolve(request.dir);
    const probe = await this.cli.run(["rev-parse", "--show-toplevel"], { cwd });
    if (probe.code === 0) {
      return { ok: false, error: fail("already-a-repo", "该目录已经是 Git 仓库") };
    }
    // -b main: default branch is main, regardless of init.defaultBranch.
    const run = await this.cli.run(["init", "-b", "main"], { cwd });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      return { ok: false, error: fail("git-error", stderr || "初始化 Git 仓库失败") };
    }
    const rootRun = await this.cli.run(["rev-parse", "--show-toplevel"], { cwd });
    return {
      ok: true,
      value: { root: rootRun.code === 0 ? rootRun.stdout.trim() : cwd }
    };
  }

  // ── clone ───────────────────────────────────────────────────────────────

  /**
   * Clone a remote repository into `target` (git clone semantics: the target
   * directory is created when missing, and must be empty when it already
   * exists). Resolves to the repository root on success.
   */
  async clone(request: { url: string; target: string }): Promise<GitResult<{ root: string }>> {
    const url = request.url.trim();
    const target = resolve(request.target.trim());
    const parent = dirname(target);
    if (existsSync(target)) {
      try {
        if (readdirSync(target).length > 0) {
          return { ok: false, error: fail("target-exists", `目标目录已存在且不是空目录：${target}`) };
        }
      } catch {
        return { ok: false, error: fail("target-exists", `无法读取目标目录：${target}`) };
      }
    }
    if (!existsSync(parent)) {
      try {
        mkdirSync(parent, { recursive: true });
      } catch {
        return { ok: false, error: fail("write-failed", `无法创建父目录：${parent}`) };
      }
    }
    // Cloning a large repository can take a while — allow up to 10 minutes.
    const run = await this.cli.run(["clone", url, target], {
      cwd: parent,
      timeoutMs: 10 * 60 * 1000
    });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      // A failed clone may leave an empty target directory behind; clean it up.
      try {
        if (existsSync(target) && readdirSync(target).length === 0) {
          rmSync(target, { recursive: true, force: true });
        }
      } catch {
        /* best-effort cleanup */
      }
      if (/already exists and is not an empty directory/i.test(stderr)) {
        return { ok: false, error: fail("target-exists", `目标目录已存在且不是空目录：${target}`) };
      }
      if (/authentication failed|Permission denied \(publickey\)|could not read Username/i.test(stderr)) {
        return { ok: false, error: fail("auth-failed", withGitDetail("克隆认证失败（HTTPS 凭据或 SSH 密钥）", stderr)) };
      }
      if (/could not resolve host|unable to access|Connection timed out|Connection refused/i.test(stderr)) {
        return { ok: false, error: fail("network-error", withGitDetail("无法访问仓库地址，请检查网络与 URL", stderr)) };
      }
      if (/repository .*not found|not found/i.test(stderr)) {
        return { ok: false, error: fail("repo-not-found", withGitDetail("仓库不存在或没有访问权限", stderr)) };
      }
      return { ok: false, error: fail("git-error", withGitDetail("克隆失败", stderr)) };
    }
    return { ok: true, value: { root: target } };
  }

  // ── AI .gitignore (DSH LLM powered) ────────────────────────────────────────

  /**
   * Analyze the repository with the shared LLM: given the root listing, the
   * untracked files, and the current .gitignore, decide whether entries should
   * be added or updated, then apply the new content automatically. Falls back
   * to the default template when no .gitignore exists and no LLM is available.
   */
  async suggestGitignore(request: { dir: string }): Promise<GitResult<{ path: string; changed: boolean }>> {
    const cwd = resolve(request.dir);
    const probe = await this.cli.run(["rev-parse", "--show-toplevel"], { cwd });
    if (probe.code !== 0) {
      return { ok: false, error: fail("not-a-repo", "不是 Git 仓库") };
    }
    const root = probe.stdout.trim();
    const target = join(root, ".gitignore");
    const existing = existsSync(target) ? readFileSync(target, "utf8") : "";

    let entries: string[] = [];
    try {
      entries = readdirSync(root, { withFileTypes: true })
        .map((entry) => entry.name + (entry.isDirectory() ? "/" : ""))
        .sort();
    } catch {
      /* listing unavailable — untracked files below still inform the model */
    }
    let untracked: string[] = [];
    const statusRun = await this.cli.run(["status", "--porcelain", "--untracked-files=all"], { cwd });
    if (statusRun.code === 0) {
      untracked = statusRun.stdout
        .split("\n")
        .filter((line) => line.startsWith("?? "))
        .map((line) => line.slice(3));
    }

    const prompt = [
      "你是 DSH 中的资深 Git 助手。用户请求：帮我更新（或创建）这个仓库的 .gitignore 文件。",
      "仓库根目录：",
      root,
      "",
      "根目录条目：",
      entries.length > 0 ? entries.map((entry) => `- ${entry}`).join("\n") : "(空)",
      "",
      "未跟踪文件（git status）：",
      untracked.length > 0 ? untracked.map((file) => `- ${file}`).join("\n") : "(无)",
      "",
      existing !== "" ? "当前 .gitignore：\n```\n" + existing + "\n```" : "目前没有 .gitignore。",
      "",
      "要求：根据项目类型（构建产物、依赖目录、编辑器文件、日志、密钥等）判断应忽略的内容；保留所有仍有用的现有行。",
      "若无需任何变更，content 返回与现有内容一致（现有为空且无需忽略时返回空字符串）。",
      "严格按输出 schema 返回，不要输出多余文字。"
    ].join("\n");

    let suggestion: string;
    try {
      const out = await this.agentAsk(root, prompt, {
        label: "git-ui gitignore",
        outputSchema: {
          type: "object",
          properties: { content: { type: "string" } },
          required: ["content"],
          additionalProperties: false
        }
      });
      const structured = out.structured as { content?: string } | undefined;
      suggestion = structured?.content !== undefined && structured.content.trim() !== "" ? structured.content : out.text;
    } catch (error) {
      if (existing !== "") return { ok: true, value: { path: target, changed: false } };
      try {
        writeFileSync(target, DEFAULT_GITIGNORE, "utf8");
      } catch {
        return { ok: false, error: fail("write-failed", "写入 .gitignore 失败") };
      }
      return { ok: true, value: { path: target, changed: true } };
    }
    const cleaned = suggestion
      .trim()
      .replace(/^```(?:gitignore|ignore|text)?\s*/i, "")
      .replace(/```\s*$/, "");
    if (cleaned.trim() === "") {
      return { ok: true, value: { path: target, changed: false } };
    }
    const normalized = cleaned.endsWith("\n") ? cleaned : `${cleaned}\n`;
    if (normalized === existing) {
      return { ok: true, value: { path: target, changed: false } };
    }
    try {
      writeFileSync(target, normalized, "utf8");
    } catch {
      return { ok: false, error: fail("write-failed", "写入 .gitignore 失败") };
    }
    return { ok: true, value: { path: target, changed: true } };
  }

  // ── status ────────────────────────────────────────────────────────────────

  async status(request: { dir: string }): Promise<GitResult<RepoStatus>> {
    const cwd = resolve(request.dir);
    const probe = await this.cli.run(["rev-parse", "--show-toplevel"], { cwd });
    if (probe.code !== 0) {
      return { ok: false, error: fail("not-a-repo", "不是 Git 仓库") };
    }
    const root = probe.stdout.trim();

    const [branchRun, headRun, statusRun, stateRun] = await Promise.all([
      // symbolic-ref resolves the real ref name even on an unborn branch (no
      // commits yet), where rev-parse --abbrev-ref echoes "HEAD" and would be
      // misread as detached. A truly detached HEAD makes symbolic-ref fail.
      this.cli.run(["symbolic-ref", "--short", "HEAD"], { cwd }),
      this.cli.run(["rev-parse", "--short", "HEAD"], { cwd }),
      this.cli.run(
        ["status", "--porcelain=v2", "--branch", "--untracked-files=all", "--no-renames"],
        { cwd }
      ),
      this.gitDirState(cwd)
    ]);

    let branch: string | null = null;
    if (branchRun.code === 0) {
      const name = branchRun.stdout.trim();
      branch = name === "HEAD" || name === "" ? null : name;
    }
    const staged: ChangeFile[] = [];
    const unstaged: ChangeFile[] = [];
    const untracked: string[] = [];
    const conflicts: string[] = [];
    let ahead = 0;
    let behind = 0;

    for (const line of statusRun.stdout.split("\n")) {
      if (line.startsWith("# branch.ab ")) {
        const [, aheadText, behindText] = line.split(" ");
        // git prints "+? -?" (or partial "?" values) when it cannot compute
        // the counts (e.g. upstream transiently unavailable); treat as 0 —
        // NaN would otherwise break the wire schema (JSON null).
        const aheadNum = Number(aheadText);
        const behindNum = Number(behindText);
        ahead = Number.isFinite(aheadNum) ? Math.max(0, aheadNum) : 0;
        behind = Number.isFinite(behindNum) ? Math.max(0, behindNum) : 0;
        continue;
      }
      if (line.startsWith("? ")) {
        untracked.push(line.slice(2));
        continue;
      }
      if (line.startsWith("u ")) {
        // u XY sub m1 m2 m3 mW h1 h2 h3 path — unmerged entry (11 fields).
        const parts = line.split(" ");
        const path = parts.slice(10).join(" ") || parts[6] || "";
        conflicts.push(path);
        continue;
      }
      if (line.startsWith("1 ") || line.startsWith("2 ")) {
        // 1 XY sub mH mI mW hH hI path — or 2 XY ... path -> origPath.
        const parts = line.split(" ");
        const xy = parts[1];
        const x = xy.charAt(0);
        const y = xy.charAt(1);
        const path = parts.slice(8).join(" ");
        if (x !== "." && x !== "?") {
          staged.push({ path, status: STATUS_MAP[x] ?? "modified" });
        }
        if (y !== "." && y !== "?") {
          unstaged.push({ path, status: STATUS_MAP[y] ?? "modified" });
        }
        continue;
      }
    }

    const state = stateRun;
    // While merging, the incoming (source) branch is what MERGE_HEAD names.
    // rev-parse --abbrev-ref echoes "MERGE_HEAD" here; name-rev resolves the
    // branch that points at it (or a relative description when none does).
    let mergeSource: string | null = null;
    if (state === "merge") {
      const mergeHeadRun = await this.cli.run(["name-rev", "--name-only", "MERGE_HEAD"], { cwd });
      if (mergeHeadRun.code === 0) {
        const name = mergeHeadRun.stdout.trim();
        mergeSource = name === "" ? null : name;
      }
    }
    return {
      ok: true,
      value: {
        root,
        branch,
        head: headRun.code === 0 ? headRun.stdout.trim() : null,
        ahead,
        behind,
        state,
        mergeSource,
        staged,
        unstaged,
        untracked,
        conflicts
      }
    };
  }

  private async gitDirState(cwd: string): Promise<RepoStatus["state"]> {
    const gitDirRun = await this.cli.run(["rev-parse", "--git-dir"], { cwd });
    if (gitDirRun.code !== 0) return "other";
    const gitDir = isAbsolute(gitDirRun.stdout.trim())
      ? gitDirRun.stdout.trim()
      : resolve(cwd, gitDirRun.stdout.trim());
    // Rebase state is signalled by the rebase-merge/rebase-apply directories,
    // NOT by REBASE_HEAD: git leaves REBASE_HEAD behind when a rebase finishes
    // via `--skip`, which would falsely report an in-progress rebase.
    if (existsSync(join(gitDir, "rebase-merge")) || existsSync(join(gitDir, "rebase-apply"))) {
      return "rebase";
    }
    const markers: Array<[string, RepoStatus["state"]]> = [
      ["MERGE_HEAD", "merge"],
      ["CHERRY_PICK_HEAD", "cherry-pick"],
      ["REVERT_HEAD", "revert"]
    ];
    for (const [name, state] of markers) {
      if (existsSync(join(gitDir, name))) return state;
    }
    return "clean";
  }

  // ── file tree (git-independent: browse / preview / edit / delete) ─────────

  /** List one directory; dotfiles are hidden. Path is relative to dir. */
  async listDir(request: { dir: string; path?: string }): Promise<GitResult<{ entries: DirEntry[] }>> {
    const cwd = resolve(request.dir);
    const rel = request.path ?? "";
    const target = rel === "" ? cwd : resolve(cwd, rel);
    if (!existsSync(target) || !statSync(target).isDirectory()) {
      return { ok: false, error: fail("not-found", "目录不存在") };
    }
    const entries: DirEntry[] = [];
    for (const entry of readdirSync(target, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const path = rel === "" ? entry.name : rel + "/" + entry.name;
      entries.push({ name: entry.name, path, kind: entry.isDirectory() ? "dir" : "file" });
    }
    entries.sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1
    );
    return { ok: true, value: { entries } };
  }

  /** Read a text file for preview/editing (512 KiB cap, NUL-byte binary sniff). */
  async readFile(request: { dir: string; path: string }): Promise<GitResult<FileContent>> {
    const cwd = resolve(request.dir);
    const target = resolve(cwd, request.path);
    if (!existsSync(target) || !statSync(target).isFile()) {
      return { ok: false, error: fail("not-found", "文件不存在") };
    }
    const stat = statSync(target);
    if (stat.size > 4 * 1024 * 1024) {
      return { ok: false, error: fail("too-large", "文件过大（超过 4 MB），无法打开") };
    }
    const buffer = readFileSync(target);
    if (buffer.includes(0)) {
      return { ok: true, value: { content: "", truncated: false, binary: true } };
    }
    const text = buffer.toString("utf8");
    const MAX = 512 * 1024;
    return { ok: true, value: { content: text.slice(0, MAX), truncated: text.length > MAX, binary: false } };
  }


  /**
   * Read a file as base64 for binary previews (images etc.).
   * `ref` selects a git revision (e.g. "HEAD" or a hash); omitted = working tree.
   */
  async binaryContent(request: {
    dir: string;
    path: string;
    ref?: string;
  }): Promise<GitResult<{ mime: string; base64: string }>> {
    const cwd = resolve(request.dir);
    let raw: string;
    try {
      if (request.ref !== undefined && request.ref !== "") {
        const run = await this.cli.run(["show", request.ref + ":" + request.path], { cwd, binary: true });
        if (run.code !== 0) {
          return { ok: false, error: fail("git-error", "读取版本内容失败") };
        }
        raw = run.stdout;
      } else {
        raw = readFileSync(join(cwd, request.path)).toString("latin1");
      }
    } catch {
      return { ok: false, error: fail("read-error", "读取文件失败") };
    }
    const buffer = Buffer.from(raw, "latin1");
    if (buffer.length > 8 * 1024 * 1024) {
      return { ok: false, error: fail("too-large", "文件过大（超过 8 MB），无法预览") };
    }
    return { ok: true, value: { mime: mimeForPath(request.path), base64: buffer.toString("base64") } };
  }

  /** Create or overwrite a text file. Path must stay inside the root dir. */
  async writeFile(request: { dir: string; path: string; content: string }): Promise<GitResult<{ path: string }>> {
    const cwd = resolve(request.dir);
    const target = resolve(cwd, request.path);
    if (target !== cwd && target.startsWith(cwd + sep) === false) {
      return { ok: false, error: fail("invalid-path", "路径无效") };
    }
    try {
      writeFileSync(target, request.content, "utf8");
    } catch (caught) {
      return { ok: false, error: fail("write-error", "写入失败：" + String((caught as Error).message).slice(0, 200)) };
    }
    return { ok: true, value: { path: request.path } };
  }

  /** Delete a file, or a directory tree when recursive is set. */
  async deleteFile(request: { dir: string; path: string; recursive?: boolean }): Promise<GitResult<{ path: string }>> {
    const cwd = resolve(request.dir);
    const target = resolve(cwd, request.path);
    if (target === cwd || target.startsWith(cwd + sep) === false) {
      return { ok: false, error: fail("invalid-path", "路径无效") };
    }
    try {
      const stat = statSync(target);
      if (stat.isDirectory() && request.recursive !== true) {
        return { ok: false, error: fail("not-empty", "目录非空，需要递归删除") };
      }
      rmSync(target, { recursive: stat.isDirectory(), force: false });
    } catch (caught) {
      return { ok: false, error: fail("delete-error", "删除失败：" + String((caught as Error).message).slice(0, 200)) };
    }
    return { ok: true, value: { path: request.path } };
  }

  // ── diff ──────────────────────────────────────────────────────────────────

  async diff(request: {
    dir: string;
    path?: string;
    staged?: boolean;
    context?: number;
    wsFlags?: WsFlags;
  }): Promise<GitResult<{ files: DiffFile[] }>> {
    const cwd = resolve(request.dir);
    const context = request.context ?? 3;
    // Non-ASCII paths would otherwise come back C-quoted (`"a/\xxx"`) and the
    // unified-diff parser could not read the file header.
    const quoteFix = ["-c", "core.quotePath=false"];
    // The whitespace flags map to git diff options; hunk boundaries change
    // with the flags, so every hunk-indexed operation must be told the same
    // flags (stageHunks etc.). Diff options must come AFTER the "diff" verb.
    const wsFix = (): string[] => wsModeArgs(request.wsFlags);
    // IDEA-style: compare the working tree against HEAD (staged + unstaged
    // combined). The output is the FORWARD diff (HEAD → worktree) — the client
    // renders it with the columns swapped so the current file sits on the
    // left. This keeps the displayed hunks byte-identical to the forward
    // patch that stageHunks / revertHunks rebuild, so hunk indices always
    // line up. In a repo with no commits yet there is no HEAD, so fall back
    // to plain 'git diff' (working tree vs index).
    let headOk = true;
    if (!request.staged) {
      const head = await this.cli.run(["rev-parse", "--verify", "HEAD"], { cwd });
      headOk = head.code === 0;
    }
    // Untracked files produce no 'git diff' output at all — show the whole
    // file as additions (IDEA renders new files as full additions).
    if (!request.staged && request.path !== undefined) {
      const tracked = await this.cli.run(["ls-files", "--error-unmatch", "--", request.path], { cwd });
      if (tracked.code !== 0) {
        const nr = await this.cli.run(
          [...quoteFix, "diff", ...wsFix(), "--no-index", "--no-color", "--unified=" + context, "/dev/null", request.path],
          { cwd }
        );
        if (nr.code === 0 || nr.code === 1) {
          const files = parseUnifiedDiff(nr.stdout, { path: request.path });
          return { ok: true, value: { files } };
        }
        return { ok: false, error: fail("git-error", "获取差异失败") };
      }
    }
    const args = [
      ...quoteFix,
      "diff",
      ...wsFix(),
      "--no-color",
      "--unified=" + context,
      ...(request.staged ? ["--cached"] : headOk ? ["HEAD"] : [])
    ];
    if (request.path !== undefined) args.push("--", request.path);

    const run = await this.cli.run(args, { cwd });
    // No HEAD (fresh `git init`): plain 'git diff' compares worktree vs index,
    // which is empty for fully-staged files. Diff the index against the empty
    // tree instead and keep the worktree delta — the same two blocks `git
    // diff HEAD` emits once the first commit exists.
    if (!request.staged && !headOk) {
      const cached = await this.cli.run(
        [
          ...quoteFix,
          "diff",
          ...wsFix(),
          "--cached",
          "--no-color",
          "--unified=" + context,
          ...(request.path !== undefined ? ["--", request.path] : [])
        ],
        { cwd }
      );
      const combined = [cached.stdout, run.stdout].filter((s) => s.trim() !== "").join("\n");
      const files = parseUnifiedDiff(combined, { path: request.path });
      return { ok: true, value: { files } };
    }
    if (run.code !== 0) {
      return { ok: false, error: fail("git-error", "获取差异失败") };
    }
    const files = parseUnifiedDiff(run.stdout, { path: request.path });
    return { ok: true, value: { files } };
  }

  // ── hunk-level operations (partial stage / revert) ───────────────────────

  /**
   * Stage exactly the given hunks of a file into the index (partial staging).
   * The hunks are re-extracted from a fresh `git diff HEAD -- <path>` so the
   * patch context always matches the current index; files with existing
   * staged changes are refused (their index context would not match).
   */
  async stageHunks(request: HunkPatchRequest): Promise<GitResult<{ applied: number }>> {
    const cwd = resolve(request.dir);
    // `git diff --cached --quiet` exits 0 when the index equals HEAD for this
    // path (nothing staged), 1 when staged changes exist.
    const cached = await this.cli.run(["diff", "--cached", "--quiet", "--", request.path], { cwd });
    if (cached.code === 1) {
      return { ok: false, error: fail("staged-exists", "该文件已有暂存改动，请先取消暂存再按块暂存") };
    }
    if (cached.code !== 0) {
      return { ok: false, error: fail("git-error", "检查暂存状态失败") };
    }
    const built = await this.buildHunkPatch(cwd, request.path, request.hunks, request.wsFlags);
    if (!built.ok) return built;
    // In whitespace modes the patch context carries the file's actual
    // whitespace, which the index (stripped) does not match — ignore
    // whitespace while matching context lines, the hunk content is exact.
    const run = await this.cli.run(
      ["apply", "--cached", "--whitespace=nowarn", ...(wsFlagsActive(request.wsFlags) ? ["--ignore-whitespace"] : []), "-"],
      { cwd, input: built.patch }
    );
    if (run.code !== 0) {
      return { ok: false, error: fail("apply-failed", withGitDetail("暂存所选改动失败（文件可能已变化，请刷新）", run.stderr)) };
    }
    return { ok: true, value: { applied: request.hunks.length } };
  }

  /** Revert exactly the given hunks in the working tree (reverse-apply). */
  async revertHunks(request: HunkPatchRequest): Promise<GitResult<{ reverted: number }>> {
    const cwd = resolve(request.dir);
    const built = await this.buildHunkPatch(cwd, request.path, request.hunks, request.wsFlags);
    if (!built.ok) return built;
    const run = await this.cli.run(
      ["apply", "-R", "--whitespace=nowarn", ...(wsFlagsActive(request.wsFlags) ? ["--ignore-whitespace"] : []), "-"],
      { cwd, input: built.patch }
    );
    if (run.code !== 0) {
      return { ok: false, error: fail("apply-failed", withGitDetail("还原所选改动失败（文件可能已变化，请刷新）", run.stderr)) };
    }
    return { ok: true, value: { reverted: request.hunks.length } };
  }

  /**
   * Extract the selected hunks of `path` from a fresh forward diff into a
   * standalone single-file patch (file header + chosen hunks, in order).
   * Hunk indices follow the display diff (same file, same context, same
   * whitespace mode → identical hunk boundaries), so the client can pass the
   * indices it rendered straight through.
   */
  private async buildHunkPatch(
    cwd: string,
    path: string,
    hunks: number[],
    wsFlags?: WsFlags
  ): Promise<{ ok: true; patch: string } | { ok: false; error: GitError }> {
    const tracked = await this.cli.run(["ls-files", "--error-unmatch", "--", path], { cwd });
    if (tracked.code !== 0) {
      return { ok: false, error: fail("not-tracked", "文件未跟踪，无法进行按块操作") };
    }
    const run = await this.cli.run(
      [
        "-c", "core.quotePath=false",
        "diff", "--no-color", "--unified=3",
        ...wsModeArgs(wsFlags),
        "HEAD", "--", path
      ],
      { cwd }
    );
    if (run.code !== 0) {
      return { ok: false, error: fail("git-error", "获取差异失败") };
    }
    const raw = run.stdout;
    if (raw.trim() === "") {
      return { ok: false, error: fail("no-diff", "该文件没有可操作的差异") };
    }
    // Split the raw output into file-header lines and per-hunk blocks. The
    // final trailing newline must not become an empty last element — a bare
    // empty line at the end of a hunk makes `git apply` report "corrupt
    // patch".
    const lines = raw.endsWith("\n") ? raw.slice(0, -1).split("\n") : raw.split("\n");
    const header: string[] = [];
    const blocks: string[][] = [];
    let current: string[] | null = null;
    for (const line of lines) {
      if (line.startsWith("@@")) {
        current = [line];
        blocks.push(current);
      } else if (current !== null) {
        current.push(line);
      } else {
        header.push(line);
      }
    }
    if (blocks.length === 0) {
      return { ok: false, error: fail("no-diff", "该文件没有可操作的差异") };
    }
    if (hunks.some((index) => index < 0 || index >= blocks.length)) {
      return { ok: false, error: fail("invalid-hunks", "差异块索引超出范围") };
    }
    const wanted = new Set(hunks);
    // Every patch line (including a trailing context line) must end with a
    // newline, or `git apply` reports "corrupt patch".
    const patch = [
      ...header,
      ...blocks.flatMap((block, index) => (wanted.has(index) ? block : []))
    ].join("\n") + "\n";
    return { ok: true, patch };
  }

  /**
   * IDEA-style change-level patch: one visually separate block (a run of
   * deleted lines paired with a run of added lines, delimited by context)
   * inside a hunk, NOT the whole hunk. The block's line numbers come from
   * the display diff; we re-derive them from a fresh diff (same file, same
   * context, same whitespace mode) and extract that block's rows plus up to
   * 3 leading context lines into a standalone patch with a recomputed
   * hunk header.
   */
  private async buildChangePatch(
    cwd: string,
    path: string,
    change: ChangeRef,
    wsFlags?: WsFlags
  ): Promise<{ ok: true; patch: string } | { ok: false; error: GitError }> {
    const tracked = await this.cli.run(["ls-files", "--error-unmatch", "--", path], { cwd });
    if (tracked.code !== 0) {
      return { ok: false, error: fail("not-tracked", "文件未跟踪，无法进行按块操作") };
    }
    const run = await this.cli.run(
      [
        "-c", "core.quotePath=false",
        "diff", "--no-color", "--unified=3",
        ...wsModeArgs(wsFlags),
        "HEAD", "--", path
      ],
      { cwd }
    );
    if (run.code !== 0) {
      return { ok: false, error: fail("git-error", "获取差异失败") };
    }
    const raw = run.stdout;
    if (raw.trim() === "") {
      return { ok: false, error: fail("no-diff", "该文件没有可操作的差异") };
    }
    const lines = raw.endsWith("\n") ? raw.slice(0, -1).split("\n") : raw.split("\n");
    const header: string[] = [];
    interface ParsedChange {
      ref: ChangeRef;
      rows: string[];
      ctxBefore: string[];
      noNewline: boolean;
    }
    const changes: ParsedChange[] = [];
    let oldCursor = 0;
    let newCursor = 0;
    let inHunk = false;
    let pending: ParsedChange | null = null;
    let ctxRun: string[] = [];
    const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
    for (const line of lines) {
      const hm = HUNK_RE.exec(line);
      if (hm !== null) {
        if (pending !== null) { changes.push(pending); pending = null; }
        oldCursor = Number(hm[1]);
        newCursor = Number(hm[3]);
        inHunk = true;
        ctxRun = [];
        continue;
      }
      if (!inHunk) { header.push(line); continue; }
      const prefix = line.charAt(0);
      if (prefix === " ") {
        if (pending !== null) { changes.push(pending); pending = null; }
        ctxRun.push(line);
        if (ctxRun.length > 3) ctxRun.shift();
        oldCursor++;
        newCursor++;
      } else if (prefix === "-") {
        if (pending === null) {
          pending = { ref: { oldStart: oldCursor, oldCount: 0, newStart: newCursor, newCount: 0 }, rows: [], ctxBefore: [...ctxRun], noNewline: false };
        }
        pending.rows.push(line);
        pending.ref.oldCount++;
        oldCursor++;
      } else if (prefix === "+") {
        if (pending === null) {
          pending = { ref: { oldStart: oldCursor, oldCount: 0, newStart: newCursor, newCount: 0 }, rows: [], ctxBefore: [...ctxRun], noNewline: false };
        }
        pending.rows.push(line);
        pending.ref.newCount++;
        newCursor++;
      } else if (line.startsWith("\\ No newline")) {
        if (pending !== null) pending.noNewline = true;
      }
    }
    if (pending !== null) changes.push(pending);
    if (changes.length === 0) {
      return { ok: false, error: fail("no-diff", "该文件没有可操作的差异") };
    }
    const target = changes.find(
      (c) =>
        c.ref.oldStart === change.oldStart &&
        c.ref.oldCount === change.oldCount &&
        c.ref.newStart === change.newStart &&
        c.ref.newCount === change.newCount
    );
    if (target === undefined) {
      return { ok: false, error: fail("change-not-found", "修改块未找到（文件可能已变化，请刷新）") };
    }
    const ctxN = target.ctxBefore.length;
    const oldStart = target.ref.oldStart - ctxN;
    const newStart = target.ref.newStart - ctxN;
    const oldCount = ctxN + target.ref.oldCount;
    const newCount = ctxN + target.ref.newCount;
    const hunk = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
    const patchLines = [...header, hunk, ...target.ctxBefore, ...target.rows];
    if (target.noNewline) patchLines.push("\\ No newline at end of file");
    const patch = patchLines.join("\n") + "\n";
    return { ok: true, patch };
  }

  /** Revert exactly one visual change (IDEA change unit) in the worktree. */
  async revertChanges(request: ChangePatchRequest): Promise<GitResult<{ reverted: number }>> {
    const cwd = resolve(request.dir);
    const built = await this.buildChangePatch(cwd, request.path, request.change, request.wsFlags);
    if (!built.ok) return built;
    const run = await this.cli.run(
      [
        "apply", "-R", "--whitespace=nowarn", "--unidiff-zero",
        ...(wsFlagsActive(request.wsFlags) ? ["--ignore-whitespace"] : []),
        "-"
      ],
      { cwd, input: built.patch }
    );
    if (run.code !== 0) {
      return { ok: false, error: fail("apply-failed", withGitDetail("还原所选改动失败（文件可能已变化，请刷新）", run.stderr)) };
    }
    return { ok: true, value: { reverted: 1 } };
  }

  /** Stage exactly one visual change into the index (IDEA change unit). */
  async stageChanges(request: ChangePatchRequest): Promise<GitResult<{ applied: number }>> {
    const cwd = resolve(request.dir);
    const cached = await this.cli.run(["diff", "--cached", "--quiet", "--", request.path], { cwd });
    if (cached.code === 1) {
      return { ok: false, error: fail("staged-exists", "该文件已有暂存改动，请先取消暂存再按块暂存") };
    }
    if (cached.code !== 0) {
      return { ok: false, error: fail("git-error", "检查暂存状态失败") };
    }
    const built = await this.buildChangePatch(cwd, request.path, request.change, request.wsFlags);
    if (!built.ok) return built;
    const run = await this.cli.run(
      [
        "apply", "--cached", "--whitespace=nowarn", "--unidiff-zero",
        ...(wsFlagsActive(request.wsFlags) ? ["--ignore-whitespace"] : []),
        "-"
      ],
      { cwd, input: built.patch }
    );
    if (run.code !== 0) {
      return { ok: false, error: fail("apply-failed", withGitDetail("暂存所选改动失败（文件可能已变化，请刷新）", run.stderr)) };
    }
    return { ok: true, value: { applied: 1 } };
  }

  // ── staging ───────────────────────────────────────────────────────────────

  async stage(request: { dir: string; paths: string[] }): Promise<GitResult<{ paths: string[] }>> {
    return this.pathsMutation(["add", "--"], request, "stage");
  }

  async unstage(request: { dir: string; paths: string[] }): Promise<GitResult<{ paths: string[] }>> {
    return this.pathsMutation(["restore", "--staged", "--"], request, "unstage");
  }

  async discard(request: { dir: string; paths: string[]; staged?: boolean }): Promise<GitResult<{ paths: string[] }>> {
    // A staged discard also clears the index (git restore --staged --worktree),
    // so the file disappears from the staged list too.
    const args = request.staged === true ? ["restore", "--staged", "--worktree", "--"] : ["restore", "--"];
    return this.pathsMutation(args, request, "discard");
  }

  /** Untrack files/dirs: remove from the index, keep them on disk. */
  async untrack(request: { dir: string; paths: string[] }): Promise<GitResult<{ paths: string[] }>> {
    return this.pathsMutation(["rm", "-r", "--cached", "--"], request, "untrack");
  }

  /** Checkout the selected file(s) at a given revision ("get from revision").
   *  Updates both the index and the worktree to that revision's content. */
  async getFromRevision(request: { dir: string; paths: string[]; revision: string }): Promise<GitResult<{ paths: string[] }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["checkout", request.revision, "--", ...request.paths], { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("git-error", withGitDetail("从版本获取失败", run.stderr)) };
    }
    return { ok: true, value: { paths: request.paths } };
  }

  private async pathsMutation(
    prefix: string[],
    request: { dir: string; paths: string[] },
    label: string
  ): Promise<GitResult<{ paths: string[] }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run([...prefix, ...request.paths], { cwd });
    if (run.code !== 0) {
      const labelText =
        label === "stage" ? "暂存失败" :
        label === "unstage" ? "取消暂存失败" :
        label === "untrack" ? "撤销跟踪失败" :
        "丢弃失败";
      return { ok: false, error: fail("git-error", withGitDetail(labelText, run.stderr)) };
    }
    return { ok: true, value: { paths: request.paths } };
  }

  // ── commit ────────────────────────────────────────────────────────────────

  async commit(request: {
    dir: string;
    message: string;
    amend?: boolean;
    /** IDEA-style: commit exactly these paths (checked in the UI).
     *  Untracked files are added first; other staged files are left alone.
     *  When omitted, commits whatever is already staged (classic behavior). */
    paths?: string[];
    /** Hunk-level selection: only these hunks of these files enter the commit.
     *  Files must have no staged changes; the index is rebuilt so a plain
     *  `git commit` contains exactly the checked files/hunks. */
    partial?: PartialHunkCommit[];
  }): Promise<GitResult<{ hash: string; short: string; amended: boolean }>> {
    if (request.message.trim() === "") {
      return { ok: false, error: fail("empty-message", "提交信息不能为空") };
    }
    const cwd = resolve(request.dir);
    const partial = request.partial ?? [];
    const partialPaths = new Set(partial.map((item) => item.path));
    // Files checked as a whole (untracked included); the partial files are
    // staged hunk-by-hunk below instead of wholesale.
    const plainPaths = (request.paths ?? []).filter((path) => !partialPaths.has(path));

    // Partial files must not carry staged changes: `git apply --cached`
    // validates against the index, and we rebuild it from HEAD.
    for (const item of partial) {
      const cached = await this.cli.run(["diff", "--cached", "--quiet", "--", item.path], { cwd });
      if (cached.code === 1) {
        return {
          ok: false,
          error: fail("staged-exists", `文件 ${item.path} 已有暂存改动，请先取消暂存再按块提交`)
        };
      }
      if (cached.code !== 0) {
        return { ok: false, error: fail("git-error", "检查暂存状态失败") };
      }
    }

    if (plainPaths.length > 0) {
      // IDEA-style commit: stage the checked paths first (this also makes
      // untracked files known to git). Paths that exist in NEITHER the index
      // nor the working tree (already staged deletions) make 'git add' fail
      // with a pathspec error — skip them here; they are still committed via
      // '-- <paths>' below (or via the rebuilt index when partial is set).
      let addPaths = plainPaths;
      if (addPaths.length > 1) {
        const ls = await this.cli.run(["ls-files", "--error-unmatch", "--", ...addPaths], { cwd });
        if (ls.code !== 0) {
          const notInIndex = new Set<string>();
          for (const m of ls.stderr.matchAll(/pathspec '([^']+)' did not match/g)) {
            notInIndex.add(m[1] as string);
          }
          if (notInIndex.size > 0) {
            addPaths = addPaths.filter((p) => !(notInIndex.has(p) && !existsSync(join(cwd, p))));
          }
        }
      }
      if (addPaths.length > 0) {
        const add = await this.cli.run(["add", "--", ...addPaths], { cwd });
        if (add.code !== 0) {
          return { ok: false, error: fail("git-error", withGitDetail("暂存勾选文件失败", add.stderr)) };
        }
      }
    }

    // Stage the selected hunks of every partial file into the index.
    for (const item of partial) {
      const built = await this.buildHunkPatch(cwd, item.path, item.hunks, item.wsFlags);
      if (!built.ok) return built;
      const apply = await this.cli.run(
        ["apply", "--cached", "--whitespace=nowarn", ...(wsFlagsActive(item.wsFlags) ? ["--ignore-whitespace"] : []), "-"],
        { cwd, input: built.patch }
      );
      if (apply.code !== 0) {
        return {
          ok: false,
          error: fail("apply-failed", withGitDetail(`暂存 ${item.path} 的所选改动失败（文件可能已变化，请刷新）`, apply.stderr))
        };
      }
    }

    // With partial selections the commit cannot use a pathspec (that would
    // commit working-tree content, ignoring the rebuilt index). Instead the
    // index is scoped down to exactly the checked files: anything staged
    // that is NOT checked is unstaged (kept in the working tree).
    const checked = new Set(request.paths ?? []);
    if (partial.length > 0) {
      const stagedRun = await this.cli.run(["diff", "--cached", "--name-only"], { cwd });
      if (stagedRun.code !== 0) {
        return { ok: false, error: fail("git-error", "读取暂存区失败") };
      }
      const toUnstage = stagedRun.stdout
        .split("\n")
        .filter((path) => path !== "" && !checked.has(path));
      if (toUnstage.length > 0) {
        const un = await this.cli.run(["restore", "--staged", "--", ...toUnstage], { cwd });
        if (un.code !== 0) {
          return { ok: false, error: fail("git-error", withGitDetail("调整暂存区失败", un.stderr)) };
        }
      }
    }

    const args = ["commit", ...(request.amend ? ["--amend"] : []), "-m", request.message];
    // Pathspec commits take working-tree content; only safe without partial.
    if (request.paths !== undefined && request.paths.length > 0 && partial.length === 0) {
      args.push("--", ...request.paths);
    }
    const run = await this.cli.run(args, { cwd });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      if (/nothing to commit|no changes added to commit/i.test(stderr)) {
        return { ok: false, error: fail("nothing-to-commit", "没有可提交的变更，请先暂存") };
      }
      if (/Please tell me who you are/i.test(stderr)) {
        return { ok: false, error: fail("identity-missing", "git 身份未配置（user.name / user.email）") };
      }
      return { ok: false, error: fail("git-error", "提交失败") };
    }
    const hashRun = await this.cli.run(["rev-parse", "HEAD"], { cwd });
    const hash = hashRun.code === 0 ? hashRun.stdout.trim() : "";
    return {
      ok: true,
      value: { hash, short: hash.slice(0, 7), amended: request.amend === true }
    };
  }

  // ── commit detail (IDEA Log details panel) ────────────────────────────────

  async commitDetail(request: { dir: string; hash: string }): Promise<
    GitResult<{
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
      files: Array<{ path: string; status: string; additions: number | null; deletions: number | null }>;
    }>
  > {
    const cwd = resolve(request.dir);
    const metaFormat = ["%H", "%h", "%an", "%ae", "%at", "%cn", "%ct", "%P"].join("%x02");
    const [metaRun, statusRun, bodyRun] = await Promise.all([
      this.cli.run(["show", "--no-color", "--numstat", `--format=${metaFormat}`, request.hash], { cwd }),
      this.cli.run(["show", "--no-color", "--name-status", "--format=", request.hash], { cwd }),
      this.cli.run(["log", "-1", "--format=%B", request.hash], { cwd })
    ]);
    if (metaRun.code !== 0) {
      return { ok: false, error: fail("hash-not-found", "提交不存在") };
    }

    const metaLines = metaRun.stdout.split("\n");
    const meta = metaLines[0]?.split("\x02") ?? [];
    const [hash = "", short = "", author = "", authorEmail = "", authorDateText = "", committer = "", committerDateText = "", parentsText = ""] = meta;

    const files: Array<{ path: string; status: string; additions: number | null; deletions: number | null }> = [];
    // numstat lines: "<add>\t<del>\t<path>" ("-" for binary).
    for (const line of metaLines.slice(1)) {
      if (line === "") continue;
      const match = /^(\S+)\t(\S+)\t(.*)$/.exec(line);
      if (match === null) continue;
      const [, add, del, path] = match;
      if (path === undefined) continue;
      files.push({
        path,
        status: "",
        additions: add === "-" ? null : Number(add),
        deletions: del === "-" ? null : Number(del)
      });
    }
    // name-status lines: "<XY>\t<path>" — fold statuses onto the same paths.
    const statusByPath = new Map<string, string>();
    for (const line of statusRun.stdout.split("\n")) {
      if (line === "") continue;
      const index = line.indexOf("\t");
      if (index === -1) continue;
      const status = line.slice(0, index);
      const path = line.slice(index + 1);
      statusByPath.set(path, status);
    }
    for (const file of files) {
      const status = statusByPath.get(file.path);
      if (status !== undefined) file.status = status;
    }

    const lines = bodyRun.stdout.split("\n");
    const subject = lines[0] ?? "";
    const body = lines.slice(1).join("\n").replace(/\n+$/, "");

    return {
      ok: true,
      value: {
        hash,
        short,
        subject,
        body,
        author,
        authorEmail,
        authorDate: Number(authorDateText) * 1000,
        committer,
        committerDate: Number(committerDateText) * 1000,
        parents: parentsText === "" ? [] : parentsText.split(" "),
        files
      }
    };
  }

  /** Diff of one commit (optionally one file inside it) — the Log details file view. */
  async commitDiff(request: { dir: string; hash: string; path?: string }): Promise<GitResult<{ files: DiffFile[] }>> {
    const cwd = resolve(request.dir);
    const pathArgs = request.path !== undefined ? ["--", request.path] : [];
    // diff-tree prints plain `diff --git` blocks (no commit header); --root
    // diffs the empty tree for the root commit. For merge commits diff-tree
    // prints nothing by default, so fall back to a first-parent comparison.
    let run = await this.cli.run(
      ["-c", "core.quotePath=false", "diff-tree", "-p", "--no-color", "-r", "--root", "--unified=3", request.hash, ...pathArgs],
      { cwd }
    );
    let files = parseUnifiedDiff(run.stdout, { path: request.path });
    if (run.code === 0 && files.length === 0) {
      run = await this.cli.run(
        ["-c", "core.quotePath=false", "diff", "--no-color", "--unified=3", `${request.hash}^`, request.hash, ...pathArgs],
        { cwd }
      );
      files = parseUnifiedDiff(run.stdout, { path: request.path });
    }
    if (run.code !== 0) {
      return { ok: false, error: fail("hash-not-found", "提交不存在") };
    }
    return { ok: true, value: { files } };
  }

  // ── branches ──────────────────────────────────────────────────────────────

  async branches(request: { dir: string }): Promise<
    GitResult<{ current: string | null; branches: BranchInfo[]; remotes: string[] }>
  > {
    const cwd = resolve(request.dir);
    const [listRun, currentRun, remoteRun] = await Promise.all([
      // List BOTH local heads and remote-tracking refs; %(refname:short) would
      // strip the refs/remotes/ prefix to "origin/main", so use the full
      // refname and normalize it to "remotes/<remote>/<branch>" here — the UI
      // and pullRemoteBranch rely on that shape.
      this.cli.run(["for-each-ref", "--format=%(refname)%00%(upstream:short)", "refs/heads", "refs/remotes"], { cwd }),
      this.cli.run(["branch", "--show-current"], { cwd }),
      this.cli.run(["remote"], { cwd })
    ]);
    if (listRun.code !== 0) {
      return { ok: false, error: fail("not-a-repo", "不是 Git 仓库") };
    }
    const branches: BranchInfo[] = [];
    for (const line of listRun.stdout.split("\n")) {
      if (line === "") continue;
      const [refname, upstream] = line.split("\0");
      const name = refname.startsWith("refs/remotes/")
        ? "remotes/" + refname.slice("refs/remotes/".length)
        : refname.startsWith("refs/heads/")
          ? refname.slice("refs/heads/".length)
          : refname;
      branches.push({
        name,
        current: name === currentRun.stdout.trim(),
        ...(upstream !== undefined && upstream !== "" ? { upstream } : {})
      });
    }
    const remotes = remoteRun.code === 0 ? remoteRun.stdout.trim().split("\n").filter(Boolean) : [];
    return {
      ok: true,
      value: {
        current: currentRun.code === 0 && currentRun.stdout.trim() !== "" ? currentRun.stdout.trim() : null,
        branches,
        remotes
      }
    };
  }

  // ── remotes / push ────────────────────────────────────────────────────────

  async remotes(request: { dir: string }): Promise<GitResult<{ remotes: RemoteInfo[] }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["remote", "-v"], { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("not-a-repo", "不是 Git 仓库") };
    }
    // "git remote -v" lines: <name>\t<url> (fetch) / (push)
    const byName = new Map<string, RemoteInfo>();
    for (const line of run.stdout.split("\n")) {
      const match = /^(\S+)\t(\S+) \((fetch|push)\)$/.exec(line.trim());
      if (match === null) continue;
      const [, name, url, kind] = match;
      const entry = byName.get(name) ?? { name, url };
      if (kind === "push" && url !== entry.url) entry.pushUrl = url;
      byName.set(name, entry);
    }
    return { ok: true, value: { remotes: [...byName.values()] } };
  }

  async remoteAdd(request: { dir: string; name: string; url: string }): Promise<GitResult<{ name: string; url: string }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["remote", "add", request.name, request.url], { cwd });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      if (/already exists/i.test(stderr)) {
        return { ok: false, error: fail("remote-exists", "同名远程仓库已存在") };
      }
      return { ok: false, error: fail("git-error", stderr || "添加远程仓库失败") };
    }
    return { ok: true, value: { name: request.name, url: request.url } };
  }

  async remoteRemove(request: { dir: string; name: string }): Promise<GitResult<{ name: string }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["remote", "remove", request.name], { cwd });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      if (/No such remote/i.test(stderr)) {
        return { ok: false, error: fail("remote-not-found", "远程仓库不存在") };
      }
      return { ok: false, error: fail("git-error", stderr || "删除远程仓库失败") };
    }
    return { ok: true, value: { name: request.name } };
  }

  async remoteRename(request: { dir: string; oldName: string; newName: string }): Promise<GitResult<{ name: string }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["remote", "rename", request.oldName, request.newName], { cwd });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      if (/No such remote/i.test(stderr)) return { ok: false, error: fail("remote-not-found", "远程仓库不存在") };
      return { ok: false, error: fail("git-error", stderr || "重命名远程仓库失败") };
    }
    return { ok: true, value: { name: request.newName } };
  }

  async remoteSetUrl(request: { dir: string; name: string; url: string }): Promise<GitResult<{ name: string; url: string }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["remote", "set-url", request.name, request.url], { cwd });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      if (/No such remote/i.test(stderr)) return { ok: false, error: fail("remote-not-found", "远程仓库不存在") };
      return { ok: false, error: fail("git-error", stderr || "更新远程仓库 URL 失败") };
    }
    return { ok: true, value: { name: request.name, url: request.url } };
  }

  /**
   * Push the given branch to a remote. When remoteBranch differs from the
   * local branch name the refspec becomes <local>:<remote>. force uses
   * --force-with-lease (refuses to overwrite remote updates you have not
   * seen). Networking can be slow, so the git call gets a longer timeout.
   */
  async push(request: {
    dir: string;
    remote: string;
    branch: string;
    setUpstream?: boolean;
    remoteBranch?: string;
    force?: boolean;
    followTags?: boolean;
  }): Promise<GitResult<PushOutcome>> {
    const cwd = resolve(request.dir);
    const remoteBranch =
      request.remoteBranch !== undefined && request.remoteBranch.trim() !== ""
        ? request.remoteBranch.trim()
        : request.branch;
    const args = ["push"];
    if (request.force === true) args.push("--force-with-lease");
    if (request.setUpstream === true) args.push("-u");
    if (request.followTags === true) args.push("--follow-tags");
    args.push(request.remote, request.branch === remoteBranch ? request.branch : request.branch + ":" + remoteBranch);
    const run = await this.cli.run(args, { cwd, timeoutMs: 120000 });
    const combined = `${run.stdout}\n${run.stderr}`.trim();
    if (run.code === 0) {
      const lines = combined.split("\n").filter((line) => /->|up-to-date|new branch|created/i.test(line));
      return { ok: true, value: { pushed: true, message: lines.join("\n") || combined } };
    }
    if (/rejected|non-fast-forward|fetch first/i.test(combined)) {
      return {
        ok: false,
        error: fail("push-rejected", "推送被拒绝：远程有本地没有的提交，请先拉取（pull）再推送")
      };
    }
    if (/Authentication failed|could not read Username|Permission denied|terminal prompts disabled/i.test(combined)) {
      return { ok: false, error: fail("auth-failed", "推送失败：认证失败（请检查远程 URL 的凭据）") };
    }
    const detail = combined.split("\n").filter(Boolean).slice(-3).join("；");
    return { ok: false, error: fail("push-failed", "推送失败：" + (detail || "未知错误")) };
  }

  // ── fetch / pull ─────────────────────────────────────────────────────────

  async fetch(request: { dir: string; remote?: string }): Promise<GitResult<{ fetched: boolean; message?: string }>> {
    const cwd = resolve(request.dir);
    const args = ["fetch", ...(request.remote !== undefined ? [request.remote] : [])];
    const run = await this.cli.run(args, { cwd, timeoutMs: 120000 });
    const combined = `${run.stdout}\n${run.stderr}`.trim();
    if (run.code !== 0) {
      return {
        ok: false,
        error: fail("fetch-failed", "抓取失败：" + (combined.split("\n").filter(Boolean).slice(-2).join("；") || "未知错误"))
      };
    }
    const last = combined.split("\n").filter(Boolean).pop();
    // Never include the key with an undefined value: the typert gateway
    // rejects non-JSON-safe values (undefined) in the business result.
    return { ok: true, value: { fetched: true, ...(last !== undefined ? { message: last } : {}) } };
  }

  /** Pull (merge or rebase strategy) with conflict detection like merge(). */
  async pull(request: { dir: string; remote: string; branch: string; strategy?: "merge" | "rebase" }): Promise<GitResult<PullOutcome>> {
    const cwd = resolve(request.dir);
    const args = request.strategy === "rebase"
      ? ["pull", "--rebase", request.remote, request.branch]
      : ["pull", "--no-rebase", request.remote, request.branch];
    const run = await this.cli.run(args, { cwd, timeoutMs: 120000 });
    const combined = `${run.stdout}\n${run.stderr}`.trim();
    if (run.code === 0) {
      if (/Already up to date|Already up-to-date/i.test(combined)) {
        return { ok: true, value: { pulled: false, kind: "already-up-to-date" } };
      }
      const hashRun = await this.cli.run(["rev-parse", "HEAD"], { cwd });
      return {
        ok: true,
        value: {
          pulled: true,
          kind: "merge",
          ...(hashRun.code === 0 ? { hash: hashRun.stdout.trim() } : {})
        }
      };
    }
    if (/CONFLICT|Automatic merge failed|conflict/i.test(combined)) {
      const conflictRun = await this.cli.run(["diff", "--name-only", "--diff-filter=U"], { cwd });
      const conflicts = conflictRun.code === 0
        ? conflictRun.stdout.trim().split("\n").filter(Boolean)
        : [];
      return { ok: true, value: { pulled: false, kind: "conflicts", conflicts } };
    }
    if (/Your local changes|would be overwritten|local changes/i.test(combined)) {
      return { ok: false, error: fail("dirty", "有未提交改动，请先提交或暂存") };
    }
    return {
      ok: false,
      error: fail("pull-failed", "拉取失败：" + (combined.split("\n").filter(Boolean).slice(-2).join("；") || "未知错误"))
    };
  }

  // ── config ────────────────────────────────────────────────────────────────

  /** Pick the first existing candidate path (or the first one when none exists). */
  private pickConfigPath(candidates: string[]): string {
    for (const candidate of candidates) {
      if (candidate !== "" && existsSync(candidate)) return candidate;
    }
    return candidates[0] ?? "";
  }

  /** List git config for one scope (system / global / local), plus the real
   *  config-file path of every scope (git var / rev-parse, for display). */
  async configList(request: {
    dir: string;
    scope: "system" | "global" | "local";
  }): Promise<GitResult<{
    entries: Array<{ key: string; value: string }>;
    configFiles: { system: string; global: string; local: string };
  }>> {
    const cwd = resolve(request.dir);
    const [run, sysRun, globRun, gitDirRun] = await Promise.all([
      this.cli.run(["config", "--" + request.scope, "--list"], { cwd }),
      this.cli.run(["var", "GIT_CONFIG_SYSTEM"], { cwd }),
      this.cli.run(["var", "GIT_CONFIG_GLOBAL"], { cwd }),
      this.cli.run(["rev-parse", "--git-dir"], { cwd })
    ]);
    if (run.code !== 0) {
      return { ok: false, error: fail("git-error", "读取配置失败") };
    }
    const entries: Array<{ key: string; value: string }> = [];
    for (const line of run.stdout.split("\n")) {
      const trimmed = line.replace(/\r$/, "");
      if (trimmed === "") continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      entries.push({ key: trimmed.slice(0, eq), value: trimmed.slice(eq + 1) });
    }
    const system = sysRun.code === 0 ? this.pickConfigPath(sysRun.stdout.trim().split(/\r?\n/)) : "";
    const global = globRun.code === 0 ? this.pickConfigPath(globRun.stdout.trim().split(/\r?\n/)) : "";
    const gitDir = gitDirRun.code === 0 ? gitDirRun.stdout.trim() : "";
    const local =
      gitDir === ""
        ? ""
        : isAbsolute(gitDir)
          ? join(gitDir, "config")
          : resolve(cwd, gitDir, "config");
    return { ok: true, value: { entries, configFiles: { system, global, local } } };
  }

  /** Set a git config key in one scope (creates it when missing). */
  async configSet(request: {
    dir: string;
    scope: "system" | "global" | "local";
    key: string;
    value: string;
  }): Promise<GitResult<{ key: string; value: string }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["config", "--" + request.scope, request.key, request.value], { cwd });
    if (run.code !== 0) {
      const hint =
        request.scope === "system"
          ? "（系统级配置通常需要管理员权限，可改用用户级）"
          : "";
      return { ok: false, error: fail("git-error", "写入配置失败" + hint) };
    }
    return { ok: true, value: { key: request.key, value: request.value } };
  }

  /** Remove a git config key from one scope. */
  async configUnset(request: {
    dir: string;
    scope: "system" | "global" | "local";
    key: string;
  }): Promise<GitResult<{ key: string }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["config", "--" + request.scope, "--unset", request.key], { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("git-error", "删除配置失败") };
    }
    return { ok: true, value: { key: request.key } };
  }

  // ── remote branch pull ────────────────────────────────────────────────────

  /**
   * Check out the local counterpart of a remote branch and pull it.
   * remoteRef like "remotes/origin/main" → local branch "main", remote "origin".
   * When the local branch already exists it is checked out (tracking
   * unchanged); otherwise it is created from the remote ref. Then the
   * branch is pulled with the merge strategy.
   */
  async pullRemoteBranch(request: { dir: string; remoteRef: string }): Promise<GitResult<{ branch: string; pulled: boolean }>> {
    const cwd = resolve(request.dir);
    const parts = request.remoteRef.split("/");
    // "remotes/<remote>/<branch...>" — branch name may contain slashes.
    if (parts.length < 3 || parts[0] !== "remotes") {
      return { ok: false, error: fail("invalid-ref", "无效的远程分支引用：" + request.remoteRef) };
    }
    const remote = parts[1] ?? "";
    const branch = parts.slice(2).join("/");
    if (remote === "" || branch === "") {
      return { ok: false, error: fail("invalid-ref", "无效的远程分支引用：" + request.remoteRef) };
    }

    // Does the local branch already exist?
    const existsRun = await this.cli.run(["rev-parse", "--verify", "--quiet", "refs/heads/" + branch], { cwd });
    const exists = existsRun.code === 0;

    // Fetch first so the remote ref is current.
    const fetchRun = await this.cli.run(["fetch", remote], { cwd, timeoutMs: 120000 });
    if (fetchRun.code !== 0) {
      return { ok: false, error: fail("fetch-failed", "抓取失败：" + fetchRun.stderr.trim()) };
    }

    if (exists) {
      const co = await this.cli.run(["checkout", branch], { cwd });
      if (co.code !== 0) {
        return { ok: false, error: fail("checkout-failed", "切换分支失败：" + co.stderr.trim()) };
      }
    } else {
      const co = await this.cli.run(["checkout", "-b", branch, request.remoteRef], { cwd });
      if (co.code !== 0) {
        return { ok: false, error: fail("checkout-failed", "创建分支失败：" + co.stderr.trim()) };
      }
    }

    // Pull the local branch from the remote (merge strategy).
    const pullRun = await this.cli.run(["pull", "--no-rebase", remote, branch], { cwd, timeoutMs: 120000 });
    const combined = `${pullRun.stdout}\n${pullRun.stderr}`.trim();
    if (pullRun.code !== 0) {
      if (/CONFLICT|Automatic merge failed|conflict/i.test(combined)) {
        return { ok: true, value: { branch, pulled: true } };
      }
      return { ok: false, error: fail("pull-failed", "拉取失败：" + (combined.split("\n").filter(Boolean).slice(-2).join("；") || "未知错误")) };
    }
    return { ok: true, value: { branch, pulled: true } };
  }

  // ── stash ─────────────────────────────────────────────────────────────────

  async stashList(request: { dir: string }): Promise<GitResult<{ stashes: StashEntry[] }>> {
    const cwd = resolve(request.dir);
    // %gd = stash@{n}, %gs = message, %ci = committer (stash) date.
    const run = await this.cli.run(["stash", "list", "--format=%gd|%gs|%ci"], { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("not-a-repo", "不是 Git 仓库") };
    }
    const stashes: StashEntry[] = [];
    for (const line of run.stdout.split("\n")) {
      if (line === "") continue;
      const [gd = "", gs = "", ci = ""] = line.split("|");
      const match = /^stash@\{(\d+)\}$/.exec(gd);
      if (match === null) continue;
      stashes.push({ index: Number(match[1]), message: gs, date: ci.trim() });
    }
    return { ok: true, value: { stashes } };
  }

  async stashPush(request: { dir: string; message?: string; includeUntracked?: boolean }): Promise<GitResult<{ stashed: boolean; message?: string }>> {
    const cwd = resolve(request.dir);
    const args = ["stash", "push", "-m", request.message?.trim() || "stash"];
    if (request.includeUntracked === true) args.push("-u");
    const run = await this.cli.run(args, { cwd });
    const combined = `${run.stdout}\n${run.stderr}`.trim();
    // git exits 0 with "No local changes to save" when there is nothing to stash.
    if (/No local changes|nothing to stash/i.test(combined)) {
      return { ok: true, value: { stashed: false, message: "没有可暂存的改动" } };
    }
    if (run.code !== 0) {
      return { ok: false, error: fail("stash-failed", combined || "暂存改动失败") };
    }
    return { ok: true, value: { stashed: true } };
  }

  async stashPop(request: { dir: string; index?: number }): Promise<GitResult<{ popped: boolean; conflicts?: string[]; message?: string }>> {
    const cwd = resolve(request.dir);
    const args = request.index !== undefined ? ["stash", "pop", `stash@{${request.index}}`] : ["stash", "pop"];
    const run = await this.cli.run(args, { cwd });
    const combined = `${run.stdout}\n${run.stderr}`.trim();
    if (run.code === 0) {
      return { ok: true, value: { popped: true } };
    }
    if (/CONFLICT|conflict/i.test(combined)) {
      const conflictRun = await this.cli.run(["diff", "--name-only", "--diff-filter=U"], { cwd });
      const conflicts = conflictRun.code === 0
        ? conflictRun.stdout.trim().split("\n").filter(Boolean)
        : [];
      return { ok: true, value: { popped: false, conflicts } };
    }
    return {
      ok: false,
      error: fail("stash-pop-failed", combined.split("\n").filter(Boolean).slice(-2).join("；") || "恢复暂存失败")
    };
  }

  async stashDrop(request: { dir: string; index?: number }): Promise<GitResult<{ dropped: boolean }>> {
    const cwd = resolve(request.dir);
    const args = request.index !== undefined ? ["stash", "drop", `stash@{${request.index}}`] : ["stash", "drop"];
    const run = await this.cli.run(args, { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("stash-drop-failed", run.stderr.trim() || "删除暂存失败") };
    }
    return { ok: true, value: { dropped: true } };
  }

  async stashApply(request: { dir: string; index?: number }): Promise<GitResult<{ applied: boolean; conflicts?: string[]; message?: string }>> {
    const cwd = resolve(request.dir);
    const target = request.index !== undefined ? "stash@{" + request.index + "}" : undefined;
    const args = target !== undefined ? ["stash", "apply", target] : ["stash", "apply"];
    const run = await this.cli.run(args, { cwd });
    const combined = (run.stdout + "\n" + run.stderr).trim();
    if (run.code === 0) {
      return { ok: true, value: { applied: true } };
    }
    if (/CONFLICT|conflict/i.test(combined)) {
      const conflictRun = await this.cli.run(["diff", "--name-only", "--diff-filter=U"], { cwd });
      const conflicts = conflictRun.code === 0
        ? conflictRun.stdout.trim().split("\n").filter(Boolean)
        : [];
      return { ok: true, value: { applied: false, conflicts } };
    }
    return {
      ok: false,
      error: fail("stash-apply-failed", combined.split("\n").filter(Boolean).slice(-2).join("；") || "应用暂存失败")
    };
  }

  async stashClear(request: { dir: string }): Promise<GitResult<{ cleared: boolean }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["stash", "clear"], { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("stash-clear-failed", run.stderr.trim() || "清空暂存失败") };
    }
    return { ok: true, value: { cleared: true } };
  }

  /** File-level summary of one stash (git stash show output lines). */
  async stashShow(request: { dir: string; index: number }): Promise<GitResult<{ lines: string[] }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["stash", "show", "stash@{" + request.index + "}"], { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("stash-show-failed", run.stderr.trim() || "查看暂存失败") };
    }
    const lines = run.stdout.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");
    return { ok: true, value: { lines } };
  }

  /** Create a branch from a stash and drop it (git stash branch). */
  async stashBranch(request: { dir: string; index: number; name: string }): Promise<GitResult<{ branch: string }>> {
    const cwd = resolve(request.dir);
    const name = request.name.trim();
    if (name === "") return { ok: false, error: fail("invalid-name", "分支名称无效") };
    const run = await this.cli.run(["stash", "branch", name, "stash@{" + request.index + "}"], { cwd });
    if (run.code !== 0) {
      const combined = (run.stdout + "\n" + run.stderr).trim();
      if (/CONFLICT|conflict/i.test(combined)) {
        return { ok: false, error: fail("stash-branch-conflicts", "创建分支时产生冲突，请到「合并」页解决") };
      }
      return { ok: false, error: fail("stash-branch-failed", combined.split("\n").filter(Boolean).slice(-2).join("；") || "创建分支失败") };
    }
    return { ok: true, value: { branch: name } };
  }


  // ── cherry-pick / revert / reset ──────────────────────────────────────────

  async cherryPick(request: { dir: string; hash: string | string[] }): Promise<GitResult<OperationOutcome>> {
    const cwd = resolve(request.dir);
    const hashes = Array.isArray(request.hash) ? request.hash : [request.hash];
    const run = await this.cli.run(["cherry-pick", ...hashes], { cwd });
    const combined = `${run.stdout}\n${run.stderr}`.trim();
    // git may exit 0 with "nothing to commit" when the patch is already applied.
    if (/empty|already applied|nothing to commit|skipped/i.test(combined)) {
      return { ok: false, error: fail("already-applied", "该提交为空或已应用") };
    }
    if (run.code === 0) {
      return { ok: true, value: { done: true } };
    }
    if (/CONFLICT|conflict/i.test(combined)) {
      const conflictRun = await this.cli.run(["diff", "--name-only", "--diff-filter=U"], { cwd });
      const conflicts = conflictRun.code === 0
        ? conflictRun.stdout.trim().split("\n").filter(Boolean)
        : [];
      return { ok: true, value: { done: false, conflicts } };
    }
    return {
      ok: false,
      error: fail("cherry-pick-failed", combined.split("\n").filter(Boolean).slice(-2).join("；") || "cherry-pick 失败")
    };
  }

  async revert(request: { dir: string; hash: string | string[] }): Promise<GitResult<OperationOutcome>> {
    const cwd = resolve(request.dir);
    const hashes = Array.isArray(request.hash) ? request.hash : [request.hash];
    const run = await this.cli.run(["revert", "--no-edit", ...hashes], { cwd });
    const combined = `${run.stdout}\n${run.stderr}`.trim();
    if (run.code === 0) {
      return { ok: true, value: { done: true } };
    }
    if (/CONFLICT|conflict/i.test(combined)) {
      const conflictRun = await this.cli.run(["diff", "--name-only", "--diff-filter=U"], { cwd });
      const conflicts = conflictRun.code === 0
        ? conflictRun.stdout.trim().split("\n").filter(Boolean)
        : [];
      return { ok: true, value: { done: false, conflicts } };
    }
    return {
      ok: false,
      error: fail("revert-failed", combined.split("\n").filter(Boolean).slice(-2).join("；") || "revert 失败")
    };
  }

  /**
   * Squash the given commits (oldest first) into a single commit.
   * The run must be a contiguous chain ending at HEAD (the top of the current
   * branch) and the worktree must be clean; implemented via `git reset --soft` + a single commit.
   */
  async squashCommits(request: { dir: string; hashes: string[]; message: string }): Promise<GitResult<{ hash: string; short: string }>> {
    const cwd = resolve(request.dir);
    const hashes = [...request.hashes];
    if (hashes.length < 2) {
      return { ok: false, error: fail("squash-needs-two", "至少需要两个提交才能 squash") };
    }
    const headRun = await this.cli.run(["rev-parse", "HEAD"], { cwd });
    const head = headRun.stdout.trim();
    if (headRun.code !== 0 || head === "") {
      return { ok: false, error: fail("not-a-repo", "不是 Git 仓库") };
    }
    // The newest selected commit must be HEAD.
    if (hashes[hashes.length - 1] !== head) {
      return { ok: false, error: fail("squash-not-head", "只能 squash 当前分支顶部的连续提交") };
    }
    // Every selected commit must be the parent of the next one (contiguous chain).
    for (let i = hashes.length - 1; i > 0; i--) {
      const parentRun = await this.cli.run(["rev-parse", hashes[i] + "^"], { cwd });
      if (parentRun.code !== 0 || parentRun.stdout.trim() !== hashes[i - 1]) {
        return { ok: false, error: fail("squash-not-contiguous", "所选提交不是当前分支顶部的连续提交，无法 squash") };
      }
    }
    // A clean worktree keeps the squashed index limited to the selected commits.
    const dirty = await this.cli.run(["status", "--porcelain"], { cwd });
    if (dirty.code === 0 && dirty.stdout.trim() !== "") {
      return { ok: false, error: fail("dirty", "有未提交改动，请先提交或暂存") };
    }
    const base = hashes[0] + "^";
    const resetRun = await this.cli.run(["reset", "--soft", base], { cwd });
    if (resetRun.code !== 0) {
      return { ok: false, error: fail("squash-failed", "squash 失败：" + (resetRun.stderr.trim() || "reset 失败")) };
    }
    const msg = request.message.trim() !== "" ? request.message.trim() : "Squash " + hashes.length + " commits";
    const commitRun = await this.cli.run(["-c", "core.editor=true", "commit", "-m", msg], { cwd });
    if (commitRun.code !== 0) {
      return { ok: false, error: fail("squash-failed", "squash 提交失败：" + (commitRun.stderr.trim() || "commit 失败")) };
    }
    const hashRun = await this.cli.run(["rev-parse", "HEAD"], { cwd });
    const hash = hashRun.stdout.trim();
    return { ok: true, value: { hash, short: hash.length >= 7 ? hash.slice(0, 7) : hash } };
  }

  async reset(request: { dir: string; mode: "soft" | "mixed" | "hard"; ref?: string }): Promise<GitResult<{ reset: boolean; mode: string }>> {
    const cwd = resolve(request.dir);
    const args = ["reset", `--${request.mode}`, ...(request.ref !== undefined ? [request.ref] : ["HEAD"])];
    const run = await this.cli.run(args, { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("reset-failed", run.stderr.trim() || "重置失败") };
    }
    return { ok: true, value: { reset: true, mode: request.mode } };
  }

  /** Abort the in-progress operation (merge / rebase / cherry-pick / revert). */
  async operationAbort(request: { dir: string }): Promise<GitResult<{ aborted: boolean }>> {
    const cwd = resolve(request.dir);
    const state = await this.gitDirState(cwd);
    const cmd = state === "merge" ? ["merge", "--abort"]
      : state === "rebase" ? ["rebase", "--abort"]
      : state === "cherry-pick" ? ["cherry-pick", "--abort"]
      : state === "revert" ? ["revert", "--abort"]
      : null;
    if (cmd === null) {
      return { ok: false, error: fail("nothing-in-progress", "没有进行中的操作") };
    }
    const run = await this.cli.run(cmd, { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("abort-failed", run.stderr.trim() || "中止操作失败") };
    }
    return { ok: true, value: { aborted: true } };
  }

  /** Continue the in-progress operation after conflicts are resolved. */
  async operationContinue(request: { dir: string; message?: string }): Promise<GitResult<{ continued: boolean; hash?: string }>> {
    const cwd = resolve(request.dir);
    const state = await this.gitDirState(cwd);
    if (state === "merge") {
      const result = await this.mergeCommit({ dir: request.dir, message: request.message });
      if (!result.ok) return result;
      return { ok: true, value: { continued: true, hash: result.value.hash } };
    }
    const cmd = state === "rebase" ? ["-c", "core.editor=true", "rebase", "--continue"]
      : state === "cherry-pick" ? ["-c", "core.editor=true", "cherry-pick", "--continue"]
      : state === "revert" ? ["-c", "core.editor=true", "revert", "--continue"]
      : null;
    if (cmd === null) {
      return { ok: false, error: fail("nothing-in-progress", "没有进行中的操作") };
    }
    const run = await this.cli.run(cmd, { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("continue-failed", run.stderr.trim() || "继续操作失败") };
    }
    const hashRun = await this.cli.run(["rev-parse", "HEAD"], { cwd });
    return {
      ok: true,
      value: {
        continued: true,
        ...(hashRun.code === 0 ? { hash: hashRun.stdout.trim() } : {})
      }
    };
  }

  // ── changelists ────────────────────────────────────────────────────────────
  // IDEA-style named change lists. Membership lives in <gitdir>/dsh/
  // changelists.json (per-repo, never committed), mirroring IDEA's
  // .idea/workspace.xml. Files not listed anywhere are shown under the ACTIVE
  // changelist while they have changes (virtual membership, not persisted).

  /** Absolute path of <gitdir>/dsh/changelists.json, or null outside a repo. */
  private async changelistFile(cwd: string): Promise<string | null> {
    const gitDirRun = await this.cli.run(["rev-parse", "--git-dir"], { cwd });
    if (gitDirRun.code !== 0) return null;
    const gitDir = isAbsolute(gitDirRun.stdout.trim())
      ? gitDirRun.stdout.trim()
      : resolve(cwd, gitDirRun.stdout.trim());
    return join(gitDir, "dsh", "changelists.json");
  }

  private async readChangelists(cwd: string): Promise<{
    active: string;
    changelists: Record<string, string[]>;
  }> {
    const file = await this.changelistFile(cwd);
    if (file !== null && existsSync(file)) {
      try {
        const parsed = JSON.parse(readFileSync(file, "utf8")) as {
          active?: string;
          changelists?: Record<string, string[]>;
        };
        const changelists: Record<string, string[]> = {
          Default: [],
          ...(parsed.changelists ?? {})
        };
        if (changelists["Default"] === undefined) changelists["Default"] = [];
        const active = parsed.active ?? "Default";
        return { active: changelists[active] !== undefined ? active : "Default", changelists };
      } catch {
        /* corrupt file — fall through to defaults */
      }
    }
    return { active: "Default", changelists: { Default: [] } };
  }

  private async writeChangelists(
    cwd: string,
    data: { active: string; changelists: Record<string, string[]> }
  ): Promise<GitResult<true>> {
    const file = await this.changelistFile(cwd);
    if (file === null) return { ok: false, error: fail("not-a-repo", "不是 Git 仓库") };
    try {
      mkdirSync(dirname(file), { recursive: true });
      const tmp = file + ".tmp";
      writeFileSync(tmp, JSON.stringify({ version: 1, ...data }, null, 2), "utf8");
      renameSync(tmp, file);
    } catch (caught) {
      return { ok: false, error: fail("write-failed", "写入变更列表失败：" + String((caught as Error).message).slice(0, 160)) };
    }
    return { ok: true, value: true };
  }

  async changelistList(request: { dir: string }): Promise<GitResult<{ changelists: ChangelistEntry[]; active: string }>> {
    const cwd = resolve(request.dir);
    const data = await this.readChangelists(cwd);
    const entries: ChangelistEntry[] = Object.entries(data.changelists)
      .map(([name, paths]) => ({ name, paths: [...paths].sort() }))
      .sort((a, b) => (a.name === "Default" ? -1 : b.name === "Default" ? 1 : a.name.localeCompare(b.name)));
    return { ok: true, value: { changelists: entries, active: data.active } };
  }

  async changelistCreate(request: { dir: string; name: string }): Promise<GitResult<{ name: string }>> {
    const cwd = resolve(request.dir);
    const name = request.name.trim();
    if (name === "" || name.length > 64) {
      return { ok: false, error: fail("invalid-name", "变更列表名称无效") };
    }
    const data = await this.readChangelists(cwd);
    if (data.changelists[name] !== undefined) {
      return { ok: false, error: fail("exists", "同名变更列表已存在") };
    }
    data.changelists[name] = [];
    const written = await this.writeChangelists(cwd, data);
    if (!written.ok) return written;
    return { ok: true, value: { name } };
  }

  async changelistRename(request: { dir: string; oldName: string; newName: string }): Promise<GitResult<{ name: string }>> {
    const cwd = resolve(request.dir);
    const oldName = request.oldName.trim();
    const newName = request.newName.trim();
    if (oldName === "Default" || newName === "" || newName.length > 64 || newName === "Default") {
      return { ok: false, error: fail("invalid-name", "变更列表名称无效") };
    }
    const data = await this.readChangelists(cwd);
    if (data.changelists[oldName] === undefined) {
      return { ok: false, error: fail("not-found", "变更列表不存在") };
    }
    if (data.changelists[newName] !== undefined) {
      return { ok: false, error: fail("exists", "同名变更列表已存在") };
    }
    data.changelists[newName] = data.changelists[oldName] as string[];
    delete data.changelists[oldName];
    if (data.active === oldName) data.active = newName;
    const written = await this.writeChangelists(cwd, data);
    if (!written.ok) return written;
    return { ok: true, value: { name: newName } };
  }

  async changelistDelete(request: { dir: string; name: string }): Promise<GitResult<{ name: string }>> {
    const cwd = resolve(request.dir);
    const name = request.name.trim();
    if (name === "Default") {
      return { ok: false, error: fail("default", "不能删除默认变更列表") };
    }
    const data = await this.readChangelists(cwd);
    if (data.changelists[name] === undefined) {
      return { ok: false, error: fail("not-found", "变更列表不存在") };
    }
    delete data.changelists[name];
    if (data.active === name) data.active = "Default";
    const written = await this.writeChangelists(cwd, data);
    if (!written.ok) return written;
    return { ok: true, value: { name } };
  }

  async changelistMove(request: { dir: string; paths: string[]; to: string }): Promise<GitResult<{ moved: number }>> {
    const cwd = resolve(request.dir);
    const to = request.to.trim();
    const data = await this.readChangelists(cwd);
    if (data.changelists[to] === undefined) {
      return { ok: false, error: fail("not-found", "目标变更列表不存在") };
    }
    const wanted = new Set(request.paths);
    // Remove the paths from every list, then add them to the target.
    for (const key of Object.keys(data.changelists)) {
      const paths = data.changelists[key] as string[];
      const kept = paths.filter((p) => !wanted.has(p));
      if (kept.length !== paths.length) data.changelists[key] = kept;
    }
    const target = data.changelists[to] as string[];
    let moved = 0;
    for (const p of request.paths) {
      if (!target.includes(p)) {
        target.push(p);
        moved++;
      }
    }
    const written = await this.writeChangelists(cwd, data);
    if (!written.ok) return written;
    return { ok: true, value: { moved } };
  }

  async changelistSetActive(request: { dir: string; name: string }): Promise<GitResult<{ active: string }>> {
    const cwd = resolve(request.dir);
    const name = request.name.trim();
    const data = await this.readChangelists(cwd);
    if (data.changelists[name] === undefined) {
      return { ok: false, error: fail("not-found", "变更列表不存在") };
    }
    data.active = name;
    const written = await this.writeChangelists(cwd, data);
    if (!written.ok) return written;
    return { ok: true, value: { active: name } };
  }

  // ── ignore ─────────────────────────────────────────────────────────────────

  /** Append a path to .gitignore (repo root) or .git/info/exclude. */
  async ignoreAdd(request: { dir: string; path: string; target: "gitignore" | "exclude" }): Promise<GitResult<{ path: string; target: string }>> {
    const cwd = resolve(request.dir);
    const probe = await this.cli.run(["rev-parse", "--show-toplevel"], { cwd });
    if (probe.code !== 0) {
      return { ok: false, error: fail("not-a-repo", "不是 Git 仓库") };
    }
    const root = probe.stdout.trim();
    const file = request.target === "exclude"
      ? join(root, ".git", "info", "exclude")
      : join(root, ".gitignore");
    const normalized = request.path.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalized === "") {
      return { ok: false, error: fail("invalid-path", "路径无效") };
    }
    // A directory gets the canonical `dir/` pattern (matches directories only,
    // never an identically named file); a plain path stays as-is. Deleted
    // entries fall back to the plain form.
    let entry = normalized;
    try {
      if (statSync(join(root, normalized)).isDirectory()) entry += "/";
    } catch {
      // path no longer exists on disk — keep the plain form
    }
    try {
      const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
      const lines = existing.split(/\r?\n/).map((l) => l.trim());
      if (lines.includes(entry) || lines.includes(normalized)) {
        return { ok: true, value: { path: file, target: request.target } };
      }
      const addition = (existing === "" || existing.endsWith("\n") ? existing : existing + "\n") + entry + "\n";
      writeFileSync(file, addition, "utf8");
    } catch (caught) {
      return { ok: false, error: fail("write-failed", "写入忽略规则失败：" + String((caught as Error).message).slice(0, 160)) };
    }
    return { ok: true, value: { path: file, target: request.target } };
  }

  // ── push preview ───────────────────────────────────────────────────────────

  /** Commits that a push would send, for the Push dialog. */
  async pushPreview(request: { dir: string; remote: string; branch: string }): Promise<GitResult<{ upstream: string | null; ahead: CommitInfo[] }>> {
    const cwd = resolve(request.dir);
    const upstreamRun = await this.cli.run(["rev-parse", "--abbrev-ref", request.branch + "@{upstream}"], { cwd });
    const upstream = upstreamRun.code === 0 && upstreamRun.stdout.trim() !== "" ? upstreamRun.stdout.trim() : null;
    const format = ["%h", "%H", "%s", "%an", "%at", "%D"].join("%x1f");
    const run = upstream !== null
      ? await this.cli.run(["log", "--pretty=format:" + format, upstream + ".." + request.branch], { cwd })
      : await this.cli.run(["log", "--pretty=format:" + format, request.branch, "--not", "--remotes=" + request.remote], { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("git-error", "获取推送预览失败：" + run.stderr.trim().slice(0, 160)) };
    }
    return { ok: true, value: { upstream, ahead: this.parseCommitLines(run.stdout) } };
  }

  // ── interactive rebase ─────────────────────────────────────────────────────

  private async rebaseGitDir(cwd: string): Promise<string | null> {
    const gitDirRun = await this.cli.run(["rev-parse", "--git-dir"], { cwd });
    if (gitDirRun.code !== 0) return null;
    const gitDir = isAbsolute(gitDirRun.stdout.trim())
      ? gitDirRun.stdout.trim()
      : resolve(cwd, gitDirRun.stdout.trim());
    return gitDir;
  }

  /** Write the static editor helpers into <gitdir>/dsh (idempotent). */
  private async ensureRebaseEditors(gitDir: string): Promise<GitResult<true>> {
    try {
      const dshDir = join(gitDir, "dsh");
      mkdirSync(dshDir, { recursive: true });
      writeFileSync(join(dshDir, "seq-editor.mjs"), SEQ_EDITOR_MJS, "utf8");
      writeFileSync(join(dshDir, "msg-editor.mjs"), MSG_EDITOR_MJS, "utf8");
    } catch (caught) {
      return { ok: false, error: fail("write-failed", "写入 rebase 辅助脚本失败：" + String((caught as Error).message).slice(0, 160)) };
    }
    return { ok: true, value: true };
  }

  private async rebaseCommits(cwd: string, base: string): Promise<CommitInfo[]> {
    const format = ["%h", "%H", "%s", "%an", "%at", "%D"].join("%x1f");
    const run = await this.cli.run(["log", "--reverse", "--pretty=format:" + format, base + "..HEAD"], { cwd });
    if (run.code !== 0) return [];
    return this.parseCommitLines(run.stdout);
  }

  /** The commits a rebase would rewrite, plus a sensible default base. */
  async rebaseList(request: { dir: string; base?: string }): Promise<GitResult<{ base: string; commits: CommitInfo[] }>> {
    const cwd = resolve(request.dir);
    const hint = request.base?.trim() ?? "";
    let base: string | null = hint !== "" ? hint : null;
    const branchRun = await this.cli.run(["symbolic-ref", "--short", "HEAD"], { cwd });
    const branch = branchRun.code === 0 ? branchRun.stdout.trim() : "";
    if (base === null && branch !== "") {
      const upstreamRun = await this.cli.run(["rev-parse", "--abbrev-ref", branch + "@{upstream}"], { cwd });
      if (upstreamRun.code === 0 && upstreamRun.stdout.trim() !== "") {
        base = upstreamRun.stdout.trim();
      }
    }
    if (base === null) {
      for (const candidate of ["main", "master"]) {
        const probe = await this.cli.run(["rev-parse", "--verify", "--quiet", "refs/heads/" + candidate], { cwd });
        if (probe.code === 0) {
          base = candidate;
          break;
        }
      }
    }
    if (base === null) {
      return { ok: false, error: fail("no-base", "无法确定基准分支（无上游且无 main/master），请手动选择") };
    }
    const commits = await this.rebaseCommits(cwd, base);
    return { ok: true, value: { base, commits } };
  }

  /**
   * Start an interactive rebase with a fully planned todo. The plan is handed
   * to git through two helper scripts in <gitdir>/dsh: the sequence editor
   * overwrites git's generated todo, and the commit-message editor pops
   * reword/squash messages from a queue in todo order.
   */
  async rebaseStart(request: { dir: string; base: string; items: RebaseItem[] }): Promise<
    GitResult<{ started: boolean; conflicts?: string[]; message?: string }>
  > {
    const cwd = resolve(request.dir);
    const state = await this.gitDirState(cwd);
    if (state !== "clean") {
      return { ok: false, error: fail("op-in-progress", "已有进行中的操作，请先完成或中止") };
    }
    const dirty = await this.cli.run(["status", "--porcelain"], { cwd });
    if (dirty.code === 0 && dirty.stdout.trim() !== "") {
      return { ok: false, error: fail("dirty", "有未提交改动，请先提交或暂存") };
    }
    const baseOk = await this.cli.run(["rev-parse", "--verify", "--quiet", request.base + "^{commit}"], { cwd });
    if (baseOk.code !== 0) {
      return { ok: false, error: fail("bad-base", "基准引用不存在") };
    }
    const commits = await this.rebaseCommits(cwd, request.base);
    if (commits.length === 0) {
      return { ok: false, error: fail("nothing-to-rebase", "基准与 HEAD 之间没有提交") };
    }
    if (
      request.items.length !== commits.length ||
      request.items.some((item, index) => item.hash !== (commits[index]?.hash ?? ""))
    ) {
      return { ok: false, error: fail("todo-mismatch", "提交列表与基准不一致，请刷新后重试") };
    }
    const gitDir = await this.rebaseGitDir(cwd);
    if (gitDir === null) {
      return { ok: false, error: fail("not-a-repo", "不是 Git 仓库") };
    }
    const editors = await this.ensureRebaseEditors(gitDir);
    if (!editors.ok) return editors;

    // Build the todo + the reword/squash message queue (invocation order).
    const todo: string[] = [];
    const msgQueue: string[] = [];
    for (let i = 0; i < request.items.length; i++) {
      const item = request.items[i] as RebaseItem;
      const subject = commits[i]?.subject ?? "";
      let action = item.action;
      if (action === "squash" && (item.message === undefined || item.message.trim() === "")) {
        // No custom message: keep the first commit's message (fixup).
        action = "fixup";
      }
      // git cannot squash/fixup the FIRST todo item (there is no previous
      // commit to fold into) — degrade to reword with its own message.
      if (i === 0 && (action === "squash" || action === "fixup")) {
        action = "reword";
      }
      if (action === "reword") {
        msgQueue.push(item.message !== undefined && item.message.trim() !== "" ? item.message.trim() : subject);
      } else if (action === "squash") {
        msgQueue.push((item.message ?? "").trim());
      }
      todo.push(`${action} ${item.hash}`);
    }
    const dshDir = join(gitDir, "dsh");
    try {
      writeFileSync(join(dshDir, "todo-plan.json"), JSON.stringify({ todo }), "utf8");
      writeFileSync(join(dshDir, "msg-queue.json"), JSON.stringify(msgQueue), "utf8");
    } catch (caught) {
      return { ok: false, error: fail("write-failed", "写入 rebase 计划失败：" + String((caught as Error).message).slice(0, 160)) };
    }
    // Forward slashes keep the paths sh-friendly for git's editor invocation.
    const seqEditor = `node "${join(dshDir, "seq-editor.mjs").replace(/\\/g, "/")}"`;
    const msgEditor = `node "${join(dshDir, "msg-editor.mjs").replace(/\\/g, "/")}"`;
    const run = await this.cli.run(
      ["-c", "sequence.editor=" + seqEditor, "-c", "core.editor=" + msgEditor, "rebase", "-i", request.base],
      { cwd, timeoutMs: 120000 }
    );
    const combined = `${run.stdout}\n${run.stderr}`.trim();
    if (run.code === 0) {
      return { ok: true, value: { started: true } };
    }
    if (/CONFLICT|conflict|error: could not apply/i.test(combined)) {
      const conflictRun = await this.cli.run(["diff", "--name-only", "--diff-filter=U"], { cwd });
      const conflicts = conflictRun.code === 0
        ? conflictRun.stdout.trim().split("\n").filter(Boolean)
        : [];
      return { ok: true, value: { started: true, conflicts } };
    }
    return {
      ok: false,
      error: fail("rebase-failed", "rebase 失败：" + (combined.split("\n").filter(Boolean).slice(-2).join("；") || "未知错误"))
    };
  }

  /** Skip the current commit during an interactive rebase (conflict case). */
  async operationSkip(request: { dir: string }): Promise<GitResult<{ skipped: boolean; conflicts?: string[] }>> {
    const cwd = resolve(request.dir);
    const state = await this.gitDirState(cwd);
    if (state !== "rebase") {
      return { ok: false, error: fail("not-rebasing", "没有进行中的 rebase") };
    }
    const run = await this.cli.run(["rebase", "--skip"], { cwd });
    if (run.code === 0) {
      return { ok: true, value: { skipped: true } };
    }
    if (/CONFLICT|conflict/i.test(`${run.stdout}\n${run.stderr}`)) {
      const conflictRun = await this.cli.run(["diff", "--name-only", "--diff-filter=U"], { cwd });
      const conflicts = conflictRun.code === 0
        ? conflictRun.stdout.trim().split("\n").filter(Boolean)
        : [];
      return { ok: true, value: { skipped: false, conflicts } };
    }
    return { ok: false, error: fail("skip-failed", run.stderr.trim() || "跳过提交失败") };
  }

  // ── diff with working tree ─────────────────────────────────────────────────

  /** Full diff between a commit and the current working tree. */
  async diffWithWorktree(request: { dir: string; hash: string; path?: string }): Promise<GitResult<{ files: DiffFile[] }>> {
    const cwd = resolve(request.dir);
    const args = ["-c", "core.quotePath=false", "diff", "--no-color", "--unified=3", request.hash];
    if (request.path !== undefined) args.push("--", request.path);
    const run = await this.cli.run(args, { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("hash-not-found", "提交不存在") };
    }
    return { ok: true, value: { files: parseUnifiedDiff(run.stdout, { path: request.path }) } };
  }

  // ── tags ──────────────────────────────────────────────────────────────────

  async tags(request: { dir: string }): Promise<GitResult<{ tags: TagInfo[] }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["tag", "--list", "--format=%(refname:short)%00%(objectname:short)%00%(subject)"], { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("not-a-repo", "不是 Git 仓库") };
    }
    const tags: TagInfo[] = [];
    for (const line of run.stdout.split("\n")) {
      if (line === "") continue;
      const [name = "", hash = "", subject = ""] = line.split("\0");
      if (name === "") continue;
      tags.push({ name, hash, short: hash.slice(0, 7), ...(subject !== "" ? { subject } : {}) });
    }
    return { ok: true, value: { tags } };
  }

  async tagCreate(request: { dir: string; name: string; hash?: string }): Promise<GitResult<{ name: string }>> {
    const cwd = resolve(request.dir);
    const args = ["tag", request.name, ...(request.hash !== undefined ? [request.hash] : [])];
    const run = await this.cli.run(args, { cwd });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      if (/already exists/i.test(stderr)) {
        return { ok: false, error: fail("tag-exists", "同名标签已存在") };
      }
      return { ok: false, error: fail("tag-create-failed", stderr || "创建标签失败") };
    }
    return { ok: true, value: { name: request.name } };
  }

  async tagDelete(request: { dir: string; name: string }): Promise<GitResult<{ name: string }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["tag", "-d", request.name], { cwd });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      if (/not found|Not a valid tag/i.test(stderr)) {
        return { ok: false, error: fail("tag-not-found", "标签不存在") };
      }
      return { ok: false, error: fail("tag-delete-failed", stderr || "删除标签失败") };
    }
    return { ok: true, value: { name: request.name } };
  }

  // ── log graph / file history / compare ────────────────────────────────────

  async logGraph(request: {
    dir: string;
    limit?: number;
    branch?: string;
    author?: string;
    since?: string;
    until?: string;
    path?: string;
  }): Promise<GitResult<{ rows: GraphRow[] }>> {
    const cwd = resolve(request.dir);
    const limit = request.limit ?? 100;
    // %x1e separates the graph prefix from the formatted commit text; the
    // graph prefix keeps git's ANSI colors (--color=always), the fields are
    // stripped before parsing.
    const format = "%x1e" + ["%h", "%H", "%s", "%an", "%at", "%D"].join("%x1f");
    const args = [
      "-c", "core.quotePath=false",
      "log", "--graph", "--color=always", "-n", String(limit),
      `--pretty=format:${format}`
    ];
    if (request.branch !== undefined && request.branch !== "") args.push(request.branch);
    if (request.author !== undefined && request.author !== "") args.push("--author=" + request.author);
    if (request.since !== undefined && request.since !== "") args.push("--since=" + request.since);
    if (request.until !== undefined && request.until !== "") args.push("--until=" + request.until);
    if (request.path !== undefined && request.path !== "") args.push("--", request.path);
    const run = await this.cli.run(args, { cwd });
    if (run.code !== 0) {
      if (/does not have any commits yet|bad revision|unknown revision/i.test(run.stderr)) {
        return { ok: true, value: { rows: [] } };
      }
      return { ok: false, error: fail("git-error", "获取提交历史失败：" + run.stderr.trim().slice(0, 200)) };
    }
    const rows: GraphRow[] = [];
    for (const line of run.stdout.split("\n")) {
      if (line === "") continue;
      const { graph, rest } = parseGraphLine(line);
      // "<short>\x1f<hash>\x1f<subject>\x1f<author>\x1f<date>\x1f<refs>"
      const [short = "", hash = "", subject = "", author = "", dateText = "", refs = ""] = rest.split("\x1f");
      if (short === "" && hash === "") continue;
      rows.push({
        graph,
        hash,
        short,
        subject,
        refs,
        author,
        date: Number(dateText) * 1000
      });
    }
    return { ok: true, value: { rows } };
  }

  /**
   * Distinct authors reachable from the given ref (or the whole history),
   * with commit counts — the data behind the Log author filter dropdown.
   * Uses `git log --pretty=format:%an%x1f%ae` + aggregation instead of
   * `shortlog` so names and emails stay separately machine-readable.
   */
  async logAuthors(request: { dir: string; branch?: string }): Promise<GitResult<{ authors: LogAuthor[] }>> {
    const cwd = resolve(request.dir);
    const args = ["log", "--pretty=format:%an%x1f%ae"];
    if (request.branch !== undefined && request.branch !== "") args.push(request.branch);
    const run = await this.cli.run(args, { cwd });
    if (run.code !== 0) {
      // Unborn branch / empty history: no authors to list.
      if (/does not have any commits yet|bad revision|unknown revision/i.test(run.stderr)) {
        return { ok: true, value: { authors: [] } };
      }
      return { ok: false, error: fail("git-error", "获取作者列表失败：" + run.stderr.trim().slice(0, 160)) };
    }
    const byKey = new Map<string, { name: string; email: string; count: number }>();
    for (const line of run.stdout.split("\n")) {
      if (line === "") continue;
      const [name = "", email = ""] = line.split("\x1f");
      if (name === "") continue;
      const key = name + "\x1f" + email;
      const entry = byKey.get(key);
      if (entry !== undefined) {
        entry.count++;
      } else {
        byKey.set(key, { name, email, count: 1 });
      }
    }
    const authors = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, value: { authors } };
  }

  async fileLog(request: { dir: string; path: string; limit?: number }): Promise<GitResult<{ commits: CommitInfo[] }>> {
    const cwd = resolve(request.dir);
    const limit = request.limit ?? 50;
    const format = ["%h", "%H", "%s", "%an", "%at", "%D"].join("%x1f");
    const run = await this.cli.run(["log", "--follow", "-n", String(limit), `--pretty=format:${format}`, "--", request.path], { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("git-error", "获取文件历史失败") };
    }
    return { ok: true, value: { commits: this.parseCommitLines(run.stdout) } };
  }

  /** Parse "--pretty=format:%h%x1f%H..." output into CommitInfo rows. */
  private parseCommitLines(stdout: string): CommitInfo[] {
    const commits: CommitInfo[] = [];
    for (const line of stdout.split("\n")) {
      if (line === "") continue;
      const [short, hash, subject, author, dateText, refs] = line.split("\x1f");
      commits.push({
        hash: hash ?? "",
        short: short ?? "",
        subject: subject ?? "",
        author: author ?? "",
        date: Number(dateText ?? 0) * 1000,
        refs: refs ?? ""
      });
    }
    return commits;
  }

  async compare(request: { dir: string; from: string; to: string }): Promise<GitResult<{ files: CompareFile[] }>> {
    const cwd = resolve(request.dir);
    const [numRun, nameRun] = await Promise.all([
      this.cli.run(["diff", "--numstat", request.from, request.to], { cwd }),
      this.cli.run(["diff", "--name-status", request.from, request.to], { cwd })
    ]);
    if (numRun.code !== 0) {
      return { ok: false, error: fail("git-error", "对比失败（分支不存在？）") };
    }
    const statusByPath = new Map<string, string>();
    for (const line of nameRun.stdout.split("\n")) {
      if (line === "") continue;
      const index = line.indexOf("\t");
      if (index === -1) continue;
      statusByPath.set(line.slice(index + 1), line.slice(0, index));
    }
    const files: CompareFile[] = [];
    for (const line of numRun.stdout.split("\n")) {
      if (line === "") continue;
      const match = /^(\S+)\t(\S+)\t(.*)$/.exec(line);
      if (match === null) continue;
      const [, add, del, path] = match;
      files.push({
        path,
        status: statusByPath.get(path) ?? "",
        additions: add === "-" ? null : Number(add),
        deletions: del === "-" ? null : Number(del)
      });
    }
    return { ok: true, value: { files } };
  }

  // ── checkout ──────────────────────────────────────────────────────────────

  async checkout(request: { dir: string; branch: string; create?: boolean; startPoint?: string }): Promise<GitResult<{ branch: string }>> {
    const cwd = resolve(request.dir);
    const args = request.create === true
      ? ["checkout", "-b", request.branch, ...(request.startPoint !== undefined && request.startPoint !== "" ? [request.startPoint] : [])]
      : ["checkout", request.branch];
    const run = await this.cli.run(args, { cwd });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      if (/did not match any file|pathspec/i.test(stderr)) {
        return { ok: false, error: fail("branch-not-found", "分支不存在") };
      }
      if (/local changes|would be overwritten/i.test(stderr)) {
        return { ok: false, error: fail("dirty", "有未提交改动，请先提交或暂存") };
      }
      return { ok: false, error: fail("git-error", "切换分支失败") };
    }
    return { ok: true, value: { branch: request.branch } };
  }

  // ── branch management ─────────────────────────────────────────────────────

  async branchRename(request: { dir: string; oldName: string; newName: string }): Promise<GitResult<{ oldName: string; newName: string }>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(["branch", "-m", request.oldName, request.newName], { cwd });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      if (/already exists/i.test(stderr)) {
        return { ok: false, error: fail("branch-exists", "同名分支已存在") };
      }
      return { ok: false, error: fail("branch-rename-failed", stderr || "重命名分支失败") };
    }
    return { ok: true, value: { oldName: request.oldName, newName: request.newName } };
  }

  async branchDelete(request: { dir: string; name: string; force?: boolean }): Promise<GitResult<{ name: string }>> {
    const cwd = resolve(request.dir);
    const args = ["branch", request.force === true ? "-D" : "-d", request.name];
    const run = await this.cli.run(args, { cwd });
    if (run.code !== 0) {
      const stderr = run.stderr.trim();
      if (/not fully merged/i.test(stderr)) {
        return { ok: false, error: fail("branch-not-merged", "分支未完全合并，需强制删除") };
      }
      if (/cannot delete the branch|cannot delete branch/i.test(stderr)) {
        return { ok: false, error: fail("branch-current", "不能删除当前分支") };
      }
      return { ok: false, error: fail("branch-delete-failed", stderr || "删除分支失败") };
    }
    return { ok: true, value: { name: request.name } };
  }

  // ── merge ─────────────────────────────────────────────────────────────────

  async merge(request: { dir: string; branch: string; noFF?: boolean }): Promise<GitResult<MergeOutcome>> {
    const cwd = resolve(request.dir);
    const run = await this.cli.run(
      ["merge", ...(request.noFF === true ? ["--no-ff"] : []), request.branch],
      { cwd }
    );
    // git writes merge progress/conflict notices to STDOUT when it is not a
    // tty; stderr may be empty even for a conflicted merge.
    const combined = `${run.stdout}\n${run.stderr}`.trim();
    if (run.code === 0) {
      // exit 0 with "Already up to date." means nothing happened at all.
      if (/Already up to date/i.test(combined)) {
        return { ok: true, value: { merged: false, kind: "already-up-to-date" } };
      }
      const hashRun = await this.cli.run(["rev-parse", "HEAD"], { cwd });
      return {
        ok: true,
        value: {
          merged: true,
          kind: /Fast-forward/i.test(combined) ? "fast-forward" : "merge",
          ...(hashRun.code === 0 ? { hash: hashRun.stdout.trim() } : {})
        }
      };
    }
    if (/CONFLICT|Automatic merge failed/i.test(combined)) {
      const conflictRun = await this.cli.run(
        ["diff", "--name-only", "--diff-filter=U"],
        { cwd }
      );
      const conflicts = conflictRun.code === 0
        ? conflictRun.stdout.trim().split("\n").filter(Boolean)
        : [];
      return { ok: true, value: { merged: false, kind: "conflicts", conflicts } };
    }
    if (/You have not concluded your merge|merge in progress/i.test(combined)) {
      return { ok: false, error: fail("merge-in-progress", "合并已在进行中") };
    }
    const dirty = /Your local changes|would be overwritten|uncommitted changes/i.test(combined);
    return {
      ok: true,
      value: {
        merged: false,
        kind: "error",
        message: dirty ? "无法开始合并：有未提交改动，请先提交或暂存" : "无法开始合并"
      }
    };
  }

  /** Internal: finish a conflicted merge (used by operationContinue). */
  async mergeCommit(request: { dir: string; message?: string }): Promise<GitResult<{ hash: string; short: string }>> {
    const cwd = resolve(request.dir);
    // `-c core.editor=true` makes git use the prepared MERGE_MSG instead of
    // opening an editor when no explicit message is supplied.
    const args = request.message !== undefined && request.message.trim() !== ""
      ? ["-c", "core.editor=true", "commit", "-m", request.message]
      : ["-c", "core.editor=true", "commit"];
    const run = await this.cli.run(args, { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("git-error", "完成合并提交失败") };
    }
    const hashRun = await this.cli.run(["rev-parse", "HEAD"], { cwd });
    const hash = hashRun.code === 0 ? hashRun.stdout.trim() : "";
    return { ok: true, value: { hash, short: hash.slice(0, 7) } };
  }

  // ── conflict contents / resolution ────────────────────────────────────────

  async conflictContent(request: { dir: string; path: string }): Promise<GitResult<ConflictView>> {
    const cwd = resolve(request.dir);
    const fullPath = resolve(cwd, request.path);
    if (!existsSync(fullPath)) {
      return { ok: false, error: fail("not-found", "文件不存在") };
    }
    const result = readFileSync(fullPath, "utf8");
    const resultLines = result.split("\n");

    // Parse the working file into conflict blocks: per-side content plus
    // 0-based ranges inclusive of the marker lines. Line endings are
    // normalized for matching against git show output (LF).
    const norm = (line: string): string => line.replace(/\r$/, "");
    interface RawBlock { ours: string[]; theirs: string[]; resultStart: number; resultEnd: number; }
    const raw: RawBlock[] = [];
    let side: "ours" | "theirs" | null = null;
    let start = 0;
    let ours: string[] = [];
    let theirs: string[] = [];
    for (let i = 0; i < resultLines.length; i++) {
      const line = resultLines[i] ?? "";
      if (line.startsWith("<<<<<<<")) {
        start = i;
        side = "ours";
        ours = [];
        theirs = [];
        continue;
      }
      if (line.startsWith("=======")) {
        side = "theirs";
        continue;
      }
      if (line.startsWith(">>>>>>>")) {
        raw.push({ ours, theirs, resultStart: start, resultEnd: i });
        side = null;
        continue;
      }
      if (side === "ours") ours.push(norm(line));
      else if (side === "theirs") theirs.push(norm(line));
    }

    // Ours = index stage 2, theirs = stage 3 (merge conflict stages); fall
    // back to HEAD / MERGE_HEAD when the stage paths are unavailable.
    const pathArg = request.path.replace(/\\/g, "/");
    const [oursRun, theirsRun] = await Promise.all([
      this.cli.run(["show", ":2:" + pathArg], { cwd }),
      this.cli.run(["show", ":3:" + pathArg], { cwd })
    ]);
    const clean = (text: string): string => (text.includes("\0") ? "" : text);
    const oursText = clean(oursRun.code === 0 ? oursRun.stdout : await this.showRef("HEAD:" + pathArg, cwd));
    const theirsText = clean(theirsRun.code === 0 ? theirsRun.stdout : await this.showRef("MERGE_HEAD:" + pathArg, cwd));

    // Locate each block's content inside the full side files (sequential
    // match from the previous position; unmatched blocks get an empty range
    // and simply render without a highlight).
    const oursLines = oursText.split("\n");
    const theirsLines = theirsText.split("\n");
    let oursCursor = 0;
    let theirsCursor = 0;
    const blocks = raw.map((block) => {
      const oursStart = this.locateLines(oursLines, block.ours, oursCursor);
      const theirsStart = this.locateLines(theirsLines, block.theirs, theirsCursor);
      if (oursStart >= 0) oursCursor = oursStart + Math.max(1, block.ours.length);
      if (theirsStart >= 0) theirsCursor = theirsStart + Math.max(1, block.theirs.length);
      return {
        oursStart: oursStart >= 0 ? oursStart : 0,
        oursEnd: oursStart >= 0 ? oursStart + Math.max(1, block.ours.length) - 1 : -1,
        theirsStart: theirsStart >= 0 ? theirsStart : 0,
        theirsEnd: theirsStart >= 0 ? theirsStart + Math.max(1, block.theirs.length) - 1 : -1,
        resultStart: block.resultStart,
        resultEnd: block.resultEnd
      };
    });

    return {
      ok: true,
      value: {
        ours: oursText,
        theirs: theirsText,
        result,
        markers: raw.length,
        blocks
      }
    };
  }

  /** Content of a ref (e.g. "HEAD:path") as text, or "" when unavailable. */
  private async showRef(ref: string, cwd: string): Promise<string> {
    const run = await this.cli.run(["show", ref], { cwd });
    return run.code === 0 ? run.stdout : "";
  }

  /** First index of a target line sequence at or after 'from', else -1. */
  private locateLines(lines: string[], target: string[], from: number): number {
    if (target.length === 0) return -1;
    for (let i = Math.max(0, from); i <= lines.length - target.length; i++) {
      if ((lines[i] ?? "") === target[0]) {
        let ok = true;
        for (let j = 1; j < target.length; j++) {
          if ((lines[i + j] ?? "") !== target[j]) {
            ok = false;
            break;
          }
        }
        if (ok) return i;
      }
    }
    return -1;
  }

  /** Write resolved content and stage the file — the "mark resolved" step. */
  async resolveFile(request: { dir: string; path: string; content: string }): Promise<GitResult<{ path: string }>> {
    const cwd = resolve(request.dir);
    const fullPath = resolve(cwd, request.path);
    if (!fullPath.startsWith(resolve(cwd) + "\\") && !fullPath.startsWith(resolve(cwd) + "/")) {
      return { ok: false, error: fail("invalid-path", "路径超出工作区范围") };
    }
    try {
      writeFileSync(fullPath, request.content, "utf8");
    } catch {
      return { ok: false, error: fail("write-failed", "写入文件失败") };
    }
    const run = await this.cli.run(["add", "--", request.path], { cwd });
    if (run.code !== 0) {
      return { ok: false, error: fail("git-error", "标记解决失败") };
    }
    return { ok: true, value: { path: request.path } };
  }

  // ── AI one-click commit ────────────────────────────────────────────────────

  /**
   * Plan commits with the shared DSH LLM service: collect the working-tree
   * changes (tracked diff + untracked preview), ask the model to split them
   * into logical commit groups with conventional messages, then validate the
   * grouping (mutually exclusive, fully covering) before returning it.
   */
  async suggestCommits(request: { dir: string }): Promise<GitResult<{ groups: CommitGroup[]; totalFiles: number }>> {
    const cwd = resolve(request.dir);
    const status = await this.status({ dir: cwd });
    if (!status.ok) return status;
    const allPaths = [
      ...status.value.staged.map((file) => file.path),
      ...status.value.unstaged.map((file) => file.path),
      ...status.value.untracked
    ];
    const uniquePaths = [...new Set(allPaths)];
    if (uniquePaths.length === 0) {
      return { ok: false, error: fail("nothing-to-commit", "没有可提交的变更") };
    }

    const summary = await this.collectChangeSummary(cwd, uniquePaths);
    const subjects = await this.recentSubjects(cwd);
    const root = status.value.root;

    const prompt = [
      "你是 DSH 中的资深 Git 助手。用户请求：帮我提交代码。",
      "请分析仓库的工作区改动，规划成若干逻辑上独立的提交组。",
      "仓库根目录：",
      root,
      "",
      "改动文件：",
      ...uniquePaths.map((path) => `- ${path}`),
      "",
      "文件内容摘要（diff 或未跟踪文件预览，已截断）：",
      summary,
      "",
      "仓库最近提交（风格参考）：",
      subjects.length > 0 ? subjects.join("\n") : "(无)",
      "",
      "要求：",
      "1. 每个组一条 Conventional Commits 消息（feat/fix/refactor/docs/chore/test/perf），首行不超过 72 字符，可用换行写正文，用中文。",
      "2. files 是相对仓库根的路径，必须与上面列出的改动文件完全一致（不能遗漏、不能虚构）。",
      "3. 同一主题的文件归入同一组，不同主题拆分为多组；改动少时 1 组即可。",
      "严格按输出 schema 返回，不要输出多余文字。"
    ].join("\n");

    let groups: CommitGroup[] = [];
    try {
      const out = await this.agentAsk(root, prompt, {
        label: "git-ui commit plan",
        outputSchema: {
          type: "object",
          properties: {
            groups: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  files: { type: "array", items: { type: "string" } }
                },
                required: ["message", "files"],
                additionalProperties: false
              }
            }
          },
          required: ["groups"],
          additionalProperties: false
        }
      });
      const structured = out.structured as { groups?: Array<{ message?: string; files?: string[] }> } | undefined;
      if (structured !== undefined && Array.isArray(structured.groups)) {
        groups = structured.groups
          .filter((g) => typeof g.message === "string" && Array.isArray(g.files))
          .map((g) => ({ message: g.message as string, files: g.files as string[] }));
      }
      if (groups.length === 0) {
        groups = parseCommitGroups(out.text);
      }
    } catch (error) {
      return { ok: false, error: fail("analysis-failed", `分析失败：${(error as Error).message}`) };
    }
    if (groups.length === 0) {
      return { ok: false, error: fail("analysis-failed", "分析失败，请重试") };
    }

    // Validate + repair: drop unknown files, keep groups mutually exclusive,
    // and append a catch-all group for anything the model missed.
    const assigned = new Set<string>();
    const cleaned: CommitGroup[] = [];
    for (const group of groups) {
      const files = [...new Set(group.files)].filter(
        (path) => uniquePaths.includes(path) && !assigned.has(path)
      );
      if (files.length === 0) continue;
      cleaned.push({ message: group.message.trim(), files });
      for (const file of files) assigned.add(file);
    }
    const missing = uniquePaths.filter((path) => !assigned.has(path));
    if (missing.length > 0) {
      cleaned.push({ message: "chore: 其他改动", files: missing });
    }
    return { ok: true, value: { groups: cleaned, totalFiles: uniquePaths.length } };
  }

  /** Execute the planned commit groups in order; each group is staged and committed atomically. */
  async executeCommits(request: { dir: string; groups: CommitGroup[] }): Promise<GitResult<{ commits: ExecutedCommit[] }>> {
    const cwd = resolve(request.dir);
    const commits: ExecutedCommit[] = [];
    for (const group of request.groups) {
      if (group.files.length === 0 || group.message.trim() === "") continue;
      const add = await this.cli.run(["add", "--", ...group.files], { cwd });
      if (add.code !== 0) {
        return {
          ok: false,
          error: fail("partial", `提交中断：暂存 ${group.files.length} 个文件失败`)
        };
      }
      const commit = await this.cli.run(["commit", "-m", group.message.trim()], { cwd });
      if (commit.code !== 0) {
        const stderr = commit.stderr.trim();
        if (/nothing to commit|no changes added to commit/i.test(stderr)) {
          // File contents changed between planning and execution (e.g. a
          // concurrent edit reverted the change) — skip this group quietly.
          continue;
        }
        return {
          ok: false,
          error: fail("partial", `提交中断：${stderr.slice(0, 200) || "git commit 失败"}`)
        };
      }
      const hashRun = await this.cli.run(["rev-parse", "HEAD"], { cwd });
      const hash = hashRun.code === 0 ? hashRun.stdout.trim() : "";
      commits.push({ message: group.message.trim(), hash, short: hash.slice(0, 7) });
    }
    return { ok: true, value: { commits } };
  }

  /** Collect a bounded text summary of every changed file (diff or preview). */
  private async collectChangeSummary(cwd: string, paths: string[]): Promise<string> {
    const MAX_TOTAL = 30000;
    const MAX_FILE = 6000;
    const parts: string[] = [];
    let total = 0;
    for (const path of paths) {
      if (total >= MAX_TOTAL) break;
      let block = "";
      if (await this.isUntracked(cwd, path)) {
        try {
          const content = readFileSync(resolve(cwd, path), "utf8");
          block = `### ${path}（未跟踪文件）\n${content.slice(0, 1500)}`;
        } catch {
          block = `### ${path}（未跟踪文件，无法读取）`;
        }
      } else {
        const run = await this.cli.run(["diff", "HEAD", "--no-color", "--unified=3", "--", path], { cwd });
        const output = run.stdout;
        block = output.trim() === "" ? `### ${path}（无 diff 输出）` : `### ${path}\n${output}`;
      }
      block = block.slice(0, MAX_FILE);
      parts.push(block);
      total += block.length;
    }
    return parts.join("\n\n");
  }

  private async isUntracked(cwd: string, path: string): Promise<boolean> {
    const run = await this.cli.run(["ls-files", "--error-unmatch", "--", path], { cwd });
    return run.code !== 0;
  }

  private async recentSubjects(cwd: string): Promise<string[]> {
    const run = await this.cli.run(["log", "-n", "8", "--pretty=format:%s"], { cwd });
    if (run.code !== 0) return [];
    return run.stdout.trim().split("\n").filter(Boolean);
  }

  /**
   * Delegate an analysis task to a fresh DSH agent (spawn subagent) — the
   * same path a user chat takes: the child gets the deployment's default
   * model, tools, and reasoning configuration. A lightweight host agent is
   * created as the parent (subagents require one) and disposed afterwards.
   * @returns the final assistant text, plus the structured value when an
   *   output schema was requested and satisfied.
   */
  private async agentAsk(
    cwd: string,
    prompt: string,
    options?: { label?: string; outputSchema?: unknown }
  ): Promise<{ text: string; structured?: unknown }> {
    const ctx = this.ctx as unknown as {
      agents?: {
        /** @returns AgentHandle: { agent, dispose } — see dsh-agent README. */
        create(opts: Record<string, unknown>): Promise<{
          agent: { followup?(message: unknown): void };
          dispose(): Promise<void> | void;
        }>;
      };
      subagents?: {
        start(name: string, req: Record<string, unknown>): Promise<{
          result: Promise<{
            output: Array<{ type?: string; text?: string }>;
            structured?: unknown;
            stopReason: string;
          }>;
          dispose(): Promise<void> | void;
        }>;
      };
    };
    if (ctx.agents === undefined || ctx.subagents === undefined) {
      throw new Error("agent 服务不可用（缺少 agents / subagents 服务）");
    }
    // The parent must carry the deployment's default model route — the spawn
    // child inherits provider/model from it and fails without one.
    const selection = (this.ctx as unknown as {
      agentDefaultModel?: { currentSelection?: () => { provider?: string; model?: string; reasoningEffort?: string } };
    }).agentDefaultModel?.currentSelection?.();
    const agentOptions: Record<string, unknown> = {};
    if (selection !== undefined && selection.provider !== "" && selection.model !== undefined && selection.model !== "") {
      agentOptions.provider = selection.provider;
      agentOptions.model = selection.model;
      if (selection.reasoningEffort !== undefined && selection.reasoningEffort !== "") {
        agentOptions.reasoningEffort = selection.reasoningEffort;
      }
    }
    const handle = await ctx.agents.create({
      sessionId: randomUUID(),
      meta: { cwd, origin: "subagent" },
      agentOptions
    });
    try {
      const run = await ctx.subagents.start("spawn", {
        parent: handle.agent,
        label: options?.label ?? "dsh-git-ui analysis",
        prompt: [{ type: "text", text: prompt }],
        ...(options?.outputSchema !== undefined ? { outputSchema: options.outputSchema } : {}),
        signal: AbortSignal.timeout(240000)
      });
      const result = await run.result;
      if (result.stopReason !== "completed") {
        throw new Error(`分析未完成（${result.stopReason}）`);
      }
      const text = (result.output ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n")
        .trim();
      if (text === "" && result.structured === undefined) {
        throw new Error("模型返回为空");
      }
      return { text, structured: result.structured };
    } finally {
      await handle.dispose?.();
    }
  }
}

/** Parse the model's JSON reply, tolerating ```json fences and stray text. */
function parseCommitGroups(text: string): CommitGroup[] {
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence !== null) cleaned = fence[1]?.trim() ?? cleaned;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { groups?: Array<{ message?: unknown; files?: unknown }> };
    if (!Array.isArray(parsed.groups)) return [];
    const groups: CommitGroup[] = [];
    for (const entry of parsed.groups) {
      if (typeof entry?.message !== "string" || !Array.isArray(entry.files)) continue;
      const files = entry.files.filter((file): file is string => typeof file === "string");
      if (entry.message.trim() === "" || files.length === 0) continue;
      groups.push({ message: entry.message, files });
    }
    return groups;
  } catch {
    return [];
  }
}
