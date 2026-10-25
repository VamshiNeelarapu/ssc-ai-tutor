import mongoose from "mongoose";
import SyllabusNode from "@/models/SyllabusNode";
import StudyNote, { IStudyNote } from "@/models/StudyNote";

export interface ChapterStatus {
  sectionId: string;
  sectionName: string;
  subjectId: string | null;
  subjectName?: string;
  topics: Array<{ id: string; name: string; noteCount: number }>;
  totalTopics: number;
  coveredTopics: number;
  ready: boolean;
  existingNoteId: string | null;
  // Topic notes in syllabus order, grouped by topic (only topics that have notes)
  notesByTopic: Array<{ topicId: string; topic: string; notes: IStudyNote[] }>;
}

// Notes that count toward a chapter: ordinary topic notes only
const TOPIC_NOTE_KINDS = { $nin: ["current_affairs_month", "chapter_summary"] };

export async function getChapterStatus(
  userId: string,
  sectionId: string
): Promise<ChapterStatus | null> {
  if (!mongoose.isValidObjectId(sectionId)) return null;

  const section = await SyllabusNode.findById(sectionId);
  if (!section || section.nodeType !== "section") return null;

  const [topicNodes, subject] = await Promise.all([
    SyllabusNode.find({ parentId: sectionId, nodeType: "topic" }).sort({ order: 1, name: 1 }),
    section.parentId ? SyllabusNode.findById(section.parentId) : null,
  ]);
  const topicIds = topicNodes.map((t) => t._id.toString());

  const [notes, existing] = await Promise.all([
    StudyNote.find({ userId, topicId: { $in: topicIds }, kind: TOPIC_NOTE_KINDS }).sort({
      createdAt: 1,
    }),
    StudyNote.findOne({ userId, kind: "chapter_summary", sectionId }).select("_id"),
  ]);

  const byTopic = new Map<string, IStudyNote[]>();
  for (const n of notes) {
    if (!n.topicId) continue;
    byTopic.set(n.topicId, [...(byTopic.get(n.topicId) ?? []), n]);
  }

  const topics = topicNodes.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    noteCount: byTopic.get(t._id.toString())?.length ?? 0,
  }));
  const coveredTopics = topics.filter((t) => t.noteCount > 0).length;

  return {
    sectionId,
    sectionName: section.name,
    subjectId: section.parentId ?? null,
    subjectName: subject?.name,
    topics,
    totalTopics: topics.length,
    coveredTopics,
    ready: topics.length > 0 && coveredTopics === topics.length,
    existingNoteId: existing ? existing._id.toString() : null,
    notesByTopic: topicNodes
      .filter((t) => byTopic.has(t._id.toString()))
      .map((t) => ({
        topicId: t._id.toString(),
        topic: t.name,
        notes: byTopic.get(t._id.toString()) ?? [],
      })),
  };
}

export interface TopicStatus {
  topicId: string;
  topicName: string;
  sectionId: string;
  sectionName: string;
  subjectId: string | null;
  subjectName?: string;
  noteCount: number;
  notes: IStudyNote[];
}

/** The topic's own notes, with the chapter and subject it belongs to. */
export async function getTopicStatus(userId: string, topicId: string): Promise<TopicStatus | null> {
  if (!mongoose.isValidObjectId(topicId)) return null;

  const topic = await SyllabusNode.findById(topicId);
  if (!topic || topic.nodeType !== "topic" || !topic.parentId) return null;

  const section = await SyllabusNode.findById(topic.parentId);
  if (!section) return null;
  const subject = section.parentId ? await SyllabusNode.findById(section.parentId) : null;

  const notes = await StudyNote.find({ userId, topicId, kind: TOPIC_NOTE_KINDS }).sort({ createdAt: 1 });

  return {
    topicId,
    topicName: topic.name,
    sectionId: section._id.toString(),
    sectionName: section.name,
    subjectId: section.parentId ?? null,
    subjectName: subject?.name,
    noteCount: notes.length,
    notes,
  };
}
