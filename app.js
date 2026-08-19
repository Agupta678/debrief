import { extractDocument } from "./lib/heuristic.mjs";

/* ============================================================
   Theme toggle
   ============================================================ */
const root = document.documentElement;
const toggleBtn = document.getElementById("themeToggle");
const storedTheme = localStorage.getItem("debrief-theme");
if (storedTheme === "dark" || storedTheme === "light") {
  root.setAttribute("data-theme", storedTheme);
}
function currentIsDark() {
  const attr = root.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    const next = currentIsDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("debrief-theme", next);
  });
}

/* ============================================================
   Render helpers
   ============================================================ */
const STATUS_LABEL = { blocking: "Blocking", pending: "Pending", open: "Open question", done: "Done" };

function renderItem(item, delayMs) {
  const card = document.createElement("div");
  card.className = "action-card";
  if (delayMs != null) card.style.animationDelay = delayMs + "ms";

  const top = document.createElement("div");
  top.className = "action-card-top";

  const ownerChip = document.createElement("span");
  ownerChip.className = "chip chip-owner";
  ownerChip.textContent = item.owner;

  const pill = document.createElement("span");
  pill.className = "status-pill status-" + item.status;
  pill.textContent = STATUS_LABEL[item.status] || item.status;

  top.appendChild(ownerChip);
  top.appendChild(pill);

  const task = document.createElement("p");
  task.className = "action-task";
  task.textContent = item.task;

  card.appendChild(top);
  card.appendChild(task);

  if (item.due) {
    const meta = document.createElement("div");
    meta.className = "action-meta";
    const dueChip = document.createElement("span");
    dueChip.className = "chip";
    dueChip.textContent = "due " + item.due;
    meta.appendChild(dueChip);
    card.appendChild(meta);
  }
  return card;
}

function renderEmpty(container, message) {
  container.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "empty-state";
  const p = document.createElement("p");
  p.textContent = message;
  empty.appendChild(p);
  container.appendChild(empty);
}

function renderListSection(title, items) {
  const section = document.createElement("section");
  section.className = "doc-section";
  const h4 = document.createElement("h4");
  h4.textContent = title;
  section.appendChild(h4);
  const ul = document.createElement("ul");
  ul.className = "doc-list";
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    ul.appendChild(li);
  });
  section.appendChild(ul);
  return section;
}

function renderDocument(doc, container) {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "doc";

  const title = document.createElement("h3");
  title.className = "doc-title";
  title.textContent = doc.title;
  wrap.appendChild(title);

  const summary = document.createElement("p");
  summary.className = "doc-summary";
  summary.textContent = doc.summary;
  wrap.appendChild(summary);

  if (doc.decisions.length) {
    wrap.appendChild(renderListSection("Decisions", doc.decisions));
  }

  const actionSection = document.createElement("section");
  actionSection.className = "doc-section";
  const actionHeading = document.createElement("h4");
  actionHeading.textContent = "Action items";
  actionSection.appendChild(actionHeading);
  if (doc.actionItems.length) {
    const cards = document.createElement("div");
    cards.className = "doc-action-cards";
    doc.actionItems.forEach((item, i) => cards.appendChild(renderItem(item, i * 70)));
    actionSection.appendChild(cards);
  } else {
    const none = document.createElement("p");
    none.className = "doc-empty-note";
    none.textContent = "No clear commitments found.";
    actionSection.appendChild(none);
  }
  wrap.appendChild(actionSection);

  if (doc.openQuestions.length) {
    wrap.appendChild(renderListSection("Open questions", doc.openQuestions));
  }

  container.appendChild(wrap);
}

function toMarkdown(doc) {
  const lines = [`# ${doc.title}`, ""];
  lines.push(`_Generated ${new Date().toLocaleDateString()}_`, "");
  lines.push("## Summary", "", doc.summary, "");
  if (doc.decisions.length) {
    lines.push("## Decisions", "");
    doc.decisions.forEach((d) => lines.push(`- ${d}`));
    lines.push("");
  }
  lines.push("## Action Items", "");
  if (doc.actionItems.length) {
    doc.actionItems.forEach((item) => {
      const due = item.due ? ` (due ${item.due})` : "";
      lines.push(`- **${item.owner}** — ${item.task}${due} [${item.status}]`);
    });
  } else {
    lines.push("_None found._");
  }
  lines.push("");
  if (doc.openQuestions.length) {
    lines.push("## Open Questions", "");
    doc.openQuestions.forEach((q) => lines.push(`- ${q}`));
    lines.push("");
  }
  return lines.join("\n");
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "debrief"
  );
}

/* ============================================================
   Hero demo (fixed example, animates in on load)
   ============================================================ */
const HERO_RAW =
  "sync w/ eng + design on Q3 roadmap\n" +
  "- Sarah is going to have wireframes by Friday, blocking the eng estimate\n" +
  "- team agreed export feature is priority now, 3 customers churned, escalate ASAP\n" +
  "- Mike still hasn't heard back from legal on the compliance doc, chase again\n" +
  "- team hasn't committed to a beta launch date yet, needs to confirm by next Monday";

const heroRawEl = document.getElementById("demoRawText");
const heroItemsEl = document.getElementById("demoItems");

if (heroRawEl) heroRawEl.textContent = HERO_RAW;

if (heroItemsEl) {
  const heroDoc = extractDocument(HERO_RAW, { actionLimit: 4 });
  heroDoc.actionItems.forEach((item, i) => {
    heroItemsEl.appendChild(renderItem(item, i * 260 + 200));
  });
}

/* ============================================================
   Try-it tool
   ============================================================ */
const notesInput = document.getElementById("notesInput");
const extractBtn = document.getElementById("extractBtn");
const sampleBtn = document.getElementById("sampleBtn");
const resultsArea = document.getElementById("resultsArea");
const engineBadge = document.getElementById("engineBadge");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const toolHint = document.getElementById("toolHint");

const SAMPLE_NOTES =
  "Weekly product sync — July 28\n\n" +
  "- Priya will draft the onboarding flow spec by Thursday\n" +
  "- everyone agreed we need to fix the checkout bug, it's blocking the launch, escalate ASAP\n" +
  "- Dan to follow up with the vendor on pricing, no date committed yet\n" +
  "- reminder that the design review is Monday\n" +
  "- Priya should also share the updated metrics dashboard by end of day\n" +
  "- team needs to review the Q3 budget doc, still hasn't been scheduled";

let currentDocument = null;

function countLines(text) {
  return text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
}

function updateHint() {
  if (!notesInput || !toolHint) return;
  const n = countLines(notesInput.value);
  toolHint.textContent = n + (n === 1 ? " line parsed" : " lines parsed");
}

function setShareActionsEnabled(enabled) {
  if (copyBtn) copyBtn.disabled = !enabled;
  if (downloadBtn) downloadBtn.disabled = !enabled;
}

function setEngineBadge(engine) {
  if (!engineBadge) return;
  if (!engine) {
    engineBadge.textContent = "";
    engineBadge.className = "engine-badge";
    return;
  }
  engineBadge.textContent = engine === "claude" ? "Generated by Claude" : "Generated locally";
  engineBadge.className = "engine-badge engine-badge-" + engine;
}

function setLoading(isLoading) {
  if (!extractBtn) return;
  extractBtn.disabled = isLoading;
  extractBtn.textContent = isLoading ? "Extracting…" : "Extract action items";
}

async function runExtraction() {
  if (!notesInput || !resultsArea) return;
  const raw = notesInput.value.trim();
  if (!raw) {
    renderEmpty(resultsArea, "Paste some notes first — even two or three lines works.");
    setEngineBadge(null);
    setShareActionsEnabled(false);
    currentDocument = null;
    return;
  }

  setLoading(true);
  let doc;
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: raw }),
    });
    if (!res.ok) throw new Error("extract endpoint returned " + res.status);
    doc = await res.json();
  } catch (err) {
    doc = extractDocument(raw);
  } finally {
    setLoading(false);
  }

  currentDocument = doc;
  renderDocument(doc, resultsArea);
  setEngineBadge(doc.engine);
  setShareActionsEnabled(true);
}

if (notesInput) {
  notesInput.addEventListener("input", updateHint);
  updateHint();
}
if (extractBtn) extractBtn.addEventListener("click", runExtraction);
if (sampleBtn) {
  sampleBtn.addEventListener("click", () => {
    notesInput.value = SAMPLE_NOTES;
    updateHint();
    runExtraction();
  });
}
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    if (!currentDocument) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(currentDocument));
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied";
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  });
}
if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    if (!currentDocument) return;
    const blob = new Blob([toMarkdown(currentDocument)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(currentDocument.title)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
