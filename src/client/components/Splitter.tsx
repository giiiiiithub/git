/**
 * Splitter — a vertical drag handle between a fixed-width left list and a
 * flexible right pane (used by the Changes / Files / History tabs). Drag to
 * resize, double-click to reset to the default width.
 */
import { SPLIT_MIN } from "../store.js";

/**
 * Slim bar on the directory pane (Changes / Files tabs) carrying the
 * "narrow to minimum" (−) button: collapses the left list to SPLIT_MIN px.
 * Drag the splitter (or double-click it) to restore a wider list.
 */
export function PaneMinBar(props: { title: string; onNarrow: () => void }): JSX.Element {
  const { title, onNarrow } = props;
  return (
    <div className="gitui-pane-bar">
      <span style={{ flex: 1 }} />
      <button type="button" className="gitui-pane-min" title={title} onClick={onNarrow}>
        –
      </button>
    </div>
  );
}

/**
 * Vertical restore strip shown in place of the directory pane when it is
 * hidden: one button brings the pane back at its previous width.
 */
export function PaneRestoreBar(props: { title: string; onRestore: () => void }): JSX.Element {
  const { title, onRestore } = props;
  return (
    <div className="gitui-pane-restore" title={title}>
      <button type="button" className="gitui-pane-restore-btn" onClick={onRestore}>
        ▶
      </button>
    </div>
  );
}

export function Splitter(props: {
  /** Current left-pane width in px (the value the drag starts from). */
  width: number;
  onChange: (width: number) => void;
  onReset: () => void;
  title: string;
}): JSX.Element {
  const { width, onChange, onReset, title } = props;
  return (
    <div
      className="gitui-splitter"
      title={title}
      onDoubleClick={onReset}
      onMouseDown={(event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = width;
        // The right pane keeps at least ~260px; measure at drag start so a
        // window resize mid-drag does not fight the clamp.
        const containerWidth =
          event.currentTarget.parentElement?.getBoundingClientRect().width ?? startWidth * 2;
        const maxWidth = Math.max(SPLIT_MIN, containerWidth - 260);
        const minWidth = Math.min(SPLIT_MIN, maxWidth);
        const onMove = (move: MouseEvent): void => {
          onChange(Math.min(maxWidth, Math.max(minWidth, startWidth + move.clientX - startX)));
        };
        const onUp = (): void => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          document.body.style.userSelect = "";
        };
        document.body.style.userSelect = "none";
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
    />
  );
}
