// Turns notes pasted from a web page / chat into clean markdown, without rewriting a word:
// it only repairs the paste (broken tables, image links, escaped characters), then lifts out the
// practice questions and, when there is one, the revision sheet.

export interface ParsedQuestion {
  question: string;
  options: string[];
  // Present when the pasted content carries the answer ("Answer: B") and an explanation
  answerIndex?: number;
  explanation?: string;
}

export interface ParsedNotes {
  title: string;
  fullMarkdown: string;
  revision: { heading: string; markdown: string } | null;
  questions: ParsedQuestion[];
  // The lines that introduced the question block (for example "Attempt these before checking...")
  practiceNote: string;
  stats: { headings: number; tables: number; imagesRemoved: number };
}

const MAX_QUESTIONS = 100;

const isBlank = (l: string) => l.trim() === "";
const isTableRow = (l: string) => /^\s*\|/.test(l);
const isListItem = (l: string) => /^\s*([*+-]|\d+[.)])\s+/.test(l);
const headingMatch = (l: string) => /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);

// Interface text copied along with a quiz from a web page
const QUIZ_UI_LINE = [
  /^\d+\s*\/\s*\d+\s+answered$/i,
  /^choose one answer/i,
  /^submit\b/i,
  /^\d+[- ]question test$/i,
];

/** Repairs a paste. Does not change any wording. */
export function cleanPaste(raw: string): { lines: string[]; imagesRemoved: number } {
  let text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  // Image links point at the web page the text came from, so they would only break
  let imagesRemoved = 0;
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, () => {
    imagesRemoved++;
    return "";
  });

  // Markdown escapes such as "1\." or "Palaeolithic\-age" copied as plain text
  text = text.replace(/\\([.\-_*#()[\]!+>~])/g, "$1");

  const out: string[] = [];
  for (const line of text.split("\n")) {
    // A table whose rows were joined onto one line: "| a | b || --- | --- || c | d |"
    if (/^\s*\|/.test(line) && line.includes("||")) {
      out.push(...line.split(/\s*\|\|\s*/).map((part, i, all) => (i === 0 ? part : `| ${part.replace(/^\|\s*/, "")}`.replace(/\s*\|?\s*$/, i === all.length - 1 ? "" : " |"))));
      continue;
    }
    out.push(line.replace(/\s+$/, ""));
  }

  // Normalise each table row so it starts and ends with a pipe
  const rows = out.map((l) => {
    if (!isTableRow(l)) return l;
    let r = l.trim();
    if (!r.startsWith("|")) r = `| ${r}`;
    if (!r.endsWith("|")) r = `${r} |`;
    return r;
  });
  return { lines: rows, imagesRemoved };
}

/** Headings numbered "1." / "1.1" get a level from their depth, so the outline is clean. */
function normaliseHeadings(lines: string[]): { lines: string[]; headings: number } {
  let headings = 0;
  let seenNumbered = false;
  let seenAny = false;
  const out = lines.map((l) => {
    const m = headingMatch(l);
    if (!m) return l;
    headings++;
    const title = m[2].trim();
    const num = /^(\d+(?:\.\d+)*)\.?\s+\S/.exec(title);
    let level: number;
    if (num) {
      seenNumbered = true;
      level = Math.min(num[1].split(".").length + 1, 5);
    } else if (!seenAny && !seenNumbered) {
      level = 1; // the document title
    } else {
      level = Math.min(Math.max(m[1].length, 3), 6);
    }
    seenAny = true;
    return `${"#".repeat(level)} ${title}`;
  });
  return { lines: out, headings };
}

const levelOf = (l: string) => (headingMatch(l)?.[1].length ?? 99);

// A question line: "1. text", "2) text", "Q1. text", "Q2) text", "Q 3: text", "Question 4 - text"
const QUESTION_START = /^\s*(?:Q(?:uestion)?\.?\s*(\d{1,3})(?:\s*[.):-]\s*|\s+)|(\d{1,3})[.)]\s+)(\S.*)$/i;

/** Finds numbered questions followed by lettered options. */
function findQuestions(lines: string[]): { questions: ParsedQuestion[]; start: number; end: number } | null {
  const questions: ParsedQuestion[] = [];
  let start = -1;
  let end = -1;
  let expected = 1;
  let i = 0;
  while (i < lines.length) {
    const q = QUESTION_START.exec(lines[i]);
    if (!q || Number(q[1] ?? q[2]) !== expected) {
      i++;
      continue;
    }
    // Question text may run over a few lines before the first option
    let text = q[3].trim();
    let j = i + 1;
    while (j < lines.length && j <= i + 3 && !isBlank(lines[j]) && !/^\s*[A-Ea-e][.)]\s+\S/.test(lines[j])) {
      text += " " + lines[j].trim();
      j++;
    }
    const options: string[] = [];
    let letter = 0;
    while (j < lines.length) {
      const o = /^\s*([A-Ea-e])[.)]\s+(\S.*)$/.exec(lines[j]);
      if (!o || o[1].toUpperCase().charCodeAt(0) - 65 !== letter) break;
      options.push(o[2].trim());
      letter++;
      j++;
    }
    if (options.length < 2) {
      i++;
      continue;
    }

    // "Answer: B" and "Explanation: ..." lines that come right after the options
    let answerIndex: number | undefined;
    let explanation = "";
    while (j < lines.length && !isBlank(lines[j]) && !QUESTION_START.test(lines[j]) && !headingMatch(lines[j])) {
      const a = /^\s*(?:correct\s+)?(?:answer|ans)\s*(?:is)?\s*[:.)-]?\s*\(?([A-Ea-e])\)?(?:[.)]|\s|$)\s*(.*)$/i.exec(lines[j]);
      const e = /^\s*(?:explanation|solution|reason)\s*[:.-]\s*(.*)$/i.exec(lines[j]);
      if (a && answerIndex === undefined) {
        answerIndex = a[1].toUpperCase().charCodeAt(0) - 65;
        if (a[2]) explanation += (explanation ? " " : "") + a[2].trim();
      } else if (e) explanation += (explanation ? " " : "") + e[1].trim();
      else if (explanation) explanation += " " + lines[j].trim();
      else break;
      j++;
    }
    if (answerIndex !== undefined && answerIndex >= options.length) answerIndex = undefined;

    if (start === -1) start = i;
    end = j - 1;
    questions.push({
      question: text,
      options,
      ...(answerIndex !== undefined ? { answerIndex } : {}),
      ...(explanation ? { explanation } : {}),
    });
    expected++;
    i = j;
    if (questions.length >= MAX_QUESTIONS) break;
  }
  return questions.length >= 2 ? { questions, start, end } : null;
}

/** Lines that stay separate lines when rendered, as in the pasted source. */
function formatPlainLines(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const next = lines[i + 1];
    const plain = (s?: string) => s !== undefined && !isBlank(s) && !headingMatch(s) && !isTableRow(s) && !isListItem(s);
    out.push(plain(l) && plain(next) ? `${l}  ` : l);
  }
  return out;
}

const tidy = (lines: string[]) => {
  const out: string[] = [];
  let prevTable = false;
  for (const l of lines) {
    const table = isTableRow(l);
    // GFM tables need a blank line around them
    if (table && !prevTable && out.length && !isBlank(out[out.length - 1])) out.push("");
    if (!table && prevTable && !isBlank(l)) out.push("");
    prevTable = table;
    if (isBlank(l) && out.length && isBlank(out[out.length - 1])) continue;
    out.push(l);
  }
  return out.join("\n").trim();
};

export function parseNotesDocument(raw: string, options: { extractRevision?: boolean } = {}): ParsedNotes {
  const extractRevision = options.extractRevision !== false;
  const cleaned = cleanPaste(raw);
  const normalised = normaliseHeadings(cleaned.lines);
  let lines = normalised.lines;

  // 1. practice questions: lift out the whole section they sit in
  let questions: ParsedQuestion[] = [];
  let practiceNote = "";
  const found = findQuestions(lines);
  if (found) {
    questions = found.questions;

    // The section: the heading above the questions (and a parent heading just above that, such as
    // "15. Practice MCQs" over "30-question test"), up to the next heading of the same or higher rank.
    const headingText = (i: number) => headingMatch(lines[i])?.[2] ?? "";
    const QUIZ_HEADING = /practice|mcq|question|quiz|exercise|self[- ]check/i;
    const plainLinesBetween = (a: number, b: number) => {
      const between = lines.slice(a + 1, b).filter((l) => !isBlank(l));
      return between.length <= 4 && between.every((l) => !isListItem(l) && !isTableRow(l) && !headingMatch(l));
    };
    let from = found.start;
    let h = -1;
    for (let i = found.start - 1; i >= 0; i--) {
      if (headingMatch(lines[i])) {
        h = i;
        break;
      }
    }
    if (h !== -1 && (QUIZ_HEADING.test(headingText(h)) || lines.slice(h + 1, found.start).every(isBlank))) {
      from = h;
      // a parent heading just above, about the same quiz
      for (let i = h - 1; i >= 0; i--) {
        if (!headingMatch(lines[i])) continue;
        if (QUIZ_HEADING.test(headingText(i)) && levelOf(lines[i]) < levelOf(lines[from]) && plainLinesBetween(i, from)) {
          from = i;
        }
        break;
      }
    }
    let to = lines.length;
    const rank = from === found.start ? 99 : levelOf(lines[from]);
    for (let i = found.end + 1; i < lines.length; i++) {
      if (headingMatch(lines[i]) && levelOf(lines[i]) <= rank) {
        to = i;
        break;
      }
    }

    // A key written under the questions, or in its own "Answer key" section further down
    const needKey = () => questions.some((q) => q.answerIndex === undefined);
    const applyKey = (text: string) => {
      const key = parseAnswerKey(text, questions.length);
      if (Object.keys(key).length < Math.ceil(questions.length / 2)) return false;
      questions.forEach((q, idx) => {
        if (q.answerIndex === undefined && key[idx + 1] !== undefined && key[idx + 1] < q.options.length) {
          q.answerIndex = key[idx + 1];
        }
      });
      return true;
    };
    if (needKey()) {
      const tail = lines.slice(found.end + 1, to);
      if (tail.some((l) => /answer/i.test(l))) applyKey(tail.join("\n"));
    }
    if (needKey()) {
      const k = lines.findIndex((l, idx) => idx >= to && headingMatch(l) && /answer/i.test(headingMatch(l)![2]));
      if (k !== -1) {
        let kEnd = lines.length;
        for (let i = k + 1; i < lines.length; i++) {
          if (headingMatch(lines[i]) && levelOf(lines[i]) <= levelOf(lines[k])) {
            kEnd = i;
            break;
          }
        }
        if (applyKey(lines.slice(k + 1, kEnd).join("\n"))) {
          lines = [...lines.slice(0, k), ...lines.slice(kEnd)];
        }
      }
    }

    practiceNote = lines
      .slice(from, to)
      .filter((l, idx) => {
        const abs = from + idx;
        if (abs >= found.start && abs <= found.end) return false;
        if (isBlank(l) || headingMatch(l)) return false;
        return !QUIZ_UI_LINE.some((re) => re.test(l.trim()));
      })
      .map((l) => l.trim())
      .join(" ");

    lines = [...lines.slice(0, from), "", ...lines.slice(to)];
  }

  // 2. a revision sheet written inside the notes
  let revision: ParsedNotes["revision"] = null;
  if (extractRevision) {
    const idx = lines.findIndex((l) => headingMatch(l) && /revision/i.test(headingMatch(l)![2]));
    if (idx !== -1) {
      const rank = levelOf(lines[idx]);
      let end = lines.length;
      for (let i = idx + 1; i < lines.length; i++) {
        if (headingMatch(lines[i]) && levelOf(lines[i]) <= rank) {
          end = i;
          break;
        }
      }
      const body = lines.slice(idx + 1, end);
      if (body.join("\n").trim().length >= 150) {
        revision = {
          heading: headingMatch(lines[idx])![2].replace(/^\d+(\.\d+)*\.?\s+/, ""),
          markdown: tidy(formatPlainLines(body)),
        };
        lines = [...lines.slice(0, idx), ...lines.slice(end)];
      }
    }
  }

  const fullMarkdown = tidy(formatPlainLines(lines));
  const tables = (fullMarkdown.match(/^\|\s*-{3,}/gm) || []).length;
  const titleLine = lines.find((l) => headingMatch(l) && levelOf(l) === 1) ?? lines.find((l) => !isBlank(l)) ?? "Untitled notes";
  const title = (headingMatch(titleLine)?.[2] ?? titleLine).trim().slice(0, 200);

  return {
    title,
    fullMarkdown,
    revision,
    questions,
    practiceNote,
    stats: { headings: normalised.headings, tables, imagesRemoved: cleaned.imagesRemoved },
  };
}

/** "1-B, 2. C, 3) d" -> { 1: 1, 2: 2, 3: 3 }. Keys are question numbers, values the option index. */
export function parseAnswerKey(text: string, questionCount: number): Record<number, number> {
  const key: Record<number, number> = {};
  const re = /(?:^|[\s,;(])(?:Q\.?\s*)?(\d{1,3})\s*[-.):=–]?\s*\(?([A-Ea-e])\)?(?=[\s,;.)]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    if (n >= 1 && n <= questionCount && key[n] === undefined) key[n] = m[2].toUpperCase().charCodeAt(0) - 65;
  }
  return key;
}

// ── Replacing parts of an existing note ────────────────────────────────────────────────────────

export interface StoredQuestion {
  question: string;
  options: string[];
  correctOptionIndex?: number;
  explanation?: string;
  answerSource: "pasted" | "ai" | "none";
}

export interface ExistingContent {
  markdown?: string;
  quickRevisionMarkdown?: string;
  practiceNote?: string;
  practiceQuestions?: StoredQuestion[];
}

export interface ReplaceOptions {
  full: boolean;
  revision: boolean;
  mcq: boolean;
  // For practice questions: swap them all, or add the new ones after the existing ones
  mcqMode: "replace" | "add";
  // Answers for the NEW questions, numbered 1, 2, 3 ... as in the pasted text
  answerKey?: string;
}

export type ReplacePlan = { ok: true; content: ExistingContent; lines: string[] } | { ok: false; error: string };

const MAX_TOTAL_QUESTIONS = 200;
const normText = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Works out what a note looks like after replacing the chosen parts with a new paste.
 * Parts that are not chosen are returned exactly as they were.
 */
export function planReplacement(existing: ExistingContent, text: string, options: ReplaceOptions): ReplacePlan {
  if (!options.full && !options.revision && !options.mcq) {
    return { ok: false, error: "Choose at least one part to replace." };
  }
  if (text.trim().length < 10) return { ok: false, error: "Paste the new text first." };

  const parsed = parseNotesDocument(text, { extractRevision: options.revision });
  const content: ExistingContent = {
    markdown: existing.markdown,
    quickRevisionMarkdown: existing.quickRevisionMarkdown,
    practiceNote: existing.practiceNote,
    practiceQuestions: existing.practiceQuestions,
  };
  const lines: string[] = [];

  if (options.full) {
    if (!parsed.fullMarkdown.trim()) return { ok: false, error: "Nothing is left of your text to use as the full notes." };
    content.markdown = parsed.fullMarkdown;
    const tables = parsed.stats.tables ? `, ${parsed.stats.tables} table${parsed.stats.tables === 1 ? "" : "s"}` : "";
    lines.push(`Full notes replaced (${parsed.stats.headings} headings${tables}).`);
  }

  if (options.revision) {
    // With several parts chosen the revision has to be a section of the text; on its own, the whole text is it
    const wholeTextIsRevision = !options.full && !options.mcq;
    const markdown = parsed.revision?.markdown ?? (wholeTextIsRevision ? parsed.fullMarkdown : "");
    if (!markdown.trim()) {
      return {
        ok: false,
        error:
          'No revision section was found in your text. Give it a heading that contains "revision", or choose only "Quick revision" so the whole text is used.',
      };
    }
    content.quickRevisionMarkdown = markdown;
    lines.push(
      parsed.revision
        ? `Quick revision replaced with the section "${parsed.revision.heading}".`
        : "Quick revision replaced with your whole text."
    );
  }

  if (options.mcq) {
    if (parsed.questions.length < 2) {
      return {
        ok: false,
        error: "No practice questions were found in your text. Number them 1., 2., ... with options A., B., C., D.",
      };
    }
    const key = options.answerKey ? parseAnswerKey(options.answerKey, parsed.questions.length) : {};
    const incoming: StoredQuestion[] = parsed.questions.map((q, i) => {
      const fromKey = key[i + 1];
      const idx = fromKey !== undefined && fromKey < q.options.length ? fromKey : q.answerIndex;
      return {
        question: q.question,
        options: q.options,
        ...(idx !== undefined ? { correctOptionIndex: idx } : {}),
        ...(q.explanation ? { explanation: q.explanation } : {}),
        answerSource: idx !== undefined ? ("pasted" as const) : ("none" as const),
      };
    });
    const before = existing.practiceQuestions ?? [];

    if (options.mcqMode === "replace") {
      // A question that is unchanged keeps the answer and explanation it already had
      const old = new Map(before.map((q) => [normText(q.question), q]));
      let kept = 0;
      const merged = incoming.slice(0, MAX_TOTAL_QUESTIONS).map((q) => {
        const prior = old.get(normText(q.question));
        if (!prior || q.correctOptionIndex !== undefined || prior.correctOptionIndex === undefined) return q;
        const rightText = normText(prior.options[prior.correctOptionIndex] ?? "");
        const at = q.options.findIndex((o) => normText(o) === rightText);
        if (at === -1) return q;
        kept++;
        return { ...q, correctOptionIndex: at, explanation: q.explanation ?? prior.explanation, answerSource: prior.answerSource };
      });
      content.practiceQuestions = merged;
      content.practiceNote = parsed.practiceNote || undefined;
      const answered = merged.filter((q) => q.correctOptionIndex !== undefined).length;
      const keptNote = kept ? ` (${kept} kept their earlier answer)` : "";
      lines.push(`Practice questions replaced: ${merged.length} questions, ${answered} with answers${keptNote}.`);
    } else {
      const have = new Set(before.map((q) => normText(q.question)));
      const fresh = incoming.filter((q) => !have.has(normText(q.question)));
      const skipped = incoming.length - fresh.length;
      const added = fresh.slice(0, Math.max(0, MAX_TOTAL_QUESTIONS - before.length));
      if (added.length === 0) {
        return { ok: false, error: "Every question in your text is already in the note, so nothing was added." };
      }
      content.practiceQuestions = [...before, ...added];
      if (!content.practiceNote && parsed.practiceNote) content.practiceNote = parsed.practiceNote;
      const answered = added.filter((q) => q.correctOptionIndex !== undefined).length;
      const skippedNote = skipped ? `; ${skipped} already there, skipped` : "";
      lines.push(
        `Added ${added.length} practice question${added.length === 1 ? "" : "s"} (${answered} with answers) after the existing ${before.length}${skippedNote}.`
      );
    }
  }

  if (!options.mcq && parsed.questions.length > 0) {
    lines.push(`${parsed.questions.length} practice questions in your text were not used.`);
  }
  return { ok: true, content, lines };
}
