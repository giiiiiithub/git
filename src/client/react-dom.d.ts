/**
 * Minimal ambient typing for the host-provided `react-dom` module. The DSH web
 * runtime exposes react/react-dom to client plugins (other dsh plugins already
 * `require("react-dom")`), so it is NOT bundled here — only tsc needs the type.
 */
declare module "react-dom" {
  export function createPortal(
    children: import("react").ReactNode,
    container: Element | DocumentFragment,
    key?: null | string
  ): import("react").ReactPortal;
}
