// Isolated test repository; no database client or connection is used.
export const saved = { state: null, turns: [], emissions: [] };
export function reset(state) { Object.assign(saved, { state: structuredClone(state), turns: [], emissions: [] }); }
export const db = {
  conversationTurn: { findUnique: async ({ where }) => saved.turns.find(t => t.requestId === where.encounterId_requestId.requestId) },
  $transaction: async (callback) => {
    const draft = structuredClone(saved);
    const result = await callback({
      encounter: { findFirst: async () => ({ id: "encounter", caseId: "case-03" }) },
      conversationTurn: {
        findUnique: async ({ where }) => draft.turns.find(t => t.requestId === where.encounterId_requestId.requestId),
        create: async ({ data }) => { const turn = { id: String(draft.turns.length), ...data }; draft.turns.push(turn); return turn; },
      },
      patientQuestionState: {
        findUnique: async () => ({ state: draft.state }),
        upsert: async ({ update }) => { draft.state = update.state; },
      },
      patientQuestionEmission: {
        findUnique: async ({ where }) => draft.emissions.find(e => e.questionId === where.encounterId_questionId.questionId),
        create: async ({ data }) => { draft.emissions.push(data); return data; },
      },
    });
    Object.assign(saved, draft);
    return result;
  },
};
