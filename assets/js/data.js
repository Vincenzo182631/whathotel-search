/*
 * WhataHotel! — Homes / Villas & Residences directory data
 * ---------------------------------------------------------
 * Every property below is a REAL WhataHotel property. The `hotelID` values map
 * to live individual property pages on whatahotel.com and MUST NOT be changed
 * without verifying the destination page. Cards link to:
 *
 *     https://www.whatahotel.com/browse_offers.cfm?hotelID=<hotelID>
 *
 * To keep the "Homes" intent when a traveler clicks through, homes.js appends
 * `&stayType=homes` to the link (see buildPropertyUrl). The destination page can
 * read that flag and filter live inventory with homes-inventory-filter.js.
 *
 * FIELD REFERENCE
 *   id          number  — WhataHotel hotelID (do not invent values)
 *   name        string  — property / residence collection name
 *   hotel       string  — hotel or resort brand it belongs to
 *   city        string  — city / area
 *   region      string  — state / island / region
 *   country     string  — country
 *   types       array   — accommodation categories: home | villa | residence |
 *                         apartment | condo | estate
 *   features    array   — beachfront | mountain | family | multi-bedroom |
 *                         kitchen | private-pool
 *   blurb       string  — short descriptive line for the card
 *   scene       string  — visual scene key (beach | tropical | mountain |
 *                         city | desert | countryside) used for the CSS artwork
 *   featured    bool    — surface in the curated "Featured" rail
 *
 * Client note: to show a real photograph on a card, add an `image` field with a
 * URL. The CSS scene is used as an instant, zero-request placeholder/fallback so
 * the page stays fast and never shows a broken image.
 */
window.WAH_PROPERTIES = [
  // ---- United States ----
  {
    id: 1253, name: "Montage Residences", hotel: "Montage Laguna Beach",
    city: "Laguna Beach", region: "California", country: "United States",
    types: ["residence", "home"], features: ["beachfront", "family", "multi-bedroom", "kitchen"],
    blurb: "Oceanfront residences above the Pacific with full kitchens and resort service.",
    scene: "beach", featured: true
  },
  {
    id: 2402, name: "The Ritz-Carlton Residences", hotel: "The Ritz-Carlton, Lake Tahoe",
    city: "Truckee", region: "California", country: "United States",
    types: ["residence", "condo"], features: ["mountain", "family", "multi-bedroom", "kitchen"],
    blurb: "Ski-in/ski-out mountain residences with fireplaces and slope-side living.",
    scene: "mountain", featured: false
  },
  {
    id: 3617, name: "Four Seasons Private Residences", hotel: "Four Seasons Resort Napa Valley",
    city: "Calistoga", region: "California", country: "United States",
    types: ["residence", "home", "estate"], features: ["family", "multi-bedroom", "kitchen", "private-pool"],
    blurb: "Vineyard estates and residences at the heart of wine country.",
    scene: "countryside", featured: false
  },
  {
    id: 2520, name: "Fairmont Heritage Place Residences", hotel: "Ghirardelli Square",
    city: "San Francisco", region: "California", country: "United States",
    types: ["residence", "apartment"], features: ["family", "multi-bedroom", "kitchen"],
    blurb: "Landmark bayfront residences in the heart of San Francisco.",
    scene: "city", featured: false
  },
  {
    id: 2600, name: "The Little Nell Residences", hotel: "The Little Nell",
    city: "Aspen", region: "Colorado", country: "United States",
    types: ["residence", "condo"], features: ["mountain", "family", "multi-bedroom", "kitchen"],
    blurb: "Aspen's only five-star, ski-in/ski-out residences at the base of the gondola.",
    scene: "mountain", featured: false
  },
  {
    id: 2442, name: "Viceroy Residences", hotel: "Viceroy Snowmass",
    city: "Snowmass Village", region: "Colorado", country: "United States",
    types: ["residence", "condo"], features: ["mountain", "family", "multi-bedroom", "kitchen"],
    blurb: "Contemporary mountain residences steps from the Snowmass slopes.",
    scene: "mountain", featured: false
  },
  {
    id: 2390, name: "Four Seasons Residences", hotel: "Four Seasons Resort Vail",
    city: "Vail", region: "Colorado", country: "United States",
    types: ["residence"], features: ["mountain", "family", "multi-bedroom", "kitchen"],
    blurb: "Alpine residences in the heart of Vail Village with full resort service.",
    scene: "mountain", featured: false
  },
  {
    id: 3109, name: "Surf Club Residences", hotel: "Four Seasons Hotel at The Surf Club",
    city: "Surfside, Miami Beach", region: "Florida", country: "United States",
    types: ["residence", "home"], features: ["beachfront", "family", "multi-bedroom", "kitchen", "private-pool"],
    blurb: "Iconic oceanfront residences on a legendary stretch of Miami Beach.",
    scene: "beach", featured: true
  },
  {
    id: 6084, name: "The Ritz-Carlton Residences", hotel: "The Ritz-Carlton Orlando, Grande Lakes",
    city: "Orlando", region: "Florida", country: "United States",
    types: ["residence", "home"], features: ["family", "multi-bedroom", "kitchen", "private-pool"],
    blurb: "Spacious family residences minutes from Orlando's theme parks.",
    scene: "countryside", featured: false
  },
  {
    id: 6412, name: "1 Homes South Beach", hotel: "1 Hotel South Beach",
    city: "South Beach, Miami", region: "Florida", country: "United States",
    types: ["residence", "home", "apartment"], features: ["beachfront", "family", "multi-bedroom", "kitchen"],
    blurb: "Nature-inspired oceanfront homes in the heart of South Beach.",
    scene: "beach", featured: false
  },
  {
    id: 2683, name: "Mauna Lani Residences", hotel: "Mauna Lani, Auberge Resorts Collection",
    city: "Kona", region: "Hawaii", country: "United States",
    types: ["residence", "villa", "home"], features: ["beachfront", "family", "multi-bedroom", "kitchen", "private-pool"],
    blurb: "Big Island residences on a storied stretch of the Kohala Coast.",
    scene: "tropical", featured: true
  },
  {
    id: 3287, name: "The Ritz-Carlton Residences", hotel: "The Ritz-Carlton Residences, Waikiki Beach",
    city: "Honolulu", region: "Hawaii", country: "United States",
    types: ["residence", "apartment"], features: ["beachfront", "family", "multi-bedroom", "kitchen"],
    blurb: "Beachfront Waikiki residences with sweeping Pacific and Diamond Head views.",
    scene: "tropical", featured: false
  },
  {
    id: 2706, name: "Andaz Residences", hotel: "Andaz Maui at Wailea Resort",
    city: "Wailea, Maui", region: "Hawaii", country: "United States",
    types: ["residence", "villa"], features: ["beachfront", "family", "multi-bedroom", "kitchen", "private-pool"],
    blurb: "Villa-style residences on Mokapu Beach with private plunge pools.",
    scene: "tropical", featured: false
  },
  {
    id: 1569, name: "Montage Residences", hotel: "Montage Palmetto Bluff",
    city: "Bluffton", region: "South Carolina", country: "United States",
    types: ["residence", "home", "estate"], features: ["family", "multi-bedroom", "kitchen"],
    blurb: "Lowcountry cottages and homes along the May River.",
    scene: "countryside", featured: false
  },
  {
    id: 6558, name: "Wild Dunes Homes & Villas", hotel: "Wild Dunes Resort",
    city: "Isle of Palms, Charleston", region: "South Carolina", country: "United States",
    types: ["home", "villa", "residence"], features: ["beachfront", "family", "multi-bedroom", "kitchen", "private-pool"],
    blurb: "Beachfront homes and villas on a barrier island near historic Charleston.",
    scene: "beach", featured: true
  },
  {
    id: 2349, name: "The St. Regis Residences", hotel: "The St. Regis Deer Valley",
    city: "Park City", region: "Utah", country: "United States",
    types: ["residence", "condo"], features: ["mountain", "family", "multi-bedroom", "kitchen"],
    blurb: "Ski-in/ski-out residences with butler service in Deer Valley.",
    scene: "mountain", featured: false
  },
  {
    id: 1325, name: "Four Seasons Residences", hotel: "Four Seasons Resort Jackson Hole",
    city: "Teton Village", region: "Wyoming", country: "United States",
    types: ["residence", "home"], features: ["mountain", "family", "multi-bedroom", "kitchen"],
    blurb: "Rugged-luxe residences at the base of the Tetons.",
    scene: "mountain", featured: false
  },

  // ---- Caribbean ----
  {
    id: 2563, name: "Belmond Cap Juluca Villas", hotel: "Belmond Cap Juluca",
    city: "Maundays Bay", region: "Anguilla", country: "Anguilla",
    types: ["villa", "residence"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: "Moorish beachfront villas on one of Anguilla's finest bays.",
    scene: "beach", featured: true
  },
  {
    id: 1124, name: "Jumby Bay Villas & Residences", hotel: "Jumby Bay Island, Oetker Collection",
    city: "Jumby Bay Island", region: "Antigua", country: "Antigua & Barbuda",
    types: ["villa", "residence", "estate"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: "Private-island estates and villas on a 300-acre sanctuary.",
    scene: "tropical", featured: false
  },
  {
    id: 935, name: "Sandy Lane Villas", hotel: "Sandy Lane",
    city: "St. James", region: "Barbados", country: "Barbados",
    types: ["villa", "residence"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: "Legendary Platinum Coast villas with dedicated resort service.",
    scene: "beach", featured: false
  },
  {
    id: 3939, name: "Eden Roc Villas", hotel: "Eden Roc Cap Cana",
    city: "Cap Cana, Punta Cana", region: "La Altagracia", country: "Dominican Republic",
    types: ["villa", "residence"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: " Oceanfront and marina villas with private pools in Cap Cana.",
    scene: "tropical", featured: false
  },
  {
    id: 1512, name: "The Ritz-Carlton Residences", hotel: "The Ritz-Carlton, Grand Cayman",
    city: "Seven Mile Beach", region: "Grand Cayman", country: "Cayman Islands",
    types: ["residence", "condo"], features: ["beachfront", "family", "multi-bedroom", "kitchen"],
    blurb: "Beachfront residences on the powdery sands of Seven Mile Beach.",
    scene: "beach", featured: false
  },
  {
    id: 989, name: "Round Hill Villas", hotel: "Round Hill Hotel & Villas",
    city: "Montego Bay", region: "Jamaica", country: "Jamaica",
    types: ["villa", "residence", "estate"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: "Hillside private villas on a storied 110-acre Jamaican estate.",
    scene: "tropical", featured: false
  },
  {
    id: 3879, name: "Ritz-Carlton Reserve Residences", hotel: "Dorado Beach, a Ritz-Carlton Reserve",
    city: "Dorado", region: "Puerto Rico", country: "United States",
    types: ["residence", "home"], features: ["beachfront", "family", "multi-bedroom", "kitchen", "private-pool"],
    blurb: "Beachfront Reserve residences on a former Rockefeller estate.",
    scene: "beach", featured: false
  },
  {
    id: 1422, name: "Four Seasons Residence Estates", hotel: "Four Seasons Resort Nevis",
    city: "Charlestown", region: "Nevis", country: "St. Kitts & Nevis",
    types: ["residence", "estate", "villa"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: "Palm-lined estate homes beneath the Nevis Peak volcano.",
    scene: "tropical", featured: false
  },
  {
    id: 1441, name: "La Samanna Villas", hotel: "Belmond La Samanna",
    city: "Baie Longue", region: "St. Martin", country: "St. Martin",
    types: ["villa", "residence"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: "Mediterranean-style villas above a mile-long white-sand beach.",
    scene: "beach", featured: false
  },
  {
    id: 1523, name: "Amanyara Villas", hotel: "Amanyara",
    city: "Providenciales", region: "Turks & Caicos", country: "Turks & Caicos",
    types: ["villa", "estate"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: "Serene ocean-view and beachfront villas within a nature reserve.",
    scene: "tropical", featured: true
  },

  // ---- Mexico & Central America ----
  {
    id: 1271, name: "Four Seasons Residences", hotel: "Four Seasons Resort Peninsula Papagayo",
    city: "Guanacaste", region: "Papagayo", country: "Costa Rica",
    types: ["residence", "villa", "home"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: "Hillside residences and villas overlooking two Pacific beaches.",
    scene: "tropical", featured: false
  },
  {
    id: 6423, name: "Kimpton Residences", hotel: "Kimpton Grand Roatán Resort & Spa",
    city: "Roatán", region: "Bay Islands", country: "Honduras",
    types: ["residence", "condo"], features: ["beachfront", "family", "multi-bedroom", "kitchen"],
    blurb: "Caribbean-front residences on Roatán's coral-fringed coast.",
    scene: "tropical", featured: false
  },
  {
    id: 3614, name: "Four Seasons Private Villas", hotel: "Four Seasons Resort Los Cabos at Costa Palmas",
    city: "Cabo San Lucas", region: "Baja California Sur", country: "Mexico",
    types: ["villa", "residence", "estate"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: "Swimmable-beach villas on the East Cape's Costa Palmas.",
    scene: "desert", featured: false
  },
  {
    id: 1066, name: "Maroma Residences", hotel: "Maroma, A Belmond Hotel",
    city: "Riviera Maya", region: "Quintana Roo", country: "Mexico",
    types: ["residence", "villa"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: "Beachfront residences on one of the Riviera Maya's best beaches.",
    scene: "tropical", featured: false
  },
  {
    id: 1896, name: "Rosewood Residences", hotel: "Rosewood Mayakoba",
    city: "Playa del Carmen", region: "Riviera Maya", country: "Mexico",
    types: ["residence", "villa", "home"], features: ["beachfront", "family", "multi-bedroom", "private-pool", "kitchen"],
    blurb: "Lagoon and beachfront residences woven through a coastal jungle.",
    scene: "tropical", featured: true
  },
  {
    id: 1414, name: "Four Seasons Residence Villas", hotel: "Four Seasons Resort Punta Mita",
    city: "Punta Mita", region: "Nayarit", country: "Mexico",
    types: ["villa", "residence", "estate"], features: ["beachfront", "family", "multi-bedroom", "private-pool"],
    blurb: "Pacific-front villas on a private peninsula north of Puerto Vallarta.",
    scene: "beach", featured: false
  }
];
