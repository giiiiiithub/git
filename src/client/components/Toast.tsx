/**
 * Toast — transient action feedback ("全部暂存" etc.).
 *
 * Renders as an absolutely-positioned overlay inside the panel, so it never
 * consumes layout height (no more persistent green notice bars pushing the
 * content down). Auto-dismisses after a short delay with a fade-out.
 */
import { useEffect, useState } from "react";

/** How long the toast stays fully visible before fading out. */
const TOAST_MS = 2600;
/** Fade-out duration (kept in sync with the CSS transition). */
const FADE_MS = 240;

export function Toast(props: { message: string | null }): JSX.Element | null {
  const { message } = props;
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
    const hide = window.setTimeout(() => setLeaving(true), TOAST_MS);
    const drop = window.setTimeout(() => setText(null), TOAST_MS + FADE_MS);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(drop);
    };
  }, [message]);

  if (text === null) return null;
  return (
    <div className={"gitui-toast" + (leaving ? " gitui-toast-leave" : "")} role="status">
      {text}
    </div>
  );
}
