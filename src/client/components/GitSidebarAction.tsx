/**
 * Sidebar-foot action: the Git toggle button, always visible in the left
 * sidebar (sidebar.footer.action — root scope, no session needed). Clicking
 * it toggles the SAME module store as the session-header Git action, so the
 * panel opens exactly as before (dock above the composer) whenever a session
 * is open; the live change/conflict badge is shared with the header button.
 */
import { useGitUi, gitUiSetOpen } from "../store.js";
import type { GitApi } from "../api.js";
import type { GitUiT } from "./DiffView.js";

export function GitSidebarAction(props: {
  t: GitUiT;
  api: GitApi;
  /** Owner share from the sidebar shell: false = 56px rail, icon only. */
  wide: boolean;
}): JSX.Element {
  const { t, wide } = props;
  const snapshot = useGitUi();
  const conflicts = snapshot.status?.conflicts?.length ?? 0;
  const total =
    (snapshot.status?.staged?.length ?? 0) +
    (snapshot.status?.unstaged?.length ?? 0) +
    (snapshot.status?.untracked?.length ?? 0);

  return (
    <button
      type="button"
      className={"gitui-sidebar-btn" + (snapshot.open ? " gitui-active" : "")}
      onClick={() => gitUiSetOpen(!snapshot.open)}
      title={t("sidebar.trigger")}
      aria-label={t("sidebar.trigger")}
      aria-expanded={snapshot.open}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      <span className="gitui-glyph">⑂</span>
      {wide && <span>{t("panel.title")}</span>}
      {conflicts > 0 ? (
        <span className="gitui-badge gitui-badge-danger">{conflicts}</span>
      ) : total > 0 ? (
        <span className="gitui-badge">{total}</span>
      ) : null}
    </button>
  );
}
