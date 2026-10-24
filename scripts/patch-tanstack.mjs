import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

function findFiles(dir, matchFileName, results = []) {
  if (!existsSync(dir)) return results;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        findFiles(full, matchFileName, results);
      } else if (matchFileName(entry.name, full)) {
        results.push(full);
      }
    }
  } catch {
    /* ignore unreadable dirs */
  }
  return results;
}

const targetFiles = findFiles(
  resolve(process.cwd(), "node_modules"),
  (name, full) =>
    full.includes("start-compiler-plugin") && (name === "plugin.js" || name === "plugin.ts"),
);

for (const fullPath of targetFiles) {
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

  if (content.includes("this.error(`Invalid server function ID: ${fnId}`);")) {
    content = content.replace(
      "this.error(`Invalid server function ID: ${fnId}`);",
      "return `export {}`;",
    );
    modified = true;
  } else if (content.includes("this.error(`Invalid server function ID: ${fnId}`)")) {
    content = content.replace(
      "this.error(`Invalid server function ID: ${fnId}`)",
      "return `export {}`",
    );
    modified = true;
  }

  if (modified) {
    writeFileSync(fullPath, content, "utf8");
    console.log(`[patch-tanstack] Patched ${fullPath}`);
  }
}
