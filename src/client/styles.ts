/**
 * Tiny CSS-in-JS: injects one <style data-plugin> tag for the whole plugin and
 * exports class names. The DSH module loader removes tags owned by a plugin
 * when it unloads, so a fixed tag id is safe across HMR reloads (the tag is
 * recreated if missing).
 */

const TAG_ID = "dsh-git-ui/styles";

const CSS = `
[data-git-ui-root] {
  --git-ui-border: var(--dsw-alias-border-l2, rgba(128,128,128,.25));
  --git-ui-text: var(--dsw-alias-label-primary, inherit);
  --git-ui-text-dim: var(--dsw-alias-label-secondary, rgba(128,128,128,.8));
  --git-ui-bg: var(--dsw-alias-bg-layer-1, transparent);
  /* IDEA Light theme diff colors: INSERTED #BEE6BE, DELETED #D6D6D6,
     MODIFIED #C2D8F2; masked (word-highlighted) rows = 40% type + 60% bg. */
  --git-ui-add: rgba(190, 230, 190, .55);
  --git-ui-del: rgba(214, 214, 214, .62);
  --git-ui-del-line: rgba(248, 81, 73, .42);
  --git-ui-mod: rgba(231, 239, 250, .75);
  --git-ui-accent: var(--dsw-alias-brand-primary, #4d9fff);
  box-sizing: border-box;
  /* Global UI font-scale multiplier (overridden inline by the panel root). */
  --git-ui-font-scale: 1;
  color: var(--git-ui-text);
  font-size: calc(13px * var(--git-ui-font-scale, 1));
  line-height: 1.5;
}
[data-git-ui-root] *, [data-git-ui-root] *::before, [data-git-ui-root] *::after { box-sizing: border-box; }

/* ── window chrome ─────────────────────────────────────────────────────── */
.gitui-glyph { font-weight: 700; color: var(--git-ui-accent); letter-spacing: -.5px; }
.gitui-titlebar {
  /* flex-wrap keeps every control visible in narrow windows / the floating
     window: overflow items wrap onto a second titlebar row instead of being
     clipped by the panel's overflow:hidden. */
  display: flex; align-items: center; flex-wrap: wrap;
  gap: 4px 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--git-ui-border);
  background: var(--dsw-alias-bg-layer-2, rgba(128,128,128,.1));
  font-size: calc(12px * var(--git-ui-font-scale, 1)); font-weight: 600;
  flex: none;
  user-select: none;
  position: relative;
}
.gitui-titlebar-movable { cursor: move; }
.gitui-titlebar-label { flex: none; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gitui-titlebar-branch {
  flex: none; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  background: transparent; color: var(--git-ui-text);
  border: 1px solid transparent; border-radius: 6px; padding: 1px 4px; font-size: calc(12px * var(--git-ui-font-scale, 1)); font-weight: 600; outline: none;
  cursor: pointer;
}
.gitui-titlebar-branch:hover { border-color: var(--git-ui-border); }
.gitui-titlebar-branch:focus { border-color: var(--git-ui-accent); }
.gitui-titlebar-branch option { background: var(--git-ui-bg); color: var(--git-ui-text); }
.gitui-titlebar-ahead { flex: none; font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); }
.gitui-win-controls {
  display: flex; align-items: center; gap: 2px;
  /* Push the window controls to the far right; when they wrap onto their own
     row (narrow floating window) they hug the right edge like a real titlebar. */
  margin-left: auto;
}
.gitui-win-btn {
  background: transparent; border: none; color: var(--git-ui-text-dim);
  width: 26px; height: 24px; border-radius: 6px;
  font-size: calc(13px * var(--git-ui-font-scale, 1)); line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.gitui-win-btn:hover { background: rgba(128,128,128,.18); color: var(--git-ui-text); }
.gitui-win-btn.gitui-active { color: var(--git-ui-accent); }
.gitui-win-close:hover { background: rgba(248, 81, 73, .85); color: #fff; }
.gitui-fullscreen {
  position: fixed; inset: 0; width: 100vw; height: 100vh;
  z-index: 2147483000; border-radius: 0; border: none;
}
/* Compound selector: must beat .gitui-panel's later height rule (equal
   specificity would keep the docked height and break true fullscreen). */
.gitui-panel.gitui-fullscreen {
  height: 100vh; max-height: 100vh;
}
.gitui-badge {
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9px; background: var(--git-ui-accent); color: #fff;
  font-size: calc(11px * var(--git-ui-font-scale, 1)); line-height: calc(18px * var(--git-ui-font-scale, 1)); text-align: center; font-weight: 600;
}
.gitui-badge-danger { background: var(--dsw-alias-state-error-primary, #f85149); }

/* ── expanded panel ────────────────────────────────────────────────────── */
.gitui-panel {
  border: 1px solid var(--git-ui-border);
  border-radius: 8px;
  background: var(--git-ui-bg);
  overflow: hidden;
  display: flex; flex-direction: column;
  height: var(--git-ui-panel-height, 420px);
}
.gitui-resize {
  flex: none;
  height: 7px;
  cursor: ns-resize;
  border-bottom: 1px solid var(--git-ui-border);
  background: transparent;
  touch-action: none;
}
.gitui-resize:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.15)); }
/* Floating-window side handles: full-height strips on the left/right edges
   (inside the overflow-hidden window, above the content). */
.gitui-resize-x {
  position: absolute;
  top: 0; bottom: 0;
  width: 6px;
  cursor: ew-resize;
  z-index: 5;
  touch-action: none;
}
.gitui-resize-x-l { left: 0; }
.gitui-resize-x-r { right: 0; }
.gitui-resize-x:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.15)); }

/* ── floating window ───────────────────────────────────────────────────── */
.gitui-float {
  position: fixed;
  z-index: 1000;
  display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-layer-1, #1e1e1e);
  border: 1px solid var(--git-ui-border);
  border-radius: 10px;
  box-shadow: 0 10px 44px rgba(0, 0, 0, .38);
  overflow: hidden;
  color: var(--git-ui-text);
  font-size: calc(13px * var(--git-ui-font-scale, 1));
  line-height: 1.5;
}
.gitui-float-body { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.gitui-dir {
  flex: 1; min-width: 0;
  background: transparent; color: var(--git-ui-text);
  border: 1px solid var(--git-ui-border); border-radius: 6px;
  padding: 3px 8px; font-size: calc(12px * var(--git-ui-font-scale, 1)); outline: none;
}
.gitui-dir:focus { border-color: var(--git-ui-accent); }
.gitui-dir-wrap { position: relative; flex: 0 1 180px; min-width: 120px; display: flex; }
.gitui-dir-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: auto;
  width: max-content; min-width: 100%; max-width: min(72vw, 640px);
  background: var(--dsw-alias-bg-layer-1, #1e1e1e);
  border: 1px solid var(--git-ui-border);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, .32);
  max-height: 240px;
  overflow-y: auto;
  z-index: 20;
  padding: 4px;
}
.gitui-dir-option {
  padding: 6px 10px;
  font-size: calc(12px * var(--git-ui-font-scale, 1));
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 6px;
}
.gitui-dir-option:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.14)); }
.gitui-dir-option-selected { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.2)); color: var(--git-ui-accent); }
.gitui-btn {
  background: transparent; color: var(--git-ui-text);
  border: 1px solid var(--git-ui-border); border-radius: 6px;
  padding: 3px 10px; font-size: calc(12px * var(--git-ui-font-scale, 1)); cursor: pointer;
  white-space: nowrap;
}
.gitui-btn:hover:not(:disabled) { border-color: var(--git-ui-accent); color: var(--git-ui-accent); }
.gitui-btn:disabled { opacity: .45; cursor: default; }
.gitui-btn.gitui-active { border-color: var(--git-ui-accent); color: var(--git-ui-accent); background: rgba(77, 159, 255, .12); }
.gitui-btn-primary {
  background: var(--git-ui-accent); border-color: var(--git-ui-accent); color: #fff; font-weight: 600;
}
.gitui-btn-danger:hover:not(:disabled) { border-color: var(--dsw-alias-state-error-primary, #f85149); color: var(--dsw-alias-state-error-primary, #f85149); }
.gitui-tabs { display: flex; gap: 4px; padding: 6px 10px 0; }
.gitui-tab {
  padding: 4px 12px; border-radius: 6px 6px 0 0; cursor: pointer;
  color: var(--git-ui-text-dim); font-size: calc(12px * var(--git-ui-font-scale, 1)); border: 1px solid transparent; border-bottom: none;
}
.gitui-tab-active { color: var(--git-ui-text); background: var(--git-ui-bg); border-color: var(--git-ui-border); }
.gitui-tab-count { margin-left: 4px; opacity: .75; }
.gitui-body { display: flex; min-height: 0; flex: 1; overflow: hidden; }
.gitui-files {
  width: 46%; max-width: 380px; min-width: 200px;
  overflow-y: auto; padding: 6px 0;
}
/* Directory-pane column (Changes / Files): left list + the narrow (−) bar. */
.gitui-pane-col {
  display: flex; flex-direction: column;
  min-width: 0; min-height: 0; overflow: hidden;
}
.gitui-pane-bar {
  flex: none; display: flex; align-items: center; justify-content: flex-end;
  height: 24px; padding: 2px 4px 0 0;
}
.gitui-pane-min {
  background: transparent; border: none; color: var(--git-ui-text-dim);
  width: 22px; height: 20px; border-radius: 5px;
  font-size: calc(14px * var(--git-ui-font-scale, 1)); line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.gitui-pane-min:hover { background: rgba(128,128,128,.18); color: var(--git-ui-text); }
/* Restore strip shown when the directory pane is hidden (− button). */
.gitui-pane-restore {
  flex: none; width: 18px; min-width: 18px;
  display: flex; align-items: center; justify-content: center;
  border-right: 1px solid var(--git-ui-border);
  color: var(--git-ui-text-dim); background: transparent;
}
.gitui-pane-restore:hover { background: rgba(128,128,128,.12); color: var(--git-ui-text); }
.gitui-pane-restore-btn {
  background: transparent; border: none; color: inherit; cursor: pointer;
  font-size: calc(10px * var(--git-ui-font-scale, 1)); line-height: 1; padding: 2px;
}
/* Vertical drag handle between the left list and the right detail pane. */
.gitui-splitter {
  flex: none; width: 7px; cursor: col-resize; touch-action: none;
  background: transparent; position: relative;
}
.gitui-splitter::before {
  content: ""; position: absolute; top: 0; bottom: 0; left: 3px; width: 1px;
  background: var(--git-ui-border); transition: background .12s, width .12s, left .12s;
}
.gitui-splitter:hover::before,
.gitui-splitter:active::before {
  background: var(--git-ui-accent); width: 2px; left: 2.5px;
}
.gitui-group-title {
  padding: 0 12px; font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim);
  text-transform: uppercase; letter-spacing: .04em;
  display: flex; justify-content: space-between; align-items: center;
  box-sizing: border-box; overflow: hidden;
}
.gitui-group-actions { display: flex; align-items: center; gap: 2px; }
.gitui-group-actions button {
  background: transparent; border: none; color: var(--git-ui-text-dim);
  cursor: pointer; font-size: calc(11px * var(--git-ui-font-scale, 1)); padding: 1px 4px; border-radius: 4px; line-height: 1.2;
}
.gitui-group-actions button:hover { color: var(--git-ui-accent); background: rgba(128, 128, 128, .15); }
/* Group titlebar glyphs (expand-all / collapse-all / refresh), IDEA style. */
.gitui-group-chev { display: block; }
.gitui-group-count { font-size: calc(11px * var(--git-ui-font-scale, 1)); margin-left: 2px; }

/* file tree tab (git-independent browser / editor) */
.gitui-filetree { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; }
.gitui-filetree-toolbar {
  display: flex; align-items: center; gap: 6px; padding: 6px 10px;
  border-bottom: 1px solid var(--git-ui-border); font-size: calc(12px * var(--git-ui-font-scale, 1)); flex: none;
}
.gitui-filetree-dir {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--git-ui-text-dim); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: calc(11px * var(--git-ui-font-scale, 1));
}
.gitui-filetree-body { display: flex; flex: 1; min-height: 0; min-width: 0; }
.gitui-filetree-tree {
  width: 42%; flex: none; min-width: 0; overflow-y: auto; overflow-x: hidden;
  padding: 4px 0;
}
.gitui-filetree-editor { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.gitui-filetree-editor-header {
  display: flex; align-items: center; gap: 8px; padding: 4px 10px;
  border-bottom: 1px solid var(--git-ui-border); font-size: calc(12px * var(--git-ui-font-scale, 1)); flex: none;
}
.gitui-filetree-textarea {
  flex: 1; min-height: 0; width: 100%; box-sizing: border-box; resize: none;
  background: transparent; color: var(--git-ui-text); border: none; outline: none;
  padding: 8px 10px; font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: calc(12px * var(--git-ui-font-scale, 1)); line-height: 1.55; white-space: pre; tab-size: 4;
}
.gitui-push-form {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 6px 10px 8px; border-bottom: 1px solid var(--git-ui-border);
  background: rgba(128, 128, 128, .06); font-size: calc(12px * var(--git-ui-font-scale, 1));
}
.gitui-push-input {
  flex: 0 1 160px; min-width: 90px; background: transparent; color: var(--git-ui-text);
  border: 1px solid var(--git-ui-border); border-radius: 4px; padding: 2px 6px;
  font-size: calc(12px * var(--git-ui-font-scale, 1)); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; outline: none;
}
.gitui-push-input:focus { border-color: var(--git-ui-accent); }
.gitui-push-arrow { color: var(--git-ui-text-dim); flex: none; }
.gitui-push-force { display: flex; align-items: center; gap: 4px; color: var(--git-ui-text-dim); cursor: pointer; flex: none; }
.gitui-push-force input { accent-color: var(--git-ui-accent, #d97706); }
.gitui-tree-glyph { flex: none; width: 14px; display: inline-flex; align-items: center; justify-content: center; }
.gitui-tree-chev { display: block; color: var(--git-ui-text-dim); }
.gitui-tree-chev-rot { display: inline-flex; }
.gitui-tree-blank { width: 12px; display: inline-block; }
.gitui-tree-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: calc(12px * var(--git-ui-font-scale, 1)); }
.gitui-tree-loading { color: var(--git-ui-text-dim); font-size: calc(12px * var(--git-ui-font-scale, 1)); }
.gitui-tree-warn { color: var(--git-ui-text-dim); font-size: calc(11px * var(--git-ui-font-scale, 1)); }

/* directory tree */
.gitui-dir-node {
  display: flex; align-items: center; gap: 2px;
  padding: 0 10px 0 4px; cursor: pointer; font-size: calc(12px * var(--git-ui-font-scale, 1)); user-select: none;
  box-sizing: border-box; overflow: hidden;
}
.gitui-dir-node:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12)); }
/* IDEA-style arrow: solid triangle with a round hover backdrop */
.gitui-dir-arrow {
  width: 18px; height: 18px; flex: none;
  box-sizing: border-box;
  padding: 3px;
  border-radius: 50%;
  color: var(--git-ui-text-dim);
  transition: background .12s ease;
}
.gitui-dir-node:hover .gitui-dir-arrow,
.gitui-dir-node:focus-visible .gitui-dir-arrow {
  background: rgba(128, 128, 128, .22);
  color: var(--git-ui-text);
}
.gitui-dir-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gitui-dir-node .gitui-file-action { visibility: hidden; }
.gitui-dir-node:hover .gitui-file-action { visibility: visible; }
.gitui-dir-count { color: var(--git-ui-text-dim); font-size: calc(10px * var(--git-ui-font-scale, 1)); margin-left: 2px; }
.gitui-dir-children { padding-left: 14px; }
/* Fixed row heights keep the virtual list aligned (24px per row). */
.gitui-file {
  display: flex; align-items: center; gap: 6px;
  height: 24px; box-sizing: border-box;
  padding: 0 12px; cursor: pointer;
  overflow: hidden;
}
.gitui-file:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12)); }
.gitui-file-selected { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.18)); }
.gitui-file-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: calc(12px * var(--git-ui-font-scale, 1)); }
.gitui-check { margin: 0; flex: none; width: 13px; height: 13px; accent-color: var(--git-ui-accent); cursor: pointer; }
.gitui-config-key { flex: none; min-width: 180px; color: var(--git-ui-accent); }
.gitui-remote-icon { flex: none; width: 14px; text-align: center; font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); }
.gitui-config-value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: calc(12px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); }
.gitui-config-edit { flex: 1; min-width: 120px; }
.gitui-config-scope { margin-bottom: 4px; }
/* Config tab: its own full-height scroll (the shared branches scroll is
   capped at 280px for the branch/tag blocks). */
.gitui-config-scroll { flex: 1; overflow-y: auto; min-height: 0; padding-bottom: 8px; }
.gitui-config-scope-hint {
  flex: none; font-size: calc(10px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); opacity: .7;
  max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gitui-config-note {
  padding: 4px 12px 8px; font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); opacity: .8; line-height: 1.5;
}
/* ── stash tab ──────────────────────────────────────────────────────────── */
.gitui-stash-create {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; border-bottom: 1px solid var(--git-ui-border); flex: none;
}
.gitui-stash-item { border-bottom: 1px solid var(--git-ui-border); }
.gitui-stash-show {
  padding: 4px 12px 8px 24px; font-family: ui-monospace, Consolas, monospace;
  font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); line-height: 1.5;
  border-top: 1px dashed var(--git-ui-border);
}
.gitui-stash-show-line { white-space: pre; }

/* ── authentication guide (Config tab) ──────────────────────────────────── */
.gitui-auth-guide {
  margin: 4px 8px 8px; padding: 8px 10px; border: 1px solid var(--git-ui-border);
  border-radius: 8px; background: rgba(128, 128, 128, .06);
}
.gitui-auth-guide-title { font-size: calc(12px * var(--git-ui-font-scale, 1)); font-weight: 600; color: var(--git-ui-text); margin-bottom: 4px; }
.gitui-auth-guide-body { font-size: calc(11px * var(--git-ui-font-scale, 1)); line-height: 1.6; color: var(--git-ui-text-dim); }
.gitui-auth-guide-link {
  display: inline-block; margin-top: 6px; font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-accent);
  text-decoration: none;
}
.gitui-auth-guide-link:hover { text-decoration: underline; }
.gitui-auth-guide-warn { border-color: var(--dsw-alias-state-warn-primary, #d29922); }
.gitui-auth-guide-missing {
  margin-top: 6px; font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--dsw-alias-state-warn-primary, #d29922); line-height: 1.5;
}
.gitui-file-status { font-size: calc(10px * var(--git-ui-font-scale, 1)); width: 14px; text-align: center; font-weight: 700; }
.gitui-st-added { color: var(--dsw-alias-state-success-primary, #3fb950); }
.gitui-st-modified { color: var(--dsw-alias-state-warn-primary, #d29922); }
.gitui-st-deleted { color: var(--dsw-alias-state-error-primary, #f85149); }
.gitui-st-unmerged { color: var(--dsw-alias-state-error-primary, #f85149); }
.gitui-file-action {
  background: transparent; border: none; cursor: pointer; color: var(--git-ui-text-dim);
  font-size: calc(11px * var(--git-ui-font-scale, 1)); padding: 1px 4px; border-radius: 4px; visibility: hidden;
}
.gitui-file:hover .gitui-file-action { visibility: visible; }
.gitui-file-action:hover { color: var(--git-ui-accent); background: rgba(128,128,128,.15); }

.gitui-detail { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.gitui-detail-header {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  border-bottom: 1px solid var(--git-ui-border); font-size: calc(12px * var(--git-ui-font-scale, 1));
}
.gitui-diff { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; }
/* Column captions above the diff ("HEAD" / "Working Tree" etc.), aligned
   with the two 1fr columns of .gitui-diff-row below. */
.gitui-diff-sides {
  flex: none; display: grid; grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--git-ui-border); font-size: calc(11px * var(--git-ui-font-scale, 1));
}
.gitui-diff-side {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 10px; color: var(--git-ui-text-dim);
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  border-right: 1px solid var(--git-ui-border);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gitui-diff-side:last-child { border-right: none; }
.gitui-diff-scroll { flex: 1; overflow-y: auto; padding: 4px 0; position: relative; }

.gitui-diff-cols {
  display: flex;
  width: 100%;
  align-items: stretch;
}
/* Fixed 50/50 content columns + the middle gutter column (IDEA layout:
   content | old line numbers | new line numbers | content). The columns
   never scroll themselves — content scrolls INSIDE each cell (see below),
   driven by the single .gitui-diff-scrollbar. */
.gitui-diff-col {
  flex: 1 1 50%;
  min-width: 0;
  overflow: hidden;
}
/* Middle gutter column: the two number strips sit side by side with a
   single divider (old numbers right-aligned, new numbers left-aligned). */
.gitui-diff-mid {
  flex: none;
  display: flex;
  align-items: stretch;
  width: 104px;
}
.gitui-diff-mid-ln,
.gitui-diff-mid-rn {
  flex: none;
  width: 52px;
  overflow: hidden;
}
.gitui-diff-mid-ln { border-right: 1px solid var(--git-ui-border); }
/* Line-number rows in the middle column mirror the content rows; their
   heights are synced from the content cells (soft wrap can make them
   taller), so numbers stay aligned with their rows. */
.gitui-mid-row {
  display: flex;
  align-items: center;
  box-sizing: border-box;
}
.gitui-mid-row .gitui-diff-no {
  flex: 1;
  color: var(--git-ui-text-dim);
  user-select: none;
  white-space: nowrap;
}
.gitui-diff-mid-ln .gitui-diff-no { text-align: right; padding: 0 2px 0 2px; }
.gitui-diff-mid-rn .gitui-diff-no { text-align: left; padding: 0 2px 0 2px; }
.gitui-mid-head,
.gitui-mid-fold {
  overflow: hidden;
}
.gitui-diff-cell {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  display: flex;
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: calc(12px * var(--git-ui-font-scale, 1)); line-height: 1.55;
  white-space: pre;
}
/* The content layer scrolls inside the fixed-background cell: the row
   background stays in place (a short row scrolled out of view still shows
   its tinted background) while the text scrolls. The layer is as wide as
   the column; the inner div is as wide as the column's widest content, so
   EVERY row scrolls over the same range (short rows scroll in sync with
   long ones). The layer's own scrollbar is hidden — the bottom
   .gitui-diff-scrollbar drives every layer. */
.gitui-diff-cell-content {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.gitui-diff-cell-content::-webkit-scrollbar { display: none; }
.gitui-diff-cell-inner {
  min-width: 100%;
  /* Natural row height: every row is at least one line tall. Paired rows
     are equalized across the two columns by a layout effect (blank pad cells
     fill the missing side; soft wrap stretches the shorter of each pair). */
  min-height: 1.55em;
  display: flex;
}
/* Single horizontal scrollbar for the whole diff; drives both columns. */
.gitui-diff-scrollbar {
  flex: none;
  overflow-x: auto;
  overflow-y: hidden;
  height: 16px;
  border-top: 1px solid var(--git-ui-border);
}

/* Gutter action icon (apply/revert arrow on the HEAD side). */
.gitui-diff-gicon {
  flex: none; width: 20px; align-self: stretch; margin: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: none; border: none; padding: 0; cursor: pointer;
  color: var(--git-ui-text-dim);
}
.gitui-diff-gicon:hover:not(:disabled) { color: var(--git-ui-text); }
.gitui-diff-gicon:disabled { opacity: .3; cursor: default; }
.gitui-diff-gicon svg { width: 12px; height: 12px; fill: currentColor; }
/* Gutter include checkbox on the worktree side. */
.gitui-diff-gcheck {
  flex: none; width: 14px; height: 14px; margin: 0 4px; align-self: center;
  accent-color: #2d7ff9; cursor: pointer;
}
/* Fixed-width gutter-action column: the checkbox (worktree side) or apply
   arrow (HEAD side) sits here, and the line-number column follows to the
   right. Always reserved so the line numbers stay vertically aligned whether
   or not a row carries an action. */
.gitui-diff-gslot {
  flex: none; width: 22px; align-self: stretch;
  display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box;
}
.gitui-diff-cell .gitui-diff-text { flex: 1; min-width: 0; padding-right: 8px; overflow: visible; }
/* Inline editing on the worktree side (IDEA live-edit). */
.gitui-diff-editable {
  outline: none; cursor: text;
  border-radius: 2px;
}
.gitui-diff-editable:hover { background: rgba(128, 128, 128, .08); }
.gitui-diff-editable:focus {
  background: rgba(45, 127, 249, .08);
  box-shadow: inset 0 0 0 1px rgba(45, 127, 249, .45);
}
.gitui-cell-del { background: var(--git-ui-del); }
.gitui-cell-add { background: var(--git-ui-add); }
/* IDEA: a paired modified row (both sides present) is tinted MODIFIED blue. */
.gitui-cell-mod { background: var(--git-ui-mod); }
/* Word-level (intra-line) highlight: darker than the row tint. */
.gitui-diff-word-del { background: rgba(248, 81, 73, .38); border-radius: 2px; }
.gitui-diff-word-add { background: rgba(46, 160, 67, .42); border-radius: 2px; }
.gitui-diff-toolbar {
  flex: none; display: flex; align-items: center; gap: 6px;
  padding: 3px 10px; border-bottom: 1px solid var(--git-ui-border);
  font-size: calc(12px * var(--git-ui-font-scale, 1));
}
.gitui-hunk-gap {
  /* Fixed height so the left hunk header and the right spacer column stay
     vertically aligned (they live in separate DOM subtrees). */
  height: 23px;
  padding: 2px 10px; color: var(--git-ui-text-dim); font-size: calc(11px * var(--git-ui-font-scale, 1));
  background: var(--dsw-alias-bg-layer-2, rgba(128,128,128,.08));
  border-top: 1px solid var(--git-ui-border); border-bottom: 1px solid var(--git-ui-border);
}
.gitui-hunk-head { display: flex; align-items: center; gap: 6px; }
.gitui-hunk-meta { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; }
.gitui-hunk-btn { padding: 0 6px; font-size: calc(11px * var(--git-ui-font-scale, 1)); }
.gitui-fold-row {
  display: block; width: 100%; text-align: center;
  padding: 2px 10px; color: var(--git-ui-text-dim); font-size: calc(11px * var(--git-ui-font-scale, 1));
  background: var(--dsw-alias-bg-layer-2, rgba(128,128,128,.06));
  border: none; border-bottom: 1px solid var(--git-ui-border);
  cursor: pointer;
}
.gitui-fold-row:hover { color: var(--git-ui-accent); background: var(--dsw-alias-bg-layer-3, rgba(128,128,128,.12)); }
.gitui-diff-placeholder { padding: 24px; color: var(--git-ui-text-dim); text-align: center; }
/* Binary image preview (IDEA image diff). */
.gitui-diff-images { overflow: auto; }
.gitui-diff-img-row { display: flex; flex: 1; min-height: 0; }
.gitui-diff-img-col {
  flex: 1 1 50%; min-width: 0; display: flex; align-items: center; justify-content: center;
  padding: 12px; border-right: 1px solid var(--git-ui-border);
}
.gitui-diff-img-col:last-child { border-right: none; }
.gitui-diff-img { max-width: 100%; max-height: 100%; object-fit: contain; }
.gitui-diff-img-notice {
  flex: none; padding: 6px 10px; text-align: center; font-size: calc(12px * var(--git-ui-font-scale, 1));
  color: var(--git-ui-text-dim); border-top: 1px solid var(--git-ui-border);
}
/* IDEA-style diff toolbar dropdowns (view mode / whitespace / highlight). */
.gitui-dd { position: relative; display: inline-flex; }
.gitui-dd-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 8px; font-size: calc(12px * var(--git-ui-font-scale, 1)); color: inherit;
  background: transparent; border: 1px solid transparent; border-radius: 4px;
  cursor: pointer; white-space: nowrap;
}
.gitui-dd-btn:hover { background: var(--dsw-alias-bg-layer-3, rgba(128,128,128,.12)); }
.gitui-dd-btn:disabled { opacity: .55; cursor: default; }
.gitui-dd-caret { font-size: calc(9px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); }
.gitui-dd-menu {
  position: absolute; top: calc(100% + 2px); left: 0; z-index: 3000;
  min-width: 200px; padding: 4px 0;
  background: var(--dsw-alias-bg-layer-1, #fff);
  border: 1px solid var(--git-ui-border); border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0,0,0,.18);
}
.gitui-dd-item {
  padding: 5px 12px; font-size: calc(12px * var(--git-ui-font-scale, 1)); cursor: pointer;
  display: flex; align-items: center; gap: 8px;
}
.gitui-dd-item:hover { background: var(--dsw-alias-bg-layer-3, rgba(128,128,128,.12)); }
.gitui-dd-item-sel::before { content: "✓"; width: 14px; color: var(--git-ui-accent); }
.gitui-dd-menu-ws { min-width: 240px; }
.gitui-dd-menu-ws .gitui-dd-item { white-space: nowrap; }
.gitui-dd-item:not(.gitui-dd-item-sel)::before { content: ""; width: 14px; }
.gitui-tb-sep { width: 1px; height: 16px; background: var(--git-ui-border); margin: 0 2px; }
.gitui-font-btn { min-width: 24px; padding: 0 5px; font-size: calc(12px * var(--git-ui-font-scale, 1)); }
.gitui-diff-count {
  font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim);
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  padding: 0 4px; user-select: none;
}
/* Soft wrap: let long lines fold inside each cell (no horizontal scroll). */
.gitui-diff-softwrap .gitui-diff-cell-inner { white-space: pre-wrap; overflow-wrap: anywhere; }
/* Unified view: single column, marker + old/new line numbers. */
.gitui-diff-cols-unified { display: block; }
.gitui-diff-cols-unified .gitui-diff-col { flex: none; width: 100%; overflow: visible; }
.gitui-diff-cell-u { display: flex; }
.gitui-diff-cell-u .gitui-diff-cell-content { overflow-x: visible; }
.gitui-diff-marker {
  width: 18px; flex: none; text-align: center; user-select: none;
  font-weight: 700;
}
.gitui-diff-marker-+ { color: var(--git-ui-add-strong, #2ea043); }
.gitui-diff-marker-- { color: var(--git-ui-del-strong, #f85149); }
.gitui-diff-marker-  { color: transparent; }
.gitui-diff-no-new { border-left: 1px solid var(--git-ui-border); }
/* Current hunk after F7 navigation (IDEA-style focus ring). */
.gitui-hunk-current {
  background: var(--dsw-alias-bg-layer-3, rgba(128,128,128,.14));
  box-shadow: inset 0 0 0 1px var(--git-ui-accent, rgba(56,139,214,.6));
}

/* ── context menu ───────────────────────────────────────────────────────── */
.gitui-menu {
  position: fixed; z-index: 20000; min-width: 180px;
  background: var(--dsw-alias-bg-layer-2, #2b2d30);
  border: 1px solid var(--git-ui-border); border-radius: 6px;
  padding: 4px; box-shadow: 0 6px 20px rgba(0,0,0,.35);
  font-size: calc(12px * var(--git-ui-font-scale, 1)); user-select: none;
}
.gitui-menu-list { display: flex; flex-direction: column; }
.gitui-menu-item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 10px; border-radius: 4px; cursor: pointer;
  white-space: nowrap; color: var(--git-ui-text);
}
.gitui-menu-item:hover { background: var(--dsw-alias-brand-primary, #4d9fff); color: #fff; }
.gitui-menu-item-danger { color: var(--git-ui-del-line, #f85149); }
.gitui-menu-item-danger:hover { background: #b62324; color: #fff; }
.gitui-menu-item-disabled { opacity: .45; cursor: default; }
.gitui-menu-item-disabled:hover { background: transparent; color: var(--git-ui-text); }
.gitui-menu-label { flex: 1; }
.gitui-menu-arrow { font-size: calc(10px * var(--git-ui-font-scale, 1)); opacity: .7; }
.gitui-menu-sep { height: 1px; margin: 3px 6px; background: var(--git-ui-border); }
.gitui-menu-sub { position: fixed; }

/* ── dialogs (push preview / rebase) ────────────────────────────────────── */
.gitui-dialog {
  position: fixed; inset: 0; z-index: 15000;
  background: rgba(0,0,0,.35);
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12vh;
}
.gitui-dialog-box {
  width: 640px; max-width: calc(100vw - 48px); max-height: 70vh;
  display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-layer-2, #2b2d30);
  border: 1px solid var(--git-ui-border); border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0,0,0,.4);
  overflow: hidden;
}
.gitui-dialog-body { display: flex; flex-direction: column; min-height: 0; }
.gitui-dialog-list { overflow-y: auto; min-height: 120px; border-top: 1px solid var(--git-ui-border); }
.gitui-rebase-dialog { width: 720px; }
.gitui-rebase-base { flex: 0 1 220px; }
.gitui-rebase-row { display: flex; align-items: center; gap: 8px; padding: 3px 10px; }
.gitui-rebase-row:hover { background: var(--dsw-alias-bg-layer-1, rgba(128,128,128,.08)); }
.gitui-rebase-row .gitui-commit-subject { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gitui-rebase-action { flex: 0 0 92px; }
.gitui-rebase-msg { flex: 0 1 220px; }

/* ── history filters / colored graph ────────────────────────────────────── */
.gitui-history-tools { display: flex; flex-direction: column; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--git-ui-border); }
.gitui-log-graph { flex: none; font-weight: 600; }
.gitui-group-menu-btn { border: none; background: transparent; color: var(--git-ui-text-dim); cursor: pointer; padding: 0 4px; font-size: calc(13px * var(--git-ui-font-scale, 1)); }
.gitui-group-menu-btn:hover { color: var(--git-ui-text); }

.gitui-commit {
  border-top: 1px solid var(--git-ui-border); padding: 8px 10px;
  display: flex; flex-direction: column; gap: 6px;
}
.gitui-commit textarea {
  width: 100%; resize: vertical; min-height: 54px; max-height: 140px;
  background: transparent; color: var(--git-ui-text);
  border: 1px solid var(--git-ui-border); border-radius: 6px; padding: 6px 8px;
  font-size: calc(12px * var(--git-ui-font-scale, 1)); font-family: inherit; outline: none;
}
.gitui-commit textarea:focus { border-color: var(--git-ui-accent); }
.gitui-commit-row { display: flex; align-items: center; gap: 10px; }
.gitui-commit-row label { display: flex; align-items: center; gap: 4px; font-size: calc(12px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); cursor: pointer; }
.gitui-error { color: var(--dsw-alias-state-error-primary, #f85149); font-size: calc(12px * var(--git-ui-font-scale, 1)); padding: 2px 10px; }
.gitui-ok { color: var(--dsw-alias-state-success-primary, #3fb950); font-size: calc(12px * var(--git-ui-font-scale, 1)); padding: 2px 10px; }
.gitui-notrepo {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px; margin: 4px 10px; border: 1px dashed var(--git-ui-border);
  border-radius: 8px; color: var(--git-ui-text-dim); font-size: calc(12px * var(--git-ui-font-scale, 1));
}
.gitui-notrepo-text { flex: 1 1 auto; }

/* titlebar quick-op dropdowns (pull / stash) */
.gitui-ops-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 8px;
  width: 320px;
  max-height: 60vh;
  overflow-y: auto;
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  border: 1px solid var(--git-ui-border);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, .18);
  z-index: 40;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gitui-ops-title {
  display: flex; align-items: center; justify-content: space-between;
  font-size: calc(12px * var(--git-ui-font-scale, 1)); font-weight: 600; padding: 2px 4px;
}
.gitui-ops-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gitui-ops-list { border-top: 1px solid var(--git-ui-border); padding-top: 6px; max-height: 220px; overflow-y: auto; }

/* merge view */
.gitui-merge-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.gitui-merge-label { font-size: calc(12px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); flex: none; }
.gitui-merge-arrow { color: var(--git-ui-text-dim); flex: none; }
.gitui-merge-option {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: calc(12px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); cursor: pointer; user-select: none;
}
.gitui-merge-list { flex: 1; overflow-y: auto; padding: 6px 0; }
.gitui-conflict {
  border: 1px solid var(--git-ui-border); border-radius: 8px;
  margin: 0 10px 8px; overflow: hidden;
}
.gitui-conflict-head {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  background: var(--dsw-alias-bg-layer-2, rgba(128,128,128,.08));
  font-size: calc(12px * var(--git-ui-font-scale, 1));
}
.gitui-conflict-body { padding: 8px 10px; }

/* merge revisions (IDEA-style three-pane conflict resolution) */
.gitui-mr { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.gitui-mr-toolbar {
  display: flex; align-items: center; gap: 6px; padding: 4px 10px;
  border-bottom: 1px solid var(--git-ui-border); font-size: calc(12px * var(--git-ui-font-scale, 1)); flex-wrap: wrap;
}
.gitui-mr-accept-ours { color: var(--git-ui-accent); }
.gitui-mr-accept-theirs { color: var(--dsw-alias-state-warn-primary, #d29922); }
.gitui-mr-count { color: var(--git-ui-text-dim); margin-left: auto; font-size: calc(11px * var(--git-ui-font-scale, 1)); }
.gitui-mr-cols { display: flex; flex: 1; min-height: 0; }
.gitui-mr-col {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; min-height: 0;
  border-right: 1px solid var(--git-ui-border);
}
.gitui-mr-col:last-child { border-right: none; }
.gitui-mr-col-title {
  padding: 4px 8px; font-size: calc(11px * var(--git-ui-font-scale, 1)); font-weight: 600;
  border-bottom: 1px solid var(--git-ui-border);
  color: var(--git-ui-text-dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none;
}
/* IDEA Light theme palette: modified-left #DAE9FF, modified-right #FFE3C2,
   conflict #F8E0E0 — the classic IntelliJ diff/merge colors. */
.gitui-mr-title-ours { color: #1f6feb; }
.gitui-mr-title-theirs { color: #b45309; }
.gitui-mr-lines {
  flex: 1; min-height: 0; overflow: auto;
  font-family: ui-monospace, Consolas, monospace; font-size: calc(11px * var(--git-ui-font-scale, 1)); line-height: 1.5;
  padding: 2px 0;
}
.gitui-mr-line { display: flex; position: relative; min-width: 0; }
.gitui-mr-line:hover { background: rgba(0, 0, 0, .05); }
.gitui-mr-no {
  width: 30px; flex: none; text-align: right; padding-right: 6px;
  color: var(--git-ui-text-dim); user-select: none; font-size: calc(10px * var(--git-ui-font-scale, 1));
}
.gitui-mr-text {
  flex: 1; min-width: 0; white-space: pre; overflow: hidden; text-overflow: ellipsis;
  padding-right: 6px;
}
.gitui-mr-line-ours { background: #dbe9ff; }
.gitui-mr-line-theirs { background: #ffe3c2; }
.gitui-mr-line-result { background: #f8e0e0; }
.gitui-mr-line-block-current { box-shadow: inset 3px 0 0 #1f6feb; }
.gitui-mr-act {
  position: absolute; top: 0; z-index: 2;
  width: 22px; height: 16px; line-height: calc(15px * var(--git-ui-font-scale, 1)); padding: 0;
  border: none; border-radius: 4px; background: transparent;
  cursor: pointer; font-size: calc(13px * var(--git-ui-font-scale, 1)); font-weight: 700;
  visibility: hidden;
}
.gitui-mr-line:hover .gitui-mr-act { visibility: visible; }
.gitui-mr-act:hover { background: rgba(0, 0, 0, .08); }
/* Toggle buttons sit on the pane edge hugging the Result boundary, arrows
   pointing into it: » at the LEFT pane's right edge, « at the RIGHT pane's
   left edge (over its line-number gutter, which is the boundary side).
   Accepted blocks flip the glyph to the opposite direction and dim,
   meaning "click to undo". */
.gitui-mr-act-edge-r { right: 2px; color: #1f6feb; }
.gitui-mr-act-edge-l { left: 2px; color: #b45309; }
.gitui-mr-act-done { opacity: .55; }
/* × removes from the Result: stays on the line-number gutter. */
.gitui-mr-act-remove { left: 2px; color: #cf222e; }
.gitui-mr-edit {
  flex: 1; min-height: 0; width: 100%; resize: none;
  background: transparent; color: var(--git-ui-text);
  border: none; padding: 6px 10px; outline: none;
  font-family: ui-monospace, Consolas, monospace; font-size: calc(11px * var(--git-ui-font-scale, 1)); line-height: 1.5;
}
.gitui-mr-footer {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  border-top: 1px solid var(--git-ui-border); font-size: calc(12px * var(--git-ui-font-scale, 1)); flex: none;
}


/* remotes section (History tab sidebar) */
.gitui-remotes { flex: none; border-bottom: 1px solid var(--git-ui-border); max-height: 150px; overflow-y: auto; }
.gitui-remotes .gitui-branch-new { flex-wrap: wrap; }
.gitui-remote-name { flex: none; max-width: 110px; font-weight: 600; }
/* Remotes tab */
.gitui-remotes-view { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.gitui-remotes-view .gitui-detail-header { flex: none; }
.gitui-remotes-list { flex: 1; overflow-y: auto; padding: 6px 0; min-height: 0; }
.gitui-remotes-list .gitui-branch-row { padding: 5px 12px; }
.gitui-remote-add { flex-wrap: wrap; padding: 6px 12px; }
.gitui-remote-url {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--git-ui-text-dim); font-size: calc(11px * var(--git-ui-font-scale, 1));
}
.gitui-remote-url-input { flex: 1 1 160px; max-width: none; }
/* history view (IDEA Log style) */
.gitui-history-tools {
  display: flex; flex-direction: row; align-items: center; gap: 6px; padding: 6px 10px 2px;
  border-bottom: 1px solid var(--git-ui-border); flex: none;
}
.gitui-history-tools .gitui-btn { flex: none; }
.gitui-history-tools .gitui-dir { flex: 1 1 0; min-width: 0; }
.gitui-log-graph {
  flex: none; color: var(--git-ui-text-dim);
  font-family: Consolas, "Cascadia Mono", "Courier New", monospace;
  font-size: calc(12px * var(--git-ui-font-scale, 1)); line-height: 1.4; white-space: pre;
  min-width: 8px;
}
/* One monospace column per character — vertical lines stay connected. */
.gitui-log-graph > span {
  display: inline-block; width: 1ch; text-align: center;
  white-space: pre;
}
/* Stretch only line glyphs (| / \ and box chars) so they run continuously
   across 26px rows; dots (*) and spaces keep their shape. */
.gitui-log-graph > span.gitui-graph-line {
  transform: scaleY(2.2);
}
.gitui-log-refs {
  flex: none; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: calc(10px * var(--git-ui-font-scale, 1)); color: var(--git-ui-accent);
  border: 1px solid var(--git-ui-border); border-radius: 8px; padding: 0 5px;
}
/* Full-width History toolbar sits above the log/detail split. */
.gitui-history { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.gitui-history-layout { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.gitui-history-side {
  width: 44%; min-width: 220px; max-width: 380px;
  display: flex; flex-direction: column; min-height: 0;
}
.gitui-history-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.gitui-log-row {
  display: flex; gap: 8px; align-items: center; padding: 4px 10px; cursor: pointer;
  border-left: 2px solid transparent; min-height: 26px;
}
/* Single-line rows keep the graph verticals aligned across commits. */
.gitui-log-row .gitui-commit-subject,
.gitui-log-row .gitui-commit-meta,
.gitui-log-row .gitui-log-refs {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* The detail panel's meta margin must not stretch log rows. */
.gitui-log-row .gitui-commit-meta { margin-top: 0; }

/* Hover popup showing a commit's full metadata + file stats. */
.gitui-hover-card {
  position: fixed; z-index: 2147483600; max-width: 380px; max-height: 72vh; overflow: auto;
  background: var(--dsw-alias-bg-layer-1, #1e1e1e);
  border: 1px solid var(--git-ui-border); border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, .35);
  padding: 8px 10px; color: var(--git-ui-text);
  font-size: calc(12px * var(--git-ui-font-scale, 1));
  pointer-events: none; /* read-only; copy via the row's right-click menu */
}
.gitui-hover-card-body { display: flex; flex-direction: column; gap: 4px; min-width: 260px; }
.gitui-hover-hash { font-family: ui-monospace, Consolas, monospace; font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-accent); font-weight: 600; overflow-wrap: anywhere; }
.gitui-hover-row { display: flex; gap: 6px; align-items: baseline; }
.gitui-hover-row .gitui-hover-k { flex: none; width: 58px; color: var(--git-ui-text-dim); }
.gitui-hover-row .gitui-hover-v { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.gitui-hover-msg { border-top: 1px solid var(--git-ui-border); padding-top: 4px; margin-top: 2px; white-space: pre-wrap; }
.gitui-hover-files {
  border-top: 1px solid var(--git-ui-border); padding-top: 4px; margin-top: 2px;
  max-height: 140px; overflow: auto; display: flex; flex-direction: column; gap: 1px;
}
.gitui-hover-files-label { color: var(--git-ui-text-dim); }
.gitui-hover-file { display: flex; gap: 6px; align-items: baseline; font-family: ui-monospace, Consolas, monospace; font-size: calc(11px * var(--git-ui-font-scale, 1)); }
.gitui-hover-file .gitui-hover-st { flex: none; width: 16px; color: var(--git-ui-accent); }
.gitui-hover-file .gitui-hover-path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gitui-hover-file .gitui-hover-num { flex: none; color: var(--git-ui-text-dim); }
.gitui-hover-more { color: var(--git-ui-text-dim); }
.gitui-log-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12)); }
.gitui-log-row-selected { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.2)); border-left-color: var(--git-ui-accent); }
.gitui-log-row .gitui-commit-subject { font-size: calc(12px * var(--git-ui-font-scale, 1)); }
.gitui-history-detail {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; min-height: 0;
}
.gitui-commit-detail { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.gitui-detail-summary { flex: none; padding: 8px 12px; border-bottom: 1px solid var(--git-ui-border); }
.gitui-commit-oneliner {
  display: flex; align-items: center; gap: 6px; margin-top: 4px;
  font-size: calc(12px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim);
}
.gitui-detail-row { display: flex; flex: 1; min-height: 0; min-width: 0; }
.gitui-changed-pane {
  display: flex; flex-direction: column; flex: none; min-width: 0; min-height: 0;
  border-right: 1px solid var(--git-ui-border); max-width: 62%;
}
.gitui-commit-subject { font-size: calc(13px * var(--git-ui-font-scale, 1)); font-weight: 600; line-height: 1.5; word-break: break-word; }
.gitui-commit-body {
  margin: 6px 0 0; white-space: pre-wrap; word-break: break-word;
  font-family: inherit; font-size: calc(12px * var(--git-ui-font-scale, 1)); line-height: 1.6;
  color: var(--git-ui-text-dim);
}
.gitui-commit-meta { margin-top: 8px; display: flex; flex-direction: column; gap: 3px; font-size: calc(12px * var(--git-ui-font-scale, 1)); }
.gitui-meta-row { display: flex; gap: 8px; align-items: baseline; }
.gitui-meta-key { color: var(--git-ui-text-dim); width: 56px; flex: none; font-size: calc(11px * var(--git-ui-font-scale, 1)); }
.gitui-meta-hash {
  font-family: ui-monospace, Consolas, monospace; font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-accent);
  background: transparent; border: none; padding: 0; cursor: pointer;
}
.gitui-meta-hash:hover { text-decoration: underline; }
.gitui-meta-parents { display: flex; gap: 6px; }
.gitui-changed-title {
  margin-top: 10px; padding-bottom: 4px; border-bottom: 1px solid var(--git-ui-border);
  font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); text-transform: uppercase; letter-spacing: .04em;
}
.gitui-changed-files { flex: 1; overflow-y: auto; min-height: 0; }
.gitui-changed-file {
  display: flex; align-items: center; gap: 6px; padding: 3px 6px; cursor: pointer;
  border-radius: 6px; font-size: calc(12px * var(--git-ui-font-scale, 1));
}
.gitui-changed-file:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12)); }
.gitui-changed-file-selected { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.2)); }
.gitui-numstat { margin-left: auto; flex: none; display: flex; gap: 6px; font-size: calc(11px * var(--git-ui-font-scale, 1)); font-family: ui-monospace, Consolas, monospace; }
.gitui-num-add { color: var(--dsw-alias-state-success-primary, #3fb950); }
.gitui-num-del { color: var(--dsw-alias-state-error-primary, #f85149); }
.gitui-commit-diff {
  flex: 1; min-width: 0; min-height: 0;
  display: flex; flex-direction: column;
}
.gitui-commit-diff .gitui-detail-header { flex: none; }

/* Horizontal divider between the commit info and the diff (draggable). */
.gitui-vsplit {
  flex: none; height: 7px; cursor: row-resize; touch-action: none;
  background: transparent; position: relative;
}
.gitui-vsplit::before {
  content: ""; position: absolute; left: 0; right: 0; top: 3px; height: 1px;
  background: var(--git-ui-border); transition: background .12s, height .12s, top .12s;
}
.gitui-vsplit:hover::before,
.gitui-vsplit:active::before {
  background: var(--git-ui-accent); height: 2px; top: 2.5px;
}

/* Vertical divider between the changed-files pane and the diff (draggable). */
.gitui-hsplit {
  flex: none; width: 7px; cursor: col-resize; touch-action: none;
  background: transparent; position: relative;
}
.gitui-hsplit::before {
  content: ""; position: absolute; top: 0; bottom: 0; left: 3px; width: 1px;
  background: var(--git-ui-border); transition: background .12s, width .12s, left .12s;
}
.gitui-hsplit:hover::before,
.gitui-hsplit:active::before {
  background: var(--git-ui-accent); width: 2px; left: 2.5px;
}

.gitui-commit-row {
  display: flex; gap: 10px; align-items: baseline; padding: 5px 12px;
  border-bottom: 1px solid var(--git-ui-border);
}
.gitui-commit-row:last-child { border-bottom: none; }
.gitui-commit-hash { font-family: ui-monospace, Consolas, monospace; font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-accent); width: 64px; flex: none; }
.gitui-commit-subject { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: calc(12px * var(--git-ui-font-scale, 1)); }
.gitui-commit-meta { color: var(--git-ui-text-dim); font-size: calc(11px * var(--git-ui-font-scale, 1)); flex: none; }
.gitui-branch-row { display: flex; align-items: center; gap: 8px; padding: 4px 12px; font-size: calc(12px * var(--git-ui-font-scale, 1)); }
.gitui-branches-scroll { overflow-y: auto; max-height: 280px; flex: none; }
.gitui-branch-row .gitui-current-tag { color: var(--git-ui-accent); font-size: calc(10px * var(--git-ui-font-scale, 1)); border: 1px solid var(--git-ui-accent); border-radius: 8px; padding: 0 6px; }
.gitui-branch-new { display: flex; gap: 6px; padding: 6px 12px; align-items: center; }
.gitui-compare-panel {
  border-top: 1px solid var(--git-ui-border); margin: 0 12px; padding: 4px 0;
  max-height: 180px; overflow-y: auto;
}
.gitui-compare-head {
  display: flex; align-items: center; gap: 8px; padding: 4px 0;
  font-size: calc(12px * var(--git-ui-font-scale, 1)); font-weight: 600;
}
.gitui-branch-new input {
  background: transparent; color: var(--git-ui-text);
  border: 1px solid var(--git-ui-border); border-radius: 6px; padding: 2px 8px; font-size: calc(12px * var(--git-ui-font-scale, 1)); outline: none;
  flex: 1; max-width: 200px;
}
.gitui-branch-new input:focus { border-color: var(--git-ui-accent); }

/* AI commit plan */
.gitui-commit-plan { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.gitui-commit-plan-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.gitui-plan-group {
  border: 1px solid var(--git-ui-border); border-radius: 8px; overflow: hidden;
  display: flex; flex-direction: column;
}
.gitui-plan-group-current { border-color: var(--git-ui-accent); }
.gitui-plan-group-done { opacity: .72; }
.gitui-plan-group-head {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px;
  background: var(--dsw-alias-bg-layer-2, rgba(128,128,128,.08));
  border-bottom: 1px solid var(--git-ui-border);
}
.gitui-plan-index {
  width: 18px; height: 18px; flex: none; border-radius: 9px;
  background: var(--git-ui-accent); color: #fff;
  font-size: calc(11px * var(--git-ui-font-scale, 1)); line-height: calc(18px * var(--git-ui-font-scale, 1)); text-align: center; font-weight: 600;
}
.gitui-plan-files { display: flex; gap: 4px; flex-wrap: wrap; flex: 1; min-width: 0; }
.gitui-plan-file {
  font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim);
  border: 1px solid var(--git-ui-border); border-radius: 4px; padding: 0 5px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;
}
.gitui-plan-hash { font-family: ui-monospace, Consolas, monospace; font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-accent); flex: none; }
.gitui-plan-message {
  width: 100%; min-height: 64px; resize: vertical;
  background: transparent; color: var(--git-ui-text);
  border: none; outline: none; padding: 6px 8px;
  font-size: calc(12px * var(--git-ui-font-scale, 1)); font-family: inherit; line-height: 1.5;
}
.gitui-commit-plan-actions {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-top: 1px solid var(--git-ui-border);
}

/* header action */
.gitui-header-btn {
  /* The header slot lives OUTSIDE [data-git-ui-root], so re-declare the
     theme vars here; without them the badge pill loses its background
     (var() is invalid at computed-value time) and the count is invisible. */
  --git-ui-border: var(--dsw-alias-border-l2, rgba(128,128,128,.25));
  --git-ui-text: var(--dsw-alias-label-primary, inherit);
  --git-ui-accent: var(--dsw-alias-brand-primary, #4d9fff);
  display: inline-flex; align-items: center; gap: 4px;
  background: transparent; border: 1px solid var(--git-ui-border); border-radius: 6px;
  color: var(--git-ui-text); font-size: calc(12px * var(--git-ui-font-scale, 1)); padding: 2px 8px; cursor: pointer;
  min-height: 26px;
}
.gitui-header-btn:hover { border-color: var(--git-ui-accent); color: var(--git-ui-accent); }
.gitui-header-btn.gitui-active { border-color: var(--git-ui-accent); color: var(--git-ui-accent); background: rgba(77, 159, 255, .1); }
`;

export function ensureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-git-ui";
  tag.dataset.pluginCss = TAG_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}