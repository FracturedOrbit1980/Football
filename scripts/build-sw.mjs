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
  !f.endsWith("sw.js") && !f.endsWith(".map") && !f.startsWith("404") &&
  !f.startsWith("lite/assets/ci_unpack/") &&
  (f.startsWith("_next/static/") || /\.(html|svg|png|ico|webmanifest|json)$/.test(f) ||
    /^(lite|pro)\/.*\.(js|css)$/.test(f) || /(?:^|\/)(?:index|__[^/]+)\.txt$/.test(f));
const assets = files.filter(keep).sort();
const precache = assets.map((f) => (f.endsWith("/index.html") ? f.slice(0, -"index.html".length) : f));
precache.unshift("");

const template = readFileSync("public/sw.js", "utf8");
const hash = createHash("sha256").update(template);
for (const f of assets) hash.update(f).update(readFileSync(join(out, f)));
const version = hash.digest("hex").slice(0, 12);

writeFileSync(join(out, "sw.js"), template.replace("\"__BUILD__\"", JSON.stringify(version)).replace("(__PRECACHE__)", `(${JSON.stringify(precache)})`));
console.log(`sw.js: ${precache.length} files precached, version ${version}`);
