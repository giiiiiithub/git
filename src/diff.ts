/**
 * Unified-diff parser for `git diff --unified=N --no-color` output.
 * Produces structured hunks with per-line kind, content, and line numbers so
 * the browser can render an IDEA-style line diff without re-parsing text.
 */
import type { DiffFile, DiffHunk, DiffLine } from "./types.js";

// Either side may come first: plain diffs print "a/x b/y", while reversed
// diffs (git diff -R, used so the working tree sits on the left) print
// "b/x a/y". The path is the same on both sides, so the order only matters
// for the /dev/null cases handled below.
const FILE_HEADER = /^diff --git (?:a|b)\/(.*) (?:a|b)\/(.*)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export interface ParseDiffOptions {
  /** Restrict to one path (the `-- path` argument). */
  path?: string;
}

export function parseUnifiedDiff(
  raw: string,
  options: ParseDiffOptions = {}
): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;

  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fileMatch = FILE_HEADER.exec(line);
    if (fileMatch !== null) {
      // New files can appear as `a/dev/null` (or keep both sides named and
      // mark the deleted side `--- /dev/null`); never let /dev/null win.
      const left = fileMatch[1] === "dev/null" ? fileMatch[2] : fileMatch[1];
      const right = fileMatch[2] === "dev/null" ? fileMatch[1] : fileMatch[2];
      const path = left === "dev/null" ? right : left === "/dev/null" ? right : left;
      if (current !== null) files.push(current);
      current = { path, binary: false, hunks: [] };
      hunk = null;
      continue;
    }

    if (current === null) continue;

    if (line.startsWith("diff --git") === false && line === "") {
      // End of file block: blank separator line.
      continue;
    }

    const hunkMatch = HUNK_HEADER.exec(line);
    if (hunkMatch !== null) {
      oldNo = Number(hunkMatch[1]);
      newNo = Number(hunkMatch[3]);
      hunk = {
        oldStart: oldNo,
        oldCount: Number(hunkMatch[2] ?? 1),
        newStart: newNo,
        newCount: Number(hunkMatch[4] ?? 1),
        lines: []
      };
      current.hunks.push(hunk);
      continue;
    }

    // Binary detection: "Binary files a/x and b/x differ" or "GIT binary patch".
    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      current.binary = true;
      current.hunks = [];
      hunk = null;
      continue;
    }

    // Metadata lines between the file header and the first hunk.
    if (hunk === null) continue;
    if (
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("new file mode ") ||
      line.startsWith("deleted file mode ") ||
      line.startsWith("old mode ") ||
      line.startsWith("new mode ") ||
      line.startsWith("similarity index ") ||
      line.startsWith("rename from ") ||
      line.startsWith("rename to ") ||
      line.startsWith("index ")
    ) {
      continue;
    }

    if (line.startsWith("\\ No newline at end of file")) {
      // Append marker to the previous line's text so rendering stays aligned.
      const prev = hunk.lines[hunk.lines.length - 1];
      if (prev !== undefined) prev.text += " ⏎";
      continue;
    }

    const prefix = line.charAt(0);
    const text = line.slice(1);
    if (prefix === " ") {
      hunk.lines.push({ type: "ctx", text, oldNo: oldNo++, newNo: newNo++ });
    } else if (prefix === "+") {
      hunk.lines.push({ type: "add", text, newNo: newNo++ });
    } else if (prefix === "-") {
      hunk.lines.push({ type: "del", text, oldNo: oldNo++ });
    } else {
      // Unknown line (should not happen inside a hunk); keep as context.
      hunk.lines.push({ type: "ctx", text: line });
    }
  }
  if (current !== null) files.push(current);

  if (options.path !== undefined) {
    return files.filter((file) => file.path === options.path);
  }
  return files;
}

/** True when the diff output contains no file blocks. */
export function isEmptyDiff(raw: string): boolean {
  return raw.trim() === "" || /^diff --git /m.test(raw) === false;
}
