/**
 * Stash tab — a dedicated workspace for git stash:
 *  - create a stash (message + include untracked);
 *  - list every stash with message and date;
 *  - per stash: apply (keep), pop (apply + drop), show (file summary),
 *    create branch (and switch), drop;
 *  - clear everything (with confirmation).
 * Conflicts from apply/pop/branch are surfaced with a pointer to the Merge tab.
 */
import { useEffect, useState } from "react";
import type { GitApi } from "../api.js";
import type { StashEntry } from "../../types.js";
import type { GitUiT } from "./DiffView.js";
import { Toast } from "./Toast.js";

export function StashView(props: {
  api: GitApi;
  dir: string;
  t: GitUiT;
  onChanged: () => void;
}): JSX.Element {
  const { api, dir, t, onChanged } = props;
  const [stashes, setStashes] = useState<StashEntry[] | null>(null);
  const [message, setMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  /** Expanded "show" summary per stash index. */
  const [showFor, setShowFor] = useState<number | null>(null);
  const [showLines, setShowLines] = useState<string[] | null>(null);
  /** Inline "create branch" input per stash index. */
  const [branchFor, setBranchFor] = useState<number | null>(null);
  const [branchName, setBranchName] = useState("");

  function load(): void {
    api
      .stashList(dir)
      .then((list) => {
        setStashes(list);
        // Drop stale expanded state when the list shrinks.
        setShowFor((current) => (current !== null && !list.some((s) => s.index === current) ? null : current));
        setBranchFor((current) => (current !== null && !list.some((s) => s.index === current) ? null : current));
      })
      .catch((caught) => {
        setStashes([]);
        setError((caught as Error).message);
      });
  }

  useEffect(() => {
    setStashes(null);
    setError(null);
    setOk(null);
    setShowFor(null);
    setBranchFor(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, dir]);

  async function doStash(): Promise<void> {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const outcome = await api.stashPush(dir, message, includeUntracked);
      if (!outcome.stashed) {
        setOk(outcome.message ?? t("stash.nothing"));
      } else {
        setOk(t("stash.done"));
        setMessage("");
        onChanged();
      }
      load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doApply(entry: StashEntry): Promise<void> {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const outcome = await api.stashApply(dir, entry.index);
      if (outcome.applied) {
        setOk(t("stash.applied", { index: entry.index }));
        onChanged();
      } else {
        setError(t("stash.applyConflicts", { n: outcome.conflicts?.length ?? 0 }));
        onChanged();
      }
      load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doPop(entry: StashEntry): Promise<void> {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const outcome = await api.stashPop(dir, entry.index);
      if (outcome.popped) {
        setOk(t("stash.popped", { index: entry.index }));
      } else {
        setError(t("stash.popConflicts", { n: outcome.conflicts?.length ?? 0 }));
      }
      onChanged();
      load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doDrop(entry: StashEntry): Promise<void> {
    if (!window.confirm(t("stash.dropConfirm", { index: entry.index, message: entry.message }))) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.stashDrop(dir, entry.index);
      setOk(t("stash.dropped", { index: entry.index }));
      load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doClear(): Promise<void> {
    if (!window.confirm(t("stash.clearConfirm"))) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.stashClear(dir);
      setOk(t("stash.cleared"));
      load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doShow(entry: StashEntry): Promise<void> {
    if (showFor === entry.index) {
      setShowFor(null);
      setShowLines(null);
      return;
    }
    setShowFor(entry.index);
    setShowLines(null);
    try {
      setShowLines(await api.stashShow(dir, entry.index));
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function doBranch(entry: StashEntry): Promise<void> {
    const name = branchName.trim();
    if (name === "") return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.stashBranch(dir, entry.index, name);
      setOk(t("stash.branched", { index: entry.index, branch: name }));
      setBranchFor(null);
      setBranchName("");
      onChanged();
      load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gitui-detail" style={{ minHeight: 220 }}>
      <div className="gitui-detail-header">
        <span>{t("stash.title")}</span>
        <span style={{ flex: 1 }} />
        {stashes !== null && stashes.length > 0 && (
          <button type="button" className="gitui-btn gitui-btn-danger" disabled={busy} title={t("stash.clearHint")} onClick={() => void doClear()}>
            {t("stash.clear")}
          </button>
        )}
        <button type="button" className="gitui-btn" disabled={busy || dir === ""} onClick={load}>
          {t("action.refresh")}
        </button>
      </div>
      <div className="gitui-stash-create">
        <input
          className="gitui-dir gitui-config-edit"
          value={message}
          placeholder={t("stash.message")}
          spellCheck={false}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void doStash();
          }}
        />
        <label className="gitui-merge-option">
          <input type="checkbox" checked={includeUntracked} onChange={(event) => setIncludeUntracked(event.target.checked)} disabled={busy} />
          {t("stash.untracked")}
        </label>
        <button type="button" className="gitui-btn gitui-btn-primary" disabled={busy || dir === ""} onClick={() => void doStash()}>
          {t("stash.action")}
        </button>
      </div>
      <div className="gitui-config-scroll">
        {stashes === null && <div className="gitui-diff-placeholder">…</div>}
        {stashes !== null && stashes.length === 0 && (
          <div className="gitui-diff-placeholder">{t("stash.empty")}</div>
        )}
        {stashes !== null &&
          stashes.map((entry) => (
            <div key={entry.index} className="gitui-stash-item">
              <div className="gitui-branch-row">
                <span className="gitui-commit-meta">stash@{entry.index}</span>
                <span className="gitui-file-path" title={entry.message}>{entry.message}</span>
                {entry.date !== undefined && entry.date !== "" && (
                  <span className="gitui-commit-meta">{entry.date.slice(0, 16)}</span>
                )}
                <span style={{ flex: 1 }} />
                <button type="button" className="gitui-btn" disabled={busy} title={t("stash.applyHint")} onClick={() => void doApply(entry)}>
                  {t("stash.apply")}
                </button>
                <button type="button" className="gitui-btn" disabled={busy} title={t("stash.restore")} onClick={() => void doPop(entry)}>
                  {t("stash.restore")}
                </button>
                <button
                  type="button"
                  className={"gitui-btn" + (showFor === entry.index ? " gitui-active" : "")}
                  disabled={busy}
                  title={t("stash.showHint")}
                  onClick={() => void doShow(entry)}
                >
                  {t("stash.show")}
                </button>
                <button
                  type="button"
                  className={"gitui-btn" + (branchFor === entry.index ? " gitui-active" : "")}
                  disabled={busy}
                  title={t("stash.branchHint")}
                  onClick={() => {
                    setBranchFor(branchFor === entry.index ? null : entry.index);
                    setBranchName("");
                  }}
                >
                  {t("stash.branch")}
                </button>
                <button type="button" className="gitui-btn gitui-btn-danger" disabled={busy} title={t("stash.drop")} onClick={() => void doDrop(entry)}>
                  {t("stash.drop")}
                </button>
              </div>
              {showFor === entry.index && (
                <div className="gitui-stash-show">
                  {showLines === null && <div className="gitui-diff-placeholder">…</div>}
                  {showLines !== null && showLines.length === 0 && <div className="gitui-commit-meta">{t("stash.showEmpty")}</div>}
                  {showLines !== null &&
                    showLines.map((line, i) => (
                      <div key={i} className="gitui-stash-show-line">
                        {line}
                      </div>
                    ))}
                </div>
              )}
              {branchFor === entry.index && (
                <div className="gitui-stash-create" style={{ paddingLeft: 12 }}>
                  <input
                    className="gitui-dir gitui-config-edit"
                    value={branchName}
                    placeholder={t("stash.branchPrompt")}
                    spellCheck={false}
                    autoFocus
                    onChange={(event) => setBranchName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void doBranch(entry);
                      if (event.key === "Escape") setBranchFor(null);
                    }}
                  />
                  <button type="button" className="gitui-btn gitui-btn-primary" disabled={busy || branchName.trim() === ""} onClick={() => void doBranch(entry)}>
                    {t("stash.branch")}
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
      <Toast message={error !== null ? error : ok} tone={error !== null ? "error" : "ok"} />
    </div>
  );
}
