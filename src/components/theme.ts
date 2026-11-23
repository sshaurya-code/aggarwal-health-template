import type { Panel } from "@/lib/markers";

type Style = { color: string; icon: string; fill?: boolean };

// One identity colour + glyph per health area, Apple Health style. High/low/normal stay
// in the separate status colours (always with an arrow + label), so hue never means "bad".
export const PANEL_STYLE: Record<Panel | "Other", Style> = {
  Diabetes: { color: "#ff9500", icon: "M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z", fill: true },
  "Heart & Lipids": {
    color: "#ff2d55",
    icon: "M12 20s-7-4.4-9.2-8.8C1.4 8.3 3.3 5 6.6 5c2 0 3.4 1.1 4.1 2.3h2.6C14 6.1 15.4 5 17.4 5c3.3 0 5.2 3.3 3.8 6.2C19 15.6 12 20 12 20z",
    fill: true,
  },
  Thyroid: { color: "#32ade6", icon: "M13 2L4 14h7l-1 8 9-12h-7l1-8z", fill: true },
  Hormones: { color: "#af52de", icon: "M9 3h6M10 3v6L4.5 18.5A2 2 0 006.2 21h11.6a2 2 0 001.7-2.5L14 9V3M7 15h10" },
  "Vitamins & Minerals": {
    color: "#e5a000",
    icon: "M12 7a5 5 0 100 10 5 5 0 000-10zM12 1.5v2M12 20.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M1.5 12h2M20.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4",
  },
  Kidney: { color: "#5856d6", icon: "M15 3.5c-3 0-4.2 2.2-4.2 4.3 0 1.6 1.2 2.4 1.2 4.2s-1.2 2.6-1.2 4.2c0 2.6 1.9 4.3 4.2 4.3 3.6 0 6-4 6-8.5s-2.4-8.5-6-8.5zM10.8 12H3" },
  Liver: { color: "#a2845e", icon: "M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7" },
  "Blood Count": { color: "#ff3b30", icon: "M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11zM9.5 14.5h5M12 12v5" },
  Inflammation: { color: "#00b5ad", icon: "M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-4-3-6 0 4-4 7-4 12 0 4 3 7 7 7z" },
  Vitals: { color: "#007aff", icon: "M3 12h4l3-8 4 16 3-8h4" },
  Other: { color: "#8e8e93", icon: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5" },
};

// For tight spots like the two-column highlight tiles.
export const PANEL_SHORT: Partial<Record<Panel | "Other", string>> = {
  "Heart & Lipids": "Heart",
  "Vitamins & Minerals": "Vitamins",
  "Blood Count": "Blood",
};

export const KIND_STYLE: Record<string, Style> = {
  lab_report: PANEL_STYLE.Hormones,
  prescription: { color: "#34c759", icon: "M10.5 3.5a5 5 0 017 7l-7 7a5 5 0 01-7-7zM7 7l7 7" },
  imaging: { color: "#5856d6", icon: "M4 5h16v14H4zM8 9v6M12 8v8M16 9v6" },
  discharge: { color: "#ff3b30", icon: "M4 21V9l8-5 8 5v12M10 21v-5h4v5M12 8v4M10 10h4" },
  consultation: { color: "#32ade6", icon: "M6 3v6a4 4 0 008 0V3M10 13v3a5 5 0 0010 0v-2M20 12a2 2 0 100-4 2 2 0 000 4z" },
  vaccination: { color: "#ff9500", icon: "M17 3l4 4M19 5l-9 9M14 6l4 4M8 12l4 4M10 14l-6 6M5 15l4 4" },
  other: PANEL_STYLE.Other,
};

const ID_CARD: Style = { color: "#5856d6", icon: "M3 6h18v12H3zM8.5 12.5a2 2 0 100-4 2 2 0 000 4zM5.5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 10h4M14 13h4" };
const COVER: Style = { color: "#007aff", icon: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5" };

export const CATEGORY_STYLE: Record<string, Style> = {
  health: PANEL_STYLE["Heart & Lipids"],
  id: ID_CARD,
  bill: { color: "#00b5ad", icon: "M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21zM9 8h6M9 12h6M9 16h3" },
  insurance: COVER,
  car: { color: "#ff9500", icon: "M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM7 19v1.5M17 19v1.5M7.5 13.5h.01M16.5 13.5h.01" },
  investment: { color: "#34c759", icon: "M3 17l6-6 4 4 8-8M15 7h6v6" },
  other: PANEL_STYLE.Other,
};

export const HOUSEHOLD: Style = { color: "#8e8e93", icon: "M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" };

Object.assign(KIND_STYLE, {
  aadhaar: ID_CARD,
  pan: ID_CARD,
  passport: { color: ID_CARD.color, icon: "M6 3h11a1 1 0 011 1v16a1 1 0 01-1 1H6zM12 14a3 3 0 100-6 3 3 0 000 6zM9 17h6" },
  driving_licence: ID_CARD,
  idp: ID_CARD,
  voter_id: ID_CARD,
  id_other: ID_CARD,
  bill: CATEGORY_STYLE.bill,
  health_cover: COVER,
  motor_cover: COVER,
  life_cover: CATEGORY_STYLE.investment,
  mutual_fund: CATEGORY_STYLE.investment,
  fixed_deposit: CATEGORY_STYLE.investment,
  recurring_deposit: CATEGORY_STYLE.investment,
  ppf: CATEGORY_STYLE.investment,
  nps: CATEGORY_STYLE.investment,
  invest_other: CATEGORY_STYLE.investment,
  home_cover: COVER,
  travel_cover: COVER,
  other_cover: COVER,
  rc: CATEGORY_STYLE.car,
  puc: CATEGORY_STYLE.car,
  fitness: CATEGORY_STYLE.car,
  road_tax: CATEGORY_STYLE.car,
  permit: CATEGORY_STYLE.car,
  car_other: CATEGORY_STYLE.car,
  misc: PANEL_STYLE.Other,
});

// Gradient pairs for people; picked by name so each person keeps their colours everywhere.
const PEOPLE: [string, string][] = [
  ["#5e5ce6", "#8e8cff"],
  ["#ff9500", "#ffbd4a"],
  ["#30b0c7", "#6fd6e6"],
  ["#ff2d55", "#ff7a93"],
  ["#34c759", "#7ee29a"],
  ["#af52de", "#d78cf5"],
  ["#007aff", "#5ab0ff"],
  ["#a2845e", "#cdb08a"],
  ["#00b5ad", "#5fe0d8"],
  ["#e5a000", "#ffd257"],
];

export function personColors(name: string) {
  let h = 2166136261;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return PEOPLE[h % PEOPLE.length]!;
}
