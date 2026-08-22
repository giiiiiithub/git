/**
 * dsh-git-ui browser plugin entry: mounts the git Remote contribution, then
 * registers the header action and the dock panel. Mirrors the api-remotes
 * mount pattern (async apply + disposer chain).
 */
import { GitApi, GitApiError } from "./api.js";
import { ensureStyles } from "./styles.js";
import { GitHeaderAction } from "./components/GitHeaderAction.js";
import { GitSidebarAction } from "./components/GitSidebarAction.js";
import { GitPanel } from "./components/GitPanel.js";
import { zh, en } from "./locale.js";
import { TYPERT_REMOTE } from "../remote.js";

const NS = "git-ui";

export const inject = ["remote", "slots", "locale"];

type Dispose = (() => void | Promise<void>) | void;

export async function apply(ctx: {
  remote: {
    $mount(contribution: unknown): Promise<Dispose>;
  };
  slots: {
    inject(name: string, callback: () => Dispose | Iterable<Dispose>): void;
    register(
      options: {
        name: string;
        id?: string;
        order?: number;
        locale?: string;
        inject?: (sessionId?: string) => unknown;
      },
      component: unknown
    ): Dispose;
  };
  locale: {
    register(namespace: string, dictionaries: Record<string, unknown>): Dispose;
  };
  effect(callback: () => Dispose | void, label?: string): void;
}): Promise<Dispose> {
  ensureStyles();

  const disposers: Array<() => void | Promise<void>> = [];
  try {
    const dispose = await ctx.remote.$mount(TYPERT_REMOTE);
    if (typeof dispose === "function") disposers.push(dispose);
  } catch (error) {
    for (const dispose of disposers.reverse()) await dispose();
    throw error;
  }

  // The namespace is mounted above; cordis would otherwise guard `ctx.remote.git`
  // behind its service-resolution reject (the namespace service lives on the
  // gateway's own context, invisible to sibling plugin scopes). The gateway's
  // ClientRemoteService keeps the live namespace services in its public
  // `namespaces` map, so we read the instance directly — its methods are plain
  // (request) => Promise<GitResult<T>> functions.
  const api = new GitApi(() => {
    const remote = ctx.remote as unknown as {
      namespaces?: Map<string, { service: unknown }>;
    };
    const namespace = remote.namespaces?.get("git")?.service;
    if (namespace === undefined) {
      throw new GitApiError("not-mounted", "git Remote namespace is not mounted");
    }
    return namespace as never;
  });

  ctx.effect(
    () => ctx.locale.register(NS, { zh, en }),
    "git-ui: dictionaries"
  );

  // Left-sidebar foot entry (root scope — always visible, no session
  // needed): toggles the same store as the header action, so the panel
  // still opens in the conversation dock exactly as before.
  ctx.slots.inject("sidebar.footer.action", () =>
    ctx.slots.register(
      {
        name: "sidebar.footer.action",
        id: "git-ui-sidebar",
        order: 30,
        locale: NS,
        inject: () => ({ api })
      },
      GitSidebarAction
    )
  );

  ctx.slots.inject("conversation.session.header.actions", () =>
    ctx.slots.register(
      {
        name: "conversation.session.header.actions",
        id: "git-ui-action",
        order: 30,
        locale: NS,
        inject: () => ({ api })
      },
      GitHeaderAction
    )
  );

  ctx.slots.inject("conversation.input.dock", () =>
    ctx.slots.register(
      {
        name: "conversation.input.dock",
        id: "git-ui-panel",
        order: 20,
        locale: NS,
        inject: () => ({ api })
      },
      GitPanel
    )
  );

  return async () => {
    for (const dispose of disposers.reverse()) await dispose();
  };
}
