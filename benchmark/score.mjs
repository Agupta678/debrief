#!/usr/bin/env node
/**
 * Reproducible accuracy report for Debrief's extraction engines.
 * Always scores the local heuristic. Also scores the live Claude endpoint
 * when ANTHROPIC_API_KEY is set (costs real API usage — opt in).
 *
 * Usage: npm run benchmark
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { extractDocument } from "../lib/heuristic.mjs";
import { DebriefDocumentSchema, SYSTEM_PROMPT, buildUserPrompt } from "../lib/document-schema.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  await readFile(path.join(here, "fixtures.json"), "utf8"),
);

function scoreDocument(doc, expected) {
  const ownersFound = doc.actionItems.map((item) => item.owner);
  const checks = {
    actionItems: doc.actionItems.length >= expected.minActionItems,
    owners: expected.owners.every((o) => ownersFound.includes(o)),
    decisions: doc.decisions.length >= expected.minDecisions,
    openQuestions: doc.openQuestions.length >= expected.minOpenQuestions,
  };
  const pass = Object.values(checks).every(Boolean);
  return { pass, checks };
}

function report(label, results) {
  console.log(`\n=== ${label} ===`);
  let passed = 0;
  for (const { name, pass, checks } of results) {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
    if (!pass) {
      for (const [field, ok] of Object.entries(checks)) {
        if (!ok) console.log(`      ✗ ${field}`);
      }
    }
    if (pass) passed += 1;
  }
  console.log(`\n${label}: ${passed}/${results.length} fixtures passed`);
}

// --- Heuristic engine (always runs, no API key required) ---
const heuristicResults = fixtures.map((fixture) => {
  const doc = extractDocument(fixture.notes);
  const { pass, checks } = scoreDocument(doc, fixture.expected);
  return { name: fixture.name, pass, checks };
});
report("Local heuristic engine", heuristicResults);

// --- Claude endpoint (only if an API key is configured) ---
if (process.env.ANTHROPIC_API_KEY) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
  const client = new Anthropic();
  const model = process.env.CLAUDE_MODEL || "claude-opus-5";

  const claudeResults = [];
  for (const fixture of fixtures) {
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(fixture.notes) }],
      output_config: { format: zodOutputFormat(DebriefDocumentSchema) },
    });
    if (!response.parsed_output) {
      claudeResults.push({ name: fixture.name, pass: false, checks: { parsed: false } });
      continue;
    }
    const { pass, checks } = scoreDocument(response.parsed_output, fixture.expected);
    claudeResults.push({ name: fixture.name, pass, checks });
  }
  report(`Claude endpoint (${model})`, claudeResults);
} else {
  console.log(
    "\n=== Claude endpoint ===\nSkipped — set ANTHROPIC_API_KEY to include it in this report.",
  );
}
