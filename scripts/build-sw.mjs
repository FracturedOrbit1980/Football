// Post-build: writes out/sw.js with the list of exported pages and static assets to precache.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const out = "out";
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(relative(out, full).split(sep).join("/"));
  }
})(out);

const keep = (f) =>
  f !== "sw.js" && !f.endsWith(".txt") && !f.endsWith(".map") && !f.startsWith("404") &&
  (f.endsWith(".html") || f.startsWith("_next/static/") || /\.(svg|png|ico|webmanifest|json)$/.test(f));
const precache = files.filter(keep).sort().map((f) => (f.endsWith("/index.html") ? f.slice(0, -"index.html".length) : f));
precache.unshift("");

const hash = createHash("sha256");
for (const f of files.filter(keep).sort()) hash.update(f).update(readFileSync(join(out, f)));
const version = hash.digest("hex").slice(0, 12);

const template = readFileSync("public/sw.js", "utf8");
writeFileSync(join(out, "sw.js"), template.replace("__BUILD__", version).replace("__PRECACHE__", JSON.stringify(precache)));
console.log(`sw.js: ${precache.length} files precached, version ${version}`);
