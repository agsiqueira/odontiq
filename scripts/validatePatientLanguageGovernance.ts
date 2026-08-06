import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CASE_DATA } from "../src/data/cases";
import {
  LANGUAGE_POLICY_BEHAVIOR_INTENT_ID,
  PATIENT_LANGUAGE_POLICY,
  detectPatientLanguageIntent,
  governedPatientLanguageResponse,
  isClearlyNonEnglishText,
  languagePolicyRepetitionLevel,
  nonEnglishOutputDetection,
} from "../src/lib/patientLanguagePolicy";
import { buildPatientAudioPlan } from "../src/lib/patientAudioPlan";
import { classifyAmaraRepetitionSignal } from "../src/lib/patientBehavior";

let assertions = 0;
const equal = (actual: unknown, expected: unknown, message: string) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const check = (condition: unknown, message: string) => { assertions += 1; assert.ok(condition, message); };

equal(PATIENT_LANGUAGE_POLICY.responseLanguage, "English", "policy is English-only");
check(PATIENT_LANGUAGE_POLICY.rules.includes("reject-clearly-non-english-patient-output-before-persistence"), "final output gate is governed");

const observed = required("speak portuguese");
equal(observed.intent, "switch-language", "exact lowercase regression enters the early policy branch");
equal(observed.requestedLanguage, "Portuguese", "exact lowercase regression identifies Portuguese");
equal(response(observed, 0, false), "I speak English. Ask me in English.", "observed regression returns exact English response");

const languages = [
  "Spanish", "Portuguese", "French", "German", "Italian", "Japanese", "Korean", "Mandarin",
  "Arabic", "Hindi", "Russian", "Turkish", "Polish", "Greek", "Hebrew", "Vietnamese", "Thai", "Swahili",
];
for (const language of languages) {
  const detection = required(`speak ${language}`);
  equal(detection.intent, "switch-language", `${language} uses generic switch grammar`);
  check(response(detection, 0, false) === "I speak English. Ask me in English.", `${language} refusal remains English`);
}
equal(required("speak Esperanto").requestedLanguage, "Esperanto", "unlisted language names use generic command-target fallback");
equal(required("answer Zulu").intent, "switch-language", "generic target fallback is not limited to the canonical set");
equal(detectPatientLanguageIntent("Speak clearly."), undefined, "speech-manner request is not mistaken for a language switch");

for (const message of [
  "answer French", "answer in Turkish", "respond in German", "continue in Spanish", "switch to Japanese",
  "Please speak Arabic.", "Could you answer Hindi?", "Can we continue in Korean?", "use another language",
  "speak anything but English", "speak anything other than English", "stop speaking English", "do not use English",
  "translate into Polish", "translate that for me", "say it in another language",
]) {
  check(Boolean(required(message)), `${message} is intercepted`);
}

equal(required("Do you speak English?").intent, "english-ability", "English ability is separate");
equal(response(required("Do you speak English?"), 0, true), "Yeah. I speak English.", "Amara English ability response");
equal(response(required("Can you understand English?"), 0, false), "Yes. I speak English.", "neutral English ability response");
equal(detectPatientLanguageIntent("Please answer in English."), undefined, "English target does not trigger refusal");

const foreignClinicalQuestions = [
  "¿Cuánto tiempo lleva con dolor?",
  "Há quanto tempo está com dor?",
  "Depuis combien de temps avez-vous mal?",
  "Wie lange haben Sie Schmerzen?",
  "Jak długo mnie boli ten ząb?",
  "どのくらい歯が痛いですか？",
  "치아가 얼마나 오래 아팠습니까?",
  "منذ متى وأنت تعاني من الألم؟",
  "आपके दांत में कितने समय से दर्द है?",
  "คุณปวดฟันมานานแค่ไหนแล้ว",
];
for (const message of foreignClinicalQuestions) {
  const detection = required(message);
  equal(detection.intent, "non-english-message", "foreign clinical content is blocked");
  equal(response(detection, 0, false), "I only speak English. Ask me in English.", "foreign clinical content discloses no facts");
}

for (const output of [
  "Desculpe, nao falo portugues.",
  "Lo siento, no hablo español.",
  "Je suis désolé, je ne parle pas français.",
  "Es tut mir leid, ich spreche kein Deutsch.",
  "申し訳ありませんが、日本語は話せません。",
  "죄송하지만 한국어를 못합니다.",
  "آسف، أنا لا أتحدث العربية.",
  "माफ़ कीजिए, मैं हिंदी नहीं बोलता।",
]) {
  check(isClearlyNonEnglishText(output), `backstop rejects: ${output}`);
}
for (const output of [
  "I speak English. Ask me in English.",
  "The pain started four days ago.",
  "Dr. García treated me last year.",
  "I take metformin and lisinopril.",
]) {
  equal(isClearlyNonEnglishText(output), false, `English output remains unchanged: ${output}`);
}
equal(response(nonEnglishOutputDetection(), 0, false), "I only speak English. Ask me in English.", "backstop fallback is exact and fact-free");

equal(LANGUAGE_POLICY_BEHAVIOR_INTENT_ID, "language-policy:english-only", "all refusals share one persisted scope");
for (const [count, expected] of [[0, "No. English. Ask me what you need."], [1, "I said English. I’m tired—ask me what you need."], [2, "English. Just ask me what you need."]] as const) {
  const language = ["Portuguese", "Japanese", "Arabic"][count];
  equal(response(required(`speak ${language}`), count, true), expected, `cross-language attempt ${count + 1} uses shared progression`);
}
equal(languagePolicyRepetitionLevel(99), "later-repeat", "Amara escalation is capped");
check(classifyAmaraRepetitionSignal("How long has it hurt?").intentId !== LANGUAGE_POLICY_BEHAVIOR_INTENT_ID, "clinical repetition scope remains separate");
check(!classifyAmaraRepetitionSignal("speak Portuguese").countsTowardHistory, "language request does not enter clinical repetition");

for (const message of [
  "Do you take metformin?", "Was your dentist Dr. García?", "The chart says ‘dolor’; does that mean pain?",
  "I speak Portuguese, but I’ll ask you in English.", "Did someone translate your discharge instructions?",
  "The note says ‘sí’, but where is your pain?", "Does café make the pain worse?", "How long have you had this dolor?",
]) {
  equal(detectPatientLanguageIntent(message), undefined, `false positive avoided: ${message}`);
}
equal(detectPatientLanguageIntent("How long has the pain lasted?"), undefined, "normal English resumes clinical processing");

for (const caseData of CASE_DATA) {
  const detection = required("answer in Japanese");
  const exact = response(detection, 0, caseData.metadata.id === "case-01");
  check(/English/.test(exact), `${caseData.metadata.id} is covered by the universal policy`);
  check(!/four days|eight out of ten|metformin|lisinopril|penicillin|swelling/i.test(exact), `${caseData.metadata.id} leaks no facts`);
}

const exact = response(observed, 0, false);
equal(buildPatientAudioPlan("case-02", exact, 4).filter((segment) => segment.type === "speech").map((segment) => segment.text).join(""), exact, "audioPlan reconstructs exact persisted response");

const route = await readFile("src/app/api/conversation/route.ts", "utf8");
const languageIndex = route.indexOf("const languageDetection = detectPatientLanguageIntent");
check(languageIndex > route.indexOf("findTurn("), "idempotency precedes language handling");
check(languageIndex < route.indexOf("const sanitizedConversation"), "early guard bypasses disclosure");
check(languageIndex < route.indexOf("provider = getAIProvider()"), "early guard bypasses provider");
check(languageIndex < route.indexOf("patientImmediateResponse({"), "early guard bypasses immediate generation");
check(languageIndex < route.indexOf("classifyPatientQuestionTrigger({"), "early guard bypasses patient questions");
check(/baseResponse: governedResponse/.test(route), "early governed response is persisted exactly");
check(route.indexOf("isClearlyNonEnglishText(generatedResponseText)") < route.indexOf("patientQuestionService.finalizeTurn({", route.indexOf("generatedResponseText")), "output gate precedes normal persistence");
check(/!outputRejectedByLanguageBackstop && shouldClassifyPatientQuestions/.test(route), "rejected output cannot trigger patient questions");
check(/providerName: outputRejectedByLanguageBackstop[\s\S]*governed-language-policy-backstop/.test(route), "rejected provider output is never attributed as accepted provider text");

const encounter = await readFile("src/components/EncounterExperience.tsx", "utf8");
check(/text: data\.response/.test(encounter), "display receives persisted response");
check(/speechPlayback\.speak\(patientConversationMessage\.text/.test(encounter), "TTS receives displayed response");
const service = await readFile("src/lib/persistence/services/patientQuestionService.ts", "utf8");
check(/responseText = questionText[\s\S]*input\.baseResponse\.trim\(\)/.test(service), "persistence retains exact base response without a patient question");

console.log(`Patient language governance validation passed: ${assertions} focused assertions.`);

function required(message: string) {
  const detection = detectPatientLanguageIntent(message);
  assert.ok(detection, `expected language detection for: ${message}`);
  return detection;
}

function response(detection: ReturnType<typeof required>, priorCount: number, isAmara: boolean) {
  return governedPatientLanguageResponse({ detection, repetitionLevel: languagePolicyRepetitionLevel(priorCount), isAmara });
}
