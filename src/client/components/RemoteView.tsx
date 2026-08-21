/**
 * Remotes tab — standalone management of git remotes: list, add, push the
 * current branch, and remove. Extracted from the History tab so remote
 * management lives on its own surface.
 */
import { useEffect, useState } from "react";
import type { GitApi } from "../api.js";
import type { RemoteInfo } from "../../types.js";
import type { GitUiT } from "./DiffView.js";

export function RemoteView(props: {
  api: GitApi;
  dir: string;
  t: GitUiT;
  onChanged: () => void;
}): JSX.Element {
  const { api, dir, t, onChanged } = props;
  const [remotes, setRemotes] = useState<RemoteInfo[] | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  /** Remote whose push form is open (null = closed). */
  const [pushFor, setPushFor] = useState<string | null>(null);
  const [pushLocal, setPushLocal] = useState("");
  const [pushRemote, setPushRemote] = useState("");
  const [pushForce, setPushForce] = useState(false);
  /** Remote being renamed/reconfigured (null = closed). */
  const [editingFor, setEditingFor] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  useEffect(() => {
    let alive = true;
    setError(null);
    setOk(null);
    void Promise.all([api.remotes(dir), api.branches(dir)])
      .then(([list, branchData]) => {
        if (!alive) return;
        setRemotes(list);
        setCurrentBranch(branchData.current);
      })
      .catch((caught) => {
        if (alive) setError((caught as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [api, dir]);

  async function refresh(): Promise<void> {
    try {
      setRemotes(await api.remotes(dir));
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function addRemote(): Promise<void> {
    const remoteName = name.trim();
    const remoteUrl = url.trim();
    if (remoteName === "" || remoteUrl === "") return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.remoteAdd(dir, remoteName, remoteUrl);
      setName("");
      setUrl("");
      setAdding(false);
      // Fetch right away so the remote branches show up in the Branches
      // tab and the title-bar switcher (git branch only knows fetched refs).
      try {
        await api.fetch(dir, remoteName);
      } catch (caught) {
        setError((caught as Error).message);
        return;
      }
      setOk(t("remote.added", { name: remoteName }));
      onChanged();
      await refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeRemote(remoteName: string): Promise<void> {
    if (!window.confirm(t("remote.removeConfirm", { name: remoteName }))) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.remoteRemove(dir, remoteName);
      setOk(t("remote.removed", { name: remoteName }));
      await refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Toggle the add form; prefill the name with "origin" when it is free. */
  function toggleAdding(): void {
    if (adding) {
      setAdding(false);
      return;
    }
    setAdding(true);
    if (remotes === null || remotes.some((remote) => remote.name === "origin")) {
      setName("");
    } else {
      setName("origin");
    }
  }

  function openEdit(remote: RemoteInfo): void {
    setEditingFor(remote.name);
    setEditName(remote.name);
    setEditUrl(remote.url);
    setError(null);
    setOk(null);
  }

  async function saveEdit(oldName: string): Promise<void> {
    const newName = editName.trim();
    const newUrl = editUrl.trim();
    if (newName === "" || newUrl === "") return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      if (newName !== oldName) await api.remoteRename(dir, oldName, newName);
      await api.remoteSetUrl(dir, newName, newUrl);
      setEditingFor(null);
      setOk(t("remote.edited", { name: newName }));
      onChanged();
      await refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Open the push form for a remote, prefilled with the current branch. */
  function openPush(remote: string): void {
    if (pushFor === remote) {
      setPushFor(null);
      return;
    }
    setPushFor(remote);
    setPushLocal(currentBranch ?? "");
    setPushRemote("");
    setPushForce(false);
    setError(null);
    setOk(null);
  }

  /** Push local -> remote branch (optionally force) to the given remote. */
  async function doPush(remote: string): Promise<void> {
    const local = pushLocal.trim();
    if (local === "") return;
    const target = pushRemote.trim();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.push(dir, remote, local, undefined, target === "" ? undefined : target, pushForce);
      setOk(
        target === "" || target === local
          ? t("push.done", { branch: local, remote })
          : t("push.doneTarget", { local, target, remote })
      );
      setPushFor(null);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Fetch the given remote so its branches show up locally. */
  async function fetchRemote(remote: string): Promise<void> {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const outcome = await api.fetch(dir, remote);
      setOk(outcome.message ?? t("fetch.done"));
      onChanged();
      await refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gitui-remotes-view">
      <div className="gitui-detail-header">
        <span>{t("remote.title")}</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="gitui-btn"
          disabled={busy}
          onClick={toggleAdding}
        >
          {adding ? t("action.close") : "+ " + t("remote.add")}
        </button>
      </div>
      {error !== null && <div className="gitui-error" style={{ padding: "4px 12px 0" }}>{error}</div>}
      {ok !== null && <div className="gitui-ok" style={{ padding: "4px 12px 0" }}>{ok}</div>}
      {adding && (
        <div className="gitui-branch-new gitui-remote-add">
          <input
            value={name}
            placeholder={t("remote.name")}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="gitui-remote-url-input"
            value={url}
            placeholder={t("remote.url")}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void addRemote();
            }}
          />
          <button
            type="button"
            className="gitui-btn gitui-btn-primary"
            disabled={busy || name.trim() === "" || url.trim() === ""}
            onClick={() => void addRemote()}
          >
            {t("remote.add")}
          </button>
        </div>
      )}
      <div className="gitui-remotes-list">
        {remotes === null && <div className="gitui-diff-placeholder">…</div>}
        {remotes !== null && remotes.length === 0 && !adding && (
          <div className="gitui-diff-placeholder">{t("remote.empty")}</div>
        )}
        {remotes !== null &&
          remotes.map((remote) => (
            <>
            <div key={remote.name} className="gitui-branch-row">
              <span className="gitui-file-path gitui-remote-name">{remote.name}</span>
              <span
                className="gitui-remote-url"
                title={remote.pushUrl !== undefined ? remote.pushUrl + " (push)" : remote.url}
              >
                {remote.pushUrl !== undefined ? remote.pushUrl : remote.url}
              </span>
              <button
                type="button"
                className="gitui-btn"
                disabled={busy}
                title={t("remote.fetchHint")}
                onClick={() => void fetchRemote(remote.name)}
              >
                {t("remote.fetch")}
              </button>
              <button
                type="button"
                className={"gitui-btn" + (pushFor === remote.name ? " gitui-active" : "")}
                disabled={busy || currentBranch === null}
                title={t("remote.pushHint", { branch: currentBranch ?? "…" })}
                onClick={() => openPush(remote.name)}
              >
                {t("remote.push")}
              </button>
              <button
                type="button"
                className="gitui-btn"
                disabled={busy}
                title={t("remote.edit")}
                onClick={() => openEdit(remote)}
              >
                {t("remote.edit")}
              </button>
              <button
                type="button"
                className="gitui-btn"
                disabled={busy}
                onClick={() => void removeRemote(remote.name)}
              >
                {t("remote.remove")}
              </button>
            </div>
            {pushFor === remote.name && (
              <div className="gitui-push-form">
                <input
                  className="gitui-push-input"
                  value={pushLocal}
                  placeholder={t("push.localPlaceholder")}
                  onChange={(event) => setPushLocal(event.target.value)}
                />
                <span className="gitui-push-arrow">→</span>
                <input
                  className="gitui-push-input"
                  value={pushRemote}
                  placeholder={t("push.remotePlaceholder", { branch: pushLocal !== "" ? pushLocal : (currentBranch ?? "") })}
                  onChange={(event) => setPushRemote(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void doPush(remote.name);
                  }}
                />
                <label className="gitui-push-force" title={t("push.forceHint")}>
                  <input
                    type="checkbox"
                    checked={pushForce}
                    onChange={(event) => setPushForce(event.target.checked)}
                  />
                  {t("push.force")}
                </label>
                <button
                  type="button"
                  className="gitui-btn gitui-btn-primary"
                  disabled={busy || pushLocal.trim() === ""}
                  onClick={() => void doPush(remote.name)}
                >
                  {t("remote.push")}
                </button>
                <button type="button" className="gitui-btn" disabled={busy} onClick={() => setPushFor(null)}>
                  {t("action.close")}
                </button>
              </div>
            )}
            {editingFor === remote.name && (
              <div className="gitui-branch-new gitui-remote-add">
                <input
                  value={editName}
                  placeholder={t("remote.name")}
                  onChange={(event) => setEditName(event.target.value)}
                />
                <input
                  className="gitui-remote-url-input"
                  value={editUrl}
                  placeholder={t("remote.url")}
                  onChange={(event) => setEditUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveEdit(remote.name);
                  }}
                />
                <button
                  type="button"
                  className="gitui-btn gitui-btn-primary"
                  disabled={busy || editName.trim() === "" || editUrl.trim() === ""}
                  onClick={() => void saveEdit(remote.name)}
                >
                  {t("remote.save")}
                </button>
                <button type="button" className="gitui-btn" disabled={busy} onClick={() => setEditingFor(null)}>
                  {t("action.close")}
                </button>
              </div>
            )}
            </>
          ))}
      </div>
    </div>
  );
}