/**
 * Git control for the sidebar brand seats: replaces the whale mark and the
 * "DeepSeek Harness" wordmark with the Git toggle at the top of the sidebar.
 *
 * The mark seat renders the FULL toggle (⑂ + "Git" + badge) so the icon and
 * label live in one flex control — no gap between the shell's two brand
 * seats, and the glyph/label line boxes are centered together. Inside the
 * collapsed-rail toggle only the icon shows (label/badge hidden via CSS).
 * The name seat is shadowed with a null occupant so the shipped wordmark
 * stays hidden.
 *
 * Both seats render INSIDE the shell's own <button> (wide brand button /
 * collapsed rail toggle), so the control is a non-<button> role=button span
 * and every interaction stops propagation — otherwise a click would also
 * start a New Session (brand button) or fold the sidebar (rail toggle).
 */
import { useGitUi, gitUiSetOpen } from "../store.js";
import type { GitUiT } from "./DiffView.js";

interface BrandProps {
  t: GitUiT;
}

function toggleOpen(event: React.SyntheticEvent, open: boolean): void {
  event.stopPropagation();
  gitUiSetOpen(!open);
}

function keyToggle(event: React.KeyboardEvent, open: boolean): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    gitUiSetOpen(!open);
  }
}

/** Full Git toggle: ⑂ + "Git" + change/conflict badge (mark seat). */
export function GitBrandMark(props: BrandProps): JSX.Element {
  const { t } = props;
  const snapshot = useGitUi();
  const conflicts = snapshot.status?.conflicts?.length ?? 0;
  const total =
    (snapshot.status?.staged?.length ?? 0) +
    (snapshot.status?.unstaged?.length ?? 0) +
    (snapshot.status?.untracked?.length ?? 0);
  return (
    <span
      role="button"
      tabIndex={0}
      className={"gitui-brand-mark" + (snapshot.open ? " gitui-active" : "")}
      title={t("sidebar.trigger")}
      aria-label={t("sidebar.trigger")}
      aria-expanded={snapshot.open}
      onClick={(event) => toggleOpen(event, snapshot.open)}
      onKeyDown={(event) => keyToggle(event, snapshot.open)}
    >
      <span className="gitui-glyph">⑂</span>
      <span className="gitui-brand-label">{t("panel.title")}</span>
      {conflicts > 0 ? (
        <span className="gitui-badge gitui-badge-danger gitui-brand-badge">{conflicts}</span>
      ) : total > 0 ? (
        <span className="gitui-badge gitui-brand-badge">{total}</span>
      ) : null}
    </span>
  );
}

/** Null occupant keeping the shipped wordmark out of the name seat. */
export function GitBrandName(_props: BrandProps): null {
  return null;
}
