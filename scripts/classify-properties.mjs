/*
 * classify-properties.mjs  —  the "agentic AI" property classifier
 * ------------------------------------------------------------------
 * Reads each property's REAL on-page description (assets/js/descriptions.js)
 * and REAL geography (city / country / region from assets/js/data.js) and
 * asks Claude to determine the property's physical SETTING (beachfront,
 * mountain & ski, island, lakeside, countryside, city, desert) and a short
 * list of FEATURES — grounded in evidence, NOT in the hotel's name.
 *
 * The hotel NAME is deliberately withheld from the model so a name like
 * "…Beach…", "…Mountain…" or "…Island…" can never drive the classification.
 * Only the description prose and real geography are provided.
 *
 * Output: assets/js/characteristics.js (same shape as the deterministic
 * seed in seed-characteristics.mjs), so the site works whether tags come
 * from the seed or from this classifier.
 *
 * ------------------------------------------------------------------
 * Requirements to run (uses YOUR Claude API key — nothing is hard-coded):
 *   export ANTHROPIC_API_KEY=sk-ant-...           # your key
 *   export ANTHROPIC_MODEL=<latest Opus model id> # e.g. current flagship
 *   node scripts/classify-properties.mjs
 *
 * Optional: ANTHROPIC_BASE_URL to point at a gateway/proxy.
 * Zero dependencies — uses Node's built-in fetch (Node 18+).
 * ------------------------------------------------------------------
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL;
const BASE_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
if (!API_KEY) { console.error("Set ANTHROPIC_API_KEY to your Claude API key."); process.exit(1); }
if (!MODEL) { console.error("Set ANTHROPIC_MODEL to your preferred Claude model id (e.g. the current flagship Opus)."); process.exit(1); }

/* ---- Load generated data + descriptions into a fake window ---- */
function loadWindow(...files) {
  const win = {};
  for (const f of files) {
    const code = fs.readFileSync(path.join(root, f), "utf8");
    // eslint-disable-next-line no-new-func
    new Function("window", code)(win);
  }
  return win;
}
const win = loadWindow("assets/js/data.js", "assets/js/descriptions.js");
const PROPS = win.WAH_PROPERTIES || [];
const DESC = win.WAH_DESC || {};

/* ---- Controlled vocabulary (must match the UI / seed) ---- */
const SETTINGS = {
  beachfront: "Beachfront", island: "Island", mountain: "Mountain & Ski",
  lake: "Lakeside", countryside: "Countryside", city: "City", desert: "Desert",
};
const FEATURES = [
  "golf", "spa", "private-pool", "overwater", "vineyard",
  "marina", "family-friendly", "historic", "culinary",
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    settings: {
      type: "array",
      description: "1-3 physical settings, strongest first. ONLY from the description prose and the real geography provided — never from any hotel name.",
      items: { type: "string", enum: Object.keys(SETTINGS) },
      minItems: 1, maxItems: 3,
    },
    primary: { type: "string", enum: Object.keys(SETTINGS), description: "The single dominant setting." },
    features: {
      type: "array",
      description: "0-5 notable features explicitly supported by the description prose.",
      items: { type: "string", enum: FEATURES },
      maxItems: 5,
    },
    evidence: { type: "string", description: "One short phrase quoting the description/geography that justifies `primary`." },
  },
  required: ["settings", "primary", "features", "evidence"],
};

const SYSTEM =
  "You classify luxury resort properties by their physical SETTING and FEATURES for a travel website filter. " +
  "You are given ONLY a property's real on-page description and its real geography (city, country, region). " +
  "You are NOT given the hotel's name, and you must never guess characteristics from a name. " +
  "Classify strictly from the evidence: what the description says and where the place actually is. " +
  "If the evidence is thin, lean on the real geography (e.g. a Maldivian atoll is an island/beachfront; an Alpine ski town is mountain). " +
  "Use only the allowed setting and feature keys.";

async function classify(p) {
  const desc = DESC[p.id] || "(no on-page description available)";
  const user =
    "REAL GEOGRAPHY:\n" +
    "- City: " + (p.city || "n/a") + "\n" +
    "- Country: " + (p.country || "n/a") + "\n" +
    "- Region: " + (p.region || "n/a") + "\n\n" +
    "REAL ON-PAGE DESCRIPTION:\n" + desc + "\n\n" +
    "Determine the setting(s), primary setting, and features. Do not consider or infer any hotel name.";

  const res = await fetch(BASE_URL + "/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error("API " + res.status + ": " + (await res.text()).slice(0, 300));
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

/* ---- Simple concurrency pool ---- */
async function run() {
  const traits = {};
  const queue = [...PROPS];
  let done = 0;
  const CONCURRENCY = 5;

  async function worker() {
    while (queue.length) {
      const p = queue.shift();
      try {
        const r = await classify(p);
        traits[p.id] = {
          settings: [...new Set(r.settings)].slice(0, 4),
          primary: r.primary,
          features: (r.features || []).slice(0, 5),
          source: "llm",
        };
      } catch (e) {
        console.warn("  ! " + p.id + " failed (" + e.message + ") — leaving unset");
      }
      done++;
      if (done % 20 === 0) console.log("  classified " + done + "/" + PROPS.length);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const header = `/*
 * WhataHotel! — Homes property CHARACTERISTICS (settings + features)
 * AUTO-GENERATED by scripts/classify-properties.mjs (Claude classifier).
 * Every tag is grounded in the property's REAL on-page description and
 * REAL geography — the hotel name is withheld from the model, so tags are
 * NEVER inferred from a name. Shape matches the deterministic seed.
 */
`;
  const out =
    header +
    "window.WAH_SETTINGS = " + JSON.stringify(SETTINGS, null, 2) + ";\n" +
    "window.WAH_TRAITS = " + JSON.stringify(traits, null, 0) + ";\n";
  fs.writeFileSync(path.join(root, "assets/js/characteristics.js"), out);

  const dist = {};
  for (const t of Object.values(traits)) dist[t.primary] = (dist[t.primary] || 0) + 1;
  console.log("Classified " + Object.keys(traits).length + "/" + PROPS.length + " via Claude.");
  console.log("Primary-setting distribution:", dist);
  console.log("Wrote assets/js/characteristics.js");
}

run().catch((e) => { console.error(e); process.exit(1); });
