export type Sex = "male" | "female" | null;

type Range = { low?: number; high?: number };

export type Marker = {
  key: string;
  name: string;
  short?: string;
  panel: Panel;
  unit: string;
  range?: Range | { male: Range; female: Range };
  // Months until a retest is due: [when last result was normal, when it was flagged]
  recheck?: [number, number];
  maleOnly?: boolean;
};

export const PANELS = [
  "Diabetes",
  "Heart & Lipids",
  "Thyroid",
  "Hormones",
  "Vitamins & Minerals",
  "Kidney",
  "Liver",
  "Blood Count",
  "Inflammation",
  "Vitals",
] as const;
export type Panel = (typeof PANELS)[number];

// Adult reference ranges in the units most Indian labs report. A range printed on
// the actual report always wins over these defaults.
export const MARKERS: Marker[] = [
  { key: "hba1c", name: "HbA1c", panel: "Diabetes", unit: "%", range: { low: 4, high: 5.6 }, recheck: [12, 3] },
  { key: "glucose_fasting", name: "Fasting Glucose", short: "Fasting", panel: "Diabetes", unit: "mg/dL", range: { low: 70, high: 99 }, recheck: [12, 3] },
  { key: "glucose_pp", name: "Post-meal Glucose", short: "PP", panel: "Diabetes", unit: "mg/dL", range: { low: 70, high: 140 } },
  { key: "glucose_random", name: "Random Glucose", short: "Random", panel: "Diabetes", unit: "mg/dL", range: { low: 70, high: 140 } },
  { key: "insulin_fasting", name: "Fasting Insulin", panel: "Diabetes", unit: "µIU/mL", range: { low: 2, high: 25 } },
  { key: "glucose_lunch", name: "Sugar (lunch)", short: "Lunch sugar", panel: "Diabetes", unit: "mg/dL" },
  { key: "glucose_dinner", name: "Sugar (dinner)", short: "Dinner sugar", panel: "Diabetes", unit: "mg/dL" },
  { key: "insulin_lunch", name: "Insulin (lunch)", short: "Lunch insulin", panel: "Diabetes", unit: "units" },
  { key: "insulin_dinner", name: "Insulin (dinner)", short: "Dinner insulin", panel: "Diabetes", unit: "units" },

  { key: "cholesterol_total", name: "Total Cholesterol", panel: "Heart & Lipids", unit: "mg/dL", range: { high: 200 }, recheck: [12, 6] },
  { key: "ldl", name: "LDL Cholesterol", short: "LDL", panel: "Heart & Lipids", unit: "mg/dL", range: { high: 100 }, recheck: [12, 6] },
  { key: "hdl", name: "HDL Cholesterol", short: "HDL", panel: "Heart & Lipids", unit: "mg/dL", range: { male: { low: 40 }, female: { low: 50 } } },
  { key: "triglycerides", name: "Triglycerides", panel: "Heart & Lipids", unit: "mg/dL", range: { high: 150 }, recheck: [12, 6] },
  { key: "vldl", name: "VLDL", panel: "Heart & Lipids", unit: "mg/dL", range: { high: 30 } },
  { key: "non_hdl", name: "Non-HDL Cholesterol", panel: "Heart & Lipids", unit: "mg/dL", range: { high: 130 } },
  { key: "lipoprotein_a", name: "Lipoprotein(a)", panel: "Heart & Lipids", unit: "mg/dL", range: { high: 30 } },

  { key: "tsh", name: "TSH", panel: "Thyroid", unit: "µIU/mL", range: { low: 0.4, high: 4.5 }, recheck: [12, 3] },
  { key: "t3_total", name: "Total T3", panel: "Thyroid", unit: "ng/dL", range: { low: 80, high: 200 } },
  { key: "t4_total", name: "Total T4", panel: "Thyroid", unit: "µg/dL", range: { low: 5, high: 12 } },
  { key: "ft3", name: "Free T3", panel: "Thyroid", unit: "pg/mL", range: { low: 2.3, high: 4.2 } },
  { key: "ft4", name: "Free T4", panel: "Thyroid", unit: "ng/dL", range: { low: 0.8, high: 1.8 } },

  { key: "testosterone_total", name: "Total Testosterone", short: "Testosterone", panel: "Hormones", unit: "ng/dL", range: { male: { low: 264, high: 916 }, female: { low: 15, high: 70 } }, recheck: [12, 3] },
  { key: "testosterone_free", name: "Free Testosterone", panel: "Hormones", unit: "pg/mL", range: { male: { low: 47, high: 244 }, female: { low: 0.5, high: 8.5 } } },
  { key: "shbg", name: "SHBG", panel: "Hormones", unit: "nmol/L", range: { male: { low: 10, high: 57 }, female: { low: 18, high: 144 } } },
  { key: "estradiol", name: "Estradiol", panel: "Hormones", unit: "pg/mL" },
  { key: "prolactin", name: "Prolactin", panel: "Hormones", unit: "ng/mL", range: { male: { low: 4, high: 15 }, female: { low: 4.8, high: 23.3 } } },
  { key: "cortisol", name: "Cortisol (morning)", panel: "Hormones", unit: "µg/dL", range: { low: 6, high: 23 } },
  { key: "psa", name: "PSA", panel: "Hormones", unit: "ng/mL", range: { high: 4 }, recheck: [12, 6], maleOnly: true },

  { key: "vitamin_d", name: "Vitamin D (25-OH)", short: "Vitamin D", panel: "Vitamins & Minerals", unit: "ng/mL", range: { low: 30, high: 100 }, recheck: [12, 3] },
  { key: "vitamin_b12", name: "Vitamin B12", short: "B12", panel: "Vitamins & Minerals", unit: "pg/mL", range: { low: 200, high: 900 }, recheck: [12, 3] },
  { key: "folate", name: "Folate", panel: "Vitamins & Minerals", unit: "ng/mL", range: { low: 3, high: 17 } },
  { key: "iron", name: "Serum Iron", panel: "Vitamins & Minerals", unit: "µg/dL", range: { low: 60, high: 170 } },
  { key: "ferritin", name: "Ferritin", panel: "Vitamins & Minerals", unit: "ng/mL", range: { male: { low: 30, high: 400 }, female: { low: 15, high: 150 } }, recheck: [12, 3] },
  { key: "calcium", name: "Calcium", panel: "Vitamins & Minerals", unit: "mg/dL", range: { low: 8.5, high: 10.5 } },
  { key: "magnesium", name: "Magnesium", panel: "Vitamins & Minerals", unit: "mg/dL", range: { low: 1.7, high: 2.4 } },

  { key: "creatinine", name: "Creatinine", panel: "Kidney", unit: "mg/dL", range: { male: { low: 0.7, high: 1.3 }, female: { low: 0.6, high: 1.1 } }, recheck: [12, 3] },
  { key: "egfr", name: "eGFR", panel: "Kidney", unit: "mL/min/1.73m²", range: { low: 90 } },
  { key: "urea", name: "Blood Urea", panel: "Kidney", unit: "mg/dL", range: { low: 15, high: 40 } },
  { key: "bun", name: "BUN", panel: "Kidney", unit: "mg/dL", range: { low: 7, high: 20 } },
  { key: "uric_acid", name: "Uric Acid", panel: "Kidney", unit: "mg/dL", range: { male: { low: 3.4, high: 7 }, female: { low: 2.4, high: 6 } }, recheck: [12, 3] },
  { key: "sodium", name: "Sodium", panel: "Kidney", unit: "mmol/L", range: { low: 135, high: 145 } },
  { key: "potassium", name: "Potassium", panel: "Kidney", unit: "mmol/L", range: { low: 3.5, high: 5.1 } },
  { key: "urine_acr", name: "Urine Albumin/Creatinine", panel: "Kidney", unit: "mg/g", range: { high: 30 } },

  { key: "sgpt_alt", name: "SGPT (ALT)", short: "ALT", panel: "Liver", unit: "U/L", range: { high: 41 }, recheck: [12, 3] },
  { key: "sgot_ast", name: "SGOT (AST)", short: "AST", panel: "Liver", unit: "U/L", range: { high: 40 } },
  { key: "alp", name: "Alkaline Phosphatase", panel: "Liver", unit: "U/L", range: { low: 44, high: 147 } },
  { key: "ggt", name: "GGT", panel: "Liver", unit: "U/L", range: { high: 60 } },
  { key: "bilirubin_total", name: "Total Bilirubin", panel: "Liver", unit: "mg/dL", range: { low: 0.3, high: 1.2 } },
  { key: "albumin", name: "Albumin", panel: "Liver", unit: "g/dL", range: { low: 3.5, high: 5.2 } },
  { key: "protein_total", name: "Total Protein", panel: "Liver", unit: "g/dL", range: { low: 6.4, high: 8.3 } },

  { key: "hemoglobin", name: "Hemoglobin", short: "Hb", panel: "Blood Count", unit: "g/dL", range: { male: { low: 13, high: 17 }, female: { low: 12, high: 15 } }, recheck: [12, 3] },
  { key: "wbc", name: "WBC Count", panel: "Blood Count", unit: "×10³/µL", range: { low: 4, high: 11 } },
  { key: "rbc", name: "RBC Count", panel: "Blood Count", unit: "×10⁶/µL", range: { male: { low: 4.5, high: 5.9 }, female: { low: 4, high: 5.2 } } },
  { key: "platelets", name: "Platelets", panel: "Blood Count", unit: "×10³/µL", range: { low: 150, high: 410 } },
  { key: "hematocrit", name: "Hematocrit (PCV)", panel: "Blood Count", unit: "%", range: { male: { low: 40, high: 50 }, female: { low: 36, high: 46 } } },
  { key: "mcv", name: "MCV", panel: "Blood Count", unit: "fL", range: { low: 80, high: 100 } },
  { key: "esr", name: "ESR", panel: "Blood Count", unit: "mm/hr", range: { male: { high: 15 }, female: { high: 20 } } },

  { key: "hs_crp", name: "hs-CRP", panel: "Inflammation", unit: "mg/L", range: { high: 3 } },
  { key: "crp", name: "CRP", panel: "Inflammation", unit: "mg/L", range: { high: 6 } },
  { key: "homocysteine", name: "Homocysteine", panel: "Inflammation", unit: "µmol/L", range: { high: 15 } },

  { key: "bp_systolic", name: "BP Up", short: "Up", panel: "Vitals", unit: "mmHg", range: { low: 90, high: 129 } },
  { key: "bp_diastolic", name: "BP Down", short: "Down", panel: "Vitals", unit: "mmHg", range: { low: 60, high: 84 } },
  { key: "heart_rate", name: "Resting Heart Rate", short: "Pulse", panel: "Vitals", unit: "bpm", range: { low: 50, high: 100 } },
  { key: "weight", name: "Weight", panel: "Vitals", unit: "kg" },
  { key: "spo2", name: "SpO₂", panel: "Vitals", unit: "%", range: { low: 95, high: 100 } },
  { key: "temperature", name: "Temperature", short: "Temp", panel: "Vitals", unit: "°F", range: { low: 97, high: 99.5 } },
];

const BY_KEY = new Map(MARKERS.map((m) => [m.key, m]));
export const marker = (key: string) => BY_KEY.get(key);

export function defaultRange(m: Marker | undefined, sex: Sex): Range | undefined {
  if (!m?.range) return undefined;
  if ("male" in m.range) return sex ? m.range[sex] : undefined;
  return m.range;
}

export function flagFor(value: number | null, low: number | null | undefined, high: number | null | undefined) {
  if (value == null || (low == null && high == null)) return null;
  if (low != null && value < low) return "low" as const;
  if (high != null && value > high) return "high" as const;
  return "normal" as const;
}

// Markers a sensible adult baseline checkup should include.
export const BASELINE = ["hba1c", "ldl", "tsh", "vitamin_d", "vitamin_b12", "hemoglobin", "creatinine", "sgpt_alt"];
