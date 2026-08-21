/**
 * Merge tab: conflict list with ours/theirs resolution, plus a merge starter
 * when no merge is in progress. The starter makes the direction explicit —
 * git always merges INTO the checked-out branch — and offers the reverse
 * direction (switch target, then merge) as a secondary action.
 */
import { useEffect, useState } from "react";
import type { GitApi } from "../api.js";
import type { ConflictView, MergeOutcome, RepoStatus } from "../../types.js";
import type { GitUiT } from "./DiffView.js";
import { MergeRevisions } from "./MergeRevisions.js";

export function MergeView(props: {
  api: GitApi;
  dir: string;
  status: RepoStatus | null;
  t: GitUiT;
  onChanged: () => void;
  /** Open the interactive rebase dialog (integration operations live here). */
  onOpenRebase?: (base?: string) => void;
}): JSX.Element {
  const { api, dir, status, t, onChanged, onOpenRebase } = props;
  const merging =
    status !== null &&
    (status.state === "merge" ||
      status.state === "cherry-pick" ||
      status.state === "revert" ||
      status.state === "rebase");
  const conflicts = status?.conflicts ?? [];
  const opState = status?.state ?? "clean";
  /** Destination of any merge started here: the checked-out branch. */
  const currentBranch = status?.branch ?? null;

  const [branches, setBranches] = useState<Array<{ name: string }>>([]);
  /** Source branch (merged FROM). */
  const [source, setSource] = useState("");
  /** Target branch (merged INTO); defaults to the checked-out branch. */
  const [target, setTarget] = useState("");
  const [noFF, setNoFF] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictView | null>(null);
  const [resolved, setResolved] = useState<string | null>(null);

  const [continueMessage, setContinueMessage] = useState("");
  const [finalBusy, setFinalBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Every local branch is a candidate: the source side excludes the chosen
  // target, and the target side defaults to the checked-out branch.
  useEffect(() => {
    if (merging) return;
    api
      .branches(dir)
      .then((value) => {
        setBranches(
          value.branches
            .filter((branch) => !branch.name.startsWith("remotes/"))
            .map((branch) => ({ name: branch.name }))
        );
      })
      .catch(() => setBranches([]));
  }, [api, dir, merging]);

  // Reset the pickers when the repository changes.
  useEffect(() => {
    setSource("");
    setTarget("");
  }, [dir]);
  // Default the target to the checked-out branch once the status arrives.
  useEffect(() => {
    if (target === "" && currentBranch !== null) setTarget(currentBranch);
  }, [target, currentBranch]);

  /** Report a merge result precisely: merged / fast-forward / up-to-date / conflicts. */
  function applyOutcome(outcome: MergeOutcome, source: string, target: string): void {
    if (outcome.merged) {
      const short = (outcome.hash ?? "").slice(0, 7);
      if (outcome.kind === "fast-forward") {
        setNotice(t("merge.fastForward", { source, target, short }));
      } else {
        setNotice(t("merge.done", { short, subject: source }));
      }
    } else if (outcome.kind === "already-up-to-date") {
      setNotice(t("merge.alreadyUpToDate", { source, target }));
    } else if (outcome.kind === "conflicts") {
      setNotice(null);
    } else {
      setMergeError(outcome.message ?? "无法开始合并");
    }
  }

  async function startMerge(): Promise<void> {
    if (source === "" || target === "" || source === target) return;
    setMergeBusy(true);
    setMergeError(null);
    try {
      if (target !== currentBranch) {
        // Merging into a branch that is not checked out: switch first.
        if (!window.confirm(t("merge.switchConfirm", { target, source }))) return;
        await api.checkout(dir, target);
      }
      const outcome = await api.merge(dir, source, noFF);
      applyOutcome(outcome, source, target);
      onChanged();
    } catch (error) {
      setMergeError((error as Error).message);
    } finally {
      setMergeBusy(false);
    }
  }

  async function openConflict(path: string): Promise<void> {
    setExpanded(path);
    setResolved(null);
    setConflict(null);
    try {
      const view = await api.conflictContent(dir, path);
      setConflict(view);
    } catch (error) {
      setConflict(null);
      setResolved((error as Error).message);
    }
  }

  async function abortMerge(): Promise<void> {
    setFinalBusy(true);
    try {
      await api.operationAbort(dir);
      onChanged();
    } catch (error) {
      setMergeError((error as Error).message);
    } finally {
      setFinalBusy(false);
    }
  }

  async function finishMerge(): Promise<void> {
    setFinalBusy(true);
    setMergeError(null);
    try {
      const result = await api.operationContinue(dir, continueMessage);
      const subject = continueMessage !== "" ? continueMessage : opState === "cherry-pick" ? "cherry-pick" : opState === "revert" ? "revert" : opState === "rebase" ? "rebase" : "merge";
      setNotice(t("merge.done", { short: (result.hash ?? "").slice(0, 7), subject }));
      setContinueMessage("");
      onChanged();
    } catch (error) {
      setMergeError((error as Error).message);
    } finally {
      setFinalBusy(false);
    }
  }

  /** Rebase-only: skip the conflicting commit. */
  async function skipCommit(): Promise<void> {
    setFinalBusy(true);
    setMergeError(null);
    try {
      const outcome = await api.operationSkip(dir);
      if (!outcome.skipped) {
        setNotice(t("merge.skipConflicts", { n: outcome.conflicts?.length ?? 0 }));
      } else {
        setNotice(t("merge.skipped"));
      }
      onChanged();
    } catch (error) {
      setMergeError((error as Error).message);
    } finally {
      setFinalBusy(false);
    }
  }

  const branchOptions = (
    selected: string,
    onChange: (name: string) => void,
    exclude: string
  ) => {
    const options = branches.filter((branch) => branch.name !== exclude);
    return options.length === 0 ? (
      <span className="gitui-merge-label">{t("merge.noTargets")}</span>
    ) : (
      <select
        className="gitui-dir"
        style={{ flex: "0 1 240px" }}
        value={selected}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{t("history.branch")}…</option>
        {options.map((branch) => (
          <option key={branch.name} value={branch.name}>
            {branch.name}
          </option>
        ))}
      </select>
    );
  };

  const noFFOption = (
    <label className="gitui-merge-option">
      <input type="checkbox" checked={noFF} onChange={(event) => setNoFF(event.target.checked)} />
      {t("merge.noFF")}
    </label>
  );

  if (!merging) {
    return (
      <div className="gitui-detail" style={{ minHeight: 220 }}>
        <div className="gitui-diff-placeholder" style={{ textAlign: "left" }}>
          <div className="gitui-merge-row">
            <span className="gitui-merge-label">{t("merge.from")}</span>
            {branchOptions(source, setSource, target)}
            <span className="gitui-merge-arrow">→</span>
            <span className="gitui-merge-label">{t("merge.into")}</span>
            {branchOptions(target, setTarget, "")}
          </div>
          <div className="gitui-merge-row">
            <button
              type="button"
              className="gitui-btn gitui-btn-primary"
              disabled={source === "" || target === "" || source === target || mergeBusy}
              onClick={() => void startMerge()}
            >
              {t("merge.button", { source: source === "" ? "…" : source, target: target === "" ? "…" : target })}
            </button>
            {noFFOption}
            {onOpenRebase !== undefined && (
              <button
                type="button"
                className="gitui-btn"
                title={t("rebase.title")}
                disabled={mergeBusy}
                onClick={() => onOpenRebase()}
              >
                {t("rebase.title")}
              </button>
            )}
          </div>
          {notice !== null && <div className="gitui-ok" style={{ padding: "8px 0 0" }}>{notice}</div>}
          {mergeError !== null && <div className="gitui-error" style={{ padding: "8px 0 0" }}>{mergeError}</div>}
        </div>
      </div>
    );
  }

  const mergeSource = status?.mergeSource ?? null;
  const mergeTargetName = status?.branch ?? null;
  const directionKnown = mergeSource !== null && mergeTargetName !== null;

  return (
    <div className="gitui-detail" style={{ minHeight: 220 }}>
      <div className="gitui-detail-header">
        <span className="gitui-badge gitui-badge-danger">{conflicts.length}</span>
        <span style={{ flex: 1 }}>
          {conflicts.length > 0
            ? directionKnown
              ? t("merge.conflictsRemainInto", { n: conflicts.length, source: mergeSource as string, target: mergeTargetName as string })
              : t("merge.conflictsRemain", { n: conflicts.length })
            : directionKnown
              ? t("merge.inprogressInto", { source: mergeSource as string, target: mergeTargetName as string })
              : opState !== "merge"
                ? t("state." + opState)
                : t("merge.inprogress")}
        </span>
        <button type="button" className="gitui-btn gitui-btn-danger" disabled={finalBusy} onClick={() => void abortMerge()}>
          {t("merge.abort")}
        </button>
        {opState === "rebase" && (
          <button type="button" className="gitui-btn" disabled={finalBusy} title={t("merge.skipHint")} onClick={() => void skipCommit()}>
            {t("merge.skip")}
          </button>
        )}
        <button type="button" className="gitui-btn gitui-btn-primary" disabled={conflicts.length > 0 || finalBusy} onClick={() => void finishMerge()}>
          {t("merge.continue")}
        </button>
      </div>
      {conflicts.length === 0 && (
        <div className="gitui-commit">
          <textarea
            value={continueMessage}
            placeholder={t("merge.commitMessage")}
            onChange={(event) => setContinueMessage(event.target.value)}
          />
        </div>
      )}
      <div className="gitui-merge-list">
        {conflicts.map((path) => (
          <div key={path} className="gitui-conflict">
            <div className="gitui-conflict-head">
              <span className="gitui-file-status gitui-st-unmerged">U</span>
              <span className="gitui-file-path">{path}</span>
              <button type="button" className="gitui-btn" onClick={() => void openConflict(path)}>
                {expanded === path ? t("action.close") : t("conflict.edit")}
              </button>
            </div>
            {expanded === path && (
              <div className="gitui-conflict-body" style={{ padding: 0 }}>
                {conflict === null && resolved === null && <div className="gitui-diff-placeholder">…</div>}
                {conflict !== null && (
                  <MergeRevisions
                    api={api}
                    dir={dir}
                    path={path}
                    t={t}
                    view={conflict}
                    oursLabel={currentBranch ?? t("conflict.ours")}
                    theirsLabel={mergeSource ?? t("conflict.theirs")}
                    onSaved={onChanged}
                  />
                )}
                {resolved !== null && <div className="gitui-error" style={{ padding: "4px 10px" }}>{resolved}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
      {mergeError !== null && <div className="gitui-error">{mergeError}</div>}
    </div>
  );
}
