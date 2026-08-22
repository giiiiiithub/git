/**
 * AI one-click commit planner: calls suggestCommits on mount, shows the
 * planned groups (editable messages + file lists), then executes them through
 * executeCommits with per-group progress and results.
 */
import { useEffect, useState } from "react";
import type { GitApi } from "../api.js";
import type { CommitGroup, ExecutedCommit } from "../../types.js";
import type { GitUiT } from "./DiffView.js";
import { Toast } from "./Toast.js";

export function CommitPlan(props: {
  api: GitApi;
  dir: string;
  t: GitUiT;
  onDone: (results: ExecutedCommit[]) => void;
  onCancel: () => void;
}): JSX.Element {
  const { api, dir, t, onDone, onCancel } = props;
  const [groups, setGroups] = useState<CommitGroup[] | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ExecutedCommit[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .suggestCommits(dir)
      .then((planned) => {
        if (!alive) return;
        setGroups(planned);
        setMessages(planned.map((group) => group.message));
        setLoading(false);
      })
      .catch((caught) => {
        if (!alive) return;
        setError((caught as Error).message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [api, dir]);

  async function execute(): Promise<void> {
    if (groups === null) return;
    setExecuting(true);
    setError(null);
    const finalGroups = groups.map((group, index) => ({
      message: messages[index] ?? group.message,
      files: group.files
    }));
    // Per-group progress: run one commit at a time.
    const committed: ExecutedCommit[] = [];
    try {
      for (let i = 0; i < finalGroups.length; i++) {
        setProgress(i + 1);
        const batch = await api.executeCommits(dir, [finalGroups[i] as CommitGroup]);
        committed.push(...batch);
      }
      setResults(committed);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setExecuting(false);
    }
  }

  if (loading) {
    return <div className="gitui-commit-plan"><div className="gitui-diff-placeholder">{t("commit.analyzing")}</div></div>;
  }
  if (error !== null && groups === null) {
    return (
      <div className="gitui-commit-plan">
        <div className="gitui-error" style={{ padding: 12 }}>{error}</div>
        <div className="gitui-commit-plan-actions">
          <button type="button" className="gitui-btn" onClick={onCancel}>{t("commit.cancel")}</button>
        </div>
      </div>
    );
  }
  if (groups === null) return <></>;

  return (
    <div className="gitui-commit-plan">
      <div className="gitui-detail-header">
        <span>{t("commit.planTitle")}</span>
        <span className="gitui-commit-meta">
          {t("commit.planDesc", { n: String(groups.length) })}
        </span>
        <span style={{ flex: 1 }} />
        {results === null && (
          <button type="button" className="gitui-btn" disabled={executing} onClick={onCancel}>
            {t("commit.cancel")}
          </button>
        )}
      </div>
      <div className="gitui-commit-plan-list">
        {groups.map((group, index) => {
          const done = results !== null && index < results.length;
          const current = executing && progress === index + 1;
          return (
            <div key={index} className={"gitui-plan-group" + (done ? " gitui-plan-group-done" : current ? " gitui-plan-group-current" : "")}>
              <div className="gitui-plan-group-head">
                <span className="gitui-plan-index">{index + 1}</span>
                <span className="gitui-plan-files">
                  {group.files.map((file) => (
                    <span key={file} className="gitui-plan-file">{file}</span>
                  ))}
                </span>
                {done && results[index] !== undefined && (
                  <span className="gitui-plan-hash">{results[index]?.short}</span>
                )}
              </div>
              <textarea
                className="gitui-plan-message"
                value={messages[index] ?? ""}
                disabled={executing || done}
                onChange={(event) => {
                  setMessages((prev) => {
                    const next = [...prev];
                    next[index] = event.target.value;
                    return next;
                  });
                }}
                spellCheck={false}
              />
            </div>
          );
        })}
      </div>
      <Toast message={error} tone="error" />
      {results === null ? (
        <div className="gitui-commit-plan-actions">
          <button
            type="button"
            className="gitui-btn gitui-btn-primary"
            disabled={executing}
            onClick={() => void execute()}
          >
            {executing ? t("commit.executing", { i: String(progress), n: String(groups.length) }) : t("commit.execute", { n: String(groups.length) })}
          </button>
        </div>
      ) : (
        <div className="gitui-commit-plan-actions">
          <Toast message={t("commit.executed", { n: String(results.length) })} />
          <button type="button" className="gitui-btn gitui-btn-primary" onClick={() => onDone(results)}>
            {t("commit.doneBtn")}
          </button>
        </div>
      )}
    </div>
  );
}
