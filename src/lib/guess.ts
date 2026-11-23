import type { Category } from "./data";

// Read a file's name for what it obviously is. Only clear words count; anything vague
// returns nothing and the section picked on the upload screen is used.
const RULES: { test: RegExp; category: Category; kind?: string }[] = [
  { test: /international driving|\bidp\b/, category: "id", kind: "idp" },
  { test: /(car|motor|vehicle|bike|two.?wheeler).*(insurance|policy)|(insurance|policy).*(car|motor|vehicle|bike)/, category: "car", kind: "motor_cover" },
  { test: /\brc\b|registration cert/, category: "car", kind: "rc" },
  { test: /\bpuc\b|pollution/, category: "car", kind: "puc" },
  { test: /fitness cert/, category: "car", kind: "fitness" },
  { test: /road tax/, category: "car", kind: "road_tax" },
  { test: /\bpermit\b/, category: "car", kind: "permit" },
  { test: /fastag|\bcar\b|vehicle/, category: "car", kind: "car_other" },
  { test: /\blic\b|life (insurance|cover|policy)|term (plan|insurance|policy)/, category: "investment", kind: "life_cover" },
  { test: /mutual fund|\bsip\b|folio|\belss\b/, category: "investment", kind: "mutual_fund" },
  { test: /fixed deposit|\bfd\b/, category: "investment", kind: "fixed_deposit" },
  { test: /recurring deposit|\brd\b/, category: "investment", kind: "recurring_deposit" },
  { test: /\bppf\b|public provident/, category: "investment", kind: "ppf" },
  { test: /\bnps\b|pension system/, category: "investment", kind: "nps" },
  { test: /insurance|policy|mediclaim/, category: "insurance" },
  { test: /prescription|\brx\b/, category: "health", kind: "prescription" },
  { test: /x ?ray|\bmri\b|ct scan|ultrasound|\busg\b|\becg\b|\becho\b|mammo/, category: "health", kind: "imaging" },
  { test: /discharge/, category: "health", kind: "discharge" },
  { test: /vaccin|immuni[sz]/, category: "health", kind: "vaccination" },
  { test: /blood|\bcbc\b|lipid|thyroid|hba1c|glucose|sugar|\blab\b|patholog|urine|vitamin|kft|lft|medical/, category: "health", kind: "lab_report" },
  { test: /aa?dh?aa?r/, category: "id", kind: "aadhaar" },
  { test: /\bpan\b/, category: "id", kind: "pan" },
  { test: /passport/, category: "id", kind: "passport" },
  { test: /licen[cs]e|\bdl\b/, category: "id", kind: "driving_licence" },
  { test: /voter|\bepic\b/, category: "id", kind: "voter_id" },
  { test: /birth cert|id card|\bid\b/, category: "id" },
  { test: /invoice|\bbill\b|receipt|warranty/, category: "bill", kind: "bill" },
];

const COVER: [RegExp, string][] = [
  [/health|mediclaim|medical/, "health_cover"],
  [/home|house|fire/, "home_cover"],
  [/travel/, "travel_cover"],
];

export function guessFromName(name: string): { category: Category; kind?: string } | null {
  const n = name.toLowerCase().replace(/[_.-]+/g, " ");
  const rule = RULES.find((r) => r.test.test(n));
  if (!rule) return null;
  if (rule.category === "insurance") return { category: "insurance", kind: COVER.find(([re]) => re.test(n))?.[1] };
  return { category: rule.category, kind: rule.kind };
}
