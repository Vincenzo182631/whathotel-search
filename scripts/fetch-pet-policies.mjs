/*
 * fetch-pet-policies.mjs — reads each property's REAL WhataHotel page and records
 * what it says about pets, word for word. Nothing is inferred from names or brands.
 *
 * Source: the page's FAQ (JSON-LD FAQPage), e.g.
 *   "Is Hawks Cay Resort pet-friendly?" → "Yes, Hawks Cay Resort welcomes dogs! ..."
 * plus any sentence on the page that explicitly mentions pets/dogs.
 *
 * Output: scripts/pet-policies.json  { "<id>": { status, question, answer, url } }
 *   status "yes"     the page says pets (or dogs) are welcome
 *          "no"      the page says pets are not allowed (service animals may be noted)
 *          "unclear" the page mentions pets but the answer isn't a clear yes or no
 * Properties whose page says nothing about pets are left out.
 *
 * Run:  node scripts/fetch-pet-policies.mjs            (all properties)
 *       node scripts/fetch-pet-policies.mjs --only=4574,1253
 * Then: npm run build   (build-data reads pet-policies.json)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const OUT = join(__dirname, "pet-policies.json");

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(root, "assets", "js", "data.js"), "utf8"), sandbox);
let props = sandbox.window.WAH_PROPERTIES.map((p) => ({ id: p.id, url: p.url, name: p.name }));
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? new Set(onlyArg.slice(7).split(",").map(Number)) : null;
if (ONLY) props = props.filter((p) => ONLY.has(p.id));

function fetchPage(url) {
  return new Promise((resolve) => {
    execFile("curl", ["-sL", "--max-time", "30", "-A", "Mozilla/5.0 (WhataHotel Homes page build)", url],
      { maxBuffer: 20 * 1024 * 1024 }, (err, out) => resolve(err ? "" : out));
  });
}
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&#8217;/g, "’").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const PET = /\b(pets?|pet-friendly|dogs?|cats?|animals?)\b/i;

function faqItems(html) {
  const items = [];
  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const b of blocks) {
    let j; try { j = JSON.parse(b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "")); } catch { continue; }
    (function walk(x) {
      if (!x || typeof x !== "object") return;
      if (Array.isArray(x)) return x.forEach(walk);
      if (x["@type"] === "Question" && x.acceptedAnswer) items.push({ q: String(x.name || ""), a: String(x.acceptedAnswer.text || "") });
      Object.values(x).forEach(walk);
    })(j);
  }
  return items;
}
// What counts as a pet policy, and which way it goes. Tested against every answer the
// WhataHotel pages give: words like "Hobie Cats", "dogsledding", "truffle hunting with
// trained dogs", "Two Dogs Cafe", "pet-sitting" or "exotic animals" are NOT a policy.
const NOISE = /hobie cats?|dog ?sledd?ing|trained dogs|two dogs|pet[- ]sitting|exotic animals|animal and bird|animals? in grand teton|wildlife/gi;
const NO_PETS = /pet[- ]free|\bno pets\b|pets are not (allowed|permitted|accepted)|(does|do) not (allow|accept|permit) pets|not pet[- ]friendly|only (service|guide) (animals|dogs)|(service|guide) (animals|dogs) only|welcomes guide dogs/i;
const YES_PETS = new RegExp([
  "^\\s*yes\\b[^.]*\\b(pets?|dogs?|cats?)\\b",
  "pet[- ]friendly", "pets? (are )?(welcome|allowed|permitted|accepted)", "dogs? (are )?(welcome|allowed)",
  "welcom(e|es|ing) (up to \\w+ |one |small |all )?(pets?|dogs?|cats?)",
  "bring (their |your )?(beloved )?(pets?|furry|one cat or dog|up to \\w+ (pets?|dogs?))",
  "accepts? small dogs", "traveling with up to \\w+ (pets?|dogs?)", "pet-loving guests can bring",
  "guests can bring up to \\w+ (pets?|dogs?)", "four-legged (companions|family)", "welcomes (well-behaved |small )?dogs",
  "accepts? (a maximum of |up to )?\\w+ (pets?|dogs?)", "(dogs|cats|dogs and cats)[^.]{0,40} (are )?welcome",
].join("|"), "i");
function classify(question, answer) {
  const a = answer.replace(/<[^>]+>/g, " ").replace(NOISE, " ");
  const q = question.replace(NOISE, " ");
  if (NO_PETS.test(a)) return "no";
  if (YES_PETS.test(a) && !/guide dogs/i.test(a)) return "yes";
  if (/\b(pets?|pet policy)\b/i.test(q) && /^\s*yes\b/i.test(a)) return "yes";   // "Does X allow pets?" → "Yes, …"
  if (/\b(pets?|pet policy)\b/i.test(q)) return "unclear";   // asked about pets, answer not clear
  return null;                                                  // not about pets at all
}

const out = existsSync(OUT) && ONLY ? JSON.parse(readFileSync(OUT, "utf8")) : {};
let done = 0;
async function work(p) {
  const html = await fetchPage(p.url);
  done++;
  if (!html) { console.warn("  ! no page:", p.id, p.name); return; }
  delete out[p.id];
  // The first FAQ answer that is actually a pet policy (pet questions first).
  const faq = faqItems(html).filter((x) => PET.test(x.q) || PET.test(x.a))
    .sort((x, y) => (PET.test(y.q) ? 1 : 0) - (PET.test(x.q) ? 1 : 0));
  for (const x of faq) {
    const status = classify(decode(x.q), decode(x.a));
    if (status) { out[p.id] = { status, question: decode(x.q), answer: decode(x.a).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), url: p.url }; break; }
  }
  if (done % 25 === 0) console.log(`  ${done}/${props.length}`);
}
const queue = props.slice();
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await work(queue.shift()); }));

const sorted = Object.fromEntries(Object.keys(out).sort((a, b) => a - b).map((k) => [k, out[k]]));
writeFileSync(OUT, JSON.stringify(sorted, null, 1) + "\n");
const counts = {}; Object.values(sorted).forEach((v) => (counts[v.status] = (counts[v.status] || 0) + 1));
console.log(`Pages read: ${props.length}. With a pet answer: ${Object.keys(sorted).length}`, counts);
