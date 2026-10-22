export type CADivision = "gs" | "static";

export interface CACategory {
  id: string;
  label: string;
  division: CADivision;
}

export const CA_CATEGORIES: CACategory[] = [
  { id: "polity", label: "Polity & Governance", division: "gs" },
  { id: "economy", label: "Economy & Banking", division: "gs" },
  { id: "international", label: "International Relations", division: "gs" },
  { id: "history_culture", label: "History, Art & Culture", division: "gs" },
  { id: "geography_environment", label: "Geography & Environment", division: "gs" },
  { id: "science_tech", label: "Science & Technology", division: "gs" },
  { id: "defence_security", label: "Defence & Security", division: "gs" },
  { id: "schemes_policies", label: "Government Schemes & Policies", division: "gs" },
  { id: "appointments", label: "Appointments & Resignations", division: "static" },
  { id: "awards", label: "Awards & Honours", division: "static" },
  { id: "sports", label: "Sports", division: "static" },
  { id: "books", label: "Books & Authors", division: "static" },
  { id: "days", label: "Important Days & Themes", division: "static" },
  { id: "summits_orgs", label: "Summits, Conferences & Organisations", division: "static" },
  { id: "reports_indices", label: "Reports & Indices", division: "static" },
  { id: "places_misc", label: "Places, Persons & Miscellaneous", division: "static" },
];

export const CA_CATEGORY_IDS = CA_CATEGORIES.map((c) => c.id);
export const CA_FALLBACK_CATEGORY = "places_misc";

export const CA_DIVISION_LABELS: Record<CADivision, string> = {
  gs: "GS Topics",
  static: "Static GK",
};

export function categoryById(id: string): CACategory {
  return (
    CA_CATEGORIES.find((c) => c.id === id) ??
    CA_CATEGORIES.find((c) => c.id === CA_FALLBACK_CATEGORY)!
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Today's calendar date in India (YYYY-MM-DD), regardless of server timezone. */
export function istDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}

export function dateLabel(date: string, withWeekday = true): string {
  const d = new Date(`${date}T00:00:00Z`);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
  return withWeekday ? `${WEEKDAYS[d.getUTCDay()]}, ${base}` : base;
}

export function shortDayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

const TOPIC_CATEGORY_RULES: Array<[RegExp, string]> = [
  [/appointment|resignation/i, "appointments"],
  [/award|honour/i, "awards"],
  [/sport/i, "sports"],
  [/book|author/i, "books"],
  [/important days|themes/i, "days"],
  [/summit|conference/i, "summits_orgs"],
  [/report|indices|index/i, "reports_indices"],
  [/defence/i, "defence_security"],
  [/space|science/i, "science_tech"],
  [/economic/i, "economy"],
  [/environment|climate/i, "geography_environment"],
  [/scheme|initiative/i, "schemes_policies"],
  [/government decision/i, "polity"],
  [/international/i, "international"],
];

export function isCurrentAffairsSectionName(name?: string): boolean {
  return !!name && /^current affairs$/i.test(name.trim());
}

/** Link to today's digest, filtered to the matching category when the topic maps to one. */
export function currentAffairsLinkForTopic(topicName: string): string {
  const rule = TOPIC_CATEGORY_RULES.find(([re]) => re.test(topicName));
  return rule ? `/current-affairs?category=${rule[1]}` : "/current-affairs";
}
