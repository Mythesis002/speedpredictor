import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const filesToPatch = [
  "node_modules/@tanstack/start-plugin-core/dist/esm/vite/start-compiler-plugin/plugin.js",
  "node_modules/@tanstack/start-plugin-core/src/vite/start-compiler-plugin/plugin.ts",
];

for (const relPath of filesToPatch) {
  const fullPath = resolve(process.cwd(), relPath);
  if (!existsSync(fullPath)) continue;

  let content = readFileSync(fullPath, "utf8");
  let modified = false;

  if (content.includes("`${absPath}?${SERVER_FN_LOOKUP}`")) {
    content = content.replace("`${absPath}?${SERVER_FN_LOOKUP}`", "absPath");
    modified = true;
  }

  if (content.includes("`${absPath}?${SERVER_FN_LOOKUP}`)")) {
    content = content.replace("`${absPath}?${SERVER_FN_LOOKUP}`)", "absPath)");
    modified = true;
  }

  if (modified) {
    writeFileSync(fullPath, content, "utf8");
    console.log(`[patch-tanstack] Patched ${relPath}`);
  }
}
