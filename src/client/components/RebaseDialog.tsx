/**
 * RebaseDialog — dialog-style interactive rebase: pick a base (branches/tags
 * or any ref), assign pick/reword/squash/fixup/drop per commit, then start.
 */
import { useEffect, useMemo, useState } from "react";
import type { GitApi } from "../api.js";
import type { CommitInfo, RebaseItem } from "../../types.js";
import type { GitUiT } from "./DiffView.js";

const ACTIONS: Array<{ value: RebaseItem["action"]; labelKey: string }> = [
  { value: "pick", labelKey: "rebase.pick" },
  { value: "reword", labelKey: "rebase.reword" },
  { value: "squash", labelKey: "rebase.squash" },
  { value: "fixup", labelKey: "rebase.fixup" },
  { value: "drop", labelKey: "rebase.drop" }
];

export function RebaseDialog(props: {
  api: GitApi;
  dir: string;
  t: GitUiT;
  /** Preselected base ref (e.g. from a branch context menu). */
  baseHint?: string;
  onDone: () => void;
  onConflicts: () => void;
  onClose: () => void;
}): JSX.Element {
  const { api, dir, t, baseHint, onDone, onConflicts, onClose } = props;
  const [commits, setCommits] = useState<CommitInfo[] | null>(null);
  const [defaultBase, setDefaultBase] = useState("");
  const [refOptions, setRefOptions] = useState<string[]>([]);
  const [base, setBase] = useState("");
  const [actions, setActions] = useState<RebaseItem["action"][]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = (baseRef: string): void => {
    setCommits(null);
    setError(null);
    void api
      .rebaseList(dir)
      .then((value) => {
        setDefaultBase(value.base);
        setCommits(value.commits);
        setActions(value.commits.map(() => "pick" as const));
        setMessages(value.commits.map((c) => c.subject));
        if (baseRef === "") setBase(value.base);
      })
      .catch((caught) => setError((caught as Error).message));
  };

  useEffect(() => {
    load(baseHint ?? "");
    void api
      .branches(dir)
      .then((value) => {
        const local = value.branches.filter((b) => !b.name.startsWith("remotes/")).map((b) => b.name);
        void api.tags(dir).then((tags) => {
          setRefOptions([...local, ...tags.map((tag) => tag.name)]);
        });
      })
      .catch(() => setRefOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, dir]);

  const items = useMemo<RebaseItem[]>(() => {
    return (commits ?? []).map((commit, index) => ({
      action: actions[index] ?? "pick",
      hash: commit.hash,
      ...(actions[index] === "reword" || actions[index] === "squash"
        ? { message: messages[index] ?? commit.subject }
        : {})
    }));
  }, [commits, actions, messages]);

  async function start(): Promise<void> {
    if (commits === null || base.trim() === "") return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await api.rebaseStart(dir, base.trim(), items);
      if (outcome.conflicts !== undefined && outcome.conflicts.length > 0) {
        onConflicts();
      } else {
        onDone();
      }
      onClose();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gitui-dialog">
      <div className="gitui-dialog-box gitui-rebase-dialog">
        <div className="gitui-detail-header">
          <span>{t("rebase.title")}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="gitui-btn" onClick={onClose}>✕</button>
        </div>
        <div className="gitui-dialog-body">
          <div className="gitui-ops-row">
            <span className="gitui-merge-label">{t("rebase.onto")}</span>
            <input
              className="gitui-dir gitui-rebase-base"
              list="gitui-rebase-refs"
              value={base}
              placeholder={defaultBase}
              spellCheck={false}
              onChange={(event) => setBase(event.target.value)}
            />
            <datalist id="gitui-rebase-refs">
              {refOptions.map((ref) => (
                <option key={ref} value={ref} />
              ))}
            </datalist>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="gitui-btn gitui-btn-primary"
              disabled={busy || commits === null || commits.length === 0 || base.trim() === ""}
              onClick={() => void start()}
            >
              {t("rebase.start")}
            </button>
          </div>
          {error !== null && <div className="gitui-error" style={{ padding: "4px 10px" }}>{error}</div>}
          <div className="gitui-dialog-list">
            {commits === null && <div className="gitui-diff-placeholder">…</div>}
            {commits !== null && commits.length === 0 && (
              <div className="gitui-diff-placeholder">{t("rebase.nothing")}</div>
            )}
            {commits !== null &&
              commits.map((commit, index) => {
                const action = actions[index] ?? "pick";
                const first = index === 0;
                return (
                  <div key={commit.hash} className="gitui-rebase-row">
                    <span className="gitui-commit-hash">{commit.short}</span>
                    <span className="gitui-commit-subject" title={commit.subject}>{commit.subject}</span>
                    <span className="gitui-commit-meta">{commit.author}</span>
                    <select
                      className="gitui-dir gitui-rebase-action"
                      value={action}
                      disabled={busy}
                      title={first && (action === "squash" || action === "fixup") ? t("rebase.firstHint") : ""}
                      onChange={(event) => {
                        const next = event.target.value as RebaseItem["action"];
                        setActions((prev) => {
                          const copy = [...prev];
                          copy[index] = next;
                          return copy;
                        });
                      }}
                    >
                      {ACTIONS.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          disabled={first && (option.value === "squash" || option.value === "fixup")}
                        >
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                    {(action === "reword" || action === "squash") && (
                      <input
                        className="gitui-dir gitui-rebase-msg"
                        value={messages[index] ?? ""}
                        placeholder={commit.subject}
                        spellCheck={false}
                        disabled={busy}
                        onChange={(event) => {
                          setMessages((prev) => {
                            const copy = [...prev];
                            copy[index] = event.target.value;
                            return copy;
                          });
                        }}
                      />
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
