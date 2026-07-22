/*
 * WhataHotel! — Property detail enrichment
 * =====================================================================
 * Factual, verified details for the property detail modal, sourced from each
 * property's own WhataHotel page (and cross-checked with the property's public
 * information). Keyed by WhataHotel hotelID.
 *
 * Only include information that is TRUE for the specific property. Fields:
 *   collection   string  — brand/collection affiliation (e.g. "Belmond")
 *   locationFull string  — precise location
 *   desc         string  — 1–2 sentence factual overview
 *   stay         string  — accommodation types / bedroom counts / sizes
 *   highlights   array    — factual amenity / feature bullets
 *   rating       string   — average guest rating shown on WhataHotel (optional)
 *   perks        array    — WhataHotel Signature booking perks for this property
 *
 * A property without an entry here still opens in the modal using its base
 * data (type, location, features, blurb) + a link to its WhataHotel page — no
 * information is invented.
 */
window.WAH_DETAILS = {
  6796: {
    collection: "Anantara", locationFull: "Baa Atoll (UNESCO Biosphere Reserve), Maldives", rating: "4.8 / 5",
    desc: "An ultra-luxury private-island resort of overwater and beachfront villas on a UNESCO-protected atoll, reached by seaplane and known for its underwater restaurant and wine cellar.",
    stay: "Overwater and beachfront pool villas, each with a private pool and direct lagoon access.",
    highlights: [
      "Private pool and direct lagoon access in every villa",
      "SEA — underwater restaurant 20 ft below the surface, beside the world's first underwater wine cellar",
      "Overwater SKY bar with a retractable roof and observatory with resident marine biologist",
      "Snorkelling coral gardens; manta ray & whale shark season May–November",
      "Dining by Design on private sandbanks; seaplane transfers"
    ],
    perks: ["Complimentary breakfast for two daily", "$100 resort credit", "Room upgrade when available", "Free Wi-Fi", "Late checkout on request"]
  },
  993: {
    collection: "The Leading Hotels of the World", locationFull: "Cernobbio, Lake Como, Italy", rating: "4.7 / 5",
    desc: "A 16th-century Renaissance villa turned palatial lakeside hotel, welcoming guests for over 150 years amid 25 acres of gardens on the shore of Lake Como.",
    stay: "Rooms and suites in the historic villa (many with lake views and original frescoes), plus private villas such as the 6-bedroom, 700 sq m Villa Garrovo.",
    highlights: [
      "Iconic floating swimming pool built out onto Lake Como",
      "25 acres of Renaissance gardens with ancient cypress and fountains",
      "Michelin-starred Veranda restaurant, plus four more dining venues",
      "COMO Shambhala spa with a floating treatment pavilion",
      "Private speedboat service; under an hour from Milan Malpensa"
    ],
    perks: ["Complimentary breakfast for two daily", "Resort credit", "Room upgrade when available", "Free Wi-Fi", "Late checkout on request"]
  },
  1000: {
    collection: "Autograph Collection · Relais & Châteaux", locationFull: "Thomastown, County Kilkenny, Ireland", rating: "4.7 / 5",
    desc: "A Georgian manor estate set across 1,500 acres of Irish countryside, with a Michelin-starred restaurant and Ireland's only Jack Nicklaus–designed championship golf course.",
    stay: "Manor House rooms and suites plus estate lodges and residences, with marble bathrooms and fireplaces.",
    highlights: [
      "1,500-acre estate, 15 minutes from Kilkenny City",
      "Jack Nicklaus championship golf course (three-time Irish Open host)",
      "Michelin-starred Lady Helen restaurant; walled kitchen gardens",
      "Equestrian centre, falconry school and clay-pigeon shooting",
      "Private salmon & trout fishing rights on the River Nore"
    ],
    perks: ["Complimentary breakfast for two daily", "$100 property credit", "Room upgrade when available", "Free Wi-Fi", "Late checkout on request"]
  },
  6558: {
    collection: "Wild Dunes Resort", locationFull: "Isle of Palms, Charleston, South Carolina",
    desc: "Beachfront resort homes and villas on a barrier island just outside historic Charleston, with golf, tennis and wide Atlantic beaches — built for families and groups.",
    stay: "One- to multi-bedroom resort homes and villas with full kitchens and living space.",
    highlights: [
      "Direct Atlantic beach access on the Isle of Palms",
      "Two championship golf courses",
      "Nationally ranked tennis & pickleball centre",
      "Multiple resort pools and on-site dining",
      "20 minutes from historic downtown Charleston"
    ],
    perks: ["Complimentary breakfast for two daily", "$200 resort credit", "Room upgrade when available", "Free Wi-Fi", "Late checkout on request", "3-night minimum for perks"]
  },
  3287: {
    collection: "The Ritz-Carlton", locationFull: "Waikiki Beach, Honolulu, Hawaii", rating: "4.7 / 5",
    desc: "Ritz-Carlton service in a residential format — Waikiki's tallest residential tower, with full-kitchen suites, private lanais and rooftop infinity pools steps from the sand.",
    stay: "Suites and residences with full kitchens, living areas and private lanais; higher floors face Diamond Head.",
    highlights: [
      "Two rooftop infinity pools with 360° Honolulu views",
      "Full kitchens and private lanais in every residence",
      "Quiora spa and La Vie fine dining",
      "Direct access to Waikiki Beach surf breaks",
      "Diamond Head views; walk to Royal Hawaiian Center"
    ],
    perks: ["Complimentary breakfast for two daily", "$100 hotel credit", "Room upgrade when available", "Late checkout on request", "Marriott Bonvoy points eligible"]
  },
  3022: {
    collection: "The Leading Hotels of the World", locationFull: "Ploče, Dubrovnik, Croatia", rating: "4.5 / 5",
    desc: "An intimate 56-room cliffside retreat where nearly every room faces the Adriatic, a short private-boat hop from Dubrovnik's UNESCO-listed Old Town.",
    stay: "Sea-view rooms and suites (several with whirlpools) plus the Villa Kolin residence — almost all with sea-facing balconies.",
    highlights: [
      "Saltwater infinity pool carved into the rock face",
      "Private boat shuttle to the Old City harbour",
      "Nearly every room faces the sea, with a private balcony",
      "Villa Spa and cliffside Restaurant Bura",
      "Walk to Sv Jakov Beach and Dubrovnik Old Town"
    ],
    perks: ["Complimentary breakfast for two daily", "Resort credit", "Room upgrade when available", "Free Wi-Fi", "Late checkout on request"]
  },
  6282: {
    collection: "Stein Eriksen Lodge", locationFull: "Deer Valley, Park City, Utah (8,100 ft)", rating: "4.8 / 5",
    desc: "Forbes Five-Star Nordic-luxury residences named for the Olympic ski champion, offering ski-in/ski-out access on Deer Valley's uncrowded slopes.",
    stay: "Rooms through one- to six-bedroom suites and private homes (up to ~9,000 sq ft) with full kitchens, fireplaces and private decks.",
    highlights: [
      "Ski-in/ski-out access to Deer Valley",
      "Heated outdoor pool and full spa",
      "Full kitchens, fireplaces and in-residence washer/dryer",
      "7880 Club and slope-side Royal Street Café",
      "Ski valet and complimentary Park City Main Street shuttle"
    ],
    perks: ["Complimentary breakfast for two daily", "Resort credit", "Room upgrade when available", "Free Wi-Fi", "Late checkout on request"]
  },
  3060: {
    collection: "Alila Hotels & Resorts", locationFull: "Uluwatu, Bukit Peninsula, Bali, Indonesia",
    desc: "Award-winning sustainable-bamboo villas perched 100 m above the Indian Ocean on Uluwatu's limestone cliffs, each with a private infinity pool and butler.",
    stay: "One-bedroom (291 sq m) to three-bedroom pool villas (up to ~2,000 sq m), all with private infinity pools and butler service.",
    highlights: [
      "Private infinity pool and butler in every villa",
      "Cliff-edge spa pavilions 100 m above the ocean",
      "Green Building Council–awarded sustainable architecture",
      "CIRE and The Warung restaurants; sunset cabana dining",
      "Beside the legendary Uluwatu surf break and temple"
    ],
    perks: ["Complimentary breakfast for two daily", "$100 hotel credit", "Room upgrade when available", "Free Wi-Fi", "Late checkout on request", "2-night minimum for perks"]
  },
  1073: {
    collection: "Belmond", locationFull: "Deià, Tramuntana Mountains, Mallorca, Spain",
    desc: "Two 16th–17th-century manor houses on 12 acres of ancient olive groves in the artists' village of Deià, home to 2,500+ original artworks including Miró and Picasso.",
    stay: "Rooms and suites (30–170 sq m), some with private plunge pools, plus the Villa Robert Graves with a private pool.",
    highlights: [
      "12 acres of olive groves, some trees over 1,000 years old",
      "One indoor and two outdoor pools; award-winning spa",
      "2,500+ artworks; weekly artist-led art walks",
      "El Olivo restaurant in a 300-year-old oil mill",
      "20-minute walk to the secluded Cala Deià cove"
    ],
    perks: ["Complimentary breakfast for two daily", "Resort credit", "Room upgrade when available", "Free Wi-Fi", "Late checkout on request"]
  },
  1125: {
    collection: "Casa de Campo", locationFull: "La Romana, Dominican Republic", rating: "4.5 / 5",
    desc: "A 7,000-acre tropical resort with its own airport and marina, three Pete Dye golf courses and the Mediterranean-style artists' village of Altos de Chavón.",
    stay: "Three-, four- and five-bedroom private villas (plus suites and rooms), many with pools and staff service.",
    highlights: [
      "Teeth of the Dog — a top-ranked Pete Dye golf course (three courses in all)",
      "Private Minitas Beach and full-service marina",
      "Altos de Chavón village with a 5,000-seat amphitheatre",
      "Horseback riding, tennis and blue-marlin sport fishing",
      "Private on-resort airport"
    ],
    perks: ["Complimentary breakfast for two daily", "$200–$300 spa or golf credit", "Room upgrade when available", "Free Wi-Fi", "Late checkout on request"]
  },
  6075: {
    collection: "Small Luxury Hotels of the World", locationFull: "Tsilivi Beach, Zakynthos, Greece",
    desc: "An adults-only, all-villa beachfront retreat on Zakynthos, where every villa has its own private heated pool and villa-host service.",
    stay: "One-bedroom (85 sq m) to four-bedroom (500 sq m) spa villas, each with a private heated pool.",
    highlights: [
      "Private heated pool in every villa",
      "Direct access to Tsilivi Beach",
      "Adults-only; complimentary airport transfers",
      "Spa, yoga, tennis and water sports",
      "Private yacht excursions to the Blue Caves"
    ],
    perks: ["Complimentary breakfast for two daily", "Resort credit", "Room upgrade when available", "Free Wi-Fi", "Late checkout on request"]
  },
  989: {
    collection: "Round Hill Hotel & Villas", locationFull: "Montego Bay, Jamaica", rating: "4.6 / 5",
    desc: "A legendary 110-acre private-peninsula hideaway that has been one of the Caribbean's most exclusive addresses since 1953, pioneering the luxury-villa concept.",
    stay: "27 private villas (1–4 bedrooms, many with private or semi-private pools) plus Ralph Lauren–designed Pineapple House rooms.",
    highlights: [
      "110-acre private peninsula with a white-sand beach cove",
      "27 individually owned villas with personal staff",
      "Pineapple House interiors designed by Ralph Lauren",
      "Oceanfront spa and organic garden-to-table dining",
      "20 minutes from Sangster International Airport"
    ],
    perks: ["Complimentary breakfast for two daily", "$100 property credit ($200 suites)", "Room upgrade when available", "Free Wi-Fi", "Late checkout on request"]
  }
};
