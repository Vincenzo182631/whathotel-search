/*
 * build-standalone.mjs — bundle the whole landing page into ONE self-contained
 * HTML file (all CSS + JS + data inline), suitable for pasting into GoHighLevel
 * (Custom Code / HTML element or a funnel step) or hosting as a single file.
 *
 * Uses the real WhataHotel image URLs (they load on any https page, incl. GHL).
 *
 * Run:  node scripts/build-standalone.mjs
 * Output: gohighlevel.html  (repo root)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

let html = read("index.html");

// Inline every local stylesheet/script (leave third-party CDN/config alone).
const inlines = [
  ['<link rel="stylesheet" href="assets/css/homes.css">', () => "<style>\n" + read("assets/css/homes.css") + "\n</style>"],
  ['<script src="assets/js/data.js"></script>', () => "<script>\n" + read("assets/js/data.js") + "\n</script>"],
  ['<script src="assets/js/images.js"></script>', () => "<script>\n" + read("assets/js/images.js") + "\n</script>"],
  ['<script src="assets/js/descriptions.js"></script>', () => "<script>\n" + read("assets/js/descriptions.js") + "\n</script>"],
  ['<script src="assets/js/characteristics.js"></script>', () => "<script>\n" + read("assets/js/characteristics.js") + "\n</script>"],
  ['<script src="assets/js/details.js"></script>', () => "<script>\n" + read("assets/js/details.js") + "\n</script>"],
  ['<script src="assets/js/homes-inventory-filter.js"></script>', () => "<script>\n" + read("assets/js/homes-inventory-filter.js") + "\n</script>"],
  ['<script src="assets/js/homes.js" defer></script>', () => "<script>\n" + read("assets/js/homes.js") + "\n</script>"],
];
for (const [tag, payload] of inlines) {
  if (html.indexOf(tag) === -1) throw new Error("Tag not found while bundling: " + tag);
  html = html.replace(tag, payload); // function form → no $-substitution surprises
}

const OUT = join(root, "gohighlevel.html");
writeFileSync(OUT, html);
console.log("Wrote", OUT, "(" + Math.round(html.length / 1024) + " KB, self-contained)");
