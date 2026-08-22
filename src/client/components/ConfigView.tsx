/**
 * Config tab — view and edit git config in the three standard scopes:
 * system (--system) → user (--global) → project (--local), later levels
 * override earlier ones. Each scope lists its keys; clicking a value turns
 * it into an input (Enter saves, Esc cancels); a quick-add row creates new
 * keys and a delete button removes them.
 *
 * The tab also shows an authentication guide tailored to the repo's remotes:
 * GitHub no longer accepts account passwords over HTTPS (PAT or SSH only),
 * GitLab accepts a password or a personal access token (PAT mandatory with
 * 2FA). Missing user.name / user.email is flagged as well.
 */
import { useEffect, useState } from "react";
import type { GitApi } from "../api.js";
import { Toast } from "./Toast.js";
import type { RemoteInfo } from "../../types.js";
import type { GitUiT } from "./DiffView.js";

interface ConfigEntry {
  key: string;
  value: string;
}

type ConfigScope = "system" | "global" | "local";

/** Common keys offered in the quick-add row. */
const COMMON_KEYS = [
  "user.name",
  "user.email",
  "credential.helper",
  "core.autocrlf",
  "core.editor",
  "init.defaultBranch",
  "remote.origin.url"
];

// Display order follows the precedence chain: 项目级(local) > 用户级(global) > 系统级(system).
const SCOPES: ConfigScope[] = ["local", "global", "system"];

/** Extract the hostname of a remote URL ("https://github.com/x.git" or "git@host:x"). */
function remoteHost(url: string): string | null {
  if (url.startsWith("https://") || url.startsWith("http://")) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  const at = url.indexOf("@");
  const after = at >= 0 ? url.slice(at + 1) : url;
  const colon = after.indexOf(":");
  const host = colon >= 0 ? after.slice(0, colon) : after;
  return host.toLowerCase() || null;
}

/** Which hosting platform the remotes point at, for the auth guide. */
function detectPlatform(remotes: RemoteInfo[]): "github" | "gitlab" | "other" | null {
  for (const remote of remotes) {
    const host = remoteHost(remote.url);
    if (host === null) continue;
    if (host === "github.com" || host === "www.github.com") return "github";
    if (host === "gitlab.com" || host.includes("gitlab")) return "gitlab";
  }
  for (const remote of remotes) {
    if (remoteHost(remote.url) !== null) return "other";
  }
  return null;
}

export function ConfigView(props: {
  api: GitApi;
  dir: string;
  t: GitUiT;
  onChanged: () => void;
}): JSX.Element {
  const { api, dir, t, onChanged } = props;
  /** Per-scope entries; null = still loading. */
  const [entries, setEntries] = useState<Record<ConfigScope, ConfigEntry[] | null>>({
    system: null,
    global: null,
    local: null
  });
  /** Editing target: `${scope}\u0000${key}` or null. */
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  /** Quick-add per scope. */
  const [newKey, setNewKey] = useState<Record<ConfigScope, string>>({ system: "", global: "", local: "" });
  const [newValue, setNewValue] = useState<Record<ConfigScope, string>>({ system: "", global: "", local: "" });
  /** Remotes of the repo, for the auth guide. */
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  /** Real config-file path per scope (shown in the scope headers). */
  const [configFiles, setConfigFiles] = useState<Record<ConfigScope, string>>({ system: "", global: "", local: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load(): Promise<void> {
    if (dir === "") return;
    try {
      const [system, global, local, remotesValue] = await Promise.all([
        api.configList(dir, "system"),
        api.configList(dir, "global"),
        api.configList(dir, "local"),
        api.remotes(dir).catch(() => [])
      ]);
      setEntries({ system: system.entries, global: global.entries, local: local.entries });
      setConfigFiles({
        system: system.configFiles.system,
        global: global.configFiles.global,
        local: local.configFiles.local
      });
      setRemotes(remotesValue);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  useEffect(() => {
    setEntries({ system: null, global: null, local: null });
    setError(null);
    setRemotes([]);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, dir]);

  /** All values of a key across scopes (any level counts as configured). */
  function keyValues(key: string): string[] {
    const out: string[] = [];
    for (const scope of SCOPES) {
      for (const entry of entries[scope] ?? []) {
        if (entry.key === key) out.push(entry.value);
      }
    }
    return out;
  }

  const userName = keyValues("user.name");
  const userEmail = keyValues("user.email");
  const missingIdentity = dir !== "" && (userName.length === 0 || userEmail.length === 0);
  const platform = detectPlatform(remotes);

  async function save(scope: ConfigScope, key: string): Promise<void> {
    if (key === "") return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.configSet(dir, scope, key, editValue);
      setOk(t("config.saved", { key }));
      setEditing(null);
      onChanged();
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(scope: ConfigScope, key: string): Promise<void> {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.configUnset(dir, scope, key);
      setOk(t("config.removed", { key }));
      onChanged();
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addEntry(scope: ConfigScope): Promise<void> {
    const key = newKey[scope].trim();
    if (key === "" || newValue[scope].trim() === "") return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.configSet(dir, scope, key, newValue[scope].trim());
      setOk(t("config.added", { key }));
      setNewKey((prev) => ({ ...prev, [scope]: "" }));
      setNewValue((prev) => ({ ...prev, [scope]: "" }));
      onChanged();
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const startEdit = (scope: ConfigScope, entry: ConfigEntry): void => {
    setEditing(scope + "\u0000" + entry.key);
    setEditValue(entry.value);
  };

  const scopeLabel = (scope: ConfigScope): string =>
    scope === "system" ? t("config.scope.system") : scope === "global" ? t("config.scope.global") : t("config.scope.local");
  const scopeHint = (scope: ConfigScope): string =>
    scope === "system"
      ? t("config.scope.systemHint")
      : scope === "global"
        ? t("config.scope.globalHint")
        : t("config.scope.localHint");
  /** Real config-file path of the scope (shown in the header). */
  const scopeFile = (scope: ConfigScope): string => configFiles[scope];

  const scopeSection = (scope: ConfigScope): JSX.Element => {
    const list = entries[scope];
    return (
      <div key={scope} className="gitui-config-scope">
        <div className="gitui-detail-header">
          <span>{scopeLabel(scope)}</span>
          <span className="gitui-commit-meta">{list !== null ? list.length : "…"}</span>
          <span style={{ flex: 1 }} />
          <span className="gitui-config-scope-hint" title={scopeHint(scope)}>
            {scopeFile(scope) !== "" ? scopeFile(scope) : scopeHint(scope)}
          </span>
        </div>
        <div>
          {list === null && <div className="gitui-diff-placeholder">…</div>}
          {list !== null && list.length === 0 && (
            <div className="gitui-diff-placeholder" style={{ padding: "2px 12px" }}>{t("config.empty")}</div>
          )}
          {list !== null &&
            list.map((entry) => {
              const editId = scope + "\u0000" + entry.key;
              const isEditing = editing === editId;
              return (
                <div key={entry.key} className="gitui-branch-row">
                  <span className="gitui-file-path gitui-config-key" title={entry.key}>{entry.key}</span>
                  {isEditing ? (
                    <input
                      className="gitui-dir gitui-config-edit"
                      value={editValue}
                      autoFocus
                      spellCheck={false}
                      onChange={(event) => setEditValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void save(scope, entry.key);
                        if (event.key === "Escape") setEditing(null);
                      }}
                    />
                  ) : (
                    <span className="gitui-config-value" title={entry.value}>{entry.value}</span>
                  )}
                  <span style={{ flex: 1 }} />
                  {isEditing ? (
                    <>
                      <button type="button" className="gitui-btn" disabled={busy} onClick={() => void save(scope, entry.key)}>
                        {t("config.save")}
                      </button>
                      <button type="button" className="gitui-btn" onClick={() => setEditing(null)}>
                        {t("action.close")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="gitui-btn" onClick={() => startEdit(scope, entry)}>
                        {t("config.edit")}
                      </button>
                      <button
                        type="button"
                        className="gitui-btn"
                        title={t("config.removeHint")}
                        disabled={busy}
                        onClick={() => void removeEntry(scope, entry.key)}
                      >
                        {t("config.remove")}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
        </div>
        <div className="gitui-branch-new" style={{ paddingLeft: 12 }}>
          <select
            className="gitui-dir"
            value={newKey[scope]}
            onChange={(event) => setNewKey((prev) => ({ ...prev, [scope]: event.target.value }))}
          >
            <option value="">{t("config.addPrompt")}</option>
            {COMMON_KEYS.map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
          <input
            className="gitui-dir gitui-config-edit"
            value={newValue[scope]}
            placeholder={t("config.valuePlaceholder")}
            spellCheck={false}
            onChange={(event) => setNewValue((prev) => ({ ...prev, [scope]: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") void addEntry(scope);
            }}
          />
          <button
            type="button"
            className="gitui-btn gitui-btn-primary"
            disabled={busy || newKey[scope] === "" || newValue[scope].trim() === "" || dir === ""}
            onClick={() => void addEntry(scope)}
          >
            {t("config.add")}
          </button>
        </div>
      </div>
    );
  };

  const authGuide = (): JSX.Element | null => {
    if (dir === "" || platform === null) return null;
    const gitHub = platform === "github";
    const gitLab = platform === "gitlab";
    const tokenUrl = gitHub
      ? "https://github.com/settings/tokens"
      : gitLab
        ? "https://gitlab.com/-/user_settings/personal_access_tokens"
        : null;
    return (
      <div className={"gitui-auth-guide" + (missingIdentity ? " gitui-auth-guide-warn" : "")}>
        <div className="gitui-auth-guide-title">
          {gitHub ? t("auth.github.title") : gitLab ? t("auth.gitlab.title") : t("auth.other.title")}
        </div>
        <div className="gitui-auth-guide-body">
          {gitHub ? t("auth.github.body") : gitLab ? t("auth.gitlab.body") : t("auth.other.body")}
        </div>
        {tokenUrl !== null && (
          <a className="gitui-auth-guide-link" href={tokenUrl} target="_blank" rel="noreferrer">
            {t("auth.openTokenPage")}
          </a>
        )}
        {missingIdentity && (
          <div className="gitui-auth-guide-missing">
            {t("auth.missingIdentity", { name: userName.length === 0 ? "user.name" : "user.email" })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="gitui-detail" style={{ minHeight: 220 }}>
      <div className="gitui-detail-header">
        <span>{t("config.title")}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="gitui-btn" disabled={busy || dir === ""} onClick={() => void load()}>
          {t("action.refresh")}
        </button>
      </div>
      <div className="gitui-config-scroll">
        {authGuide()}
        {dir === "" && <div className="gitui-diff-placeholder">{t("repo.placeholder")}</div>}
        {dir !== "" && (
          <>
            {SCOPES.map((scope) => scopeSection(scope))}
            <div className="gitui-config-note">{t("config.scope.note")}</div>
          </>
        )}
      </div>
      <Toast message={error !== null ? error : ok} tone={error !== null ? "error" : "ok"} />
    </div>
  );
}
