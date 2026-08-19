/**
 * Local, deterministic fallback engine. Produces the same document shape as
 * the Claude endpoint (see lib/document-schema.mjs) so the rendering layer
 * never needs to know which one ran. Runs both in the browser (imported
 * directly by app.js) and in Node (imported by benchmark/score.mjs).
 */

const ACTION_PATTERN = /\b(will|is going to|are going to|needs?\s+to|has to|have to|should|must|going to|follow(?:s|ing)? up|reach(?:es|ing)? out|send(?:s|ing)?|schedule[sd]?|escalate[sd]?|chase[sd]?|update[sd]?|finalize[sd]?|confirm(?:s|ed)?|review(?:s|ed)?|prepare[sd]?|share[sd]?|draft(?:s|ed)?|fix(?:es|ed)?|deploy(?:s|ed)?|investigate[sd]?|to\s*-?\s*do)\b/i;

const DECISION_PATTERN = /\b(agreed|decided|decision was|we('| a)?ll go with|going with|confirmed that|finalized|sign(?:ed)? off|approved|settled on)\b/i;

const TEAM_WORDS = /\b(everyone|team|we|all of us|group)\b/i;
const URGENT = /\b(asap|urgent|critical|blocking|escalate[sd]?|churn(?:ed)?|immediately|right away)\b/i;
const OPEN_SIGNAL = /\b(tbd|no date|not? committed|revisit|haven'?t|hasn'?t|still waiting|no update|unclear|unresolved)\b/i;
const DUE_PATTERN = /\b(by\s+(?:end of day|[a-z]+(?:\s+[a-z]+)?)|asap|eod|end of day|tomorrow|today|next\s+[a-z]+|this\s+week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

const OWNER_STOPLIST = {
  The: 1, This: 1, It: 1, They: 1, We: 1, Also: 1, After: 1, During: 1,
  Before: 1, Once: 1, There: 1, Here: 1, Note: 1, Reminder: 1, Discussed: 1,
  Agenda: 1, Next: 1, Then: 1, So: 1, But: 1, And: 1, If: 1, When: 1,
  Attendees: 1, Topic: 1,
};

function splitCandidates(raw) {
  const lines = raw.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    let parts;
    try {
      parts = line.split(/(?<=[.;])\s+(?=[A-Z])/);
    } catch {
      parts = [line];
    }
    for (const part of parts) {
      const cleaned = part.replace(/^[\s\-*•\d.)]+/, "").trim();
      if (cleaned.length > 8) out.push(cleaned);
    }
  }
  return out;
}

function extractOwner(line) {
  const colonMatch = line.match(/^([A-Z][a-zA-Z]+)\s*:/);
  if (colonMatch && !OWNER_STOPLIST[colonMatch[1]]) return colonMatch[1];
  const leadMatch = line.match(/^([A-Z][a-zA-Z]+)\b(?!')/);
  if (leadMatch && !OWNER_STOPLIST[leadMatch[1]]) return leadMatch[1];
  if (TEAM_WORDS.test(line)) return "Team";
  return null;
}

function extractDue(line) {
  const m = line.match(DUE_PATTERN);
  if (!m) return null;
  return m[0].replace(/^by\s+/i, "").trim();
}

function classifyStatus(line) {
  if (URGENT.test(line)) return "blocking";
  if (OPEN_SIGNAL.test(line)) return "open";
  if (DUE_PATTERN.test(line)) return "pending";
  return "open";
}

function toSentenceCase(line) {
  const trimmed = line.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function deriveTitle(raw) {
  const firstLine = raw.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!firstLine) return "Meeting Debrief";
  const cleaned = firstLine.replace(/^[\s\-*•\d.)]+/, "").trim();
  if (
    cleaned.length > 0 &&
    cleaned.length <= 70 &&
    !ACTION_PATTERN.test(cleaned) &&
    !DECISION_PATTERN.test(cleaned)
  ) {
    return toSentenceCase(cleaned.replace(/[.:]+$/, ""));
  }
  return "Meeting Debrief";
}

function pluralize(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * @param {string} raw
 * @param {{ actionLimit?: number, listLimit?: number }} [opts]
 * @returns {{ title: string, summary: string, decisions: string[], actionItems: Array<{task:string, owner:string, due:string|null, status:string}>, openQuestions: string[], engine: "heuristic" }}
 */
export function extractDocument(raw, opts = {}) {
  const actionLimit = opts.actionLimit ?? 10;
  const listLimit = opts.listLimit ?? 6;

  const candidates = splitCandidates(raw);
  const actionItems = [];
  const decisions = [];
  const openQuestions = [];

  for (const line of candidates) {
    const isAction = ACTION_PATTERN.test(line);
    const isDecision = !isAction && DECISION_PATTERN.test(line);
    const isOpenQuestion =
      !isAction &&
      !isDecision &&
      (line.trim().endsWith("?") || OPEN_SIGNAL.test(line));

    if (isAction && actionItems.length < actionLimit) {
      const owner = extractOwner(line);
      const due = extractDue(line);
      const status = classifyStatus(line);
      let task = toSentenceCase(line);
      if (task.length > 140) task = task.slice(0, 137) + "…";
      actionItems.push({ task, owner: owner || "Unassigned", due, status });
    } else if (isDecision && decisions.length < listLimit) {
      let decision = toSentenceCase(line);
      if (decision.length > 160) decision = decision.slice(0, 157) + "…";
      decisions.push(decision);
    } else if (isOpenQuestion && openQuestions.length < listLimit) {
      let question = toSentenceCase(line);
      if (question.length > 160) question = question.slice(0, 157) + "…";
      openQuestions.push(question);
    }
  }

  const title = deriveTitle(raw);
  const summary = `${pluralize(actionItems.length, "action item")}, ${pluralize(
    decisions.length,
    "decision",
  )}, and ${pluralize(
    openQuestions.length,
    "open question",
  )} pulled from these notes by the local extraction engine.`;

  return { title, summary, decisions, actionItems, openQuestions, engine: "heuristic" };
}
