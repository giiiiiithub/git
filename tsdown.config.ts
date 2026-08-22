import { defineConfig } from "tsdown";

/**
 * dsh-git-ui build:
 *  - host faces (service entry + typert/remote artifacts): ESM for Node, keep
 *    @deepseek-ai/* and zod external (resolved from the profile's node_modules
 *    at runtime).
 *  - client face: CJS bundle with react external; zod is inlined so the
 *    browser module table needs no extra row. scripts/wrap-client.mjs then
 *    wraps the output into the window.__ModuleLoader__.load({ id, factory })
 *    contract.
 */
export default defineConfig([
  {
    entry: ["src/index.ts", "src/typert.ts", "src/remote.ts"],
    format: ["esm"],
    platform: "node",
    target: "node20",
    clean: true,
    dts: false,
    sourcemap: false,
    outDir: "lib",
    deps: {
      neverBundle: [/^@deepseek-ai\//, /^zod$/]
    }
  },
  {
    entry: ["src/client/index.tsx"],
    name: "client",
    format: ["cjs"],
    platform: "browser",
    target: "es2022",
    clean: false,
    dts: false,
    sourcemap: false,
    outDir: "lib",
    deps: {
      // zod is inlined so the browser module table needs no extra row;
      // react stays external (resolved by the host page).
      onlyBundle: [/^zod$/],
      neverBundle: [/^react($|\/)/, /^react-dom($|\/)/]
    },
    // ensure the CSS-module machinery never kicks in: we inject styles by hand
    cssModules: false
  }
]);
