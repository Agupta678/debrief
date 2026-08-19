import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DebriefDocumentSchema, SYSTEM_PROMPT, buildUserPrompt } from "../lib/document-schema.mjs";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
const MAX_NOTES_LENGTH = 20000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const notes = body && typeof body.notes === "string" ? body.notes.trim() : "";
  if (!notes) {
    return res.status(400).json({ error: "Missing 'notes' string in request body" });
  }
  if (notes.length > MAX_NOTES_LENGTH) {
    return res.status(400).json({ error: `'notes' exceeds ${MAX_NOTES_LENGTH} characters` });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "Extraction is not configured (missing ANTHROPIC_API_KEY)" });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(notes) }],
      output_config: { format: zodOutputFormat(DebriefDocumentSchema) },
    });

    if (!response.parsed_output) {
      return res.status(502).json({ error: "Extraction failed to produce a valid document" });
    }

    return res.status(200).json({ ...response.parsed_output, engine: "claude" });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Debrief extract: authentication error", error.message);
      return res.status(500).json({ error: "Extraction service misconfigured" });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Rate limited, try again shortly" });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Debrief extract: API error", error.status, error.message);
      return res.status(502).json({ error: "Extraction service error" });
    }
    console.error("Debrief extract: unexpected error", error);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
