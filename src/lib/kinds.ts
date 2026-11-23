export const KIND_LABEL: Record<string, string> = {
  lab_report: "Lab report",
  prescription: "Prescription",
  imaging: "Imaging",
  discharge: "Discharge summary",
  consultation: "Consultation",
  vaccination: "Vaccination",
  other: "Document",
  aadhaar: "Aadhaar",
  pan: "PAN card",
  passport: "Passport",
  driving_licence: "Driving licence",
  idp: "International Driving Permit",
  voter_id: "Voter ID",
  id_other: "ID",
  bill: "Bill",
  health_cover: "Health insurance",
  motor_cover: "Vehicle insurance",
  life_cover: "Life insurance",
  home_cover: "Home insurance",
  travel_cover: "Travel insurance",
  other_cover: "Insurance",
  rc: "RC",
  puc: "PUC",
  fitness: "Fitness certificate",
  road_tax: "Road tax",
  permit: "Permit",
  car_other: "Car paper",
  mutual_fund: "Mutual fund / SIP",
  fixed_deposit: "Fixed deposit",
  recurring_deposit: "Recurring deposit",
  ppf: "PPF",
  nps: "NPS",
  invest_other: "Investment",
  misc: "Document",
};

export const CATEGORY_LABEL: Record<string, string> = { health: "Health", id: "IDs", bill: "Bills", insurance: "Insurance", car: "Cars", investment: "Investments", other: "Others" };

// Which kinds belong to which vault section, in picker order.
export const CATEGORY_KINDS: Record<string, string[]> = {
  health: ["lab_report", "prescription", "imaging", "discharge", "consultation", "vaccination", "other"],
  id: ["aadhaar", "pan", "passport", "driving_licence", "idp", "voter_id", "id_other"],
  insurance: ["health_cover", "home_cover", "travel_cover", "other_cover"],
  car: ["rc", "motor_cover", "puc", "fitness", "road_tax", "permit", "car_other"],
  investment: ["life_cover", "mutual_fund", "fixed_deposit", "recurring_deposit", "ppf", "nps", "invest_other"],
  other: ["misc"],
};

// How often an investment is paid; months between payments (0 = paid once).
export const FREQUENCY: Record<string, { label: string; months: number }> = {
  monthly: { label: "Monthly", months: 1 },
  quarterly: { label: "Every 3 months", months: 3 },
  half_yearly: { label: "Every 6 months", months: 6 },
  yearly: { label: "Yearly", months: 12 },
  once: { label: "One time", months: 0 },
};

