/**
 * Session-header action: the Git toggle button with a live change/conflict
 * badge. Shares the module store with the dock panel.
 */
import { useGitUi, gitUiSetOpen } from "../store.js";
import type { GitApi } from "../api.js";
import type { GitUiT } from "./DiffView.js";

export function GitHeaderAction(props: { t: GitUiT; api: GitApi }): JSX.Element {
  const { t } = props;
  const snapshot = useGitUi();
  const conflicts = snapshot.status?.conflicts?.length ?? 0;
  const total =
    (snapshot.status?.staged?.length ?? 0) +
    (snapshot.status?.unstaged?.length ?? 0) +
    (snapshot.status?.untracked?.length ?? 0);

  return (
    <button
      type="button"
      className={"gitui-header-btn" + (snapshot.open ? " gitui-active" : "")}
      onClick={() => gitUiSetOpen(!snapshot.open)}
      title={t("panel.title")}
      aria-label={t("panel.title")}
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      <span className="gitui-glyph">⑂</span>
      <span>{t("panel.title")}</span>
      {conflicts > 0 ? (
        <span className="gitui-badge gitui-badge-danger">{conflicts}</span>
      ) : total > 0 ? (
        <span className="gitui-badge">{total}</span>
      ) : null}
    </button>
  );
}
