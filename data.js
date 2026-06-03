/* ============================================================================
 * data.js  —  Synthetic Crime Database for the KSP Crime Intelligence Copilot
 * ----------------------------------------------------------------------------
 * IMPORTANT: 100% SYNTHETIC, FICTIONAL DATA. No real persons, phones, vehicles
 * or cases. Generated deterministically (seeded RNG) so every demo run is
 * identical and reproducible. In production this layer is replaced by the real
 * KSP / CCTNS database behind a governed, access-controlled API.
 * ==========================================================================*/
(function () {
  "use strict";

  /* ---- Seeded RNG (mulberry32): stable data across reloads = safe demos ---- */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260526);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const ri = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
  const chance = (p) => rnd() < p;

  const REF_NOW = new Date();
  const dayMs = 86400000;

  /* ----------------------------- Geography -------------------------------- */
  // Bengaluru gets rich, real-ish sub-areas (drives believable hotspots).
  const BLR_AREAS = [
    { area: "Whitefield",      lat: 12.9698, lng: 77.7500 },
    { area: "Koramangala",     lat: 12.9352, lng: 77.6245 },
    { area: "Jayanagar",       lat: 12.9250, lng: 77.5938 },
    { area: "Marathahalli",    lat: 12.9560, lng: 77.7010 },
    { area: "Indiranagar",     lat: 12.9719, lng: 77.6412 },
    { area: "Majestic",        lat: 12.9767, lng: 77.5713 },
    { area: "Electronic City", lat: 12.8452, lng: 77.6602 },
    { area: "Hebbal",          lat: 13.0358, lng: 77.5970 },
    { area: "KR Puram",        lat: 13.0078, lng: 77.6960 },
    { area: "Banashankari",    lat: 12.9255, lng: 77.5468 },
    { area: "Yelahanka",       lat: 13.1007, lng: 77.5963 },
    { area: "BTM Layout",      lat: 12.9166, lng: 77.6101 },
    { area: "Malleshwaram",    lat: 13.0035, lng: 77.5647 },
    { area: "HSR Layout",      lat: 12.9116, lng: 77.6473 }
  ];
  const GENERIC_AREAS = ["City Centre", "Market Road", "Bus Stand", "Ring Road", "Old Town", "Railway Station", "Industrial Area"];

  // District centres (real coordinates) for the rest of Karnataka.
  // weight = relative crime volume (Bengaluru dominates, as in reality).
  const DISTRICTS = [
    { district: "Bengaluru",   lat: 12.9716, lng: 77.5946, areas: BLR_AREAS, weight: 40 },
    { district: "Mysuru",      lat: 12.2958, lng: 76.6394, weight: 9 },
    { district: "Mangaluru",   lat: 12.9141, lng: 74.8560, weight: 8 },
    { district: "Hubballi",    lat: 15.3647, lng: 75.1240, weight: 7 },
    { district: "Belagavi",    lat: 15.8497, lng: 74.4977, weight: 6 },
    { district: "Kalaburagi",  lat: 17.3297, lng: 76.8343, weight: 4 },
    { district: "Davanagere",  lat: 14.4644, lng: 75.9218, weight: 4 },
    { district: "Ballari",     lat: 15.1394, lng: 76.9214, weight: 4 },
    { district: "Vijayapura",  lat: 16.8302, lng: 75.7100, weight: 3 },
    { district: "Shivamogga",  lat: 13.9299, lng: 75.5681, weight: 4 },
    { district: "Tumakuru",    lat: 13.3379, lng: 77.1173, weight: 4 },
    { district: "Udupi",       lat: 13.3409, lng: 74.7421, weight: 3 }
  ];
  const weightedDistrict = () => {
    const total = DISTRICTS.reduce((s, d) => s + d.weight, 0);
    let r = rnd() * total;
    for (const d of DISTRICTS) { if ((r -= d.weight) <= 0) return d; }
    return DISTRICTS[0];
  };
  // Build an area table for every district (generic ones get jittered points).
  DISTRICTS.forEach((d) => {
    if (!d.areas) {
      d.areas = GENERIC_AREAS.map((a) => ({
        area: a,
        lat: d.lat + (rnd() - 0.5) * 0.08,
        lng: d.lng + (rnd() - 0.5) * 0.08
      }));
    }
  });

  /* ---------------------------- Crime taxonomy ---------------------------- */
  // weight = relative frequency, severity = 1..10 (feeds risk + prediction).
  const CRIME_TYPES = [
    { type: "Chain Snatching", weight: 16, severity: 6 },
    { type: "Mobile Theft",    weight: 18, severity: 3 },
    { type: "Vehicle Theft",   weight: 15, severity: 5 },
    { type: "Burglary",        weight: 12, severity: 6 },
    { type: "House Theft",     weight: 10, severity: 5 },
    { type: "Robbery",         weight: 8,  severity: 7 },
    { type: "Cyber Fraud",     weight: 9,  severity: 5 },
    { type: "Assault",         weight: 6,  severity: 6 },
    { type: "Dacoity",         weight: 2,  severity: 9 },
    { type: "Kidnapping",      weight: 2,  severity: 9 },
    { type: "Murder",          weight: 2,  severity: 10 }
  ];
  const weightedCrime = () => {
    const total = CRIME_TYPES.reduce((s, c) => s + c.weight, 0);
    let r = rnd() * total;
    for (const c of CRIME_TYPES) { if ((r -= c.weight) <= 0) return c; }
    return CRIME_TYPES[0];
  };

  const MODUS = {
    "Chain Snatching": ["two-wheeler borne offenders snatched a gold chain and fled", "pillion rider snatched ornament near a junction"],
    "Mobile Theft":    ["smartphone lifted from victim's pocket in a crowd", "device snatched at a bus stop"],
    "Vehicle Theft":   ["two-wheeler stolen from an unguarded parking lot", "car lifted using a duplicate key"],
    "Burglary":        ["lock broken and house entered while occupants away", "rear window forced open at night"],
    "House Theft":     ["valuables removed during daytime entry", "jewellery stolen from bedroom almirah"],
    "Robbery":         ["cash robbed at knife-point", "victim threatened and valuables taken"],
    "Cyber Fraud":     ["victim duped via fake KYC update call", "UPI fraud through phishing link"],
    "Assault":         ["physical assault following an altercation", "grievous hurt in a group clash"],
    "Dacoity":         ["armed gang looted a commercial establishment", "highway dacoity on transport vehicle"],
    "Kidnapping":      ["minor reported missing, suspected abduction", "victim confined for ransom"],
    "Murder":          ["body recovered with injury marks", "homicide following personal enmity"]
  };

  /* --------------------------- Identity pools ----------------------------- */
  const FIRST = ["Ravi", "Suresh", "Manjunath", "Kiran", "Ramesh", "Anil", "Prakash", "Naveen", "Vinod", "Santosh",
    "Imran", "Faizal", "Arjun", "Mahesh", "Ganesh", "Lokesh", "Shankar", "Basava", "Nagaraj", "Venkatesh",
    "Sharath", "Mohan", "Deepak", "Rahul", "Yusuf", "Salman", "Praveen", "Girish", "Harish", "Chetan"];
  const LAST = ["Gowda", "Reddy", "Naik", "Shetty", "Hegde", "Patil", "Rao", "Kumar", "Pasha", "Khan",
    "Murthy", "Setty", "Achar", "Poojary", "Bhat", "Yadav", "Singh", "Das", "Acharya", "Hiremath"];
  const ALIAS = ["Chamak", "Tiger", "Anna", "Chinna", "Bullet", "Bombu", "Maddur", "Pailwan", "Kabza", "Loota", "Speed", "Ganja"];

  const phone = () => "" + pick(["9", "8", "7", "6"]) + (ri(100000000, 999999999));
  const vehicle = () => "KA-" + String(ri(1, 53)).padStart(2, "0") + "-" + pick(["MA", "MH", "MJ", "EQ", "HR", "CD", "AB"]) + "-" + ri(1000, 9999);
  const fir = (i) => "FIR/" + (2025 + (i % 2)) + "/" + String(ri(100, 999)) + "/" + String(i).padStart(4, "0");

  /* --------------------------- Suspect graph ------------------------------ */
  const SUSPECTS = [];
  const N_SUSPECTS = 70;
  for (let i = 0; i < N_SUSPECTS; i++) {
    const home = weightedDistrict();
    SUSPECTS.push({
      id: "SUS-" + String(i + 1).padStart(3, "0"),
      name: pick(FIRST) + " " + pick(LAST),
      alias: chance(0.5) ? pick(ALIAS) : null,
      age: ri(19, 54),
      gender: chance(0.92) ? "M" : "F",
      district: home.district,
      phones: [phone(), ...(chance(0.35) ? [phone()] : [])],
      vehicles: chance(0.55) ? [vehicle()] : [],
      associates: [],
      cases: [],
      status: pick(["At large", "On bail", "In custody", "Under watch", "Absconding"])
    });
  }

  /* ------------------------------- Cases ---------------------------------- */
  const CASES = [];
  const N_CASES = 340;
  for (let i = 0; i < N_CASES; i++) {
    const ct = weightedCrime();
    const dist = weightedDistrict();
    const spot = pick(dist.areas);
    const ageDays = ri(0, 545); // ~18 months of history
    const date = new Date(REF_NOW.getTime() - ageDays * dayMs);
    const status = pick(["Open", "Open", "Under Investigation", "Under Investigation", "Charge-sheeted", "Closed"]);

    // Bias suspect selection toward locals & repeat offenders (realistic networks).
    const linked = [];
    const nSus = chance(0.18) ? 0 : ri(1, 3);
    const pool = SUSPECTS.filter((s) => s.district === dist.district);
    for (let k = 0; k < nSus; k++) {
      const s = (pool.length && chance(0.7)) ? pick(pool) : pick(SUSPECTS);
      if (!linked.includes(s.id)) linked.push(s.id);
    }

    const usePhone = linked.length && chance(0.6)
      ? pick(SUSPECTS.find((s) => s.id === linked[0]).phones)
      : phone();
    const useVeh = (ct.type === "Vehicle Theft" || ct.type === "Chain Snatching" || chance(0.3))
      ? (linked.length && chance(0.5) && SUSPECTS.find((s) => s.id === linked[0]).vehicles[0]
          ? SUSPECTS.find((s) => s.id === linked[0]).vehicles[0]
          : vehicle())
      : null;

    const c = {
      id: "KSP-" + String(10000 + i),
      fir: fir(i),
      type: ct.type,
      severity: ct.severity,
      date: date.toISOString().slice(0, 10),
      ts: date.getTime(),
      district: dist.district,
      area: spot.area,
      lat: spot.lat + (rnd() - 0.5) * 0.012,
      lng: spot.lng + (rnd() - 0.5) * 0.012,
      status,
      suspects: linked,
      phone: usePhone,
      vehicle: useVeh,
      modus: pick(MODUS[ct.type]),
      description: ""
    };
    c.description =
      `${c.type} reported at ${c.area}, ${c.district} on ${c.date}. ` +
      `${c.modus[0].toUpperCase() + c.modus.slice(1)}.` +
      (useVeh ? ` Vehicle of interest: ${useVeh}.` : "") +
      ` Status: ${status}.`;
    CASES.push(c);
    linked.forEach((id) => SUSPECTS.find((s) => s.id === id).cases.push(c.id));
  }

  /* ----- Derive associate links (co-offenders) + a few deliberate rings --- */
  CASES.forEach((c) => {
    for (let a = 0; a < c.suspects.length; a++)
      for (let b = a + 1; b < c.suspects.length; b++) {
        const A = SUSPECTS.find((s) => s.id === c.suspects[a]);
        const B = SUSPECTS.find((s) => s.id === c.suspects[b]);
        if (!A.associates.includes(B.id)) A.associates.push(B.id);
        if (!B.associates.includes(A.id)) B.associates.push(A.id);
      }
  });

  /* ------------------------------ Risk model ------------------------------ */
  // Transparent, explainable score (NO black box). Each factor is reported.
  function scoreSuspect(s) {
    const recs = s.cases.map((id) => CASES.find((c) => c.id === id));
    const recent = recs.filter((c) => (REF_NOW - c.ts) / dayMs <= 180).length;
    const sevMax = recs.reduce((m, c) => Math.max(m, c.severity), 0);
    const factors = [
      { label: "Case volume",         value: Math.min(recs.length * 9, 36),  detail: `${recs.length} linked case(s)` },
      { label: "Recent activity",     value: Math.min(recent * 12, 30),      detail: `${recent} in last 180 days` },
      { label: "Offence severity",    value: sevMax * 2,                     detail: `peak severity ${sevMax}/10` },
      { label: "Network reach",       value: Math.min(s.associates.length * 4, 16), detail: `${s.associates.length} known associate(s)` }
    ];
    let score = factors.reduce((sum, f) => sum + f.value, 0);
    if (s.status === "Absconding" || s.status === "At large") score += 6;
    score = Math.max(3, Math.min(99, Math.round(score)));
    return { score, factors };
  }
  SUSPECTS.forEach((s) => {
    const r = scoreSuspect(s);
    s.riskScore = r.score;
    s.riskFactors = r.factors;
  });

  /* ------------------------------- Helpers -------------------------------- */
  const DB = {
    cases: CASES,
    suspects: SUSPECTS,
    districts: DISTRICTS,
    crimeTypes: CRIME_TYPES,
    refNow: REF_NOW,

    caseById: (id) => CASES.find((c) => c.id === id),
    suspectById: (id) => SUSPECTS.find((s) => s.id === id),

    districtNames: () => DISTRICTS.map((d) => d.district),
    crimeNames: () => CRIME_TYPES.map((c) => c.type),

    // Pull a guaranteed-real example for the demo suggestion chips.
    sampleHotPhone: function () {
      const ranked = [...SUSPECTS].sort((a, b) => b.cases.length - a.cases.length);
      return ranked[0].phones[0];
    },
    topSuspect: function () {
      return [...SUSPECTS].sort((a, b) => b.riskScore - a.riskScore)[0];
    },
    stats: function () {
      return {
        cases: CASES.length,
        suspects: SUSPECTS.length,
        districts: DISTRICTS.length,
        open: CASES.filter((c) => c.status === "Open" || c.status === "Under Investigation").length
      };
    }
  };

  window.DB = DB;
  console.log("[KSP-Copilot] Synthetic DB ready:", DB.stats());
})();
