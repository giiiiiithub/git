/**
 * Branches tab — IDEA-style branch management: local branches with
 * checkout / rename / delete per row (delete first tries the safe -d and
 * offers a force path when the branch is not fully merged), remote branches
 * listed read-only, and a create-branch input based on the current HEAD.
 */
import { useEffect, useState } from "react";
import type { GitApi } from "../api.js";
import type { BranchInfo, CompareFile, TagInfo } from "../../types.js";
import type { GitUiT } from "./DiffView.js";
import { Menu, type MenuItem } from "./Menu.js";
import { Toast } from "./Toast.js";

export function BranchesView(props: {
  api: GitApi;
  dir: string;
  t: GitUiT;
  onChanged: () => void;
  /** Open the interactive rebase dialog, optionally with a preset base. */
  onOpenRebase?: (base?: string) => void;
  /** A merge stopped on conflicts: jump to the Merge tab for resolution. */
  onOpenConflicts?: () => void;
}): JSX.Element {
  const { api, dir, t, onChanged, onOpenRebase, onOpenConflicts } = props;
  const [branches, setBranches] = useState<BranchInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newBranch, setNewBranch] = useState("");
  /** Branch whose safe delete just failed with "not fully merged". */
  const [forceCandidate, setForceCandidate] = useState<string | null>(null);
  /** Branch whose reset mode picker is open. */
  const [resetFor, setResetFor] = useState<string | null>(null);
  /** Compare panel target + result. */
  const [compareFor, setCompareFor] = useState<string | null>(null);
  const [compareFiles, setCompareFiles] = useState<CompareFile[] | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  /** Configured remote names (git remote), for the remote-area empty state. */
  const [configuredRemotes, setConfiguredRemotes] = useState<string[]>([]);
  /** Tags. */
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [newTag, setNewTag] = useState("");
  /** Context menu on a branch row. */
  const [menu, setMenu] = useState<{ x: number; y: number; branch: BranchInfo } | null>(null);

  async function refresh(): Promise<void> {
    setBranches(null);
    setError(null);
    try {
      const value = await api.branches(dir);
      setBranches(value.branches);
      setConfiguredRemotes(value.remotes);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  function loadTags(): void {
    api
      .tags(dir)
      .then(setTags)
      .catch(() => setTags([]));
  }

  useEffect(() => {
    refresh();
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, dir]);

  function resetBranch(branch: BranchInfo, mode: "soft" | "mixed" | "hard"): void {
    setResetFor(null);
    const target = branch.current ? "HEAD" : branch.name;
    run(t("reset.done", { branch: branch.name, mode }), () => api.reset(dir, mode, target));
  }

  async function openCompare(branch: BranchInfo): Promise<void> {
    if (compareFor === branch.name) {
      setCompareFor(null);
      setCompareFiles(null);
      return;
    }
    setCompareFor(branch.name);
    setCompareFiles(null);
    setCompareError(null);
    try {
      const current = (branches ?? []).find((b) => b.current);
      const from = branch.current ? branch.name : current?.name ?? "HEAD";
      const to = branch.current ? current?.name ?? "HEAD" : branch.name;
      setCompareFiles(await api.compare(dir, from, to));
    } catch (caught) {
      setCompareError((caught as Error).message);
    }
  }

  async function createTag(): Promise<void> {
    const name = newTag.trim();
    if (name === "") return;
    setNewTag("");
    await run(t("tag.created", { name }), () => api.tagCreate(dir, name));
    loadTags();
  }

  async function deleteTag(name: string): Promise<void> {
    if (!window.confirm(t("tag.deleteConfirm", { name }))) return;
    await run(t("tag.deleted", { name }), () => api.tagDelete(dir, name));
    loadTags();
  }

  function run(label: string, operation: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    return operation()
      .then(async () => {
        setNotice(label);
        await refresh();
        onChanged();
      })
      .catch((caught) => {
        setError((caught as Error).message);
      })
      .finally(() => setBusy(false));
  }

  /** IDEA-style branch context menu. */
  function branchMenuItems(branch: BranchInfo): MenuItem[] {
    const current = branch.current;
    return [
      {
        label: t("branch.checkout"),
        disabled: current,
        onClick: () => switchTo(branch.name)
      },
      {
        label: t("menu.newBranchFrom"),
        onClick: () => {
          const name = window.prompt(t("menu.newBranchFromPrompt"), "");
          if (name !== null && name.trim() !== "") {
            run(t("branch.created", { name: name.trim() }), () => api.checkout(dir, name.trim(), true, branch.name));
          }
        }
      },
      {
        label: t("menu.mergeIntoCurrent"),
        disabled: current,
        onClick: () => {
          run(t("merge.done", { short: "", subject: branch.name }), async () => {
            const outcome = await api.merge(dir, branch.name);
            if (outcome.kind === "conflicts") {
              await api.refreshStatus(dir);
              onOpenConflicts?.();
            } else if (outcome.kind === "error") {
              setError(outcome.message ?? "无法开始合并");
            }
          });
        }
      },
      {
        label: t("menu.rebaseCurrentOnto"),
        disabled: current,
        onClick: () => onOpenRebase?.(branch.name)
      },
      { separator: true, label: "" },
      {
        label: t("branch.rename"),
        disabled: current,
        onClick: () => renameBranch(branch)
      },
      {
        label: t("branch.delete"),
        danger: true,
        disabled: current,
        onClick: () => deleteBranch(branch)
      },
      {
        label: t("reset.action"),
        children: (["soft", "mixed", "hard"] as const).map((mode) => ({
          label: mode,
          danger: mode === "hard",
          onClick: () => resetBranch(branch, mode)
        }))
      },
      {
        label: t("compare.action"),
        onClick: () => void openCompare(branch)
      }
    ];
  }

  function switchTo(name: string): void {
    run(t("branch.switched", { name }), () => api.checkout(dir, name));
  }

  function createBranch(): void {
    const name = newBranch.trim();
    if (name === "") return;
    setNewBranch("");
    run(t("branch.created", { name }), () => api.checkout(dir, name, true));
  }

  function renameBranch(branch: BranchInfo): void {
    const next = window.prompt(t("branch.renamePrompt"), branch.name);
    if (next === null) return;
    const name = next.trim();
    if (name === "" || name === branch.name) return;
    run(t("branch.renamed", { oldName: branch.name, newName: name }), () =>
      api.renameBranch(dir, branch.name, name)
    );
  }

  function deleteBranch(branch: BranchInfo): void {
    setForceCandidate(null);
    if (!window.confirm(t("branch.deleteConfirm", { name: branch.name }))) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    api
      .deleteBranch(dir, branch.name, false)
      .then(() => {
        setNotice(t("branch.deleted", { name: branch.name }));
        refresh();
        onChanged();
      })
      .catch((caught) => {
        const message = (caught as Error).message;
        setError(message);
        if (/未完全合并|not fully merged/i.test(message)) setForceCandidate(branch.name);
      })
      .finally(() => setBusy(false));
  }

  function forceDelete(branch: BranchInfo): void {
    run(t("branch.deleted", { name: branch.name }), () => api.deleteBranch(dir, branch.name, true));
  }

  const local = (branches ?? []).filter((branch) => !branch.name.startsWith("remotes/"));
  const remotes = (branches ?? []).filter((branch) => branch.name.startsWith("remotes/"));
  /** Name of the branch the compare starts from (the other side). */
  const compareFromName = (branch: BranchInfo): string => {
    const current = (branches ?? []).find((b) => b.current);
    if (branch.current) return current?.name ?? "HEAD";
    return current?.name ?? "HEAD";
  };

  const branchRow = (branch: BranchInfo): JSX.Element => (
    <div
      key={branch.name}
      className="gitui-branch-row"
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY, branch });
      }}
    >
      {branch.current && <span className="gitui-current-tag">{t("branch.current")}</span>}
      <span className="gitui-file-path" title={branch.name}>
        {branch.name}
      </span>
      {branch.upstream !== undefined && (
        <span className="gitui-commit-meta">→ {branch.upstream}</span>
      )}
      <span style={{ flex: 1 }} />
      {!branch.current && (
        <>
          <button
            type="button"
            className="gitui-btn"
            disabled={busy}
            onClick={() => switchTo(branch.name)}
          >
            {t("branch.checkout")}
          </button>
          <button
            type="button"
            className="gitui-btn"
            disabled={busy}
            onClick={() => renameBranch(branch)}
          >
            {t("branch.rename")}
          </button>
          <button
            type="button"
            className="gitui-btn"
            disabled={busy}
            title={t("reset.hint", { branch: branch.name })}
            onClick={() => setResetFor(resetFor === branch.name ? null : branch.name)}
          >
            {t("reset.action")}
          </button>
          <button
            type="button"
            className={"gitui-btn" + (compareFor === branch.name ? " gitui-active" : "")}
            disabled={busy}
            title={t("compare.hint", { branch: branch.name })}
            onClick={() => void openCompare(branch)}
          >
            {t("compare.action")}
          </button>
          <button
            type="button"
            className="gitui-btn gitui-btn-danger"
            disabled={busy}
            onClick={() => deleteBranch(branch)}
          >
            {t("branch.delete")}
          </button>
        </>
      )}
      {forceCandidate === branch.name && (
        <button
          type="button"
          className="gitui-btn gitui-btn-danger"
          disabled={busy}
          onClick={() => forceDelete(branch)}
        >
          {t("branch.forceDelete")}
        </button>
      )}
      {resetFor === branch.name && (
        <div className="gitui-branch-new" style={{ paddingLeft: 24 }}>
          <span className="gitui-merge-label">{t("reset.pick")}</span>
          <button type="button" className="gitui-btn" disabled={busy} onClick={() => resetBranch(branch, "soft")}>
            soft
          </button>
          <button type="button" className="gitui-btn" disabled={busy} onClick={() => resetBranch(branch, "mixed")}>
            mixed
          </button>
          <button type="button" className="gitui-btn gitui-btn-danger" disabled={busy} onClick={() => resetBranch(branch, "hard")}>
            hard
          </button>
        </div>
      )}
      {compareFor === branch.name && (
        <div className="gitui-compare-panel">
          {compareFiles === null && compareError === null && <div className="gitui-diff-placeholder">…</div>}
          {compareError !== null && <div className="gitui-error" style={{ padding: "4px 12px" }}>{compareError}</div>}
          {compareFiles !== null && (
            <>
              <div className="gitui-compare-head">
                {t("compare.title", { from: compareFromName(branch), to: branch.name })}
                <span style={{ flex: 1 }} />
                <span className="gitui-commit-meta">{compareFiles.length} {t("compare.files")}</span>
              </div>
              {compareFiles.map((file) => (
                <div key={file.path} className="gitui-branch-row">
                  <span className={"gitui-file-status " + (file.status === "D" ? "gitui-st-deleted" : file.status === "A" ? "gitui-st-added" : "gitui-st-modified")}>
                    {file.status || "M"}
                  </span>
                  <span className="gitui-file-path" title={file.path}>{file.path}</span>
                  <span className="gitui-numstat">
                    {file.additions !== null && <span className="gitui-num-add">+{file.additions}</span>}
                    {file.deletions !== null && <span className="gitui-num-del">-{file.deletions}</span>}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );

  /** Check out the local counterpart of a remote branch and pull it. */
  async function pullRemote(remoteRef: string): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const outcome = await api.pullRemoteBranch(dir, remoteRef);
      setNotice(t("remoteBranch.pulled", { branch: outcome.branch }));
      onChanged();
      await refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Fetch all configured remotes (git fetch) so remote branches refresh. */
  async function fetchRemotes(): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const outcome = await api.fetch(dir);
      setNotice(outcome.message ?? t("fetch.done"));
      onChanged();
      await refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Remote branch row: checkout to local + pull. No destructive ops. */
  const remoteRow = (branch: BranchInfo): JSX.Element => (
    <div key={branch.name} className="gitui-branch-row">
      <span className="gitui-remote-icon">⇄</span>
      <span className="gitui-file-path" title={branch.name}>{branch.name.replace(/^remotes\//, "")}</span>
      <span style={{ flex: 1 }} />
      <button
        type="button"
        className="gitui-btn"
        disabled={busy}
        title={t("branch.checkout")}
        onClick={() => switchTo(branch.name)}
      >
        {t("branch.checkout")}
      </button>
      <button
        type="button"
        className="gitui-btn gitui-btn-primary"
        disabled={busy}
        title={t("remoteBranch.pullHint")}
        onClick={() => void pullRemote(branch.name)}
      >
        {t("remoteBranch.pull")}
      </button>
    </div>
  );
  return (
    <div className="gitui-detail" style={{ minHeight: 220 }}>
      <div className="gitui-detail-header">
        <span>{t("branch.local")}</span>
        <span style={{ flex: 1 }} />
        <span className="gitui-commit-meta">{local.length}</span>
        <button type="button" className="gitui-btn" disabled={busy || dir === ""} onClick={refresh}>
          {t("action.refresh")}
        </button>
      </div>
      <Toast message={notice} />
      {error !== null && <div className="gitui-error" style={{ padding: "6px 12px 0" }}>{error}</div>}
      <div className="gitui-branches-scroll">
        {branches === null && <div className="gitui-diff-placeholder">…</div>}
        {branches !== null && local.length === 0 && (
          <div className="gitui-diff-placeholder">{t("branch.empty")}</div>
        )}
        {local.map(branchRow)}
      </div>
      <div className="gitui-detail-header">
        <span>{t("branch.remote")}</span>
        <span style={{ flex: 1 }} />
        <span className="gitui-commit-meta">{remotes.length}</span>
        <button type="button" className="gitui-btn" disabled={busy || dir === ""} title={t("remote.fetchHint")} onClick={() => void fetchRemotes()}>
          {t("remote.fetch")}
        </button>
      </div>
      <div className="gitui-branches-scroll">
        {remotes.length === 0 && (
          <div className="gitui-diff-placeholder">
            {configuredRemotes.length === 0 ? t("branch.noRemotes") : t("branch.remoteEmpty")}
          </div>
        )}
        {remotes.map(remoteRow)}
      </div>
      <div className="gitui-branch-new">
        <input
          value={newBranch}
          placeholder={t("branch.createPrompt")}
          onChange={(event) => setNewBranch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") createBranch();
          }}
        />
        <button
          type="button"
          className="gitui-btn"
          disabled={busy || newBranch.trim() === "" || dir === ""}
          onClick={createBranch}
        >
          {t("branch.create")}
        </button>
      </div>
      <div className="gitui-detail-header">
        <span>{t("tag.title")}</span>
        <span style={{ flex: 1 }} />
        <span className="gitui-commit-meta">{tags.length}</span>
      </div>
      <div className="gitui-branches-scroll">
        {tags.length === 0 && <div className="gitui-diff-placeholder" style={{ padding: 8 }}>{t("tag.empty")}</div>}
        {tags.map((tag) => (
          <div key={tag.name} className="gitui-branch-row">
            <span className="gitui-commit-meta">🏷</span>
            <span className="gitui-file-path" title={tag.subject}>{tag.name}</span>
            <span className="gitui-commit-meta">{tag.short}</span>
            <button type="button" className="gitui-btn" disabled={busy} onClick={() => void deleteTag(tag.name)}>
              {t("tag.delete")}
            </button>
          </div>
        ))}
        <div className="gitui-branch-new">
          <input
            value={newTag}
            placeholder={t("tag.createPrompt")}
            onChange={(event) => setNewTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createTag();
            }}
          />
          <button type="button" className="gitui-btn" disabled={busy || newTag.trim() === ""} onClick={() => void createTag()}>
            {t("tag.create")}
          </button>
        </div>
      </div>
      {menu !== null && (
        <Menu x={menu.x} y={menu.y} items={branchMenuItems(menu.branch)} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
