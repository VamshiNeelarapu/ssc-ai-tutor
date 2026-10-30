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
  return `Explain "${topicName}"${where ? ` (${where})` : ""} for SSC CGL in simple words.`;
}

// Opens a fresh chat for a topic with its suggested first message ready to send
export function topicChatUrl(info: {
  topic: string;
  section?: string | null;
  subject?: string | null;
  topicId?: string | null;
}): string {
  const hint = encodeURIComponent(
    topicStudyPrompt(info.topic, info.section ?? undefined, info.subject ?? undefined)
  );
  const params = [
    `hint=${hint}`,
    `subject=${encodeURIComponent(info.subject || info.section || "")}`,
    `topic=${encodeURIComponent(info.topic)}`,
  ];
  if (info.topicId) params.push(`topicId=${encodeURIComponent(info.topicId)}`);
  return `/chat?${params.join("&")}`;
}
