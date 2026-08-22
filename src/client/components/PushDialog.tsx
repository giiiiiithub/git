/**
 * PushDialog — IDEA-style push preview: outgoing commits for the current
 * branch, upstream status, force / follow-tags options, then push.
 */
import { useEffect, useState } from "react";
import type { GitApi } from "../api.js";
import type { CommitInfo, RemoteInfo } from "../../types.js";
import type { GitUiT } from "./DiffView.js";
import { Toast } from "./Toast.js";

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PushDialog(props: {
  api: GitApi;
  dir: string;
  branch: string;
  t: GitUiT;
  onDone: () => void;
  onClose: () => void;
}): JSX.Element {
  const { api, dir, branch, t, onDone, onClose } = props;
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [remote, setRemote] = useState("");
  const [preview, setPreview] = useState<{ upstream: string | null; ahead: CommitInfo[] } | null>(null);
  const [force, setForce] = useState(false);
  const [followTags, setFollowTags] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    void api
      .remotes(dir)
      .then((list) => {
        if (!alive) return;
        setRemotes(list);
        const preferred = list.find((r) => r.name === "origin") ?? list[0];
        const name = preferred?.name ?? "";
        setRemote(name);
        if (name !== "") {
          void api
            .pushPreview(dir, name, branch)
            .then((value) => {
              if (alive) setPreview(value);
            })
            .catch((caught) => {
              if (alive) setError((caught as Error).message);
            });
        }
      })
      .catch(() => setRemotes([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, dir]);

  async function doPush(): Promise<void> {
    if (remote === "") return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const noUpstream = preview?.upstream === null;
      await api.push(dir, remote, branch, noUpstream ? true : undefined, undefined, force, followTags);
      setOk(t("push.done", { branch, remote }));
      onDone();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gitui-dialog">
      <div className="gitui-dialog-box">
        <div className="gitui-detail-header">
          <span>{t("push.preview")}</span>
          <span className="gitui-commit-meta">
            {branch}
            {preview !== null && (preview.upstream !== null ? ` → ${preview.upstream}` : ` → ${remote} (${t("push.newBranch")})`)}
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" className="gitui-btn" onClick={onClose}>✕</button>
        </div>
        <div className="gitui-dialog-body">
          <div className="gitui-ops-row">
            <select className="gitui-dir" value={remote} onChange={(event) => setRemote(event.target.value)} disabled={busy}>
              {remotes.map((item) => (
                <option key={item.name} value={item.name}>{item.name}</option>
              ))}
            </select>
            <label className="gitui-merge-option" title={t("push.forceHint")}>
              <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} disabled={busy} />
              {t("push.force")}
            </label>
            <label className="gitui-merge-option" title={t("push.followTagsHint")}>
              <input type="checkbox" checked={followTags} onChange={(event) => setFollowTags(event.target.checked)} disabled={busy} />
              {t("push.followTags")}
            </label>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="gitui-btn gitui-btn-primary"
              disabled={busy || remote === "" || (preview !== null && preview.ahead.length === 0)}
              onClick={() => void doPush()}
            >
              {t("remote.push")}
            </button>
          </div>
          <div className="gitui-dialog-list">
            {preview === null && <div className="gitui-diff-placeholder">…</div>}
            {preview !== null && preview.ahead.length === 0 && (
              <div className="gitui-diff-placeholder">{t("push.upToDate")}</div>
            )}
            {preview !== null &&
              preview.ahead.map((commit) => (
                <div key={commit.hash} className="gitui-branch-row">
                  <span className="gitui-commit-hash">{commit.short}</span>
                  <span className="gitui-commit-subject" title={commit.subject}>{commit.subject}</span>
                  <span className="gitui-commit-meta">{commit.author}</span>
                  <span className="gitui-commit-meta">{formatDate(commit.date)}</span>
                </div>
              ))}
          </div>
          <Toast message={error !== null ? error : ok} tone={error !== null ? "error" : "ok"} />
        </div>
      </div>
    </div>
  );
}
