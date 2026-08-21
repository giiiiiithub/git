/**
 * CloneDialog — clone a remote repository: URL + target directory (full path,
 * git clone semantics). A quick button fills the target under the current
 * session working directory with the repo name derived from the URL.
 */
import { useState } from "react";
import type { GitApi } from "../api.js";
import type { GitUiT } from "./DiffView.js";

/** Derive a directory name from a remote URL (https, ssh, git, file…). */
function repoNameFromUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "").replace(/\.git$/i, "");
  const last = trimmed.split(/[\\/:]/).filter(Boolean).pop() ?? "";
  return last.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim();
}

/** Browser-side path join (no node path module); normalizes trailing separators. */
function joinPath(base: string, name: string): string {
  return base.replace(/[\\/]+$/, "") + "/" + name;
}

export function CloneDialog(props: {
  api: GitApi;
  t: GitUiT;
  /** Current session working directory; may be empty. */
  sessionDir: string;
  onDone: (root: string) => void;
  onClose: () => void;
}): JSX.Element {
  const { api, t, sessionDir, onDone, onClose } = props;
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doClone(): Promise<void> {
    const u = url.trim();
    const tgt = target.trim();
    if (u === "" || tgt === "" || busy) return;
    setBusy(true);
    setError(null);
    try {
      const root = await api.clone(u, tgt);
      onDone(root);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const fillSessionTarget = (): void => {
    const base = sessionDir.trim();
    if (base === "") return;
    const name = repoNameFromUrl(url);
    setTarget(name === "" ? base : joinPath(base, name));
  };

  return (
    <div className="gitui-dialog">
      <div className="gitui-dialog-box gitui-clone-dialog">
        <div className="gitui-detail-header">
          <span>{t("clone.title")}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="gitui-btn" onClick={onClose}>✕</button>
        </div>
        <div className="gitui-dialog-body">
          <div className="gitui-clone-row">
            <span className="gitui-clone-label">{t("clone.url")}</span>
            <input
              className="gitui-dir"
              value={url}
              placeholder={t("clone.urlPlaceholder")}
              spellCheck={false}
              disabled={busy}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void doClone();
              }}
            />
          </div>
          <div className="gitui-clone-row">
            <span className="gitui-clone-label">{t("clone.target")}</span>
            <input
              className="gitui-dir"
              value={target}
              placeholder={t("clone.targetPlaceholder")}
              spellCheck={false}
              disabled={busy}
              onChange={(event) => setTarget(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void doClone();
              }}
            />
            <button
              type="button"
              className="gitui-btn"
              title={t("clone.useSessionHint")}
              disabled={busy || sessionDir.trim() === ""}
              onClick={fillSessionTarget}
            >
              {t("clone.useSession")}
            </button>
          </div>
          <div className="gitui-clone-foot">
            <span className="gitui-clone-hint">
              {sessionDir.trim() === "" ? t("clone.sessionUnavailable") : t("clone.sessionHint", { dir: sessionDir })}
            </span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="gitui-btn gitui-btn-primary"
              disabled={busy || url.trim() === "" || target.trim() === ""}
              onClick={() => void doClone()}
            >
              {busy ? t("clone.busy") : t("clone.submit")}
            </button>
          </div>
          {error !== null && <div className="gitui-error" style={{ padding: "4px 10px" }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
