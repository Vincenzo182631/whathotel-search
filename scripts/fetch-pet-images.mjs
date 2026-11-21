/*
 * fetch-pet-images.mjs — the main photo (og:image) of each hotel in the pet-friendly
 * collection, from its own WhataHotel page. Used for the photo cards on /pet-friendly.
 *
 * Input:  scripts/pet-collection.json
 * Output: scripts/pet-images.json  { "<hotel id>": "<image url>" }
 * Run:    node scripts/fetch-pet-images.mjs          (only hotels not fetched yet)
 *         node scripts/fetch-pet-images.mjs --all    (refetch everything)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(dir, "pet-images.json");
const hotels = JSON.parse(readFileSync(join(dir, "pet-collection.json"), "utf8")).hotels;
const out = existsSync(OUT) && !process.argv.includes("--all") ? JSON.parse(readFileSync(OUT, "utf8")) : {};

const get = (url) => new Promise((res) => execFile("curl", ["-sL", "--max-time", "30", "-A", "Mozilla/5.0 (WhataHotel pet-friendly page build)", url],
  { maxBuffer: 20 * 1024 * 1024 }, (err, body) => res(err ? "" : body)));

const queue = hotels.filter((h) => !out[h.id]);
let done = 0, miss = 0;
async function work() {
  while (queue.length) {
    const h = queue.shift();
    const html = await get(`https://www.whatahotel.com/hotels/${h.id}/${h.slug}.html`);
    const m = html.match(/property="og:image"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:image"/i);
    if (m && /\.(jpe?g|png|webp)(\?|$)/i.test(m[1]) && !/logo/i.test(m[1])) out[h.id] = m[1].replace(/^http:/, "https:");
    else miss++;
    if (++done % 50 === 0) console.log(`  ${done}/${done + queue.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, work));
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`Pet hotel photos: ${Object.keys(out).length} of ${hotels.length}` + (miss ? ` (${miss} pages had no photo)` : ""));
