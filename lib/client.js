window.__ModuleLoader__.load({
	id: "dsh-git-ui",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region src/types.ts
		const NO_WS_FLAGS = {
			trimEol: false,
			ignoreWs: false,
			ignoreBlank: false
		};
		/** True when at least one whitespace flag is active. */
		function wsFlagsActive(flags) {
			return flags !== void 0 && (flags.trimEol || flags.ignoreWs || flags.ignoreBlank);
		}
		//#endregion
		//#region src/client/store.ts
		/**
		* Module-level UI store for the Git panel: open/collapsed state, the active
		* repository directory, and the latest status snapshot. Both slot occupants
		* (header action + dock panel) share it via useSyncExternalStore; no cordis
		* service or slot store seat is needed.
		*/
		const DIR_KEY = "dsh-git-ui.dir";
		/**
		* v2 key: the pre-v2 build wrote "0" (pinned) on every manual dir switch, so
		* browsers with that leftover were pinned by default. A fresh key makes the
		* default follow the session again; explicit pins use the new key.
		*/
		const FOLLOW_KEY = "dsh-git-ui.follow.v2";
		const HEIGHT_KEY = "dsh-git-ui.height";
		const WIDTH_KEY = "dsh-git-ui.width";
		const POS_KEY = "dsh-git-ui.pos";
		const SPLIT_KEY = "dsh-git-ui.splits";
		const RECENT_DIRS_KEY = "dsh-git-ui.recentDirs";
		const RECENT_DIRS_MAX = 20;
		const DEFAULT_HEIGHT = 320;
		const DEFAULT_WIDTH = 760;
		const MAX_WIDTH = 1600;
		/** Default left-list width per split tab (px); the CSS %-based fallback. */
		const SPLIT_DEFAULTS = {
			changes: 340,
			files: 320,
			history: 340
		};
		const FONT_SCALE_MIN = .8;
		const FONT_SCALE_MAX = 1.6;
		const FONT_SCALE_STEP = .1;
		const FONT_SCALE_KEY = "dsh-git-ui.font-scale";
		function clampFontScale(size) {
			if (!Number.isFinite(size)) return 1;
			return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(size * 10) / 10));
		}
		function readFontScale() {
			try {
				const saved = localStorage.getItem(FONT_SCALE_KEY);
				if (saved !== null) {
					const value = Number(saved);
					if (Number.isFinite(value)) return clampFontScale(value);
				}
			} catch {}
			return 1;
		}
		function readNumber(key, fallback) {
			try {
				const saved = localStorage.getItem(key);
				if (saved !== null) {
					const value = Number(saved);
					if (Number.isFinite(value)) return value;
				}
			} catch {}
			return fallback;
		}
		function readPos() {
			try {
				const saved = localStorage.getItem(POS_KEY);
				if (saved !== null) {
					const parsed = JSON.parse(saved);
					if (typeof parsed.x === "number" && typeof parsed.y === "number") return {
						x: parsed.x,
						y: parsed.y
					};
				}
			} catch {}
			return {
				x: 96,
				y: 72
			};
		}
		function initialFollow() {
			try {
				return localStorage.getItem(FOLLOW_KEY) !== "0";
			} catch {
				return true;
			}
		}
		function initialDir() {
			try {
				const saved = localStorage.getItem(DIR_KEY);
				if (saved !== null && saved !== "") return saved;
			} catch {}
			return "";
		}
		function initialFloating() {
			return false;
		}
		function readSplits() {
			const out = { ...SPLIT_DEFAULTS };
			try {
				const saved = localStorage.getItem(SPLIT_KEY);
				if (saved !== null) {
					const parsed = JSON.parse(saved);
					for (const key of [
						"changes",
						"files",
						"history"
					]) {
						const value = parsed[key];
						if (typeof value === "number" && Number.isFinite(value)) out[key] = Math.round(value);
					}
				}
			} catch {}
			return out;
		}
		function initialRecentDirs() {
			try {
				const saved = localStorage.getItem(RECENT_DIRS_KEY);
				if (saved !== null) {
					const parsed = JSON.parse(saved);
					if (Array.isArray(parsed)) {
						const seen = /* @__PURE__ */ new Set();
						const out = [];
						for (const item of parsed) {
							if (typeof item !== "string") continue;
							const path = item.trim();
							if (path === "" || seen.has(path)) continue;
							seen.add(path);
							out.push(path);
							if (out.length >= RECENT_DIRS_MAX) break;
						}
						return out;
					}
				}
			} catch {}
			return [];
		}
		let snapshot = {
			open: false,
			dir: initialDir(),
			followSession: initialFollow(),
			status: null,
			statusLoading: false,
			statusError: null,
			statusErrorCode: null,
			panelHeight: Math.min(720, Math.max(240, readNumber(HEIGHT_KEY, DEFAULT_HEIGHT))),
			splitWidths: readSplits(),
			fullscreen: false,
			floating: initialFloating(),
			floatPos: readPos(),
			floatMaximized: false,
			floatWidth: Math.min(MAX_WIDTH, Math.max(360, readNumber(WIDTH_KEY, DEFAULT_WIDTH))),
			revision: 0,
			fontScale: readFontScale(),
			recentDirs: initialRecentDirs()
		};
		const listeners = /* @__PURE__ */ new Set();
		function set(patch) {
			snapshot = {
				...snapshot,
				...patch
			};
			for (const listener of listeners) listener();
		}
		function getGitUiSnapshot() {
			return snapshot;
		}
		function subscribeGitUi(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		function useGitUi() {
			return (0, react.useSyncExternalStore)(subscribeGitUi, getGitUiSnapshot);
		}
		function gitUiSetOpen(open) {
			set({ open });
		}
		/** Manual dir switch is a temporary view: the pin is cleared, so the panel
		* follows the session again unless the user explicitly re-pins. */
		function gitUiSetDir(dir) {
			const normalized = dir.trim();
			set({
				dir: normalized,
				status: null,
				statusError: null,
				statusErrorCode: null,
				followSession: true
			});
			try {
				if (normalized === "") localStorage.removeItem(DIR_KEY);
				else localStorage.setItem(DIR_KEY, normalized);
				localStorage.removeItem(FOLLOW_KEY);
			} catch {}
		}
		/** Session-cwd follower: updates dir without clearing the follow flag. */
		function gitUiFollowCwd(cwd) {
			const normalized = cwd.trim();
			if (normalized === "" || normalized === snapshot.dir) return;
			set({
				dir: normalized,
				status: null,
				statusError: null,
				statusErrorCode: null
			});
		}
		/** Re-enable session following; the panel effect applies the current cwd.
		*  Persisted so a page reload does not silently unpin a manual dir. */
		function gitUiSetFollowSession(follow) {
			set({ followSession: follow });
			try {
				if (follow) localStorage.removeItem(FOLLOW_KEY);
				else localStorage.setItem(FOLLOW_KEY, "0");
			} catch {}
		}
		function gitUiSetStatus(status, error, errorCode = null) {
			set({
				status,
				statusError: error,
				statusErrorCode: errorCode,
				statusLoading: false,
				revision: snapshot.revision + 1
			});
		}
		function gitUiSetStatusLoading(loading) {
			set({ statusLoading: loading });
		}
		/** Clamp + persist a split-tab left-list width (double-click resets). */
		function gitUiSetSplitWidth(tab, width) {
			const clamped = Math.max(120, Math.round(width));
			const splitWidths = {
				...snapshot.splitWidths,
				[tab]: clamped
			};
			set({ splitWidths });
			try {
				localStorage.setItem(SPLIT_KEY, JSON.stringify(splitWidths));
			} catch {}
		}
		/** Clamp + persist the user-resized panel height. */
		function gitUiSetPanelHeight(height) {
			const clamped = Math.min(720, Math.max(240, Math.round(height)));
			set({ panelHeight: clamped });
			try {
				localStorage.setItem(HEIGHT_KEY, String(clamped));
			} catch {}
		}
		function gitUiSetFullscreen(fullscreen) {
			set({ fullscreen });
		}
		/** Restore the floating window from its maximized state (drag/resize). */
		function gitUiSetFloatMaximized(maximized) {
			set({ floatMaximized: maximized });
		}
		function gitUiSetFloatPos(x, y) {
			set({ floatPos: {
				x,
				y
			} });
			try {
				localStorage.setItem(POS_KEY, JSON.stringify({
					x,
					y
				}));
			} catch {}
		}
		/** Clamp + persist the user-resized floating-window width. */
		function gitUiSetFloatWidth(width) {
			const clamped = Math.min(MAX_WIDTH, Math.max(360, Math.round(width)));
			set({ floatWidth: clamped });
			try {
				localStorage.setItem(WIDTH_KEY, String(clamped));
			} catch {}
		}
		/** Set + persist the global panel font-scale multiplier (clamped). */
		function gitUiSetFontScale(scale) {
			const clamped = clampFontScale(scale);
			set({ fontScale: clamped });
			try {
				localStorage.setItem(FONT_SCALE_KEY, String(clamped));
			} catch {}
		}
		/** Adjust the global panel font-scale by a step, clamped to the range. */
		function gitUiAdjustFontScale(delta) {
			gitUiSetFontScale(snapshot.fontScale + delta);
		}
		/** Persist a dir the user entered manually; used for the dropdown + new tabs. */
		function gitUiAddRecentDir(dir) {
			const normalized = dir.trim();
			if (normalized === "" || snapshot.recentDirs.includes(normalized)) return;
			const recentDirs = [normalized, ...snapshot.recentDirs].slice(0, RECENT_DIRS_MAX);
			set({ recentDirs });
			try {
				localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(recentDirs));
			} catch {}
		}
		/** Remove a manual dir record from the dropdown list (never the workspace). */
		function gitUiRemoveRecentDir(dir) {
			const recentDirs = snapshot.recentDirs.filter((item) => item !== dir);
			set({ recentDirs });
			try {
				localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(recentDirs));
			} catch {}
		}
		//#endregion
		//#region src/client/api.ts
		var GitApiError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
				this.name = "GitApiError";
			}
		};
		var GitApi = class {
			namespace;
			constructor(namespace) {
				this.namespace = namespace;
			}
			async call(name, args) {
				const method = this.namespace()[name];
				if (typeof method !== "function") throw new GitApiError("not-mounted", "Git 服务未就绪");
				const rpc = await method(args);
				if (!rpc.ok) throw new GitApiError("rpc-failed", rpc.error?.message ?? "远程调用失败");
				const business = rpc.value;
				if (business.ok) return business.value;
				throw new GitApiError(business.error.code, business.error.message);
			}
			async status(dir) {
				return this.call("status", { dir });
			}
			async diff(dir, path, staged, wsFlags) {
				return (await this.call("diff", {
					dir,
					...path !== void 0 ? { path } : {},
					...staged !== void 0 ? { staged } : {},
					...wsFlagsActive(wsFlags) ? { wsFlags } : {}
				})).files;
			}
			async stageHunks(dir, path, hunks, wsFlags) {
				await this.call("stageHunks", {
					dir,
					path,
					hunks,
					...wsFlagsActive(wsFlags) ? { wsFlags } : {}
				});
			}
			async revertHunks(dir, path, hunks, wsFlags) {
				await this.call("revertHunks", {
					dir,
					path,
					hunks,
					...wsFlagsActive(wsFlags) ? { wsFlags } : {}
				});
			}
			/** IDEA-style: operate on one visual change (block) instead of a whole hunk. */
			async stageChanges(dir, path, change, wsFlags) {
				await this.call("stageChanges", {
					dir,
					path,
					change,
					...wsFlagsActive(wsFlags) ? { wsFlags } : {}
				});
			}
			async revertChanges(dir, path, change, wsFlags) {
				await this.call("revertChanges", {
					dir,
					path,
					change,
					...wsFlagsActive(wsFlags) ? { wsFlags } : {}
				});
			}
			async stage(dir, paths) {
				await this.call("stage", {
					dir,
					paths
				});
			}
			async unstage(dir, paths) {
				await this.call("unstage", {
					dir,
					paths
				});
			}
			async discard(dir, paths, staged) {
				await this.call("discard", {
					dir,
					paths,
					...staged === true ? { staged } : {}
				});
			}
			async untrack(dir, paths) {
				await this.call("untrack", {
					dir,
					paths
				});
			}
			async getFromRevision(dir, paths, revision) {
				await this.call("getFromRevision", {
					dir,
					paths,
					revision
				});
			}
			async listDir(dir, path) {
				return (await this.call("listDir", {
					dir,
					...path !== void 0 && path !== "" ? { path } : {}
				})).entries;
			}
			async readFile(dir, path) {
				return this.call("readFile", {
					dir,
					path
				});
			}
			async binaryContent(dir, path, ref) {
				return this.call("binaryContent", {
					dir,
					path,
					...ref !== void 0 && ref !== "" ? { ref } : {}
				});
			}
			async writeFile(dir, path, content) {
				await this.call("writeFile", {
					dir,
					path,
					content
				});
			}
			async deleteFile(dir, path, recursive) {
				await this.call("deleteFile", {
					dir,
					path,
					...recursive === true ? { recursive } : {}
				});
			}
			async commit(dir, message, amend, paths, partial) {
				const value = await this.call("commit", {
					dir,
					message,
					amend,
					...paths !== void 0 && paths.length > 0 ? { paths } : {},
					...partial !== void 0 && partial.length > 0 ? { partial } : {}
				});
				return {
					hash: value.hash,
					short: value.short
				};
			}
			async branches(dir) {
				return this.call("branches", { dir });
			}
			async renameBranch(dir, oldName, newName) {
				await this.call("branchRename", {
					dir,
					oldName,
					newName
				});
			}
			async deleteBranch(dir, name, force) {
				await this.call("branchDelete", {
					dir,
					name,
					force
				});
			}
			async checkout(dir, branch, create, startPoint) {
				await this.call("checkout", {
					dir,
					branch,
					...create === true ? { create } : {},
					...startPoint !== void 0 && startPoint !== "" ? { startPoint } : {}
				});
			}
			async merge(dir, branch, noFF) {
				return this.call("merge", {
					dir,
					branch,
					...noFF === true ? { noFF } : {}
				});
			}
			async conflictContent(dir, path) {
				return this.call("conflictContent", {
					dir,
					path
				});
			}
			async resolveFile(dir, path, content) {
				await this.call("resolveFile", {
					dir,
					path,
					content
				});
			}
			async repos(dirs) {
				return (await this.call("repos", { dirs })).repos;
			}
			/** Find git repositories inside the subdirectories of `dir` (max 3 levels). */
			async findRepos(dir, maxDepth) {
				return (await this.call("findRepos", {
					dir,
					...maxDepth !== void 0 ? { maxDepth } : {}
				})).repos;
			}
			/** Run `git init` in `dir`; resolves to the repository root. */
			async init(dir) {
				return (await this.call("init", { dir })).root;
			}
			/** Clone a remote repository into `target`; resolves to the repository root. */
			async clone(url, target) {
				return (await this.call("clone", {
					url,
					target
				})).root;
			}
			/** Ask the shared LLM to analyze the repo and update `.gitignore`. */
			async suggestGitignore(dir) {
				return this.call("suggestGitignore", { dir });
			}
			async commitDetail(dir, hash) {
				return this.call("commitDetail", {
					dir,
					hash
				});
			}
			async commitDiff(dir, hash, path) {
				return (await this.call("commitDiff", {
					dir,
					hash,
					...path !== void 0 ? { path } : {}
				})).files;
			}
			/** Ask the LLM to plan the working-tree changes into commit groups. */
			async suggestCommits(dir) {
				return (await this.call("suggestCommits", { dir })).groups;
			}
			/** Execute the planned commit groups in order. */
			async executeCommits(dir, groups) {
				return (await this.call("executeCommits", {
					dir,
					groups
				})).commits;
			}
			async remotes(dir) {
				return (await this.call("remotes", { dir })).remotes;
			}
			async remoteAdd(dir, name, url) {
				await this.call("remoteAdd", {
					dir,
					name,
					url
				});
			}
			async remoteRemove(dir, name) {
				await this.call("remoteRemove", {
					dir,
					name
				});
			}
			async remoteRename(dir, oldName, newName) {
				await this.call("remoteRename", {
					dir,
					oldName,
					newName
				});
			}
			async remoteSetUrl(dir, name, url) {
				await this.call("remoteSetUrl", {
					dir,
					name,
					url
				});
			}
			async push(dir, remote, branch, setUpstream, remoteBranch, force, followTags) {
				return this.call("push", {
					dir,
					remote,
					branch,
					...setUpstream === true ? { setUpstream } : {},
					...remoteBranch !== void 0 && remoteBranch !== "" ? { remoteBranch } : {},
					...force === true ? { force } : {},
					...followTags === true ? { followTags } : {}
				});
			}
			async fetch(dir, remote) {
				return this.call("fetch", {
					dir,
					...remote !== void 0 ? { remote } : {}
				});
			}
			async pull(dir, remote, branch, strategy) {
				return this.call("pull", {
					dir,
					remote,
					branch,
					...strategy !== void 0 ? { strategy } : {}
				});
			}
			async configList(dir, scope) {
				return this.call("configList", {
					dir,
					scope
				});
			}
			async configSet(dir, scope, key, value) {
				await this.call("configSet", {
					dir,
					scope,
					key,
					value
				});
			}
			async configUnset(dir, scope, key) {
				await this.call("configUnset", {
					dir,
					scope,
					key
				});
			}
			async pullRemoteBranch(dir, remoteRef) {
				return this.call("pullRemoteBranch", {
					dir,
					remoteRef
				});
			}
			async stashList(dir) {
				return (await this.call("stashList", { dir })).stashes;
			}
			async stashPush(dir, message, includeUntracked) {
				return this.call("stashPush", {
					dir,
					...message !== void 0 && message !== "" ? { message } : {},
					...includeUntracked === true ? { includeUntracked } : {}
				});
			}
			async stashPop(dir, index) {
				return this.call("stashPop", {
					dir,
					...index !== void 0 ? { index } : {}
				});
			}
			async stashDrop(dir, index) {
				await this.call("stashDrop", {
					dir,
					...index !== void 0 ? { index } : {}
				});
			}
			async stashApply(dir, index) {
				return this.call("stashApply", {
					dir,
					...index !== void 0 ? { index } : {}
				});
			}
			async stashClear(dir) {
				await this.call("stashClear", { dir });
			}
			async stashShow(dir, index) {
				return (await this.call("stashShow", {
					dir,
					index
				})).lines;
			}
			async stashBranch(dir, index, name) {
				await this.call("stashBranch", {
					dir,
					index,
					name
				});
			}
			async cherryPick(dir, hash) {
				return this.call("cherryPick", {
					dir,
					hash
				});
			}
			async revert(dir, hash) {
				return this.call("revert", {
					dir,
					hash
				});
			}
			/** Fold the given commits (oldest first) into a single new commit. */
			async squashCommits(dir, hashes, message) {
				return this.call("squashCommits", {
					dir,
					hashes,
					message
				});
			}
			async reset(dir, mode, ref) {
				await this.call("reset", {
					dir,
					mode,
					...ref !== void 0 ? { ref } : {}
				});
			}
			async operationAbort(dir) {
				await this.call("operationAbort", { dir });
			}
			async operationContinue(dir, message) {
				return this.call("operationContinue", {
					dir,
					...message !== void 0 ? { message } : {}
				});
			}
			async tags(dir) {
				return (await this.call("tags", { dir })).tags;
			}
			async tagCreate(dir, name, hash) {
				await this.call("tagCreate", {
					dir,
					name,
					...hash !== void 0 ? { hash } : {}
				});
			}
			async tagDelete(dir, name) {
				await this.call("tagDelete", {
					dir,
					name
				});
			}
			async fileLog(dir, path, limit) {
				return (await this.call("fileLog", {
					dir,
					path,
					limit
				})).commits;
			}
			async compare(dir, from, to) {
				return (await this.call("compare", {
					dir,
					from,
					to
				})).files;
			}
			async logGraph(dir, limit, filters) {
				return (await this.call("logGraph", {
					dir,
					...limit !== void 0 ? { limit } : {},
					...filters?.branch !== void 0 && filters.branch !== "" ? { branch: filters.branch } : {},
					...filters?.author !== void 0 && filters.author !== "" ? { author: filters.author } : {},
					...filters?.since !== void 0 && filters.since !== "" ? { since: filters.since } : {},
					...filters?.until !== void 0 && filters.until !== "" ? { until: filters.until } : {},
					...filters?.path !== void 0 && filters.path !== "" ? { path: filters.path } : {}
				})).rows;
			}
			async logAuthors(dir, branch) {
				return (await this.call("logAuthors", {
					dir,
					...branch !== void 0 && branch !== "" ? { branch } : {}
				})).authors;
			}
			async changelistList(dir) {
				return this.call("changelistList", { dir });
			}
			async changelistCreate(dir, name) {
				await this.call("changelistCreate", {
					dir,
					name
				});
			}
			async changelistRename(dir, oldName, newName) {
				await this.call("changelistRename", {
					dir,
					oldName,
					newName
				});
			}
			async changelistDelete(dir, name) {
				await this.call("changelistDelete", {
					dir,
					name
				});
			}
			async changelistMove(dir, paths, to) {
				await this.call("changelistMove", {
					dir,
					paths,
					to
				});
			}
			async changelistSetActive(dir, name) {
				await this.call("changelistSetActive", {
					dir,
					name
				});
			}
			async ignoreAdd(dir, path, target) {
				await this.call("ignoreAdd", {
					dir,
					path,
					target
				});
			}
			async pushPreview(dir, remote, branch) {
				return this.call("pushPreview", {
					dir,
					remote,
					branch
				});
			}
			async rebaseList(dir, base) {
				return this.call("rebaseList", {
					dir,
					...base !== void 0 && base !== "" ? { base } : {}
				});
			}
			async rebaseStart(dir, base, items) {
				return this.call("rebaseStart", {
					dir,
					base,
					items
				});
			}
			async operationSkip(dir) {
				return this.call("operationSkip", { dir });
			}
			async diffWithWorktree(dir, hash, path) {
				return (await this.call("diffWithWorktree", {
					dir,
					hash,
					...path !== void 0 ? { path } : {}
				})).files;
			}
			/**
			* Refresh the shared status snapshot in the module store.
			* @returns the fresh status, or null when the dir is not a repository.
			*/
			async refreshStatus(dir) {
				gitUiSetStatusLoading(true);
				try {
					const status = await this.status(dir);
					gitUiSetStatus(status, null);
					return status;
				} catch (error) {
					gitUiSetStatus(null, error.message, error instanceof GitApiError ? error.code : null);
					return null;
				}
			}
		};
		//#endregion
		//#region src/client/styles.ts
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
		  position: fixed; inset: 0;
		  z-index: 2147483000; border-radius: 0; border: none;
		}
		/* The maximized panel covers the whole viewport (portaled to <body> so it
		   beats the host tab bar's stacking context). Drop the fixed 420px panel
		   height so the box is sized by the inset. */
		.gitui-panel.gitui-fullscreen {
		  height: auto; max-height: none;
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
		  /* Anchor for the transient toast overlay. */
		  position: relative;
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
		  display: flex; align-items: center; gap: 6px;
		  padding: 6px 10px;
		  font-size: calc(12px * var(--git-ui-font-scale, 1));
		  cursor: pointer;
		  border-radius: 6px;
		}
		.gitui-dir-option-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.gitui-dir-option-del {
		  flex: none; background: transparent; border: none; color: var(--git-ui-text-dim);
		  cursor: pointer; padding: 0 2px; font-size: calc(12px * var(--git-ui-font-scale, 1));
		  line-height: 1; border-radius: 4px; visibility: hidden;
		}
		.gitui-dir-option:hover .gitui-dir-option-del,
		.gitui-dir-option-selected .gitui-dir-option-del { visibility: visible; }
		.gitui-dir-option-del:hover { color: var(--git-ui-text); background: rgba(128,128,128,.15); }
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
		.gitui-filetree-editor { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; position: relative; }
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
		/* Multi-select highlight: a blue tint like the log list; the primary
		   (diff-target) row is stronger with an accent inset bar. */
		.gitui-file-selected { background: rgba(77, 159, 255, .12); }
		.gitui-file-selected.gitui-file-primary { background: rgba(77, 159, 255, .20); box-shadow: inset 2px 0 0 var(--git-ui-accent, #4d9fff); }
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
		
		.gitui-detail { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; position: relative; }
		.gitui-detail-header {
		  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
		  border-bottom: 1px solid var(--git-ui-border); font-size: calc(12px * var(--git-ui-font-scale, 1));
		}
		.gitui-diff { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; position: relative; }
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
		.gitui-clone-dialog { width: 560px; }
		.gitui-clone-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; }
		.gitui-clone-row .gitui-dir { flex: 1; min-width: 0; }
		.gitui-clone-label { flex: 0 0 auto; font-size: calc(12px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); }
		.gitui-clone-foot { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-top: 1px solid var(--git-ui-border); }
		.gitui-clone-hint { font-size: calc(11px * var(--git-ui-font-scale, 1)); color: var(--git-ui-text-dim); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
		
		/* Transient action-feedback toast: floats above the content (bottom-center
		   of the nearest positioned panel container) and auto-dismisses, so it never
		   takes layout height like the old persistent green notice bars. */
		.gitui-toast {
		  position: absolute;
		  left: 50%;
		  bottom: 14px;
		  transform: translateX(-50%);
		  z-index: 9000;
		  max-width: min(520px, 92%);
		  padding: 6px 14px;
		  border-radius: 8px;
		  background: var(--dsw-alias-bg-layer-1, #1e1e1e);
		  border: 1px solid var(--git-ui-border);
		  box-shadow: 0 6px 22px rgba(0, 0, 0, .35);
		  color: var(--dsw-alias-state-success-primary, #3fb950);
		  font-size: calc(12px * var(--git-ui-font-scale, 1));
		  line-height: 1.5;
		  text-align: center;
		  pointer-events: none;
		  opacity: 1;
		  transition: opacity .24s ease;
		  animation: gitui-toast-in .18s ease-out;
		}
		.gitui-toast-error { color: var(--dsw-alias-state-error-primary, #f85149); }
		.gitui-toast-leave { opacity: 0; }
		@keyframes gitui-toast-in {
		  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
		  to { opacity: 1; transform: translateX(-50%) translateY(0); }
		}
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
		.gitui-mr { display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative; }
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
		/* One reserved gutter slot per line for the per-block action button, so it is
		   always visible (like the diff area's fixed gutter arrow) and never overlaps
		   the line number. Empty on lines without a block action, so numbers stay
		   aligned. */
		.gitui-mr-actslot {
		  flex: none; width: 18px;
		  display: inline-flex; align-items: center; justify-content: center;
		}
		/* Right-side slot (ours pane): sits after the content, hugging the Result
		   boundary, holding the apply + not-apply pair side by side. */
		.gitui-mr-actslot-r {
		  width: auto; margin-left: 2px; gap: 2px;
		  display: inline-flex; align-items: center; justify-content: flex-end;
		}
		.gitui-mr-act {
		  width: 18px; height: 16px; padding: 0;
		  border: none; border-radius: 4px; background: transparent;
		  cursor: pointer; font-size: calc(12px * var(--git-ui-font-scale, 1)); font-weight: 700;
		  line-height: 1; display: inline-flex; align-items: center; justify-content: center;
		  opacity: .55;
		}
		.gitui-mr-act:hover { background: rgba(0, 0, 0, .1); opacity: 1; }
		/* Apply buttons: left/ours blue, right/theirs orange. The glyph's direction
		   points into the Result column (», «). Applied blocks dim and flip the glyph
		   to the opposite direction, meaning "click to undo". */
		.gitui-mr-act-accept-ours { color: #1f6feb; }
		.gitui-mr-act-accept-theirs { color: #b45309; }
		.gitui-mr-act-done { opacity: .4; }
		/* × = not apply: remove the block from the Result. */
		.gitui-mr-act-remove { color: #cf222e; }
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
		.gitui-remotes-view { flex: 1; display: flex; flex-direction: column; min-height: 0; position: relative; }
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
		.gitui-history { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; position: relative; }
		.gitui-history-layout { display: flex; flex: 1; min-height: 0; overflow: hidden; }
		.gitui-history-side {
		  width: 44%; min-width: 220px; max-width: 380px;
		  display: flex; flex-direction: column; min-height: 0;
		}
		.gitui-history-list { flex: 1; overflow-y: auto; padding: 4px 0; }
		.gitui-log-row {
		  display: flex; gap: 8px; align-items: center; padding: 4px 10px; cursor: pointer;
		  border-left: 2px solid transparent; min-height: 26px;
		  /* Shift+click range selection must not trigger native text selection. */
		  user-select: none; -webkit-user-select: none;
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
		/* Selected rows (click / Ctrl / Shift): light accent blue; the primary row
		   keeps the accent left border. Hover must not revert a selected row to gray. */
		.gitui-log-row-selected { background: rgba(77, 159, 255, .10); border-left-color: var(--git-ui-accent); }
		.gitui-log-row-selected:hover { background: rgba(77, 159, 255, .16); }
		/* Ctrl/Shift multi-selection: same light blue tint for non-primary rows. */
		.gitui-log-row-multi:not(.gitui-log-row-selected) { background: rgba(77, 159, 255, .10); }
		.gitui-log-row-multi:not(.gitui-log-row-selected):hover { background: rgba(77, 159, 255, .14); }
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
		.gitui-commit-plan { display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative; }
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
		function ensureStyles() {
			if (typeof document === "undefined") return;
			if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`) !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-git-ui";
			tag.dataset.pluginCss = TAG_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/components/GitHeaderAction.tsx
		/**
		* Session-header action: the Git toggle button with a live change/conflict
		* badge. Shares the module store with the dock panel.
		*/
		function GitHeaderAction(props) {
			const { t } = props;
			const snapshot = useGitUi();
			const conflicts = snapshot.status?.conflicts?.length ?? 0;
			const total = (snapshot.status?.staged?.length ?? 0) + (snapshot.status?.unstaged?.length ?? 0) + (snapshot.status?.untracked?.length ?? 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "gitui-header-btn" + (snapshot.open ? " gitui-active" : ""),
				onClick: () => gitUiSetOpen(!snapshot.open),
				title: t("panel.title"),
				"aria-label": t("panel.title"),
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 4
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-glyph",
						children: "⑂"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("panel.title") }),
					conflicts > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-badge gitui-badge-danger",
						children: conflicts
					}) : total > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-badge",
						children: total
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/components/Menu.tsx
		/**
		* Menu — IDEA-style context menu. Fixed-position popup at (x, y) with
		* viewport clamping, click-outside / Escape dismissal, and hover submenus.
		*/
		function MenuList(props) {
			const { items, onClose, depth } = props;
			const [sub, setSub] = (0, react.useState)(null);
			const [subPos, setSubPos] = (0, react.useState)(null);
			const itemRefs = (0, react.useRef)([]);
			const openSub = (index) => {
				const el = itemRefs.current[index];
				if (el === void 0 || el === null) return;
				const rect = el.getBoundingClientRect();
				setSub(index);
				const width = 200;
				const x = rect.right + width > window.innerWidth ? rect.left - width : rect.right;
				setSubPos({
					x,
					y: Math.min(rect.top, window.innerHeight - 40)
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-menu-list",
				role: "menu",
				children: items.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
					item.separator === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "gitui-menu-sep" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: (el) => {
							itemRefs.current[index] = el;
						},
						role: "menuitem",
						className: "gitui-menu-item" + (item.danger === true ? " gitui-menu-item-danger" : "") + (item.disabled === true ? " gitui-menu-item-disabled" : "") + (sub === index ? " gitui-menu-item-open" : ""),
						onClick: () => {
							if (item.disabled === true) return;
							if (item.children !== void 0) {
								if (sub === index) setSub(null);
								else openSub(index);
								return;
							}
							item.onClick?.();
							onClose();
						},
						onMouseEnter: () => {
							if (item.children !== void 0) openSub(index);
							else if (sub !== null) setSub(null);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "gitui-menu-label",
							children: item.label
						}), item.children !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "gitui-menu-arrow",
							children: "▸"
						})]
					}),
					sub === index && item.children !== void 0 && subPos !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gitui-menu gitui-menu-sub",
						style: {
							left: subPos.x,
							top: subPos.y
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuList, {
							items: item.children ?? [],
							onClose,
							depth: depth + 1
						})
					})
				] }, index))
			});
		}
		function Menu(props) {
			const { x, y, items, onClose } = props;
			const rootRef = (0, react.useRef)(null);
			const [pos, setPos] = (0, react.useState)({
				x,
				y
			});
			(0, react.useLayoutEffect)(() => {
				const el = rootRef.current;
				if (el !== null) {
					const rect = el.getBoundingClientRect();
					setPos({
						x: Math.min(x, Math.max(0, window.innerWidth - rect.width - 6)),
						y: Math.min(y, Math.max(0, window.innerHeight - rect.height - 6))
					});
				}
				const onDown = (event) => {
					if (!rootRef.current?.contains(event.target)) onClose();
				};
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				window.addEventListener("mousedown", onDown, true);
				window.addEventListener("keydown", onKey, true);
				return () => {
					window.removeEventListener("mousedown", onDown, true);
					window.removeEventListener("keydown", onKey, true);
				};
			}, [x, y]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: rootRef,
				className: "gitui-menu",
				style: {
					left: pos.x,
					top: pos.y
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuList, {
					items,
					onClose,
					depth: 0
				})
			});
		}
		//#endregion
		//#region src/client/components/Toast.tsx
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
		/** How long an "ok" toast stays fully visible before fading out. */
		const TOAST_MS = 2600;
		/** Errors stay a bit longer so the user can read them. */
		const ERROR_TOAST_MS = 4200;
		/** Fade-out duration (kept in sync with the CSS transition). */
		const FADE_MS = 240;
		function Toast(props) {
			const { message, tone = "ok" } = props;
			const [text, setText] = (0, react.useState)(null);
			const [leaving, setLeaving] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (message === null) {
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-toast" + (tone === "error" ? " gitui-toast-error" : "") + (leaving ? " gitui-toast-leave" : ""),
				role: "status",
				children: text
			});
		}
		//#endregion
		//#region src/client/components/PushDialog.tsx
		/**
		* PushDialog — IDEA-style push preview: outgoing commits for the current
		* branch, upstream status, force / follow-tags options, then push.
		*/
		function formatDate$1(timestamp) {
			const date = new Date(timestamp);
			const pad = (value) => String(value).padStart(2, "0");
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}
		function PushDialog(props) {
			const { api, dir, branch, t, onDone, onClose } = props;
			const [remotes, setRemotes] = (0, react.useState)([]);
			const [remote, setRemote] = (0, react.useState)("");
			const [preview, setPreview] = (0, react.useState)(null);
			const [force, setForce] = (0, react.useState)(false);
			const [followTags, setFollowTags] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [ok, setOk] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				setError(null);
				api.remotes(dir).then((list) => {
					if (!alive) return;
					setRemotes(list);
					const name = (list.find((r) => r.name === "origin") ?? list[0])?.name ?? "";
					setRemote(name);
					if (name !== "") api.pushPreview(dir, name, branch).then((value) => {
						if (alive) setPreview(value);
					}).catch((caught) => {
						if (alive) setError(caught.message);
					});
				}).catch(() => setRemotes([]));
				return () => {
					alive = false;
				};
			}, [api, dir]);
			async function doPush() {
				if (remote === "") return;
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					const noUpstream = preview?.upstream === null;
					await api.push(dir, remote, branch, noUpstream ? true : void 0, void 0, force, followTags);
					setOk(t("push.done", {
						branch,
						remote
					}));
					onDone();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-dialog",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-dialog-box",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("push.preview") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "gitui-commit-meta",
								children: [branch, preview !== null && (preview.upstream !== null ? ` → ${preview.upstream}` : ` → ${remote} (${t("push.newBranch")})`)]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								onClick: onClose,
								children: "✕"
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-dialog-body",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-ops-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: "gitui-dir",
										value: remote,
										onChange: (event) => setRemote(event.target.value),
										disabled: busy,
										children: remotes.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: item.name,
											children: item.name
										}, item.name))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "gitui-merge-option",
										title: t("push.forceHint"),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: force,
											onChange: (event) => setForce(event.target.checked),
											disabled: busy
										}), t("push.force")]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "gitui-merge-option",
										title: t("push.followTagsHint"),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: followTags,
											onChange: (event) => setFollowTags(event.target.checked),
											disabled: busy
										}), t("push.followTags")]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "gitui-btn gitui-btn-primary",
										disabled: busy || remote === "" || preview !== null && preview.ahead.length === 0,
										onClick: () => void doPush(),
										children: t("remote.push")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-dialog-list",
								children: [
									preview === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-diff-placeholder",
										children: "…"
									}),
									preview !== null && preview.ahead.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-diff-placeholder",
										children: t("push.upToDate")
									}),
									preview !== null && preview.ahead.map((commit) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "gitui-branch-row",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "gitui-commit-hash",
												children: commit.short
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "gitui-commit-subject",
												title: commit.subject,
												children: commit.subject
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "gitui-commit-meta",
												children: commit.author
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "gitui-commit-meta",
												children: formatDate$1(commit.date)
											})
										]
									}, commit.hash))
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
								message: error !== null ? error : ok,
								tone: error !== null ? "error" : "ok"
							})
						]
					})]
				})
			});
		}
		//#endregion
		//#region src/client/components/RebaseDialog.tsx
		/**
		* RebaseDialog — dialog-style interactive rebase: pick a base (branches/tags
		* or any ref), assign pick/reword/squash/fixup/drop per commit, then start.
		*/
		const ACTIONS = [
			{
				value: "pick",
				labelKey: "rebase.pick"
			},
			{
				value: "reword",
				labelKey: "rebase.reword"
			},
			{
				value: "squash",
				labelKey: "rebase.squash"
			},
			{
				value: "fixup",
				labelKey: "rebase.fixup"
			},
			{
				value: "drop",
				labelKey: "rebase.drop"
			}
		];
		function RebaseDialog(props) {
			const { api, dir, t, baseHint, onDone, onConflicts, onClose } = props;
			const [commits, setCommits] = (0, react.useState)(null);
			const [defaultBase, setDefaultBase] = (0, react.useState)("");
			const [refOptions, setRefOptions] = (0, react.useState)([]);
			const [base, setBase] = (0, react.useState)("");
			const [actions, setActions] = (0, react.useState)([]);
			const [messages, setMessages] = (0, react.useState)([]);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const load = (baseRef) => {
				setCommits(null);
				setError(null);
				api.rebaseList(dir).then((value) => {
					setDefaultBase(value.base);
					setCommits(value.commits);
					setActions(value.commits.map(() => "pick"));
					setMessages(value.commits.map((c) => c.subject));
					if (baseRef === "") setBase(value.base);
				}).catch((caught) => setError(caught.message));
			};
			(0, react.useEffect)(() => {
				load(baseHint ?? "");
				api.branches(dir).then((value) => {
					const local = value.branches.filter((b) => !b.name.startsWith("remotes/")).map((b) => b.name);
					api.tags(dir).then((tags) => {
						setRefOptions([...local, ...tags.map((tag) => tag.name)]);
					});
				}).catch(() => setRefOptions([]));
			}, [api, dir]);
			const items = (0, react.useMemo)(() => {
				return (commits ?? []).map((commit, index) => ({
					action: actions[index] ?? "pick",
					hash: commit.hash,
					...actions[index] === "reword" || actions[index] === "squash" ? { message: messages[index] ?? commit.subject } : {}
				}));
			}, [
				commits,
				actions,
				messages
			]);
			async function start() {
				if (commits === null || base.trim() === "") return;
				setBusy(true);
				setError(null);
				try {
					const outcome = await api.rebaseStart(dir, base.trim(), items);
					if (outcome.conflicts !== void 0 && outcome.conflicts.length > 0) onConflicts();
					else onDone();
					onClose();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-dialog",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-dialog-box gitui-rebase-dialog",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("rebase.title") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								onClick: onClose,
								children: "✕"
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-dialog-body",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-ops-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-merge-label",
										children: t("rebase.onto")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "gitui-dir gitui-rebase-base",
										list: "gitui-rebase-refs",
										value: base,
										placeholder: defaultBase,
										spellCheck: false,
										onChange: (event) => setBase(event.target.value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
										id: "gitui-rebase-refs",
										children: refOptions.map((ref) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: ref }, ref))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "gitui-btn gitui-btn-primary",
										disabled: busy || commits === null || commits.length === 0 || base.trim() === "",
										onClick: () => void start(),
										children: t("rebase.start")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
								message: error,
								tone: "error"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-dialog-list",
								children: [
									commits === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-diff-placeholder",
										children: "…"
									}),
									commits !== null && commits.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-diff-placeholder",
										children: t("rebase.nothing")
									}),
									commits !== null && commits.map((commit, index) => {
										const action = actions[index] ?? "pick";
										const first = index === 0;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "gitui-rebase-row",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "gitui-commit-hash",
													children: commit.short
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "gitui-commit-subject",
													title: commit.subject,
													children: commit.subject
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "gitui-commit-meta",
													children: commit.author
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
													className: "gitui-dir gitui-rebase-action",
													value: action,
													disabled: busy,
													title: first && (action === "squash" || action === "fixup") ? t("rebase.firstHint") : "",
													onChange: (event) => {
														const next = event.target.value;
														setActions((prev) => {
															const copy = [...prev];
															copy[index] = next;
															return copy;
														});
													},
													children: ACTIONS.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: option.value,
														disabled: first && (option.value === "squash" || option.value === "fixup"),
														children: t(option.labelKey)
													}, option.value))
												}),
												(action === "reword" || action === "squash") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: "gitui-dir gitui-rebase-msg",
													value: messages[index] ?? "",
													placeholder: commit.subject,
													spellCheck: false,
													disabled: busy,
													onChange: (event) => {
														setMessages((prev) => {
															const copy = [...prev];
															copy[index] = event.target.value;
															return copy;
														});
													}
												})
											]
										}, commit.hash);
									})
								]
							})
						]
					})]
				})
			});
		}
		//#endregion
		//#region src/client/components/CloneDialog.tsx
		/**
		* CloneDialog — clone a remote repository: URL + target directory (full path,
		* git clone semantics). A quick button fills the target under the current
		* session working directory with the repo name derived from the URL.
		*/
		/** Derive a directory name from a remote URL (https, ssh, git, file…). */
		function repoNameFromUrl(url) {
			return (url.trim().replace(/\/+$/, "").replace(/\.git$/i, "").split(/[\\/:]/).filter(Boolean).pop() ?? "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim();
		}
		/** Browser-side path join (no node path module); normalizes trailing separators. */
		function joinPath(base, name) {
			return base.replace(/[\\/]+$/, "") + "/" + name;
		}
		function CloneDialog(props) {
			const { api, t, sessionDir, onDone, onClose } = props;
			const [url, setUrl] = (0, react.useState)("");
			const [target, setTarget] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			async function doClone() {
				const u = url.trim();
				const tgt = target.trim();
				if (u === "" || tgt === "" || busy) return;
				setBusy(true);
				setError(null);
				try {
					const root = await api.clone(u, tgt);
					onDone(root);
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			const fillSessionTarget = () => {
				const base = sessionDir.trim();
				if (base === "") return;
				const name = repoNameFromUrl(url);
				setTarget(name === "" ? base : joinPath(base, name));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-dialog",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-dialog-box gitui-clone-dialog",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("clone.title") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								onClick: onClose,
								children: "✕"
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-dialog-body",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-clone-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "gitui-clone-label",
									children: t("clone.url")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "gitui-dir",
									value: url,
									placeholder: t("clone.urlPlaceholder"),
									spellCheck: false,
									disabled: busy,
									onChange: (event) => setUrl(event.target.value),
									onKeyDown: (event) => {
										if (event.key === "Enter") doClone();
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-clone-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-clone-label",
										children: t("clone.target")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "gitui-dir",
										value: target,
										placeholder: t("clone.targetPlaceholder"),
										spellCheck: false,
										disabled: busy,
										onChange: (event) => setTarget(event.target.value),
										onKeyDown: (event) => {
											if (event.key === "Enter") doClone();
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "gitui-btn",
										title: t("clone.useSessionHint"),
										disabled: busy || sessionDir.trim() === "",
										onClick: fillSessionTarget,
										children: t("clone.useSession")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-clone-foot",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-clone-hint",
										children: sessionDir.trim() === "" ? t("clone.sessionUnavailable") : t("clone.sessionHint", { dir: sessionDir })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "gitui-btn gitui-btn-primary",
										disabled: busy || url.trim() === "" || target.trim() === "",
										onClick: () => void doClone(),
										children: busy ? t("clone.busy") : t("clone.submit")
									})
								]
							}),
							error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-error",
								style: { padding: "4px 10px" },
								children: error
							})
						]
					})]
				})
			});
		}
		//#endregion
		//#region src/client/components/GetFromRevisionDialog.tsx
		/**
		* GetFromRevisionDialog — pick a revision and check the selected change
		* file(s) out at that revision (IDEA's "Get from revision"). Lists recent
		* commits for one-click selection, but the user may type any revision/ref.
		*/
		function GetFromRevisionDialog(props) {
			const { api, t, dir, paths, onDone, onClose } = props;
			const [revision, setRevision] = (0, react.useState)("");
			const [rows, setRows] = (0, react.useState)([]);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				api.logGraph(dir, 100).then((list) => {
					if (alive) setRows(list);
				}).catch(() => {
					if (alive) setRows([]);
				});
				return () => {
					alive = false;
				};
			}, [api, dir]);
			async function doGet() {
				const rev = revision.trim();
				if (rev === "" || busy) return;
				setBusy(true);
				setError(null);
				try {
					await api.getFromRevision(dir, paths, rev);
					onDone();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-dialog",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-dialog-box gitui-clone-dialog",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("getFromRevision.title") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								onClick: onClose,
								children: "✕"
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-dialog-body",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-clone-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-clone-label",
										children: t("getFromRevision.revision")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "gitui-dir",
										value: revision,
										placeholder: t("getFromRevision.revisionPlaceholder"),
										spellCheck: false,
										autoFocus: true,
										onChange: (event) => setRevision(event.target.value),
										onKeyDown: (event) => {
											if (event.key === "Enter") doGet();
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-clone-hint",
										children: t("getFromRevision.paths", { n: paths.length })
									})
								]
							}),
							rows.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-dialog-list",
								style: {
									minHeight: 160,
									maxHeight: 260
								},
								children: rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-log-row" + (row.hash === revision ? " gitui-log-row-selected" : ""),
									style: {
										borderLeft: "none",
										cursor: "pointer"
									},
									title: row.hash,
									onClick: () => setRevision(row.hash),
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gitui-log-graph",
											style: { minWidth: 8 }
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gitui-commit-subject",
											children: row.subject
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gitui-commit-meta",
											children: row.short
										})
									]
								}, row.hash))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-clone-foot",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-clone-hint",
										children: revision === "" ? t("getFromRevision.hint") : t("getFromRevision.willGet", { rev: revision })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "gitui-btn",
										disabled: busy,
										onClick: onClose,
										children: t("commit.cancel")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "gitui-btn gitui-btn-primary",
										disabled: busy || revision.trim() === "",
										onClick: () => void doGet(),
										children: busy ? t("getFromRevision.busy") : t("getFromRevision.submit")
									})
								]
							}),
							error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-error",
								style: { padding: "4px 10px" },
								children: error
							})
						]
					})]
				})
			});
		}
		//#endregion
		//#region src/client/components/Splitter.tsx
		/**
		* Splitter — a vertical drag handle between a fixed-width left list and a
		* flexible right pane (used by the Changes / Files / History tabs). Drag to
		* resize, double-click to reset to the default width.
		*/
		/**
		* Slim bar on the directory pane (Changes / Files tabs) carrying the
		* "narrow to minimum" (−) button: collapses the left list to SPLIT_MIN px.
		* Drag the splitter (or double-click it) to restore a wider list.
		*/
		function PaneMinBar(props) {
			const { title, onNarrow } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-pane-bar",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "gitui-pane-min",
					title,
					onClick: onNarrow,
					children: "–"
				})]
			});
		}
		/**
		* Vertical restore strip shown in place of the directory pane when it is
		* hidden: one button brings the pane back at its previous width.
		*/
		function PaneRestoreBar(props) {
			const { title, onRestore } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-pane-restore",
				title,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "gitui-pane-restore-btn",
					onClick: onRestore,
					children: "▶"
				})
			});
		}
		function Splitter(props) {
			const { width, onChange, onReset, title } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-splitter",
				title,
				onDoubleClick: onReset,
				onMouseDown: (event) => {
					event.preventDefault();
					const startX = event.clientX;
					const startWidth = width;
					const containerWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? startWidth * 2;
					const maxWidth = Math.max(120, containerWidth - 260);
					const minWidth = Math.min(120, maxWidth);
					const onMove = (move) => {
						onChange(Math.min(maxWidth, Math.max(minWidth, startWidth + move.clientX - startX)));
					};
					const onUp = () => {
						window.removeEventListener("mousemove", onMove);
						window.removeEventListener("mouseup", onUp);
						document.body.style.userSelect = "";
					};
					document.body.style.userSelect = "none";
					window.addEventListener("mousemove", onMove);
					window.addEventListener("mouseup", onUp);
				}
			});
		}
		//#endregion
		//#region src/client/diffSettings.ts
		const STORAGE_KEY = "dsh-git-ui.diff.settings";
		const FONT_MIN = 11;
		const FONT_MAX = 20;
		const FONT_DEFAULT = 13;
		const DEFAULTS = {
			viewMode: "side",
			highlight: "word",
			softWrap: false,
			fontSize: FONT_DEFAULT
		};
		function clampFont(size) {
			if (!Number.isFinite(size)) return FONT_DEFAULT;
			return Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(size)));
		}
		function loadDiffSettings() {
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw === null) return { ...DEFAULTS };
				const parsed = JSON.parse(raw);
				return {
					viewMode: parsed.viewMode === "unified" ? "unified" : "side",
					highlight: parsed.highlight === "line" || parsed.highlight === "char" || parsed.highlight === "none" ? parsed.highlight : "word",
					softWrap: parsed.softWrap === true,
					fontSize: clampFont(parsed.fontSize ?? FONT_DEFAULT)
				};
			} catch {
				return { ...DEFAULTS };
			}
		}
		function saveDiffSettings(settings) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
			} catch {}
		}
		function adjustFontSize(current, delta) {
			return clampFont(current + delta);
		}
		//#endregion
		//#region src/client/diffLayout.ts
		/** Tokens: runs of word characters (incl. CJK) plus single separators. */
		const TOKEN_RE = /[A-Za-z0-9_\u4e00-\u9fff]+|[^A-Za-z0-9_\u4e00-\u9fff]/g;
		const WORD_LCS_CAP = 500;
		/** Character-level tokens: each grapheme cluster (surrogate pairs stay whole). */
		const CHAR_TOKEN_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g;
		const CHAR_LCS_CAP = 2e3;
		/**
		* Token-level LCS over two line texts. Returns per-side segments: "eq" tokens
		* matched on both sides, "chg" tokens unique to one side (highlighted as
		* deletions on the old side, additions on the new side).
		*/
		function diffWords(a, b, granularity) {
			if (a === b) return {
				left: [{
					t: "eq",
					s: a
				}],
				right: [{
					t: "eq",
					s: b
				}]
			};
			const ta = a.match(granularity === "char" ? CHAR_TOKEN_RE : TOKEN_RE) ?? [a];
			const tb = b.match(granularity === "char" ? CHAR_TOKEN_RE : TOKEN_RE) ?? [b];
			const cap = granularity === "char" ? CHAR_LCS_CAP : WORD_LCS_CAP;
			if (ta.length > cap || tb.length > cap) return {
				left: [{
					t: "chg",
					s: a
				}],
				right: [{
					t: "chg",
					s: b
				}]
			};
			const n = ta.length;
			const m = tb.length;
			const dp = new Uint16Array((n + 1) * (m + 1));
			for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
				const cell = i * (m + 1) + j;
				dp[cell] = ta[i] === tb[j] ? dp[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1]);
			}
			const left = [];
			const right = [];
			const flush = (segs, type, s) => {
				if (s === "") return;
				const last = segs[segs.length - 1];
				if (last !== void 0 && last.t === type) last.s += s;
				else segs.push({
					t: type,
					s
				});
			};
			let i = 0;
			let j = 0;
			while (i < n && j < m) if (ta[i] === tb[j]) {
				flush(left, "eq", ta[i]);
				flush(right, "eq", tb[j]);
				i++;
				j++;
			} else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) {
				flush(left, "chg", ta[i]);
				i++;
			} else {
				flush(right, "chg", tb[j]);
				j++;
			}
			while (i < n) {
				flush(left, "chg", ta[i]);
				i++;
			}
			while (j < m) {
				flush(right, "chg", tb[j]);
				j++;
			}
			return {
				left,
				right
			};
		}
		/**
		* Build the canonical layout of a hunk. Context lines occupy both sides (same
		* text, own line numbers); changed lines are grouped into blocks and paired
		* by block-local index (deleted[i] ↔ added[i]), exactly like IDEA's change
		* units. Unpaired lines leave the other side empty (0 rows).
		*/
		function buildSideLayout(hunk, hunkIndex, granularity, withIntra) {
			const items = [];
			let delBlock = [];
			let addBlock = [];
			let blockIndex = 0;
			let oldCursor = hunk.oldStart;
			let newCursor = hunk.newStart;
			let blockOldStart = hunk.oldStart;
			let blockNewStart = hunk.newStart;
			const flush = () => {
				if (delBlock.length === 0 && addBlock.length === 0) return;
				const changeKind = delBlock.length > 0 && addBlock.length > 0 ? "mod" : addBlock.length > 0 ? "add" : "del";
				const count = Math.max(delBlock.length, addBlock.length);
				const rows = [];
				for (let i = 0; i < count; i++) {
					const del = delBlock[i];
					const add = addBlock[i];
					if (del === void 0 && add === void 0) continue;
					const oldText = del?.text ?? "";
					const newText = add?.text ?? "";
					let leftSegs;
					let rightSegs;
					if (withIntra && del !== void 0 && add !== void 0 && oldText !== newText) {
						const words = diffWords(oldText, newText, granularity);
						leftSegs = words.left;
						rightSegs = words.right;
					}
					rows.push({
						del: del !== void 0 ? {
							no: del.oldNo,
							text: oldText,
							kind: "old",
							segs: leftSegs
						} : void 0,
						add: add !== void 0 ? {
							no: add.newNo,
							text: newText,
							kind: "new",
							segs: rightSegs
						} : void 0
					});
				}
				items.push({
					kind: "block",
					block: {
						key: hunkIndex + ":" + blockIndex,
						rows,
						change: {
							oldStart: blockOldStart,
							oldCount: delBlock.length,
							newStart: blockNewStart,
							newCount: addBlock.length
						},
						changeKind
					}
				});
				blockIndex++;
				delBlock = [];
				addBlock = [];
			};
			for (const line of hunk.lines) if (line.type === "ctx") {
				flush();
				items.push({
					kind: "ctx",
					old: {
						no: line.oldNo,
						text: line.text,
						kind: "ctx"
					},
					new: {
						no: line.newNo,
						text: line.text,
						kind: "ctx"
					}
				});
				oldCursor++;
				newCursor++;
			} else if (line.type === "del") {
				if (delBlock.length === 0 && addBlock.length === 0) {
					blockOldStart = oldCursor;
					blockNewStart = newCursor;
				}
				delBlock.push(line);
				oldCursor++;
			} else {
				if (delBlock.length === 0 && addBlock.length === 0) {
					blockOldStart = oldCursor;
					blockNewStart = newCursor;
				}
				addBlock.push(line);
				newCursor++;
			}
			flush();
			return items;
		}
		/** Split a hunk's layout, folding long unchanged runs (shared by both columns). */
		function splitLayoutParts(items, hunkIndex, expanded) {
			const parts = [];
			let ctxRun = [];
			let itemCursor = 0;
			const flushCtx = () => {
				if (ctxRun.length > 0) {
					if (ctxRun.length >= 10) {
						const key = "h" + hunkIndex + ":r" + (itemCursor - ctxRun.length);
						if (!expanded.has(key)) {
							parts.push({
								kind: "fold",
								key,
								count: ctxRun.length
							});
							ctxRun = [];
							return;
						}
					}
					for (const item of ctxRun) if (item.kind === "ctx") parts.push({
						kind: "ctx",
						old: item.old,
						new: item.new
					});
					ctxRun = [];
				}
			};
			for (const item of items) {
				if (item.kind === "ctx") ctxRun.push(item);
				else {
					flushCtx();
					parts.push({
						kind: "block",
						block: item.block
					});
				}
				itemCursor++;
			}
			flushCtx();
			return parts;
		}
		//#endregion
		//#region src/client/components/DiffView.tsx
		/**
		* Line-level diff viewer and the commit form.
		*
		* The diff renders FORWARD unified output (old → new) into two columns:
		* HEAD on the left, working tree on the right (IDEA orientation). The
		* optional `reversed` flag swaps them for embedders that need the opposite,
		* while the hunk indices stay byte-identical to the forward patch that
		* stageHunks / revertHunks rebuild.
		*
		* Interactive mode (Changes panel) adds: a whitespace-ignore toggle, per-hunk
		* stage/revert actions, hunk commit checkboxes (partial commit), unchanged-
		* fragment folding, and next/previous hunk navigation.
		*/
		/** File extensions that get an in-diff image preview (IDEA binary viewer). */
		const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i;
		/**
		* Build the IDEA unified layout from a hunk: context lines occupy one row;
		* deleted and added lines are paired block-wise (deleted row first, then the
		* added row), with intra-line highlights on paired changed rows. Pure
		* deletions/insertions get no word-level segments, like IDEA.
		*/
		function buildUnifiedRows(hunk, granularity, withIntra) {
			const rows = [];
			const dels = [];
			const adds = [];
			const flush = () => {
				const count = Math.max(dels.length, adds.length);
				for (let i = 0; i < count; i++) {
					const del = dels[i];
					const add = adds[i];
					const paired = withIntra && del !== void 0 && add !== void 0 && del.text !== add.text;
					if (del !== void 0) rows.push({
						marker: "-",
						oldNo: del.oldNo,
						text: del.text,
						kind: "old",
						segs: paired ? diffWords(del.text, add.text, granularity).left : void 0
					});
					if (add !== void 0) rows.push({
						marker: "+",
						newNo: add.newNo,
						text: add.text,
						kind: "new",
						segs: paired ? diffWords(del.text, add.text, granularity).right : void 0
					});
				}
				dels.length = 0;
				adds.length = 0;
			};
			for (const line of hunk.lines) if (line.type === "ctx") {
				flush();
				rows.push({
					marker: " ",
					oldNo: line.oldNo,
					newNo: line.newNo,
					text: line.text,
					kind: "ctx"
				});
			} else if (line.type === "del") dels.push(line);
			else adds.push(line);
			flush();
			return rows;
		}
		/** Row class for one side's cell: whole change blocks share one type color. */
		const sideRowClass = (line, changeKind) => {
			if (line.kind === "ctx" || changeKind === void 0) return "gitui-diff-cell";
			if (changeKind === "mod") return "gitui-diff-cell gitui-cell-mod";
			if (changeKind === "add") return "gitui-diff-cell gitui-cell-add";
			return "gitui-diff-cell gitui-cell-del";
		};
		function renderText(cell, t, edit) {
			const editable = edit !== void 0;
			const className = editable ? "gitui-diff-text gitui-diff-editable" : "gitui-diff-text";
			const readText = (el) => (el.textContent ?? "").replace(/\u00a0/g, " ");
			const textOf = () => cell.text === "" ? "\xA0" : cell.text;
			const segs = cell.segs;
			const children = segs === void 0 || segs.length === 0 ? textOf() : segs.map((seg, index) => seg.t === "eq" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: seg.s === "" ? editable ? "\xA0" : " " : seg.s }, index) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: cell.kind === "old" ? "gitui-diff-word-del" : "gitui-diff-word-add",
				children: seg.s === "" ? editable ? "\xA0" : " " : seg.s
			}, index));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className,
				...editable ? {
					contentEditable: true,
					suppressContentEditableWarning: true,
					spellCheck: false,
					onInput: (event) => {
						edit.onInput(readText(event.currentTarget));
					},
					onBlur: (event) => {
						edit.onBlur(readText(event.currentTarget));
					},
					onKeyDown: (event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							event.currentTarget.blur();
						} else if (event.key === "Escape") {
							event.preventDefault();
							event.currentTarget.textContent = cell.text;
							event.currentTarget.blur();
						}
					}
				} : {},
				children
			});
		}
		/**
		* Compact toolbar dropdown (view mode / whitespace / highlight selectors).
		* Click-outside and Escape close it, like IDEA's popup selectors.
		*/
		function Dropdown(props) {
			const { label, value, options, onChange, disabled = false, title } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const ref = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onDoc = (event) => {
					if (ref.current !== null && !ref.current.contains(event.target)) setOpen(false);
				};
				const onKey = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("mousedown", onDoc);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("mousedown", onDoc);
					document.removeEventListener("keydown", onKey);
				};
			}, [open]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-dd",
				ref,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "gitui-dd-btn",
					disabled,
					title,
					onClick: () => setOpen((prev) => !prev),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-dd-label",
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-dd-caret",
						children: "▾"
					})]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-dd-menu",
					role: "menu",
					children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "menuitem",
						className: "gitui-dd-item" + (option.value === value ? " gitui-dd-item-sel" : ""),
						onClick: () => {
							onChange(option.value);
							setOpen(false);
						},
						children: option.label
					}, option.value))
				})]
			});
		}
		/**
		* Whitespace flags dropdown: independent toggles (Trim whitespaces /
		* Ignore whitespaces / Ignore empty lines), like IDEA's selector but
		* combinable. Stays open while ticking so several flags can be switched.
		*/
		function WsFlagsDropdown(props) {
			const { flags, disabled = false, onChange, t } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const ref = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onDoc = (event) => {
					if (ref.current !== null && !ref.current.contains(event.target)) setOpen(false);
				};
				const onKey = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("mousedown", onDoc);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("mousedown", onDoc);
					document.removeEventListener("keydown", onKey);
				};
			}, [open]);
			const items = [
				{
					key: "trimEol",
					label: t("diff.ws.trimEol")
				},
				{
					key: "ignoreWs",
					label: t("diff.ws.ignoreWs")
				},
				{
					key: "ignoreBlank",
					label: t("diff.ws.ignoreBlank")
				}
			];
			const active = items.filter((item) => flags[item.key] === true).map((item) => item.label);
			const label = active.length === 0 ? t("diff.ws.none") : active.join(" · ");
			const toggle = (key) => {
				onChange({
					...flags,
					[key]: !flags[key]
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-dd",
				ref,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "gitui-dd-btn",
					disabled,
					title: t("diff.wsModeHint"),
					onClick: () => setOpen((prev) => !prev),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-dd-label",
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-dd-caret",
						children: "▾"
					})]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-dd-menu gitui-dd-menu-ws",
					role: "menu",
					children: items.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "menuitem",
						className: "gitui-dd-item" + (flags[item.key] === true ? " gitui-dd-item-sel" : ""),
						onClick: () => toggle(item.key),
						children: item.label
					}, item.key))
				})]
			});
		}
		const HL_OPTIONS = [
			{
				value: "line",
				label: "Highlight lines"
			},
			{
				value: "word",
				label: "Highlight words"
			},
			{
				value: "char",
				label: "Highlight characters"
			},
			{
				value: "none",
				label: "Do not highlight"
			}
		];
		const VIEW_OPTIONS = [{
			value: "side",
			label: "Side-by-side viewer"
		}, {
			value: "unified",
			label: "Unified viewer"
		}];
		/** Foldable parts for the unified layout (context rows are foldable). */
		function splitUnifiedParts(rows, hunkIndex, expanded) {
			const parts = [];
			let ctxRun = [];
			let rowCursor = 0;
			const flushCtx = () => {
				if (ctxRun.length > 0) {
					if (ctxRun.length >= 10) {
						const key = "u" + hunkIndex + ":r" + (rowCursor - ctxRun.length);
						if (!expanded.has(key)) {
							parts.push({
								kind: "fold",
								key,
								count: ctxRun.length
							});
							ctxRun = [];
							return;
						}
					}
					for (const row of ctxRun) parts.push({
						kind: "row",
						row
					});
					ctxRun = [];
				}
			};
			for (const row of rows) {
				if (row.kind === "ctx") ctxRun.push(row);
				else {
					flushCtx();
					parts.push({
						kind: "row",
						row
					});
				}
				rowCursor++;
			}
			flushCtx();
			return parts;
		}
		/** One unified row: marker column, old/new line numbers, tinted text. */
		function renderUnifiedRow(row, t) {
			const cell = {
				text: row.text,
				kind: row.kind,
				segs: row.segs
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-diff-cell gitui-diff-cell-u" + (row.kind === "old" ? " gitui-cell-del" : row.kind === "new" ? " gitui-cell-add" : ""),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-diff-cell-content",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-diff-cell-inner",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-diff-marker gitui-diff-marker-" + row.marker,
								children: row.marker
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-diff-no",
								children: row.oldNo ?? ""
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-diff-no gitui-diff-no-new",
								children: row.newNo ?? ""
							}),
							renderText(cell, t)
						]
					})
				})
			});
		}
		function DiffView(props) {
			const { file, t, leftLabel, rightLabel, reversed = false, interactive = false, api, dir, path, wsFlags = NO_WS_FLAGS, onWsFlagsChange, hasStagedChanges = false, hunkOpsDisabled = false, hunkOpsDisabledReason, uncheckedHunks, onToggleHunk, onChanged, imageRefs, flushRef } = props;
			const [settings, setSettings] = (0, react.useState)(loadDiffSettings);
			const applySettings = (next) => {
				setSettings(next);
				saveDiffSettings(next);
			};
			const { viewMode, highlight, softWrap, fontSize } = settings;
			/** Intra-line granularity derived from the highlight mode. */
			const granularity = highlight === "char" ? "char" : "word";
			/** Whether intra-line highlights are rendered at all. */
			const showIntra = highlight === "word" || highlight === "char";
			const [imageUrls, setImageUrls] = (0, react.useState)({
				left: null,
				right: null
			});
			const canPreviewImage = file !== null && file.binary && api !== void 0 && dir !== "" && IMAGE_EXT.test(file.path);
			(0, react.useEffect)(() => {
				if (!canPreviewImage || api === void 0 || file === null || dir === void 0) return;
				let alive = true;
				const urls = [];
				const load = async (ref, key) => {
					try {
						const result = await api.binaryContent(dir, file.path, ref);
						const bytes = Uint8Array.from(atob(result.base64), (ch) => ch.charCodeAt(0));
						const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
						urls.push(url);
						if (alive) setImageUrls((prev) => ({
							...prev,
							[key]: url
						}));
					} catch {}
				};
				load(imageRefs?.left, "left");
				load(imageRefs?.right, "right");
				return () => {
					alive = false;
					for (const url of urls) URL.revokeObjectURL(url);
					setImageUrls({
						left: null,
						right: null
					});
				};
			}, [
				canPreviewImage,
				api,
				dir,
				file,
				imageRefs
			]);
			const [foldExpanded, setFoldExpanded] = (0, react.useState)(/* @__PURE__ */ new Set());
			/** Bumped when fonts finish loading so row metrics re-measure at final metrics. */
			const [fontsTick, setFontsTick] = (0, react.useState)(0);
			const [opBusy, setOpBusy] = (0, react.useState)(false);
			const [opError, setOpError] = (0, react.useState)(null);
			/** Brief "saved" feedback after a debounced inline edit lands. */
			const [savedFlash, setSavedFlash] = (0, react.useState)(false);
			const savedTimerRef = (0, react.useRef)(null);
			/** Reversible inline edits: per-path map of original text per line, recorded
			*  on first save. Path-keyed so a stale queued write from a previously
			*  edited file cannot pollute the new file's restore history. */
			const originalByLineRef = (0, react.useRef)(/* @__PURE__ */ new Map());
			const [editedCount, setEditedCount] = (0, react.useState)(0);
			const [restoredFlash, setRestoredFlash] = (0, react.useState)(false);
			const [currentHunk, setCurrentHunk] = (0, react.useState)(0);
			const scrollRef = (0, react.useRef)(null);
			const scrollbarRef = (0, react.useRef)(null);
			/**
			* IDEA diff behavior: the two columns have FIXED widths (50% each, aligned
			* with the side captions). Content scrolls INSIDE each column — the cell
			* background stays fixed (a short row that scrolls out of view still shows
			* its tinted background, never a blank gap) while a content layer inside
			* the cell scrolls. Every row's content layer shares the SAME width per
			* column (column width + that column's max overflow), so short rows scroll
			* in sync with long ones. A single scrollbar under the diff drives both
			* columns by the same amount.
			*/
			const [colExtent, setColExtent] = (0, react.useState)(null);
			/** Max scrollable amount across both columns (drives the scrollbar width). */
			const [scrollMax, setScrollMax] = (0, react.useState)(0);
			(0, react.useLayoutEffect)(() => {
				const el = scrollRef.current;
				if (el === null || file === null) return;
				const measure = () => {
					let baseL = 0;
					let baseR = 0;
					let maxL = 0;
					let maxR = 0;
					for (const content of el.querySelectorAll(".gitui-diff-col:first-child .gitui-diff-cell-content")) {
						baseL = content.clientWidth;
						const inner = content.firstElementChild;
						if (inner !== null) maxL = Math.max(maxL, inner.scrollWidth - content.clientWidth);
					}
					for (const content of el.querySelectorAll(".gitui-diff-col:last-child .gitui-diff-cell-content")) {
						baseR = content.clientWidth;
						const inner = content.firstElementChild;
						if (inner !== null) maxR = Math.max(maxR, inner.scrollWidth - content.clientWidth);
					}
					if (baseL === 0) baseL = Math.max(1, Math.floor(el.clientWidth / 2));
					if (baseR === 0) baseR = baseL;
					const next = {
						left: baseL + maxL,
						right: baseR + maxR
					};
					setColExtent((prev) => prev !== null && prev.left === next.left && prev.right === next.right ? prev : next);
					const maxDelta = Math.max(maxL, maxR);
					setScrollMax((prev) => prev === maxDelta ? prev : maxDelta);
				};
				measure();
				const observer = new ResizeObserver(measure);
				observer.observe(el);
				let fontsTimer;
				if (document.fonts?.ready !== void 0) document.fonts.ready.then(() => {
					fontsTimer = setTimeout(measure, 50);
					setFontsTick((tick) => tick + 1);
				});
				return () => {
					observer.disconnect();
					if (fontsTimer !== void 0) clearTimeout(fontsTimer);
				};
			}, [file, foldExpanded]);
			/**
			* Equal-height columns: both columns render the SAME row sequence (missing
			* block sides are blank pad cells), so index-pair their rows and stretch
			* the shorter of each pair to the taller one. Soft wrap can make one side's
			* row taller; this keeps every row at the same y on both sides. A
			* ResizeObserver re-syncs when content heights change (guards prevent churn).
			*/
			(0, react.useLayoutEffect)(() => {
				const el = scrollRef.current;
				if (el === null || file === null) return;
				const sync = () => {
					const leftCol = el.querySelector(".gitui-diff-col:first-child");
					const rightCol = el.querySelector(".gitui-diff-col:last-child");
					if (leftCol === null || rightCol === null) return;
					const rowSel = ".gitui-hunk-gap, .gitui-fold-row, .gitui-diff-cell";
					const leftRows = Array.from(leftCol.querySelectorAll(rowSel));
					const rightRows = Array.from(rightCol.querySelectorAll(rowSel));
					const n = Math.min(leftRows.length, rightRows.length);
					for (let i = 0; i < n; i++) {
						const h = Math.max(leftRows[i].offsetHeight, rightRows[i].offsetHeight);
						if (leftRows[i].offsetHeight !== h) leftRows[i].style.height = h + "px";
						if (rightRows[i].offsetHeight !== h) rightRows[i].style.height = h + "px";
					}
				};
				sync();
				const cols = el.querySelector(".gitui-diff-cols");
				if (cols !== null) {
					const observer = new ResizeObserver(sync);
					observer.observe(cols);
					return () => observer.disconnect();
				}
			}, [
				file,
				foldExpanded,
				softWrap,
				fontSize,
				fontsTick,
				colExtent
			]);
			/**
			* Keep the middle column's number strips in lockstep with the content
			* columns: each strip row mirrors the same row sequence, so heights are
			* copied 1:1 from the content cells (soft wrap makes rows taller). Runs
			* after layout; a ResizeObserver re-syncs when content heights change.
			*/
			(0, react.useLayoutEffect)(() => {
				const el = scrollRef.current;
				if (el === null || file === null) return;
				const sync = () => {
					for (const [colSel, midSel] of [[".gitui-diff-col:first-child", ".gitui-diff-mid-ln"], [".gitui-diff-col:last-child", ".gitui-diff-mid-rn"]]) {
						const col = el.querySelector(colSel);
						const mid = el.querySelector(midSel);
						if (col === null || mid === null) continue;
						const colEls = Array.from(col.querySelectorAll(".gitui-hunk-gap, .gitui-fold-row, .gitui-diff-cell"));
						const midEls = Array.from(mid.querySelectorAll(".gitui-mid-head, .gitui-mid-fold, .gitui-mid-row"));
						const n = Math.min(colEls.length, midEls.length);
						for (let i = 0; i < n; i++) {
							const h = colEls[i].offsetHeight;
							if (midEls[i].offsetHeight !== h) midEls[i].style.height = h + "px";
						}
					}
				};
				sync();
				const cols = el.querySelector(".gitui-diff-cols");
				if (cols !== null) {
					const observer = new ResizeObserver(sync);
					observer.observe(cols);
					return () => observer.disconnect();
				}
			}, [
				file,
				foldExpanded,
				softWrap,
				fontSize,
				fontsTick,
				colExtent
			]);
			(0, react.useEffect)(() => {
				const bar = scrollbarRef.current;
				const el = scrollRef.current;
				if (bar === null || el === null) return;
				const onBarScroll = () => {
					const x = bar.scrollLeft;
					for (const layer of el.querySelectorAll(".gitui-diff-cell-content")) layer.scrollLeft = x;
				};
				bar.addEventListener("scroll", onBarScroll, { passive: true });
				return () => {
					bar.removeEventListener("scroll", onBarScroll);
				};
			}, [file, foldExpanded]);
			(0, react.useEffect)(() => {
				if (!interactive) return;
				const onKey = (event) => {
					const target = event.target;
					const tag = target?.tagName ?? "";
					if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable === true) return;
					if (event.key === "F7") {
						event.preventDefault();
						const delta = event.shiftKey ? -1 : 1;
						setCurrentHunk((current) => {
							const total = file?.hunks.length ?? 1;
							const next = Math.max(0, Math.min(total - 1, current + delta));
							(scrollRef.current?.querySelector(`[data-hunk-index="${next}"]`))?.scrollIntoView({ block: "nearest" });
							return next;
						});
					}
				};
				window.addEventListener("keydown", onKey, true);
				return () => window.removeEventListener("keydown", onKey, true);
			});
			if (file === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-diff-placeholder",
				children: t("diff.noFile")
			});
			if (file.binary) {
				if (canPreviewImage) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-diff gitui-diff-images",
					children: [
						(leftLabel !== void 0 || rightLabel !== void 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gitui-diff-sides",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-diff-side",
								children: leftLabel ?? ""
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-diff-side",
								children: rightLabel ?? ""
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gitui-diff-img-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-img-col",
								children: imageUrls.left !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									src: imageUrls.left,
									alt: t("diff.binary"),
									className: "gitui-diff-img"
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-diff-placeholder",
									children: "…"
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-img-col",
								children: imageUrls.right !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									src: imageUrls.right,
									alt: t("diff.binary"),
									className: "gitui-diff-img"
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-diff-placeholder",
									children: "…"
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-diff-img-notice",
							children: t("diff.binaryDifferent")
						})
					]
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-diff-placeholder",
					children: t("diff.binary")
				});
			}
			if (file.hunks.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-diff-placeholder",
				children: t("diff.empty")
			});
			const canOperate = interactive && api !== void 0 && dir !== void 0 && path !== void 0 && !hunkOpsDisabled;
			/**
			* IDEA-style gutter action on the first row (of this side) of each changed
			* block:
			* - worktree side (the NEW side): an include checkbox (partial commit);
			* - HEAD side (the OLD side): an apply arrow (revert = apply HEAD's block
			*   to the worktree).
			* Rendered inside the fixed-width gutter-action column (.gitui-diff-gslot):
			* on the HEAD side it sits to the RIGHT of the number, on the worktree side
			* to the LEFT, so the six-column order holds and numbers stay aligned
			* whether or not a row carries an action.
			*/
			const gutterAction = (side, block, isFirst, hunkIndex, checked) => {
				if (!interactive || !isFirst) return null;
				if (side === "new") {
					if (onToggleHunk === void 0 || hunkOpsDisabled) return null;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "checkbox",
						className: "gitui-diff-gcheck",
						checked,
						title: t("tree.check"),
						onChange: (event) => {
							event.stopPropagation();
							onToggleHunk(hunkIndex);
						},
						onClick: (event) => event.stopPropagation()
					});
				}
				const pointsRight = !reversed;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "gitui-diff-gicon gitui-diff-gicon-apply",
					title: hunkOpsDisabled ? hunkOpsDisabledReason ?? "" : t("diff.revertHunk"),
					disabled: opBusy || !canOperate,
					onClick: (event) => {
						event.stopPropagation();
						runChangeOp(block.change);
					},
					children: pointsRight ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "12",
						height: "12",
						viewBox: "0 0 12 12",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
							fill: "currentColor",
							fillRule: "evenodd",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									width: "1",
									height: "7",
									x: "7.674",
									y: ".38",
									transform: "scale(-1 1) rotate(45 0 -15.853)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									width: "7",
									height: "1",
									x: "4.674",
									y: "7.622",
									transform: "scale(-1 1) rotate(45 0 -11.61)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									width: "1",
									height: "7",
									x: "3.431",
									y: ".38",
									transform: "scale(-1 1) rotate(45 0 -5.61)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									width: "7",
									height: "1",
									x: ".431",
									y: "7.622",
									transform: "scale(-1 1) rotate(45 0 -1.368)"
								})
							]
						})
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "12",
						height: "12",
						viewBox: "0 0 12 12",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
							fill: "currentColor",
							fillRule: "evenodd",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									width: "1",
									height: "7",
									x: "3.328",
									y: ".379",
									transform: "rotate(45 3.828 3.879)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									width: "7",
									height: "1",
									x: ".328",
									y: "7.621",
									transform: "rotate(45 3.828 8.121)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									width: "1",
									height: "7",
									x: "7.571",
									y: ".379",
									transform: "rotate(45 8.071 3.879)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									width: "7",
									height: "1",
									x: "4.571",
									y: "7.621",
									transform: "rotate(45 8.071 8.121)"
								})
							]
						})
					})
				});
			};
			const saveChainRef = (0, react.useRef)(Promise.resolve());
			/**
			* Per-path baseline cache: key → the path's loaded content promise. Every
			* queued write binds to ITS OWN path's entry, so a write scheduled before a
			* file switch can never read another file's baseline (the old single-slot
			* ref allowed exactly that — a cross-file overwrite). The current path's
			* entry is deleted on every switch so revisits re-read the file from disk.
			*/
			const baselineCacheRef = (0, react.useRef)(/* @__PURE__ */ new Map());
			/** Current path as seen by queued writes (updated during render). */
			const currentPathRef = (0, react.useRef)(path);
			currentPathRef.current = path;
			/** Inline editing availability (the baseline loads asynchronously). */
			const [editLoading, setEditLoading] = (0, react.useState)(true);
			/** Why inline editing is unavailable (null = editable). */
			const [editBlocked, setEditBlocked] = (0, react.useState)(null);
			const editReady = !editLoading && editBlocked === null;
			const baselineKey = (p) => (dir ?? "") + "\0" + (p ?? "");
			/** Load a path's baseline once (cached); writes wait on their own entry. */
			const loadBaseline = (p) => {
				if (api === void 0 || dir === void 0 || p === void 0) return Promise.resolve({
					base: null,
					blocked: null
				});
				const key = baselineKey(p);
				let promise = baselineCacheRef.current.get(key);
				if (promise === void 0) {
					promise = (async () => {
						try {
							const file = await api.readFile(dir, p);
							if (file.binary) return {
								base: null,
								blocked: t("diff.binary")
							};
							if (file.truncated) return {
								base: null,
								blocked: t("diff.truncatedReadonly")
							};
							return {
								base: {
									lines: file.content.split(/\r\n|\n/),
									eol: file.content.includes("\r\n") ? "\r\n" : "\n"
								},
								blocked: null
							};
						} catch (caught) {
							return {
								base: null,
								blocked: caught.message
							};
						}
					})();
					baselineCacheRef.current.set(key, promise);
					if (baselineCacheRef.current.size > 16) {
						baselineCacheRef.current.clear();
						baselineCacheRef.current.set(key, promise);
					}
				}
				return promise;
			};
			(0, react.useEffect)(() => {
				if (flushRef === void 0) return;
				flushRef.current = () => saveChainRef.current;
				return () => {
					flushRef.current = null;
				};
			}, [flushRef]);
			(0, react.useEffect)(() => {
				originalByLineRef.current = /* @__PURE__ */ new Map();
				setEditedCount(0);
				setSavedFlash(false);
				setRestoredFlash(false);
				setEditLoading(true);
				setEditBlocked(null);
				baselineCacheRef.current.delete(baselineKey(path));
				loadBaseline(path).then((result) => {
					if (path !== currentPathRef.current) return;
					setEditLoading(false);
					if (result.blocked !== null) setEditBlocked(result.blocked);
				});
			}, [path]);
			/** Write one line back to the working-tree file. Bound to the captured
			*  path: a queued write always reads THAT path's baseline, never the
			*  current file's. Resolves false when nothing was written (baseline
			*  unavailable / line out of range) so callers can skip the "saved" flash. */
			const saveEditedLine = async (p, newNo, text) => {
				if (api === void 0 || dir === void 0 || p === void 0) return false;
				const base = (await loadBaseline(p)).base;
				if (base === null) return false;
				if (newNo < 1 || newNo > base.lines.length) return false;
				if (p === currentPathRef.current) {
					let lineOriginals = originalByLineRef.current.get(p);
					if (lineOriginals === void 0) {
						lineOriginals = /* @__PURE__ */ new Map();
						originalByLineRef.current.set(p, lineOriginals);
					}
					if (!lineOriginals.has(newNo)) {
						lineOriginals.set(newNo, base.lines[newNo - 1]);
						setEditedCount(lineOriginals.size);
					}
				}
				base.lines[newNo - 1] = text;
				await api.writeFile(dir, p, base.lines.join(base.eol));
				return true;
			};
			/** Brief "saved" feedback after the write-back lands. */
			const flashSaved = () => {
				setSavedFlash(true);
				if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current);
				savedTimerRef.current = setTimeout(() => setSavedFlash(false), 1200);
			};
			/** Every keystroke writes to disk immediately (serialized, no debounce). */
			const saveImmediate = (newNo, text) => {
				if (path === void 0) return;
				const capturedPath = path;
				setSavedFlash(false);
				saveChainRef.current = saveChainRef.current.then(() => saveEditedLine(capturedPath, newNo, text)).then((written) => {
					if (written) flashSaved();
				}).catch(() => {});
			};
			/** Flush pending writes on blur and refresh the diff (silent, no flash). */
			const flushSave = (newNo, text) => {
				if (path === void 0) return;
				const capturedPath = path;
				saveChainRef.current = saveChainRef.current.then(() => saveEditedLine(capturedPath, newNo, text)).then(() => onChanged?.()).catch((caught) => {
					setOpError(caught.message);
				});
			};
			/** Revert every inline edit of this file back to its pre-edit text. */
			const restoreEdits = () => {
				if (path === void 0) return;
				const originals = new Map(originalByLineRef.current.get(path) ?? /* @__PURE__ */ new Map());
				if (originals.size === 0) return;
				saveChainRef.current = saveChainRef.current.then(async () => {
					for (const [no, text] of originals) await saveEditedLine(path, no, text);
					originalByLineRef.current.delete(path);
					setEditedCount(0);
					setRestoredFlash(true);
					window.setTimeout(() => setRestoredFlash(false), 1200);
					onChanged?.();
				}).catch((caught) => {
					setOpError(caught.message);
				});
			};
			/** Revert exactly one visual change (IDEA change unit) and refresh. */
			async function runChangeOp(change) {
				if (!canOperate || api === void 0 || dir === void 0 || path === void 0) return;
				setOpBusy(true);
				setOpError(null);
				try {
					await saveChainRef.current;
					await api.revertChanges(dir, path, change, wsFlags);
					onChanged?.();
				} catch (caught) {
					setOpError(caught.message);
				} finally {
					setOpBusy(false);
				}
			}
			async function runFileOp(kind) {
				if (api === void 0 || dir === void 0 || path === void 0) return;
				setOpBusy(true);
				setOpError(null);
				try {
					await saveChainRef.current;
					if (kind === "stage") await api.stage(dir, [path]);
					else await api.discard(dir, [path], true);
					onChanged?.();
				} catch (caught) {
					setOpError(caught.message);
				} finally {
					setOpBusy(false);
				}
			}
			/** Scroll to a hunk header (data-hunk-index). */
			function scrollToHunk(index) {
				(scrollRef.current?.querySelector(`[data-hunk-index="${index}"]`))?.scrollIntoView({ block: "nearest" });
				if (file !== null) setCurrentHunk(Math.max(0, Math.min(file.hunks.length - 1, index)));
			}
			/**
			* Render ONE column of the side-by-side view. Both columns share the same
			* row sequence (context rows, fold rows, hunk headers, and block rows at
			* max(del, add) pairs): a block row whose side has no line renders a BLANK
			* pad cell, so both columns stay equal height and vertically aligned.
			*/
			const renderSideColumn = (side) => {
				const isLeft = side === "new" === reversed;
				const extent = colExtent !== null ? isLeft ? colExtent.left : colExtent.right : void 0;
				const editProps = (line) => interactive && editReady && side === "new" ? {
					newNo: line.no,
					onInput: (text) => saveImmediate(line.no, text),
					onBlur: (text) => flushSave(line.no, text)
				} : void 0;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-diff-col",
					children: file.hunks.map((hunk, hunkIndex) => {
						uncheckedHunks !== void 0 && uncheckedHunks.has(hunkIndex);
						const parts = splitLayoutParts(buildSideLayout(hunk, hunkIndex, granularity, showIntra), hunkIndex, foldExpanded);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [isLeft ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-hunk-gap gitui-hunk-head" + (interactive && currentHunk === hunkIndex ? " gitui-hunk-current" : ""),
							"data-hunk-index": hunkIndex,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } })
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-hunk-gap",
							"aria-hidden": "true"
						}), parts.map((part, partIndex) => {
							if (part.kind === "fold") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-fold-row",
								onClick: () => {
									setFoldExpanded((prev) => {
										const next = new Set(prev);
										if (next.has(part.key)) next.delete(part.key);
										else next.add(part.key);
										return next;
									});
								},
								children: t("diff.unchanged", { n: String(part.count) })
							}, part.key);
							if (part.kind === "ctx") {
								const line = side === "old" ? part.old : part.new;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-diff-cell",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-diff-cell-content",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "gitui-diff-cell-inner",
											style: extent !== void 0 ? { width: extent } : void 0,
											children: renderText({
												no: line.no,
												text: line.text,
												kind: line.kind,
												segs: line.segs
											}, t, editProps(line))
										})
									})
								}, "c" + partIndex);
							}
							const { block } = part;
							return block.rows.map((row, pair) => {
								const line = side === "old" ? row.del : row.add;
								if (line === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-diff-cell gitui-diff-cell-pad",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-diff-cell-content",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "gitui-diff-cell-inner",
											style: extent !== void 0 ? { width: extent } : void 0
										})
									})
								}, pair);
								const className = sideRowClass(line, block.changeKind);
								const content = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-diff-cell-content",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-diff-cell-inner",
										style: extent !== void 0 ? { width: extent } : void 0,
										children: renderText({
											no: line.no,
											text: line.text,
											kind: line.kind,
											segs: line.segs
										}, t, editProps(line))
									})
								});
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className,
									children: content
								}, pair);
							});
						})] }, hunkIndex);
					})
				});
			};
			/**
			* Line-number strip of the middle gutter column for one side. Mirrors the
			* content column's row sequence EXACTLY (hunk-header / fold placeholders
			* plus ctx/block rows), so the height-sync effect can align them 1:1.
			* Gutter actions (include checkbox / apply arrow) live here next to the
			* number of the block's first row on this side.
			*/
			const renderMidColumn = (side) => {
				const isOld = side === "old";
				/** One gutter row. The six-column order is HEAD:[text][number][apply]
				*  and worktree:[checkbox][number][text], so the HEAD strip renders the
				*  number BEFORE the action slot while the worktree strip renders it
				*  AFTER. The action slot is always reserved so the number column stays
				*  vertically aligned whether or not a row carries an action. */
				const midRow = (action, no) => {
					const slot = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-diff-gslot",
						children: action
					});
					const number = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-diff-no",
						children: no
					});
					return isOld ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [number, slot] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [slot, number] });
				};
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-diff-mid-" + (isOld ? "ln" : "rn"),
					children: file.hunks.map((hunk, hunkIndex) => {
						const hunkChecked = uncheckedHunks !== void 0 && !uncheckedHunks.has(hunkIndex);
						const parts = splitLayoutParts(buildSideLayout(hunk, hunkIndex, granularity, showIntra), hunkIndex, foldExpanded);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "gitui-mid-head" }), parts.map((part, partIndex) => {
							if (part.kind === "fold") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "gitui-mid-fold" }, part.key);
							if (part.kind === "ctx") {
								const line = isOld ? part.old : part.new;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-mid-row",
									children: midRow(null, line.no)
								}, "c" + partIndex);
							}
							const { block } = part;
							const firstOnSide = block.rows.findIndex((row) => (isOld ? row.del : row.add) !== void 0);
							return block.rows.map((row, pair) => {
								const line = isOld ? row.del : row.add;
								if (line === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "gitui-mid-row" }, pair);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-mid-row",
									children: midRow(gutterAction(side, block, pair === firstOnSide, hunkIndex, hunkChecked), line.no)
								}, pair);
							});
						})] }, hunkIndex);
					})
				});
			};
			const hunkCount = file.hunks.length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-diff" + (softWrap ? " gitui-diff-softwrap" : ""),
				style: { fontSize: fontSize + "px" },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-diff-toolbar",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Dropdown, {
								label: t("diff.view." + viewMode),
								value: viewMode,
								options: VIEW_OPTIONS,
								title: t("diff.viewModeHint"),
								onChange: (value) => applySettings({
									...settings,
									viewMode: value
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WsFlagsDropdown, {
								flags: wsFlags,
								disabled: onWsFlagsChange === void 0,
								onChange: (next) => onWsFlagsChange?.(next),
								t
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Dropdown, {
								label: t("diff.hl." + highlight),
								value: highlight,
								options: HL_OPTIONS,
								title: t("diff.highlightHint"),
								onChange: (value) => applySettings({
									...settings,
									highlight: value
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "gitui-merge-option",
								title: t("diff.softWrapHint"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: softWrap,
									onChange: (event) => applySettings({
										...settings,
										softWrap: event.target.checked
									})
								}), t("diff.softWrap")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn gitui-font-btn",
								title: t("diff.fontSmaller"),
								disabled: fontSize <= 11,
								onClick: () => applySettings({
									...settings,
									fontSize: adjustFontSize(fontSize, -1)
								}),
								children: "A−"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn gitui-font-btn",
								title: t("diff.fontLarger"),
								disabled: fontSize >= 20,
								onClick: () => applySettings({
									...settings,
									fontSize: adjustFontSize(fontSize, 1)
								}),
								children: "A+"
							}),
							interactive && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "gitui-tb-sep" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "gitui-btn",
									disabled: opBusy || dir === "" || path === void 0 || hunkOpsDisabled,
									onClick: () => void runFileOp("stage"),
									children: ["⬆ ", t("diff.stageFile")]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "gitui-btn",
									disabled: opBusy || dir === "" || path === void 0 || hunkOpsDisabled,
									onClick: () => void runFileOp("revert"),
									children: ["⤓ ", t("diff.revertFile")]
								})
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							interactive && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								title: t("diff.prevHunk"),
								disabled: hunkCount === 0,
								onClick: () => scrollToHunk(currentHunk - 1),
								children: "▲"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								title: t("diff.nextHunk"),
								disabled: hunkCount === 0,
								onClick: () => scrollToHunk(currentHunk + 1),
								children: "▼"
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "gitui-diff-count",
								title: t("diff.countHint"),
								children: [hunkCount > 0 ? t("diff.count", { n: String(hunkCount) }) : t("diff.countZero"), interactive && hunkCount > 0 ? " · " + (currentHunk + 1) + "/" + hunkCount : ""]
							})
						]
					}),
					(leftLabel !== void 0 || rightLabel !== void 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-diff-sides",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "gitui-diff-side",
							children: leftLabel ?? ""
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "gitui-diff-side",
							children: rightLabel ?? ""
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gitui-diff-scroll",
						"data-git-ui-diff": "",
						ref: scrollRef,
						children: viewMode === "unified" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-diff-cols gitui-diff-cols-unified",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-col",
								children: file.hunks.map((hunk, hunkIndex) => {
									const parts = splitUnifiedParts(buildUnifiedRows(hunk, granularity, showIntra), hunkIndex, foldExpanded);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "gitui-hunk-gap gitui-hunk-head" + (interactive && currentHunk === hunkIndex ? " gitui-hunk-current" : ""),
										"data-hunk-index": hunkIndex,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "gitui-hunk-meta",
											children: [
												"@@ -",
												hunk.oldStart,
												",",
												hunk.oldCount,
												" +",
												hunk.newStart,
												",",
												hunk.newCount,
												" @@"
											]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } })]
									}), parts.map((part, partIndex) => part.kind === "fold" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "gitui-fold-row",
										onClick: () => {
											setFoldExpanded((prev) => {
												const next = new Set(prev);
												if (next.has(part.key)) next.delete(part.key);
												else next.add(part.key);
												return next;
											});
										},
										children: t("diff.unchanged", { n: String(part.count) })
									}, part.key) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: renderUnifiedRow(part.row, t) }, partIndex))] }, hunkIndex);
								})
							})
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gitui-diff-cols",
							children: [
								renderSideColumn("old"),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-diff-mid",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-diff-mid-ln",
										children: renderMidColumn("old")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-diff-mid-rn",
										children: renderMidColumn("new")
									})]
								}),
								renderSideColumn("new")
							]
						})
					}),
					!softWrap && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gitui-diff-scrollbar",
						ref: scrollbarRef,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: { width: `calc(100% + ${scrollMax}px)` } })
					}),
					editedCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gitui-ok",
						style: { padding: "2px 10px 6px" },
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "gitui-btn",
							title: t("diff.restoreEditsHint"),
							onClick: restoreEdits,
							children: ["↩ ", t("diff.restoreEdits", { n: String(editedCount) })]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
						message: opError !== null ? opError : savedFlash ? t("diff.saved") : restoredFlash ? t("diff.restored") : null,
						tone: opError !== null ? "error" : "ok"
					}),
					editBlocked !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gitui-tree-warn",
						style: { padding: "2px 10px 6px" },
						children: editBlocked
					})
				]
			});
		}
		function CommitBox(props) {
			const { api, dir, stagedCount, branch, t, onCommitted, checkedPaths, partial } = props;
			const [message, setMessage] = (0, react.useState)("");
			const [amend, setAmend] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [ok, setOk] = (0, react.useState)(null);
			const [remotes, setRemotes] = (0, react.useState)([]);
			const [pushTarget, setPushTarget] = (0, react.useState)("");
			/** Remote-tracking branches of pushTarget (short names, same-name first). */
			const [remoteBranches, setRemoteBranches] = (0, react.useState)([]);
			const [pushRemoteBranch, setPushRemoteBranch] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				let alive = true;
				setRemotes([]);
				setPushTarget("");
				if (dir === "") return;
				api.remotes(dir).then((list) => {
					if (!alive) return;
					setRemotes(list);
					if (list.length > 0) setPushTarget(list[0].name);
				}).catch(() => {});
				return () => {
					alive = false;
				};
			}, [api, dir]);
			(0, react.useEffect)(() => {
				if (dir === "" || pushTarget === "") {
					setRemoteBranches([]);
					setPushRemoteBranch("");
					return;
				}
				let alive = true;
				api.branches(dir).then((value) => {
					if (!alive) return;
					const prefix = "remotes/" + pushTarget + "/";
					const names = value.branches.filter((b) => b.name.startsWith(prefix)).map((b) => b.name.slice(prefix.length));
					const sorted = [...new Set(names)].sort();
					if (branch !== null) {
						const idx = sorted.indexOf(branch);
						if (idx > 0) {
							sorted.splice(idx, 1);
							sorted.unshift(branch);
						}
					}
					setRemoteBranches(sorted);
					setPushRemoteBranch(branch !== null && sorted.includes(branch) ? branch : sorted[0] ?? "");
				}).catch(() => {
					if (alive) {
						setRemoteBranches([]);
						setPushRemoteBranch("");
					}
				});
				return () => {
					alive = false;
				};
			}, [
				api,
				dir,
				pushTarget,
				branch
			]);
			const canCommit = stagedCount > 0 && message.trim() !== "" && !busy;
			/** Commit the current message; clears the form on success. */
			async function doCommit() {
				const result = await api.commit(dir, message, amend, checkedPaths, partial);
				setMessage("");
				setAmend(false);
				return result;
			}
			async function submit() {
				if (!canCommit) return;
				setBusy(true);
				setError(null);
				setOk(null);
				const subject = message.split("\n")[0] ?? "";
				try {
					const result = await doCommit();
					setOk(t("commit.done", {
						short: result.short,
						subject
					}));
					onCommitted();
				} catch (caught) {
					const err = caught;
					setError(err.code === "identity-missing" ? t("commit.identity") : err.message);
				} finally {
					setBusy(false);
				}
			}
			/** Commit, then push the current branch to the chosen remote. */
			async function commitAndPush() {
				if (!canCommit || pushTarget === "" || branch === null) return;
				setBusy(true);
				setError(null);
				setOk(null);
				const subject = message.split("\n")[0] ?? "";
				try {
					const result = await doCommit();
					try {
						await api.push(dir, pushTarget, branch, void 0, pushRemoteBranch === "" || pushRemoteBranch === branch ? void 0 : pushRemoteBranch);
						setOk(pushRemoteBranch === "" || pushRemoteBranch === branch ? t("push.done", {
							branch,
							remote: pushTarget
						}) : t("push.doneTarget", {
							local: branch,
							target: pushRemoteBranch,
							remote: pushTarget
						}));
					} catch (caught) {
						setOk(null);
						setError(t("push.commitOkPushFailed", {
							short: result.short,
							subject,
							message: caught.message
						}));
					}
					onCommitted();
				} catch (caught) {
					const err = caught;
					setError(err.code === "identity-missing" ? t("commit.identity") : err.message);
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-commit",
				children: [stagedCount === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-diff-placeholder",
					style: { padding: "8px" },
					children: t("commit.nothing")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
					value: message,
					placeholder: t("commit.placeholder"),
					onChange: (event) => setMessage(event.target.value),
					onKeyDown: (event) => {
						if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
							event.preventDefault();
							submit();
						}
					},
					disabled: busy
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-commit-row",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: amend,
							onChange: (event) => setAmend(event.target.checked),
							disabled: busy
						}), t("commit.amend")] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "gitui-btn gitui-btn-primary",
							disabled: !canCommit,
							onClick: () => void submit(),
							children: [
								t("action.commit"),
								" (",
								checkedPaths !== void 0 ? checkedPaths.length : stagedCount,
								")"
							]
						}),
						remotes.length > 0 && branch !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								title: t("push.hint", {
									branch,
									remote: pushTarget
								}),
								disabled: !canCommit || pushTarget === "",
								onClick: () => void commitAndPush(),
								children: t("push.andCommit")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								className: "gitui-dir",
								style: { flex: "0 1 110px" },
								value: pushTarget,
								onChange: (event) => setPushTarget(event.target.value),
								children: remotes.map((remote) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: remote.name,
									children: remote.name
								}, remote.name))
							}),
							remoteBranches.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								className: "gitui-dir",
								style: { flex: "0 1 130px" },
								value: pushRemoteBranch,
								title: t("push.remoteBranchSelect"),
								onChange: (event) => setPushRemoteBranch(event.target.value),
								children: remoteBranches.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: name,
									children: name
								}, name))
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-remote-url",
								title: t("push.noRemoteBranches"),
								children: t("push.noRemoteBranches")
							})
						] })
					]
				})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
					message: error !== null ? error : ok,
					tone: error !== null ? "error" : "ok"
				})]
			});
		}
		//#endregion
		//#region src/client/components/MergeRevisions.tsx
		/**
		* MergeRevisions — IDEA-style three-pane conflict resolution:
		* left = ours (current branch), middle = Result, right = theirs (incoming
		* branch). Conflict blocks carry per-block buttons on hover: » accept left,
		* « accept right, × remove from Result. The toolbar navigates blocks and
		* accepts the current one wholesale (Accept Left / Accept Right). The Result
		* pane can also be edited as plain text (edit mode).
		*
		* Block bookkeeping: the static host ranges (view.blocks) highlight the side
		* panes; live blocks are re-parsed from the result text after every edit.
		* Side buttons map to live blocks by content equality (git conflict content
		* is verbatim from each side, so this is reliable).
		*/
		/** Parse conflict blocks (marker lines inclusive) from result text lines. */
		function parseLiveBlocks(lines) {
			const blocks = [];
			let side = null;
			let start = 0;
			let ours = [];
			let theirs = [];
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i] ?? "";
				if (line.startsWith("<<<<<<<")) {
					start = i;
					side = "ours";
					ours = [];
					theirs = [];
					continue;
				}
				if (line.startsWith("=======")) {
					side = "theirs";
					continue;
				}
				if (line.startsWith(">>>>>>>")) {
					blocks.push({
						start,
						end: i,
						ours,
						theirs,
						raw: lines.slice(start, i + 1)
					});
					side = null;
					continue;
				}
				if (side === "ours") ours.push(line);
				else if (side === "theirs") theirs.push(line);
			}
			return blocks;
		}
		function LineList(props) {
			const { lines, highlight, actionsAt, currentAt, onLineClick, slotSide = "left" } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-mr-lines",
				children: lines.map((line, i) => {
					const cls = highlight(i);
					const buttons = actionsAt(i).map((action, ai) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-mr-act " + action.cls,
						title: action.title,
						onClick: (event) => {
							event.stopPropagation();
							action.onClick();
						},
						children: action.glyph
					}, ai));
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-mr-line" + (cls !== null ? " gitui-mr-line-" + cls : "") + (currentAt(i) ? " gitui-mr-line-block-current" : ""),
						onClick: onLineClick !== void 0 ? () => onLineClick(i) : void 0,
						children: [
							slotSide === "left" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-mr-actslot",
								children: buttons
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-mr-no",
								children: i + 1
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-mr-text",
								title: line,
								children: line === "" ? " " : line
							}),
							slotSide === "right" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-mr-actslot gitui-mr-actslot-r",
								children: buttons
							})
						]
					}, i);
				})
			});
		}
		const joinLines = (lines) => lines.join("\n");
		/** First index of a target line sequence at or after 'from', else -1. */
		function findLines(lines, target, from) {
			if (target.length === 0) return -1;
			for (let i = Math.max(0, from); i <= lines.length - target.length; i++) if ((lines[i] ?? "") === target[0]) {
				let ok = true;
				for (let j = 1; j < target.length; j++) if ((lines[i + j] ?? "") !== target[j]) {
					ok = false;
					break;
				}
				if (ok) return i;
			}
			return -1;
		}
		function MergeRevisions(props) {
			const { api, dir, path, t, view, oursLabel, theirsLabel, onSaved } = props;
			const [resultText, setResultText] = (0, react.useState)(view.result);
			const [current, setCurrent] = (0, react.useState)(0);
			const [editMode, setEditMode] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [saved, setSaved] = (0, react.useState)(null);
			/** Undo/redo history: snapshots of resultText with a cursor. */
			const [hist, setHist] = (0, react.useState)({
				stack: [view.result],
				index: 0
			});
			/** Last edit timestamp, for debouncing history snapshots while typing. */
			const lastEditRef = (0, react.useRef)(0);
			/** Which pristine blocks were applied into the result, and from which side. */
			const [applied, setApplied] = (0, react.useState)({});
			(0, react.useEffect)(() => {
				setResultText(view.result);
				setHist({
					stack: [view.result],
					index: 0
				});
				setCurrent(0);
				setSaved(null);
			}, [view.result]);
			const blocks = (0, react.useMemo)(() => parseLiveBlocks(resultText.split("\n")), [resultText]);
			const resultLines = (0, react.useMemo)(() => resultText.split("\n"), [resultText]);
			const oursLines = (0, react.useMemo)(() => view.ours.split("\n"), [view.ours]);
			const theirsLines = (0, react.useMemo)(() => view.theirs.split("\n"), [view.theirs]);
			/** Blocks as parsed from the pristine result — 1:1 with view.blocks. */
			const initialBlocks = (0, react.useMemo)(() => parseLiveBlocks(view.result.split("\n")), [view.result]);
			const inOursBlock = (i) => view.blocks.some((b) => b.oursEnd >= b.oursStart && i >= b.oursStart && i <= b.oursEnd);
			const inTheirsBlock = (i) => view.blocks.some((b) => b.theirsEnd >= b.theirsStart && i >= b.theirsStart && i <= b.theirsEnd);
			const inResultBlock = (i) => blocks.some((b) => i >= b.start && i <= b.end);
			/** Record a new snapshot; discards any redo tail. */
			function pushHist(next) {
				setHist((h) => {
					const stack = [...h.stack.slice(0, h.index + 1), next];
					if (stack.length > 50) stack.shift();
					return {
						stack,
						index: stack.length - 1
					};
				});
			}
			function undo() {
				setHist((h) => {
					if (h.index <= 0) return h;
					const index = h.index - 1;
					setResultText(h.stack[index] ?? "");
					setSaved(null);
					return {
						...h,
						index
					};
				});
			}
			function redo() {
				setHist((h) => {
					if (h.index >= h.stack.length - 1) return h;
					const index = h.index + 1;
					setResultText(h.stack[index] ?? "");
					setSaved(null);
					return {
						...h,
						index
					};
				});
			}
			function applyBlock(index, side) {
				const block = blocks[index];
				if (block === void 0) return;
				const content = side === "ours" ? block.ours : block.theirs;
				const initIdx = initialBlocks.findIndex((init) => joinLines(init.ours) === joinLines(block.ours) && joinLines(init.theirs) === joinLines(block.theirs));
				const lines = resultText.split("\n");
				const next = [
					...lines.slice(0, block.start),
					...content,
					...lines.slice(block.end + 1)
				];
				const nextText = next.join("\n");
				setResultText(nextText);
				pushHist(nextText);
				if (initIdx >= 0) setApplied((a) => ({
					...a,
					[initIdx]: side
				}));
				setCurrent(Math.min(index, parseLiveBlocks(next).length - 1));
				setSaved(null);
			}
			/**
			* Reverse operation: undo a block merge-in by locating the applied content
			* in the result and restoring the original conflict block (markers intact).
			*/
			function restoreBlock(initIdx, side) {
				const init = initialBlocks[initIdx];
				if (init === void 0) return;
				const content = side === "ours" ? init.ours : init.theirs;
				const lines = resultText.split("\n");
				const at = findLines(lines, content, 0);
				if (at < 0) return;
				const nextText = [
					...lines.slice(0, at),
					...init.raw,
					...lines.slice(at + content.length)
				].join("\n");
				setResultText(nextText);
				pushHist(nextText);
				setApplied((a) => {
					const copy = { ...a };
					delete copy[initIdx];
					return copy;
				});
				setCurrent(0);
				setSaved(null);
			}
			function removeBlock(index) {
				const block = blocks[index];
				if (block === void 0) return;
				const lines = resultText.split("\n");
				const next = [...lines.slice(0, block.start), ...lines.slice(block.end + 1)];
				const nextText = next.join("\n");
				setResultText(nextText);
				pushHist(nextText);
				setCurrent(Math.min(index, parseLiveBlocks(next).length - 1));
				setSaved(null);
			}
			/** Apply a side's original block content (matched by content) to the live block. */
			function applySideByContent(index, side) {
				const initial = initialBlocks[index];
				if (initial === void 0) return;
				const target = side === "ours" ? initial.ours : initial.theirs;
				const idx = blocks.findIndex((b) => joinLines(b.ours) === joinLines(target) || joinLines(b.theirs) === joinLines(target));
				if (idx >= 0) applyBlock(idx, side);
				else if (blocks.length > 0) applyBlock(0, side);
			}
			/** Not-apply: locate the pristine block in the live result and remove it. */
			function removeByContent(index) {
				const initial = initialBlocks[index];
				if (initial === void 0) return;
				const idx = blocks.findIndex((b) => joinLines(b.ours) === joinLines(initial.ours) && joinLines(b.theirs) === joinLines(initial.theirs));
				if (idx >= 0) removeBlock(idx);
			}
			async function save() {
				setBusy(true);
				setError(null);
				try {
					await api.resolveFile(dir, path, resultText);
					setSaved(t("conflict.resolved"));
					onSaved();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			const currentBlock = blocks[current];
			const allResolved = blocks.length === 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-mr",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-mr-toolbar",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								title: t("merge.prev"),
								disabled: blocks.length === 0 || current <= 0,
								onClick: () => setCurrent((c) => Math.max(0, c - 1)),
								children: "◀"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								title: t("merge.next"),
								disabled: blocks.length === 0 || current >= blocks.length - 1,
								onClick: () => setCurrent((c) => Math.min(blocks.length - 1, c + 1)),
								children: "▶"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn gitui-mr-accept-ours",
								title: t("merge.acceptLeftHint"),
								disabled: currentBlock === void 0,
								onClick: () => applyBlock(current, "ours"),
								children: t("merge.acceptLeft")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn gitui-mr-accept-theirs",
								title: t("merge.acceptRightHint"),
								disabled: currentBlock === void 0,
								onClick: () => applyBlock(current, "theirs"),
								children: t("merge.acceptRight")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								title: t("merge.undo"),
								disabled: hist.index <= 0,
								onClick: undo,
								children: "↶"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								title: t("merge.redo"),
								disabled: hist.index >= hist.stack.length - 1,
								onClick: redo,
								children: "↷"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								disabled: busy,
								onClick: () => setEditMode(!editMode),
								children: editMode ? t("merge.viewMode") : t("merge.editMode")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-mr-count",
								children: allResolved ? t("merge.allResolved") : t("merge.remaining", { n: blocks.length })
							})
						]
					}),
					editMode ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: "gitui-mr-edit",
						value: resultText,
						spellCheck: false,
						onChange: (event) => {
							const next = event.target.value;
							setResultText(next);
							setSaved(null);
							const now = Date.now();
							if (now - lastEditRef.current > 800) pushHist(next);
							lastEditRef.current = now;
						}
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-mr-cols",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-mr-col",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-mr-col-title gitui-mr-title-ours",
									children: oursLabel
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LineList, {
									lines: oursLines,
									highlight: (i) => inOursBlock(i) ? "ours" : null,
									currentAt: () => false,
									slotSide: "right",
									actionsAt: (i) => {
										const j = view.blocks.findIndex((b) => b.oursEnd >= b.oursStart && i === b.oursStart);
										if (j < 0) return [];
										const done = applied[j] !== void 0;
										return [{
											glyph: done ? "«" : "»",
											title: done ? t("merge.restore") : t("merge.applyLeft"),
											cls: "gitui-mr-act-accept-ours" + (done ? " gitui-mr-act-done" : ""),
											onClick: () => done ? restoreBlock(j, applied[j]) : applySideByContent(j, "ours")
										}, {
											glyph: "×",
											title: t("merge.notApply"),
											cls: "gitui-mr-act-remove",
											onClick: () => removeByContent(j)
										}];
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-mr-col",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-mr-col-title",
									children: t("merge.resultTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LineList, {
									lines: resultLines,
									highlight: (i) => inResultBlock(i) ? "result" : null,
									currentAt: (i) => currentBlock !== void 0 && i >= currentBlock.start && i <= currentBlock.end,
									onLineClick: (i) => {
										const idx = blocks.findIndex((b) => i >= b.start && i <= b.end);
										if (idx >= 0) setCurrent(idx);
									},
									slotSide: "left",
									actionsAt: () => []
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-mr-col",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-mr-col-title gitui-mr-title-theirs",
									children: theirsLabel
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LineList, {
									lines: theirsLines,
									highlight: (i) => inTheirsBlock(i) ? "theirs" : null,
									currentAt: () => false,
									slotSide: "left",
									actionsAt: (i) => {
										const j = view.blocks.findIndex((b) => b.theirsEnd >= b.theirsStart && i === b.theirsStart);
										if (j < 0) return [];
										const done = applied[j] !== void 0;
										return [{
											glyph: done ? "»" : "«",
											title: done ? t("merge.restore") : t("merge.applyRight"),
											cls: "gitui-mr-act-accept-theirs" + (done ? " gitui-mr-act-done" : ""),
											onClick: () => done ? restoreBlock(j, applied[j]) : applySideByContent(j, "theirs")
										}];
									}
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-mr-footer",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
								message: saved !== null ? saved : error,
								tone: error !== null ? "error" : "ok"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn gitui-btn-primary",
								disabled: busy,
								onClick: () => void save(),
								children: t("conflict.save")
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/components/MergeView.tsx
		/**
		* Merge tab: conflict list with ours/theirs resolution, plus a merge starter
		* when no merge is in progress. The starter makes the direction explicit —
		* git always merges INTO the checked-out branch — and offers the reverse
		* direction (switch target, then merge) as a secondary action.
		*/
		function MergeView(props) {
			const { api, dir, status, t, onChanged, onOpenRebase } = props;
			const merging = status !== null && (status.state === "merge" || status.state === "cherry-pick" || status.state === "revert" || status.state === "rebase");
			const conflicts = status?.conflicts ?? [];
			const opState = status?.state ?? "clean";
			/** Destination of any merge started here: the checked-out branch. */
			const currentBranch = status?.branch ?? null;
			const [branches, setBranches] = (0, react.useState)([]);
			/** Source branch (merged FROM). */
			const [source, setSource] = (0, react.useState)("");
			/** Target branch (merged INTO); defaults to the checked-out branch. */
			const [target, setTarget] = (0, react.useState)("");
			const [noFF, setNoFF] = (0, react.useState)(false);
			const [mergeBusy, setMergeBusy] = (0, react.useState)(false);
			const [mergeError, setMergeError] = (0, react.useState)(null);
			const [expanded, setExpanded] = (0, react.useState)(null);
			const [conflict, setConflict] = (0, react.useState)(null);
			const [resolved, setResolved] = (0, react.useState)(null);
			const [continueMessage, setContinueMessage] = (0, react.useState)("");
			const [finalBusy, setFinalBusy] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (merging) return;
				api.branches(dir).then((value) => {
					setBranches(value.branches.filter((branch) => !branch.name.startsWith("remotes/")).map((branch) => ({ name: branch.name })));
				}).catch(() => setBranches([]));
			}, [
				api,
				dir,
				merging
			]);
			(0, react.useEffect)(() => {
				setSource("");
				setTarget("");
			}, [dir]);
			(0, react.useEffect)(() => {
				if (target === "" && currentBranch !== null) setTarget(currentBranch);
			}, [target, currentBranch]);
			/** Report a merge result precisely: merged / fast-forward / up-to-date / conflicts. */
			function applyOutcome(outcome, source, target) {
				if (outcome.merged) {
					const short = (outcome.hash ?? "").slice(0, 7);
					if (outcome.kind === "fast-forward") setNotice(t("merge.fastForward", {
						source,
						target,
						short
					}));
					else setNotice(t("merge.done", {
						short,
						subject: source
					}));
				} else if (outcome.kind === "already-up-to-date") setNotice(t("merge.alreadyUpToDate", {
					source,
					target
				}));
				else if (outcome.kind === "conflicts") setNotice(null);
				else setMergeError(outcome.message ?? "无法开始合并");
			}
			async function startMerge() {
				if (source === "" || target === "" || source === target) return;
				setMergeBusy(true);
				setMergeError(null);
				try {
					if (target !== currentBranch) {
						if (!window.confirm(t("merge.switchConfirm", {
							target,
							source
						}))) return;
						await api.checkout(dir, target);
					}
					applyOutcome(await api.merge(dir, source, noFF), source, target);
					onChanged();
				} catch (error) {
					setMergeError(error.message);
				} finally {
					setMergeBusy(false);
				}
			}
			async function openConflict(path) {
				setExpanded(path);
				setResolved(null);
				setConflict(null);
				try {
					const view = await api.conflictContent(dir, path);
					setConflict(view);
				} catch (error) {
					setConflict(null);
					setResolved(error.message);
				}
			}
			async function abortMerge() {
				setFinalBusy(true);
				try {
					await api.operationAbort(dir);
					onChanged();
				} catch (error) {
					setMergeError(error.message);
				} finally {
					setFinalBusy(false);
				}
			}
			async function finishMerge() {
				setFinalBusy(true);
				setMergeError(null);
				try {
					const result = await api.operationContinue(dir, continueMessage);
					const subject = continueMessage !== "" ? continueMessage : opState === "cherry-pick" ? "cherry-pick" : opState === "revert" ? "revert" : opState === "rebase" ? "rebase" : "merge";
					setNotice(t("merge.done", {
						short: (result.hash ?? "").slice(0, 7),
						subject
					}));
					setContinueMessage("");
					onChanged();
				} catch (error) {
					setMergeError(error.message);
				} finally {
					setFinalBusy(false);
				}
			}
			/** Rebase-only: skip the conflicting commit. */
			async function skipCommit() {
				setFinalBusy(true);
				setMergeError(null);
				try {
					const outcome = await api.operationSkip(dir);
					if (!outcome.skipped) setNotice(t("merge.skipConflicts", { n: outcome.conflicts?.length ?? 0 }));
					else setNotice(t("merge.skipped"));
					onChanged();
				} catch (error) {
					setMergeError(error.message);
				} finally {
					setFinalBusy(false);
				}
			}
			const branchOptions = (selected, onChange, exclude) => {
				const options = branches.filter((branch) => branch.name !== exclude);
				return options.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "gitui-merge-label",
					children: t("merge.noTargets")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
					className: "gitui-dir",
					style: { flex: "0 1 240px" },
					value: selected,
					onChange: (event) => onChange(event.target.value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
						value: "",
						children: [t("history.branch"), "…"]
					}), options.map((branch) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: branch.name,
						children: branch.name
					}, branch.name))]
				});
			};
			const noFFOption = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "gitui-merge-option",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked: noFF,
					onChange: (event) => setNoFF(event.target.checked)
				}), t("merge.noFF")]
			});
			if (!merging) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-detail",
				style: { minHeight: 220 },
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-diff-placeholder",
					style: { textAlign: "left" },
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gitui-merge-row",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "gitui-merge-label",
									children: t("merge.from")
								}),
								branchOptions(source, setSource, target),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "gitui-merge-arrow",
									children: "→"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "gitui-merge-label",
									children: t("merge.into")
								}),
								branchOptions(target, setTarget, "")
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gitui-merge-row",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "gitui-btn gitui-btn-primary",
									disabled: source === "" || target === "" || source === target || mergeBusy,
									onClick: () => void startMerge(),
									children: t("merge.button", {
										source: source === "" ? "…" : source,
										target: target === "" ? "…" : target
									})
								}),
								noFFOption,
								onOpenRebase !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "gitui-btn",
									title: t("rebase.title"),
									disabled: mergeBusy,
									onClick: () => onOpenRebase(),
									children: t("rebase.title")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
							message: mergeError !== null ? mergeError : notice,
							tone: mergeError !== null ? "error" : "ok"
						})
					]
				})
			});
			const mergeSource = status?.mergeSource ?? null;
			const mergeTargetName = status?.branch ?? null;
			const directionKnown = mergeSource !== null && mergeTargetName !== null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-detail",
				style: { minHeight: 220 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-badge gitui-badge-danger",
								children: conflicts.length
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: { flex: 1 },
								children: conflicts.length > 0 ? directionKnown ? t("merge.conflictsRemainInto", {
									n: conflicts.length,
									source: mergeSource,
									target: mergeTargetName
								}) : t("merge.conflictsRemain", { n: conflicts.length }) : directionKnown ? t("merge.inprogressInto", {
									source: mergeSource,
									target: mergeTargetName
								}) : opState !== "merge" ? t("state." + opState) : t("merge.inprogress")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn gitui-btn-danger",
								disabled: finalBusy,
								onClick: () => void abortMerge(),
								children: t("merge.abort")
							}),
							opState === "rebase" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								disabled: finalBusy,
								title: t("merge.skipHint"),
								onClick: () => void skipCommit(),
								children: t("merge.skip")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn gitui-btn-primary",
								disabled: conflicts.length > 0 || finalBusy,
								onClick: () => void finishMerge(),
								children: t("merge.continue")
							})
						]
					}),
					conflicts.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gitui-commit",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							value: continueMessage,
							placeholder: t("merge.commitMessage"),
							onChange: (event) => setContinueMessage(event.target.value)
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gitui-merge-list",
						children: conflicts.map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gitui-conflict",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-conflict-head",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-file-status gitui-st-unmerged",
										children: "U"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-file-path",
										children: path
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "gitui-btn",
										onClick: () => void openConflict(path),
										children: expanded === path ? t("action.close") : t("conflict.edit")
									})
								]
							}), expanded === path && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-conflict-body",
								style: { padding: 0 },
								children: [
									conflict === null && resolved === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-diff-placeholder",
										children: "…"
									}),
									conflict !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MergeRevisions, {
										api,
										dir,
										path,
										t,
										view: conflict,
										oursLabel: currentBranch ?? t("conflict.ours"),
										theirsLabel: mergeSource ?? t("conflict.theirs"),
										onSaved: onChanged
									}),
									resolved !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-error",
										style: { padding: "4px 10px" },
										children: resolved
									})
								]
							})]
						}, path))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
						message: mergeError !== null ? mergeError : notice,
						tone: mergeError !== null ? "error" : "ok"
					})
				]
			});
		}
		//#endregion
		//#region src/client/components/HistoryView.tsx
		/**
		* History tab — modeled after the IntelliJ IDEA Git tool window's Log tab:
		* a colored commit graph on the left; filters (branch / author / date / text /
		* file); selecting a commit opens a details panel with the full commit
		* message, metadata, Changed Files, and the selected file's diff. A context
		* menu on each commit offers IDEA-style actions, including reset / checkout /
		* "show diff with working tree".
		*/
		function formatDate(timestamp) {
			const date = new Date(timestamp);
			const pad = (value) => String(value).padStart(2, "0");
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}
		function formatShortDate(timestamp) {
			const date = new Date(timestamp);
			const pad = (value) => String(value).padStart(2, "0");
			return String(date.getFullYear()).slice(2) + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
		}
		/** Readable key:value text block of a commit, for "copy metadata". */
		function buildMetadataText(t, d) {
			const lines = [
				d.short + " · " + d.hash,
				t("log.author") + ": " + d.author + (d.authorEmail !== "" ? " <" + d.authorEmail + ">" : ""),
				t("log.authorDate") + ": " + formatDate(d.authorDate),
				t("log.committer") + ": " + d.committer,
				t("log.commitDate") + ": " + formatDate(d.committerDate)
			];
			if (d.parents.length > 0) lines.push(t("log.parents") + ": " + d.parents.join(", "));
			lines.push("", d.subject);
			if (d.body !== "") lines.push(d.body);
			if (d.files.length > 0) {
				lines.push(t("log.files") + " (" + d.files.length + ")");
				for (const file of d.files) {
					const head = "  " + (STATUS_LABEL[file.status] ?? file.status) + "  " + file.path;
					lines.push(file.additions !== null ? head + "  +" + file.additions + "/-" + (file.deletions ?? 0) : head);
				}
			}
			return lines.join("\n");
		}
		/** The full commit message (subject + body), for "copy commit message". */
		function commitMessageText(d) {
			return d.body !== "" ? d.subject + "\n\n" + d.body : d.subject;
		}
		const STATUS_LABEL = {
			A: "A",
			M: "M",
			D: "D",
			R: "R",
			C: "C",
			T: "T",
			U: "U"
		};
		function CommitDetailPanel(props) {
			const { api, dir, hash, t, onChanged, diffFullscreen, onToggleDiffFullscreen, filesWidth, onFilesWidth, worktreeToggleRef } = props;
			const [detail, setDetail] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [filePath, setFilePath] = (0, react.useState)(null);
			const [diffFiles, setDiffFiles] = (0, react.useState)(null);
			const [diffLoading, setDiffLoading] = (0, react.useState)(false);
			/** Compare mode: show the diff between this commit and the working tree. */
			const [worktreeMode, setWorktreeMode] = (0, react.useState)(false);
			/** Files of the worktree diff (all paths when worktreeMode). */
			const [worktreeFiles, setWorktreeFiles] = (0, react.useState)([]);
			const [fileLimit, setFileLimit] = (0, react.useState)(200);
			const FILE_PAGE = 200;
			(0, react.useEffect)(() => {
				let alive = true;
				setDetail(null);
				setError(null);
				setFilePath(null);
				setDiffFiles(null);
				setWorktreeMode(false);
				setWorktreeFiles([]);
				setFileLimit(200);
				api.commitDetail(dir, hash).then((value) => {
					if (!alive) return;
					setDetail(value);
					if (value.files.length > 0) {
						const first = value.files[0];
						setFilePath(first.path);
						setDiffLoading(true);
						api.commitDiff(dir, hash, first.path).then((files) => {
							if (!alive) return;
							setDiffFiles(files);
						}).catch((caught) => {
							if (!alive) return;
							setDiffFiles(null);
							setError(caught.message);
						}).finally(() => {
							if (alive) setDiffLoading(false);
						});
					}
				}).catch((caught) => {
					if (!alive) return;
					setError(caught.message);
				});
				return () => {
					alive = false;
				};
			}, [
				api,
				dir,
				hash
			]);
			function openFile(path) {
				setFilePath(path);
				setDiffLoading(true);
				setDiffFiles(null);
				(worktreeMode ? api.diffWithWorktree(dir, hash, path) : api.commitDiff(dir, hash, path)).then((files) => setDiffFiles(files)).catch((caught) => {
					setDiffFiles(null);
					setError(caught.message);
				}).finally(() => setDiffLoading(false));
			}
			/** Toggle the "show diff with working tree" mode. */
			function toggleWorktreeMode() {
				if (!worktreeMode) {
					setWorktreeMode(true);
					setDiffLoading(true);
					setError(null);
					setFilePath(null);
					setDiffFiles(null);
					api.diffWithWorktree(dir, hash).then((files) => {
						setWorktreeFiles(files.map((f) => ({ path: f.path })));
						const first = files[0];
						if (first !== void 0) {
							setFilePath(first.path);
							return api.diffWithWorktree(dir, hash, first.path).then((one) => setDiffFiles(one));
						}
						setDiffFiles([]);
					}).catch((caught) => {
						setDiffFiles(null);
						setError(caught.message);
					}).finally(() => setDiffLoading(false));
				} else {
					setWorktreeMode(false);
					setWorktreeFiles([]);
					if (detail !== null && detail.files.length > 0) openFile(detail.files[0]?.path ?? "");
				}
			}
			(0, react.useEffect)(() => {
				if (worktreeToggleRef !== void 0) {
					worktreeToggleRef.current = toggleWorktreeMode;
					return () => {
						worktreeToggleRef.current = void 0;
					};
				}
			});
			/** Detail container, measured for the changed-pane width drag. */
			const detailRef = (0, react.useRef)(null);
			/** Drag the divider between the changed-files pane and the diff. */
			const startHSplit = (event) => {
				event.preventDefault();
				const container = detailRef.current;
				const startX = event.clientX;
				const startWidth = filesWidth;
				const onMove = (move) => {
					const width = container?.getBoundingClientRect().width ?? 800;
					const max = Math.max(120, width - 260);
					const next = Math.min(max, Math.max(120, startWidth + move.clientX - startX));
					onFilesWidth(Math.round(next));
				};
				const onUp = () => {
					window.removeEventListener("mousemove", onMove);
					window.removeEventListener("mouseup", onUp);
					document.body.style.userSelect = "";
				};
				document.body.style.userSelect = "none";
				window.addEventListener("mousemove", onMove);
				window.addEventListener("mouseup", onUp);
			};
			if (error !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-error",
				style: { padding: 12 },
				children: error
			});
			if (detail === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-diff-placeholder",
				children: "…"
			});
			const fileList = worktreeMode ? worktreeFiles : detail.files.map((f) => ({
				path: f.path,
				status: f.status
			}));
			/** The diff pane shared by the inline row and the fullscreen mode. */
			const diffPane = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-commit-diff",
				style: {
					flex: 1,
					minWidth: 0,
					minHeight: 0
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-detail-header",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "gitui-file-path",
							children: filePath ?? ""
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn" + (diffFullscreen ? " gitui-active" : ""),
							title: diffFullscreen ? t("win.exitFullscreen") : t("win.fullscreen"),
							onClick: onToggleDiffFullscreen,
							children: diffFullscreen ? "🗗" : "⛶"
						})
					]
				}), diffLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-diff-placeholder",
					children: "…"
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffView, {
					file: diffFiles !== null && diffFiles.length > 0 ? diffFiles[0] : null,
					t,
					leftLabel: worktreeMode ? detail.short : detail.parents.length > 0 ? detail.parents[0].slice(0, 7) : t("diff.emptyTree"),
					rightLabel: worktreeMode ? t("diff.worktree") : detail.short
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-commit-detail",
				ref: detailRef,
				children: [!diffFullscreen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-detail-row",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gitui-changed-pane",
							style: {
								width: filesWidth,
								flex: "none"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-changed-title",
								children: [
									worktreeMode ? t("log.worktreeFiles") : t("log.changedFiles"),
									" (",
									fileList.length,
									")"
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-changed-files",
								children: [fileList.slice(0, fileLimit).map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-changed-file" + (file.path === filePath ? " gitui-changed-file-selected" : ""),
									onClick: () => openFile(file.path),
									children: [!worktreeMode && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-file-status " + (file.status === "D" ? "gitui-st-deleted" : file.status === "A" ? "gitui-st-added" : file.status === "M" ? "gitui-st-modified" : ""),
										children: STATUS_LABEL[file.status ?? ""] ?? file.status ?? ""
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-file-path",
										children: file.path
									})]
								}, file.path)), fileList.length > fileLimit && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "gitui-btn",
									style: {
										margin: "6px 8px",
										width: "calc(100% - 16px)"
									},
									onClick: () => setFileLimit((current) => current + FILE_PAGE),
									children: t("log.showMore", { n: String(fileList.length - fileLimit) })
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-hsplit",
							title: t("history.filePaneResize"),
							onMouseDown: startHSplit
						}),
						diffPane
					]
				}), diffFullscreen && diffPane]
			});
		}
		function HistoryView(props) {
			const { api, dir, t, onChanged, splitWidth, onSplitWidth, onSplitReset, fileFilterInit, onFileFilterConsumed, fullscreen, currentBranch, onOpenRebase, onOpenConflicts } = props;
			const [rows, setRows] = (0, react.useState)(null);
			const [selectedHash, setSelectedHash] = (0, react.useState)(null);
			/** Multi-selection (Ctrl/Shift+click): hashes in click order. */
			const [selectedCommits, setSelectedCommits] = (0, react.useState)([]);
			/** Anchor row index for Shift+click range selection. */
			const anchorIndexRef = (0, react.useRef)(-1);
			/** Handle CommitDetailPanel's worktree-compare toggle for the context menu. */
			const detailWorktreeRef = (0, react.useRef)(void 0);
			/** Hover popup: lazily loads the commit metadata for the row under the cursor. */
			const [hoverInfo, setHoverInfo] = (0, react.useState)(null);
			const hoverTimer = (0, react.useRef)(null);
			const showHover = (event, hash) => {
				const { clientX, clientY } = event;
				setHoverInfo({
					x: clientX,
					y: clientY,
					hash,
					detail: null
				});
				if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
				hoverTimer.current = window.setTimeout(() => {
					api.commitDetail(dir, hash).then((d) => setHoverInfo((cur) => cur !== null && cur.hash === hash ? {
						...cur,
						detail: d
					} : cur)).catch(() => setHoverInfo((cur) => cur !== null && cur.hash === hash ? {
						...cur,
						detail: null
					} : cur));
				}, 180);
			};
			const hideHover = () => {
				if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
				setHoverInfo(null);
			};
			const [error, setError] = (0, react.useState)(null);
			/** Search filter over subject / author / hash. */
			const [query, setQuery] = (0, react.useState)("");
			/** When set, the list shows this file's history instead of the whole log. */
			const [filePathFilter, setFilePathFilter] = (0, react.useState)(null);
			const [filePathInput, setFilePathInput] = (0, react.useState)("");
			/** Maximized: the panel goes fullscreen; the left list stays visible. */
			const [diffFullscreen, setDiffFullscreen] = (0, react.useState)(false);
			/** Changed-file pane width in px (user-draggable). */
			const [filesWidth, setFilesWidth] = (0, react.useState)(240);
			/** Busy while a "更多" merge/rebase runs. */
			const [busy, setBusy] = (0, react.useState)(false);
			/** Success/conflict feedback for the "更多" operations. */
			const [notice, setNotice] = (0, react.useState)(null);
			/** "更多" dropdown menu anchor. */
			const [moreMenu, setMoreMenu] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (!fullscreen && diffFullscreen) setDiffFullscreen(false);
			}, [fullscreen, diffFullscreen]);
			(0, react.useEffect)(() => {
				return () => {
					if (diffFullscreen) gitUiSetFullscreen(false);
				};
			}, [diffFullscreen]);
			const toggleDiffFullscreen = () => {
				const next = !diffFullscreen;
				setDiffFullscreen(next);
				gitUiSetFullscreen(next);
			};
			/** Log filters. */
			const [branchFilter, setBranchFilter] = (0, react.useState)("");
			const [authorFilter, setAuthorFilter] = (0, react.useState)("");
			const [sinceFilter, setSinceFilter] = (0, react.useState)("");
			const [untilFilter, setUntilFilter] = (0, react.useState)("");
			const [branches, setBranches] = (0, react.useState)([]);
			/** Authors of the current branch filter range (dropdown options). */
			const [authors, setAuthors] = (0, react.useState)([]);
			/** Context menu on a commit row (right-click inside the selection acts on all of it). */
			const [menu, setMenu] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				api.logAuthors(dir, branchFilter === "" ? void 0 : branchFilter).then((list) => {
					setAuthors(list);
					if (authorFilter !== "" && !list.some((a) => a.name === authorFilter)) setAuthorFilter("");
				}).catch(() => {
					setAuthors([]);
				});
			}, [
				api,
				dir,
				branchFilter
			]);
			(0, react.useEffect)(() => {
				if (fileFilterInit !== void 0 && fileFilterInit !== null && fileFilterInit !== "") {
					setFilePathFilter(fileFilterInit);
					setFilePathInput(fileFilterInit);
					onFileFilterConsumed?.();
				}
			}, [fileFilterInit, onFileFilterConsumed]);
			(0, react.useEffect)(() => {
				let alive = true;
				api.branches(dir).then((value) => {
					if (!alive) return;
					const names = value.branches.map((b) => b.name);
					setBranches(names);
					const current = value.current ?? "";
					setBranchFilter((prev) => prev === "" && current !== "" && names.includes(current) ? current : prev);
				}).catch(() => setBranches([]));
				return () => {
					alive = false;
				};
			}, [api, dir]);
			(0, react.useEffect)(() => {
				let alive = true;
				setError(null);
				const filters = {
					...branchFilter !== "" ? { branch: branchFilter } : {},
					...authorFilter !== "" ? { author: authorFilter } : {},
					...sinceFilter !== "" ? { since: sinceFilter } : {},
					...untilFilter !== "" ? { until: untilFilter } : {}
				};
				const load = async () => {
					if (filePathFilter !== null) {
						const fileRows = await api.fileLog(dir, filePathFilter, 50).then((commits) => commits.map((c) => ({
							graph: [],
							...c
						})));
						if (!alive) return;
						setRows(fileRows);
						if (fileRows.length > 0) setSelectedHash((current) => current ?? fileRows[0].hash);
					} else {
						const graphRows = await api.logGraph(dir, 100, filters);
						if (!alive) return;
						setRows(graphRows);
						if (graphRows.length > 0) setSelectedHash((current) => current ?? graphRows[0].hash);
					}
				};
				load().catch((caught) => {
					if (alive) setError(caught.message);
				});
				return () => {
					alive = false;
				};
			}, [
				api,
				dir,
				filePathFilter,
				branchFilter,
				authorFilter,
				sinceFilter,
				untilFilter
			]);
			/** Rows after the search filter — the range a Shift+click extends over. */
			const filteredRows = (0, react.useMemo)(() => {
				if (rows === null) return [];
				const q = query.trim().toLowerCase();
				if (q === "") return rows;
				return rows.filter((row) => row.subject.toLowerCase().includes(q) || row.author.toLowerCase().includes(q) || row.short.toLowerCase().includes(q) || row.hash.toLowerCase().includes(q));
			}, [rows, query]);
			/** hash → row lookup, for ordering multi-selection actions oldest-first. */
			const rowByHash = (0, react.useMemo)(() => new Map(filteredRows.map((row) => [row.hash, row])), [filteredRows]);
			/** Drop stale selections when the visible log changes (filters, rewrites). */
			(0, react.useEffect)(() => {
				if (rows === null) return;
				const alive = new Set(rows.map((row) => row.hash));
				setSelectedCommits((prev) => prev.filter((hash) => alive.has(hash)));
			}, [rows]);
			/** Row click with Ctrl/Shift multi-selection (IDEA-style). */
			function onRowClick(event, hash, index) {
				if (event.ctrlKey || event.metaKey) {
					setSelectedHash(hash);
					setSelectedCommits((prev) => prev.includes(hash) ? prev.filter((h) => h !== hash) : [...prev, hash]);
					anchorIndexRef.current = index;
				} else if (event.shiftKey) {
					const anchor = anchorIndexRef.current >= 0 ? anchorIndexRef.current : index;
					const start = Math.min(anchor, index);
					const end = Math.max(anchor, index);
					setSelectedHash(hash);
					setSelectedCommits(filteredRows.slice(start, end + 1).map((row) => row.hash));
					anchorIndexRef.current = index;
				} else {
					setSelectedHash(hash);
					setSelectedCommits([hash]);
					anchorIndexRef.current = index;
				}
			}
			/** IDEA-style commit context menu; `hashes` is the whole selection. */
			function commitMenuItems(hashes) {
				const single = hashes.length <= 1;
				const hash = hashes[0] ?? "";
				const items = [];
				if (!single) items.push({
					label: t("history.selectedCount", { n: String(hashes.length) }),
					disabled: true
				});
				items.push({
					label: single ? t("menu.copyHash") : t("menu.copyHashes"),
					onClick: () => void navigator.clipboard?.writeText(hashes.join("\n")).catch(() => {})
				});
				if (single) items.push({
					separator: true,
					label: ""
				}, {
					label: t("menu.checkoutRevision"),
					onClick: () => {
						if (window.confirm(t("menu.checkoutRevisionConfirm", { hash: hash.slice(0, 7) }))) api.checkout(dir, hash).then(onChanged).catch((caught) => setError(caught.message));
					}
				}, {
					label: t("menu.createBranchHere"),
					onClick: () => {
						const name = window.prompt(t("menu.createBranchHerePrompt"), "");
						if (name !== null && name.trim() !== "") api.checkout(dir, name.trim(), true, hash).then(onChanged).catch((caught) => setError(caught.message));
					}
				}, {
					label: t("menu.resetToHere"),
					children: [
						"soft",
						"mixed",
						"hard"
					].map((mode) => ({
						label: mode,
						danger: mode === "hard",
						onClick: () => void api.reset(dir, mode, hash).then(onChanged).catch((caught) => setError(caught.message))
					}))
				});
				items.push({
					separator: true,
					label: ""
				});
				const ordered = [...hashes].sort((a, b) => (rowByHash.get(a)?.date ?? 0) - (rowByHash.get(b)?.date ?? 0));
				const runOperation = (operation) => {
					(async () => {
						try {
							const outcome = await operation(ordered);
							if (outcome.done === false && (outcome.conflicts?.length ?? 0) > 0) {
								await api.refreshStatus(dir);
								onOpenConflicts?.();
							} else onChanged();
						} catch (caught) {
							setError(caught.message);
						}
					})();
				};
				items.push({
					label: single ? t("cherryPick") : t("cherryPick.multi", { n: String(hashes.length) }),
					onClick: () => runOperation((list) => api.cherryPick(dir, list))
				}, {
					label: single ? t("revert") : t("revert.multi", { n: String(hashes.length) }),
					onClick: () => runOperation((list) => api.revert(dir, list))
				});
				if (!single) items.push({
					label: t("squash.multi", { n: String(hashes.length) }),
					onClick: () => {
						const first = rowByHash.get(ordered[0] ?? "");
						const message = window.prompt(t("squash.prompt"), first?.subject ?? "");
						if (message === null) return;
						(async () => {
							try {
								await api.squashCommits(dir, ordered, message);
								setNotice(t("squash.done"));
								await refreshRows();
								onChanged();
							} catch (caught) {
								setError(caught.message);
							}
						})();
					}
				});
				if (single) items.push({
					label: t("tag.create"),
					onClick: () => {
						const name = window.prompt(t("tag.createPrompt"), "");
						if (name !== null && name.trim() !== "") api.tagCreate(dir, name.trim(), hash).catch((caught) => setError(caught.message));
					}
				}, {
					label: t("log.worktreeDiff"),
					disabled: hash !== selectedHash,
					onClick: () => detailWorktreeRef.current?.()
				}, {
					separator: true,
					label: ""
				}, {
					label: t("menu.copyMetadata"),
					onClick: () => {
						api.commitDetail(dir, hash).then((d) => navigator.clipboard?.writeText(buildMetadataText(t, d))).catch(() => {});
					}
				}, {
					label: t("menu.copyMessage"),
					onClick: () => {
						api.commitDetail(dir, hash).then((d) => navigator.clipboard?.writeText(commitMessageText(d))).catch(() => {});
					}
				});
				return items;
			}
			/** Reload the commit list with the current filters. */
			async function refreshRows() {
				try {
					const filters = {
						...branchFilter !== "" ? { branch: branchFilter } : {},
						...authorFilter !== "" ? { author: authorFilter } : {},
						...sinceFilter !== "" ? { since: sinceFilter } : {},
						...untilFilter !== "" ? { until: untilFilter } : {}
					};
					const graphRows = filePathFilter !== null ? await api.fileLog(dir, filePathFilter, 50).then((cs) => cs.map((c) => ({
						graph: [],
						...c
					}))) : await api.logGraph(dir, 100, filters);
					setRows(graphRows);
				} catch (caught) {
					setError(caught.message);
				}
			}
			/** Merge the branch selected in the branch filter into the current branch. */
			async function mergeToCurrentBranch() {
				if (dir === "" || currentBranch === null || currentBranch === void 0) return;
				setBusy(true);
				setError(null);
				setNotice(null);
				try {
					const outcome = await api.merge(dir, branchFilter);
					if (outcome.kind === "conflicts") {
						await api.refreshStatus(dir);
						onOpenConflicts?.();
					} else if (outcome.kind === "error") setError(outcome.message ?? "merge failed");
					else setNotice(t("history.merged", {
						from: branchFilter,
						to: currentBranch
					}));
					await refreshRows();
					onChanged();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			/** Check out the filtered branch and rebase it onto the current branch. */
			async function rebaseToCurrentBranch() {
				if (dir === "" || currentBranch === null || currentBranch === void 0) return;
				setBusy(true);
				setError(null);
				setNotice(null);
				try {
					await api.checkout(dir, branchFilter);
					onChanged();
					let list = null;
					try {
						list = await api.rebaseList(dir, currentBranch);
					} catch {
						list = null;
					}
					if (list === null || list.base !== currentBranch) {
						onOpenRebase?.(currentBranch);
						return;
					}
					if (list.commits.length === 0) {
						setNotice(t("rebase.nothing"));
						return;
					}
					const items = list.commits.map((c) => ({
						action: "pick",
						hash: c.hash
					}));
					const outcome = await api.rebaseStart(dir, currentBranch, items);
					if (outcome.conflicts !== void 0 && outcome.conflicts.length > 0) {
						await api.refreshStatus(dir);
						onOpenConflicts?.();
					} else setNotice(t("history.rebased", {
						from: branchFilter,
						to: currentBranch
					}));
					await refreshRows();
					onChanged();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			/** Check out the branch selected in the branch filter. */
			async function checkoutFilteredBranch() {
				if (dir === "" || branchFilter === "") return;
				setBusy(true);
				setError(null);
				setNotice(null);
				try {
					if (branchFilter.startsWith("remotes/")) {
						const outcome = await api.pullRemoteBranch(dir, branchFilter);
						setNotice(t("remoteBranch.pulled", { branch: outcome.branch }));
					} else {
						await api.checkout(dir, branchFilter);
						setNotice(t("branch.switched", { name: branchFilter }));
					}
					await refreshRows();
					onChanged();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			/** Pull the branch selected in the branch filter. When it is not checked
			*  out yet, switch to it first so the pull applies to that branch. */
			async function pullFilteredBranch() {
				if (dir === "" || branchFilter === "") return;
				setBusy(true);
				setError(null);
				setNotice(null);
				try {
					if (branchFilter.startsWith("remotes/")) {
						const outcome = await api.pullRemoteBranch(dir, branchFilter);
						setNotice(t("remoteBranch.pulled", { branch: outcome.branch }));
						await refreshRows();
						onChanged();
						return;
					}
					if (branchFilter !== currentBranch) await api.checkout(dir, branchFilter);
					const remote = (await api.remotes(dir))[0]?.name ?? "";
					if (remote === "") {
						setError(t("pull.noRemote"));
						return;
					}
					const outcome = await api.pull(dir, remote, branchFilter, "merge");
					if (outcome.kind === "conflicts") {
						await api.refreshStatus(dir);
						onOpenConflicts?.();
					} else if (outcome.kind === "already-up-to-date") setNotice(t("pull.upToDate"));
					else if (outcome.kind === "error") setError(outcome.message ?? t("pull.failed"));
					else setNotice(t("pull.done"));
					await refreshRows();
					onChanged();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			const localBranchOptions = branches.filter((b) => !b.startsWith("remotes/"));
			const remoteBranchOptions = branches.filter((b) => b.startsWith("remotes/"));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-history",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-history-tools",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								title: t("history.moreHint"),
								disabled: busy || dir === "",
								onClick: (event) => {
									const rect = event.currentTarget.getBoundingClientRect();
									setMoreMenu({
										x: rect.left,
										y: rect.bottom + 4
									});
								},
								children: "🔀"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: "gitui-dir",
								value: branchFilter,
								title: t("history.branch"),
								onChange: (event) => setBranchFilter(event.target.value),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t("history.allBranches")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
										label: t("branch.local"),
										children: localBranchOptions.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: name,
											children: name
										}, name))
									}),
									remoteBranchOptions.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
										label: t("branch.remote"),
										children: remoteBranchOptions.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: name,
											children: name
										}, name))
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: "gitui-dir",
								value: authorFilter,
								title: t("history.author"),
								onChange: (event) => setAuthorFilter(event.target.value),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: t("history.allAuthors")
								}), authors.map((author) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
									value: author.name,
									children: [
										author.name,
										" (",
										author.count,
										")"
									]
								}, author.name + "\0" + author.email))]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "gitui-dir",
								type: "date",
								value: sinceFilter,
								title: t("history.since"),
								onChange: (event) => setSinceFilter(event.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "gitui-dir",
								type: "date",
								value: untilFilter,
								title: t("history.until"),
								onChange: (event) => setUntilFilter(event.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "gitui-dir",
								value: query,
								placeholder: t("history.search"),
								spellCheck: false,
								onChange: (event) => setQuery(event.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "gitui-dir",
								value: filePathInput,
								placeholder: t("history.fileFilter"),
								spellCheck: false,
								onChange: (event) => setFilePathInput(event.target.value),
								onKeyDown: (event) => {
									if (event.key === "Enter") setFilePathFilter(filePathInput.trim() === "" ? null : filePathInput.trim());
								}
							}),
							filePathFilter !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "gitui-btn",
								onClick: () => {
									setFilePathFilter(null);
									setFilePathInput("");
								},
								children: ["✕ ", t("history.fileFilterClear")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								style: { marginLeft: "auto" },
								title: t("action.refresh"),
								onClick: () => {
									setRows(null);
									refreshRows();
								},
								children: t("action.refresh")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-history-layout",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-history-side",
								style: {
									width: splitWidth,
									minWidth: 0,
									maxWidth: "none"
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-history-list",
									children: [
										rows === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "gitui-diff-placeholder",
											children: "…"
										}),
										rows !== null && rows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "gitui-diff-placeholder",
											children: t("history.empty")
										}),
										rows !== null && filteredRows.map((row, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "gitui-log-row" + (row.hash === selectedHash ? " gitui-log-row-selected" : "") + (selectedCommits.includes(row.hash) ? " gitui-log-row-multi" : ""),
											onClick: (event) => onRowClick(event, row.hash, index),
											onContextMenu: (event) => {
												event.preventDefault();
												const hashes = selectedCommits.includes(row.hash) ? selectedCommits : [row.hash];
												setMenu({
													x: event.clientX,
													y: event.clientY,
													hashes
												});
											},
											onMouseEnter: (event) => showHover(event, row.hash),
											onMouseLeave: hideHover,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "gitui-log-graph",
													title: row.subject,
													children: row.graph.length === 0 ? " " : row.graph.map((char, index) => {
														const cls = "|/\\│├└┌┐┘┴┬┼╱╲".includes(char.ch) ? " gitui-graph-line" : "";
														return char.color !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: cls,
															style: { color: char.color },
															children: char.ch
														}, index) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: cls,
															children: char.ch
														}, index);
													})
												}),
												row.refs !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "gitui-log-refs",
													title: row.refs,
													children: row.refs.split(", ").slice(0, 2).join(", ")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "gitui-commit-subject",
													title: row.subject,
													children: row.subject
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "gitui-commit-meta",
													children: row.author
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "gitui-commit-meta",
													children: formatShortDate(row.date)
												})
											]
										}, row.hash))
									]
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Splitter, {
								width: splitWidth,
								onChange: onSplitWidth,
								onReset: onSplitReset,
								title: t("splitter.resize")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-history-detail",
								children: selectedHash === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-diff-placeholder",
									children: t("log.select")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CommitDetailPanel, {
									api,
									dir,
									hash: selectedHash,
									t,
									onChanged,
									diffFullscreen,
									onToggleDiffFullscreen: toggleDiffFullscreen,
									filesWidth,
									onFilesWidth: setFilesWidth,
									worktreeToggleRef: detailWorktreeRef
								})
							}),
							menu !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Menu, {
								x: menu.x,
								y: menu.y,
								items: commitMenuItems(menu.hashes),
								onClose: () => setMenu(null)
							}),
							moreMenu !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Menu, {
								x: moreMenu.x,
								y: moreMenu.y,
								items: [
									{
										label: t("history.checkoutBranch", { branch: branchFilter }),
										disabled: busy || branchFilter === "" || branchFilter === currentBranch,
										onClick: () => void checkoutFilteredBranch()
									},
									{
										label: t("history.pullBranch", { branch: branchFilter }),
										disabled: busy || branchFilter === "",
										onClick: () => void pullFilteredBranch()
									},
									{
										separator: true,
										label: ""
									},
									{
										label: t("history.mergeToCurrent", {
											from: branchFilter,
											to: currentBranch ?? ""
										}),
										disabled: busy || branchFilter === "" || !currentBranch || branchFilter === currentBranch,
										onClick: () => void mergeToCurrentBranch()
									},
									{
										label: t("history.rebaseToCurrent", {
											from: branchFilter,
											to: currentBranch ?? ""
										}),
										disabled: busy || branchFilter === "" || !currentBranch || branchFilter === currentBranch || branchFilter.startsWith("remotes/"),
										onClick: () => void rebaseToCurrentBranch()
									}
								],
								onClose: () => setMoreMenu(null)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
								message: error !== null ? error : notice,
								tone: error !== null ? "error" : "ok"
							})
						]
					}),
					hoverInfo !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gitui-hover-card",
						style: {
							left: Math.min(hoverInfo.x + 14, window.innerWidth - 400),
							top: Math.min(hoverInfo.y + 10, window.innerHeight - (hoverInfo.detail ? 340 : 30))
						},
						children: hoverInfo.detail === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "gitui-hover-more",
							children: "…"
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gitui-hover-card-body",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "gitui-hover-hash",
									children: hoverInfo.detail.short + " · " + hoverInfo.detail.hash
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-hover-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-hover-k",
										children: t("log.author")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-hover-v",
										children: hoverInfo.detail.author + (hoverInfo.detail.authorEmail !== "" ? " <" + hoverInfo.detail.authorEmail + ">" : "")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-hover-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-hover-k",
										children: t("log.authorDate")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-hover-v",
										children: formatDate(hoverInfo.detail.authorDate)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-hover-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-hover-k",
										children: t("log.committer")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-hover-v",
										children: hoverInfo.detail.committer
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-hover-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-hover-k",
										children: t("log.commitDate")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-hover-v",
										children: formatDate(hoverInfo.detail.committerDate)
									})]
								}),
								hoverInfo.detail.parents.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-hover-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-hover-k",
										children: t("log.parents")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-hover-v",
										children: hoverInfo.detail.parents.join(", ")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-hover-msg",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "gitui-commit-subject",
										children: hoverInfo.detail.subject
									}), hoverInfo.detail.body !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: hoverInfo.detail.body })]
								}),
								hoverInfo.detail.files.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-hover-files",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "gitui-hover-files-label",
											children: t("log.files") + " (" + hoverInfo.detail.files.length + ")"
										}),
										hoverInfo.detail.files.slice(0, 20).map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "gitui-hover-file",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "gitui-hover-st",
													children: STATUS_LABEL[file.status] ?? file.status
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "gitui-hover-path",
													children: file.path
												}),
												file.additions !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "gitui-hover-num",
													children: file.additions + " / -" + (file.deletions ?? 0)
												})
											]
										}, file.path)),
										hoverInfo.detail.files.length > 20 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "gitui-hover-more",
											children: t("log.showMore", { n: hoverInfo.detail.files.length - 20 })
										})
									]
								})
							]
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/components/StashView.tsx
		/**
		* Stash tab — a dedicated workspace for git stash:
		*  - create a stash (message + include untracked);
		*  - list every stash with message and date;
		*  - per stash: apply (keep), pop (apply + drop), show (file summary),
		*    create branch (and switch), drop;
		*  - clear everything (with confirmation).
		* Conflicts from apply/pop/branch are surfaced with a pointer to the Merge tab.
		*/
		function StashView(props) {
			const { api, dir, t, onChanged } = props;
			const [stashes, setStashes] = (0, react.useState)(null);
			const [message, setMessage] = (0, react.useState)("");
			const [includeUntracked, setIncludeUntracked] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [ok, setOk] = (0, react.useState)(null);
			/** Expanded "show" summary per stash index. */
			const [showFor, setShowFor] = (0, react.useState)(null);
			const [showLines, setShowLines] = (0, react.useState)(null);
			/** Inline "create branch" input per stash index. */
			const [branchFor, setBranchFor] = (0, react.useState)(null);
			const [branchName, setBranchName] = (0, react.useState)("");
			function load() {
				api.stashList(dir).then((list) => {
					setStashes(list);
					setShowFor((current) => current !== null && !list.some((s) => s.index === current) ? null : current);
					setBranchFor((current) => current !== null && !list.some((s) => s.index === current) ? null : current);
				}).catch((caught) => {
					setStashes([]);
					setError(caught.message);
				});
			}
			(0, react.useEffect)(() => {
				setStashes(null);
				setError(null);
				setOk(null);
				setShowFor(null);
				setBranchFor(null);
				load();
			}, [api, dir]);
			async function doStash() {
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					const outcome = await api.stashPush(dir, message, includeUntracked);
					if (!outcome.stashed) setOk(outcome.message ?? t("stash.nothing"));
					else {
						setOk(t("stash.done"));
						setMessage("");
						onChanged();
					}
					load();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			async function doApply(entry) {
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					const outcome = await api.stashApply(dir, entry.index);
					if (outcome.applied) {
						setOk(t("stash.applied", { index: entry.index }));
						onChanged();
					} else {
						setError(t("stash.applyConflicts", { n: outcome.conflicts?.length ?? 0 }));
						onChanged();
					}
					load();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			async function doPop(entry) {
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					const outcome = await api.stashPop(dir, entry.index);
					if (outcome.popped) setOk(t("stash.popped", { index: entry.index }));
					else setError(t("stash.popConflicts", { n: outcome.conflicts?.length ?? 0 }));
					onChanged();
					load();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			async function doDrop(entry) {
				if (!window.confirm(t("stash.dropConfirm", {
					index: entry.index,
					message: entry.message
				}))) return;
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					await api.stashDrop(dir, entry.index);
					setOk(t("stash.dropped", { index: entry.index }));
					load();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			async function doClear() {
				if (!window.confirm(t("stash.clearConfirm"))) return;
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					await api.stashClear(dir);
					setOk(t("stash.cleared"));
					load();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			async function doShow(entry) {
				if (showFor === entry.index) {
					setShowFor(null);
					setShowLines(null);
					return;
				}
				setShowFor(entry.index);
				setShowLines(null);
				try {
					setShowLines(await api.stashShow(dir, entry.index));
				} catch (caught) {
					setError(caught.message);
				}
			}
			async function doBranch(entry) {
				const name = branchName.trim();
				if (name === "") return;
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					await api.stashBranch(dir, entry.index, name);
					setOk(t("stash.branched", {
						index: entry.index,
						branch: name
					}));
					setBranchFor(null);
					setBranchName("");
					onChanged();
					load();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-detail",
				style: { minHeight: 220 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("stash.title") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							stashes !== null && stashes.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn gitui-btn-danger",
								disabled: busy,
								title: t("stash.clearHint"),
								onClick: () => void doClear(),
								children: t("stash.clear")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								disabled: busy || dir === "",
								onClick: load,
								children: t("action.refresh")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-stash-create",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "gitui-dir gitui-config-edit",
								value: message,
								placeholder: t("stash.message"),
								spellCheck: false,
								onChange: (event) => setMessage(event.target.value),
								onKeyDown: (event) => {
									if (event.key === "Enter") doStash();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "gitui-merge-option",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: includeUntracked,
									onChange: (event) => setIncludeUntracked(event.target.checked),
									disabled: busy
								}), t("stash.untracked")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn gitui-btn-primary",
								disabled: busy || dir === "",
								onClick: () => void doStash(),
								children: t("stash.action")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-config-scroll",
						children: [
							stashes === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: "…"
							}),
							stashes !== null && stashes.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: t("stash.empty")
							}),
							stashes !== null && stashes.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-stash-item",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "gitui-branch-row",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "gitui-commit-meta",
												children: ["stash@", entry.index]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "gitui-file-path",
												title: entry.message,
												children: entry.message
											}),
											entry.date !== void 0 && entry.date !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "gitui-commit-meta",
												children: entry.date.slice(0, 16)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "gitui-btn",
												disabled: busy,
												title: t("stash.applyHint"),
												onClick: () => void doApply(entry),
												children: t("stash.apply")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "gitui-btn",
												disabled: busy,
												title: t("stash.restore"),
												onClick: () => void doPop(entry),
												children: t("stash.restore")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "gitui-btn" + (showFor === entry.index ? " gitui-active" : ""),
												disabled: busy,
												title: t("stash.showHint"),
												onClick: () => void doShow(entry),
												children: t("stash.show")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "gitui-btn" + (branchFor === entry.index ? " gitui-active" : ""),
												disabled: busy,
												title: t("stash.branchHint"),
												onClick: () => {
													setBranchFor(branchFor === entry.index ? null : entry.index);
													setBranchName("");
												},
												children: t("stash.branch")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "gitui-btn gitui-btn-danger",
												disabled: busy,
												title: t("stash.drop"),
												onClick: () => void doDrop(entry),
												children: t("stash.drop")
											})
										]
									}),
									showFor === entry.index && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "gitui-stash-show",
										children: [
											showLines === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "gitui-diff-placeholder",
												children: "…"
											}),
											showLines !== null && showLines.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "gitui-commit-meta",
												children: t("stash.showEmpty")
											}),
											showLines !== null && showLines.map((line, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "gitui-stash-show-line",
												children: line
											}, i))
										]
									}),
									branchFor === entry.index && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "gitui-stash-create",
										style: { paddingLeft: 12 },
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "gitui-dir gitui-config-edit",
											value: branchName,
											placeholder: t("stash.branchPrompt"),
											spellCheck: false,
											autoFocus: true,
											onChange: (event) => setBranchName(event.target.value),
											onKeyDown: (event) => {
												if (event.key === "Enter") doBranch(entry);
												if (event.key === "Escape") setBranchFor(null);
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn gitui-btn-primary",
											disabled: busy || branchName.trim() === "",
											onClick: () => void doBranch(entry),
											children: t("stash.branch")
										})]
									})
								]
							}, entry.index))
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
						message: error !== null ? error : ok,
						tone: error !== null ? "error" : "ok"
					})
				]
			});
		}
		//#endregion
		//#region src/client/components/BranchesView.tsx
		/**
		* Branches tab — IDEA-style branch management: local branches with
		* checkout / rename / delete per row (delete first tries the safe -d and
		* offers a force path when the branch is not fully merged), remote branches
		* listed read-only, and a create-branch input based on the current HEAD.
		*/
		function BranchesView(props) {
			const { api, dir, t, onChanged, onOpenRebase, onOpenConflicts } = props;
			const [branches, setBranches] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [newBranch, setNewBranch] = (0, react.useState)("");
			/** Branch whose safe delete just failed with "not fully merged". */
			const [forceCandidate, setForceCandidate] = (0, react.useState)(null);
			/** Branch whose reset mode picker is open. */
			const [resetFor, setResetFor] = (0, react.useState)(null);
			/** Compare panel target + result. */
			const [compareFor, setCompareFor] = (0, react.useState)(null);
			const [compareFiles, setCompareFiles] = (0, react.useState)(null);
			const [compareError, setCompareError] = (0, react.useState)(null);
			/** Configured remote names (git remote), for the remote-area empty state. */
			const [configuredRemotes, setConfiguredRemotes] = (0, react.useState)([]);
			/** Tags. */
			const [tags, setTags] = (0, react.useState)([]);
			const [newTag, setNewTag] = (0, react.useState)("");
			/** Context menu on a branch row. */
			const [menu, setMenu] = (0, react.useState)(null);
			async function refresh() {
				setBranches(null);
				setError(null);
				try {
					const value = await api.branches(dir);
					setBranches(value.branches);
					setConfiguredRemotes(value.remotes);
				} catch (caught) {
					setError(caught.message);
				}
			}
			function loadTags() {
				api.tags(dir).then(setTags).catch(() => setTags([]));
			}
			(0, react.useEffect)(() => {
				refresh();
				loadTags();
			}, [api, dir]);
			function resetBranch(branch, mode) {
				setResetFor(null);
				const target = branch.current ? "HEAD" : branch.name;
				run(t("reset.done", {
					branch: branch.name,
					mode
				}), () => api.reset(dir, mode, target));
			}
			async function openCompare(branch) {
				if (compareFor === branch.name) {
					setCompareFor(null);
					setCompareFiles(null);
					return;
				}
				setCompareFor(branch.name);
				setCompareFiles(null);
				setCompareError(null);
				try {
					const current = (branches ?? []).find((b) => b.current);
					const from = branch.current ? branch.name : current?.name ?? "HEAD";
					const to = branch.current ? current?.name ?? "HEAD" : branch.name;
					setCompareFiles(await api.compare(dir, from, to));
				} catch (caught) {
					setCompareError(caught.message);
				}
			}
			async function createTag() {
				const name = newTag.trim();
				if (name === "") return;
				setNewTag("");
				await run(t("tag.created", { name }), () => api.tagCreate(dir, name));
				loadTags();
			}
			async function deleteTag(name) {
				if (!window.confirm(t("tag.deleteConfirm", { name }))) return;
				await run(t("tag.deleted", { name }), () => api.tagDelete(dir, name));
				loadTags();
			}
			function run(label, operation) {
				setBusy(true);
				setError(null);
				setNotice(null);
				return operation().then(async () => {
					setNotice(label);
					await refresh();
					onChanged();
				}).catch((caught) => {
					setError(caught.message);
				}).finally(() => setBusy(false));
			}
			/** IDEA-style branch context menu. */
			function branchMenuItems(branch) {
				const current = branch.current;
				return [
					{
						label: t("branch.checkout"),
						disabled: current,
						onClick: () => switchTo(branch.name)
					},
					{
						label: t("menu.newBranchFrom"),
						onClick: () => {
							const name = window.prompt(t("menu.newBranchFromPrompt"), "");
							if (name !== null && name.trim() !== "") run(t("branch.created", { name: name.trim() }), () => api.checkout(dir, name.trim(), true, branch.name));
						}
					},
					{
						label: t("menu.mergeIntoCurrent"),
						disabled: current,
						onClick: () => {
							run(t("merge.done", {
								short: "",
								subject: branch.name
							}), async () => {
								const outcome = await api.merge(dir, branch.name);
								if (outcome.kind === "conflicts") {
									await api.refreshStatus(dir);
									onOpenConflicts?.();
								} else if (outcome.kind === "error") setError(outcome.message ?? "无法开始合并");
							});
						}
					},
					{
						label: t("menu.rebaseCurrentOnto"),
						disabled: current,
						onClick: () => onOpenRebase?.(branch.name)
					},
					{
						separator: true,
						label: ""
					},
					{
						label: t("branch.rename"),
						disabled: current,
						onClick: () => renameBranch(branch)
					},
					{
						label: t("branch.delete"),
						danger: true,
						disabled: current,
						onClick: () => deleteBranch(branch)
					},
					{
						label: t("reset.action"),
						children: [
							"soft",
							"mixed",
							"hard"
						].map((mode) => ({
							label: mode,
							danger: mode === "hard",
							onClick: () => resetBranch(branch, mode)
						}))
					},
					{
						label: t("compare.action"),
						onClick: () => void openCompare(branch)
					}
				];
			}
			function switchTo(name) {
				run(t("branch.switched", { name }), () => api.checkout(dir, name));
			}
			function createBranch() {
				const name = newBranch.trim();
				if (name === "") return;
				setNewBranch("");
				run(t("branch.created", { name }), () => api.checkout(dir, name, true));
			}
			function renameBranch(branch) {
				const next = window.prompt(t("branch.renamePrompt"), branch.name);
				if (next === null) return;
				const name = next.trim();
				if (name === "" || name === branch.name) return;
				run(t("branch.renamed", {
					oldName: branch.name,
					newName: name
				}), () => api.renameBranch(dir, branch.name, name));
			}
			function deleteBranch(branch) {
				setForceCandidate(null);
				if (!window.confirm(t("branch.deleteConfirm", { name: branch.name }))) return;
				setBusy(true);
				setError(null);
				setNotice(null);
				api.deleteBranch(dir, branch.name, false).then(() => {
					setNotice(t("branch.deleted", { name: branch.name }));
					refresh();
					onChanged();
				}).catch((caught) => {
					const message = caught.message;
					setError(message);
					if (/未完全合并|not fully merged/i.test(message)) setForceCandidate(branch.name);
				}).finally(() => setBusy(false));
			}
			function forceDelete(branch) {
				run(t("branch.deleted", { name: branch.name }), () => api.deleteBranch(dir, branch.name, true));
			}
			const local = (branches ?? []).filter((branch) => !branch.name.startsWith("remotes/"));
			const remotes = (branches ?? []).filter((branch) => branch.name.startsWith("remotes/"));
			/** Name of the branch the compare starts from (the other side). */
			const compareFromName = (branch) => {
				const current = (branches ?? []).find((b) => b.current);
				if (branch.current) return current?.name ?? "HEAD";
				return current?.name ?? "HEAD";
			};
			const branchRow = (branch) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-branch-row",
				onContextMenu: (event) => {
					event.preventDefault();
					setMenu({
						x: event.clientX,
						y: event.clientY,
						branch
					});
				},
				children: [
					branch.current && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-current-tag",
						children: t("branch.current")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-file-path",
						title: branch.name,
						children: branch.name
					}),
					branch.upstream !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "gitui-commit-meta",
						children: ["→ ", branch.upstream]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
					!branch.current && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn",
							disabled: busy,
							onClick: () => switchTo(branch.name),
							children: t("branch.checkout")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn",
							disabled: busy,
							onClick: () => renameBranch(branch),
							children: t("branch.rename")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn",
							disabled: busy,
							title: t("reset.hint", { branch: branch.name }),
							onClick: () => setResetFor(resetFor === branch.name ? null : branch.name),
							children: t("reset.action")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn" + (compareFor === branch.name ? " gitui-active" : ""),
							disabled: busy,
							title: t("compare.hint", { branch: branch.name }),
							onClick: () => void openCompare(branch),
							children: t("compare.action")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn gitui-btn-danger",
							disabled: busy,
							onClick: () => deleteBranch(branch),
							children: t("branch.delete")
						})
					] }),
					forceCandidate === branch.name && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn gitui-btn-danger",
						disabled: busy,
						onClick: () => forceDelete(branch),
						children: t("branch.forceDelete")
					}),
					resetFor === branch.name && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-branch-new",
						style: { paddingLeft: 24 },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-merge-label",
								children: t("reset.pick")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								disabled: busy,
								onClick: () => resetBranch(branch, "soft"),
								children: "soft"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								disabled: busy,
								onClick: () => resetBranch(branch, "mixed"),
								children: "mixed"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn gitui-btn-danger",
								disabled: busy,
								onClick: () => resetBranch(branch, "hard"),
								children: "hard"
							})
						]
					}),
					compareFor === branch.name && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-compare-panel",
						children: [
							compareFiles === null && compareError === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: "…"
							}),
							compareError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-error",
								style: { padding: "4px 12px" },
								children: compareError
							}),
							compareFiles !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-compare-head",
								children: [
									t("compare.title", {
										from: compareFromName(branch),
										to: branch.name
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "gitui-commit-meta",
										children: [
											compareFiles.length,
											" ",
											t("compare.files")
										]
									})
								]
							}), compareFiles.map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-branch-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-file-status " + (file.status === "D" ? "gitui-st-deleted" : file.status === "A" ? "gitui-st-added" : "gitui-st-modified"),
										children: file.status || "M"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-file-path",
										title: file.path,
										children: file.path
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "gitui-numstat",
										children: [file.additions !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "gitui-num-add",
											children: ["+", file.additions]
										}), file.deletions !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "gitui-num-del",
											children: ["-", file.deletions]
										})]
									})
								]
							}, file.path))] })
						]
					})
				]
			}, branch.name);
			/** Check out the local counterpart of a remote branch and pull it. */
			async function pullRemote(remoteRef) {
				setBusy(true);
				setError(null);
				setNotice(null);
				try {
					const outcome = await api.pullRemoteBranch(dir, remoteRef);
					setNotice(t("remoteBranch.pulled", { branch: outcome.branch }));
					onChanged();
					await refresh();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			/** Fetch all configured remotes (git fetch) so remote branches refresh. */
			async function fetchRemotes() {
				setBusy(true);
				setError(null);
				setNotice(null);
				try {
					const outcome = await api.fetch(dir);
					setNotice(outcome.message ?? t("fetch.done"));
					onChanged();
					await refresh();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			/** Remote branch row: checkout to local + pull. No destructive ops. */
			const remoteRow = (branch) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-branch-row",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-remote-icon",
						children: "⇄"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-file-path",
						title: branch.name,
						children: branch.name.replace(/^remotes\//, "")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn",
						disabled: busy,
						title: t("branch.checkout"),
						onClick: () => switchTo(branch.name),
						children: t("branch.checkout")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn gitui-btn-primary",
						disabled: busy,
						title: t("remoteBranch.pullHint"),
						onClick: () => void pullRemote(branch.name),
						children: t("remoteBranch.pull")
					})
				]
			}, branch.name);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-detail",
				style: { minHeight: 220 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("branch.local") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-commit-meta",
								children: local.length
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								disabled: busy || dir === "",
								onClick: refresh,
								children: t("action.refresh")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
						message: error !== null ? error : notice,
						tone: error !== null ? "error" : "ok"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-branches-scroll",
						children: [
							branches === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: "…"
							}),
							branches !== null && local.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: t("branch.empty")
							}),
							local.map(branchRow)
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("branch.remote") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-commit-meta",
								children: remotes.length
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								disabled: busy || dir === "",
								title: t("remote.fetchHint"),
								onClick: () => void fetchRemotes(),
								children: t("remote.fetch")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-branches-scroll",
						children: [remotes.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-diff-placeholder",
							children: configuredRemotes.length === 0 ? t("branch.noRemotes") : t("branch.remoteEmpty")
						}), remotes.map(remoteRow)]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-branch-new",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							value: newBranch,
							placeholder: t("branch.createPrompt"),
							onChange: (event) => setNewBranch(event.target.value),
							onKeyDown: (event) => {
								if (event.key === "Enter") createBranch();
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn",
							disabled: busy || newBranch.trim() === "" || dir === "",
							onClick: createBranch,
							children: t("branch.create")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("tag.title") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-commit-meta",
								children: tags.length
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-branches-scroll",
						children: [
							tags.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								style: { padding: 8 },
								children: t("tag.empty")
							}),
							tags.map((tag) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-branch-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-commit-meta",
										children: "🏷"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-file-path",
										title: tag.subject,
										children: tag.name
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-commit-meta",
										children: tag.short
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "gitui-btn",
										disabled: busy,
										onClick: () => void deleteTag(tag.name),
										children: t("tag.delete")
									})
								]
							}, tag.name)),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-branch-new",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									value: newTag,
									placeholder: t("tag.createPrompt"),
									onChange: (event) => setNewTag(event.target.value),
									onKeyDown: (event) => {
										if (event.key === "Enter") createTag();
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "gitui-btn",
									disabled: busy || newTag.trim() === "",
									onClick: () => void createTag(),
									children: t("tag.create")
								})]
							})
						]
					}),
					menu !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Menu, {
						x: menu.x,
						y: menu.y,
						items: branchMenuItems(menu.branch),
						onClose: () => setMenu(null)
					})
				]
			});
		}
		//#endregion
		//#region src/client/components/CommitPlan.tsx
		/**
		* AI one-click commit planner: calls suggestCommits on mount, shows the
		* planned groups (editable messages + file lists), then executes them through
		* executeCommits with per-group progress and results.
		*/
		function CommitPlan(props) {
			const { api, dir, t, onDone, onCancel } = props;
			const [groups, setGroups] = (0, react.useState)(null);
			const [messages, setMessages] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [executing, setExecuting] = (0, react.useState)(false);
			const [progress, setProgress] = (0, react.useState)(0);
			const [results, setResults] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				api.suggestCommits(dir).then((planned) => {
					if (!alive) return;
					setGroups(planned);
					setMessages(planned.map((group) => group.message));
					setLoading(false);
				}).catch((caught) => {
					if (!alive) return;
					setError(caught.message);
					setLoading(false);
				});
				return () => {
					alive = false;
				};
			}, [api, dir]);
			async function execute() {
				if (groups === null) return;
				setExecuting(true);
				setError(null);
				const finalGroups = groups.map((group, index) => ({
					message: messages[index] ?? group.message,
					files: group.files
				}));
				const committed = [];
				try {
					for (let i = 0; i < finalGroups.length; i++) {
						setProgress(i + 1);
						const batch = await api.executeCommits(dir, [finalGroups[i]]);
						committed.push(...batch);
					}
					setResults(committed);
				} catch (caught) {
					setError(caught.message);
				} finally {
					setExecuting(false);
				}
			}
			if (loading) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-commit-plan",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-diff-placeholder",
					children: t("commit.analyzing")
				})
			});
			if (error !== null && groups === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-commit-plan",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-error",
					style: { padding: 12 },
					children: error
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-commit-plan-actions",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn",
						onClick: onCancel,
						children: t("commit.cancel")
					})
				})]
			});
			if (groups === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, {});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-commit-plan",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("commit.planTitle") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-commit-meta",
								children: t("commit.planDesc", { n: String(groups.length) })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							results === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								disabled: executing,
								onClick: onCancel,
								children: t("commit.cancel")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gitui-commit-plan-list",
						children: groups.map((group, index) => {
							const done = results !== null && index < results.length;
							const current = executing && progress === index + 1;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-plan-group" + (done ? " gitui-plan-group-done" : current ? " gitui-plan-group-current" : ""),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-plan-group-head",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gitui-plan-index",
											children: index + 1
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gitui-plan-files",
											children: group.files.map((file) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "gitui-plan-file",
												children: file
											}, file))
										}),
										done && results[index] !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gitui-plan-hash",
											children: results[index]?.short
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: "gitui-plan-message",
									value: messages[index] ?? "",
									disabled: executing || done,
									onChange: (event) => {
										setMessages((prev) => {
											const next = [...prev];
											next[index] = event.target.value;
											return next;
										});
									},
									spellCheck: false
								})]
							}, index);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
						message: error,
						tone: "error"
					}),
					results === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gitui-commit-plan-actions",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn gitui-btn-primary",
							disabled: executing,
							onClick: () => void execute(),
							children: executing ? t("commit.executing", {
								i: String(progress),
								n: String(groups.length)
							}) : t("commit.execute", { n: String(groups.length) })
						})
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-commit-plan-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, { message: t("commit.executed", { n: String(results.length) }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn gitui-btn-primary",
							onClick: () => onDone(results),
							children: t("commit.doneBtn")
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/components/RemoteView.tsx
		/**
		* Remotes tab — standalone management of git remotes: list, add, push the
		* current branch, and remove. Extracted from the History tab so remote
		* management lives on its own surface.
		*/
		function RemoteView(props) {
			const { api, dir, t, onChanged } = props;
			const [remotes, setRemotes] = (0, react.useState)(null);
			const [currentBranch, setCurrentBranch] = (0, react.useState)(null);
			const [adding, setAdding] = (0, react.useState)(false);
			const [name, setName] = (0, react.useState)("");
			const [url, setUrl] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [ok, setOk] = (0, react.useState)(null);
			/** Remote whose push form is open (null = closed). */
			const [pushFor, setPushFor] = (0, react.useState)(null);
			const [pushLocal, setPushLocal] = (0, react.useState)("");
			const [pushRemote, setPushRemote] = (0, react.useState)("");
			const [pushForce, setPushForce] = (0, react.useState)(false);
			/** Remote being renamed/reconfigured (null = closed). */
			const [editingFor, setEditingFor] = (0, react.useState)(null);
			const [editName, setEditName] = (0, react.useState)("");
			const [editUrl, setEditUrl] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				let alive = true;
				setError(null);
				setOk(null);
				Promise.all([api.remotes(dir), api.branches(dir)]).then(([list, branchData]) => {
					if (!alive) return;
					setRemotes(list);
					setCurrentBranch(branchData.current);
				}).catch((caught) => {
					if (alive) setError(caught.message);
				});
				return () => {
					alive = false;
				};
			}, [api, dir]);
			async function refresh() {
				try {
					setRemotes(await api.remotes(dir));
				} catch (caught) {
					setError(caught.message);
				}
			}
			async function addRemote() {
				const remoteName = name.trim();
				const remoteUrl = url.trim();
				if (remoteName === "" || remoteUrl === "") return;
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					await api.remoteAdd(dir, remoteName, remoteUrl);
					setName("");
					setUrl("");
					setAdding(false);
					try {
						await api.fetch(dir, remoteName);
					} catch (caught) {
						setError(caught.message);
						return;
					}
					setOk(t("remote.added", { name: remoteName }));
					onChanged();
					await refresh();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			async function removeRemote(remoteName) {
				if (!window.confirm(t("remote.removeConfirm", { name: remoteName }))) return;
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					await api.remoteRemove(dir, remoteName);
					setOk(t("remote.removed", { name: remoteName }));
					await refresh();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			/** Toggle the add form; prefill the name with "origin" when it is free. */
			function toggleAdding() {
				if (adding) {
					setAdding(false);
					return;
				}
				setAdding(true);
				if (remotes === null || remotes.some((remote) => remote.name === "origin")) setName("");
				else setName("origin");
			}
			function openEdit(remote) {
				setEditingFor(remote.name);
				setEditName(remote.name);
				setEditUrl(remote.url);
				setError(null);
				setOk(null);
			}
			async function saveEdit(oldName) {
				const newName = editName.trim();
				const newUrl = editUrl.trim();
				if (newName === "" || newUrl === "") return;
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					if (newName !== oldName) await api.remoteRename(dir, oldName, newName);
					await api.remoteSetUrl(dir, newName, newUrl);
					setEditingFor(null);
					setOk(t("remote.edited", { name: newName }));
					onChanged();
					await refresh();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			/** Open the push form for a remote, prefilled with the current branch. */
			function openPush(remote) {
				if (pushFor === remote) {
					setPushFor(null);
					return;
				}
				setPushFor(remote);
				setPushLocal(currentBranch ?? "");
				setPushRemote("");
				setPushForce(false);
				setError(null);
				setOk(null);
			}
			/** Push local -> remote branch (optionally force) to the given remote. */
			async function doPush(remote) {
				const local = pushLocal.trim();
				if (local === "") return;
				const target = pushRemote.trim();
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					await api.push(dir, remote, local, void 0, target === "" ? void 0 : target, pushForce);
					setOk(target === "" || target === local ? t("push.done", {
						branch: local,
						remote
					}) : t("push.doneTarget", {
						local,
						target,
						remote
					}));
					setPushFor(null);
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			/** Fetch the given remote so its branches show up locally. */
			async function fetchRemote(remote) {
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					const outcome = await api.fetch(dir, remote);
					setOk(outcome.message ?? t("fetch.done"));
					onChanged();
					await refresh();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-remotes-view",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("remote.title") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								disabled: busy,
								onClick: toggleAdding,
								children: adding ? t("action.close") : "+ " + t("remote.add")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
						message: error !== null ? error : ok,
						tone: error !== null ? "error" : "ok"
					}),
					adding && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-branch-new gitui-remote-add",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								value: name,
								placeholder: t("remote.name"),
								onChange: (event) => setName(event.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "gitui-remote-url-input",
								value: url,
								placeholder: t("remote.url"),
								onChange: (event) => setUrl(event.target.value),
								onKeyDown: (event) => {
									if (event.key === "Enter") addRemote();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn gitui-btn-primary",
								disabled: busy || name.trim() === "" || url.trim() === "",
								onClick: () => void addRemote(),
								children: t("remote.add")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-remotes-list",
						children: [
							remotes === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: "…"
							}),
							remotes !== null && remotes.length === 0 && !adding && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: t("remote.empty")
							}),
							remotes !== null && remotes.map((remote) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-branch-row",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gitui-file-path gitui-remote-name",
											children: remote.name
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gitui-remote-url",
											title: remote.pushUrl !== void 0 ? remote.pushUrl + " (push)" : remote.url,
											children: remote.pushUrl !== void 0 ? remote.pushUrl : remote.url
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn",
											disabled: busy,
											title: t("remote.fetchHint"),
											onClick: () => void fetchRemote(remote.name),
											children: t("remote.fetch")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn" + (pushFor === remote.name ? " gitui-active" : ""),
											disabled: busy || currentBranch === null,
											title: t("remote.pushHint", { branch: currentBranch ?? "…" }),
											onClick: () => openPush(remote.name),
											children: t("remote.push")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn",
											disabled: busy,
											title: t("remote.edit"),
											onClick: () => openEdit(remote),
											children: t("remote.edit")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn",
											disabled: busy,
											onClick: () => void removeRemote(remote.name),
											children: t("remote.remove")
										})
									]
								}, remote.name),
								pushFor === remote.name && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-push-form",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "gitui-push-input",
											value: pushLocal,
											placeholder: t("push.localPlaceholder"),
											onChange: (event) => setPushLocal(event.target.value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gitui-push-arrow",
											children: "→"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "gitui-push-input",
											value: pushRemote,
											placeholder: t("push.remotePlaceholder", { branch: pushLocal !== "" ? pushLocal : currentBranch ?? "" }),
											onChange: (event) => setPushRemote(event.target.value),
											onKeyDown: (event) => {
												if (event.key === "Enter") doPush(remote.name);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: "gitui-push-force",
											title: t("push.forceHint"),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: pushForce,
												onChange: (event) => setPushForce(event.target.checked)
											}), t("push.force")]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn gitui-btn-primary",
											disabled: busy || pushLocal.trim() === "",
											onClick: () => void doPush(remote.name),
											children: t("remote.push")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn",
											disabled: busy,
											onClick: () => setPushFor(null),
											children: t("action.close")
										})
									]
								}),
								editingFor === remote.name && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-branch-new gitui-remote-add",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											value: editName,
											placeholder: t("remote.name"),
											onChange: (event) => setEditName(event.target.value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "gitui-remote-url-input",
											value: editUrl,
											placeholder: t("remote.url"),
											onChange: (event) => setEditUrl(event.target.value),
											onKeyDown: (event) => {
												if (event.key === "Enter") saveEdit(remote.name);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn gitui-btn-primary",
											disabled: busy || editName.trim() === "" || editUrl.trim() === "",
											onClick: () => void saveEdit(remote.name),
											children: t("remote.save")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn",
											disabled: busy,
											onClick: () => setEditingFor(null),
											children: t("action.close")
										})
									]
								})
							] }))
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/components/ConfigView.tsx
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
		const SCOPES = [
			"local",
			"global",
			"system"
		];
		/** Extract the hostname of a remote URL ("https://github.com/x.git" or "git@host:x"). */
		function remoteHost(url) {
			if (url.startsWith("https://") || url.startsWith("http://")) try {
				return new URL(url).hostname.toLowerCase();
			} catch {
				return null;
			}
			const at = url.indexOf("@");
			const after = at >= 0 ? url.slice(at + 1) : url;
			const colon = after.indexOf(":");
			return (colon >= 0 ? after.slice(0, colon) : after).toLowerCase() || null;
		}
		/** Which hosting platform the remotes point at, for the auth guide. */
		function detectPlatform(remotes) {
			for (const remote of remotes) {
				const host = remoteHost(remote.url);
				if (host === null) continue;
				if (host === "github.com" || host === "www.github.com") return "github";
				if (host === "gitlab.com" || host.includes("gitlab")) return "gitlab";
			}
			for (const remote of remotes) if (remoteHost(remote.url) !== null) return "other";
			return null;
		}
		function ConfigView(props) {
			const { api, dir, t, onChanged } = props;
			/** Per-scope entries; null = still loading. */
			const [entries, setEntries] = (0, react.useState)({
				system: null,
				global: null,
				local: null
			});
			/** Editing target: `${scope}\u0000${key}` or null. */
			const [editing, setEditing] = (0, react.useState)(null);
			const [editValue, setEditValue] = (0, react.useState)("");
			/** Quick-add per scope. */
			const [newKey, setNewKey] = (0, react.useState)({
				system: "",
				global: "",
				local: ""
			});
			const [newValue, setNewValue] = (0, react.useState)({
				system: "",
				global: "",
				local: ""
			});
			/** Remotes of the repo, for the auth guide. */
			const [remotes, setRemotes] = (0, react.useState)([]);
			/** Real config-file path per scope (shown in the scope headers). */
			const [configFiles, setConfigFiles] = (0, react.useState)({
				system: "",
				global: "",
				local: ""
			});
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [ok, setOk] = (0, react.useState)(null);
			async function load() {
				if (dir === "") return;
				try {
					const [system, global, local, remotesValue] = await Promise.all([
						api.configList(dir, "system"),
						api.configList(dir, "global"),
						api.configList(dir, "local"),
						api.remotes(dir).catch(() => [])
					]);
					setEntries({
						system: system.entries,
						global: global.entries,
						local: local.entries
					});
					setConfigFiles({
						system: system.configFiles.system,
						global: global.configFiles.global,
						local: local.configFiles.local
					});
					setRemotes(remotesValue);
				} catch (caught) {
					setError(caught.message);
				}
			}
			(0, react.useEffect)(() => {
				setEntries({
					system: null,
					global: null,
					local: null
				});
				setError(null);
				setRemotes([]);
				load();
			}, [api, dir]);
			/** All values of a key across scopes (any level counts as configured). */
			function keyValues(key) {
				const out = [];
				for (const scope of SCOPES) for (const entry of entries[scope] ?? []) if (entry.key === key) out.push(entry.value);
				return out;
			}
			const userName = keyValues("user.name");
			const userEmail = keyValues("user.email");
			const missingIdentity = dir !== "" && (userName.length === 0 || userEmail.length === 0);
			const platform = detectPlatform(remotes);
			async function save(scope, key) {
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
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			async function removeEntry(scope, key) {
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					await api.configUnset(dir, scope, key);
					setOk(t("config.removed", { key }));
					onChanged();
					await load();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			async function addEntry(scope) {
				const key = newKey[scope].trim();
				if (key === "" || newValue[scope].trim() === "") return;
				setBusy(true);
				setError(null);
				setOk(null);
				try {
					await api.configSet(dir, scope, key, newValue[scope].trim());
					setOk(t("config.added", { key }));
					setNewKey((prev) => ({
						...prev,
						[scope]: ""
					}));
					setNewValue((prev) => ({
						...prev,
						[scope]: ""
					}));
					onChanged();
					await load();
				} catch (caught) {
					setError(caught.message);
				} finally {
					setBusy(false);
				}
			}
			const startEdit = (scope, entry) => {
				setEditing(scope + "\0" + entry.key);
				setEditValue(entry.value);
			};
			const scopeLabel = (scope) => scope === "system" ? t("config.scope.system") : scope === "global" ? t("config.scope.global") : t("config.scope.local");
			const scopeHint = (scope) => scope === "system" ? t("config.scope.systemHint") : scope === "global" ? t("config.scope.globalHint") : t("config.scope.localHint");
			/** Real config-file path of the scope (shown in the header). */
			const scopeFile = (scope) => configFiles[scope];
			const scopeSection = (scope) => {
				const list = entries[scope];
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-config-scope",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gitui-detail-header",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: scopeLabel(scope) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "gitui-commit-meta",
									children: list !== null ? list.length : "…"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "gitui-config-scope-hint",
									title: scopeHint(scope),
									children: scopeFile(scope) !== "" ? scopeFile(scope) : scopeHint(scope)
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							list === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: "…"
							}),
							list !== null && list.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								style: { padding: "2px 12px" },
								children: t("config.empty")
							}),
							list !== null && list.map((entry) => {
								const editId = scope + "\0" + entry.key;
								const isEditing = editing === editId;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "gitui-branch-row",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gitui-file-path gitui-config-key",
											title: entry.key,
											children: entry.key
										}),
										isEditing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "gitui-dir gitui-config-edit",
											value: editValue,
											autoFocus: true,
											spellCheck: false,
											onChange: (event) => setEditValue(event.target.value),
											onKeyDown: (event) => {
												if (event.key === "Enter") save(scope, entry.key);
												if (event.key === "Escape") setEditing(null);
											}
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "gitui-config-value",
											title: entry.value,
											children: entry.value
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
										isEditing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn",
											disabled: busy,
											onClick: () => void save(scope, entry.key),
											children: t("config.save")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn",
											onClick: () => setEditing(null),
											children: t("action.close")
										})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn",
											onClick: () => startEdit(scope, entry),
											children: t("config.edit")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "gitui-btn",
											title: t("config.removeHint"),
											disabled: busy,
											onClick: () => void removeEntry(scope, entry.key),
											children: t("config.remove")
										})] })
									]
								}, entry.key);
							})
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gitui-branch-new",
							style: { paddingLeft: 12 },
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "gitui-dir",
									value: newKey[scope],
									onChange: (event) => setNewKey((prev) => ({
										...prev,
										[scope]: event.target.value
									})),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t("config.addPrompt")
									}), COMMON_KEYS.map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: key,
										children: key
									}, key))]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "gitui-dir gitui-config-edit",
									value: newValue[scope],
									placeholder: t("config.valuePlaceholder"),
									spellCheck: false,
									onChange: (event) => setNewValue((prev) => ({
										...prev,
										[scope]: event.target.value
									})),
									onKeyDown: (event) => {
										if (event.key === "Enter") addEntry(scope);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "gitui-btn gitui-btn-primary",
									disabled: busy || newKey[scope] === "" || newValue[scope].trim() === "" || dir === "",
									onClick: () => void addEntry(scope),
									children: t("config.add")
								})
							]
						})
					]
				}, scope);
			};
			const authGuide = () => {
				if (dir === "" || platform === null) return null;
				const gitHub = platform === "github";
				const gitLab = platform === "gitlab";
				const tokenUrl = gitHub ? "https://github.com/settings/tokens" : gitLab ? "https://gitlab.com/-/user_settings/personal_access_tokens" : null;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-auth-guide" + (missingIdentity ? " gitui-auth-guide-warn" : ""),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-auth-guide-title",
							children: gitHub ? t("auth.github.title") : gitLab ? t("auth.gitlab.title") : t("auth.other.title")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-auth-guide-body",
							children: gitHub ? t("auth.github.body") : gitLab ? t("auth.gitlab.body") : t("auth.other.body")
						}),
						tokenUrl !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							className: "gitui-auth-guide-link",
							href: tokenUrl,
							target: "_blank",
							rel: "noreferrer",
							children: t("auth.openTokenPage")
						}),
						missingIdentity && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-auth-guide-missing",
							children: t("auth.missingIdentity", { name: userName.length === 0 ? "user.name" : "user.email" })
						})
					]
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-detail",
				style: { minHeight: 220 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("config.title") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-btn",
								disabled: busy || dir === "",
								onClick: () => void load(),
								children: t("action.refresh")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-config-scroll",
						children: [
							authGuide(),
							dir === "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: t("repo.placeholder")
							}),
							dir !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [SCOPES.map((scope) => scopeSection(scope)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-config-note",
								children: t("config.scope.note")
							})] })
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, {
						message: error !== null ? error : ok,
						tone: error !== null ? "error" : "ok"
					})
				]
			});
		}
		//#endregion
		//#region src/client/components/FileTreeView.tsx
		/**
		* FileTreeView — a git-independent directory tree for the panel's "Files"
		* tab: lazy-loading tree on the left, editable text preview on the right.
		* Supports creating, deleting, and editing text files (browse-only for
		* binary files). Everything is relative to the panel's current dir.
		*/
		/** IDEA-style chevron for tree disclosure (same paths as GroupChevron). */
		function Chevron(props) {
			const { down } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: "gitui-tree-chev",
				width: "12",
				height: "12",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				children: down === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M4.5 6 L8 9.5 L11.5 6",
					stroke: "currentColor",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M6 4.5 L9.5 8 L6 11.5",
					stroke: "currentColor",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function FileTreeView(props) {
			const { api, dir, t, splitWidth, onSplitWidth, onSplitReset, listHidden = false, onToggleListHidden, onChanged } = props;
			const [rootEntries, setRootEntries] = (0, react.useState)(null);
			const [children, setChildren] = (0, react.useState)(/* @__PURE__ */ new Map());
			const [expanded, setExpanded] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [selectedPath, setSelectedPath] = (0, react.useState)(null);
			const [fileContent, setFileContent] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			/** Brief "saved" feedback after a keystroke write lands (diff-editor style). */
			const [savedFlash, setSavedFlash] = (0, react.useState)(false);
			/** Autosave failure shown inline (keeps the editor visible, unlike open errors). */
			const [saveError, setSaveError] = (0, react.useState)(null);
			const listSeq = (0, react.useRef)(0);
			/** Serialized autosave queue — every keystroke writes to disk immediately. */
			const saveChainRef = (0, react.useRef)(Promise.resolve());
			const savedTimerRef = (0, react.useRef)(null);
			/** Bumped on every file switch / dir change; stale write completions skip state updates. */
			const openSeqRef = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				openSeqRef.current += 1;
				setRootEntries(null);
				setChildren(/* @__PURE__ */ new Map());
				setExpanded(/* @__PURE__ */ new Set());
				setSelectedPath(null);
				setFileContent(null);
				setDraft("");
				setError(null);
				setNotice(null);
				setSaveError(null);
				setSavedFlash(false);
				if (dir === "") return;
				let alive = true;
				api.listDir(dir).then((entries) => {
					if (!alive) return;
					setRootEntries(entries);
				}).catch((caught) => {
					if (!alive) return;
					setError(caught.message);
				});
				return () => {
					alive = false;
				};
			}, [api, dir]);
			async function loadChildren(path) {
				const seq = ++listSeq.current;
				try {
					const entries = await api.listDir(dir, path);
					if (seq !== listSeq.current) return;
					setChildren((prev) => {
						const next = new Map(prev);
						next.set(path, entries);
						return next;
					});
				} catch (caught) {
					setError(caught.message);
				}
			}
			function toggleDir(entry) {
				const path = entry.path;
				setExpanded((prev) => {
					const next = new Set(prev);
					if (next.has(path)) next.delete(path);
					else {
						next.add(path);
						loadChildren(path);
					}
					return next;
				});
			}
			async function openFile(entry) {
				await saveChainRef.current;
				openSeqRef.current += 1;
				setSelectedPath(entry.path);
				setError(null);
				setNotice(null);
				setSaveError(null);
				setSavedFlash(false);
				setFileContent(null);
				setDraft("");
				try {
					const content = await api.readFile(dir, entry.path);
					setFileContent(content);
					setDraft(content.binary ? "" : content.content);
				} catch (caught) {
					setError(caught.message);
				}
			}
			/** Every keystroke writes to disk immediately (serialized, no debounce). */
			const autosave = (text) => {
				if (selectedPath === null || fileContent === null || fileContent.binary || fileContent.truncated) return;
				const path = selectedPath;
				const seq = openSeqRef.current;
				setSavedFlash(false);
				setSaveError(null);
				saveChainRef.current = saveChainRef.current.then(async () => {
					await api.writeFile(dir, path, text);
					if (openSeqRef.current === seq) setFileContent((prev) => prev === null ? prev : {
						...prev,
						content: text
					});
				}).then(() => {
					if (openSeqRef.current === seq) flashSaved();
				}).catch((caught) => {
					if (openSeqRef.current === seq) setSaveError(caught.message);
				});
			};
			/** Brief "saved" feedback after the write-back lands. */
			const flashSaved = () => {
				setSavedFlash(true);
				if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current);
				savedTimerRef.current = setTimeout(() => setSavedFlash(false), 1200);
			};
			/** New file lives under the selected dir, else the selected file's dir, else root. */
			function newFile() {
				if (dir === "") return;
				let base = "";
				if (selectedPath !== null) {
					const lastSlash = selectedPath.lastIndexOf("/");
					base = lastSlash >= 0 ? selectedPath.slice(0, lastSlash) : "";
				}
				const name = window.prompt(t("files.newPrompt", { base: base === "" ? "/" : base }));
				if (name === null || name.trim() === "") return;
				const path = base === "" ? name.trim() : base + "/" + name.trim();
				setBusy(true);
				setError(null);
				setNotice(null);
				(async () => {
					try {
						await api.writeFile(dir, path, "");
						setNotice(t("files.created", { path }));
						const parent = base;
						if (parent === "") {
							const entries = await api.listDir(dir);
							setRootEntries(entries);
						} else {
							await loadChildren(parent);
							setExpanded((prev) => new Set(prev).add(parent));
						}
						setSelectedPath(path);
						const content = await api.readFile(dir, path);
						openSeqRef.current += 1;
						setFileContent(content);
						setDraft("");
					} catch (caught) {
						setError(caught.message);
					} finally {
						setBusy(false);
					}
				})();
			}
			/** Delete the selected file, or a directory tree after confirmation. */
			function removeSelected() {
				if (selectedPath === null) return;
				const isDir = expanded.has(selectedPath);
				const message = isDir ? t("files.deleteDirConfirm", { path: selectedPath }) : t("files.deleteConfirm", { path: selectedPath });
				if (!window.confirm(message)) return;
				setBusy(true);
				setError(null);
				setNotice(null);
				(async () => {
					try {
						await saveChainRef.current;
						await api.deleteFile(dir, selectedPath, isDir ? true : void 0);
						setNotice(t("files.deleted", { path: selectedPath }));
						setSelectedPath(null);
						setFileContent(null);
						setDraft("");
						const lastSlash = selectedPath.lastIndexOf("/");
						const parent = lastSlash >= 0 ? selectedPath.slice(0, lastSlash) : "";
						if (parent === "") {
							const entries = await api.listDir(dir);
							setRootEntries(entries);
						} else await loadChildren(parent);
					} catch (caught) {
						setError(caught.message);
					} finally {
						setBusy(false);
					}
				})();
			}
			async function refresh() {
				if (dir === "") return;
				setError(null);
				setNotice(null);
				try {
					const entries = await api.listDir(dir);
					setRootEntries(entries);
					setChildren(/* @__PURE__ */ new Map());
				} catch (caught) {
					setError(caught.message);
				}
			}
			/** Render one level of the tree (recursive through expanded dirs). */
			function renderLevel(entries, depth) {
				const out = [];
				for (const entry of entries) {
					const isDir = entry.kind === "dir";
					const isExpanded = isDir && expanded.has(entry.path);
					const childList = isDir ? children.get(entry.path) : void 0;
					const selected = entry.path === selectedPath;
					out.push(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-file" + (selected && !isDir ? " gitui-file-selected" : ""),
						style: { paddingLeft: 12 + depth * 14 },
						title: entry.path,
						onClick: () => {
							if (isDir) toggleDir(entry);
							else openFile(entry);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "gitui-tree-glyph",
							children: isDir ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: isExpanded ? "gitui-tree-chev-rot" : "",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { down: isExpanded })
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "gitui-tree-blank" })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "gitui-tree-name",
							children: isDir ? "📁 " + entry.name : "📄 " + entry.name
						})]
					}, entry.path));
					if (isDir && isExpanded) {
						if (childList === void 0) out.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-tree-loading",
							style: { paddingLeft: 26 + depth * 14 },
							children: "…"
						}, entry.path + ":loading"));
						else out.push(...renderLevel(childList, depth + 1));
					}
				}
				return out;
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-filetree",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-filetree-toolbar",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "gitui-filetree-dir",
							title: dir,
							children: dir === "" ? t("files.noDir") : dir
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn",
							disabled: dir === "" || busy,
							title: t("files.refresh"),
							onClick: () => void refresh(),
							children: "↻"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn",
							disabled: dir === "" || busy,
							onClick: newFile,
							children: t("files.new")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-btn gitui-btn-danger",
							disabled: dir === "" || busy || selectedPath === null,
							onClick: removeSelected,
							children: t("files.delete")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-filetree-body",
					children: [listHidden ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PaneRestoreBar, {
						title: t("pane.restore"),
						onRestore: () => onToggleListHidden?.()
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-pane-col",
						style: {
							width: splitWidth,
							flex: "none",
							maxWidth: "none",
							minWidth: 0
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PaneMinBar, {
							title: t("pane.collapse"),
							onNarrow: () => onToggleListHidden?.()
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-filetree-tree",
							style: {
								flex: 1,
								minHeight: 0,
								minWidth: 0,
								width: "100%"
							},
							children: dir === "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: t("files.noDir")
							}) : rootEntries === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: "…"
							}) : rootEntries.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: t("files.empty")
							}) : renderLevel(rootEntries, 0)
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Splitter, {
						width: splitWidth,
						onChange: onSplitWidth,
						onReset: onSplitReset,
						title: t("splitter.resize")
					})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-filetree-editor",
						children: [error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-error",
							children: error
						}) : fileContent === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-diff-placeholder",
							children: t("files.placeholder")
						}) : fileContent.binary ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-diff-placeholder",
							children: t("files.binary")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "gitui-filetree-editor-header",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "gitui-file-path",
									title: selectedPath ?? "",
									children: selectedPath
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
								fileContent.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "gitui-tree-warn",
									children: t("files.truncated")
								}),
								saveError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "gitui-error",
									children: saveError
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							className: "gitui-filetree-textarea",
							value: draft,
							spellCheck: false,
							disabled: busy,
							readOnly: fileContent.truncated,
							onChange: (event) => {
								const text = event.target.value;
								setDraft(text);
								autosave(text);
							},
							onBlur: () => {
								saveChainRef.current.then(() => onChanged?.());
							}
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, { message: savedFlash ? t("files.savedFlash") : notice })]
					})]
				})]
			});
		}
		//#endregion
		//#region src/client/components/GitPanel.tsx
		/**
		* GitPanel — the dock occupant: opened via the session-header Git action (no
		* collapsed bar is rendered while closed). A three-tab workspace (Changes /
		* Merge / History) with a file list + diff viewer + commit form, IDEA-style.
		*
		* The panel has a FIXED user-resizable height (drag the bottom handle) — it
		* never auto-resizes with content. The title bar carries window controls
		* (minimize / fullscreen / close); the panel can also detach into a floating
		* window (drag the title bar) like an IDE tool window.
		*/
		const STATUS_GLYPH = {
			added: "A",
			modified: "M",
			deleted: "D",
			renamed: "R",
			copied: "C",
			typechange: "T",
			unmerged: "U"
		};
		const STATUS_CLASS = {
			added: "gitui-st-added",
			modified: "gitui-st-modified",
			deleted: "gitui-st-deleted",
			renamed: "gitui-st-modified",
			copied: "gitui-st-modified",
			typechange: "gitui-st-modified",
			unmerged: "gitui-st-unmerged"
		};
		/** Compact a long path for the titlebar input: keep only the tail segments
		*  (e.g. C:/a/b/c/d → …/c/d). The full path stays in the title tooltip. */
		function shortenPath(path, maxSegments = 2) {
			if (path === "") return path;
			const parts = path.split(/[\\/]/).filter((part) => part !== "");
			if (parts.length <= maxSegments + 1) return path;
			return "…/" + parts.slice(-maxSegments).join("/");
		}
		/** Measure the host conversation's content area for resize clamping:
		*  the header/tabs bottom (top) and the composer input-card top (bottom). */
		function measureContentBounds() {
			const seat = document.querySelector("[data-composer-seat]");
			const root = seat?.parentElement?.parentElement;
			const header = root?.querySelector(":scope > header") ?? root?.querySelector("header");
			const card = document.querySelector("[data-composer-card]") ?? seat?.querySelector("[data-composer-card]");
			return {
				top: header?.getBoundingClientRect().bottom ?? 0,
				bottom: card?.getBoundingClientRect().top ?? window.innerHeight
			};
		}
		function FileRow(props) {
			const { file, selected, primary = false, t, onSelect, actions, displayName, depth = 0, checked, onToggleChecked, onContextMenu } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-file" + (selected ? " gitui-file-selected" : "") + (primary ? " gitui-file-primary" : ""),
				onClick: onSelect,
				onContextMenu,
				title: file.path,
				style: { paddingLeft: 12 + depth * 14 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "checkbox",
						className: "gitui-check",
						checked: checked !== false,
						title: t("tree.check"),
						onChange: (event) => {
							event.stopPropagation();
							onToggleChecked?.();
						},
						onClick: (event) => event.stopPropagation()
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-file-status " + (STATUS_CLASS[file.status] ?? ""),
						children: STATUS_GLYPH[file.status] ?? "?"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-file-path",
						children: displayName ?? file.path
					}),
					actions?.map((action) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-file-action" + (action.danger === true ? " gitui-btn-danger" : ""),
						title: action.title ?? action.label,
						onClick: (event) => {
							event.stopPropagation();
							action.run();
						},
						children: action.label
					}, action.label))
				]
			});
		}
		/** Build a sorted directory tree (directories first, then files, both by name). */
		function buildTree(files) {
			const roots = [];
			const byPath = /* @__PURE__ */ new Map();
			const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
			for (const file of sorted) {
				const parts = file.path.split("/");
				let level = roots;
				let acc = "";
				for (let i = 0; i < parts.length; i++) {
					const part = parts[i] ?? "";
					acc = acc === "" ? part : `${acc}/${part}`;
					if (i === parts.length - 1) level.push({
						name: part,
						path: acc,
						children: null,
						file
					});
					else {
						let node = byPath.get(acc);
						if (node === void 0) {
							node = {
								name: part,
								path: acc,
								children: [],
								file: null
							};
							byPath.set(acc, node);
							level.push(node);
						}
						level = node.children;
					}
				}
			}
			const sortLevel = (nodes) => {
				nodes.sort((a, b) => {
					return (a.children !== null ? 0 : 1) - (b.children !== null ? 0 : 1) || a.name.localeCompare(b.name);
				});
				for (const node of nodes) if (node.children !== null) sortLevel(node.children);
			};
			sortLevel(roots);
			return roots;
		}
		/** Collect every directory path in the tree (for expand/collapse-all). */
		function collectDirs(nodes, into = []) {
			for (const node of nodes) if (node.children !== null) {
				into.push(node.path);
				collectDirs(node.children, into);
			}
			return into;
		}
		/** IDEA-style tree arrow: solid triangle, down when expanded, right when collapsed. */
		function TreeArrow(props) {
			const { expanded } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: "gitui-dir-arrow",
				width: "12",
				height: "12",
				viewBox: "0 0 12 12",
				"aria-hidden": "true",
				children: expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M2.6 4.2 L6 8.2 L9.4 4.2 Z",
					fill: "currentColor"
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M4.2 2.6 L8.2 6 L4.2 9.4 Z",
					fill: "currentColor"
				})
			});
		}
		/**
		* IDEA expand-all / collapse-all glyphs (copied from IntelliJ IDEA's official
		* expandAll.svg / collapseAll.svg): two stroked chevrons — pointing right for
		* expand, pointing down for collapse.
		*/
		function GroupChevron(props) {
			const { down } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: "gitui-group-chev",
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				children: down === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M4.5 2.5 L8 6 L11.5 2.5",
					stroke: "currentColor",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M4.5 13.5 L8 10 L11.5 13.5",
					stroke: "currentColor",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M4.5 5.5 L8 2 L11.5 5.5",
					stroke: "currentColor",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M4.5 10.5 L8 14 L11.5 10.5",
					stroke: "currentColor",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})] })
			});
		}
		/** Fixed row height shared by every tree row (kept in sync with the CSS). */
		const ROW_HEIGHT = 24;
		/** Flatten a tree into rows, skipping collapsed subtrees entirely.
		*  Collapse keys are scoped per group (changelist), so the same directory in
		*  two changelists folds independently. */
		function flattenTreeRows(nodes, collapsed, out, group, depth = 0) {
			for (const node of nodes) if (node.children === null) out.push({
				key: `f:${group}:${node.path}`,
				kind: "file",
				file: node.file,
				displayName: node.name,
				depth
			});
			else {
				const ckey = group + "\0" + node.path;
				out.push({
					key: `d:${group}:${node.path}`,
					kind: "dir",
					node,
					depth,
					collapseKey: ckey
				});
				if (!collapsed.has(ckey)) flattenTreeRows(node.children, collapsed, out, group, depth + 1);
			}
		}
		/** Fixed-height windowed list: renders only the viewport slice + buffer. */
		function VirtualRows(props) {
			const { rows, rowHeight, renderRow, style } = props;
			const scrollRef = (0, react.useRef)(null);
			const [scrollTop, setScrollTop] = (0, react.useState)(0);
			const [viewport, setViewport] = (0, react.useState)(0);
			(0, react.useLayoutEffect)(() => {
				const el = scrollRef.current;
				if (el === null) return;
				const update = () => setViewport(el.clientHeight);
				update();
				const observer = new ResizeObserver(update);
				observer.observe(el);
				return () => observer.disconnect();
			}, []);
			const total = rows.length * rowHeight;
			const buffer = 10;
			const start = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
			const end = Math.min(rows.length, Math.ceil((scrollTop + viewport) / rowHeight) + buffer);
			const slice = rows.slice(start, end);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: scrollRef,
				className: "gitui-files",
				style,
				onScroll: (event) => setScrollTop(event.currentTarget.scrollTop),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						height: total,
						position: "relative"
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							position: "absolute",
							top: start * rowHeight,
							left: 0,
							right: 0
						},
						children: slice.map(renderRow)
					})
				})
			});
		}
		/** IDEA refresh glyph (refresh.svg): two circular arrows with arrowheads. */
		function RefreshIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "gitui-group-chev",
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M2.5 9 V8 C2.5 4.96243 4.96243 2.5 8 2.5 C9.10679 2.5 10.1372 2.82692 11 3.38947",
						stroke: "currentColor",
						strokeLinecap: "round"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M5 12.6105 C5.86278 13.1731 6.89321 13.5 8 13.5 C11.0376 13.5 13.5 11.0376 13.5 8 V7",
						stroke: "currentColor",
						strokeLinecap: "round"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M0.49997 7.50027 L2.5 9.5 L4.49998 7.50023",
						stroke: "currentColor",
						strokeLinecap: "round"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M11.5 8.49982 L13.5 6.5 L15.5 8.49982",
						stroke: "currentColor",
						strokeLinecap: "round"
					})
				]
			});
		}
		function TitleRow(props) {
			const { row, t, onExpandAll, onCollapseAll, onRefresh, onMenu } = props;
			const dirs = row.dirs ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-group-title",
				style: { height: ROW_HEIGHT },
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					title: row.changelist,
					children: [row.title, row.changelist !== void 0 && row.changelist !== "Default" ? "" : ""]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "gitui-group-actions",
					children: [
						onMenu !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-group-menu-btn",
							title: t("menu.more"),
							onClick: onMenu,
							children: "⋮"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							title: t("tree.refresh"),
							onClick: onRefresh,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RefreshIcon, {})
						}),
						dirs.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							title: t("tree.expandAll"),
							onClick: () => onExpandAll(dirs),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GroupChevron, {})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							title: t("tree.collapseAll"),
							onClick: () => onCollapseAll(dirs),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GroupChevron, { down: true })
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "gitui-group-count",
							children: row.count
						})
					]
				})]
			});
		}
		function DirRow(props) {
			const { row, collapsed, onToggleDir, actions, checked, onToggleChecked, onContextMenu, t } = props;
			const node = row.node;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-dir-node",
				style: {
					height: ROW_HEIGHT,
					paddingLeft: 4 + row.depth * 14
				},
				onClick: () => onToggleDir(row.collapseKey ?? row.key),
				onContextMenu,
				title: node.path,
				role: "button",
				tabIndex: 0,
				onKeyDown: (event) => {
					if (event.key === "Enter" || event.key === " ") onToggleDir(row.collapseKey ?? row.key);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "checkbox",
						className: "gitui-check",
						checked: checked === true,
						title: t("tree.check"),
						onChange: (event) => {
							event.stopPropagation();
							onToggleChecked?.();
						},
						onClick: (event) => event.stopPropagation()
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreeArrow, { expanded: row.collapseKey !== void 0 && !collapsed.has(row.collapseKey) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-dir-name",
						children: node.name
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-dir-count",
						children: node.children.length
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
					actions?.map((action) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-file-action" + (action.danger === true ? " gitui-btn-danger" : ""),
						title: action.title ?? action.label,
						onClick: (event) => {
							event.stopPropagation();
							action.run();
						},
						children: action.label
					}, action.label))
				]
			});
		}
		/** Window-level drag helper: tracks a mousemove delta until mouseup. */
		function startDrag(startClientX, startClientY, onMove) {
			const onMouseMove = (event) => {
				onMove(event.clientX - startClientX, event.clientY - startClientY);
			};
			const onMouseUp = () => {
				window.removeEventListener("mousemove", onMouseMove);
				window.removeEventListener("mouseup", onMouseUp);
				document.body.style.userSelect = "";
			};
			document.body.style.userSelect = "none";
			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);
		}
		function GitPanel(props) {
			const { t, api, useSessions, useWorkspaces } = props;
			const snapshot = useGitUi();
			const { open, dir, followSession, floating, fullscreen, panelHeight, floatPos, floatMaximized, floatWidth, status, statusLoading, statusError, statusErrorCode, fontScale, recentDirs } = snapshot;
			const [dirDraft, setDirDraft] = (0, react.useState)(dir);
			const [tab, setTab] = (0, react.useState)("changes");
			const [selectedPath, setSelectedPath] = (0, react.useState)(null);
			/** Multi-select of changed-file paths (Ctrl/Cmd toggle, Shift range). */
			const [selectedPaths, setSelectedPaths] = (0, react.useState)([]);
			/** Anchor path for Shift+click range selection. */
			const [anchorPath, setAnchorPath] = (0, react.useState)(null);
			/** "Get from revision" dialog state (the target selected paths). */
			const [getFromRevision, setGetFromRevision] = (0, react.useState)(null);
			const [diffFiles, setDiffFiles] = (0, react.useState)(null);
			const [diffLoading, setDiffLoading] = (0, react.useState)(false);
			const [diffError, setDiffError] = (0, react.useState)(null);
			/** Whitespace flags of the currently displayed diff (independent toggles). */
			const [wsFlags, setWsFlags] = (0, react.useState)(NO_WS_FLAGS);
			/**
			* Partial-commit hunk checkboxes per file: hunk indices the user un-checked.
			* `total` is the hunk count of the last loaded diff for that path; indices
			* are reset whenever the count changes (hunk boundaries shifted).
			*/
			const [uncheckedHunks, setUncheckedHunks] = (0, react.useState)(/* @__PURE__ */ new Map());
			const [busy, setBusy] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(null);
			/** Which titlebar quick-op dropdown is open ("pull" | "stash" | null). */
			const [commitPlanOpen, setCommitPlanOpen] = (0, react.useState)(false);
			const [commitPlanResults, setCommitPlanResults] = (0, react.useState)(null);
			/** Context menu state (file/dir/group rows). */
			const [menu, setMenu] = (0, react.useState)(null);
			/** Push preview dialog. */
			const [pushOpen, setPushOpen] = (0, react.useState)(false);
			/** Clone repository dialog. */
			const [cloneOpen, setCloneOpen] = (0, react.useState)(false);
			/** Interactive rebase dialog. */
			const [rebaseOpen, setRebaseOpen] = (0, react.useState)(false);
			const [rebaseBaseHint, setRebaseBaseHint] = (0, react.useState)("");
			/** History tab file filter requested from a context menu. */
			const [historyFileFilter, setHistoryFileFilter] = (0, react.useState)(null);
			/** Changelist membership (per-repo, .git/dsh/changelists.json). */
			const [changelists, setChangelists] = (0, react.useState)([]);
			const [activeChangelist, setActiveChangelist] = (0, react.useState)("Default");
			/** DiffView's inline-write flush handle (menu mutations await it). */
			const diffFlushRef = (0, react.useRef)(null);
			/** Diff-only mode for the Changes tab: hides the file list and commit box
			* so the diff fills the panel (panel goes fullscreen too). */
			const [changesDiffFullscreen, setChangesDiffFullscreen] = (0, react.useState)(false);
			/** The changes directory pane is hidden (− button); show the restore strip. */
			const [changesListHidden, setChangesListHidden] = (0, react.useState)(false);
			/** Same for the Files tab tree (kept here so it survives tab switches). */
			const [filesListHidden, setFilesListHidden] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!fullscreen && changesDiffFullscreen) setChangesDiffFullscreen(false);
			}, [fullscreen, changesDiffFullscreen]);
			(0, react.useEffect)(() => {
				if (tab !== "changes" && changesDiffFullscreen) {
					setChangesDiffFullscreen(false);
					gitUiSetFullscreen(false);
				}
			}, [tab, changesDiffFullscreen]);
			const toggleChangesDiffFullscreen = () => {
				const next = !changesDiffFullscreen;
				setChangesDiffFullscreen(next);
				gitUiSetFullscreen(next);
			};
			const loadChangelists = () => {
				if (dir === "") return;
				api.changelistList(dir).then((value) => {
					setChangelists(value.changelists);
					setActiveChangelist(value.active);
				}).catch(() => setChangelists([]));
			};
			(0, react.useEffect)(() => {
				loadChangelists();
			}, [api, dir]);
			function commitPlanDone(results) {
				setCommitPlanResults(results);
				setCommitPlanOpen(false);
				api.refreshStatus(dir);
			}
			const [titleBranches, setTitleBranches] = (0, react.useState)({
				local: [],
				remote: []
			});
			/** Configured remotes of the repo (pull/push availability). */
			const [remotes, setRemotes] = (0, react.useState)([]);
			/** Stash count for the tab badge. */
			const [stashesCount, setStashesCount] = (0, react.useState)(0);
			const [collapsedDirs, setCollapsedDirs] = (0, react.useState)(/* @__PURE__ */ new Set());
			const toggleDir = (key) => {
				setCollapsedDirs((prev) => {
					const next = new Set(prev);
					if (next.has(key)) next.delete(key);
					else next.add(key);
					return next;
				});
			};
			const expandDirs = (dirs) => {
				if (dirs.length === 0) return;
				setCollapsedDirs((prev) => {
					const next = new Set(prev);
					for (const dir of dirs) next.delete(dir);
					return next;
				});
			};
			const collapseDirs = (dirs) => {
				if (dirs.length === 0) return;
				setCollapsedDirs((prev) => {
					const next = new Set(prev);
					for (const dir of dirs) next.add(dir);
					return next;
				});
			};
			const changeRows = (0, react.useMemo)(() => {
				if (status === null) return [];
				const rows = [];
				const listOf = (path) => {
					for (const entry of changelists) if (entry.paths.includes(path)) return entry.name;
					return activeChangelist;
				};
				const byList = /* @__PURE__ */ new Map();
				const seenPaths = /* @__PURE__ */ new Set();
				const addFile = (file) => {
					if (seenPaths.has(file.path)) return;
					seenPaths.add(file.path);
					const name = listOf(file.path);
					const arr = byList.get(name);
					if (arr === void 0) byList.set(name, [file]);
					else arr.push(file);
				};
				for (const file of status.staged) addFile(file);
				for (const file of status.unstaged) addFile(file);
				for (const path of status.untracked) addFile({
					path,
					status: "added"
				});
				const names = [...byList.keys()].sort((a, b) => a === "Default" ? -1 : b === "Default" ? 1 : a.localeCompare(b));
				for (const name of names) {
					const files = byList.get(name) ?? [];
					const group = "cl:" + name;
					const tree = buildTree(files);
					const dirs = collectDirs(tree).map((dir) => group + "\0" + dir);
					rows.push({
						key: `t:${group}`,
						kind: "title",
						title: name,
						count: files.length,
						dirs,
						depth: 0,
						changelist: name
					});
					flattenTreeRows(tree, collapsedDirs, rows, group);
				}
				return rows;
			}, [
				status,
				collapsedDirs,
				t,
				changelists,
				activeChangelist
			]);
			const filePathsInOrder = (0, react.useMemo)(() => changeRows.filter((row) => row.kind === "file").map((row) => row.file.path), [changeRows]);
			const dirAgg = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				const addToAncestors = (path, key) => {
					const parts = path.split("/");
					let acc = "";
					for (let i = 0; i < parts.length - 1; i++) {
						acc = acc === "" ? parts[i] : acc + "/" + parts[i];
						let entry = map.get(acc);
						if (entry === void 0) {
							entry = {
								staged: [],
								unstaged: [],
								untracked: [],
								all: []
							};
							map.set(acc, entry);
						}
						entry[key].push(path);
						entry.all.push(path);
					}
				};
				for (const file of status?.staged ?? []) addToAncestors(file.path, "staged");
				for (const file of status?.unstaged ?? []) addToAncestors(file.path, "unstaged");
				for (const path of status?.untracked ?? []) addToAncestors(path, "untracked");
				return map;
			}, [status]);
			const [uncheckedPaths, setUncheckedPaths] = (0, react.useState)(/* @__PURE__ */ new Set());
			const allChangedPaths = (0, react.useMemo)(() => {
				const paths = /* @__PURE__ */ new Set();
				for (const file of status?.staged ?? []) paths.add(file.path);
				for (const file of status?.unstaged ?? []) paths.add(file.path);
				for (const path of status?.untracked ?? []) paths.add(path);
				return paths;
			}, [status]);
			const toggleChecked = (path) => {
				setUncheckedPaths((prev) => {
					const next = new Set(prev);
					if (next.has(path)) next.delete(path);
					else next.add(path);
					return next;
				});
			};
			const toggleDirChecked = (paths) => {
				if (paths.length === 0) return;
				setUncheckedPaths((prev) => {
					const next = new Set(prev);
					const allChecked = paths.every((p) => !next.has(p));
					for (const p of paths) if (allChecked) next.add(p);
					else next.delete(p);
					return next;
				});
			};
			const checkedPaths = (0, react.useMemo)(() => {
				const paths = [];
				for (const path of allChangedPaths) if (!uncheckedPaths.has(path)) paths.push(path);
				return paths;
			}, [allChangedPaths, uncheckedPaths]);
			/** Context menu for a file or directory (all files under a dir). */
			function changeMenuItems(paths, label, ignorePath) {
				const tracked = paths.some((p) => (status?.staged ?? []).some((f) => f.path === p) || (status?.unstaged ?? []).some((f) => f.path === p));
				const staged = paths.some((p) => (status?.staged ?? []).some((f) => f.path === p));
				const allTracked = paths.length > 0 && paths.every((p) => (status?.staged ?? []).some((f) => f.path === p) || (status?.unstaged ?? []).some((f) => f.path === p));
				const ignoreTarget = ignorePath ?? paths[0] ?? "";
				const ignoreNotice = tracked ? t("menu.ignoredTracked") : t("menu.ignored");
				return [
					{
						label: t("menu.showDiff"),
						onClick: () => void selectFile({
							path: paths[0] ?? "",
							status: "modified"
						})
					},
					...allTracked ? [{
						label: t("getFromRevision.title"),
						onClick: () => setGetFromRevision({ paths })
					}] : [],
					...tracked && !staged ? [{
						label: t("menu.stage"),
						onClick: () => void runMutation(t("menu.stage"), () => api.stage(dir, paths))
					}] : [],
					...staged ? [{
						label: t("menu.unstage"),
						onClick: () => void runMutation(t("menu.unstage"), () => api.unstage(dir, paths))
					}] : [],
					tracked ? {
						label: t("menu.rollback"),
						danger: true,
						onClick: () => {
							if (window.confirm(t("discard.confirm", { path: label }))) runMutation(t("action.discard"), () => api.discard(dir, paths, true));
						}
					} : {
						label: t("action.track"),
						onClick: () => void runMutation(t("action.track"), () => api.stage(dir, paths))
					},
					{
						label: t("menu.ignore"),
						children: [{
							label: ".gitignore",
							onClick: () => void runMutation(ignoreNotice, () => api.ignoreAdd(dir, ignoreTarget, "gitignore"))
						}, {
							label: ".git/info/exclude",
							onClick: () => void runMutation(ignoreNotice, () => api.ignoreAdd(dir, ignoreTarget, "exclude"))
						}]
					},
					{
						label: t("menu.showHistory"),
						onClick: () => {
							setHistoryFileFilter(paths[0] ?? null);
							setTab("history");
						}
					},
					{
						label: t("menu.moveTo"),
						children: changelists.map((entry) => ({
							label: entry.name + (entry.name === activeChangelist ? " ✓" : ""),
							onClick: () => void runMutation(t("changelist.moved"), () => api.changelistMove(dir, paths, entry.name))
						}))
					},
					{
						label: t("menu.copyPath"),
						onClick: () => {
							navigator.clipboard?.writeText(paths[0] ?? "").catch(() => {});
						}
					}
				];
			}
			/** Group-header menu: manage the changelist itself. */
			function changelistMenuItems(name) {
				return [
					{
						label: t("changelist.new"),
						onClick: () => {
							const input = window.prompt(t("changelist.newPrompt"), "");
							if (input !== null && input.trim() !== "") runMutation(t("changelist.created"), () => api.changelistCreate(dir, input.trim()));
						}
					},
					{
						label: t("changelist.setActive"),
						disabled: name === activeChangelist,
						onClick: () => void runMutation(t("changelist.activated"), () => api.changelistSetActive(dir, name))
					},
					{
						label: t("changelist.moveCheckedHere"),
						disabled: checkedPaths.length === 0,
						onClick: () => void runMutation(t("changelist.moved"), () => api.changelistMove(dir, checkedPaths, name))
					},
					{
						separator: true,
						label: ""
					},
					{
						label: t("changelist.rename"),
						disabled: name === "Default",
						onClick: () => {
							const input = window.prompt(t("changelist.renamePrompt"), name);
							if (input !== null && input.trim() !== "" && input.trim() !== name) runMutation(t("changelist.renamed"), () => api.changelistRename(dir, name, input.trim()));
						}
					},
					{
						label: t("changelist.delete"),
						danger: true,
						disabled: name === "Default",
						onClick: () => {
							if (window.confirm(t("changelist.deleteConfirm", { name }))) runMutation(t("changelist.deleted"), () => api.changelistDelete(dir, name));
						}
					}
				];
			}
			const renderChangeRow = (row) => {
				if (row.kind === "title") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TitleRow, {
					row,
					t,
					onExpandAll: expandDirs,
					onCollapseAll: collapseDirs,
					onRefresh: () => void refresh(),
					onMenu: row.changelist !== void 0 ? (event) => {
						event.preventDefault();
						event.stopPropagation();
						setMenu({
							x: event.clientX,
							y: event.clientY,
							items: changelistMenuItems(row.changelist)
						});
					} : void 0
				}, row.key);
				if (row.kind === "dir") {
					const dirPath = row.node.path;
					const agg = dirAgg.get(dirPath);
					const dirFiles = agg?.all ?? [];
					const dirChecked = dirFiles.length > 0 && dirFiles.every((p) => !uncheckedPaths.has(p));
					const actions = [];
					if (agg !== void 0) {
						if (agg.untracked.length > 0) actions.push({
							label: t("action.track"),
							run: () => void runMutation(t("action.track"), () => api.stage(dir, agg.untracked))
						});
						const tracked = [...agg.staged, ...agg.unstaged];
						if (tracked.length > 0) actions.push({
							label: t("action.discard"),
							danger: true,
							run: () => {
								if (!window.confirm(t("discard.confirm", { path: dirPath }))) return;
								runMutation(t("action.discard"), () => api.discard(dir, tracked, true));
							}
						});
					}
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DirRow, {
						row,
						collapsed: collapsedDirs,
						onToggleDir: toggleDir,
						actions,
						checked: dirChecked,
						onToggleChecked: () => toggleDirChecked(dirFiles),
						onContextMenu: (event) => {
							event.preventDefault();
							if (dirFiles.length > 0) setMenu({
								x: event.clientX,
								y: event.clientY,
								items: changeMenuItems(dirFiles, dirPath, dirPath)
							});
						},
						t
					}, row.key);
				}
				const file = row.file;
				const tracked = status !== null && (status.staged.some((item) => item.path === file.path) || status.unstaged.some((item) => item.path === file.path));
				const actions = [];
				if (tracked) actions.push({
					label: t("action.discard"),
					title: t("action.discardWhole"),
					danger: true,
					run: () => {
						if (!window.confirm(t("discard.confirm", { path: file.path }))) return;
						runMutation(t("action.discard"), () => api.discard(dir, [file.path], true));
					}
				});
				else actions.push({
					label: t("action.track"),
					run: () => void runMutation(t("action.track"), () => api.stage(dir, [file.path]))
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileRow, {
					file,
					displayName: row.displayName,
					selected: selectedPaths.includes(file.path),
					primary: selectedPath === file.path,
					t,
					onSelect: (event) => selectFile(file, event),
					actions,
					depth: row.depth,
					checked: !uncheckedPaths.has(file.path),
					onToggleChecked: () => toggleChecked(file.path),
					onContextMenu: (event) => {
						event.preventDefault();
						const paths = selectedPaths.includes(file.path) ? selectedPaths : [file.path];
						setMenu({
							x: event.clientX,
							y: event.clientY,
							items: changeMenuItems(paths, file.path)
						});
					}
				}, row.key);
			};
			const sessionCwd = useSessions !== void 0 ? useSessions((state) => state.byId[state.current ?? ""]?.cwd ?? "") : "";
			(0, react.useEffect)(() => {
				if (!followSession || sessionCwd === "") return;
				gitUiFollowCwd(sessionCwd);
			}, [sessionCwd]);
			const [sessionRepoOptions, setSessionRepoOptions] = (0, react.useState)([]);
			(0, react.useEffect)(() => {
				if (sessionCwd === "") {
					setSessionRepoOptions([]);
					return;
				}
				let alive = true;
				(async () => {
					try {
						const root = (await api.repos([sessionCwd]))[0]?.root ?? null;
						if (!alive) return;
						if (root === sessionCwd) {
							setSessionRepoOptions([]);
							return;
						}
						const repos = await api.findRepos(sessionCwd, 3);
						if (!alive) return;
						setSessionRepoOptions(repos);
					} catch {
						if (alive) setSessionRepoOptions([]);
					}
				})();
				return () => {
					alive = false;
				};
			}, [api, sessionCwd]);
			const workspaceDirs = useWorkspaces !== void 0 ? useWorkspaces((state) => state.items.map((item) => item.path)) : [];
			const dirOptions = Array.from(new Set([
				...workspaceDirs,
				...sessionCwd !== "" ? [sessionCwd] : [],
				...sessionRepoOptions,
				...dir !== "" ? [dir] : [],
				...recentDirs
			].filter((path) => path !== "")));
			const [dirMenuOpen, setDirMenuOpen] = (0, react.useState)(false);
			const [dirEditing, setDirEditing] = (0, react.useState)(false);
			const dirInputRef = (0, react.useRef)(null);
			const displayValue = dirEditing ? dirDraft : shortenPath(dirDraft);
			const filteredDirs = dirDraft !== dir ? dirOptions.filter((path) => path.toLowerCase().includes(dirDraft.toLowerCase())) : dirOptions;
			(0, react.useEffect)(() => {
				setDirDraft(dir);
			}, [dir]);
			(0, react.useEffect)(() => {
				if (dir === "") return;
				let alive = true;
				(async () => {
					try {
						const loaded = await api.status(dir);
						if (!alive) return;
						gitUiSetStatus(loaded, null);
					} catch (caught) {
						if (!alive) return;
						const message = caught.message;
						try {
							const root = (await api.repos([dir]))[0]?.root ?? null;
							if (!alive) return;
							if (root !== null && root !== dir) {
								gitUiSetDir(root);
								return;
							}
						} catch {}
						gitUiSetStatus(null, message, caught.code ?? null);
					}
				})();
				return () => {
					alive = false;
				};
			}, [api, dir]);
			(0, react.useEffect)(() => {
				if (tab === "changes" && dir !== "") refresh();
			}, [
				tab,
				api,
				dir
			]);
			(0, react.useEffect)(() => {
				if (open && tab === "changes" && dir !== "") refresh();
			}, [open]);
			(0, react.useEffect)(() => {
				if (dir === "") {
					setRemotes([]);
					return;
				}
				let alive = true;
				api.remotes(dir).then((list) => {
					if (alive) setRemotes(list);
				}).catch(() => {
					if (alive) setRemotes([]);
				});
				api.stashList(dir).then((list) => {
					if (alive) setStashesCount(list.length);
				}).catch(() => {
					if (alive) setStashesCount(0);
				});
				return () => {
					alive = false;
				};
			}, [api, dir]);
			(0, react.useEffect)(() => {
				if (dir === "" || status === null) return;
				let alive = true;
				api.branches(dir).then((value) => {
					if (!alive) return;
					setTitleBranches({
						local: value.branches.filter((branch) => !branch.name.startsWith("remotes/")).map((branch) => branch.name),
						remote: value.branches.filter((branch) => branch.name.startsWith("remotes/")).map((branch) => branch.name)
					});
				}).catch(() => {
					if (alive) setTitleBranches({
						local: [],
						remote: []
					});
				});
				return () => {
					alive = false;
				};
			}, [
				api,
				dir,
				status?.branch
			]);
			/** Check out a branch picked in the title-bar switcher. */
			async function switchTitleBranch(name) {
				if (name === "" || name === status?.branch) return;
				setBusy(true);
				setNotice(null);
				try {
					if (name.startsWith("remotes/")) {
						const outcome = await api.pullRemoteBranch(dir, name);
						setNotice(t("remoteBranch.pulled", { branch: outcome.branch }));
					} else {
						await api.checkout(dir, name);
						setNotice(t("branch.switched", { name }));
					}
					await api.refreshStatus(dir);
				} catch (caught) {
					setNotice(caught.message);
				} finally {
					setBusy(false);
				}
			}
			/** Pull the current branch from the first remote — one click, no dialog. */
			async function doPullNow() {
				if (dir === "" || status === null || status.branch === null || remotes.length === 0) return;
				setBusy(true);
				setNotice(null);
				try {
					const outcome = await api.pull(dir, remotes[0].name, status.branch, "merge");
					if (outcome.kind === "already-up-to-date") setNotice(t("pull.upToDate"));
					else if (outcome.kind === "conflicts") setNotice(t("pull.conflicts", { n: outcome.conflicts?.length ?? 0 }));
					else if (outcome.kind === "error") setNotice(outcome.message ?? t("pull.failed"));
					else setNotice(t("pull.done"));
					await api.refreshStatus(dir);
					if (outcome.kind === "conflicts") setTab("merge");
				} catch (caught) {
					setNotice(caught.message);
				} finally {
					setBusy(false);
				}
			}
			const conflicts = status?.conflicts ?? [];
			const totalChanges = (status?.staged?.length ?? 0) + (status?.unstaged?.length ?? 0) + (status?.untracked?.length ?? 0);
			const panelWidth = floating && !fullscreen ? floatWidth : window.innerWidth;
			const splitMax = Math.max(120, panelWidth - 260);
			const changesSplit = Math.min(snapshot.splitWidths.changes, splitMax);
			const fileTreeSplit = Math.min(snapshot.splitWidths.files, splitMax);
			const historySplit = Math.min(snapshot.splitWidths.history, splitMax);
			const filesStyle = {
				width: changesSplit,
				flex: "none",
				maxWidth: "none",
				minWidth: 0
			};
			/** Inner scroll area of the directory pane: fills the pane column below the bar. */
			const listInnerStyle = {
				flex: 1,
				minHeight: 0,
				minWidth: 0,
				width: "100%",
				maxWidth: "none"
			};
			async function refresh() {
				if (dir === "") return;
				await api.refreshStatus(dir);
				loadChangelists();
				if (selectedPath !== null) loadDiff(selectedPath);
			}
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (!open) return;
					const target = event.target;
					const tag = target?.tagName ?? "";
					if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable === true) return;
					const mod = event.ctrlKey || event.metaKey;
					const key = event.key.toLowerCase();
					if (mod && !event.shiftKey && !event.altKey && key === "k") {
						event.preventDefault();
						document.querySelector("[data-git-ui-root] .gitui-commit textarea")?.focus();
					} else if (mod && event.shiftKey && !event.altKey && key === "k") {
						event.preventDefault();
						setPushOpen(true);
					} else if (mod && event.altKey && key === "a") {
						event.preventDefault();
						if (selectedPath !== null) runMutation(t("menu.stage"), () => api.stage(dir, [selectedPath]));
					} else if (mod && event.altKey && key === "z") {
						event.preventDefault();
						if (selectedPath !== null && window.confirm(t("discard.confirm", { path: selectedPath }))) runMutation(t("action.discard"), () => api.discard(dir, [selectedPath], true));
					} else if (mod && !event.shiftKey && !event.altKey && key === "d") {
						event.preventDefault();
						setTab("changes");
					}
				};
				window.addEventListener("keydown", onKey, true);
				return () => window.removeEventListener("keydown", onKey, true);
			});
			/** Run `git init` in the current dir, then reload the status. */
			async function runInit() {
				if (dir === "") return;
				setBusy(true);
				setNotice(null);
				try {
					await api.init(dir);
					setNotice(t("repo.gitInitDone"));
					await api.refreshStatus(dir);
				} catch (caught) {
					setNotice(caught.message);
				} finally {
					setBusy(false);
				}
			}
			/** Ask the shared LLM to analyze the project and update `.gitignore`. */
			async function runSuggestGitignore() {
				if (dir === "") return;
				setBusy(true);
				setNotice(null);
				try {
					const result = await api.suggestGitignore(dir);
					setNotice(result.changed ? t("gitignore.updated") : t("gitignore.unchanged"));
					await api.refreshStatus(dir);
				} catch (caught) {
					setNotice(caught.message);
				} finally {
					setBusy(false);
				}
			}
			/** Load the working-tree vs HEAD diff for one file (IDEA-style). */
			async function loadDiff(path, flags = wsFlags, silent = false) {
				if (dir === "") return;
				if (!silent) setDiffLoading(true);
				setDiffError(null);
				try {
					const files = await api.diff(dir, path, void 0, flags);
					setDiffFiles(files);
					const total = files.length > 0 ? files[0].hunks.length : 0;
					setUncheckedHunks((prev) => {
						const entry = prev.get(path);
						if (entry !== void 0 && entry.total === total) return prev;
						const next = new Map(prev);
						next.set(path, {
							total,
							unchecked: /* @__PURE__ */ new Set()
						});
						return next;
					});
				} catch (caught) {
					setDiffFiles(null);
					setDiffError(caught.message);
				} finally {
					setDiffLoading(false);
				}
			}
			/** Switch the whitespace flags and reload the selected file's diff. */
			function changeWsFlags(next) {
				setWsFlags(next);
				if (selectedPath !== null) loadDiff(selectedPath, next);
			}
			/** Toggle one hunk's commit checkbox (partial commit). */
			function toggleHunk(path, hunkIndex) {
				setUncheckedHunks((prev) => {
					const entry = prev.get(path);
					if (entry === void 0) return prev;
					const unchecked = new Set(entry.unchecked);
					if (unchecked.has(hunkIndex)) unchecked.delete(hunkIndex);
					else unchecked.add(hunkIndex);
					const next = new Map(prev);
					next.set(path, {
						...entry,
						unchecked
					});
					return next;
				});
			}
			/** Hunk-level commit selections derived from the checkboxes. */
			const partialCommits = (0, react.useMemo)(() => {
				const list = [];
				for (const path of checkedPaths) {
					const entry = uncheckedHunks.get(path);
					if (entry === void 0 || entry.total === 0) continue;
					const checked = [];
					for (let i = 0; i < entry.total; i++) if (!entry.unchecked.has(i)) checked.push(i);
					if (checked.length > 0 && checked.length < entry.total) list.push({
						path,
						hunks: checked,
						...wsFlagsActive(wsFlags) ? { wsFlags } : {}
					});
				}
				return list;
			}, [
				uncheckedHunks,
				checkedPaths,
				wsFlags
			]);
			function selectFile(file, event) {
				const path = file.path;
				if (event !== void 0 && (event.ctrlKey || event.metaKey)) {
					setSelectedPaths((prev) => prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]);
					setAnchorPath(path);
					setSelectedPath(path);
					loadDiff(path);
				} else if (event !== void 0 && event.shiftKey) {
					const anchor = anchorPath ?? path;
					const ia = filePathsInOrder.indexOf(anchor);
					const ib = filePathsInOrder.indexOf(path);
					const sel = ia >= 0 && ib >= 0 ? filePathsInOrder.slice(Math.min(ia, ib), Math.max(ia, ib) + 1) : [path];
					setSelectedPaths(sel);
					setAnchorPath(path);
					setSelectedPath(path);
					loadDiff(path);
				} else {
					setSelectedPaths([path]);
					setAnchorPath(path);
					setSelectedPath(path);
					loadDiff(path);
					if (!fullscreen) gitUiSetFullscreen(true);
				}
			}
			async function runMutation(successLabel, operation) {
				setBusy(true);
				setNotice(null);
				try {
					if (diffFlushRef.current !== null) await diffFlushRef.current();
					await operation();
					setNotice(successLabel);
					await api.refreshStatus(dir);
					loadChangelists();
					if (selectedPath !== null) loadDiff(selectedPath);
				} catch (caught) {
					setNotice(caught.message);
				} finally {
					setBusy(false);
				}
			}
			const stageAll = () => {
				const paths = [...status?.unstaged.map((file) => file.path) ?? [], ...status?.untracked ?? []];
				if (paths.length === 0) return;
				runMutation(t("action.stageAll"), () => api.stage(dir, paths));
			};
			const startResize = (event) => {
				event.preventDefault();
				let baseHeight = panelHeight;
				if (floatMaximized) {
					gitUiSetFloatMaximized(false);
					gitUiSetFloatPos(8, 8);
					baseHeight = Math.min(720, Math.max(240, window.innerHeight - 16));
					gitUiSetPanelHeight(baseHeight);
				}
				const bounds = measureContentBounds();
				const maxHeight = Math.max(240, Math.min(720, bounds.bottom - bounds.top));
				startDrag(0, event.clientY, (_dx, dy) => gitUiSetPanelHeight(Math.min(baseHeight - dy, maxHeight)));
			};
			/** Shared clamp: keep the floating window inside the viewport. */
			const clampFloat = (x, width) => {
				const minX = 8;
				const viewportWidth = window.innerWidth;
				const maxWidth = Math.max(360, viewportWidth - 16);
				const clampedWidth = Math.min(MAX_WIDTH, Math.max(360, width), maxWidth);
				const maxX = Math.max(368, viewportWidth - 8);
				return {
					x: Math.min(maxX - clampedWidth, Math.max(minX, x)),
					width: clampedWidth
				};
			};
			const startResizeLeft = (event) => {
				event.preventDefault();
				let baseX = floatPos.x;
				let baseWidth = floatWidth;
				const baseY = floatMaximized ? 8 : floatPos.y;
				if (floatMaximized) {
					gitUiSetFloatMaximized(false);
					gitUiSetFloatPos(8, 8);
					baseX = 8;
					baseWidth = Math.min(MAX_WIDTH, Math.max(360, window.innerWidth - 16));
					gitUiSetFloatWidth(baseWidth);
				}
				startDrag(event.clientX, event.clientY, (dx) => {
					const { x, width } = clampFloat(baseX + dx, baseWidth - dx);
					gitUiSetFloatPos(x, baseY);
					gitUiSetFloatWidth(width);
				});
			};
			const startResizeRight = (event) => {
				event.preventDefault();
				let baseWidth = floatWidth;
				const baseY = floatMaximized ? 8 : floatPos.y;
				if (floatMaximized) {
					gitUiSetFloatMaximized(false);
					gitUiSetFloatPos(8, 8);
					baseWidth = Math.min(MAX_WIDTH, Math.max(360, window.innerWidth - 16));
					gitUiSetFloatWidth(baseWidth);
				}
				startDrag(event.clientX, event.clientY, (dx) => {
					const { x, width } = clampFloat(floatPos.x, baseWidth + dx);
					gitUiSetFloatPos(x, baseY);
					gitUiSetFloatWidth(width);
				});
			};
			const startMove = (event) => {
				event.preventDefault();
				const maximized = floatMaximized === true;
				const baseX = maximized ? 8 : floatPos.x;
				const baseY = maximized ? 8 : floatPos.y;
				let restored = !maximized;
				startDrag(event.clientX, event.clientY, (dx, dy) => {
					if (!restored) {
						if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
						restored = true;
						gitUiSetFloatMaximized(false);
						gitUiSetFloatPos(8, 8);
					}
					const maxY = Math.max(8, window.innerHeight - 64 - 8);
					const { x } = clampFloat(baseX + dx, floatWidth);
					gitUiSetFloatPos(x, Math.min(maxY, Math.max(8, baseY + dy)));
				});
			};
			/** Shared expanded-panel content (toolbar + tabs + body). */
			const content = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				statusError !== null && statusErrorCode === "not-a-repo" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-notrepo",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "gitui-notrepo-text",
						children: t("repo.notRepo", { dir })
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn gitui-btn-primary",
						disabled: busy || dir === "",
						onClick: () => void runInit(),
						children: t("action.gitInit")
					})]
				}) : statusError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-error",
					children: statusError
				}) : null,
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toast, { message: notice }),
				commitPlanOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CommitPlan, {
					api,
					dir,
					t,
					onDone: commitPlanDone,
					onCancel: () => setCommitPlanOpen(false)
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-tabs",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "gitui-tab" + (tab === "changes" ? " gitui-tab-active" : ""),
							onClick: () => {
								if (tab === "changes") refresh();
								else setTab("changes");
							},
							children: [t("tabs.changes"), totalChanges > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-tab-count",
								children: totalChanges
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-tab" + (tab === "files" ? " gitui-tab-active" : ""),
							onClick: () => setTab("files"),
							children: t("tabs.files")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "gitui-tab" + (tab === "merge" ? " gitui-tab-active" : ""),
							onClick: () => setTab("merge"),
							children: [t("tabs.merge"), conflicts.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-tab-count",
								children: conflicts.length
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-tab" + (tab === "history" ? " gitui-tab-active" : ""),
							onClick: () => setTab("history"),
							children: t("tabs.history")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-tab" + (tab === "branches" ? " gitui-tab-active" : ""),
							onClick: () => setTab("branches"),
							children: t("tabs.branches")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "gitui-tab" + (tab === "stash" ? " gitui-tab-active" : ""),
							onClick: () => setTab("stash"),
							children: [t("tabs.stash"), stashesCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "gitui-tab-count",
								children: stashesCount
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-tab" + (tab === "remotes" ? " gitui-tab-active" : ""),
							onClick: () => setTab("remotes"),
							children: t("tabs.remotes")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "gitui-tab" + (tab === "config" ? " gitui-tab-active" : ""),
							onClick: () => setTab("config"),
							children: t("tabs.config")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "gitui-body",
					children: tab === "files" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileTreeView, {
						api,
						dir,
						t,
						splitWidth: fileTreeSplit,
						onSplitWidth: (width) => gitUiSetSplitWidth("files", width),
						onSplitReset: () => gitUiSetSplitWidth("files", SPLIT_DEFAULTS.files),
						listHidden: filesListHidden,
						onToggleListHidden: () => setFilesListHidden((hidden) => !hidden),
						onChanged: () => void api.refreshStatus(dir)
					}) : tab === "merge" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MergeView, {
						api,
						dir,
						status,
						t,
						onChanged: () => void api.refreshStatus(dir),
						onOpenRebase: (base) => {
							setRebaseBaseHint(base ?? "");
							setRebaseOpen(true);
						}
					}) : tab === "history" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HistoryView, {
						api,
						dir,
						t,
						onChanged: () => void api.refreshStatus(dir),
						splitWidth: historySplit,
						onSplitWidth: (width) => gitUiSetSplitWidth("history", width),
						onSplitReset: () => gitUiSetSplitWidth("history", SPLIT_DEFAULTS.history),
						fileFilterInit: historyFileFilter,
						onFileFilterConsumed: () => setHistoryFileFilter(null),
						fullscreen,
						currentBranch: status?.branch ?? null,
						onOpenRebase: (base) => {
							setRebaseBaseHint(base ?? "");
							setRebaseOpen(true);
						},
						onOpenConflicts: () => setTab("merge")
					}) : tab === "branches" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BranchesView, {
						api,
						dir,
						t,
						onChanged: () => void api.refreshStatus(dir),
						onOpenRebase: (base) => {
							setRebaseBaseHint(base ?? "");
							setRebaseOpen(true);
						},
						onOpenConflicts: () => setTab("merge")
					}) : tab === "stash" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StashView, {
						api,
						dir,
						t,
						onChanged: () => {
							api.refreshStatus(dir);
							api.stashList(dir).then((list) => setStashesCount(list.length)).catch(() => {});
						}
					}) : tab === "remotes" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RemoteView, {
						api,
						dir,
						t,
						onChanged: () => void api.refreshStatus(dir)
					}) : tab === "config" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfigView, {
						api,
						dir,
						t,
						onChanged: () => void api.refreshStatus(dir)
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [!changesDiffFullscreen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: changesListHidden ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PaneRestoreBar, {
						title: t("pane.restore"),
						onRestore: () => setChangesListHidden(false)
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [dir === "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-pane-col",
						style: filesStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PaneMinBar, {
							title: t("pane.collapse"),
							onNarrow: () => setChangesListHidden(true)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-files",
							style: listInnerStyle,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: t("repo.placeholder")
							})
						})]
					}) : status !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-pane-col",
						style: filesStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PaneMinBar, {
							title: t("pane.collapse"),
							onNarrow: () => setChangesListHidden(true)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VirtualRows, {
							rows: changeRows,
							rowHeight: ROW_HEIGHT,
							renderRow: renderChangeRow,
							style: listInnerStyle
						})]
					}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Splitter, {
						width: changesSplit,
						onChange: (width) => gitUiSetSplitWidth("changes", width),
						onReset: () => gitUiSetSplitWidth("changes", SPLIT_DEFAULTS.changes),
						title: t("splitter.resize")
					})] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-detail",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "gitui-detail-header",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "gitui-file-path",
										children: selectedPath ?? ""
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "gitui-btn" + (changesDiffFullscreen ? " gitui-active" : ""),
										title: changesDiffFullscreen ? t("win.exitFullscreen") : t("win.fullscreen"),
										onClick: toggleChangesDiffFullscreen,
										children: changesDiffFullscreen ? "🗗" : "⛶"
									})
								]
							}),
							diffLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-diff-placeholder",
								children: "…"
							}) : diffError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "gitui-error",
								children: diffError
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffView, {
								file: diffFiles !== null && diffFiles.length > 0 ? diffFiles[0] : null,
								t,
								leftLabel: selectedPath !== null && (status?.head === null || (status?.untracked ?? []).includes(selectedPath)) ? t("diff.emptyTree") : "HEAD",
								rightLabel: t("diff.worktree"),
								interactive: true,
								api,
								dir,
								path: selectedPath ?? void 0,
								wsFlags,
								onWsFlagsChange: changeWsFlags,
								imageRefs: {
									left: "HEAD",
									right: void 0
								},
								hasStagedChanges: selectedPath !== null && (status?.staged ?? []).some((item) => item.path === selectedPath),
								hunkOpsDisabled: selectedPath === null || status?.head === null || (status?.untracked ?? []).includes(selectedPath),
								hunkOpsDisabledReason: selectedPath !== null && (status?.untracked ?? []).includes(selectedPath) ? t("diff.untracked") : t("diff.noHead"),
								uncheckedHunks: selectedPath !== null ? uncheckedHunks.get(selectedPath)?.unchecked : void 0,
								onToggleHunk: (index) => {
									if (selectedPath !== null) toggleHunk(selectedPath, index);
								},
								onChanged: () => {
									api.refreshStatus(dir);
									if (selectedPath !== null) loadDiff(selectedPath, wsFlags, true);
								},
								flushRef: diffFlushRef
							}),
							!changesDiffFullscreen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CommitBox, {
								api,
								dir,
								stagedCount: checkedPaths.length,
								branch: status?.branch ?? null,
								t,
								checkedPaths,
								partial: partialCommits,
								onCommitted: () => {
									api.refreshStatus(dir);
									setNotice(null);
								}
							})
						]
					})] })
				})] }),
				menu !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Menu, {
					x: menu.x,
					y: menu.y,
					items: menu.items,
					onClose: () => setMenu(null)
				}),
				pushOpen && status !== null && status.branch !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PushDialog, {
					api,
					dir,
					branch: status.branch,
					t,
					onDone: () => void refresh(),
					onClose: () => setPushOpen(false)
				}),
				rebaseOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RebaseDialog, {
					api,
					dir,
					t,
					baseHint: rebaseBaseHint,
					onDone: () => void refresh(),
					onConflicts: () => {
						setTab("merge");
						api.refreshStatus(dir);
					},
					onClose: () => setRebaseOpen(false)
				}),
				cloneOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CloneDialog, {
					api,
					t,
					sessionDir: sessionCwd,
					onDone: (root) => {
						setCloneOpen(false);
						gitUiSetDir(root);
						gitUiSetFollowSession(false);
						gitUiAddRecentDir(root);
						setNotice(t("clone.done", { root }));
					},
					onClose: () => setCloneOpen(false)
				}),
				getFromRevision !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GetFromRevisionDialog, {
					api,
					t,
					dir,
					paths: getFromRevision.paths,
					onDone: () => {
						setGetFromRevision(null);
						refresh();
					},
					onClose: () => setGetFromRevision(null)
				})
			] });
			const fontScaleStyle = { "--git-ui-font-scale": String(fontScale) };
			const resizeHandle = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "gitui-resize",
				title: t("resize.hint"),
				onMouseDown: startResize
			});
			const titleBar = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "gitui-titlebar" + (floating && !fullscreen ? " gitui-titlebar-movable" : ""),
				onMouseDown: floating && !fullscreen ? startMove : void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-glyph",
						children: "⑂"
					}),
					status !== null && status.branch !== null && (titleBranches.local.length > 0 || titleBranches.remote.length > 0) ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						className: "gitui-titlebar-branch",
						value: status.branch,
						title: t("branch.switchHint"),
						disabled: busy,
						onChange: (event) => void switchTitleBranch(event.target.value),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
							label: t("branch.local"),
							children: titleBranches.local.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: name,
								children: name
							}, name))
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
							label: t("branch.remote"),
							children: titleBranches.remote.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: name,
								children: name.replace(/^remotes\//, "")
							}, name))
						})]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "gitui-titlebar-label",
						children: status?.branch ?? t("panel.title")
					}),
					status !== null && status.branch !== null && (status.ahead > 0 || status.behind > 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "gitui-titlebar-ahead",
						children: [
							"↑",
							status.ahead,
							"↓",
							status.behind
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-dir-wrap",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							ref: dirInputRef,
							className: "gitui-dir",
							value: displayValue,
							placeholder: t("repo.placeholder"),
							title: dirDraft + " · " + (followSession ? t("repo.following") : t("repo.pinned")),
							onChange: (event) => {
								setDirDraft(event.target.value);
								setDirMenuOpen(true);
							},
							onFocus: () => {
								setDirEditing(true);
								setDirMenuOpen(true);
							},
							onClick: () => setDirMenuOpen(true),
							onBlur: () => {
								window.setTimeout(() => {
									setDirEditing(false);
									if (dirInputRef.current !== document.activeElement) setDirMenuOpen(false);
								}, 120);
							},
							onKeyDown: (event) => {
								if (event.key === "Enter") {
									const target = dirDraft.trim();
									gitUiSetDir(target);
									if (target !== "" && !workspaceDirs.includes(target) && target !== sessionCwd) gitUiAddRecentDir(target);
									setDirMenuOpen(false);
								} else if (event.key === "Escape") setDirMenuOpen(false);
							},
							spellCheck: false
						}), dirMenuOpen && filteredDirs.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-dir-menu",
							role: "listbox",
							children: filteredDirs.map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								role: "option",
								"aria-selected": path === dir,
								title: path,
								className: "gitui-dir-option" + (path === dir ? " gitui-dir-option-selected" : ""),
								onMouseDown: (event) => {
									event.preventDefault();
									gitUiSetDir(path);
									setDirMenuOpen(false);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "gitui-dir-option-label",
									children: path
								}), recentDirs.includes(path) && !workspaceDirs.includes(path) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "gitui-dir-option-del",
									title: t("menu.removeRecentDir"),
									onMouseDown: (event) => {
										event.preventDefault();
										event.stopPropagation();
										gitUiRemoveRecentDir(path);
									},
									children: "✕"
								})]
							}, path))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn" + (followSession ? "" : " gitui-active"),
						title: followSession ? t("repo.following") : t("repo.pinned"),
						onClick: () => {
							if (followSession) gitUiSetFollowSession(false);
							else {
								gitUiSetFollowSession(true);
								if (sessionCwd !== "") gitUiFollowCwd(sessionCwd);
							}
						},
						children: "📌"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn",
						disabled: busy || statusLoading || dir === "",
						onClick: () => void refresh(),
						children: "↻"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "gitui-btn",
						title: t("clone.title"),
						disabled: busy,
						onClick: () => setCloneOpen(true),
						children: ["⤓ ", t("clone.action")]
					}),
					status !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn",
						title: t("gitignore.title"),
						disabled: busy || dir === "",
						onClick: () => void runSuggestGitignore(),
						children: "✨.gitignore"
					}),
					status !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "gitui-btn",
						title: t("pull.title"),
						disabled: busy || dir === "" || remotes.length === 0,
						onClick: () => void doPullNow(),
						children: ["⇣ ", t("pull.action")]
					}),
					status !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "gitui-btn",
						title: t("push.preview") + " (Ctrl+Shift+K)",
						disabled: busy || dir === "" || status.branch === null || remotes.length === 0,
						onClick: () => setPushOpen(true),
						children: ["⇡ ", t("remote.push")]
					}),
					(status?.unstaged?.length ?? 0) + (status?.untracked?.length ?? 0) > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn",
						disabled: busy || dir === "",
						onClick: stageAll,
						children: t("action.stageAll")
					}),
					status !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn gitui-btn-primary",
						title: t("commit.autoTitle"),
						disabled: busy || dir === "",
						onClick: () => {
							setCommitPlanResults(null);
							setCommitPlanOpen(true);
						},
						children: t("commit.auto")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "gitui-tb-sep" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn gitui-font-btn",
						title: t("panel.fontScaleSmaller"),
						disabled: fontScale <= FONT_SCALE_MIN,
						onClick: () => gitUiAdjustFontScale(-.1),
						children: "A−"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "gitui-btn gitui-font-btn",
						title: t("panel.fontScaleLarger"),
						disabled: fontScale >= FONT_SCALE_MAX,
						onClick: () => gitUiAdjustFontScale(FONT_SCALE_STEP),
						children: "A+"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "gitui-win-controls",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-win-btn",
								title: t("win.minimize"),
								onClick: () => gitUiSetOpen(false),
								children: "–"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-win-btn" + (fullscreen ? " gitui-active" : ""),
								title: fullscreen ? t("win.exitFullscreen") : t("win.fullscreen"),
								onClick: () => gitUiSetFullscreen(!fullscreen),
								children: "⛶"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "gitui-win-btn gitui-win-close",
								title: t("win.close"),
								onClick: () => gitUiSetOpen(false),
								children: "✕"
							})
						]
					})
				]
			});
			if (!open) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { "data-git-ui-root": "" });
			if (floating && !fullscreen) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				"data-git-ui-root": "",
				style: fontScaleStyle,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-float",
					style: floatMaximized === true ? {
						left: 8,
						top: 8,
						width: Math.max(360, window.innerWidth - 16),
						height: Math.max(240, window.innerHeight - 16)
					} : {
						left: Math.min(Math.max(8, floatPos.x), Math.max(8, window.innerWidth - floatWidth - 8)),
						top: Math.min(Math.max(8, floatPos.y), Math.max(8, window.innerHeight - 64 - 8)),
						width: Math.min(floatWidth, Math.max(360, window.innerWidth - 16)),
						height: panelHeight
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-resize-x gitui-resize-x-l",
							title: t("resize.width"),
							onMouseDown: startResizeLeft
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-resize-x gitui-resize-x-r",
							title: t("resize.width"),
							onMouseDown: startResizeRight
						}),
						resizeHandle,
						titleBar,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "gitui-float-body",
							children: content
						})
					]
				})
			});
			const panel = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				"data-git-ui-root": "",
				style: fontScaleStyle,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "gitui-panel" + (fullscreen ? " gitui-fullscreen" : ""),
					style: fullscreen ? {
						position: "fixed",
						inset: 0,
						zIndex: 2147483e3
					} : { height: `${panelHeight}px` },
					children: [
						!fullscreen && resizeHandle,
						titleBar,
						content
					]
				})
			});
			return fullscreen ? (0, react_dom.createPortal)(panel, document.body) : panel;
		}
		//#endregion
		//#region src/client/locale.ts
		const zh = {
			"panel.title": "Git",
			"panel.fontScaleSmaller": "减小整体字号",
			"panel.fontScaleLarger": "增大整体字号",
			"action.refresh": "刷新",
			"state.clean": "干净",
			"state.merge": "合并中",
			"state.rebase": "变基中",
			"state.cherry-pick": "cherry-pick 中",
			"state.revert": "revert 中",
			"state.other": "操作中",
			"group.staged": "暂存区",
			"group.changes": "变更",
			"group.unstaged": "工作区",
			"group.untracked": "未跟踪",
			"tree.expandAll": "全部展开",
			"tree.collapseAll": "全部折叠",
			"tree.refresh": "刷新",
			"tree.check": "勾选以包含到本次提交",
			"action.stage": "暂存",
			"action.stageAll": "全部暂存",
			"action.unstage": "取消暂存",
			"action.discard": "丢弃",
			"action.discardWhole": "还原整个文件（丢弃全部工作区改动）",
			"action.track": "跟踪",
			"action.untrack": "撤销跟踪",
			"untrack.confirm": "确定撤销对 {path} 的跟踪？文件将从版本控制移除（工作区文件保留）。",
			"config.title": "配置",
			"config.empty": "没有配置项",
			"config.edit": "编辑",
			"config.save": "保存",
			"config.saved": "已保存 {key}",
			"config.add": "添加",
			"config.added": "已添加 {key}",
			"config.addPrompt": "选择配置项…",
			"config.valuePlaceholder": "值",
			"config.remove": "删除",
			"config.removeHint": "删除此项配置",
			"config.removed": "已删除 {key}",
			"config.scope.system": "系统级（--system）",
			"config.scope.global": "用户级（--global）",
			"config.scope.local": "项目级（--local）",
			"config.scope.systemHint": "所有用户：Git 安装目录 gitconfig",
			"config.scope.globalHint": "当前用户：~/.gitconfig",
			"config.scope.localHint": "当前仓库：.git/config",
			"config.scope.note": "优先级：项目级 > 用户级 > 系统级（高优先级覆盖低优先级，从上到下逐级降低）。推送认证的用户名/密码不保存在 git 配置里，由系统凭据管理器（credential.helper）记住。",
			"auth.github.title": "GitHub 推送认证：密码已不再支持，请使用访问令牌（PAT）",
			"auth.github.body": "GitHub 自 2021-08-13 起不再接受账号密码进行 HTTPS 推送，必须使用 Personal Access Token（PAT）或 SSH。HTTPS 方式：① 点击下方链接生成 token（勾选 repo 权限）；② 推送时用户名填你的 GitHub 用户名，密码填 token（Git 会记住，下次不再询问）。",
			"auth.gitlab.title": "GitLab 推送认证：支持账号密码或访问令牌（PAT）",
			"auth.gitlab.body": "GitLab 的 HTTPS 推送可以用账号密码，也可以用个人访问令牌（PAT，推荐，更安全）。若开启了两步验证（2FA），必须使用 PAT。① 点击下方链接生成 token（勾选 write_repository 权限）；② 推送时用户名填 GitLab 用户名，密码填 PAT（未开启 2FA 时也可填账号密码）。",
			"auth.other.title": "推送认证提示",
			"auth.other.body": "通过 HTTPS 推送时，多数平台要求使用访问令牌（Token）而不是账号密码（GitHub 已完全禁用密码）。若推送报 authentication failed：① 确认仓库的远程地址正确；② 在该平台的设置页生成一个具有写仓库权限的 token；③ 推送时用户名填平台用户名，密码填 token。",
			"auth.openTokenPage": "打开令牌生成页面 ↗",
			"auth.missingIdentity": "尚未配置 {name}：提交（commit）会失败或使用错误身份，请在上方“用户级”区域添加 user.name 与 user.email。",
			"remoteBranch.pull": "拉取",
			"remoteBranch.pullHint": "检出该远程分支到本地并拉取最新代码",
			"remoteBranch.pulled": "已检出并拉取 {branch}",
			"action.commit": "提交",
			"action.close": "关闭",
			"commit.placeholder": "提交信息（Enter 换行，Ctrl+Enter 提交）",
			"commit.amend": "修改上一次提交",
			"commit.nothing": "没有可提交的变更",
			"commit.done": "已提交 {short}：{subject}",
			"commit.identity": "git 身份未配置（user.name / user.email）",
			"commit.auto": "AI规划提交",
			"commit.autoTitle": "AI 分析改动并规划提交（分组 + 提交信息）",
			"commit.analyzing": "正在分析改动并规划提交…",
			"commit.planTitle": "AI 提交规划",
			"commit.planDesc": "共 {n} 次提交，可编辑信息后执行",
			"commit.execute": "执行 {n} 次提交",
			"commit.executing": "提交中 ({i}/{n})…",
			"commit.executed": "已完成 {n} 次提交",
			"commit.cancel": "取消",
			"commit.doneBtn": "完成",
			"getFromRevision.title": "从版本获取",
			"getFromRevision.revision": "版本",
			"getFromRevision.revisionPlaceholder": "提交哈希 / 分支 / 标签…",
			"getFromRevision.paths": "选中的 {n} 个文件",
			"getFromRevision.hint": "选择一个版本，或输入任意 revision。",
			"getFromRevision.willGet": "将把选中文件还原到 {rev}",
			"getFromRevision.busy": "获取中…",
			"getFromRevision.submit": "获取",
			"diff.binary": "二进制文件",
			"diff.binaryDifferent": "文件内容不同",
			"diff.empty": "无差异",
			"diff.noFile": "选择左侧文件查看差异",
			"diff.worktree": "工作区",
			"diff.saved": "已保存 ✓",
			"diff.restoreEdits": "还原编辑 {n} 行",
			"diff.restoreEditsHint": "将本文件所有行内编辑恢复到编辑前的文本",
			"diff.restored": "已还原 ✓",
			"diff.emptyTree": "空树",
			"diff.ignoreWhitespace": "忽略空白",
			"diff.ignoreWhitespaceHint": "忽略空白字符差异，重新计算差异块",
			"diff.view.side": "Side-by-side viewer",
			"diff.view.unified": "Unified viewer",
			"diff.viewModeHint": "切换视图模式",
			"diff.ws.none": "Do not ignore",
			"diff.ws.trimEol": "Trim whitespaces",
			"diff.ws.ignoreWs": "Ignore whitespaces",
			"diff.ws.ignoreBlank": "Ignore empty lines",
			"diff.ws.trim": "Trim whitespaces",
			"diff.ws.all": "Ignore whitespaces",
			"diff.ws.all-blank": "Ignore whitespaces and empty lines",
			"diff.wsModeHint": "空白比较策略：忽略后重新计算差异块",
			"diff.hl.line": "Highlight lines",
			"diff.hl.word": "Highlight words",
			"diff.hl.char": "Highlight characters",
			"diff.hl.none": "Do not highlight",
			"diff.highlightHint": "行内高亮粒度",
			"diff.softWrap": "软换行",
			"diff.softWrapHint": "长行自动折行（软换行）",
			"diff.fontSmaller": "减小字号",
			"diff.fontLarger": "增大字号",
			"diff.count": "{n} 处差异",
			"diff.countZero": "无差异",
			"diff.countHint": "差异总数；导航后显示 当前/总数",
			"diff.stageHunk": "暂存",
			"diff.revertHunk": "还原",
			"diff.stageFile": "暂存文件",
			"diff.revertFile": "还原文件",
			"diff.prevHunk": "上一处差异",
			"diff.nextHunk": "下一处差异",
			"diff.unchanged": "⋯ {n} 行未变更，点击展开",
			"diff.stagedExists": "该文件已有暂存改动，请先取消暂存",
			"diff.untracked": "未跟踪文件，请先 Track",
			"diff.noHead": "仓库尚无提交",
			"diff.truncatedReadonly": "已截断（超过 512 KB），行内编辑已禁用",
			"menu.more": "更多操作",
			"menu.showDiff": "显示差异",
			"menu.stage": "暂存",
			"menu.unstage": "取消暂存",
			"menu.rollback": "回滚",
			"menu.ignore": "忽略",
			"menu.ignored": "已加入忽略规则",
			"menu.ignoredTracked": "已加入忽略规则（已跟踪的文件不受影响，仍会显示）",
			"menu.showHistory": "显示历史",
			"menu.moveTo": "移动到变更列表",
			"menu.copyPath": "复制路径",
			"menu.copyHash": "复制提交哈希",
			"menu.copyHashes": "复制提交哈希（{n} 个）",
			"menu.copyMetadata": "复制元信息",
			"menu.copyMessage": "复制提交信息",
			"menu.removeRecentDir": "从列表移除",
			"menu.checkoutRevision": "检出此提交",
			"menu.checkoutRevisionConfirm": "将以分离 HEAD 检出 {hash}，确定？",
			"menu.createBranchHere": "在此创建分支…",
			"menu.createBranchHerePrompt": "新分支名称",
			"menu.resetToHere": "重置当前分支到此",
			"menu.newBranchFrom": "从此分支创建…",
			"menu.newBranchFromPrompt": "新分支名称",
			"menu.mergeIntoCurrent": "合并到当前分支",
			"menu.rebaseCurrentOnto": "将当前分支变基到此",
			"changelist.new": "新建变更列表",
			"changelist.newPrompt": "变更列表名称",
			"changelist.setActive": "设为激活列表",
			"changelist.rename": "重命名",
			"changelist.renamePrompt": "新名称",
			"changelist.delete": "删除变更列表",
			"changelist.deleteConfirm": "删除变更列表 {name}？其文件将回到未分配状态",
			"changelist.moveCheckedHere": "勾选文件移入此列表",
			"changelist.moved": "已移动文件",
			"changelist.created": "已创建变更列表",
			"changelist.activated": "已切换激活列表",
			"changelist.renamed": "已重命名",
			"changelist.deleted": "已删除变更列表",
			"push.preview": "推送",
			"push.newBranch": "新分支",
			"push.followTags": "跟随标签",
			"push.followTagsHint": "同时推送指向所推提交的标签（--follow-tags）",
			"push.upToDate": "没有可推送的提交",
			"rebase.title": "交互式变基",
			"rebase.onto": "变基到",
			"rebase.start": "开始变基",
			"rebase.pick": "pick",
			"rebase.reword": "reword",
			"rebase.squash": "squash",
			"rebase.fixup": "fixup",
			"rebase.drop": "drop",
			"rebase.nothing": "基准与 HEAD 之间没有提交",
			"rebase.firstHint": "首个提交不能 squash/fixup，将按 reword 处理",
			"merge.skip": "跳过",
			"merge.skipHint": "跳过当前冲突提交（git rebase --skip）",
			"merge.skipped": "已跳过该提交",
			"merge.skipConflicts": "跳过后仍有 {n} 个冲突",
			"history.allBranches": "全部分支",
			"history.author": "作者",
			"history.allAuthors": "全部作者",
			"history.since": "起始日期",
			"history.until": "截止日期",
			"log.worktreeDiff": "与工作区对比",
			"log.worktreeFiles": "与工作区的差异文件",
			"tabs.changes": "变更",
			"tabs.files": "文件",
			"tabs.merge": "合并",
			"tabs.history": "历史",
			"tabs.branches": "分支",
			"tabs.remotes": "远程",
			"tabs.config": "配置",
			"branch.current": "当前",
			"branch.local": "本地分支",
			"branch.remote": "远程分支",
			"branch.empty": "没有分支",
			"branch.noRemotes": "未配置远程仓库（可在“远程”标签页添加）",
			"branch.remoteEmpty": "暂无远程分支（拉取后可显示）",
			"branch.checkout": "检出",
			"branch.rename": "重命名",
			"branch.delete": "删除",
			"branch.forceDelete": "强制删除",
			"branch.create": "新建分支",
			"branch.createPrompt": "新分支名（基于当前 HEAD）",
			"branch.renamePrompt": "输入新的分支名：",
			"branch.deleteConfirm": "确定删除分支 {name}？",
			"branch.switched": "已切换到 {name}",
			"branch.switchHint": "切换分支（检出）",
			"branch.created": "已创建分支 {name}",
			"branch.renamed": "已重命名 {oldName} → {newName}",
			"branch.deleted": "已删除分支 {name}",
			"reset.action": "重置",
			"reset.pick": "重置模式：",
			"reset.hint": "重置 {branch}（soft: 保留暂存 / mixed: 清暂存 / hard: 丢弃改动）",
			"reset.done": "已重置 {branch}（{mode}）",
			"compare.action": "对比",
			"compare.hint": "对比当前分支与 {branch}",
			"compare.title": "{from} ↔ {to}",
			"compare.files": "个文件",
			"tag.title": "标签",
			"tag.empty": "暂无标签",
			"tag.delete": "删除",
			"tag.deleteConfirm": "确定删除标签 {name}？",
			"tag.deleted": "已删除标签 {name}",
			"merge.inprogress": "合并进行中 — 逐个解决冲突后提交",
			"merge.inprogressInto": "合并进行中 — 正在将 {source} 合并到 {target}",
			"merge.conflictsRemain": "还有 {n} 个冲突未解决",
			"merge.conflictsRemainInto": "还有 {n} 个冲突未解决 — 正在将 {source} 合并到 {target}",
			"merge.from": "合并来源",
			"merge.into": "合并目标",
			"merge.noTargets": "没有其他分支可合并（先做首次提交或创建分支）",
			"merge.switchConfirm": "将切换到分支 {target}，再把 {source} 合并进去。确定继续？",
			"merge.button": "将 {source} 合并到 {target}",
			"merge.noFF": "创建合并提交（--no-ff）",
			"merge.alreadyUpToDate": "{target} 已包含 {source} 的所有提交",
			"merge.fastForward": "已快进合并 {source} → {target}（{short}，无合并提交）",
			"merge.prev": "上一处冲突",
			"merge.next": "下一处冲突",
			"merge.acceptLeft": "接受左",
			"merge.acceptRight": "接受右",
			"merge.acceptLeftHint": "将当前冲突块替换为左侧（当前分支）内容",
			"merge.acceptRightHint": "将当前冲突块替换为右侧（传入分支）内容",
			"merge.applyLeft": "应用到结果（采用左侧 / 当前分支）",
			"merge.applyRight": "应用到结果（采用右侧 / 传入分支）",
			"merge.notApply": "不应用到结果（从结果移除该块）",
			"merge.removeBlock": "从结果中移除该冲突块",
			"merge.editMode": "编辑",
			"merge.viewMode": "视图",
			"merge.resultTitle": "结果",
			"merge.remaining": "还有 {n} 处冲突未解决",
			"merge.allResolved": "所有冲突已解决",
			"merge.undo": "撤销（Ctrl+Z）",
			"merge.restore": "逆向：恢复该冲突块（撤回合入）",
			"merge.redo": "重做",
			"pull.title": "拉取 (Pull)",
			"pull.fetch": "抓取 (fetch)",
			"pull.merge": "合并 (merge)",
			"pull.rebase": "变基 (rebase)",
			"pull.action": "拉取",
			"pull.done": "已拉取并合并",
			"pull.upToDate": "已是最新",
			"pull.conflicts": "拉取产生 {n} 个冲突，请到「合并」页解决",
			"pull.failed": "拉取失败",
			"pull.noRemote": "没有远程仓库",
			"fetch.done": "抓取完成",
			"files.noDir": "尚未选择目录",
			"files.refresh": "刷新目录",
			"files.new": "新建文件",
			"files.newPrompt": "新建文件（在 {base} 下）：",
			"files.created": "已创建 {path}",
			"files.delete": "删除",
			"files.deleteConfirm": "确定删除文件 {path}？",
			"files.deleteDirConfirm": "确定删除目录 {path} 及其全部内容？此操作不可撤销！",
			"files.deleted": "已删除 {path}",
			"files.placeholder": "选择左侧文件查看或编辑",
			"files.binary": "二进制文件，无法预览或编辑",
			"files.empty": "目录为空",
			"files.truncated": "已截断（超过 512 KB），只读预览",
			"files.savedFlash": "已保存 ✓",
			"stash.title": "储藏改动 (stash)",
			"stash.message": "说明（可选）",
			"stash.untracked": "包含未跟踪文件",
			"stash.action": "储藏",
			"stash.empty": "没有储藏的改动",
			"stash.restore": "恢复",
			"stash.drop": "删除",
			"stash.done": "已储藏改动",
			"stash.nothing": "没有可储藏的改动",
			"stash.popped": "已恢复 stash@{index}",
			"stash.popConflicts": "恢复时产生 {n} 个冲突，请到「合并」页解决",
			"stash.dropped": "已删除 stash@{index}",
			"stash.dropConfirm": "确定删除 stash@{index}：{message}？",
			"tabs.stash": "储藏",
			"stash.apply": "应用",
			"stash.applyHint": "应用该暂存（保留暂存记录）",
			"stash.applied": "已应用 stash@{index}",
			"stash.applyConflicts": "应用时产生 {n} 个冲突，请到「合并」页解决",
			"stash.show": "查看",
			"stash.showHint": "查看该暂存包含的文件",
			"stash.showEmpty": "（无文件改动）",
			"stash.branch": "创建分支",
			"stash.branchHint": "从该暂存创建分支并切换",
			"stash.branchPrompt": "新分支名",
			"stash.branched": "已从 stash@{index} 创建并切换到分支 {branch}",
			"stash.clear": "清空全部",
			"stash.clearHint": "删除所有暂存记录（不可恢复）",
			"stash.clearConfirm": "确定清空所有暂存？此操作不可恢复。",
			"stash.cleared": "已清空暂存",
			"remote.title": "远程仓库",
			"remote.add": "添加",
			"remote.name": "名称",
			"remote.url": "URL",
			"remote.empty": "暂无远程仓库",
			"remote.added": "已添加远程仓库 {name}",
			"remote.removed": "已删除远程仓库 {name}",
			"remote.remove": "删除",
			"remote.removeConfirm": "确定删除远程仓库 {name}？",
			"remote.push": "推送",
			"remote.pushHint": "推送当前分支 {branch} 到 {name}",
			"remote.fetch": "抓取",
			"remote.fetchHint": "抓取该远程的最新分支引用",
			"remote.edit": "更改",
			"remote.save": "保存",
			"remote.edited": "已更新远程仓库 {name}",
			"push.done": "已推送 {branch} → {remote}",
			"push.doneTarget": "已推送 {local} → {target}（{remote}）",
			"push.localPlaceholder": "本地分支",
			"push.remotePlaceholder": "远程分支（默认 {branch}）",
			"push.force": "强制推送",
			"push.forceHint": "强制推送（--force-with-lease）：覆盖远程该分支的历史，可能丢失远程提交！",
			"push.remoteBranchSelect": "推送到该远程分支（第一个为与本地同名的分支）",
			"push.noRemoteBranches": "（无远程分支，将推送到同名分支）",
			"push.andCommit": "提交并推送",
			"push.hint": "提交后推送到 {remote}（分支 {branch}）",
			"push.commitOkPushFailed": "已提交 {short}：{subject}，但推送失败：{message}",
			"merge.abort": "中止合并",
			"merge.continue": "完成合并并提交",
			"merge.done": "合并完成：{short} {subject}",
			"merge.commitMessage": "合并提交信息（留空使用默认）",
			"conflict.ours": "保留当前分支",
			"conflict.theirs": "保留传入分支",
			"conflict.edit": "手动编辑",
			"conflict.save": "保存并标记已解决",
			"conflict.resolved": "已解决并暂存",
			"history.empty": "暂无提交",
			"history.branch": "分支",
			"history.current": "当前",
			"history.checkout": "切换",
			"history.create": "新建分支",
			"history.createPrompt": "新分支名",
			"history.switched": "已切换到 {branch}",
			"history.created": "已创建分支 {branch}",
			"log.select": "选择左侧提交查看详情",
			"log.hash": "提交",
			"log.author": "作者",
			"log.date": "日期",
			"log.parents": "父提交",
			"log.authorDate": "作者时间",
			"log.committer": "提交者",
			"log.commitDate": "提交时间",
			"log.files": "文件",
			"log.changedFiles": "变更文件",
			"log.showMore": "还有 {n} 个文件，加载更多",
			"history.search": "搜索提交…",
			"history.fileFilter": "文件历史：输入路径回车",
			"history.fileFilterClear": "清除文件过滤",
			"history.selectedCount": "已选 {n} 个提交",
			"history.more": "更多",
			"history.moreHint": "对分支筛选选中的分支执行检出、拉取、合并或变基（标题栏）",
			"history.checkoutBranch": "检出 {branch}",
			"history.pullBranch": "拉取 {branch}",
			"history.mergeToCurrent": "将 {from} 合并到 {to}",
			"history.rebaseToCurrent": "将 {from} 变基到 {to}",
			"history.merged": "已合并 {from} 到 {to}",
			"history.rebased": "已将 {from} 变基到 {to}",
			"history.filePaneResize": "拖动调整变更文件列表宽度",
			"history.showInfo": "展开提交详情",
			"history.hideInfo": "收起提交详情",
			"cherryPick": "cherry-pick",
			"cherryPick.hint": "将该提交应用到当前分支",
			"cherryPick.multi": "cherry-pick 选中的 {n} 个提交",
			"cherryPick.conflicts": "cherry-pick 产生 {n} 个冲突，请到「合并」页解决",
			"revert": "revert",
			"revert.hint": "撤销该提交的更改",
			"revert.multi": "revert 选中的 {n} 个提交",
			"squash.multi": "squash 选中的 {n} 个提交",
			"squash.prompt": "合并提交信息（squash 为单个提交）：",
			"squash.done": "已 squash 为单个提交",
			"revert.conflicts": "revert 产生 {n} 个冲突，请到「合并」页解决",
			"tag.create": "标签",
			"tag.createPrompt": "新标签名",
			"tag.created": "已创建标签 {name}",
			"tag.hint": "在该提交上创建标签",
			"repo.placeholder": "选择工作区目录或手动输入，回车应用",
			"repo.notRepo": "“{dir}”不是 Git 仓库",
			"repo.gitInitDone": "已在此目录初始化 Git 仓库",
			"action.gitInit": "初始化仓库 (git init)",
			"clone.title": "克隆仓库 (Clone)",
			"clone.action": "克隆",
			"clone.url": "仓库 URL",
			"clone.urlPlaceholder": "https://github.com/user/repo.git 或 git@github.com:user/repo.git",
			"clone.target": "目标目录",
			"clone.targetPlaceholder": "输入完整目标路径（不存在则创建，已存在须为空）",
			"clone.useSession": "填入会话目录",
			"clone.useSessionHint": "克隆到当前会话工作目录下（自动附加仓库名）",
			"clone.sessionHint": "当前会话目录：{dir}",
			"clone.sessionUnavailable": "当前会话工作目录不可用",
			"clone.submit": "克隆",
			"clone.busy": "正在克隆…",
			"clone.done": "已克隆到 {root}",
			"gitignore.title": "AI 分析并更新 .gitignore",
			"gitignore.updated": "已更新 .gitignore",
			"gitignore.unchanged": ".gitignore 无需更改",
			"win.minimize": "最小化",
			"win.fullscreen": "全屏",
			"win.exitFullscreen": "退出全屏",
			"win.close": "关闭",
			"repo.following": "跟随当前会话工作目录",
			"repo.pinned": "已固定目录（不再跟随会话）",
			"float.title": "浮动窗口",
			"float.dock": "停靠回输入框上方",
			"resize.hint": "拖拽调整高度（不会自动变化）",
			"splitter.resize": "拖动调整列表宽度，双击恢复默认",
			"pane.collapse": "收起目录栏",
			"pane.restore": "展开目录栏",
			"discard.confirm": "确定丢弃 {path} 的工作区改动？此操作不可恢复。"
		};
		const en = {
			"panel.title": "Git",
			"panel.fontScaleSmaller": "Decrease overall font size",
			"panel.fontScaleLarger": "Increase overall font size",
			"action.refresh": "Refresh",
			"state.clean": "Clean",
			"state.merge": "Merging",
			"state.rebase": "Rebasing",
			"state.cherry-pick": "Cherry-picking",
			"state.revert": "Reverting",
			"state.other": "Operation in progress",
			"group.staged": "Staged",
			"group.changes": "Changes",
			"group.unstaged": "Changes",
			"group.untracked": "Untracked",
			"tree.expandAll": "Expand all",
			"tree.collapseAll": "Collapse all",
			"tree.refresh": "Refresh",
			"tree.check": "Check to include in this commit",
			"action.stage": "Stage",
			"action.stageAll": "Stage all",
			"action.unstage": "Unstage",
			"action.discard": "Discard",
			"action.discardWhole": "Discard entire file (drop all working-tree changes)",
			"action.track": "Track",
			"action.untrack": "Untrack",
			"untrack.confirm": "Untrack {path}? Files are removed from version control (working-tree files are kept).",
			"config.title": "Config",
			"config.empty": "No config entries",
			"config.edit": "Edit",
			"config.save": "Save",
			"config.saved": "Saved {key}",
			"config.add": "Add",
			"config.added": "Added {key}",
			"config.addPrompt": "Choose a key…",
			"config.valuePlaceholder": "value",
			"config.remove": "Remove",
			"config.removeHint": "Remove this config entry",
			"config.removed": "Removed {key}",
			"config.scope.system": "System (--system)",
			"config.scope.global": "User (--global)",
			"config.scope.local": "Project (--local)",
			"config.scope.systemHint": "All users: git installation gitconfig",
			"config.scope.globalHint": "Current user: ~/.gitconfig",
			"config.scope.localHint": "This repo: .git/config",
			"config.scope.note": "Precedence: project > user > system (higher overrides lower; the list runs from highest to lowest). Push credentials are not stored in git config; the system credential helper remembers them.",
			"auth.github.title": "GitHub push auth: passwords are no longer accepted — use a Personal Access Token",
			"auth.github.body": "Since 2021-08-13 GitHub rejects account passwords for HTTPS pushes; use a PAT or SSH. HTTPS: ① click the link below to generate a token (scope: repo); ② when pushing, enter your GitHub username and use the token as the password (git remembers it).",
			"auth.gitlab.title": "GitLab push auth: account password or Personal Access Token",
			"auth.gitlab.body": "GitLab accepts either your account password or a PAT over HTTPS (PAT recommended). With 2FA enabled a PAT is required. ① click the link below to generate a token (scope: write_repository); ② when pushing, enter your GitLab username and the PAT as the password (or your account password without 2FA).",
			"auth.other.title": "Push authentication guide",
			"auth.other.body": "Most hosting platforms require a token instead of an account password over HTTPS (GitHub has fully disabled passwords). If a push fails with authentication failed: ① verify the remote URL; ② generate a token with write access on the platform's settings page; ③ push with your username and the token as the password.",
			"auth.openTokenPage": "Open token page ↗",
			"auth.missingIdentity": "{name} is not configured: commits will fail or use the wrong identity. Add user.name and user.email in the User scope above.",
			"remoteBranch.pull": "Pull",
			"remoteBranch.pullHint": "Check out this remote branch locally and pull the latest",
			"remoteBranch.pulled": "Checked out and pulled {branch}",
			"action.commit": "Commit",
			"action.close": "Close",
			"commit.placeholder": "Commit message (Enter for newline, Ctrl+Enter to commit)",
			"commit.amend": "Amend previous commit",
			"commit.nothing": "Nothing to commit",
			"commit.done": "Committed {short}: {subject}",
			"commit.identity": "git identity not configured (user.name / user.email)",
			"commit.auto": "AI Plan Commits",
			"commit.autoTitle": "Let the model analyze changes and plan commits (groups + messages)",
			"commit.analyzing": "Analyzing changes and planning commits…",
			"commit.planTitle": "AI commit plan",
			"commit.planDesc": "{n} commits planned — edit messages, then execute",
			"commit.execute": "Execute {n} commits",
			"commit.executing": "Committing ({i}/{n})…",
			"commit.executed": "Completed {n} commits",
			"commit.cancel": "Cancel",
			"commit.doneBtn": "Done",
			"getFromRevision.title": "Get from revision",
			"getFromRevision.revision": "Revision",
			"getFromRevision.revisionPlaceholder": "Commit hash / branch / tag…",
			"getFromRevision.paths": "{n} selected file(s)",
			"getFromRevision.hint": "Pick a revision, or type any revision.",
			"getFromRevision.willGet": "Will restore the selected file(s) at {rev}",
			"getFromRevision.busy": "Getting…",
			"getFromRevision.submit": "Get",
			"diff.binary": "Binary file",
			"diff.binaryDifferent": "Files contents are different",
			"diff.empty": "No differences",
			"diff.restoreEdits": "Restore {n} edited lines",
			"diff.restoreEditsHint": "Restore every inline edit of this file to its pre-edit text",
			"diff.restored": "Restored ✓",
			"diff.noFile": "Select a file on the left to view its diff",
			"diff.worktree": "Working Tree",
			"diff.saved": "Saved ✓",
			"diff.emptyTree": "Empty tree",
			"diff.ignoreWhitespace": "Ignore whitespace",
			"diff.ignoreWhitespaceHint": "Ignore whitespace-only changes and recompute hunks",
			"diff.view.side": "Side-by-side viewer",
			"diff.view.unified": "Unified viewer",
			"diff.viewModeHint": "Switch the diff view mode",
			"diff.ws.none": "Do not ignore",
			"diff.ws.trimEol": "Trim whitespaces",
			"diff.ws.ignoreWs": "Ignore whitespaces",
			"diff.ws.ignoreBlank": "Ignore empty lines",
			"diff.ws.trim": "Trim whitespaces",
			"diff.ws.all": "Ignore whitespaces",
			"diff.ws.all-blank": "Ignore whitespaces and empty lines",
			"diff.wsModeHint": "Whitespace comparison policy; changes recompute the hunks",
			"diff.hl.line": "Highlight lines",
			"diff.hl.word": "Highlight words",
			"diff.hl.char": "Highlight characters",
			"diff.hl.none": "Do not highlight",
			"diff.highlightHint": "Intra-line highlight granularity",
			"diff.softWrap": "Soft wrap",
			"diff.softWrapHint": "Wrap long lines instead of scrolling horizontally",
			"diff.fontSmaller": "Decrease font size",
			"diff.fontLarger": "Increase font size",
			"diff.count": "{n} differences",
			"diff.countZero": "No differences",
			"diff.countHint": "Total differences; after navigation shows current/total",
			"diff.stageHunk": "Stage",
			"diff.revertHunk": "Revert",
			"diff.stageFile": "Stage file",
			"diff.revertFile": "Revert file",
			"diff.prevHunk": "Previous difference",
			"diff.nextHunk": "Next difference",
			"diff.unchanged": "⋯ {n} unchanged lines, click to expand",
			"diff.stagedExists": "File has staged changes; unstage first",
			"diff.untracked": "Untracked file; track it first",
			"diff.noHead": "Repository has no commits yet",
			"diff.truncatedReadonly": "Truncated (over 512 KB) — inline editing disabled",
			"menu.more": "More",
			"menu.showDiff": "Show Diff",
			"menu.stage": "Stage",
			"menu.unstage": "Unstage",
			"menu.rollback": "Rollback",
			"menu.ignore": "Ignore",
			"menu.ignored": "Added to ignore rules",
			"menu.ignoredTracked": "Added to ignore rules (tracked files are not affected and stay listed)",
			"menu.showHistory": "Show History",
			"menu.moveTo": "Move to Changelist",
			"menu.copyPath": "Copy Path",
			"menu.copyHash": "Copy Commit Hash",
			"menu.copyHashes": "Copy Commit Hashes ({n})",
			"menu.copyMetadata": "Copy Metadata",
			"menu.copyMessage": "Copy Commit Message",
			"menu.removeRecentDir": "Remove from list",
			"menu.checkoutRevision": "Checkout Revision",
			"menu.checkoutRevisionConfirm": "Check out {hash} in detached HEAD mode?",
			"menu.createBranchHere": "Create Branch Here…",
			"menu.createBranchHerePrompt": "New branch name",
			"menu.resetToHere": "Reset Current Branch to Here",
			"menu.newBranchFrom": "New Branch from…",
			"menu.newBranchFromPrompt": "New branch name",
			"menu.mergeIntoCurrent": "Merge into Current",
			"menu.rebaseCurrentOnto": "Rebase Current onto",
			"changelist.new": "New Changelist",
			"changelist.newPrompt": "Changelist name",
			"changelist.setActive": "Set Active",
			"changelist.rename": "Rename",
			"changelist.renamePrompt": "New name",
			"changelist.delete": "Delete Changelist",
			"changelist.deleteConfirm": "Delete changelist {name}? Its files become unassigned",
			"changelist.moveCheckedHere": "Move Checked Files Here",
			"changelist.moved": "Files moved",
			"changelist.created": "Changelist created",
			"changelist.activated": "Active changelist switched",
			"changelist.renamed": "Renamed",
			"changelist.deleted": "Changelist deleted",
			"push.preview": "Push",
			"push.newBranch": "new branch",
			"push.followTags": "Follow tags",
			"push.followTagsHint": "Also push tags pointing into the pushed commits (--follow-tags)",
			"push.upToDate": "Nothing to push",
			"rebase.title": "Interactive Rebase",
			"rebase.onto": "Onto",
			"rebase.start": "Start Rebase",
			"rebase.pick": "pick",
			"rebase.reword": "reword",
			"rebase.squash": "squash",
			"rebase.fixup": "fixup",
			"rebase.drop": "drop",
			"rebase.nothing": "No commits between base and HEAD",
			"rebase.firstHint": "The first commit cannot be squashed/fixed up; it will be reworded",
			"merge.skip": "Skip",
			"merge.skipHint": "Skip the conflicting commit (git rebase --skip)",
			"merge.skipped": "Commit skipped",
			"merge.skipConflicts": "{n} conflicts remain after skipping",
			"history.allBranches": "All branches",
			"history.author": "Author",
			"history.allAuthors": "All authors",
			"history.since": "Since",
			"history.until": "Until",
			"log.worktreeDiff": "Show Diff with Working Tree",
			"log.worktreeFiles": "Files changed vs working tree",
			"tabs.changes": "Changes",
			"tabs.files": "Files",
			"tabs.merge": "Merge",
			"tabs.history": "History",
			"tabs.branches": "Branches",
			"tabs.remotes": "Remotes",
			"tabs.config": "Config",
			"branch.current": "current",
			"branch.local": "Local branches",
			"branch.remote": "Remote branches",
			"branch.empty": "No branches",
			"branch.noRemotes": "No remotes configured (add one in the Remotes tab)",
			"branch.remoteEmpty": "No remote branches yet (fetch to see them)",
			"branch.checkout": "Checkout",
			"branch.rename": "Rename",
			"branch.delete": "Delete",
			"branch.forceDelete": "Force delete",
			"branch.create": "New branch",
			"branch.createPrompt": "New branch name (from current HEAD)",
			"branch.renamePrompt": "New branch name:",
			"branch.deleteConfirm": "Delete branch {name}?",
			"branch.switched": "Switched to {name}",
			"branch.switchHint": "Switch branch (checkout)",
			"branch.created": "Created branch {name}",
			"branch.renamed": "Renamed {oldName} → {newName}",
			"branch.deleted": "Deleted branch {name}",
			"reset.action": "Reset",
			"reset.pick": "Reset mode:",
			"reset.hint": "Reset {branch} (soft: keep staged / mixed: unstage / hard: discard)",
			"reset.done": "Reset {branch} ({mode})",
			"compare.action": "Compare",
			"compare.hint": "Compare current branch with {branch}",
			"compare.title": "{from} ↔ {to}",
			"compare.files": "files",
			"tag.title": "Tags",
			"tag.empty": "No tags",
			"tag.delete": "Delete",
			"tag.deleteConfirm": "Delete tag {name}?",
			"tag.deleted": "Deleted tag {name}",
			"merge.inprogress": "Merge in progress — resolve every conflict, then commit",
			"merge.inprogressInto": "Merge in progress — merging {source} into {target}",
			"merge.conflictsRemain": "{n} conflicts remain",
			"merge.conflictsRemainInto": "{n} conflicts remain — merging {source} into {target}",
			"merge.from": "Merge from",
			"merge.into": "into",
			"merge.noTargets": "No other branches to merge (make the first commit or create one)",
			"merge.switchConfirm": "Switch to {target} and merge {source} into it. Continue?",
			"merge.button": "Merge {source} into {target}",
			"merge.noFF": "Create a merge commit (--no-ff)",
			"merge.alreadyUpToDate": "{target} already contains all commits from {source}",
			"merge.fastForward": "Fast-forwarded {source} → {target} ({short}, no merge commit)",
			"merge.prev": "Previous conflict",
			"merge.next": "Next conflict",
			"merge.acceptLeft": "Accept Left",
			"merge.acceptRight": "Accept Right",
			"merge.acceptLeftHint": "Replace the current conflict block with the left (current branch) side",
			"merge.acceptRightHint": "Replace the current conflict block with the right (incoming branch) side",
			"merge.applyLeft": "Apply to result (take the left / current branch)",
			"merge.applyRight": "Apply to result (take the right / incoming branch)",
			"merge.notApply": "Do not apply to result (remove this block)",
			"merge.removeBlock": "Remove this conflict block from the result",
			"merge.editMode": "Edit",
			"merge.viewMode": "View",
			"merge.resultTitle": "Result",
			"merge.remaining": "{n} unresolved conflicts",
			"merge.allResolved": "All conflicts resolved",
			"merge.undo": "Undo",
			"merge.restore": "Reverse: restore this conflict block",
			"merge.redo": "Redo",
			"pull.title": "Pull",
			"pull.fetch": "Fetch",
			"pull.merge": "Merge",
			"pull.rebase": "Rebase",
			"pull.action": "Pull",
			"pull.done": "Pulled and merged",
			"pull.upToDate": "Already up to date",
			"pull.conflicts": "Pull produced {n} conflicts — resolve them in the Merge tab",
			"pull.failed": "Pull failed",
			"pull.noRemote": "No remotes",
			"fetch.done": "Fetched",
			"files.noDir": "No directory selected",
			"files.refresh": "Refresh directory",
			"files.new": "New file",
			"files.newPrompt": "New file (under {base}):",
			"files.created": "Created {path}",
			"files.delete": "Delete",
			"files.deleteConfirm": "Delete file {path}?",
			"files.deleteDirConfirm": "Delete directory {path} and all its contents? This cannot be undone!",
			"files.deleted": "Deleted {path}",
			"files.placeholder": "Select a file on the left to view or edit",
			"files.binary": "Binary file — cannot preview or edit",
			"files.empty": "Directory is empty",
			"files.truncated": "Truncated (over 512 KB) — read-only preview",
			"tabs.stash": "Stash",
			"stash.apply": "Apply",
			"stash.applyHint": "Apply this stash (keep it)",
			"stash.applied": "Applied stash@{index}",
			"stash.applyConflicts": "Apply produced {n} conflicts — resolve them in the Merge tab",
			"stash.show": "Show",
			"stash.showHint": "Show the files in this stash",
			"stash.showEmpty": "(no file changes)",
			"stash.branch": "Branch",
			"stash.branchHint": "Create and switch to a branch from this stash",
			"stash.branchPrompt": "New branch name",
			"stash.branched": "Created and switched to branch {branch} from stash@{index}",
			"stash.clear": "Clear all",
			"stash.clearHint": "Drop every stash (not recoverable)",
			"stash.clearConfirm": "Clear all stashes? This cannot be undone.",
			"stash.cleared": "Stashes cleared",
			"files.savedFlash": "Saved ✓",
			"stash.title": "Stash",
			"stash.message": "Message (optional)",
			"stash.untracked": "Include untracked",
			"stash.action": "Stash",
			"stash.empty": "No stashes",
			"stash.restore": "Pop",
			"stash.drop": "Drop",
			"stash.done": "Stashed changes",
			"stash.nothing": "Nothing to stash",
			"stash.popped": "Restored stash@{index}",
			"stash.popConflicts": "Restore produced {n} conflicts — resolve them in the Merge tab",
			"stash.dropped": "Dropped stash@{index}",
			"stash.dropConfirm": "Drop stash@{index}: {message}?",
			"remote.title": "Remotes",
			"remote.add": "Add",
			"remote.name": "Name",
			"remote.url": "URL",
			"remote.empty": "No remotes",
			"remote.added": "Added remote {name}",
			"remote.removed": "Removed remote {name}",
			"remote.remove": "Remove",
			"remote.removeConfirm": "Remove remote {name}?",
			"remote.push": "Push",
			"remote.pushHint": "Push current branch {branch} to {name}",
			"remote.fetch": "Fetch",
			"remote.fetchHint": "Fetch the latest branch refs from this remote",
			"remote.edit": "Edit",
			"remote.save": "Save",
			"remote.edited": "Updated remote {name}",
			"push.done": "Pushed {branch} → {remote}",
			"push.doneTarget": "Pushed {local} → {target} ({remote})",
			"push.localPlaceholder": "Local branch",
			"push.remotePlaceholder": "Remote branch (default {branch})",
			"push.force": "Force push",
			"push.forceHint": "Force push (--force-with-lease): overwrites the remote branch history and may lose remote commits!",
			"push.remoteBranchSelect": "Remote branch to push to (same-name branch first)",
			"push.noRemoteBranches": "(no remote branches — will push to the same name)",
			"push.andCommit": "Commit & Push",
			"push.hint": "Commit then push to {remote} (branch {branch})",
			"push.commitOkPushFailed": "Committed {short}: {subject}, but push failed: {message}",
			"merge.abort": "Abort merge",
			"merge.continue": "Complete merge & commit",
			"merge.done": "Merged: {short} {subject}",
			"merge.commitMessage": "Merge commit message (empty uses default)",
			"conflict.ours": "Keep current branch",
			"conflict.theirs": "Keep incoming branch",
			"conflict.edit": "Edit manually",
			"conflict.save": "Save & mark resolved",
			"conflict.resolved": "Resolved and staged",
			"history.empty": "No commits yet",
			"history.branch": "Branch",
			"history.current": "current",
			"history.checkout": "Switch",
			"history.create": "New branch",
			"history.createPrompt": "New branch name",
			"history.switched": "Switched to {branch}",
			"history.created": "Created branch {branch}",
			"log.select": "Select a commit on the left",
			"log.hash": "Commit",
			"log.author": "Author",
			"log.date": "Date",
			"log.parents": "Parents",
			"log.authorDate": "Author date",
			"log.committer": "Committer",
			"log.commitDate": "Commit date",
			"log.files": "Files",
			"log.changedFiles": "Changed files",
			"log.showMore": "{n} more files — load more",
			"history.search": "Search commits…",
			"history.fileFilter": "File history: type a path and press Enter",
			"history.fileFilterClear": "Clear file filter",
			"history.selectedCount": "Selected {n} commits",
			"history.more": "More",
			"history.moreHint": "Checkout, pull, merge, or rebase the branch selected in the branch filter (title bar)",
			"history.checkoutBranch": "Checkout {branch}",
			"history.pullBranch": "Pull {branch}",
			"history.mergeToCurrent": "Merge {from} into {to}",
			"history.rebaseToCurrent": "Rebase {from} onto {to}",
			"history.merged": "Merged {from} into {to}",
			"history.rebased": "Rebased {from} onto {to}",
			"history.filePaneResize": "Drag to resize the changed-files width",
			"history.showInfo": "Show commit info",
			"history.hideInfo": "Hide commit info",
			"cherryPick": "Cherry-pick",
			"cherryPick.hint": "Apply this commit to the current branch",
			"cherryPick.multi": "Cherry-pick {n} selected commits",
			"cherryPick.conflicts": "Cherry-pick produced {n} conflicts — resolve them in the Merge tab",
			"revert": "Revert",
			"revert.hint": "Undo the changes of this commit",
			"revert.multi": "Revert {n} selected commits",
			"squash.multi": "Squash {n} selected commits",
			"squash.prompt": "Squash commit message:",
			"squash.done": "Squashed into a single commit",
			"revert.conflicts": "Revert produced {n} conflicts — resolve them in the Merge tab",
			"tag.create": "Tag",
			"tag.createPrompt": "New tag name",
			"tag.created": "Created tag {name}",
			"tag.hint": "Create a tag on this commit",
			"repo.placeholder": "Pick a workspace directory or type one; Enter to apply",
			"repo.notRepo": "“{dir}” is not a git repository",
			"repo.gitInitDone": "Initialized a git repository here",
			"action.gitInit": "Initialize repository (git init)",
			"clone.title": "Clone Repository",
			"clone.action": "Clone",
			"clone.url": "Repository URL",
			"clone.urlPlaceholder": "https://github.com/user/repo.git or git@github.com:user/repo.git",
			"clone.target": "Target directory",
			"clone.targetPlaceholder": "Full target path (created if missing, must be empty if it exists)",
			"clone.useSession": "Use session dir",
			"clone.useSessionHint": "Clone under the session working directory (repo name appended)",
			"clone.sessionHint": "Session directory: {dir}",
			"clone.sessionUnavailable": "Session working directory unavailable",
			"clone.submit": "Clone",
			"clone.busy": "Cloning…",
			"clone.done": "Cloned to {root}",
			"gitignore.title": "AI-analyze and update .gitignore",
			"gitignore.updated": "Updated .gitignore",
			"gitignore.unchanged": ".gitignore needs no changes",
			"win.minimize": "Minimize",
			"win.fullscreen": "Fullscreen",
			"win.exitFullscreen": "Exit fullscreen",
			"win.close": "Close",
			"repo.following": "Following the current session's working directory",
			"repo.pinned": "Pinned directory (no longer follows the session)",
			"float.title": "Float as window",
			"float.dock": "Dock back above the composer",
			"resize.hint": "Drag to resize (never auto-resizes)",
			"splitter.resize": "Drag to resize the list; double-click to reset",
			"pane.collapse": "Collapse file list",
			"pane.restore": "Expand file list",
			"discard.confirm": "Discard working-tree changes to {path}? This cannot be undone."
		};
		//#endregion
		//#region node_modules/zod/v4/core/core.js
		var _a$1;
		function $constructor(name, initializer, params) {
			function init(inst, def) {
				if (!inst._zod) Object.defineProperty(inst, "_zod", {
					value: {
						def,
						constr: _,
						traits: /* @__PURE__ */ new Set()
					},
					enumerable: false
				});
				if (inst._zod.traits.has(name)) return;
				inst._zod.traits.add(name);
				initializer(inst, def);
				const proto = _.prototype;
				const keys = Object.keys(proto);
				for (let i = 0; i < keys.length; i++) {
					const k = keys[i];
					if (!(k in inst)) inst[k] = proto[k].bind(inst);
				}
			}
			const Parent = params?.Parent ?? Object;
			class Definition extends Parent {}
			Object.defineProperty(Definition, "name", { value: name });
			function _(def) {
				var _a;
				const inst = params?.Parent ? new Definition() : this;
				init(inst, def);
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				for (const fn of inst._zod.deferred) fn();
				return inst;
			}
			Object.defineProperty(_, "init", { value: init });
			Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
				if (params?.Parent && inst instanceof params.Parent) return true;
				return inst?._zod?.traits?.has(name);
			} });
			Object.defineProperty(_, "name", { value: name });
			return _;
		}
		var $ZodAsyncError = class extends Error {
			constructor() {
				super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
			}
		};
		var $ZodEncodeError = class extends Error {
			constructor(name) {
				super(`Encountered unidirectional transform during encode: ${name}`);
				this.name = "ZodEncodeError";
			}
		};
		(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
		const globalConfig = globalThis.__zod_globalConfig;
		function config(newConfig) {
			if (newConfig) Object.assign(globalConfig, newConfig);
			return globalConfig;
		}
		//#endregion
		//#region node_modules/zod/v4/core/util.js
		function getEnumValues(entries) {
			const numericValues = Object.values(entries).filter((v) => typeof v === "number");
			return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
		}
		function jsonStringifyReplacer(_, value) {
			if (typeof value === "bigint") return value.toString();
			return value;
		}
		function cached(getter) {
			return { get value() {
				{
					const value = getter();
					Object.defineProperty(this, "value", { value });
					return value;
				}
			} };
		}
		function nullish(input) {
			return input === null || input === void 0;
		}
		function cleanRegex(source) {
			const start = source.startsWith("^") ? 1 : 0;
			const end = source.endsWith("$") ? source.length - 1 : source.length;
			return source.slice(start, end);
		}
		function floatSafeRemainder(val, step) {
			const ratio = val / step;
			const roundedRatio = Math.round(ratio);
			const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
			if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
			return ratio - roundedRatio;
		}
		const EVALUATING = /* @__PURE__*/ Symbol("evaluating");
		function defineLazy(object, key, getter) {
			let value = void 0;
			Object.defineProperty(object, key, {
				get() {
					if (value === EVALUATING) return;
					if (value === void 0) {
						value = EVALUATING;
						value = getter();
					}
					return value;
				},
				set(v) {
					Object.defineProperty(object, key, { value: v });
				},
				configurable: true
			});
		}
		function assignProp(target, prop, value) {
			Object.defineProperty(target, prop, {
				value,
				writable: true,
				enumerable: true,
				configurable: true
			});
		}
		function mergeDefs(...defs) {
			const mergedDescriptors = {};
			for (const def of defs) {
				const descriptors = Object.getOwnPropertyDescriptors(def);
				Object.assign(mergedDescriptors, descriptors);
			}
			return Object.defineProperties({}, mergedDescriptors);
		}
		function esc(str) {
			return JSON.stringify(str);
		}
		function slugify(input) {
			return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
		}
		const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
		function isObject(data) {
			return typeof data === "object" && data !== null && !Array.isArray(data);
		}
		const allowsEval = /* @__PURE__*/ cached(() => {
			if (globalConfig.jitless) return false;
			if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
			try {
				new Function("");
				return true;
			} catch (_) {
				return false;
			}
		});
		function isPlainObject(o) {
			if (isObject(o) === false) return false;
			const ctor = o.constructor;
			if (ctor === void 0) return true;
			if (typeof ctor !== "function") return true;
			const prot = ctor.prototype;
			if (isObject(prot) === false) return false;
			if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
			return true;
		}
		function shallowClone(o) {
			if (isPlainObject(o)) return { ...o };
			if (Array.isArray(o)) return [...o];
			if (o instanceof Map) return new Map(o);
			if (o instanceof Set) return new Set(o);
			return o;
		}
		const propertyKeyTypes = /* @__PURE__*/ new Set([
			"string",
			"number",
			"symbol"
		]);
		function escapeRegex(str) {
			return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
		function clone(inst, def, params) {
			const cl = new inst._zod.constr(def ?? inst._zod.def);
			if (!def || params?.parent) cl._zod.parent = inst;
			return cl;
		}
		function normalizeParams(_params) {
			const params = _params;
			if (!params) return {};
			if (typeof params === "string") return { error: () => params };
			if (params?.message !== void 0) {
				if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
				params.error = params.message;
			}
			delete params.message;
			if (typeof params.error === "string") return {
				...params,
				error: () => params.error
			};
			return params;
		}
		function optionalKeys(shape) {
			return Object.keys(shape).filter((k) => {
				return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
			});
		}
		const NUMBER_FORMAT_RANGES = {
			safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
			int32: [-2147483648, 2147483647],
			uint32: [0, 4294967295],
			float32: [-34028234663852886e22, 34028234663852886e22],
			float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
		};
		function pick(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const newShape = {};
					for (const key in mask) {
						if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						newShape[key] = currDef.shape[key];
					}
					assignProp(this, "shape", newShape);
					return newShape;
				},
				checks: []
			}));
		}
		function omit(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const newShape = { ...schema._zod.def.shape };
					for (const key in mask) {
						if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						delete newShape[key];
					}
					assignProp(this, "shape", newShape);
					return newShape;
				},
				checks: []
			}));
		}
		function extend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) {
				const existingShape = schema._zod.def.shape;
				for (const key in shape) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
			}
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const _shape = {
					...schema._zod.def.shape,
					...shape
				};
				assignProp(this, "shape", _shape);
				return _shape;
			} }));
		}
		function safeExtend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const _shape = {
					...schema._zod.def.shape,
					...shape
				};
				assignProp(this, "shape", _shape);
				return _shape;
			} }));
		}
		function merge(a, b) {
			if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
			return clone(a, mergeDefs(a._zod.def, {
				get shape() {
					const _shape = {
						...a._zod.def.shape,
						...b._zod.def.shape
					};
					assignProp(this, "shape", _shape);
					return _shape;
				},
				get catchall() {
					return b._zod.def.catchall;
				},
				checks: b._zod.def.checks ?? []
			}));
		}
		function partial(Class, schema, mask) {
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) throw new Error(".partial() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const oldShape = schema._zod.def.shape;
					const shape = { ...oldShape };
					if (mask) for (const key in mask) {
						if (!(key in oldShape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						shape[key] = Class ? new Class({
							type: "optional",
							innerType: oldShape[key]
						}) : oldShape[key];
					}
					else for (const key in oldShape) shape[key] = Class ? new Class({
						type: "optional",
						innerType: oldShape[key]
					}) : oldShape[key];
					assignProp(this, "shape", shape);
					return shape;
				},
				checks: []
			}));
		}
		function required(Class, schema, mask) {
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const oldShape = schema._zod.def.shape;
				const shape = { ...oldShape };
				if (mask) for (const key in mask) {
					if (!(key in shape)) throw new Error(`Unrecognized key: "${key}"`);
					if (!mask[key]) continue;
					shape[key] = new Class({
						type: "nonoptional",
						innerType: oldShape[key]
					});
				}
				else for (const key in oldShape) shape[key] = new Class({
					type: "nonoptional",
					innerType: oldShape[key]
				});
				assignProp(this, "shape", shape);
				return shape;
			} }));
		}
		function aborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
			return false;
		}
		function explicitlyAborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
			return false;
		}
		function prefixIssues(path, issues) {
			return issues.map((iss) => {
				var _a;
				(_a = iss).path ?? (_a.path = []);
				iss.path.unshift(path);
				return iss;
			});
		}
		function unwrapMessage(message) {
			return typeof message === "string" ? message : message?.message;
		}
		function finalizeIssue(iss, ctx, config) {
			const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
			const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
			rest.path ?? (rest.path = []);
			rest.message = message;
			if (ctx?.reportInput) rest.input = _input;
			return rest;
		}
		function getLengthableOrigin(input) {
			if (Array.isArray(input)) return "array";
			if (typeof input === "string") return "string";
			return "unknown";
		}
		function issue(...args) {
			const [iss, input, inst] = args;
			if (typeof iss === "string") return {
				message: iss,
				code: "custom",
				input,
				inst
			};
			return { ...iss };
		}
		//#endregion
		//#region node_modules/zod/v4/core/errors.js
		const initializer$1 = (inst, def) => {
			inst.name = "$ZodError";
			Object.defineProperty(inst, "_zod", {
				value: inst._zod,
				enumerable: false
			});
			Object.defineProperty(inst, "issues", {
				value: def,
				enumerable: false
			});
			inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
			Object.defineProperty(inst, "toString", {
				value: () => inst.message,
				enumerable: false
			});
		};
		const $ZodError = $constructor("$ZodError", initializer$1);
		const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
		function flattenError(error, mapper = (issue) => issue.message) {
			const fieldErrors = {};
			const formErrors = [];
			for (const sub of error.issues) if (sub.path.length > 0) {
				fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
				fieldErrors[sub.path[0]].push(mapper(sub));
			} else formErrors.push(mapper(sub));
			return {
				formErrors,
				fieldErrors
			};
		}
		function formatError(error, mapper = (issue) => issue.message) {
			const fieldErrors = { _errors: [] };
			const processError = (error, path = []) => {
				for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
				else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else {
					const fullpath = [...path, ...issue.path];
					if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
					else {
						let curr = fieldErrors;
						let i = 0;
						while (i < fullpath.length) {
							const el = fullpath[i];
							if (!(i === fullpath.length - 1)) curr[el] = curr[el] || { _errors: [] };
							else {
								curr[el] = curr[el] || { _errors: [] };
								curr[el]._errors.push(mapper(issue));
							}
							curr = curr[el];
							i++;
						}
					}
				}
			};
			processError(error);
			return fieldErrors;
		}
		//#endregion
		//#region node_modules/zod/v4/core/parse.js
		const _parse = (_Err) => (schema, value, _ctx, _params) => {
			const ctx = _ctx ? {
				..._ctx,
				async: false
			} : { async: false };
			const result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			if (result.issues.length) {
				const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
				captureStackTrace(e, _params?.callee);
				throw e;
			}
			return result.value;
		};
		const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true
			} : { async: true };
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			if (result.issues.length) {
				const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
				captureStackTrace(e, params?.callee);
				throw e;
			}
			return result.value;
		};
		const _safeParse = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: false
			} : { async: false };
			const result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			return result.issues.length ? {
				success: false,
				error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			} : {
				success: true,
				data: result.value
			};
		};
		const safeParse$1 = /* @__PURE__*/ _safeParse($ZodRealError);
		const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true
			} : { async: true };
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			return result.issues.length ? {
				success: false,
				error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			} : {
				success: true,
				data: result.value
			};
		};
		const safeParseAsync$1 = /* @__PURE__*/ _safeParseAsync($ZodRealError);
		const _encode = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _parse(_Err)(schema, value, ctx);
		};
		const _decode = (_Err) => (schema, value, _ctx) => {
			return _parse(_Err)(schema, value, _ctx);
		};
		const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _parseAsync(_Err)(schema, value, ctx);
		};
		const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
			return _parseAsync(_Err)(schema, value, _ctx);
		};
		const _safeEncode = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParse(_Err)(schema, value, ctx);
		};
		const _safeDecode = (_Err) => (schema, value, _ctx) => {
			return _safeParse(_Err)(schema, value, _ctx);
		};
		const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParseAsync(_Err)(schema, value, ctx);
		};
		const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
			return _safeParseAsync(_Err)(schema, value, _ctx);
		};
		//#endregion
		//#region node_modules/zod/v4/core/regexes.js
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const cuid = /^[cC][0-9a-z]{6,}$/;
		const cuid2 = /^[0-9a-z]+$/;
		const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
		const xid = /^[0-9a-vA-V]{20}$/;
		const ksuid = /^[A-Za-z0-9]{27}$/;
		const nanoid = /^[a-zA-Z0-9_-]{21}$/;
		/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
		const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
		/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
		const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
		/** Returns a regex for validating an RFC 9562/4122 UUID.
		*
		* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
		const uuid = (version) => {
			if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
			return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
		};
		/** Practical email validation */
		const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
		const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
		function emoji() {
			return new RegExp(_emoji$1, "u");
		}
		const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
		const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
		const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
		const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
		const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
		const base64url = /^[A-Za-z0-9_-]*$/;
		const httpProtocol = /^https?$/;
		const e164 = /^\+[1-9]\d{6,14}$/;
		const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
		const date$1 = /*@__PURE__*/ new RegExp(`^${dateSource}$`);
		function timeSource(args) {
			const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
			return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
		}
		function time$1(args) {
			return new RegExp(`^${timeSource(args)}$`);
		}
		function datetime$1(args) {
			const time = timeSource({ precision: args.precision });
			const opts = ["Z"];
			if (args.local) opts.push("");
			if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
			const timeRegex = `${time}(?:${opts.join("|")})`;
			return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
		}
		const string$1 = (params) => {
			const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
			return new RegExp(`^${regex}$`);
		};
		const integer = /^-?\d+$/;
		const number$1 = /^-?\d+(?:\.\d+)?$/;
		const boolean$1 = /^(?:true|false)$/i;
		const _null$2 = /^null$/i;
		const lowercase = /^[^A-Z]*$/;
		const uppercase = /^[^a-z]*$/;
		//#endregion
		//#region node_modules/zod/v4/core/checks.js
		const $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
			var _a;
			inst._zod ?? (inst._zod = {});
			inst._zod.def = def;
			(_a = inst._zod).onattach ?? (_a.onattach = []);
		});
		const numericOriginMap = {
			number: "number",
			bigint: "bigint",
			object: "date"
		};
		const $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
				if (def.value < curr) {
					if (def.inclusive) bag.maximum = def.value;
					else bag.exclusiveMaximum = def.value;
				}
			});
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
				payload.issues.push({
					origin,
					code: "too_big",
					maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
				if (def.value > curr) {
					if (def.inclusive) bag.minimum = def.value;
					else bag.exclusiveMinimum = def.value;
				}
			});
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
				payload.issues.push({
					origin,
					code: "too_small",
					minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.onattach.push((inst) => {
				var _a;
				(_a = inst._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
			});
			inst._zod.check = (payload) => {
				if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
				if (typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
				payload.issues.push({
					origin: typeof payload.value,
					code: "not_multiple_of",
					divisor: def.value,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
			$ZodCheck.init(inst, def);
			def.format = def.format || "float64";
			const isInt = def.format?.includes("int");
			const origin = isInt ? "int" : "number";
			const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.format = def.format;
				bag.minimum = minimum;
				bag.maximum = maximum;
				if (isInt) bag.pattern = integer;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (isInt) {
					if (!Number.isInteger(input)) {
						payload.issues.push({
							expected: origin,
							format: def.format,
							code: "invalid_type",
							continue: false,
							input,
							inst
						});
						return;
					}
					if (!Number.isSafeInteger(input)) {
						if (input > 0) payload.issues.push({
							input,
							code: "too_big",
							maximum: Number.MAX_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						else payload.issues.push({
							input,
							code: "too_small",
							minimum: Number.MIN_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						return;
					}
				}
				if (input < minimum) payload.issues.push({
					origin: "number",
					input,
					code: "too_small",
					minimum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
				if (input > maximum) payload.issues.push({
					origin: "number",
					input,
					code: "too_big",
					maximum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const curr = inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
				if (def.maximum < curr) inst._zod.bag.maximum = def.maximum;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (input.length <= def.maximum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_big",
					maximum: def.maximum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const curr = inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
				if (def.minimum > curr) inst._zod.bag.minimum = def.minimum;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (input.length >= def.minimum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_small",
					minimum: def.minimum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.minimum = def.length;
				bag.maximum = def.length;
				bag.length = def.length;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				const length = input.length;
				if (length === def.length) return;
				const origin = getLengthableOrigin(input);
				const tooBig = length > def.length;
				payload.issues.push({
					origin,
					...tooBig ? {
						code: "too_big",
						maximum: def.length
					} : {
						code: "too_small",
						minimum: def.length
					},
					inclusive: true,
					exact: true,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
			var _a, _b;
			$ZodCheck.init(inst, def);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.format = def.format;
				if (def.pattern) {
					bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
					bag.patterns.add(def.pattern);
				}
			});
			if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: def.format,
					input: payload.value,
					...def.pattern ? { pattern: def.pattern.toString() } : {},
					inst,
					continue: !def.abort
				});
			});
			else (_b = inst._zod).check ?? (_b.check = () => {});
		});
		const $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "regex",
					input: payload.value,
					pattern: def.pattern.toString(),
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
			def.pattern ?? (def.pattern = lowercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
			def.pattern ?? (def.pattern = uppercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
			$ZodCheck.init(inst, def);
			const escapedRegex = escapeRegex(def.includes);
			const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
			def.pattern = pattern;
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.includes(def.includes, def.position)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "includes",
					includes: def.includes,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.startsWith(def.prefix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "starts_with",
					prefix: def.prefix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.endsWith(def.suffix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "ends_with",
					suffix: def.suffix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.check = (payload) => {
				payload.value = def.tx(payload.value);
			};
		});
		//#endregion
		//#region node_modules/zod/v4/core/doc.js
		var Doc = class {
			constructor(args = []) {
				this.content = [];
				this.indent = 0;
				if (this) this.args = args;
			}
			indented(fn) {
				this.indent += 1;
				fn(this);
				this.indent -= 1;
			}
			write(arg) {
				if (typeof arg === "function") {
					arg(this, { execution: "sync" });
					arg(this, { execution: "async" });
					return;
				}
				const lines = arg.split("\n").filter((x) => x);
				const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
				const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
				for (const line of dedented) this.content.push(line);
			}
			compile() {
				const F = Function;
				const args = this?.args;
				const lines = [...(this?.content ?? [``]).map((x) => `  ${x}`)];
				return new F(...args, lines.join("\n"));
			}
		};
		//#endregion
		//#region node_modules/zod/v4/core/versions.js
		const version = {
			major: 4,
			minor: 4,
			patch: 3
		};
		//#endregion
		//#region node_modules/zod/v4/core/schemas.js
		const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
			var _a;
			inst ?? (inst = {});
			inst._zod.def = def;
			inst._zod.bag = inst._zod.bag || {};
			inst._zod.version = version;
			const checks = [...inst._zod.def.checks ?? []];
			if (inst._zod.traits.has("$ZodCheck")) checks.unshift(inst);
			for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
			if (checks.length === 0) {
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				inst._zod.deferred?.push(() => {
					inst._zod.run = inst._zod.parse;
				});
			} else {
				const runChecks = (payload, checks, ctx) => {
					let isAborted = aborted(payload);
					let asyncResult;
					for (const ch of checks) {
						if (ch._zod.def.when) {
							if (explicitlyAborted(payload)) continue;
							if (!ch._zod.def.when(payload)) continue;
						} else if (isAborted) continue;
						const currLen = payload.issues.length;
						const _ = ch._zod.check(payload);
						if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
						if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
							await _;
							if (payload.issues.length === currLen) return;
							if (!isAborted) isAborted = aborted(payload, currLen);
						});
						else {
							if (payload.issues.length === currLen) continue;
							if (!isAborted) isAborted = aborted(payload, currLen);
						}
					}
					if (asyncResult) return asyncResult.then(() => {
						return payload;
					});
					return payload;
				};
				const handleCanaryResult = (canary, payload, ctx) => {
					if (aborted(canary)) {
						canary.aborted = true;
						return canary;
					}
					const checkResult = runChecks(payload, checks, ctx);
					if (checkResult instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
					}
					return inst._zod.parse(checkResult, ctx);
				};
				inst._zod.run = (payload, ctx) => {
					if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
					if (ctx.direction === "backward") {
						const canary = inst._zod.parse({
							value: payload.value,
							issues: []
						}, {
							...ctx,
							skipChecks: true
						});
						if (canary instanceof Promise) return canary.then((canary) => {
							return handleCanaryResult(canary, payload, ctx);
						});
						return handleCanaryResult(canary, payload, ctx);
					}
					const result = inst._zod.parse(payload, ctx);
					if (result instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return result.then((result) => runChecks(result, checks, ctx));
					}
					return runChecks(result, checks, ctx);
				};
			}
			defineLazy(inst, "~standard", () => ({
				validate: (value) => {
					try {
						const r = safeParse$1(inst, value);
						return r.success ? { value: r.data } : { issues: r.error?.issues };
					} catch (_) {
						return safeParseAsync$1(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
					}
				},
				vendor: "zod",
				version: 1
			}));
		});
		const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string$1(inst._zod.bag);
			inst._zod.parse = (payload, _) => {
				if (def.coerce) try {
					payload.value = String(payload.value);
				} catch (_) {}
				if (typeof payload.value === "string") return payload;
				payload.issues.push({
					expected: "string",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		const $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			$ZodString.init(inst, def);
		});
		const $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
			def.pattern ?? (def.pattern = guid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
			if (def.version) {
				const v = {
					v1: 1,
					v2: 2,
					v3: 3,
					v4: 4,
					v5: 5,
					v6: 6,
					v7: 7,
					v8: 8
				}[def.version];
				if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
				def.pattern ?? (def.pattern = uuid(v));
			} else def.pattern ?? (def.pattern = uuid());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
			def.pattern ?? (def.pattern = email);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				try {
					const trimmed = payload.value.trim();
					if (!def.normalize && def.protocol?.source === httpProtocol.source) {
						if (!/^https?:\/\//i.test(trimmed)) {
							payload.issues.push({
								code: "invalid_format",
								format: "url",
								note: "Invalid URL format",
								input: payload.value,
								inst,
								continue: !def.abort
							});
							return;
						}
					}
					const url = new URL(trimmed);
					if (def.hostname) {
						def.hostname.lastIndex = 0;
						if (!def.hostname.test(url.hostname)) payload.issues.push({
							code: "invalid_format",
							format: "url",
							note: "Invalid hostname",
							pattern: def.hostname.source,
							input: payload.value,
							inst,
							continue: !def.abort
						});
					}
					if (def.protocol) {
						def.protocol.lastIndex = 0;
						if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) payload.issues.push({
							code: "invalid_format",
							format: "url",
							note: "Invalid protocol",
							pattern: def.protocol.source,
							input: payload.value,
							inst,
							continue: !def.abort
						});
					}
					if (def.normalize) payload.value = url.href;
					else payload.value = trimmed;
					return;
				} catch (_) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		const $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
			def.pattern ?? (def.pattern = emoji());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
			def.pattern ?? (def.pattern = nanoid);
			$ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
			def.pattern ?? (def.pattern = cuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
			def.pattern ?? (def.pattern = cuid2);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
			def.pattern ?? (def.pattern = ulid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
			def.pattern ?? (def.pattern = xid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
			def.pattern ?? (def.pattern = ksuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
			def.pattern ?? (def.pattern = datetime$1(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
			def.pattern ?? (def.pattern = date$1);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
			def.pattern ?? (def.pattern = time$1(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
			def.pattern ?? (def.pattern = duration$1);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
			def.pattern ?? (def.pattern = ipv4);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.format = `ipv4`;
		});
		const $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
			def.pattern ?? (def.pattern = ipv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.format = `ipv6`;
			inst._zod.check = (payload) => {
				try {
					new URL(`http://[${payload.value}]`);
				} catch {
					payload.issues.push({
						code: "invalid_format",
						format: "ipv6",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		const $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv4);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				const parts = payload.value.split("/");
				try {
					if (parts.length !== 2) throw new Error();
					const [address, prefix] = parts;
					if (!prefix) throw new Error();
					const prefixNum = Number(prefix);
					if (`${prefixNum}` !== prefix) throw new Error();
					if (prefixNum < 0 || prefixNum > 128) throw new Error();
					new URL(`http://[${address}]`);
				} catch {
					payload.issues.push({
						code: "invalid_format",
						format: "cidrv6",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		function isValidBase64(data) {
			if (data === "") return true;
			if (/\s/.test(data)) return false;
			if (data.length % 4 !== 0) return false;
			try {
				atob(data);
				return true;
			} catch {
				return false;
			}
		}
		const $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
			def.pattern ?? (def.pattern = base64);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.contentEncoding = "base64";
			inst._zod.check = (payload) => {
				if (isValidBase64(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		function isValidBase64URL(data) {
			if (!base64url.test(data)) return false;
			const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
			return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
		}
		const $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
			def.pattern ?? (def.pattern = base64url);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.contentEncoding = "base64url";
			inst._zod.check = (payload) => {
				if (isValidBase64URL(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
			def.pattern ?? (def.pattern = e164);
			$ZodStringFormat.init(inst, def);
		});
		function isValidJWT(token, algorithm = null) {
			try {
				const tokensParts = token.split(".");
				if (tokensParts.length !== 3) return false;
				const [header] = tokensParts;
				if (!header) return false;
				const parsedHeader = JSON.parse(atob(header));
				if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
				if (!parsedHeader.alg) return false;
				if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
				return true;
			} catch {
				return false;
			}
		}
		const $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (isValidJWT(payload.value, def.alg)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "jwt",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Number(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
				const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
				payload.issues.push({
					expected: "number",
					code: "invalid_type",
					input,
					inst,
					...received ? { received } : {}
				});
				return payload;
			};
		});
		const $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
			$ZodCheckNumberFormat.init(inst, def);
			$ZodNumber.init(inst, def);
		});
		const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = boolean$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Boolean(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "boolean") return payload;
				payload.issues.push({
					expected: "boolean",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodNull = /*@__PURE__*/ $constructor("$ZodNull", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = _null$2;
			inst._zod.values = /* @__PURE__ */ new Set([null]);
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (input === null) return payload;
				payload.issues.push({
					expected: "null",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload) => payload;
		});
		const $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _ctx) => {
				payload.issues.push({
					expected: "never",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		function handleArrayResult(result, final, index) {
			if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
			final.value[index] = result.value;
		}
		const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				if (!Array.isArray(input)) {
					payload.issues.push({
						expected: "array",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = Array(input.length);
				const proms = [];
				for (let i = 0; i < input.length; i++) {
					const item = input[i];
					const result = def.element._zod.run({
						value: item,
						issues: []
					}, ctx);
					if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
					else handleArrayResult(result, payload, i);
				}
				if (proms.length) return Promise.all(proms).then(() => payload);
				return payload;
			};
		});
		function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
			const isPresent = key in input;
			if (result.issues.length) {
				if (isOptionalIn && isOptionalOut && !isPresent) return;
				final.issues.push(...prefixIssues(key, result.issues));
			}
			if (!isPresent && !isOptionalIn) {
				if (!result.issues.length) final.issues.push({
					code: "invalid_type",
					expected: "nonoptional",
					input: void 0,
					path: [key]
				});
				return;
			}
			if (result.value === void 0) {
				if (isPresent) final.value[key] = void 0;
			} else final.value[key] = result.value;
		}
		function normalizeDef(def) {
			const keys = Object.keys(def.shape);
			for (const k of keys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
			const okeys = optionalKeys(def.shape);
			return {
				...def,
				keys,
				keySet: new Set(keys),
				numKeys: keys.length,
				optionalKeys: new Set(okeys)
			};
		}
		function handleCatchall(proms, input, payload, ctx, def, inst) {
			const unrecognized = [];
			const keySet = def.keySet;
			const _catchall = def.catchall._zod;
			const t = _catchall.def.type;
			const isOptionalIn = _catchall.optin === "optional";
			const isOptionalOut = _catchall.optout === "optional";
			for (const key in input) {
				if (key === "__proto__") continue;
				if (keySet.has(key)) continue;
				if (t === "never") {
					unrecognized.push(key);
					continue;
				}
				const r = _catchall.run({
					value: input[key],
					issues: []
				}, ctx);
				if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
				else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
			}
			if (unrecognized.length) payload.issues.push({
				code: "unrecognized_keys",
				keys: unrecognized,
				input,
				inst
			});
			if (!proms.length) return payload;
			return Promise.all(proms).then(() => {
				return payload;
			});
		}
		const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
			$ZodType.init(inst, def);
			if (!Object.getOwnPropertyDescriptor(def, "shape")?.get) {
				const sh = def.shape;
				Object.defineProperty(def, "shape", { get: () => {
					const newSh = { ...sh };
					Object.defineProperty(def, "shape", { value: newSh });
					return newSh;
				} });
			}
			const _normalized = cached(() => normalizeDef(def));
			defineLazy(inst._zod, "propValues", () => {
				const shape = def.shape;
				const propValues = {};
				for (const key in shape) {
					const field = shape[key]._zod;
					if (field.values) {
						propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
						for (const v of field.values) propValues[key].add(v);
					}
				}
				return propValues;
			});
			const isObject$1 = isObject;
			const catchall = def.catchall;
			let value;
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$1(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = {};
				const proms = [];
				const shape = value.shape;
				for (const key of value.keys) {
					const el = shape[key];
					const isOptionalIn = el._zod.optin === "optional";
					const isOptionalOut = el._zod.optout === "optional";
					const r = el._zod.run({
						value: input[key],
						issues: []
					}, ctx);
					if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
					else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
				}
				if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
				return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
			};
		});
		const $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
			$ZodObject.init(inst, def);
			const superParse = inst._zod.parse;
			const _normalized = cached(() => normalizeDef(def));
			const generateFastpass = (shape) => {
				const doc = new Doc([
					"shape",
					"payload",
					"ctx"
				]);
				const normalized = _normalized.value;
				const parseStr = (key) => {
					const k = esc(key);
					return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
				};
				doc.write(`const input = payload.value;`);
				const ids = Object.create(null);
				let counter = 0;
				for (const key of normalized.keys) ids[key] = `key_${counter++}`;
				doc.write(`const newResult = {};`);
				for (const key of normalized.keys) {
					const id = ids[key];
					const k = esc(key);
					const schema = shape[key];
					const isOptionalIn = schema?._zod?.optin === "optional";
					const isOptionalOut = schema?._zod?.optout === "optional";
					doc.write(`const ${id} = ${parseStr(key)};`);
					if (isOptionalIn && isOptionalOut) doc.write(`
		        if (${id}.issues.length) {
		          if (${k} in input) {
		            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
		              ...iss,
		              path: iss.path ? [${k}, ...iss.path] : [${k}]
		            })));
		          }
		        }
		        
		        if (${id}.value === undefined) {
		          if (${k} in input) {
		            newResult[${k}] = undefined;
		          }
		        } else {
		          newResult[${k}] = ${id}.value;
		        }
		        
		      `);
					else if (!isOptionalIn) doc.write(`
		        const ${id}_present = ${k} in input;
		        if (${id}.issues.length) {
		          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
		            ...iss,
		            path: iss.path ? [${k}, ...iss.path] : [${k}]
		          })));
		        }
		        if (!${id}_present && !${id}.issues.length) {
		          payload.issues.push({
		            code: "invalid_type",
		            expected: "nonoptional",
		            input: undefined,
		            path: [${k}]
		          });
		        }
		
		        if (${id}_present) {
		          if (${id}.value === undefined) {
		            newResult[${k}] = undefined;
		          } else {
		            newResult[${k}] = ${id}.value;
		          }
		        }
		
		      `);
					else doc.write(`
		        if (${id}.issues.length) {
		          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
		            ...iss,
		            path: iss.path ? [${k}, ...iss.path] : [${k}]
		          })));
		        }
		        
		        if (${id}.value === undefined) {
		          if (${k} in input) {
		            newResult[${k}] = undefined;
		          }
		        } else {
		          newResult[${k}] = ${id}.value;
		        }
		        
		      `);
				}
				doc.write(`payload.value = newResult;`);
				doc.write(`return payload;`);
				const fn = doc.compile();
				return (payload, ctx) => fn(shape, payload, ctx);
			};
			let fastpass;
			const isObject$2 = isObject;
			const jit = !globalConfig.jitless;
			const fastEnabled = jit && allowsEval.value;
			const catchall = def.catchall;
			let value;
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$2(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
					if (!fastpass) fastpass = generateFastpass(def.shape);
					payload = fastpass(payload, ctx);
					if (!catchall) return payload;
					return handleCatchall([], input, payload, ctx, value, inst);
				}
				return superParse(payload, ctx);
			};
		});
		function handleUnionResults(results, final, inst, ctx) {
			for (const result of results) if (result.issues.length === 0) {
				final.value = result.value;
				return final;
			}
			const nonaborted = results.filter((r) => !aborted(r));
			if (nonaborted.length === 1) {
				final.value = nonaborted[0].value;
				return nonaborted[0];
			}
			final.issues.push({
				code: "invalid_union",
				input: final.value,
				inst,
				errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			});
			return final;
		}
		const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
			defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
			defineLazy(inst._zod, "values", () => {
				if (def.options.every((o) => o._zod.values)) return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
			});
			defineLazy(inst._zod, "pattern", () => {
				if (def.options.every((o) => o._zod.pattern)) {
					const patterns = def.options.map((o) => o._zod.pattern);
					return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
				}
			});
			const first = def.options.length === 1 ? def.options[0]._zod.run : null;
			inst._zod.parse = (payload, ctx) => {
				if (first) return first(payload, ctx);
				let async = false;
				const results = [];
				for (const option of def.options) {
					const result = option._zod.run({
						value: payload.value,
						issues: []
					}, ctx);
					if (result instanceof Promise) {
						results.push(result);
						async = true;
					} else {
						if (result.issues.length === 0) return result;
						results.push(result);
					}
				}
				if (!async) return handleUnionResults(results, payload, inst, ctx);
				return Promise.all(results).then((results) => {
					return handleUnionResults(results, payload, inst, ctx);
				});
			};
		});
		const $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				const left = def.left._zod.run({
					value: input,
					issues: []
				}, ctx);
				const right = def.right._zod.run({
					value: input,
					issues: []
				}, ctx);
				if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
					return handleIntersectionResults(payload, left, right);
				});
				return handleIntersectionResults(payload, left, right);
			};
		});
		function mergeValues(a, b) {
			if (a === b) return {
				valid: true,
				data: a
			};
			if (a instanceof Date && b instanceof Date && +a === +b) return {
				valid: true,
				data: a
			};
			if (isPlainObject(a) && isPlainObject(b)) {
				const bKeys = Object.keys(b);
				const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
				const newObj = {
					...a,
					...b
				};
				for (const key of sharedKeys) {
					const sharedValue = mergeValues(a[key], b[key]);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
					};
					newObj[key] = sharedValue.data;
				}
				return {
					valid: true,
					data: newObj
				};
			}
			if (Array.isArray(a) && Array.isArray(b)) {
				if (a.length !== b.length) return {
					valid: false,
					mergeErrorPath: []
				};
				const newArray = [];
				for (let index = 0; index < a.length; index++) {
					const itemA = a[index];
					const itemB = b[index];
					const sharedValue = mergeValues(itemA, itemB);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
					};
					newArray.push(sharedValue.data);
				}
				return {
					valid: true,
					data: newArray
				};
			}
			return {
				valid: false,
				mergeErrorPath: []
			};
		}
		function handleIntersectionResults(result, left, right) {
			const unrecKeys = /* @__PURE__ */ new Map();
			let unrecIssue;
			for (const iss of left.issues) if (iss.code === "unrecognized_keys") {
				unrecIssue ?? (unrecIssue = iss);
				for (const k of iss.keys) {
					if (!unrecKeys.has(k)) unrecKeys.set(k, {});
					unrecKeys.get(k).l = true;
				}
			} else result.issues.push(iss);
			for (const iss of right.issues) if (iss.code === "unrecognized_keys") for (const k of iss.keys) {
				if (!unrecKeys.has(k)) unrecKeys.set(k, {});
				unrecKeys.get(k).r = true;
			}
			else result.issues.push(iss);
			const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
			if (bothKeys.length && unrecIssue) result.issues.push({
				...unrecIssue,
				keys: bothKeys
			});
			if (aborted(result)) return result;
			const merged = mergeValues(left.value, right.value);
			if (!merged.valid) throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
			result.value = merged.data;
			return result;
		}
		const $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
			$ZodType.init(inst, def);
			const values = getEnumValues(def.entries);
			const valuesSet = new Set(values);
			inst._zod.values = valuesSet;
			inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (valuesSet.has(input)) return payload;
				payload.issues.push({
					code: "invalid_value",
					values,
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
			$ZodType.init(inst, def);
			if (def.values.length === 0) throw new Error("Cannot create literal schema with no valid values");
			const values = new Set(def.values);
			inst._zod.values = values;
			inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (values.has(input)) return payload;
				payload.issues.push({
					code: "invalid_value",
					values: def.values,
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				const _out = def.transform(payload.value, payload);
				if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
					payload.value = output;
					payload.fallback = true;
					return payload;
				});
				if (_out instanceof Promise) throw new $ZodAsyncError();
				payload.value = _out;
				payload.fallback = true;
				return payload;
			};
		});
		function handleOptionalResult(result, input) {
			if (input === void 0 && (result.issues.length || result.fallback)) return {
				issues: [],
				value: void 0
			};
			return result;
		}
		const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			inst._zod.optout = "optional";
			defineLazy(inst._zod, "values", () => {
				return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
			});
			defineLazy(inst._zod, "pattern", () => {
				const pattern = def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (def.innerType._zod.optin === "optional") {
					const input = payload.value;
					const result = def.innerType._zod.run(payload, ctx);
					if (result instanceof Promise) return result.then((r) => handleOptionalResult(r, input));
					return handleOptionalResult(result, input);
				}
				if (payload.value === void 0) return payload;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
			inst._zod.parse = (payload, ctx) => {
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
			defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
			defineLazy(inst._zod, "pattern", () => {
				const pattern = def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
			});
			defineLazy(inst._zod, "values", () => {
				return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (payload.value === null) return payload;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) {
					payload.value = def.defaultValue;
					/**
					* $ZodDefault returns the default value immediately in forward direction.
					* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
					return payload;
				}
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
				return handleDefaultResult(result, def);
			};
		});
		function handleDefaultResult(payload, def) {
			if (payload.value === void 0) payload.value = def.defaultValue;
			return payload;
		}
		const $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) payload.value = def.defaultValue;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "values", () => {
				const v = def.innerType._zod.values;
				return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
				return handleNonOptionalResult(result, inst);
			};
		});
		function handleNonOptionalResult(payload, inst) {
			if (!payload.issues.length && payload.value === void 0) payload.issues.push({
				code: "invalid_type",
				expected: "nonoptional",
				input: payload.value,
				inst
			});
			return payload;
		}
		const $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => {
					payload.value = result.value;
					if (result.issues.length) {
						payload.value = def.catchValue({
							...payload,
							error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
							input: payload.value
						});
						payload.issues = [];
						payload.fallback = true;
					}
					return payload;
				});
				payload.value = result.value;
				if (result.issues.length) {
					payload.value = def.catchValue({
						...payload,
						error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
						input: payload.value
					});
					payload.issues = [];
					payload.fallback = true;
				}
				return payload;
			};
		});
		const $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "values", () => def.in._zod.values);
			defineLazy(inst._zod, "optin", () => def.in._zod.optin);
			defineLazy(inst._zod, "optout", () => def.out._zod.optout);
			defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") {
					const right = def.out._zod.run(payload, ctx);
					if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
					return handlePipeResult(right, def.in, ctx);
				}
				const left = def.in._zod.run(payload, ctx);
				if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
				return handlePipeResult(left, def.out, ctx);
			};
		});
		function handlePipeResult(left, next, ctx) {
			if (left.issues.length) {
				left.aborted = true;
				return left;
			}
			return next._zod.run({
				value: left.value,
				issues: left.issues,
				fallback: left.fallback
			}, ctx);
		}
		const $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
			defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then(handleReadonlyResult);
				return handleReadonlyResult(result);
			};
		});
		function handleReadonlyResult(payload) {
			payload.value = Object.freeze(payload.value);
			return payload;
		}
		const $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
			$ZodCheck.init(inst, def);
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _) => {
				return payload;
			};
			inst._zod.check = (payload) => {
				const input = payload.value;
				const r = def.fn(input);
				if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
				handleRefineResult(r, payload, input, inst);
			};
		});
		function handleRefineResult(result, payload, input, inst) {
			if (!result) {
				const _iss = {
					code: "custom",
					input,
					inst,
					path: [...inst._zod.def.path ?? []],
					continue: !inst._zod.def.abort
				};
				if (inst._zod.def.params) _iss.params = inst._zod.def.params;
				payload.issues.push(issue(_iss));
			}
		}
		//#endregion
		//#region node_modules/zod/v4/core/registries.js
		var _a;
		var $ZodRegistry = class {
			constructor() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
			}
			add(schema, ..._meta) {
				const meta = _meta[0];
				this._map.set(schema, meta);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
				return this;
			}
			clear() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
				return this;
			}
			remove(schema) {
				const meta = this._map.get(schema);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
				this._map.delete(schema);
				return this;
			}
			get(schema) {
				const p = schema._zod.parent;
				if (p) {
					const pm = { ...this.get(p) ?? {} };
					delete pm.id;
					const f = {
						...pm,
						...this._map.get(schema)
					};
					return Object.keys(f).length ? f : void 0;
				}
				return this._map.get(schema);
			}
			has(schema) {
				return this._map.has(schema);
			}
		};
		function registry() {
			return new $ZodRegistry();
		}
		(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
		const globalRegistry = globalThis.__zod_globalRegistry;
		//#endregion
		//#region node_modules/zod/v4/core/api.js
		// @__NO_SIDE_EFFECTS__
		function _string(Class, params) {
			return new Class({
				type: "string",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _email(Class, params) {
			return new Class({
				type: "string",
				format: "email",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _guid(Class, params) {
			return new Class({
				type: "string",
				format: "guid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuid(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv4(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v4",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv6(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v6",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv7(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v7",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _url(Class, params) {
			return new Class({
				type: "string",
				format: "url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _emoji(Class, params) {
			return new Class({
				type: "string",
				format: "emoji",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _nanoid(Class, params) {
			return new Class({
				type: "string",
				format: "nanoid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link _cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		// @__NO_SIDE_EFFECTS__
		function _cuid(Class, params) {
			return new Class({
				type: "string",
				format: "cuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cuid2(Class, params) {
			return new Class({
				type: "string",
				format: "cuid2",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ulid(Class, params) {
			return new Class({
				type: "string",
				format: "ulid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _xid(Class, params) {
			return new Class({
				type: "string",
				format: "xid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ksuid(Class, params) {
			return new Class({
				type: "string",
				format: "ksuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv4(Class, params) {
			return new Class({
				type: "string",
				format: "ipv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv6(Class, params) {
			return new Class({
				type: "string",
				format: "ipv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv4(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv6(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64(Class, params) {
			return new Class({
				type: "string",
				format: "base64",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64url(Class, params) {
			return new Class({
				type: "string",
				format: "base64url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _e164(Class, params) {
			return new Class({
				type: "string",
				format: "e164",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _jwt(Class, params) {
			return new Class({
				type: "string",
				format: "jwt",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDateTime(Class, params) {
			return new Class({
				type: "string",
				format: "datetime",
				check: "string_format",
				offset: false,
				local: false,
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDate(Class, params) {
			return new Class({
				type: "string",
				format: "date",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoTime(Class, params) {
			return new Class({
				type: "string",
				format: "time",
				check: "string_format",
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDuration(Class, params) {
			return new Class({
				type: "string",
				format: "duration",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _number(Class, params) {
			return new Class({
				type: "number",
				checks: [],
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _int(Class, params) {
			return new Class({
				type: "number",
				check: "number_format",
				abort: false,
				format: "safeint",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _boolean(Class, params) {
			return new Class({
				type: "boolean",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _null$1(Class, params) {
			return new Class({
				type: "null",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _unknown(Class) {
			return new Class({ type: "unknown" });
		}
		// @__NO_SIDE_EFFECTS__
		function _never(Class, params) {
			return new Class({
				type: "never",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lt(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lte(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gt(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gte(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _multipleOf(value, params) {
			return new $ZodCheckMultipleOf({
				check: "multiple_of",
				...normalizeParams(params),
				value
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _maxLength(maximum, params) {
			return new $ZodCheckMaxLength({
				check: "max_length",
				...normalizeParams(params),
				maximum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _minLength(minimum, params) {
			return new $ZodCheckMinLength({
				check: "min_length",
				...normalizeParams(params),
				minimum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _length(length, params) {
			return new $ZodCheckLengthEquals({
				check: "length_equals",
				...normalizeParams(params),
				length
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _regex(pattern, params) {
			return new $ZodCheckRegex({
				check: "string_format",
				format: "regex",
				...normalizeParams(params),
				pattern
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lowercase(params) {
			return new $ZodCheckLowerCase({
				check: "string_format",
				format: "lowercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uppercase(params) {
			return new $ZodCheckUpperCase({
				check: "string_format",
				format: "uppercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _includes(includes, params) {
			return new $ZodCheckIncludes({
				check: "string_format",
				format: "includes",
				...normalizeParams(params),
				includes
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _startsWith(prefix, params) {
			return new $ZodCheckStartsWith({
				check: "string_format",
				format: "starts_with",
				...normalizeParams(params),
				prefix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _endsWith(suffix, params) {
			return new $ZodCheckEndsWith({
				check: "string_format",
				format: "ends_with",
				...normalizeParams(params),
				suffix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _overwrite(tx) {
			return new $ZodCheckOverwrite({
				check: "overwrite",
				tx
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _normalize(form) {
			return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
		}
		// @__NO_SIDE_EFFECTS__
		function _trim() {
			return /* @__PURE__ */ _overwrite((input) => input.trim());
		}
		// @__NO_SIDE_EFFECTS__
		function _toLowerCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _toUpperCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _slugify() {
			return /* @__PURE__ */ _overwrite((input) => slugify(input));
		}
		// @__NO_SIDE_EFFECTS__
		function _array(Class, element, params) {
			return new Class({
				type: "array",
				element,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _refine(Class, fn, _params) {
			return new Class({
				type: "custom",
				check: "custom",
				fn,
				...normalizeParams(_params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _superRefine(fn, params) {
			const ch = /* @__PURE__ */ _check((payload) => {
				payload.addIssue = (issue$2) => {
					if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
					else {
						const _issue = issue$2;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						_issue.input ?? (_issue.input = payload.value);
						_issue.inst ?? (_issue.inst = ch);
						_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
						payload.issues.push(issue(_issue));
					}
				};
				return fn(payload.value, payload);
			}, params);
			return ch;
		}
		// @__NO_SIDE_EFFECTS__
		function _check(fn, params) {
			const ch = new $ZodCheck({
				check: "custom",
				...normalizeParams(params)
			});
			ch._zod.check = fn;
			return ch;
		}
		//#endregion
		//#region node_modules/zod/v4/core/to-json-schema.js
		function initializeContext(params) {
			let target = params?.target ?? "draft-2020-12";
			if (target === "draft-4") target = "draft-04";
			if (target === "draft-7") target = "draft-07";
			return {
				processors: params.processors ?? {},
				metadataRegistry: params?.metadata ?? globalRegistry,
				target,
				unrepresentable: params?.unrepresentable ?? "throw",
				override: params?.override ?? (() => {}),
				io: params?.io ?? "output",
				counter: 0,
				seen: /* @__PURE__ */ new Map(),
				cycles: params?.cycles ?? "ref",
				reused: params?.reused ?? "inline",
				external: params?.external ?? void 0
			};
		}
		function process(schema, ctx, _params = {
			path: [],
			schemaPath: []
		}) {
			var _a;
			const def = schema._zod.def;
			const seen = ctx.seen.get(schema);
			if (seen) {
				seen.count++;
				if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
				return seen.schema;
			}
			const result = {
				schema: {},
				count: 1,
				cycle: void 0,
				path: _params.path
			};
			ctx.seen.set(schema, result);
			const overrideSchema = schema._zod.toJSONSchema?.();
			if (overrideSchema) result.schema = overrideSchema;
			else {
				const params = {
					..._params,
					schemaPath: [..._params.schemaPath, schema],
					path: _params.path
				};
				if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
				else {
					const _json = result.schema;
					const processor = ctx.processors[def.type];
					if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
					processor(schema, ctx, _json, params);
				}
				const parent = schema._zod.parent;
				if (parent) {
					if (!result.ref) result.ref = parent;
					process(parent, ctx, params);
					ctx.seen.get(parent).isParent = true;
				}
			}
			const meta = ctx.metadataRegistry.get(schema);
			if (meta) Object.assign(result.schema, meta);
			if (ctx.io === "input" && isTransforming(schema)) {
				delete result.schema.examples;
				delete result.schema.default;
			}
			if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
			delete result.schema._prefault;
			return ctx.seen.get(schema).schema;
		}
		function extractDefs(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			const idToSchema = /* @__PURE__ */ new Map();
			for (const entry of ctx.seen.entries()) {
				const id = ctx.metadataRegistry.get(entry[0])?.id;
				if (id) {
					const existing = idToSchema.get(id);
					if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
					idToSchema.set(id, entry[0]);
				}
			}
			const makeURI = (entry) => {
				const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
				if (ctx.external) {
					const externalId = ctx.external.registry.get(entry[0])?.id;
					const uriGenerator = ctx.external.uri ?? ((id) => id);
					if (externalId) return { ref: uriGenerator(externalId) };
					const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
					entry[1].defId = id;
					return {
						defId: id,
						ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}`
					};
				}
				if (entry[1] === root) return { ref: "#" };
				const defUriPrefix = `#/${defsSegment}/`;
				const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
				return {
					defId,
					ref: defUriPrefix + defId
				};
			};
			const extractToDef = (entry) => {
				if (entry[1].schema.$ref) return;
				const seen = entry[1];
				const { ref, defId } = makeURI(entry);
				seen.def = { ...seen.schema };
				if (defId) seen.defId = defId;
				const schema = seen.schema;
				for (const key in schema) delete schema[key];
				schema.$ref = ref;
			};
			if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>
		
		Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
			}
			for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (schema === entry[0]) {
					extractToDef(entry);
					continue;
				}
				if (ctx.external) {
					const ext = ctx.external.registry.get(entry[0])?.id;
					if (schema !== entry[0] && ext) {
						extractToDef(entry);
						continue;
					}
				}
				if (ctx.metadataRegistry.get(entry[0])?.id) {
					extractToDef(entry);
					continue;
				}
				if (seen.cycle) {
					extractToDef(entry);
					continue;
				}
				if (seen.count > 1) {
					if (ctx.reused === "ref") {
						extractToDef(entry);
						continue;
					}
				}
			}
		}
		function finalize(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			const flattenRef = (zodSchema) => {
				const seen = ctx.seen.get(zodSchema);
				if (seen.ref === null) return;
				const schema = seen.def ?? seen.schema;
				const _cached = { ...schema };
				const ref = seen.ref;
				seen.ref = null;
				if (ref) {
					flattenRef(ref);
					const refSeen = ctx.seen.get(ref);
					const refSchema = refSeen.schema;
					if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
						schema.allOf = schema.allOf ?? [];
						schema.allOf.push(refSchema);
					} else Object.assign(schema, refSchema);
					Object.assign(schema, _cached);
					if (zodSchema._zod.parent === ref) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (!(key in _cached)) delete schema[key];
					}
					if (refSchema.$ref && refSeen.def) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
					}
				}
				const parent = zodSchema._zod.parent;
				if (parent && parent !== ref) {
					flattenRef(parent);
					const parentSeen = ctx.seen.get(parent);
					if (parentSeen?.schema.$ref) {
						schema.$ref = parentSeen.schema.$ref;
						if (parentSeen.def) for (const key in schema) {
							if (key === "$ref" || key === "allOf") continue;
							if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
						}
					}
				}
				ctx.override({
					zodSchema,
					jsonSchema: schema,
					path: seen.path ?? []
				});
			};
			for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
			const result = {};
			if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
			else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
			else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
			else if (ctx.target === "openapi-3.0") {}
			if (ctx.external?.uri) {
				const id = ctx.external.registry.get(schema)?.id;
				if (!id) throw new Error("Schema is missing an `id` property");
				result.$id = ctx.external.uri(id);
			}
			Object.assign(result, root.def ?? root.schema);
			const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
			if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
			const defs = ctx.external?.defs ?? {};
			for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.def && seen.defId) {
					if (seen.def.id === seen.defId) delete seen.def.id;
					defs[seen.defId] = seen.def;
				}
			}
			if (ctx.external) {} else if (Object.keys(defs).length > 0) {
				if (ctx.target === "draft-2020-12") result.$defs = defs;
				else result.definitions = defs;
			}
			try {
				const finalized = JSON.parse(JSON.stringify(result));
				Object.defineProperty(finalized, "~standard", {
					value: {
						...schema["~standard"],
						jsonSchema: {
							input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
							output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
						}
					},
					enumerable: false,
					writable: false
				});
				return finalized;
			} catch (_err) {
				throw new Error("Error converting schema to JSON.");
			}
		}
		function isTransforming(_schema, _ctx) {
			const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
			if (ctx.seen.has(_schema)) return false;
			ctx.seen.add(_schema);
			const def = _schema._zod.def;
			if (def.type === "transform") return true;
			if (def.type === "array") return isTransforming(def.element, ctx);
			if (def.type === "set") return isTransforming(def.valueType, ctx);
			if (def.type === "lazy") return isTransforming(def.getter(), ctx);
			if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") return isTransforming(def.innerType, ctx);
			if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
			if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
			if (def.type === "pipe") {
				if (_schema._zod.traits.has("$ZodCodec")) return true;
				return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
			}
			if (def.type === "object") {
				for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
				return false;
			}
			if (def.type === "union") {
				for (const option of def.options) if (isTransforming(option, ctx)) return true;
				return false;
			}
			if (def.type === "tuple") {
				for (const item of def.items) if (isTransforming(item, ctx)) return true;
				if (def.rest && isTransforming(def.rest, ctx)) return true;
				return false;
			}
			return false;
		}
		/**
		* Creates a toJSONSchema method for a schema instance.
		* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
		*/
		const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
			const ctx = initializeContext({
				...params,
				processors
			});
			process(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
			const { libraryOptions, target } = params ?? {};
			const ctx = initializeContext({
				...libraryOptions ?? {},
				target,
				io,
				processors
			});
			process(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		//#endregion
		//#region node_modules/zod/v4/core/json-schema-processors.js
		const formatMap = {
			guid: "uuid",
			url: "uri",
			datetime: "date-time",
			json_string: "json-string",
			regex: ""
		};
		const stringProcessor = (schema, ctx, _json, _params) => {
			const json = _json;
			json.type = "string";
			const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
			if (typeof minimum === "number") json.minLength = minimum;
			if (typeof maximum === "number") json.maxLength = maximum;
			if (format) {
				json.format = formatMap[format] ?? format;
				if (json.format === "") delete json.format;
				if (format === "time") delete json.format;
			}
			if (contentEncoding) json.contentEncoding = contentEncoding;
			if (patterns && patterns.size > 0) {
				const regexes = [...patterns];
				if (regexes.length === 1) json.pattern = regexes[0].source;
				else if (regexes.length > 1) json.allOf = [...regexes.map((regex) => ({
					...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
					pattern: regex.source
				}))];
			}
		};
		const numberProcessor = (schema, ctx, _json, _params) => {
			const json = _json;
			const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
			if (typeof format === "string" && format.includes("int")) json.type = "integer";
			else json.type = "number";
			const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
			const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
			const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
			if (exMin) {
				if (legacy) {
					json.minimum = exclusiveMinimum;
					json.exclusiveMinimum = true;
				} else json.exclusiveMinimum = exclusiveMinimum;
			} else if (typeof minimum === "number") json.minimum = minimum;
			if (exMax) {
				if (legacy) {
					json.maximum = exclusiveMaximum;
					json.exclusiveMaximum = true;
				} else json.exclusiveMaximum = exclusiveMaximum;
			} else if (typeof maximum === "number") json.maximum = maximum;
			if (typeof multipleOf === "number") json.multipleOf = multipleOf;
		};
		const booleanProcessor = (_schema, _ctx, json, _params) => {
			json.type = "boolean";
		};
		const nullProcessor = (_schema, ctx, json, _params) => {
			if (ctx.target === "openapi-3.0") {
				json.type = "string";
				json.nullable = true;
				json.enum = [null];
			} else json.type = "null";
		};
		const neverProcessor = (_schema, _ctx, json, _params) => {
			json.not = {};
		};
		const enumProcessor = (schema, _ctx, json, _params) => {
			const def = schema._zod.def;
			const values = getEnumValues(def.entries);
			if (values.every((v) => typeof v === "number")) json.type = "number";
			if (values.every((v) => typeof v === "string")) json.type = "string";
			json.enum = values;
		};
		const literalProcessor = (schema, ctx, json, _params) => {
			const def = schema._zod.def;
			const vals = [];
			for (const val of def.values) if (val === void 0) {
				if (ctx.unrepresentable === "throw") throw new Error("Literal `undefined` cannot be represented in JSON Schema");
			} else if (typeof val === "bigint") {
				if (ctx.unrepresentable === "throw") throw new Error("BigInt literals cannot be represented in JSON Schema");
				else vals.push(Number(val));
			} else vals.push(val);
			if (vals.length === 0) {} else if (vals.length === 1) {
				const val = vals[0];
				json.type = val === null ? "null" : typeof val;
				if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
				else json.const = val;
			} else {
				if (vals.every((v) => typeof v === "number")) json.type = "number";
				if (vals.every((v) => typeof v === "string")) json.type = "string";
				if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
				if (vals.every((v) => v === null)) json.type = "null";
				json.enum = vals;
			}
		};
		const customProcessor = (_schema, ctx, _json, _params) => {
			if (ctx.unrepresentable === "throw") throw new Error("Custom types cannot be represented in JSON Schema");
		};
		const transformProcessor = (_schema, ctx, _json, _params) => {
			if (ctx.unrepresentable === "throw") throw new Error("Transforms cannot be represented in JSON Schema");
		};
		const arrayProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			const { minimum, maximum } = schema._zod.bag;
			if (typeof minimum === "number") json.minItems = minimum;
			if (typeof maximum === "number") json.maxItems = maximum;
			json.type = "array";
			json.items = process(def.element, ctx, {
				...params,
				path: [...params.path, "items"]
			});
		};
		const objectProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			json.type = "object";
			json.properties = {};
			const shape = def.shape;
			for (const key in shape) json.properties[key] = process(shape[key], ctx, {
				...params,
				path: [
					...params.path,
					"properties",
					key
				]
			});
			const allKeys = new Set(Object.keys(shape));
			const requiredKeys = new Set([...allKeys].filter((key) => {
				const v = def.shape[key]._zod;
				if (ctx.io === "input") return v.optin === void 0;
				else return v.optout === void 0;
			}));
			if (requiredKeys.size > 0) json.required = Array.from(requiredKeys);
			if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
			else if (!def.catchall) {
				if (ctx.io === "output") json.additionalProperties = false;
			} else if (def.catchall) json.additionalProperties = process(def.catchall, ctx, {
				...params,
				path: [...params.path, "additionalProperties"]
			});
		};
		const unionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const isExclusive = def.inclusive === false;
			const options = def.options.map((x, i) => process(x, ctx, {
				...params,
				path: [
					...params.path,
					isExclusive ? "oneOf" : "anyOf",
					i
				]
			}));
			if (isExclusive) json.oneOf = options;
			else json.anyOf = options;
		};
		const intersectionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const a = process(def.left, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					0
				]
			});
			const b = process(def.right, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					1
				]
			});
			const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
			json.allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
		};
		const nullableProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const inner = process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			if (ctx.target === "openapi-3.0") {
				seen.ref = def.innerType;
				json.nullable = true;
			} else json.anyOf = [inner, { type: "null" }];
		};
		const nonoptionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		const defaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			json.default = JSON.parse(JSON.stringify(def.defaultValue));
		};
		const prefaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			if (ctx.io === "input") json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
		};
		const catchProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			let catchValue;
			try {
				catchValue = def.catchValue(void 0);
			} catch {
				throw new Error("Dynamic catch values are not supported in JSON Schema");
			}
			json.default = catchValue;
		};
		const pipeProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			const inIsTransform = def.in._zod.traits.has("$ZodTransform");
			const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
			process(innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = innerType;
		};
		const readonlyProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			json.readOnly = true;
		};
		const optionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		//#endregion
		//#region node_modules/zod/v4/classic/iso.js
		const ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
			$ZodISODateTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function datetime(params) {
			return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
		}
		const ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
			$ZodISODate.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function date(params) {
			return /* @__PURE__ */ _isoDate(ZodISODate, params);
		}
		const ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
			$ZodISOTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function time(params) {
			return /* @__PURE__ */ _isoTime(ZodISOTime, params);
		}
		const ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
			$ZodISODuration.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function duration(params) {
			return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
		}
		//#endregion
		//#region node_modules/zod/v4/classic/errors.js
		const initializer = (inst, issues) => {
			$ZodError.init(inst, issues);
			inst.name = "ZodError";
			Object.defineProperties(inst, {
				format: { value: (mapper) => formatError(inst, mapper) },
				flatten: { value: (mapper) => flattenError(inst, mapper) },
				addIssue: { value: (issue) => {
					inst.issues.push(issue);
					inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
				} },
				addIssues: { value: (issues) => {
					inst.issues.push(...issues);
					inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
				} },
				isEmpty: { get() {
					return inst.issues.length === 0;
				} }
			});
		};
		const ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, { Parent: Error });
		//#endregion
		//#region node_modules/zod/v4/classic/parse.js
		const parse = /* @__PURE__ */ _parse(ZodRealError);
		const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
		const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
		const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
		const encode = /* @__PURE__ */ _encode(ZodRealError);
		const decode = /* @__PURE__ */ _decode(ZodRealError);
		const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
		const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
		const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
		const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
		const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
		const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
		//#endregion
		//#region node_modules/zod/v4/classic/schemas.js
		const _installedGroups = /* @__PURE__ */ new WeakMap();
		function _installLazyMethods(inst, group, methods) {
			const proto = Object.getPrototypeOf(inst);
			let installed = _installedGroups.get(proto);
			if (!installed) {
				installed = /* @__PURE__ */ new Set();
				_installedGroups.set(proto, installed);
			}
			if (installed.has(group)) return;
			installed.add(group);
			for (const key in methods) {
				const fn = methods[key];
				Object.defineProperty(proto, key, {
					configurable: true,
					enumerable: false,
					get() {
						const bound = fn.bind(this);
						Object.defineProperty(this, key, {
							configurable: true,
							writable: true,
							enumerable: true,
							value: bound
						});
						return bound;
					},
					set(v) {
						Object.defineProperty(this, key, {
							configurable: true,
							writable: true,
							enumerable: true,
							value: v
						});
					}
				});
			}
		}
		const ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
			$ZodType.init(inst, def);
			Object.assign(inst["~standard"], { jsonSchema: {
				input: createStandardJSONSchemaMethod(inst, "input"),
				output: createStandardJSONSchemaMethod(inst, "output")
			} });
			inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
			inst.def = def;
			inst.type = def.type;
			Object.defineProperty(inst, "_def", { value: def });
			inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
			inst.safeParse = (data, params) => safeParse(inst, data, params);
			inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
			inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
			inst.spa = inst.safeParseAsync;
			inst.encode = (data, params) => encode(inst, data, params);
			inst.decode = (data, params) => decode(inst, data, params);
			inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
			inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
			inst.safeEncode = (data, params) => safeEncode(inst, data, params);
			inst.safeDecode = (data, params) => safeDecode(inst, data, params);
			inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
			inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
			_installLazyMethods(inst, "ZodType", {
				check(...chks) {
					const def = this.def;
					return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
						check: ch,
						def: { check: "custom" },
						onattach: []
					} } : ch)] }), { parent: true });
				},
				with(...chks) {
					return this.check(...chks);
				},
				clone(def, params) {
					return clone(this, def, params);
				},
				brand() {
					return this;
				},
				register(reg, meta) {
					reg.add(this, meta);
					return this;
				},
				refine(check, params) {
					return this.check(refine(check, params));
				},
				superRefine(refinement, params) {
					return this.check(superRefine(refinement, params));
				},
				overwrite(fn) {
					return this.check(/* @__PURE__ */ _overwrite(fn));
				},
				optional() {
					return optional(this);
				},
				exactOptional() {
					return exactOptional(this);
				},
				nullable() {
					return nullable(this);
				},
				nullish() {
					return optional(nullable(this));
				},
				nonoptional(params) {
					return nonoptional(this, params);
				},
				array() {
					return array(this);
				},
				or(arg) {
					return union([this, arg]);
				},
				and(arg) {
					return intersection(this, arg);
				},
				transform(tx) {
					return pipe(this, transform(tx));
				},
				default(d) {
					return _default(this, d);
				},
				prefault(d) {
					return prefault(this, d);
				},
				catch(params) {
					return _catch(this, params);
				},
				pipe(target) {
					return pipe(this, target);
				},
				readonly() {
					return readonly(this);
				},
				describe(description) {
					const cl = this.clone();
					globalRegistry.add(cl, { description });
					return cl;
				},
				meta(...args) {
					if (args.length === 0) return globalRegistry.get(this);
					const cl = this.clone();
					globalRegistry.add(cl, args[0]);
					return cl;
				},
				isOptional() {
					return this.safeParse(void 0).success;
				},
				isNullable() {
					return this.safeParse(null).success;
				},
				apply(fn) {
					return fn(this);
				}
			});
			Object.defineProperty(inst, "description", {
				get() {
					return globalRegistry.get(inst)?.description;
				},
				configurable: true
			});
			return inst;
		});
		/** @internal */
		const _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
			const bag = inst._zod.bag;
			inst.format = bag.format ?? null;
			inst.minLength = bag.minimum ?? null;
			inst.maxLength = bag.maximum ?? null;
			_installLazyMethods(inst, "_ZodString", {
				regex(...args) {
					return this.check(/* @__PURE__ */ _regex(...args));
				},
				includes(...args) {
					return this.check(/* @__PURE__ */ _includes(...args));
				},
				startsWith(...args) {
					return this.check(/* @__PURE__ */ _startsWith(...args));
				},
				endsWith(...args) {
					return this.check(/* @__PURE__ */ _endsWith(...args));
				},
				min(...args) {
					return this.check(/* @__PURE__ */ _minLength(...args));
				},
				max(...args) {
					return this.check(/* @__PURE__ */ _maxLength(...args));
				},
				length(...args) {
					return this.check(/* @__PURE__ */ _length(...args));
				},
				nonempty(...args) {
					return this.check(/* @__PURE__ */ _minLength(1, ...args));
				},
				lowercase(params) {
					return this.check(/* @__PURE__ */ _lowercase(params));
				},
				uppercase(params) {
					return this.check(/* @__PURE__ */ _uppercase(params));
				},
				trim() {
					return this.check(/* @__PURE__ */ _trim());
				},
				normalize(...args) {
					return this.check(/* @__PURE__ */ _normalize(...args));
				},
				toLowerCase() {
					return this.check(/* @__PURE__ */ _toLowerCase());
				},
				toUpperCase() {
					return this.check(/* @__PURE__ */ _toUpperCase());
				},
				slugify() {
					return this.check(/* @__PURE__ */ _slugify());
				}
			});
		});
		const ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			_ZodString.init(inst, def);
			inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
			inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
			inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
			inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
			inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
			inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
			inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
			inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
			inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
			inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
			inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
			inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
			inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
			inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
			inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
			inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
			inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
			inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
			inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
			inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
			inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
			inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
			inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
			inst.datetime = (params) => inst.check(datetime(params));
			inst.date = (params) => inst.check(date(params));
			inst.time = (params) => inst.check(time(params));
			inst.duration = (params) => inst.check(duration(params));
		});
		function string(params) {
			return /* @__PURE__ */ _string(ZodString, params);
		}
		const ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			_ZodString.init(inst, def);
		});
		const ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
			$ZodEmail.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
			$ZodGUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
			$ZodUUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
			$ZodURL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
			$ZodEmoji.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
			$ZodNanoID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
			$ZodCUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
			$ZodCUID2.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
			$ZodULID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
			$ZodXID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
			$ZodKSUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
			$ZodIPv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
			$ZodIPv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
			$ZodCIDRv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
			$ZodCIDRv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
			$ZodBase64.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
			$ZodBase64URL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
			$ZodE164.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
			$ZodJWT.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
			$ZodNumber.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
			_installLazyMethods(inst, "ZodNumber", {
				gt(value, params) {
					return this.check(/* @__PURE__ */ _gt(value, params));
				},
				gte(value, params) {
					return this.check(/* @__PURE__ */ _gte(value, params));
				},
				min(value, params) {
					return this.check(/* @__PURE__ */ _gte(value, params));
				},
				lt(value, params) {
					return this.check(/* @__PURE__ */ _lt(value, params));
				},
				lte(value, params) {
					return this.check(/* @__PURE__ */ _lte(value, params));
				},
				max(value, params) {
					return this.check(/* @__PURE__ */ _lte(value, params));
				},
				int(params) {
					return this.check(int(params));
				},
				safe(params) {
					return this.check(int(params));
				},
				positive(params) {
					return this.check(/* @__PURE__ */ _gt(0, params));
				},
				nonnegative(params) {
					return this.check(/* @__PURE__ */ _gte(0, params));
				},
				negative(params) {
					return this.check(/* @__PURE__ */ _lt(0, params));
				},
				nonpositive(params) {
					return this.check(/* @__PURE__ */ _lte(0, params));
				},
				multipleOf(value, params) {
					return this.check(/* @__PURE__ */ _multipleOf(value, params));
				},
				step(value, params) {
					return this.check(/* @__PURE__ */ _multipleOf(value, params));
				},
				finite() {
					return this;
				}
			});
			const bag = inst._zod.bag;
			inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
			inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
			inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? .5);
			inst.isFinite = true;
			inst.format = bag.format ?? null;
		});
		function number(params) {
			return /* @__PURE__ */ _number(ZodNumber, params);
		}
		const ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
			$ZodNumberFormat.init(inst, def);
			ZodNumber.init(inst, def);
		});
		function int(params) {
			return /* @__PURE__ */ _int(ZodNumberFormat, params);
		}
		const ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
			$ZodBoolean.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
		});
		function boolean(params) {
			return /* @__PURE__ */ _boolean(ZodBoolean, params);
		}
		const ZodNull = /*@__PURE__*/ $constructor("ZodNull", (inst, def) => {
			$ZodNull.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nullProcessor(inst, ctx, json, params);
		});
		function _null(params) {
			return /* @__PURE__ */ _null$1(ZodNull, params);
		}
		const ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
			$ZodUnknown.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => void 0;
		});
		function unknown() {
			return /* @__PURE__ */ _unknown(ZodUnknown);
		}
		const ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
			$ZodNever.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
		});
		function never(params) {
			return /* @__PURE__ */ _never(ZodNever, params);
		}
		const ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
			$ZodArray.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
			inst.element = def.element;
			_installLazyMethods(inst, "ZodArray", {
				min(n, params) {
					return this.check(/* @__PURE__ */ _minLength(n, params));
				},
				nonempty(params) {
					return this.check(/* @__PURE__ */ _minLength(1, params));
				},
				max(n, params) {
					return this.check(/* @__PURE__ */ _maxLength(n, params));
				},
				length(n, params) {
					return this.check(/* @__PURE__ */ _length(n, params));
				},
				unwrap() {
					return this.element;
				}
			});
		});
		function array(element, params) {
			return /* @__PURE__ */ _array(ZodArray, element, params);
		}
		const ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
			$ZodObjectJIT.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
			defineLazy(inst, "shape", () => {
				return def.shape;
			});
			_installLazyMethods(inst, "ZodObject", {
				keyof() {
					return _enum(Object.keys(this._zod.def.shape));
				},
				catchall(catchall) {
					return this.clone({
						...this._zod.def,
						catchall
					});
				},
				passthrough() {
					return this.clone({
						...this._zod.def,
						catchall: unknown()
					});
				},
				loose() {
					return this.clone({
						...this._zod.def,
						catchall: unknown()
					});
				},
				strict() {
					return this.clone({
						...this._zod.def,
						catchall: never()
					});
				},
				strip() {
					return this.clone({
						...this._zod.def,
						catchall: void 0
					});
				},
				extend(incoming) {
					return extend(this, incoming);
				},
				safeExtend(incoming) {
					return safeExtend(this, incoming);
				},
				merge(other) {
					return merge(this, other);
				},
				pick(mask) {
					return pick(this, mask);
				},
				omit(mask) {
					return omit(this, mask);
				},
				partial(...args) {
					return partial(ZodOptional, this, args[0]);
				},
				required(...args) {
					return required(ZodNonOptional, this, args[0]);
				}
			});
		});
		function object(shape, params) {
			const def = {
				type: "object",
				shape: shape ?? {},
				...normalizeParams(params)
			};
			return new ZodObject(def);
		}
		const ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
			$ZodUnion.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
			inst.options = def.options;
		});
		function union(options, params) {
			return new ZodUnion({
				type: "union",
				options,
				...normalizeParams(params)
			});
		}
		const ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
			$ZodIntersection.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
		});
		function intersection(left, right) {
			return new ZodIntersection({
				type: "intersection",
				left,
				right
			});
		}
		const ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
			$ZodEnum.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
			inst.enum = def.entries;
			inst.options = Object.values(def.entries);
			const keys = new Set(Object.keys(def.entries));
			inst.extract = (values, params) => {
				const newEntries = {};
				for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
			inst.exclude = (values, params) => {
				const newEntries = { ...def.entries };
				for (const value of values) if (keys.has(value)) delete newEntries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
		});
		function _enum(values, params) {
			const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
			return new ZodEnum({
				type: "enum",
				entries,
				...normalizeParams(params)
			});
		}
		const ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
			$ZodLiteral.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
			inst.values = new Set(def.values);
			Object.defineProperty(inst, "value", { get() {
				if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
				return def.values[0];
			} });
		});
		function literal(value, params) {
			return new ZodLiteral({
				type: "literal",
				values: Array.isArray(value) ? value : [value],
				...normalizeParams(params)
			});
		}
		const ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
			$ZodTransform.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
			inst._zod.parse = (payload, _ctx) => {
				if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				payload.addIssue = (issue$1) => {
					if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
					else {
						const _issue = issue$1;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						_issue.input ?? (_issue.input = payload.value);
						_issue.inst ?? (_issue.inst = inst);
						payload.issues.push(issue(_issue));
					}
				};
				const output = def.transform(payload.value, payload);
				if (output instanceof Promise) return output.then((output) => {
					payload.value = output;
					payload.fallback = true;
					return payload;
				});
				payload.value = output;
				payload.fallback = true;
				return payload;
			};
		});
		function transform(fn) {
			return new ZodTransform({
				type: "transform",
				transform: fn
			});
		}
		const ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function optional(innerType) {
			return new ZodOptional({
				type: "optional",
				innerType
			});
		}
		const ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
			$ZodExactOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function exactOptional(innerType) {
			return new ZodExactOptional({
				type: "optional",
				innerType
			});
		}
		const ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
			$ZodNullable.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nullable(innerType) {
			return new ZodNullable({
				type: "nullable",
				innerType
			});
		}
		const ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
			$ZodDefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeDefault = inst.unwrap;
		});
		function _default(innerType, defaultValue) {
			return new ZodDefault({
				type: "default",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
			$ZodPrefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function prefault(innerType, defaultValue) {
			return new ZodPrefault({
				type: "prefault",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
			$ZodNonOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nonoptional(innerType, params) {
			return new ZodNonOptional({
				type: "nonoptional",
				innerType,
				...normalizeParams(params)
			});
		}
		const ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
			$ZodCatch.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeCatch = inst.unwrap;
		});
		function _catch(innerType, catchValue) {
			return new ZodCatch({
				type: "catch",
				innerType,
				catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
			});
		}
		const ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
			$ZodPipe.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
			inst.in = def.in;
			inst.out = def.out;
		});
		function pipe(in_, out) {
			return new ZodPipe({
				type: "pipe",
				in: in_,
				out
			});
		}
		const ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
			$ZodReadonly.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function readonly(innerType) {
			return new ZodReadonly({
				type: "readonly",
				innerType
			});
		}
		const ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
			$ZodCustom.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
		});
		function refine(fn, _params = {}) {
			return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
		}
		function superRefine(fn, params) {
			return /* @__PURE__ */ _superRefine(fn, params);
		}
		//#endregion
		//#region src/schemas.ts
		/**
		* Zod schemas for the git Remote wire contract. Bundled into both faces:
		* the host typert manifest validates incoming args and outgoing results, and
		* the client contribution validates the same envelope on the browser side.
		*/
		const gitErrorSchema = object({
			code: string(),
			message: string()
		});
		function okSchema(value) {
			return object({
				ok: literal(true),
				value
			});
		}
		function resultSchema(value) {
			return union([okSchema(value), object({
				ok: literal(false),
				error: gitErrorSchema
			})]);
		}
		const dirRequestSchema = object({ dir: string().min(1) });
		const changeStatusSchema = union([
			literal("added"),
			literal("modified"),
			literal("deleted"),
			literal("renamed"),
			literal("copied"),
			literal("typechange"),
			literal("unmerged")
		]);
		const changeFileSchema = object({
			path: string(),
			status: changeStatusSchema,
			target: string().optional()
		});
		const repoStatusSchema = object({
			root: string(),
			branch: union([string(), _null()]),
			head: union([string(), _null()]),
			ahead: number(),
			behind: number(),
			state: union([
				literal("clean"),
				literal("merge"),
				literal("rebase"),
				literal("cherry-pick"),
				literal("revert"),
				literal("other")
			]),
			/** Branch being merged in (source), non-null while state === "merge". */
			mergeSource: union([string(), _null()]),
			staged: array(changeFileSchema),
			unstaged: array(changeFileSchema),
			untracked: array(string()),
			conflicts: array(string())
		});
		const statusRequestSchema = dirRequestSchema;
		const statusResultSchema = resultSchema(repoStatusSchema);
		const diffLineSchema = object({
			type: union([
				literal("ctx"),
				literal("add"),
				literal("del")
			]),
			text: string(),
			oldNo: number().optional(),
			newNo: number().optional()
		});
		const diffHunkSchema = object({
			oldStart: number(),
			oldCount: number(),
			newStart: number(),
			newCount: number(),
			lines: array(diffLineSchema)
		});
		const diffFileSchema = object({
			path: string(),
			binary: boolean(),
			hunks: array(diffHunkSchema)
		});
		const diffRequestSchema = dirRequestSchema.extend({
			path: string().optional(),
			staged: boolean().optional(),
			context: number().int().min(0).max(20).optional(),
			/**
			* Whitespace flags (IDEA "Do not ignore" dropdown, independent toggles).
			* Hunk boundaries change with the flags, so every hunk-indexed operation
			* must use the same flags.
			*/
			wsFlags: object({
				trimEol: boolean().optional(),
				ignoreWs: boolean().optional(),
				ignoreBlank: boolean().optional()
			}).optional()
		});
		const diffResultSchema = resultSchema(object({ files: array(diffFileSchema) }));
		const hunkPatchRequestSchema = dirRequestSchema.extend({
			/** Tracked file path relative to dir. */
			path: string().min(1),
			/** Indices of the hunks to operate on (0-based, as shown in the diff). */
			hunks: array(number().int().min(0)).min(1),
			/** Must match the display diff's whitespace flags (hunk boundaries). */
			wsFlags: object({
				trimEol: boolean().optional(),
				ignoreWs: boolean().optional(),
				ignoreBlank: boolean().optional()
			}).optional()
		});
		const stageHunksRequestSchema = hunkPatchRequestSchema;
		const stageHunksResultSchema = resultSchema(object({ applied: number() }));
		const revertHunksRequestSchema = hunkPatchRequestSchema;
		const revertHunksResultSchema = resultSchema(object({ reverted: number() }));
		const changeRefSchema = object({
			oldStart: number().int().min(0),
			oldCount: number().int().min(0),
			newStart: number().int().min(0),
			newCount: number().int().min(0)
		});
		const changePatchRequestSchema = dirRequestSchema.extend({
			/** Tracked file path relative to dir. */
			path: string().min(1),
			/** The visual change (block) to operate on, as shown in the diff. */
			change: changeRefSchema,
			/** Must match the display diff's whitespace flags (change boundaries). */
			wsFlags: object({
				trimEol: boolean().optional(),
				ignoreWs: boolean().optional(),
				ignoreBlank: boolean().optional()
			}).optional()
		});
		const stageChangesRequestSchema = changePatchRequestSchema;
		const stageChangesResultSchema = resultSchema(object({ applied: number() }));
		const revertChangesRequestSchema = changePatchRequestSchema;
		const revertChangesResultSchema = resultSchema(object({ reverted: number() }));
		const dirEntrySchema = object({
			name: string(),
			path: string(),
			kind: union([literal("dir"), literal("file")])
		});
		const listDirRequestSchema = dirRequestSchema.extend({ 
		/** Subdirectory path relative to dir; omitted = list dir itself. */
		path: string().optional() });
		const listDirResultSchema = resultSchema(object({ entries: array(dirEntrySchema) }));
		const readFileRequestSchema = dirRequestSchema.extend({ 
		/** File path relative to dir. */
		path: string().min(1) });
		const binaryContentRequestSchema = dirRequestSchema.extend({
			/** File path relative to dir. */
			path: string().min(1),
			/** Git revision to read from ("HEAD", a hash, ...); omitted = working tree. */
			ref: string().optional()
		});
		const binaryContentResultSchema = resultSchema(object({
			mime: string(),
			base64: string()
		}));
		const readFileResultSchema = resultSchema(object({
			content: string(),
			truncated: boolean(),
			binary: boolean()
		}));
		const writeFileRequestSchema = dirRequestSchema.extend({
			path: string().min(1),
			content: string()
		});
		const writeFileResultSchema = resultSchema(object({ path: string() }));
		const deleteFileRequestSchema = dirRequestSchema.extend({
			path: string().min(1),
			/** Recursively delete a directory tree. */
			recursive: boolean().optional()
		});
		const deleteFileResultSchema = resultSchema(object({ path: string() }));
		const pathsRequestSchema = dirRequestSchema.extend({
			paths: array(string().min(1)).min(1),
			/** True when the discard must also clear the index (staged files). */
			staged: boolean().optional()
		});
		const pathsResultSchema = resultSchema(object({ paths: array(string()) }));
		/** Checkout the selected file(s) at a given revision into the worktree+index. */
		const getFromRevisionRequestSchema = dirRequestSchema.extend({
			paths: array(string().min(1)).min(1),
			revision: string().min(1)
		});
		const getFromRevisionResultSchema = pathsResultSchema;
		const commitRequestSchema = dirRequestSchema.extend({
			message: string().min(1),
			amend: boolean().optional(),
			paths: array(string().min(1)).optional(),
			/** Hunk-level commit: only these hunks of these files enter the commit.
			*  The files must have no staged changes (the index is rebuilt exactly). */
			partial: array(object({
				path: string().min(1),
				hunks: array(number().int().min(0)).min(1),
				wsFlags: object({
					trimEol: boolean().optional(),
					ignoreWs: boolean().optional(),
					ignoreBlank: boolean().optional()
				}).optional()
			})).optional()
		});
		const commitResultSchema = resultSchema(object({
			hash: string(),
			short: string(),
			amended: boolean()
		}));
		const branchesRequestSchema = dirRequestSchema;
		const branchInfoSchema = object({
			name: string(),
			current: boolean(),
			upstream: string().optional()
		});
		const branchesResultSchema = resultSchema(object({
			current: union([string(), _null()]),
			branches: array(branchInfoSchema),
			remotes: array(string())
		}));
		const branchRenameRequestSchema = dirRequestSchema.extend({
			oldName: string().min(1),
			newName: string().min(1)
		});
		const branchRenameResultSchema = resultSchema(object({
			oldName: string(),
			newName: string()
		}));
		const branchDeleteRequestSchema = dirRequestSchema.extend({
			name: string().min(1),
			force: boolean().optional()
		});
		const branchDeleteResultSchema = resultSchema(object({ name: string() }));
		const checkoutRequestSchema = dirRequestSchema.extend({
			branch: string().min(1),
			create: boolean().optional(),
			/** Ref to create the branch from (git checkout -b <branch> <startPoint>). */
			startPoint: string().optional()
		});
		const checkoutResultSchema = resultSchema(object({ branch: string() }));
		const mergeRequestSchema = dirRequestSchema.extend({
			branch: string().min(1),
			/** Force a merge commit instead of fast-forwarding (git merge --no-ff). */
			noFF: boolean().optional()
		});
		const mergeKindSchema = union([
			literal("already-up-to-date"),
			literal("fast-forward"),
			literal("merge"),
			literal("conflicts"),
			literal("error")
		]);
		const mergeResultSchema = resultSchema(object({
			merged: boolean(),
			kind: mergeKindSchema,
			hash: string().optional(),
			conflicts: array(string()).optional(),
			message: string().optional()
		}));
		const conflictContentRequestSchema = dirRequestSchema.extend({ path: string().min(1) });
		const conflictBlockSchema = object({
			oursStart: number(),
			oursEnd: number(),
			theirsStart: number(),
			theirsEnd: number(),
			resultStart: number(),
			resultEnd: number()
		});
		const conflictContentResultSchema = resultSchema(object({
			ours: string(),
			theirs: string(),
			result: string(),
			markers: number(),
			blocks: array(conflictBlockSchema)
		}));
		const resolveFileRequestSchema = dirRequestSchema.extend({
			path: string().min(1),
			content: string()
		});
		const resolveFileResultSchema = resultSchema(object({ path: string() }));
		const reposRequestSchema = object({ dirs: array(string().min(1)).min(1) });
		const reposResultSchema = resultSchema(object({ repos: array(object({
			input: string(),
			root: union([string(), _null()])
		})) }));
		/**
		* Find git repositories inside the subdirectories of `dir` (never `dir`
		* itself). Used by the directory dropdown: when the session cwd is not itself
		* a repository root, its nested repos (up to maxDepth levels) are offered as
		* candidates instead.
		*/
		const findReposRequestSchema = object({
			dir: string().min(1),
			/** Maximum subdirectory depth to scan (1..10, default 3). */
			maxDepth: number().int().min(1).max(10).optional()
		});
		const findReposResultSchema = resultSchema(object({ 
		/** Absolute paths of the repository roots found under `dir`. */
		repos: array(string()) }));
		const initRequestSchema = dirRequestSchema;
		const initResultSchema = resultSchema(object({ root: string() }));
		const cloneRequestSchema = object({
			/** Remote repository URL (https, ssh, git, file…). */
			url: string().min(1),
			/** Target directory — git clone semantics: created when missing, must be
			*  empty when it already exists. */
			target: string().min(1)
		});
		const cloneResultSchema = resultSchema(object({ root: string() }));
		const suggestGitignoreRequestSchema = dirRequestSchema;
		const suggestGitignoreResultSchema = resultSchema(object({
			path: string(),
			changed: boolean()
		}));
		const commitGroupSchema = object({
			message: string().min(1),
			files: array(string().min(1)).min(1)
		});
		const suggestCommitsRequestSchema = dirRequestSchema;
		const suggestCommitsResultSchema = resultSchema(object({
			groups: array(commitGroupSchema),
			totalFiles: number()
		}));
		const executeCommitsRequestSchema = dirRequestSchema.extend({ groups: array(commitGroupSchema).min(1) });
		const executeCommitsResultSchema = resultSchema(object({ commits: array(object({
			message: string(),
			hash: string(),
			short: string()
		})) }));
		const commitDetailRequestSchema = dirRequestSchema.extend({ hash: string().min(1) });
		const commitFileSchema = object({
			path: string(),
			status: string(),
			additions: union([number(), _null()]),
			deletions: union([number(), _null()])
		});
		const commitDetailResultSchema = resultSchema(object({
			hash: string(),
			short: string(),
			subject: string(),
			body: string(),
			author: string(),
			authorEmail: string(),
			authorDate: number(),
			committer: string(),
			committerDate: number(),
			parents: array(string()),
			files: array(commitFileSchema)
		}));
		const commitDiffRequestSchema = dirRequestSchema.extend({
			hash: string().min(1),
			path: string().optional()
		});
		const commitDiffResultSchema = resultSchema(object({ files: array(diffFileSchema) }));
		const remoteInfoSchema = object({
			name: string(),
			url: string(),
			pushUrl: string().optional()
		});
		const remotesRequestSchema = dirRequestSchema;
		const remotesResultSchema = resultSchema(object({ remotes: array(remoteInfoSchema) }));
		const remoteAddRequestSchema = dirRequestSchema.extend({
			name: string().min(1),
			url: string().min(1)
		});
		const remoteAddResultSchema = resultSchema(object({
			name: string(),
			url: string()
		}));
		const remoteRemoveRequestSchema = dirRequestSchema.extend({ name: string().min(1) });
		const remoteRemoveResultSchema = resultSchema(object({ name: string() }));
		const pushRequestSchema = dirRequestSchema.extend({
			remote: string().min(1),
			branch: string().min(1),
			setUpstream: boolean().optional(),
			/** Remote-side branch name; defaults to the local branch name. */
			remoteBranch: string().optional(),
			/** Force push (--force-with-lease). */
			force: boolean().optional(),
			/** Also push tags pointing into the pushed commits (--follow-tags). */
			followTags: boolean().optional()
		});
		const pushResultSchema = resultSchema(object({
			pushed: boolean(),
			message: string().optional()
		}));
		const fetchRequestSchema = dirRequestSchema.extend({ remote: string().optional() });
		const fetchResultSchema = resultSchema(object({
			fetched: boolean(),
			message: string().optional()
		}));
		const pullRequestSchema = dirRequestSchema.extend({
			remote: string().min(1),
			branch: string().min(1),
			strategy: union([literal("merge"), literal("rebase")]).optional()
		});
		const pullResultSchema = resultSchema(object({
			pulled: boolean(),
			kind: mergeKindSchema,
			hash: string().optional(),
			conflicts: array(string()).optional(),
			message: string().optional()
		}));
		const stashListRequestSchema = dirRequestSchema;
		const stashListResultSchema = resultSchema(object({ stashes: array(object({
			index: number(),
			message: string(),
			date: string()
		})) }));
		const stashPushRequestSchema = dirRequestSchema.extend({
			message: string().optional(),
			includeUntracked: boolean().optional()
		});
		const stashPushResultSchema = resultSchema(object({
			stashed: boolean(),
			message: string().optional()
		}));
		const stashPopRequestSchema = dirRequestSchema.extend({ index: number().int().min(0).optional() });
		const stashPopResultSchema = resultSchema(object({
			popped: boolean(),
			conflicts: array(string()).optional(),
			message: string().optional()
		}));
		const stashDropRequestSchema = dirRequestSchema.extend({ index: number().int().min(0).optional() });
		const stashDropResultSchema = resultSchema(object({ dropped: boolean() }));
		dirRequestSchema.extend({ index: number().int().min(0).optional() });
		resultSchema(object({
			applied: boolean(),
			conflicts: array(string()).optional(),
			message: string().optional()
		}));
		resultSchema(object({ cleared: boolean() }));
		dirRequestSchema.extend({ index: number().int().min(0) });
		resultSchema(object({ lines: array(string()) }));
		dirRequestSchema.extend({
			index: number().int().min(0),
			name: string().min(1)
		});
		resultSchema(object({ branch: string() }));
		const cherryPickRequestSchema = dirRequestSchema.extend({ 
		/** Single commit, or several to apply in one cherry-pick run. */
		hash: union([string().min(1), array(string().min(1))]) });
		const cherryPickResultSchema = resultSchema(object({
			picked: boolean(),
			conflicts: array(string()).optional(),
			message: string().optional()
		}));
		const revertRequestSchema = dirRequestSchema.extend({ 
		/** Single commit, or several to revert in one run. */
		hash: union([string().min(1), array(string().min(1))]) });
		const revertResultSchema = resultSchema(object({
			reverted: boolean(),
			conflicts: array(string()).optional(),
			message: string().optional()
		}));
		const squashCommitsRequestSchema = dirRequestSchema.extend({
			/** Commits to fold into one, oldest first. Must be a contiguous run ending at HEAD. */
			hashes: array(string().min(1)).min(2),
			message: string()
		});
		const squashCommitsResultSchema = resultSchema(object({
			hash: string(),
			short: string()
		}));
		const resetRequestSchema = dirRequestSchema.extend({
			mode: union([
				literal("soft"),
				literal("mixed"),
				literal("hard")
			]),
			ref: string().optional()
		});
		const resetResultSchema = resultSchema(object({
			reset: boolean(),
			mode: string()
		}));
		const operationAbortRequestSchema = dirRequestSchema;
		const operationAbortResultSchema = resultSchema(object({ aborted: boolean() }));
		const operationContinueRequestSchema = dirRequestSchema.extend({ message: string().optional() });
		const operationContinueResultSchema = resultSchema(object({
			continued: boolean(),
			hash: string().optional()
		}));
		const operationSkipRequestSchema = dirRequestSchema;
		const operationSkipResultSchema = resultSchema(object({
			skipped: boolean(),
			conflicts: array(string()).optional()
		}));
		const tagsRequestSchema = dirRequestSchema;
		const tagsResultSchema = resultSchema(object({ tags: array(object({
			name: string(),
			hash: string(),
			short: string(),
			subject: string().optional()
		})) }));
		const tagCreateRequestSchema = dirRequestSchema.extend({
			name: string().min(1),
			hash: string().optional()
		});
		const tagCreateResultSchema = resultSchema(object({ name: string() }));
		const tagDeleteRequestSchema = dirRequestSchema.extend({ name: string().min(1) });
		const tagDeleteResultSchema = resultSchema(object({ name: string() }));
		const graphCharSchema = object({
			ch: string(),
			color: string().optional()
		});
		const logGraphRequestSchema = dirRequestSchema.extend({
			limit: number().int().min(1).max(300).optional(),
			/** Restrict to commits reachable from this ref. */
			branch: string().optional(),
			/** Commit author filter (substring or email pattern). */
			author: string().optional(),
			/** ISO date or "N days ago" style since filter. */
			since: string().optional(),
			/** ISO date or "N days ago" style until filter. */
			until: string().optional(),
			/** Restrict to commits touching this path. */
			path: string().optional()
		});
		const logGraphResultSchema = resultSchema(object({ rows: array(object({
			graph: array(graphCharSchema),
			hash: string(),
			short: string(),
			subject: string(),
			refs: string(),
			author: string(),
			date: number()
		})) }));
		const logAuthorsRequestSchema = dirRequestSchema.extend({ 
		/** Restrict to commits reachable from this ref (matches the branch filter). */
		branch: string().optional() });
		const logAuthorsResultSchema = resultSchema(object({ authors: array(object({
			name: string(),
			email: string(),
			count: number()
		})) }));
		const commitInfoSchema = object({
			hash: string(),
			short: string(),
			subject: string(),
			author: string(),
			date: number(),
			refs: string()
		});
		const fileLogRequestSchema = dirRequestSchema.extend({
			path: string().min(1),
			limit: number().int().min(1).max(200).optional()
		});
		const fileLogResultSchema = resultSchema(object({ commits: array(commitInfoSchema) }));
		const compareRequestSchema = dirRequestSchema.extend({
			from: string().min(1),
			to: string().min(1)
		});
		/** git config scope: system → global → local (later levels override). */
		const configScopeSchema = _enum([
			"system",
			"global",
			"local"
		]);
		const configListRequestSchema = dirRequestSchema.extend({ scope: configScopeSchema });
		const configListResultSchema = resultSchema(object({
			entries: array(object({
				key: string(),
				value: string()
			})),
			/** Real config-file path per scope (for display). */
			configFiles: object({
				system: string(),
				global: string(),
				local: string()
			})
		}));
		const configSetRequestSchema = dirRequestSchema.extend({
			scope: configScopeSchema,
			key: string().min(1),
			value: string()
		});
		const configSetResultSchema = resultSchema(object({
			key: string(),
			value: string()
		}));
		dirRequestSchema.extend({
			scope: configScopeSchema,
			key: string().min(1)
		});
		resultSchema(object({ key: string() }));
		const pullRemoteBranchRequestSchema = dirRequestSchema.extend({ 
		/** Full remote ref name, e.g. "remotes/origin/main". */
		remoteRef: string().min(1) });
		const pullRemoteBranchResultSchema = resultSchema(object({
			/** Local branch that ended up checked out. */
			branch: string(),
			pulled: boolean()
		}));
		const compareResultSchema = resultSchema(object({ files: array(object({
			path: string(),
			status: string(),
			additions: union([number(), _null()]),
			deletions: union([number(), _null()])
		})) }));
		const changelistEntrySchema = object({
			name: string().min(1),
			paths: array(string())
		});
		const changelistListRequestSchema = dirRequestSchema;
		const changelistListResultSchema = resultSchema(object({
			changelists: array(changelistEntrySchema),
			active: string()
		}));
		const changelistCreateRequestSchema = dirRequestSchema.extend({ name: string().min(1).max(64) });
		const changelistCreateResultSchema = resultSchema(object({ name: string() }));
		const changelistRenameRequestSchema = dirRequestSchema.extend({
			oldName: string().min(1).max(64),
			newName: string().min(1).max(64)
		});
		const changelistRenameResultSchema = resultSchema(object({ name: string() }));
		const changelistDeleteRequestSchema = dirRequestSchema.extend({ name: string().min(1).max(64) });
		const changelistDeleteResultSchema = resultSchema(object({ name: string() }));
		const changelistMoveRequestSchema = dirRequestSchema.extend({
			paths: array(string().min(1)).min(1),
			to: string().min(1).max(64)
		});
		const changelistMoveResultSchema = resultSchema(object({ moved: number() }));
		const changelistSetActiveRequestSchema = dirRequestSchema.extend({ name: string().min(1).max(64) });
		const changelistSetActiveResultSchema = resultSchema(object({ active: string() }));
		const ignoreAddRequestSchema = dirRequestSchema.extend({
			path: string().min(1),
			target: union([literal("gitignore"), literal("exclude")])
		});
		const ignoreAddResultSchema = resultSchema(object({
			path: string(),
			target: string()
		}));
		const pushPreviewRequestSchema = dirRequestSchema.extend({
			remote: string().min(1),
			branch: string().min(1)
		});
		const pushPreviewResultSchema = resultSchema(object({
			upstream: union([string(), _null()]),
			ahead: array(commitInfoSchema)
		}));
		const rebaseListRequestSchema = dirRequestSchema.extend({ 
		/** Explicit rebase base (e.g. "rebase X onto <base>"); auto-detected when omitted. */
		base: string().optional() });
		const rebaseListResultSchema = resultSchema(object({
			base: string(),
			commits: array(commitInfoSchema)
		}));
		const rebaseActionSchema = union([
			literal("pick"),
			literal("reword"),
			literal("squash"),
			literal("fixup"),
			literal("drop")
		]);
		const rebaseStartRequestSchema = dirRequestSchema.extend({
			base: string().min(1),
			items: array(object({
				action: rebaseActionSchema,
				hash: string().min(1),
				message: string().optional()
			})).min(1)
		});
		const rebaseStartResultSchema = resultSchema(object({
			started: boolean(),
			conflicts: array(string()).optional(),
			message: string().optional()
		}));
		const diffWithWorktreeRequestSchema = dirRequestSchema.extend({
			hash: string().min(1),
			/** Restrict the diff to one path. */
			path: string().optional()
		});
		const diffWithWorktreeResultSchema = resultSchema(object({ files: array(diffFileSchema) }));
		//#endregion
		//#region src/descriptors.ts
		/**
		* Invocation descriptors for the `git` Remote — one source of truth consumed
		* by both the host TYPERT manifest (typert.ts) and the client contribution
		* (remote.ts), mirroring the shape the repo's typert generator emits.
		*/
		const PACKAGE = "dsh-git-ui";
		const NS$1 = "git";
		function def(method, requestSchema, requestType, resultSchema, resultType) {
			return {
				id: `${PACKAGE}#${NS$1}/${method}`,
				service: NS$1,
				namespace: NS$1,
				method,
				invocation: { kind: "direct" },
				parameters: [{
					name: "request",
					wire: "request",
					source: "json",
					codec: {
						mode: "strict",
						typeSymbol: `${PACKAGE}/types#${requestType}`,
						schema: requestSchema
					}
				}],
				result: {
					mode: "strict",
					typeSymbol: `${PACKAGE}/types#${resultType}`,
					schema: resultSchema
				},
				sourceLocation: {
					file: "src/index.ts",
					line: 1,
					column: 1
				}
			};
		}
		//#endregion
		//#region src/remote.ts
		/**
		* Client typert contribution: mounted by the browser plugin through
		* ctx.remote.$mount(contribution). The descriptors mirror the host manifest,
		* so both ends validate the same wire.
		*/
		const TYPERT_REMOTE = {
			package: "dsh-git-ui",
			descriptors: [
				def("status", statusRequestSchema, "GitStatusRequest", statusResultSchema, "GitStatusResult"),
				def("diff", diffRequestSchema, "GitDiffRequest", diffResultSchema, "GitDiffResult"),
				def("stageHunks", stageHunksRequestSchema, "GitStageHunksRequest", stageHunksResultSchema, "GitStageHunksResult"),
				def("revertHunks", revertHunksRequestSchema, "GitRevertHunksRequest", revertHunksResultSchema, "GitRevertHunksResult"),
				def("stageChanges", stageChangesRequestSchema, "GitStageChangesRequest", stageChangesResultSchema, "GitStageChangesResult"),
				def("revertChanges", revertChangesRequestSchema, "GitRevertChangesRequest", revertChangesResultSchema, "GitRevertChangesResult"),
				def("stage", pathsRequestSchema, "GitPathsRequest", pathsResultSchema, "GitPathsResult"),
				def("unstage", pathsRequestSchema, "GitPathsRequest", pathsResultSchema, "GitPathsResult"),
				def("discard", pathsRequestSchema, "GitPathsRequest", pathsResultSchema, "GitPathsResult"),
				def("untrack", pathsRequestSchema, "GitPathsRequest", pathsResultSchema, "GitPathsResult"),
				def("getFromRevision", getFromRevisionRequestSchema, "GitGetFromRevisionRequest", getFromRevisionResultSchema, "GitGetFromRevisionResult"),
				def("commit", commitRequestSchema, "GitCommitRequest", commitResultSchema, "GitCommitResult"),
				def("branches", branchesRequestSchema, "GitBranchesRequest", branchesResultSchema, "GitBranchesResult"),
				def("branchRename", branchRenameRequestSchema, "GitBranchRenameRequest", branchRenameResultSchema, "GitBranchRenameResult"),
				def("branchDelete", branchDeleteRequestSchema, "GitBranchDeleteRequest", branchDeleteResultSchema, "GitBranchDeleteResult"),
				def("checkout", checkoutRequestSchema, "GitCheckoutRequest", checkoutResultSchema, "GitCheckoutResult"),
				def("merge", mergeRequestSchema, "GitMergeRequest", mergeResultSchema, "GitMergeResult"),
				def("conflictContent", conflictContentRequestSchema, "GitConflictContentRequest", conflictContentResultSchema, "GitConflictContentResult"),
				def("resolveFile", resolveFileRequestSchema, "GitResolveFileRequest", resolveFileResultSchema, "GitResolveFileResult"),
				def("repos", reposRequestSchema, "GitReposRequest", reposResultSchema, "GitReposResult"),
				def("findRepos", findReposRequestSchema, "GitFindReposRequest", findReposResultSchema, "GitFindReposResult"),
				def("init", initRequestSchema, "GitInitRequest", initResultSchema, "GitInitResult"),
				def("clone", cloneRequestSchema, "GitCloneRequest", cloneResultSchema, "GitCloneResult"),
				def("suggestGitignore", suggestGitignoreRequestSchema, "GitSuggestGitignoreRequest", suggestGitignoreResultSchema, "GitSuggestGitignoreResult"),
				def("commitDetail", commitDetailRequestSchema, "GitCommitDetailRequest", commitDetailResultSchema, "GitCommitDetailResult"),
				def("commitDiff", commitDiffRequestSchema, "GitCommitDiffRequest", commitDiffResultSchema, "GitCommitDiffResult"),
				def("suggestCommits", suggestCommitsRequestSchema, "GitSuggestCommitsRequest", suggestCommitsResultSchema, "GitSuggestCommitsResult"),
				def("executeCommits", executeCommitsRequestSchema, "GitExecuteCommitsRequest", executeCommitsResultSchema, "GitExecuteCommitsResult"),
				def("remotes", remotesRequestSchema, "GitRemotesRequest", remotesResultSchema, "GitRemotesResult"),
				def("remoteAdd", remoteAddRequestSchema, "GitRemoteAddRequest", remoteAddResultSchema, "GitRemoteAddResult"),
				def("remoteRemove", remoteRemoveRequestSchema, "GitRemoteRemoveRequest", remoteRemoveResultSchema, "GitRemoteRemoveResult"),
				def("push", pushRequestSchema, "GitPushRequest", pushResultSchema, "GitPushResult"),
				def("fetch", fetchRequestSchema, "GitFetchRequest", fetchResultSchema, "GitFetchResult"),
				def("pull", pullRequestSchema, "GitPullRequest", pullResultSchema, "GitPullResult"),
				def("stashList", stashListRequestSchema, "GitStashListRequest", stashListResultSchema, "GitStashListResult"),
				def("stashPush", stashPushRequestSchema, "GitStashPushRequest", stashPushResultSchema, "GitStashPushResult"),
				def("stashPop", stashPopRequestSchema, "GitStashPopRequest", stashPopResultSchema, "GitStashPopResult"),
				def("stashDrop", stashDropRequestSchema, "GitStashDropRequest", stashDropResultSchema, "GitStashDropResult"),
				def("cherryPick", cherryPickRequestSchema, "GitCherryPickRequest", cherryPickResultSchema, "GitCherryPickResult"),
				def("revert", revertRequestSchema, "GitRevertRequest", revertResultSchema, "GitRevertResult"),
				def("squashCommits", squashCommitsRequestSchema, "GitSquashCommitsRequest", squashCommitsResultSchema, "GitSquashCommitsResult"),
				def("reset", resetRequestSchema, "GitResetRequest", resetResultSchema, "GitResetResult"),
				def("operationAbort", operationAbortRequestSchema, "GitOperationAbortRequest", operationAbortResultSchema, "GitOperationAbortResult"),
				def("operationContinue", operationContinueRequestSchema, "GitOperationContinueRequest", operationContinueResultSchema, "GitOperationContinueResult"),
				def("operationSkip", operationSkipRequestSchema, "GitOperationSkipRequest", operationSkipResultSchema, "GitOperationSkipResult"),
				def("tags", tagsRequestSchema, "GitTagsRequest", tagsResultSchema, "GitTagsResult"),
				def("tagCreate", tagCreateRequestSchema, "GitTagCreateRequest", tagCreateResultSchema, "GitTagCreateResult"),
				def("tagDelete", tagDeleteRequestSchema, "GitTagDeleteRequest", tagDeleteResultSchema, "GitTagDeleteResult"),
				def("logGraph", logGraphRequestSchema, "GitLogGraphRequest", logGraphResultSchema, "GitLogGraphResult"),
				def("logAuthors", logAuthorsRequestSchema, "GitLogAuthorsRequest", logAuthorsResultSchema, "GitLogAuthorsResult"),
				def("fileLog", fileLogRequestSchema, "GitFileLogRequest", fileLogResultSchema, "GitFileLogResult"),
				def("compare", compareRequestSchema, "GitCompareRequest", compareResultSchema, "GitCompareResult"),
				def("configList", configListRequestSchema, "GitConfigListRequest", configListResultSchema, "GitConfigListResult"),
				def("configSet", configSetRequestSchema, "GitConfigSetRequest", configSetResultSchema, "GitConfigSetResult"),
				def("pullRemoteBranch", pullRemoteBranchRequestSchema, "GitPullRemoteBranchRequest", pullRemoteBranchResultSchema, "GitPullRemoteBranchResult"),
				def("changelistList", changelistListRequestSchema, "GitChangelistListRequest", changelistListResultSchema, "GitChangelistListResult"),
				def("changelistCreate", changelistCreateRequestSchema, "GitChangelistCreateRequest", changelistCreateResultSchema, "GitChangelistCreateResult"),
				def("changelistRename", changelistRenameRequestSchema, "GitChangelistRenameRequest", changelistRenameResultSchema, "GitChangelistRenameResult"),
				def("changelistDelete", changelistDeleteRequestSchema, "GitChangelistDeleteRequest", changelistDeleteResultSchema, "GitChangelistDeleteResult"),
				def("changelistMove", changelistMoveRequestSchema, "GitChangelistMoveRequest", changelistMoveResultSchema, "GitChangelistMoveResult"),
				def("changelistSetActive", changelistSetActiveRequestSchema, "GitChangelistSetActiveRequest", changelistSetActiveResultSchema, "GitChangelistSetActiveResult"),
				def("ignoreAdd", ignoreAddRequestSchema, "GitIgnoreAddRequest", ignoreAddResultSchema, "GitIgnoreAddResult"),
				def("pushPreview", pushPreviewRequestSchema, "GitPushPreviewRequest", pushPreviewResultSchema, "GitPushPreviewResult"),
				def("rebaseList", rebaseListRequestSchema, "GitRebaseListRequest", rebaseListResultSchema, "GitRebaseListResult"),
				def("rebaseStart", rebaseStartRequestSchema, "GitRebaseStartRequest", rebaseStartResultSchema, "GitRebaseStartResult"),
				def("diffWithWorktree", diffWithWorktreeRequestSchema, "GitDiffWithWorktreeRequest", diffWithWorktreeResultSchema, "GitDiffWithWorktreeResult"),
				def("listDir", listDirRequestSchema, "GitListDirRequest", listDirResultSchema, "GitListDirResult"),
				def("readFile", readFileRequestSchema, "GitReadFileRequest", readFileResultSchema, "GitReadFileResult"),
				def("binaryContent", binaryContentRequestSchema, "GitBinaryContentRequest", binaryContentResultSchema, "GitBinaryContentResult"),
				def("writeFile", writeFileRequestSchema, "GitWriteFileRequest", writeFileResultSchema, "GitWriteFileResult"),
				def("deleteFile", deleteFileRequestSchema, "GitDeleteFileRequest", deleteFileResultSchema, "GitDeleteFileResult")
			]
		};
		//#endregion
		//#region src/client/index.tsx
		/**
		* dsh-git-ui browser plugin entry: mounts the git Remote contribution, then
		* registers the header action and the dock panel. Mirrors the api-remotes
		* mount pattern (async apply + disposer chain).
		*/
		const NS = "git-ui";
		const inject = [
			"remote",
			"slots",
			"locale"
		];
		async function apply(ctx) {
			ensureStyles();
			const disposers = [];
			try {
				const dispose = await ctx.remote.$mount(TYPERT_REMOTE);
				if (typeof dispose === "function") disposers.push(dispose);
			} catch (error) {
				for (const dispose of disposers.reverse()) await dispose();
				throw error;
			}
			const api = new GitApi(() => {
				const namespace = ctx.remote.namespaces?.get("git")?.service;
				if (namespace === void 0) throw new GitApiError("not-mounted", "git Remote namespace is not mounted");
				return namespace;
			});
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "git-ui: dictionaries");
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "git-ui-action",
				order: 30,
				locale: NS,
				inject: () => ({ api })
			}, GitHeaderAction));
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "git-ui-panel",
				order: 20,
				locale: NS,
				inject: () => ({ api })
			}, GitPanel));
			return async () => {
				for (const dispose of disposers.reverse()) await dispose();
			};
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		
		return module.exports;
	}
});
