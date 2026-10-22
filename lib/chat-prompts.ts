export const SAMPLE_PROMPTS = [
  "Teach me percentage with shortcut tricks for SSC CGL",
  "Explain syllogism with Venn diagram method",
  "Common subject-verb agreement errors in SSC English",
  "Explain the Indian Constitution's fundamental rights",
];

export function topicStudyPrompt(topicName: string): string {
  return `I want to study "${topicName}" for SSC CGL. Explain it in detail covering the core concept, key facts or formulas, shortcut methods, common traps, and the kinds of questions SSC asks from it.`;
}
