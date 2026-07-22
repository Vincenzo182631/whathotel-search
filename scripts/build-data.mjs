/*
 * build-data.mjs — generate assets/js/data.js from the REAL WhataHotel
 * category search results.
 *
 * The site's own keyword search returns many false positives (it substring-
 * matches): "Homes" catches the "Domes" resort brand, "Omni Homestead" and
 * "Holmes Beach"; "Condos" only catches "Condesa"/"Las Condes"; "Estate"
 * returns ~135 mostly-unrelated city hotels. Per the brief we must avoid these.
 *
 * Approach: take the union of all five category lists, then CLASSIFY each
 * property by its NAME using whole-word (\b) residential keywords. Word
 * boundaries alone reject the false friends ("Village" != villa, "Condesa" !=
 * condo, "Homestead" != home) without a hand exclusion list. A tiny allowlist
 * re-includes genuinely residential properties whose names lack a keyword.
 *
 * Run:  node scripts/build-data.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "assets", "js", "data.js");

/* ---- RAW category blocks, pasted verbatim from WhataHotel search ---- */
const RAW = {
  home: String.raw`
[Domes Aulus Zante](https://whatahotel.com/hotels/6360/Domes-Aulus-Zante-.html) - Zante
[Domes Lake Algarve, Autograph Collection](https://whatahotel.com/hotels/6564/Domes-Lake-Algarve-Autograph-Collection.html) - Algarve
[Domes Miramare Corfu](https://whatahotel.com/hotels/3692/Domes-Miramare-Corfu.html) - Corfu
[Domes Noruz Chania](https://whatahotel.com/hotels/3872/Domes-Noruz-Chania.html) - Crete Island
[Domes Novos Santorini](https://whatahotel.com/hotels/6946/Domes-Novos-Santorini.html) - Oia
[Domes of Corfu](https://whatahotel.com/hotels/6579/Domes-of-Corfu.html) - Corfu
[Domes of Elounda, Autograph Collection](https://whatahotel.com/hotels/3802/Domes-of-Elounda-Autograph-Collection.html) - Crete Island
[Domes White Coast Milos](https://whatahotel.com/hotels/4829/Domes-White-Coast-Milos.html) - Milos
[Domes Zeen Chania](https://whatahotel.com/hotels/6576/Domes-Zeen-Chania.html) - Crete Island
[Omni Homestead](https://whatahotel.com/hotels/1816/Omni-Homestead-.html) - Hot Springs, Virginia
[Waterline Marina Resort & Beach Club, Autograph Collection](https://whatahotel.com/hotels/3834/Waterline-Marina-Resort-Beach-Club-Autograph-Collection.html) - Holmes Beach, Florida
[Wild Dunes Resort Homes & Villas](https://whatahotel.com/hotels/6558/Wild-Dunes-Resort-Homes-Villas.html) - Charleston, South Carolina
`,
  residence: String.raw`
[137 Pillars Suites & Residences Bangkok](https://whatahotel.com/hotels/4593/137-Pillars-Suites-Residences-Bangkok.html) - Bangkok
[Azerai La Residence, Hue](https://whatahotel.com/hotels/3623/Azerai-La-Residence-Hue.html) - Hue
[Belmond La Residence D'Angkor ](https://whatahotel.com/hotels/2730/Belmond-La-Residence-D-Angkor-.html) - Siem Reap
[Belmond La Residencia](https://whatahotel.com/hotels/1073/Belmond-La-Residencia.html) - Mallorca
[Four Seasons Aviara Residence Club](https://whatahotel.com/hotels/2543/Four-Seasons-Aviara-Residence-Club.html) - San Diego, Aviara
[Four Seasons Cairo at The First Residence](https://whatahotel.com/hotels/1137/Four-Seasons-Cairo-at-The-First-Residence.html) - Cairo
[Four Seasons Resort & Residences Cartagena](https://whatahotel.com/hotels/6868/Four-Seasons-Resort-Residences-Cartagena.html) - Cartagena
[Four Seasons Resort and Residences Red Sea at Shura Island](https://whatahotel.com/hotels/7084/Four-Seasons-Resort-and-Residences-Red-Sea-at-Shura-Island.html) - Shura Island
[Grand Hyatt Abu Dhabi Hotel & Residences Emirates Pearl](https://whatahotel.com/hotels/3636/Grand-Hyatt-Abu-Dhabi-Hotel-Residences-Emirates-Pearl.html) - Abu Dhabi
[La Residence Hue Ho & Spa](https://whatahotel.com/hotels/2636/La-Residence-Hue-Ho-Spa.html) - Hue
[Langham Gold Coast & Jewel Residence ](https://whatahotel.com/hotels/6218/Langham-Gold-Coast-Jewel-Residence-.html) - Queensland
[Madeline Hotel & Residences, Auberge Collection](https://whatahotel.com/hotels/4226/Madeline-Hotel-Residences-Auberge-Collection.html) - Telluride
[Marriott Residences Salgados Resort](https://whatahotel.com/hotels/6842/Marriott-Residences-Salgados-Resort.html) - Algarve
[ON Residence](https://whatahotel.com/hotels/6262/ON-Residence.html) - Thessaloniki
[Pine Cliffs Residence, Luxury Collection](https://whatahotel.com/hotels/2811/Pine-Cliffs-Residence-Luxury-Collection.html) - Algarve
[Ritz Carlton Residences, Turks & Caicos](https://whatahotel.com/hotels/6705/Ritz-Carlton-Residences-Turks-Caicos.html) - Turks & Caicos
[Ritz-Carlton Residences, Orlando](https://whatahotel.com/hotels/6084/Ritz-Carlton-Residences-Orlando.html) - Orlando and Disney World
[SLS Dubai Hotel & Residences](https://whatahotel.com/hotels/4927/SLS-Dubai-Hotel-Residences.html) - Dubai
[Sofitel Ambassador Seoul Hotel & Serviced Residences](https://whatahotel.com/hotels/6478/Sofitel-Ambassador-Seoul-Hotel-Serviced-Residences.html) - Seoul
[St Regis Residence Club, Aspen](https://whatahotel.com/hotels/2835/St-Regis-Residence-Club-Aspen.html) - Aspen
[Stein Eriksen Residences Deer Valley](https://whatahotel.com/hotels/6282/Stein-Eriksen-Residences-Deer-Valley.html) - Deer Valley
[Sublime Samana Hotel & Residences](https://whatahotel.com/hotels/4280/Sublime-Samana-Hotel-Residences.html) - Las Terranas
[The Leela Palace Ambience Gurugram Hotel & Residence](https://whatahotel.com/hotels/4538/The-Leela-Palace-Ambience-Gurugram-Hotel-Residence.html) - Gurgaon
[The Luang Say Residence](https://whatahotel.com/hotels/4273/The-Luang-Say-Residence.html) - Laos
[The Residences at Grand Hyatt Deer Valley](https://whatahotel.com/hotels/6774/The-Residences-at-Grand-Hyatt-Deer-Valley.html) - Deer Valley
[The Ritz Carlton Residences at Dorado Beach](https://whatahotel.com/hotels/3879/The-Ritz-Carlton-Residences-at-Dorado-Beach.html) - Dorado
[The Ritz-Carlton Residences Mexico City](https://whatahotel.com/hotels/6706/The-Ritz-Carlton-Residences-Mexico-City.html) - Mexico City
[The Ritz-Carlton Residences, Waikiki Beach](https://whatahotel.com/hotels/3287/The-Ritz-Carlton-Residences-Waikiki-Beach.html) - Honolulu
[Vail Residences at Cascade Village](https://whatahotel.com/hotels/4628/Vail-Residences-at-Cascade-Village.html) - Vail
[Vakko Hotel and Residences ](https://whatahotel.com/hotels/6265/Vakko-Hotel-and-Residences-.html) - Istanbul
[W Algarve Hotel & Residences](https://whatahotel.com/hotels/4709/W-Algarve-Hotel-Residences.html) - Algarve
[W Doha Hotel & Residences](https://whatahotel.com/hotels/2876/W-Doha-Hotel-Residences.html) - Doha
[Wild Dunes Resort - Residences At Sweetgrass ](https://whatahotel.com/hotels/6557/Wild-Dunes-Resort-Residences-At-Sweetgrass-.html) - Charleston
`,
  villa: String.raw`
[Alila Villas Koh Russey](https://whatahotel.com/hotels/3947/Alila-Villas-Koh-Russey.html) - Sihanoukville
[Alila Villas Uluwatu](https://whatahotel.com/hotels/3060/Alila-Villas-Uluwatu.html) - Bali
[Allium Villas Resort](https://whatahotel.com/hotels/4565/Allium-Villas-Resort.html) - Yalikavak
[Amartera Villa Bali Nusa Dua - MGallery](https://whatahotel.com/hotels/4938/Amartera-Villa-Bali-Nusa-Dua-MGallery.html) - Nusa Dua
[Anantara Kihavah Maldives Villas](https://whatahotel.com/hotels/6796/Anantara-Kihavah-Maldives-Villas.html) - Maldives
[Anantara Maia Seychelles Villas](https://whatahotel.com/hotels/6080/Anantara-Maia-Seychelles-Villas.html) - Seychelles
[Barracuda Hotel and Villas](https://whatahotel.com/hotels/6379/Barracuda-Hotel-and-Villas.html) - Salvador Da Bahia
[Beach Village at The Del](https://whatahotel.com/hotels/6256/Beach-Village-at-The-Del.html) - Coronado
[Belmond Villa San Michele](https://whatahotel.com/hotels/946/Belmond-Villa-San-Michele.html) - Florence
[Belmond Villa Sant' Andrea ](https://whatahotel.com/hotels/2516/Belmond-Villa-Sant-Andrea-.html) - Taormina
[Bluefields Bay Villas](https://whatahotel.com/hotels/6181/Bluefields-Bay-Villas.html) - Bluefields
[Boutique Hotel Villa Geba](https://whatahotel.com/hotels/4438/Boutique-Hotel-Villa-Geba.html) - Sveti Stefan
[Byblos Art Hotel Villa Amista](https://whatahotel.com/hotels/4427/Byblos-Art-Hotel-Villa-Amista.html) - Verona
[Casa de Campo Resort & Villas ](https://whatahotel.com/hotels/1125/Casa-de-Campo-Resort-Villas-.html) - La Romana
[Danang Marriott Resort & Spa, Non Nuoc Beach Villas](https://whatahotel.com/hotels/6662/Danang-Marriott-Resort-Spa-Non-Nuoc-Beach-Villas.html) - Da Nang
[Dinso Resort & Villas](https://whatahotel.com/hotels/6755/Dinso-Resort-Villas.html) - Phuket
[Eagles Villas](https://whatahotel.com/hotels/4411/Eagles-Villas.html) - Halkidiki
[Four Seasons Hotel Westlake Village](https://whatahotel.com/hotels/1790/Four-Seasons-Hotel-Westlake-Village.html) - Westlake Village
[Grace Bay Club Villa Seaclusion](https://whatahotel.com/hotels/3944/Grace-Bay-Club-Villa-Seaclusion.html) - Turks & Caicos
[Grace Bay Club Villa Seascape](https://whatahotel.com/hotels/3943/Grace-Bay-Club-Villa-Seascape.html) - Turks & Caicos
[Gran Melia Villa Agrippina](https://whatahotel.com/hotels/4232/Gran-Melia-Villa-Agrippina.html) - Rome
[Grand Hotel Villa Castagnola](https://whatahotel.com/hotels/4443/Grand-Hotel-Villa-Castagnola.html) - Lugano
[Grand Hotel Villa Serbelloni](https://whatahotel.com/hotels/1373/Grand-Hotel-Villa-Serbelloni.html) - Lake Como
[Grand Hyatt Indian Wells Resort & Villas](https://whatahotel.com/hotels/1674/Grand-Hyatt-Indian-Wells-Resort-Villas.html) - Indian Wells
[Higashiyama Niseko Village, a Ritz Carlton Reserve](https://whatahotel.com/hotels/7060/Higashiyama-Niseko-Village-a-Ritz-Carlton-Reserve.html) - Niseko
[Hotel Terra](https://whatahotel.com/hotels/2644/Hotel-Terra.html) - Teton Village
[Hotel Villa Carlotta](https://whatahotel.com/hotels/4503/Hotel-Villa-Carlotta.html) - Taormina
[Hotel Villa Cipriani](https://whatahotel.com/hotels/4541/Hotel-Villa-Cipriani.html) - Asolo
[Hotel Villa Real](https://whatahotel.com/hotels/2075/Hotel-Villa-Real.html) - Madrid
[Hotel Villa Soligo](https://whatahotel.com/hotels/4612/Hotel-Villa-Soligo.html) - Fara di Soligo
[Hyatt Regency Westlake](https://whatahotel.com/hotels/3968/Hyatt-Regency-Westlake.html) - Westlake Village
[Kasara Niseko Village Townhouse](https://whatahotel.com/hotels/4384/Kasara-Niseko-Village-Townhouse.html) - Hokkaido
[Kona Village, A Rosewood Resort](https://whatahotel.com/hotels/6370/Kona-Village-A-Rosewood-Resort.html) - Big Island
[La Miniera Pool Villas Pattaya](https://whatahotel.com/hotels/6472/La-Miniera-Pool-Villas-Pattaya.html) - Pattaya
[La Reserve Geneve Hotel, Spa & Villa](https://whatahotel.com/hotels/6111/La-Reserve-Geneve-Hotel-Spa-Villa.html) - Geneva
[La Villa del Re Hotel](https://whatahotel.com/hotels/4481/La-Villa-del-Re-Hotel.html) - Castiadas
[Le Vallon de Valrugues Hotel Spa and Villas](https://whatahotel.com/hotels/4402/Le-Vallon-de-Valrugues-Hotel-Spa-and-Villas.html) - Saint-Remy-de-Provence
[MGallery Phuket V Villas](https://whatahotel.com/hotels/4963/MGallery-Phuket-V-Villas.html) - Phuket
[MGallery V Villas Hua Hin](https://whatahotel.com/hotels/4972/MGallery-V-Villas-Hua-Hin.html) - Prachuap Khiri Khan
[Myconian Villa Collection](https://whatahotel.com/hotels/4535/Myconian-Villa-Collection.html) - Mykonos
[Naxian Collection Luxury Villas & Suites](https://whatahotel.com/hotels/4321/Naxian-Collection-Luxury-Villas-Suites.html) - Naxos
[Park Hyatt Abu Dhabi Hotel and Villas](https://whatahotel.com/hotels/3902/Park-Hyatt-Abu-Dhabi-Hotel-and-Villas.html) - Abu Dhabi
[Porto Zante Villas & Spa](https://whatahotel.com/hotels/6075/Porto-Zante-Villas-Spa.html) - Zakinthos
[Rosewood Villa Magna](https://whatahotel.com/hotels/2920/Rosewood-Villa-Magna.html) - Madrid
[Round Hill Hotel & Villas](https://whatahotel.com/hotels/989/Round-Hill-Hotel-Villas.html) - Montego Bay
[Saxon Hotel, Villas & Spa ](https://whatahotel.com/hotels/2493/Saxon-Hotel-Villas-Spa-.html) - Johannesburg
[Sharq Village and Spa, A Ritz-Carlton Hotel](https://whatahotel.com/hotels/1856/Sharq-Village-and-Spa-A-Ritz-Carlton-Hotel.html) - Doha
[Sina Villa Medici](https://whatahotel.com/hotels/2041/Sina-Villa-Medici.html) - Florence
[Sofitel Rome Villa Borghese](https://whatahotel.com/hotels/2190/Sofitel-Rome-Villa-Borghese.html) - Rome
[Taormina Hotel Villa Ducale](https://whatahotel.com/hotels/4505/Taormina-Hotel-Villa-Ducale.html) - Taormina
[The Biltmore Hotel Villas](https://whatahotel.com/hotels/7006/The-Biltmore-Hotel-Villas.html) - Dubai
[The Standard East Village](https://whatahotel.com/hotels/6877/The-Standard-East-Village.html) - New York
[V Villas Phuket MGallery](https://whatahotel.com/hotels/6615/V-Villas-Phuket-MGallery.html) - Phuket
[Vail Residences at Cascade Village](https://whatahotel.com/hotels/4628/Vail-Residences-at-Cascade-Village.html) - Vail
[Verdura Resort, Rocco Forte Private Villas](https://whatahotel.com/hotels/6693/Verdura-Resort-Rocco-Forte-Private-Villas.html) - Sicily
[Viceroy Snowmass ](https://whatahotel.com/hotels/2442/Viceroy-Snowmass-.html) - Snowmass Village
[Viewline Resort Snowmass](https://whatahotel.com/hotels/6980/Viewline-Resort-Snowmass.html) - Snowmass Village
[Villa & Palazzo Aminta](https://whatahotel.com/hotels/1266/Villa-Palazzo-Aminta.html) - Stresa
[Villa Athena Resort](https://whatahotel.com/hotels/4603/Villa-Athena-Resort.html) - Agrigento
[Villa Caldera](https://whatahotel.com/hotels/6691/Villa-Caldera.html) - Santorini
[Villa Copenhagen](https://whatahotel.com/hotels/4530/Villa-Copenhagen.html) - Copenhagen
[Villa Dagmar Hotel ](https://whatahotel.com/hotels/4586/Villa-Dagmar-Hotel-.html) - Stockholm
[Villa d'Este](https://whatahotel.com/hotels/993/Villa-d-Este.html) - Lake Como
[Villa di Piazzano](https://whatahotel.com/hotels/4506/Villa-di-Piazzano.html) - Tuscany
[Villa Dubrovnik](https://whatahotel.com/hotels/3022/Villa-Dubrovnik.html) - Dubrovnik
[Villa Eden Park Retreat](https://whatahotel.com/hotels/4507/Villa-Eden-Park-Retreat.html) - Merano
[Villa Franca](https://whatahotel.com/hotels/6999/Villa-Franca.html) - Positano
[Villa Gallici](https://whatahotel.com/hotels/1372/Villa-Gallici.html) - Aix en Provence
[Villa Igiea, a Rocco Forte Hotel](https://whatahotel.com/hotels/3317/Villa-Igiea-a-Rocco-Forte-Hotel.html) - Palermo
[Villa La Madonna](https://whatahotel.com/hotels/4508/Villa-La-Madonna.html) - Monastero Bormida
[Villa La Massa](https://whatahotel.com/hotels/1055/Villa-La-Massa.html) - Florence
[Villa Le Blanc Gran Melia](https://whatahotel.com/hotels/6433/Villa-Le-Blanc-Gran-Melia.html) - Balearic Islands
[Villa Mani](https://whatahotel.com/hotels/4180/Villa-Mani.html) - Turks & Caicos
[Villa Maria Cristina](https://whatahotel.com/hotels/4300/Villa-Maria-Cristina.html) - Guanajuato
[Villa Neri Resort & Spa](https://whatahotel.com/hotels/4504/Villa-Neri-Resort-Spa.html) - Sicily
[Villa Orselina](https://whatahotel.com/hotels/4447/Villa-Orselina.html) - Orselina-Locarno
[Villa Spalletti Trivelli Dimora d'Epoca](https://whatahotel.com/hotels/4489/Villa-Spalletti-Trivelli-Dimora-d-Epoca.html) - Rome
[Westin Cape Coral at Marina Village](https://whatahotel.com/hotels/6426/Westin-Cape-Coral-at-Marina-Village.html) - Cape Coral
[Wild Dunes Resort Homes & Villas](https://whatahotel.com/hotels/6558/Wild-Dunes-Resort-Homes-Villas.html) - Charleston
`,
  condo: String.raw`
[Andaz Mexico City Condesa](https://whatahotel.com/hotels/6392/Andaz-Mexico-City-Condesa-.html) - Mexico City
[Hyatt Centric Las Condes Santiago](https://whatahotel.com/hotels/3906/Hyatt-Centric-Las-Condes-Santiago.html) - Santiago
[Mondrian Mexico City Condesa](https://whatahotel.com/hotels/6468/Mondrian-Mexico-City-Condesa.html) - Mexico City
`,
  estate: String.raw`
[Culloden Estate and Spa](https://whatahotel.com/hotels/4832/Culloden-Estate-and-Spa.html) - Belfast
[Erinvale Estate Hotel and Spa](https://whatahotel.com/hotels/4548/Erinvale-Estate-Hotel-and-Spa.html) - Cape Town
[Glenlo Abbey Hotel & Estate](https://whatahotel.com/hotels/4230/Glenlo-Abbey-Hotel-Estate.html) - Galway
[Gem Hacienda](https://whatahotel.com/hotels/6733/Gem-Hacienda.html) - Taos
[Meadowstone Manor](https://whatahotel.com/hotels/6732/Meadowstone-Manor.html) - Stowe
[Monkey Island Estate](https://whatahotel.com/hotels/4461/Monkey-Island-Estate.html) - Bray
[Mount Juliet Estate, Autograph Collection](https://whatahotel.com/hotels/1000/Mount-Juliet-Estate-Autograph-Collection.html) - Thomastown
[Sea Oats Private Estate](https://whatahotel.com/hotels/4178/Sea-Oats-Private-Estate.html) - Captiva Island
[Sea Palms Private Beachfront Estate](https://whatahotel.com/hotels/4177/Sea-Palms-Private-Beachfront-Estate.html) - Captiva Island
[Treetops Lodge & Estate](https://whatahotel.com/hotels/1231/Treetops-Lodge-Estate.html) - Rotorua
[The Residences at Grand Hyatt Deer Valley](https://whatahotel.com/hotels/6774/The-Residences-at-Grand-Hyatt-Deer-Valley.html) - Deer Valley
`,
};

/* ---- Parse raw blocks: id -> {id, url, name, loc, cats:Set} ---- */
const LINK = /\[([^\]]*)\]\((https?:\/\/[^)]*\/hotels\/(\d+)\/[^)]+\.html)\)([^\n]*)/g;
const byId = new Map();
for (const [cat, raw] of Object.entries(RAW)) {
  let m;
  LINK.lastIndex = 0;
  while ((m = LINK.exec(raw)) !== null) {
    const name = m[1].replace(/\s+/g, " ").trim();
    if (!name || name === "Read More »") continue;
    const url = m[2];
    const id = Number(m[3]);
    const loc = (m[4] || "").replace(/^\s*[-–]\s*/, "").replace(/[\[\]*]/g, "").replace(/\s+/g, " ").trim();
    if (!byId.has(id)) byId.set(id, { id, url, name, loc, cats: new Set() });
    const rec = byId.get(id);
    rec.cats.add(cat);
    if (loc && !rec.loc) rec.loc = loc;
  }
}

/* ---- Classify accommodation type(s) from the NAME (whole-word) ---- */
const TYPE_RULES = [
  [/\bvillas?\b/i, "villa"],
  [/\bresidenc(?:e|es|ia)\b/i, "residence"],
  [/\bhomes?\b/i, "home"],
  [/\btownhouse\b|\btownhome\b/i, "home"],
  [/\b(?:cottage|bungalow)s?\b/i, "home"],
  [/\bapartments?\b/i, "apartment"],
  [/\bcondos?\b|\bcondominium\b/i, "condo"],
  [/\bestates?\b/i, "estate"],
  [/\bmanor\b|\bhacienda\b/i, "estate"],
];
// Genuinely residential properties whose NAME lacks a keyword (verified by
// what the property actually offers). Small and explicit.
const ALLOW = {
  2442: ["residence", "condo"], // Viceroy Snowmass — condo/residence ski units
  6256: ["home", "villa"],       // Beach Village at The Del — cottage/villa enclave
  6370: ["home", "villa"],       // Kona Village, A Rosewood — residential hale bungalows
};

function typesFor(rec) {
  const set = new Set();
  for (const [re, t] of TYPE_RULES) if (re.test(rec.name)) set.add(t);
  if (ALLOW[rec.id]) ALLOW[rec.id].forEach((t) => set.add(t));
  return [...set];
}

/* ---- Scene from location ---- */
const SCENE_KW = [
  ["mountain", ["aspen","vail","deer valley","snowmass","telluride","niseko","hokkaido","teton","stowe","park city","lugano","locarno","merano","orselina","pray"]],
  ["desert",   ["scottsdale","sedona","phoenix","palm springs","tucson","tempe","las vegas","dubai","doha","abu dhabi","taos"]],
  ["tropical", ["maldives","seychelles","bali","nusa dua","phuket","koh russey","sihanoukville","hua hin","pattaya","da nang","big island","honolulu","waikiki","maui","kauai","kona","turks & caicos","montego bay","jamaica","bluefields","la romana","punta cana","las terranas","samana","cartagena","shura","red sea","salvador","bahia","coronado"]],
  ["beach",    ["santorini","oia","mykonos","naxos","milos","zante","zakinthos","zakynthos","corfu","crete","chania","elounda","halkidiki","dubrovnik","sveti stefan","positano","taormina","sicily","agrigento","castiadas","mallorca","balearic","menorca","algarve","cape coral","miami","captiva","yalikavak","palermo","charleston","isle of palms","naples","sarasota","longboat","boca raton","clearwater","hutchinson","holmes"]],
  ["countryside", ["lake como","tuscany","napa","yountville","galway","belfast","thomastown","rotorua","provence","asolo","stresa","verona","soligo","monastero","piazzano","aix en provence","saint-rem","bray","guanajuato"]],
];
function sceneFor(loc) {
  const l = (loc || "").toLowerCase();
  for (const [scene, kws] of SCENE_KW) if (kws.some((k) => l.includes(k))) return scene;
  return "city";
}

/* ---- Features (general truths for the accommodation type) ---- */
function featuresFor(types, scene) {
  const f = new Set(["family"]);
  const residential = types.some((t) => ["villa","home","residence","estate","apartment","condo"].includes(t));
  if (residential) { f.add("multi-bedroom"); f.add("kitchen"); }
  if (scene === "beach" || scene === "tropical") f.add("beachfront");
  if (scene === "mountain") f.add("mountain");
  const villaish = types.some((t) => ["villa","home","estate"].includes(t));
  if (villaish && ["beach","tropical","desert"].includes(scene)) f.add("private-pool");
  return [...f];
}

/* ---- Short, non-fabricated blurb by type + scene ---- */
const BASE = {
  villa: "Private villa living with space to spread out",
  residence: "Spacious residences with residential comforts",
  home: "Residential-style homes away from home",
  estate: "A private estate escape",
  apartment: "Apartment-style living with room to breathe",
  condo: "Condo-style living with room to breathe",
};
const TAIL = { beach: ", steps from the sea.", tropical: ", in the tropics.", mountain: ", in the mountains.", desert: ", under wide desert skies.", countryside: ", in the countryside.", city: ", at the heart of it all." };
function blurbFor(types, scene) {
  return (BASE[types[0]] || BASE.residence) + (TAIL[scene] || ".");
}

const TYPE_ORDER = ["villa", "residence", "home", "estate", "apartment", "condo"];
const FEATURED = new Set([6796, 993, 3060, 989, 3287, 6075, 3022, 1073, 1125, 6282, 1000, 6558]);

/* ---- Build final records ---- */
const excluded = [];
const props = [];
for (const rec of byId.values()) {
  let types = typesFor(rec);
  if (!types.length) { excluded.push(rec.name); continue; }
  types = TYPE_ORDER.filter((t) => types.includes(t)); // stable order
  const scene = sceneFor(rec.loc);
  props.push({
    id: rec.id,
    url: rec.url,
    name: rec.name,
    loc: rec.loc,
    types,
    features: featuresFor(types, scene),
    scene,
    blurb: blurbFor(types, scene),
    featured: FEATURED.has(rec.id),
  });
}
// Sort: featured first, then by name
props.sort((a, b) => (b.featured - a.featured) || a.name.localeCompare(b.name));

/* ---- Stats ---- */
const counts = {};
for (const p of props) p.types.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
console.log("Included properties:", props.length);
console.log("Type counts:", counts);
console.log("Featured:", props.filter((p) => p.featured).length);
console.log("Excluded false-positives:", excluded.length);
console.log("  e.g.", excluded.slice(0, 14).join(" | "));

/* ---- Emit data.js ---- */
const header = `/*
 * WhataHotel! — Homes / Villas & Residences directory data
 * AUTO-GENERATED by scripts/build-data.mjs from the real WhataHotel category
 * search results. Do not edit by hand — edit the raw data or rules in the
 * build script and re-run:  node scripts/build-data.mjs
 *
 * Every property is a REAL WhataHotel property. \`url\` is the site's canonical
 * individual property page; homes.js appends \`?stayType=homes\` + UTM params so
 * the Homes intent (and homes-only availability filtering) carries through.
 *
 * The site's own keyword search substring-matches and returns false positives
 * (the "Domes" resort brand for "Homes", "Condesa" for "Condos", ~135 mostly-
 * unrelated city hotels for "Estate"). We classify by whole-word name keywords
 * so those are dropped. Types: villa | residence | home | estate | apartment | condo.
 */
window.WAH_PROPERTIES = `;
writeFileSync(OUT, header + JSON.stringify(props, null, 2) + ";\n");
console.log("Wrote", OUT);
