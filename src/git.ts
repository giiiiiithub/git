/**
 * Thin wrapper over the system `git` executable. Every command runs in the
 * requested working directory and returns a settled { code, stdout, stderr }
 * triple — exit codes are data, not exceptions, so the Remote can map them
 * onto business errors.
 */
import { execFile } from "node:child_process";

export interface GitRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface GitRunOptions {
  cwd: string;
  timeoutMs?: number;
  /** stdin content for commands that read patches (git apply). */
  input?: string;
  /** Read stdout as raw bytes (latin1 passthrough) for binary content. */
  binary?: boolean;
}

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_BUFFER = 128 * 1024 * 1024;

export class GitCli {
  constructor(private readonly gitPath: string = "git") {}

  /** Whether the git executable exists at all (checks once, cached). */
  async available(): Promise<boolean> {
    const result = await this.run(["--version"], { cwd: process.cwd() });
    return result.code === 0;
  }

  run(args: string[], options: GitRunOptions): Promise<GitRunResult> {
    return new Promise((resolve) => {
      const child = execFile(
        this.gitPath,
        args,
        {
          cwd: options.cwd,
          timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          maxBuffer: MAX_BUFFER,
          windowsHide: true,
          // latin1 = one byte per char: lossless channel for binary content.
          encoding: options.binary === true ? "latin1" : "utf8"
        },
        (error, stdout, stderr) => {
          if (error === null) {
            resolve({ code: 0, stdout, stderr });
            return;
          }
          const code = (error as NodeJS.ErrnoException & { code?: unknown })
            .code;
          if (code === "ENOENT") {
            resolve({ code: 127, stdout: "", stderr: "git: executable not found" });
            return;
          }
          if (typeof code === "number") {
            resolve({ code, stdout, stderr });
            return;
          }
          // Non-numeric codes (EPIPE etc.) usually mean the child died before
          // consuming stdin; keep the real stderr when execFile captured it.
          const failure = error as { stderr?: string; message?: string };
          resolve({
            code: 1,
            stdout: stdout ?? "",
            stderr: failure.stderr ?? String(error.message)
          });
        }
      );
      // Feed stdin manually: node's execFile `input` option can hang on
      if (options.input !== undefined && child.stdin !== null) {
        const stdin = child.stdin;
        stdin.on("error", () => {
          /* EPIPE when the child exits before reading stdin */
        });
        stdin.end(options.input);
      }
    });
}
}
