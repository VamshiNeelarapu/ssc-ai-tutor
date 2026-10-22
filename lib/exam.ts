export type ExamTag = "tier1" | "tier2" | "ckt";

export const EXAM_LABELS: Record<ExamTag, string> = {
  tier1: "Tier-I",
  tier2: "Tier-II",
  ckt: "CKT",
};

export const EXAM_BADGE_CLASSES: Record<ExamTag, string> = {
  tier1: "bg-blue-100 text-blue-700",
  tier2: "bg-indigo-100 text-indigo-700",
  ckt: "bg-teal-100 text-teal-700",
};

export function examLabel(tag: string): string {
  return EXAM_LABELS[tag as ExamTag] ?? tag;
}

export function examBadgeClass(tag: string): string {
  return EXAM_BADGE_CLASSES[tag as ExamTag] ?? "bg-gray-100 text-gray-700";
}
