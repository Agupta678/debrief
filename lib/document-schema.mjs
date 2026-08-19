import { z } from "zod";

/**
 * The "Stakeholder Update" document — the one default template Debrief
 * generates in this phase (see PRD.md §5 and §7 for the deferred
 * template-picker). Both the Claude endpoint and the local heuristic
 * fallback produce this exact shape.
 */
export const DebriefDocumentSchema = z.object({
  title: z.string().describe("Short, specific title, e.g. 'Q3 Roadmap Sync — Aug 18'"),
  summary: z
    .string()
    .describe("2-4 plain-language sentences a stakeholder would read first"),
  decisions: z
    .array(z.string())
    .describe("Decisions that were actually made, not just discussed"),
  actionItems: z
    .array(
      z.object({
        task: z.string(),
        owner: z.string().describe("Name, or 'Unassigned' if unclear"),
        due: z
          .string()
          .nullable()
          .describe("Free-text due signal, e.g. 'Friday', 'next Monday', or null"),
        status: z.enum(["blocking", "pending", "open"]),
      }),
    )
    .describe("Concrete commitments with an owner and/or a due signal"),
  openQuestions: z
    .array(z.string())
    .describe("Unresolved items, risks, or things still waiting on someone"),
});

export const SYSTEM_PROMPT = `You turn raw, messy meeting notes into one clean "Stakeholder Update" document — the kind someone who wasn't in the room should be able to read in under a minute and understand what happened and what's next.

Rules:
- "decisions" are things the group actually committed to, not topics merely discussed.
- "actionItems" are concrete commitments with an identifiable (or explicitly unassigned) owner. Do not invent an owner that isn't implied by the notes — use "Unassigned" instead.
- Keep "due" as the due signal exactly as implied by the notes (e.g. "Friday", "next Monday", "EOD"); use null if no due signal exists. Do not resolve relative dates to a calendar date.
- status: "blocking" for urgent/blocking/escalation language, "pending" for anything with a clear due signal, "open" for anything without one.
- "openQuestions" are unresolved items, risks, or things still waiting on someone — not the same as action items with an owner.
- Keep the summary factual and specific to these notes, not generic filler.
- If the notes are too sparse for a section, return an empty array rather than fabricating content.`;

export function buildUserPrompt(notes) {
  return `Raw meeting notes:\n\n${notes}`;
}
