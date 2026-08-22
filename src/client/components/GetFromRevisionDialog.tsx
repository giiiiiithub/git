/**
 * GetFromRevisionDialog — pick a revision and check the selected change
 * file(s) out at that revision (IDEA's "Get from revision"). Lists recent
 * commits for one-click selection, but the user may type any revision/ref.
 */
import { useEffect, useState } from "react";
import type { GitApi } from "../api.js";
import type { GitUiT } from "./DiffView.js";
import type { GraphRow } from "../../types.js";

export function GetFromRevisionDialog(props: {
  api: GitApi;
  t: GitUiT;
  dir: string;
  /** The selected changed-file paths to check out at the chosen revision. */
  paths: string[];
  onDone: () => void;
  onClose: () => void;
}): JSX.Element {
  const { api, t, dir, paths, onDone, onClose } = props;
  const [revision, setRevision] = useState("");
  const [rows, setRows] = useState<GraphRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.logGraph(dir, 100)
      .then((list) => { if (alive) setRows(list); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [api, dir]);

  async function doGet(): Promise<void> {
    const rev = revision.trim();
    if (rev === "" || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.getFromRevision(dir, paths, rev);
      onDone();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gitui-dialog">
      <div className="gitui-dialog-box gitui-clone-dialog">
        <div className="gitui-detail-header">
          <span>{t("getFromRevision.title")}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="gitui-btn" onClick={onClose}>✕</button>
        </div>
        <div className="gitui-dialog-body">
          <div className="gitui-clone-row">
            <span className="gitui-clone-label">{t("getFromRevision.revision")}</span>
            <input
              className="gitui-dir"
              value={revision}
              placeholder={t("getFromRevision.revisionPlaceholder")}
              spellCheck={false}
              autoFocus
              onChange={(event) => setRevision(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void doGet();
              }}
            />
            <span className="gitui-clone-hint">
              {t("getFromRevision.paths", { n: paths.length })}
            </span>
          </div>
          {rows.length > 0 && (
            <div className="gitui-dialog-list" style={{ minHeight: 160, maxHeight: 260 }}>
              {rows.map((row) => (
                <div
                  key={row.hash}
                  className={"gitui-log-row" + (row.hash === revision ? " gitui-log-row-selected" : "")}
                  style={{ borderLeft: "none", cursor: "pointer" }}
                  title={row.hash}
                  onClick={() => setRevision(row.hash)}
                >
                  <span className="gitui-log-graph" style={{ minWidth: 8 }} />
                  <span className="gitui-commit-subject">{row.subject}</span>
                  <span className="gitui-commit-meta">{row.short}</span>
                </div>
              ))}
            </div>
          )}
          <div className="gitui-clone-foot">
            <span className="gitui-clone-hint">
              {revision === "" ? t("getFromRevision.hint") : t("getFromRevision.willGet", { rev: revision })}
            </span>
            <span style={{ flex: 1 }} />
            <button type="button" className="gitui-btn" disabled={busy} onClick={onClose}>
              {t("commit.cancel")}
            </button>
            <button
              type="button"
              className="gitui-btn gitui-btn-primary"
              disabled={busy || revision.trim() === ""}
              onClick={() => void doGet()}
            >
              {busy ? t("getFromRevision.busy") : t("getFromRevision.submit")}
            </button>
          </div>
          {error !== null && <div className="gitui-error" style={{ padding: "4px 10px" }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
