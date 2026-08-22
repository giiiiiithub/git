/**
 * Toast — transient action feedback ("全部暂存" / error hints like
 * "只能 squash 当前分支顶部的连续提交").
 *
 * Renders as an absolutely-positioned overlay inside the panel, so it never
 * consumes layout height (no more persistent green notice bars pushing the
 * content down). Auto-dismisses after a short delay with a fade-out.
 * `tone` picks the color and duration: "ok" (success, 2.6 s) or
 * "error" (failure, 4.2 s so it stays readable).
 */
import { useEffect, useState } from "react";

/** How long an "ok" toast stays fully visible before fading out. */
const TOAST_MS = 2600;
/** Errors stay a bit longer so the user can read them. */
const ERROR_TOAST_MS = 4200;
/** Fade-out duration (kept in sync with the CSS transition). */
const FADE_MS = 240;

export function Toast(props: { message: string | null; tone?: "ok" | "error" }): JSX.Element | null {
  const { message, tone = "ok" } = props;
  const [text, setText] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (message === null) {
      // The parent cleared the notice (e.g. a new operation started): fade out
      // the current toast, then drop it from the DOM.
      setLeaving(true);
      const timer = window.setTimeout(() => setText(null), FADE_MS);
      return () => window.clearTimeout(timer);
    }
    setText(message);
    setLeaving(false);
    const duration = tone === "error" ? ERROR_TOAST_MS : TOAST_MS;
    const hide = window.setTimeout(() => setLeaving(true), duration);
    const drop = window.setTimeout(() => setText(null), duration + FADE_MS);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(drop);
    };
  }, [message, tone]);

  if (text === null) return null;
  return (
    <div
      className={
        "gitui-toast" +
        (tone === "error" ? " gitui-toast-error" : "") +
        (leaving ? " gitui-toast-leave" : "")
      }
      role="status"
    >
      {text}
    </div>
  );
}
