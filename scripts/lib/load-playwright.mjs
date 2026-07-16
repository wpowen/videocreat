import { createRequire } from "node:module";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";

export function loadPlaywright() {
  const moduleRoots = [
    process.env.CODEX_WORKSPACE_NODE_MODULES,
    ...String(process.env.NODE_PATH || "").split(delimiter),
    join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules"),
  ].filter(Boolean);
  const errors = [];
  for (const modulesRoot of moduleRoots) {
    try {
      return createRequire(resolve(modulesRoot, "playwright", "package.json"))("playwright");
    } catch (error) {
      errors.push(`${modulesRoot}: ${error.message}`);
    }
  }
  try {
    return createRequire(import.meta.url)("playwright");
  } catch (error) {
    errors.push(`module resolution: ${error.message}`);
  }
  throw new Error(`Unable to resolve Playwright. Set CODEX_WORKSPACE_NODE_MODULES or NODE_PATH.\n${errors.join("\n")}`);
}
