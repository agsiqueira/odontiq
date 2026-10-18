/** Permanent live regression: production server + real Navigator + durable DB.
 * Refuses non-loopback app/database targets. Each run keeps first attempts and
 * intentionally injected failures; no automatic rerun or deletion of evidence.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { reviewCase03Live } from "./reviewCase03Live.mjs";
const base = process.env.CASE3_BASE_URL ?? "http://127.0.0.1:3009";
const output = process.env.CASE3_OUTPUT ?? "validation/case3-production-followup/live-results.json";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)
  || new URL(process.env.DATABASE_URL).hostname !== "127.0.0.1"
  || !process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw Error("Local database/app and test Clerk instance required");
if (fs.existsSync(output)) throw Error("Output already exists: preserve/reconcile it before another run");
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const users = await clerk.users.getUserList({ emailAddress: [process.env.PHASE_T_TEST_EMAIL] });
if (users.data.length !== 1) throw Error("Expected exactly one existing synthetic test user");
const session = await clerk.sessions.createSession({ userId: users.data[0].id });
const db = new PrismaClient();
const consent = "You have an abscess. I recommend an I&D to drain the infection and relieve the pressure. Is that okay?";
const confirm = "Yes, you still need to see your dentist promptly.";
const opening = ["What brings you in today?", "Does your daughter have Medicaid and a toothache?", "Do you already see a dentist regularly?"];
const tests = [
  ...Array.from({ length: 5 }, (_, i) => ({ id: `original-fresh-${i + 1}`, opening, answer: confirm, why: true })),
  { id: "confirmation-paraphrase", answer: "Yes, please see your dentist as soon as possible.", why: true },
  { id: "temporary-only", answer: "Yes, see your dentist promptly. Drainage only relieves the pressure.", why: true },
  { id: "definitive-only", answer: "Yes, see your dentist promptly. You still need a root canal or extraction.", why: false },
  { id: "definitive-without-temporary", consent: "I recommend an I&D for the abscess. Is that okay?", answer: "Yes, see your dentist promptly. You still need a root canal or extraction.", why: true },
  { id: "complete-explanation", answer: "Yes, see your dentist promptly. Drainage only relieves the pressure; you still need root canal treatment or extraction to treat the tooth.", why: false },
  { id: "complete-paraphrase", answer: "Yes, see your dentist soon. The I&D is temporary. Definitive dental treatment is still required.", why: false },
  { id: "extraction-paraphrase", answer: "Yes, see your dentist promptly. The drainage only eases pressure. Your dentist still has to take that tooth out.", why: false },
  { id: "extraction-equivalent", answer: "Yes, see your dentist promptly. The I&D is not a cure. The affected tooth must come out.", why: false },
  { id: "source-treatment-equivalent", answer: "Yes, see your dentist promptly. This drainage is a temporary measure. Your dentist must eliminate the source of the infection by treating the tooth.", why: false },
  { id: "hypothetical-not-explained", answer: "Yes, see your dentist promptly. If things get worse, you might need the tooth taken out.", why: true },
  { id: "negated-not-explained", answer: "Yes, see your dentist promptly. You do not need a root canal or extraction.", why: true },
  { id: "question-not-explained", answer: "Yes, see your dentist promptly. Have you ever had a root canal before?", why: true },
  { id: "prior-explanation-current-confirmation", answer: confirm, why: false,
    consent: "You have an abscess. I recommend an I&D to drain the infection and relieve the pressure. This is temporary; you still need root canal treatment or extraction. Is that okay?" },
  { id: "split-explanations-before-confirmation", beforeConsent: ["Draining the infection only relieves pressure; it does not provide definitive tooth treatment."], consent: "I recommend an I&D for the abscess. Your dentist still needs to remove the affected tooth. Is that okay?", answer: confirm, why: false },
  { id: "failed-classifier-does-not-consume", answer: confirm, why: true, fault: "classifier" },
  { id: "failed-explanation-does-not-consume", answer: confirm, why: true, fault: "explanation" },
  { id: "failed-generation-does-not-consume", answer: confirm, why: true, fault: "generation" },
];
const report = { started: new Date().toISOString(), base, applicationCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  applicationSourceDiff: execFileSync("git", ["diff", "--name-only", "HEAD", "--", "src", "prisma", "next.config.ts"], { encoding: "utf8" }).trim(),
  buildId: fs.readFileSync(".next/BUILD_ID", "utf8").trim(),
  configuration: { node: process.version, mode: "production", model: process.env.NAVIGATOR_MODEL,
    explanationModel: process.env.NAVIGATOR_EXPLANATION_MODEL ?? "gpt-oss-120b",
    navigator: "https://api.ai.it.ufl.edu via loopback capture/fault proxy", database: "isolated loopback PostgreSQL", auth: "existing Clerk test user, backend test session" }, tests: [] };
const save = () => { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2)); };
async function api(url, body) {
  const token = await clerk.sessions.getToken(session.id);
  const response = await fetch(base + url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token.jwt}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = { nonJson: text.slice(0, 500) }; }
  return { status: response.status, body: data };
}
try {
  save();
  for (const scenario of tests.filter(test => !process.env.CASE3_IDS || process.env.CASE3_IDS.split(",").includes(test.id))) {
    const row = { id: scenario.id, expectedWhy: scenario.why, attempts: [], outcome: "REVIEW" };
    report.tests.push(row); save();
    const started = await api("/api/encounters/start", { caseId: "case-03", fresh: true });
    if (started.status !== 200) { row.setupError = started; row.outcome = "ERROR"; save(); continue; }
    row.encounterId = started.body.id;
    const conversation = [];
    async function turn(question, label) {
      const id = randomUUID(), requestId = `case3-live-${scenario.id}-${id}`;
      const attempt = { label, question, context: structuredClone(conversation), requestId, sentAt: new Date().toISOString() };
      row.attempts.push(attempt); save(); // Request intent persisted BEFORE network.
      const result = await api("/api/conversation", { encounterId: row.encounterId, caseId: "case-03", requestId,
        studentMessageId: id, conversation, coveredChecklistItems: [], message: question });
      Object.assign(attempt, result);
      attempt.persistedState = await db.patientQuestionState.findUnique({ where: { encounterId: row.encounterId } });
      attempt.emissions = await db.patientQuestionEmission.findMany({ where: { encounterId: row.encounterId } });
      attempt.persistedTurn = await db.conversationTurn.findUnique({ where: { encounterId_requestId: { encounterId: row.encounterId, requestId } } });
      if (result.status === 200 && result.body.success) {
        conversation.push({ id, role: "student", text: question, timestamp: new Date().toISOString() },
          { id: result.body.patientMessageId, role: "patient", text: result.body.response, timestamp: new Date().toISOString() });
      }
      save(); return attempt;
    }
    for (const question of scenario.opening ?? []) await turn(question, "opening-context");
    for (const question of scenario.beforeConsent ?? []) await turn(question, "pre-consent-explanation");
    await turn(scenario.consent ?? consent, "consent");
    if (scenario.fault) {
      await fetch("http://127.0.0.1:3011/__fault", { method: "POST", body: JSON.stringify({ kind: scenario.fault, remaining: 2, status: 503 }) });
      await turn(scenario.answer, "intentional-failed-attempt");
      // Always disarm before the single planned retry; every attempt remains recorded.
      await fetch("http://127.0.0.1:3011/__fault", { method: "POST", body: JSON.stringify(null) });
    }
    await turn(scenario.answer, scenario.fault ? "planned-retry" : "follow-up-confirmation");
    await turn(confirm, "repeated-confirmation");
    await turn("Thank you for explaining that.", "closure");
    row.finalEmissions = await db.patientQuestionEmission.findMany({ where: { encounterId: row.encounterId } });
    save(); console.log(`${row.id}: recorded ${row.attempts.length} responses for review`);
  }
  report.finished = new Date().toISOString(); save();
  const adjudication = reviewCase03Live(report);
  fs.writeFileSync(output.replace(/\.json$/, "-adjudication.json"), JSON.stringify(adjudication, null, 2));
  process.exitCode = adjudication.rows.some(row => row.outcome !== "PASS") ? 1 : 0;
} finally { await db.$disconnect(); await clerk.sessions.revokeSession(session.id); }
