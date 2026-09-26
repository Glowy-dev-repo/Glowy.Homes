// Illustrated scenes for synthetic listing photos: an exterior drawn for the home type, or a room
// matching the photo caption. Original vector drawings, never third party images (docs/03 section
// 1.2). Everything is drawn on a 1600 x 1067 canvas; the caller scales it.

export const SCENE_W = 1600;
export const SCENE_H = 1067;

type Pick = <T>(items: readonly T[]) => T;

const WALLS = ["#F4F1EC", "#EEF2F5", "#F3EFE7", "#EDF1EE", "#F5F3F0"] as const;
const FLOORS = ["#C8A27A", "#B8906A", "#D5B794", "#A98663", "#CDB08D"] as const;
const SIDINGS = ["#E8E4DC", "#D9DEE3", "#E5DED1", "#CFD8D3", "#E9E6E1", "#D8D2C6"] as const;
const ROOFS = ["#4B5563", "#5B4636", "#374151", "#6B5B4B", "#3F4A56"] as const;
const DOORS = ["#1E3A8A", "#7F1D1D", "#14532D", "#374151", "#78350F"] as const;
const FABRICS = ["#94A3B8", "#A8A29E", "#7C8FA6", "#B7A99A", "#8FA39A"] as const;

const sky = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFDBFE"/><stop offset="1" stop-color="#EFF6FF"/></linearGradient></defs>
<rect width="1600" height="1067" fill="url(#sky)"/>
<circle cx="1330" cy="190" r="70" fill="#FFFFFF" fill-opacity="0.8"/>`;

const tree = (x: number, base: number, s = 1) =>
  `<rect x="${x - 12 * s}" y="${base - 140 * s}" width="${24 * s}" height="${140 * s}" fill="#7C5A3C"/>
<circle cx="${x}" cy="${base - 190 * s}" r="${95 * s}" fill="#6B8F71"/><circle cx="${x - 60 * s}" cy="${base - 150 * s}" r="${65 * s}" fill="#7FA285"/><circle cx="${x + 60 * s}" cy="${base - 150 * s}" r="${65 * s}" fill="#5E8265"/>`;

const shrub = (x: number, base: number) => `<ellipse cx="${x}" cy="${base - 25}" rx="70" ry="38" fill="#6F9474"/>`;

function windowAt(x: number, y: number, w: number, h: number, frame = "#FFFFFF") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#DBEAFE" stroke="${frame}" stroke-width="10"/>
<line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${frame}" stroke-width="6"/>
<line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${frame}" stroke-width="6"/>`;
}

function lawn(base = 820) {
  return `<rect y="${base}" width="1600" height="${1067 - base}" fill="#8DB48E"/><rect y="${base}" width="1600" height="14" fill="#7AA37D"/>`;
}

function detached(pick: Pick) {
  const siding = pick(SIDINGS);
  const roof = pick(ROOFS);
  const door = pick(DOORS);
  return `${sky}${lawn()}
${tree(230, 830, 1.1)}
<polygon points="440,470 800,240 1160,470" fill="${roof}"/>
<rect x="1010" y="280" width="60" height="120" fill="${roof}"/>
<rect x="480" y="460" width="640" height="370" fill="${siding}"/>
${windowAt(540, 530, 150, 130)}${windowAt(910, 530, 150, 130)}
<rect x="740" y="620" width="120" height="210" fill="${door}"/><circle cx="840" cy="730" r="7" fill="#F8FAFC"/>
<rect x="700" y="820" width="200" height="20" fill="#D6D3D1"/>
${shrub(560, 840)}${shrub(1040, 840)}
<path d="M780 840 L720 1067 L880 1067 L820 840 Z" fill="#E7E5E4"/>`;
}

function townhouse(pick: Pick) {
  const roof = pick(ROOFS);
  const units = [0, 1, 2]
    .map((i) => {
      const x = 260 + i * 370;
      const siding = pick(SIDINGS);
      const door = pick(DOORS);
      return `<rect x="${x}" y="330" width="360" height="500" fill="${siding}" stroke="#FFFFFF" stroke-width="6"/>
${windowAt(x + 40, 380, 120, 120)}${windowAt(x + 200, 380, 120, 120)}${windowAt(x + 40, 560, 120, 120)}
<rect x="${x + 220}" y="620" width="100" height="210" fill="${door}"/>`;
    })
    .join("");
  return `${sky}${lawn()}<rect x="240" y="300" width="1150" height="40" fill="${roof}"/>${units}${tree(150, 830, 0.9)}${shrub(1470, 840)}`;
}

function semi(pick: Pick) {
  const siding = pick(SIDINGS);
  const roof = pick(ROOFS);
  return `${sky}${lawn()}
<polygon points="360,480 800,250 1240,480" fill="${roof}"/>
<rect x="400" y="470" width="800" height="360" fill="${siding}"/>
<line x1="800" y1="470" x2="800" y2="830" stroke="#FFFFFF" stroke-width="10"/>
${windowAt(450, 530, 140, 120)}${windowAt(1010, 530, 140, 120)}
<rect x="640" y="620" width="110" height="210" fill="${pick(DOORS)}"/><rect x="850" y="620" width="110" height="210" fill="${pick(DOORS)}"/>
${tree(220, 830, 1)}${tree(1400, 830, 0.9)}`;
}

function tower(pick: Pick, floors: number) {
  const body = pick(["#CBD5E1", "#D6D3D1", "#E2E8F0", "#C7D2DA"] as const);
  const top = 1067 - 250 - floors * 60;
  let windows = "";
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < 6; c++) windows += `<rect x="${560 + c * 82}" y="${top + 30 + f * 60}" width="56" height="36" fill="${(f + c) % 5 === 0 ? "#FEF3C7" : "#DBEAFE"}"/>`;
  }
  return `${sky}
<rect x="120" y="${top + 200}" width="300" height="${867 - top}" fill="#E2E8F0"/><rect x="1180" y="${top + 120}" width="300" height="${947 - top}" fill="#D9E1EA"/>
<rect x="530" y="${top}" width="540" height="${817 - top}" fill="${body}"/>${windows}
<rect y="817" width="1600" height="250" fill="#CBD5E1"/><rect x="740" y="707" width="120" height="110" fill="#1E3A8A"/>
${tree(360, 900, 0.8)}${tree(1250, 900, 0.8)}`;
}

function yard(pick: Pick) {
  return `${sky}${lawn(640)}
<rect x="0" y="560" width="1600" height="90" fill="${pick(["#D6C3A5", "#CBB38F", "#E0D2B8"] as const)}"/>
${Array.from({ length: 20 }, (_, i) => `<rect x="${i * 82}" y="540" width="16" height="110" fill="#BFA67F"/>`).join("")}
${tree(260, 700, 1.2)}${tree(1300, 690, 1)}
<rect x="620" y="760" width="360" height="160" rx="12" fill="#A8A29E"/><rect x="650" y="700" width="300" height="70" fill="#78716C"/>`;
}

// ---------- rooms ----------

function room(pick: Pick, inner: string) {
  const wall = pick(WALLS);
  const floor = pick(FLOORS);
  return `<rect width="1600" height="1067" fill="${wall}"/>
<rect y="760" width="1600" height="307" fill="${floor}"/>
${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 200}" y1="760" x2="${i * 200 - 120}" y2="1067" stroke="#000" stroke-opacity="0.06" stroke-width="4"/>`).join("")}
<rect y="740" width="1600" height="22" fill="#FFFFFF"/>
<rect x="980" y="180" width="440" height="420" fill="#BFDBFE" stroke="#FFFFFF" stroke-width="18"/>
<line x1="1200" y1="180" x2="1200" y2="600" stroke="#FFFFFF" stroke-width="12"/>
<circle cx="1320" cy="270" r="40" fill="#FFFFFF" fill-opacity="0.8"/>
${inner}`;
}

const living = (pick: Pick) => {
  const fabric = pick(FABRICS);
  return room(pick, `<ellipse cx="620" cy="900" rx="420" ry="70" fill="#E7E5E4" fill-opacity="0.8"/>
<rect x="260" y="560" width="620" height="170" rx="30" fill="${fabric}"/><rect x="230" y="620" width="680" height="170" rx="30" fill="${fabric}"/>
<rect x="250" y="790" width="24" height="40" fill="#57534E"/><rect x="866" y="790" width="24" height="40" fill="#57534E"/>
<rect x="300" y="590" width="120" height="90" rx="16" fill="#F5F5F4"/><rect x="720" y="590" width="120" height="90" rx="16" fill="#E7E5E4"/>
<rect x="470" y="820" width="300" height="24" rx="8" fill="#78716C"/>
<rect x="1000" y="640" width="12" height="160" fill="#57534E"/><path d="M950 640 L1062 640 L1030 560 L982 560 Z" fill="#F5F5F4"/>
<rect x="110" y="300" width="250" height="180" fill="#FFFFFF" stroke="#D6D3D1" stroke-width="8"/><rect x="140" y="330" width="190" height="120" fill="${pick(["#93C5FD", "#A7C4A0", "#D6C3A5"] as const)}"/>`);
};

const bedroom = (pick: Pick) => {
  const fabric = pick(FABRICS);
  return room(pick, `<rect x="330" y="470" width="560" height="160" rx="12" fill="#78716C"/>
<rect x="300" y="620" width="620" height="220" rx="20" fill="#FFFFFF"/><rect x="300" y="700" width="620" height="140" rx="20" fill="${fabric}"/>
<rect x="360" y="590" width="200" height="80" rx="30" fill="#F5F5F4"/><rect x="660" y="590" width="200" height="80" rx="30" fill="#F5F5F4"/>
<rect x="150" y="660" width="130" height="150" fill="#A8A29E"/><rect x="190" y="580" width="16" height="80" fill="#57534E"/><path d="M160 580 L236 580 L220 530 L176 530 Z" fill="#F5F5F4"/>`);
};

const kitchen = (pick: Pick) => {
  const cabinet = pick(["#FFFFFF", "#E2E8F0", "#DCE3D8", "#1F2937", "#E7E5E4"] as const);
  const counter = pick(["#F5F5F4", "#D6D3D1", "#E5E7EB"] as const);
  return room(pick, `<rect x="80" y="200" width="820" height="200" fill="${cabinet}" stroke="#D4D4D8" stroke-width="4"/>
${[0, 1, 2, 3].map((i) => `<line x1="${80 + (i + 1) * 164}" y1="200" x2="${80 + (i + 1) * 164}" y2="400" stroke="#D4D4D8" stroke-width="4"/>`).join("")}
<rect x="80" y="520" width="820" height="40" fill="${counter}"/><rect x="80" y="560" width="820" height="200" fill="${cabinet}" stroke="#D4D4D8" stroke-width="4"/>
<rect x="420" y="420" width="140" height="100" fill="#A1A1AA"/><rect x="560" y="440" width="60" height="80" fill="#E4E4E7"/>
<rect x="520" y="700" width="560" height="40" fill="${counter}"/><rect x="540" y="740" width="520" height="200" fill="${cabinet}" stroke="#D4D4D8" stroke-width="4"/>
${[0, 1, 2].map((i) => `<rect x="${600 + i * 160}" y="760" width="16" height="180" fill="#52525B"/><rect x="${570 + i * 160}" y="740" width="76" height="24" rx="10" fill="#52525B"/>`).join("")}
${[0, 1].map((i) => `<line x1="${650 + i * 240}" y1="0" x2="${650 + i * 240}" y2="150" stroke="#52525B" stroke-width="4"/><path d="M${615 + i * 240} 150 L${685 + i * 240} 150 L${670 + i * 240} 190 L${630 + i * 240} 190 Z" fill="#FDE68A"/>`).join("")}`);
};

const bathroom = (pick: Pick) =>
  room(pick, `<rect x="120" y="560" width="620" height="220" rx="60" fill="#FFFFFF" stroke="#D4D4D8" stroke-width="6"/>
<rect x="640" y="470" width="14" height="100" fill="#A1A1AA"/>
<rect x="100" y="360" width="700" height="200" fill="${pick(["#E0F2FE", "#F1F5F9", "#ECFDF5"] as const)}"/>
${Array.from({ length: 8 }, (_, i) => `<line x1="${100 + i * 100}" y1="360" x2="${100 + i * 100}" y2="560" stroke="#FFFFFF" stroke-width="4"/>`).join("")}
<rect x="1000" y="620" width="360" height="160" fill="#A8A29E"/><rect x="990" y="600" width="380" height="30" fill="#F5F5F4"/>
<rect x="1060" y="360" width="240" height="200" rx="16" fill="#E0F2FE" stroke="#D6D3D1" stroke-width="8"/>`);

const dining = (pick: Pick) =>
  room(pick, `<rect x="360" y="620" width="760" height="36" rx="8" fill="#8B6B4E"/>
<rect x="400" y="656" width="24" height="170" fill="#6F5641"/><rect x="1056" y="656" width="24" height="170" fill="#6F5641"/>
${[0, 1, 2, 3].map((i) => `<rect x="${400 + i * 190}" y="520" width="110" height="130" rx="16" fill="${pick(FABRICS)}"/><rect x="${410 + i * 190}" y="650" width="16" height="170" fill="#57534E"/>`).join("")}
<line x1="740" y1="0" x2="740" y2="360" stroke="#52525B" stroke-width="4"/><circle cx="740" cy="400" r="50" fill="#FDE68A"/>`);

const office = (pick: Pick) =>
  room(pick, `<rect x="220" y="580" width="700" height="30" fill="#8B6B4E"/><rect x="240" y="610" width="24" height="220" fill="#6F5641"/><rect x="876" y="610" width="24" height="220" fill="#6F5641"/>
<rect x="470" y="420" width="240" height="150" rx="10" fill="#1F2937"/><rect x="580" y="570" width="20" height="20" fill="#1F2937"/>
<rect x="500" y="640" width="160" height="150" rx="30" fill="${pick(FABRICS)}"/>
<rect x="120" y="240" width="300" height="24" fill="#8B6B4E"/><rect x="140" y="190" width="40" height="50" fill="#93C5FD"/><rect x="200" y="175" width="40" height="65" fill="#A7C4A0"/><rect x="260" y="200" width="40" height="40" fill="#D6C3A5"/>`);

const laundry = (pick: Pick) =>
  room(pick, `${[0, 1].map((i) => `<rect x="${260 + i * 300}" y="480" width="260" height="300" rx="16" fill="#FFFFFF" stroke="#D4D4D8" stroke-width="6"/><circle cx="${390 + i * 300}" cy="650" r="80" fill="#DBEAFE" stroke="#A1A1AA" stroke-width="10"/>`).join("")}
<rect x="220" y="280" width="600" height="140" fill="${pick(["#FFFFFF", "#E2E8F0"] as const)}" stroke="#D4D4D8" stroke-width="4"/>`);

const garage = (pick: Pick) =>
  `${sky}${lawn(840)}<rect x="300" y="360" width="1000" height="480" fill="${pick(SIDINGS)}"/><polygon points="260,370 800,200 1340,370" fill="${pick(ROOFS)}"/>
<rect x="420" y="480" width="760" height="360" fill="#E5E7EB" stroke="#FFFFFF" stroke-width="10"/>
${[1, 2, 3, 4].map((i) => `<line x1="420" y1="${480 + i * 72}" x2="1180" y2="${480 + i * 72}" stroke="#D1D5DB" stroke-width="6"/>`).join("")}
<rect x="380" y="840" width="840" height="227" fill="#D6D3D1"/>`;

const cityView = (pick: Pick) =>
  `${sky}${Array.from({ length: 12 }, (_, i) => {
    const h = 250 + ((i * 97) % 380);
    return `<rect x="${i * 135}" y="${760 - h}" width="115" height="${h}" fill="${pick(["#94A3B8", "#A5B4C4", "#8394A8"] as const)}"/>`;
  }).join("")}
<rect y="760" width="1600" height="307" fill="#E2E8F0"/>
<rect y="700" width="1600" height="14" fill="#FFFFFF"/>${Array.from({ length: 21 }, (_, i) => `<rect x="${i * 80}" y="700" width="10" height="120" fill="#FFFFFF"/>`).join("")}
<rect y="820" width="1600" height="14" fill="#FFFFFF"/>`;

const lobby = (pick: Pick) =>
  `<rect width="1600" height="1067" fill="${pick(WALLS)}"/><rect y="800" width="1600" height="267" fill="#D6D3D1"/>
<rect x="560" y="300" width="220" height="500" fill="#A1A1AA"/><rect x="820" y="300" width="220" height="500" fill="#A1A1AA"/>
<line x1="670" y1="300" x2="670" y2="800" stroke="#71717A" stroke-width="4"/><line x1="930" y1="300" x2="930" y2="800" stroke="#71717A" stroke-width="4"/>
<rect x="150" y="620" width="300" height="180" rx="12" fill="${pick(FABRICS)}"/><rect x="1180" y="560" width="260" height="240" fill="#8B6B4E"/>`;

const gym = (pick: Pick) =>
  room(pick, `<rect x="200" y="600" width="520" height="40" rx="20" fill="#27272A"/><rect x="240" y="640" width="440" height="120" fill="#3F3F46"/>
<rect x="160" y="520" width="30" height="240" fill="#27272A"/><rect x="760" y="560" width="200" height="30" fill="#52525B"/>
${[0, 1, 2].map((i) => `<rect x="${780 + i * 60}" y="660" width="40" height="80" rx="10" fill="#1F2937"/>`).join("")}`);

const land = () =>
  `${sky}<rect y="600" width="1600" height="467" fill="#A3B18A"/><rect y="600" width="1600" height="10" fill="#8A9A73"/>
${Array.from({ length: 16 }, (_, i) => `<line x1="${i * 110}" y1="620" x2="${i * 110 + 40}" y2="1067" stroke="#93A27A" stroke-width="6"/>`).join("")}
${tree(200, 620, 0.9)}${tree(1400, 600, 1.1)}
<line x1="300" y1="760" x2="1300" y2="760" stroke="#FFFFFF" stroke-width="6" stroke-dasharray="30 20"/>`;

/** The scene body for a caption and home type. */
export function sceneFor(caption: string, propertyType: string, pick: Pick, seed: number): string {
  const c = caption.toLowerCase();
  if (propertyType === "land" || /lot|aerial|surrounding/.test(c)) return land();
  if (/kitchen/.test(c)) return kitchen(pick);
  if (/bedroom/.test(c)) return bedroom(pick);
  if (/bath/.test(c)) return bathroom(pick);
  if (/dining/.test(c)) return dining(pick);
  if (/office/.test(c)) return office(pick);
  if (/laundry/.test(c)) return laundry(pick);
  if (/garage/.test(c)) return garage(pick);
  if (/backyard/.test(c)) return yard(pick);
  if (/balcony|rooftop|terrace/.test(c)) return cityView(pick);
  if (/lobby/.test(c)) return lobby(pick);
  if (/gym/.test(c)) return gym(pick);
  if (/living|family|basement/.test(c)) return living(pick);
  // Exteriors and street views: drawn for the home type.
  if (propertyType === "condo") return tower(pick, 7 + (seed % 5));
  if (propertyType === "multi") return tower(pick, 3 + (seed % 2));
  if (propertyType === "townhouse") return townhouse(pick);
  if (propertyType === "semi") return semi(pick);
  return detached(pick);
}
