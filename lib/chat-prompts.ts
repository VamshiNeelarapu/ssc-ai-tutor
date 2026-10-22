export const SAMPLE_PROMPTS = [
  "Teach me percentage with shortcut tricks for SSC CGL",
  "Explain syllogism with Venn diagram method",
  "Common subject-verb agreement errors in SSC English",
  "Explain the Indian Constitution's fundamental rights",
];

export function topicStudyPrompt(topicName: string, chapterName?: string, subjectName?: string): string {
  const where = [chapterName && `chapter: ${chapterName}`, subjectName && `subject: ${subjectName}`]
    .filter(Boolean)
    .join(", ");
  return `I want to study "${topicName}"${where ? ` (${where})` : ""} for SSC CGL. Explain it in detail covering the core concept, key facts or formulas, shortcut methods, common traps, and the kinds of questions SSC asks from it.`;
}
