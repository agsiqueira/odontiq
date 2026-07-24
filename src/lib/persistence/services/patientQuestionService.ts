import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/persistence/repositories/prisma";
import {
  applyPatientQuestionClassification,
} from "@/lib/patientQuestions/stateMachine";
import {
  createEmptyPatientQuestionState,
  type PatientQuestionClassification,
  type PatientQuestionState,
} from "@/lib/patientQuestions/types";

export type StoredConversationTurn = {
  requestId: string;
  patientMessageId: string;
  responseText: string;
  providerName: string;
  selectedQuestionId?: string;
  stateVersion: number;
};

export class PatientQuestionService {
  async loadContext(userId: string, encounterId: string, caseId: string) {
    const encounter = await db.encounter.findFirst({
      where: { id: encounterId, userId },
      include: { patientQuestionState: true },
    });
    if (!encounter) return { status: "not-found" as const };
    if (encounter.caseId !== caseId) return { status: "case-mismatch" as const };
    return {
      status: "ok" as const,
      state: parseState(encounter.patientQuestionState?.state),
    };
  }

  async findTurn(encounterId: string, requestId: string) {
    const turn = await db.conversationTurn.findUnique({
      where: { encounterId_requestId: { encounterId, requestId } },
    });
    return turn ? toStoredTurn(turn) : undefined;
  }

  async finalizeTurn(input: {
    userId: string;
    encounterId: string;
    caseId: string;
    requestId: string;
    studentMessageId: string;
    patientMessageId: string;
    baseResponse: string;
    providerName: string;
    classification?: PatientQuestionClassification;
    questionText: (id: string) => string | undefined;
    retryAttempt?: number;
  }): Promise<StoredConversationTurn | "not-found" | "case-mismatch"> {
    const existing = await this.findTurn(input.encounterId, input.requestId);
    if (existing) return existing;

    try {
      return await db.$transaction(async (transaction) => {
        const encounter = await transaction.encounter.findFirst({
          where: { id: input.encounterId, userId: input.userId },
        });
        if (!encounter) return "not-found" as const;
        if (encounter.caseId !== input.caseId) return "case-mismatch" as const;

        const duplicate = await transaction.conversationTurn.findUnique({
          where: {
            encounterId_requestId: {
              encounterId: input.encounterId,
              requestId: input.requestId,
            },
          },
        });
        if (duplicate) return toStoredTurn(duplicate);

        const storedState = await transaction.patientQuestionState.findUnique({
          where: { encounterId: input.encounterId },
        });
        const previous = parseState(storedState?.state);
        const transition = input.classification
          ? applyPatientQuestionClassification({
              caseId: input.caseId,
              state: previous,
              classification: input.classification,
            })
          : { state: previous, selectedQuestionId: undefined };

        let selectedQuestionId = transition.selectedQuestionId;
        if (selectedQuestionId) {
          const alreadyEmitted = await transaction.patientQuestionEmission.findUnique({
            where: {
              encounterId_questionId: {
                encounterId: input.encounterId,
                questionId: selectedQuestionId,
              },
            },
          });
          if (alreadyEmitted) {
            selectedQuestionId = undefined;
            transition.state.emittedQuestionIds =
              transition.state.emittedQuestionIds.filter((id) => id !== transition.selectedQuestionId);
          }
        }

        const questionText = selectedQuestionId
          ? input.questionText(selectedQuestionId)
          : undefined;
        const responseText = questionText
          ? `${input.baseResponse.trim()} ${questionText}`.trim()
          : input.baseResponse.trim();

        await transaction.patientQuestionState.upsert({
          where: { encounterId: input.encounterId },
          create: {
            encounterId: input.encounterId,
            version: transition.state.version,
            state: transition.state as unknown as Prisma.InputJsonValue,
          },
          update: {
            version: { increment: 1 },
            state: transition.state as unknown as Prisma.InputJsonValue,
          },
        });
        const turn = await transaction.conversationTurn.create({
          data: {
            encounterId: input.encounterId,
            requestId: input.requestId,
            studentMessageId: input.studentMessageId,
            patientMessageId: input.patientMessageId,
            responseText,
            providerName: input.providerName,
            selectedQuestionId,
            stateVersion: transition.state.version,
          },
        });
        if (selectedQuestionId) {
          await transaction.patientQuestionEmission.create({
            data: {
              encounterId: input.encounterId,
              questionId: selectedQuestionId,
              turnId: turn.id,
            },
          });
        }
        return toStoredTurn(turn);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryAttempt = input.retryAttempt ?? 0;
      if (isSerializationConflict(error) && retryAttempt < 2) {
        return this.finalizeTurn({ ...input, retryAttempt: retryAttempt + 1 });
      }
      if (isUniqueConflict(error)) {
        const duplicate = await this.findTurn(input.encounterId, input.requestId);
        if (duplicate) return duplicate;
        // A distinct concurrent turn won the question emission. Persist this
        // response without selecting that question.
        if (retryAttempt >= 2) throw error;
        return this.finalizeTurn({
          ...input,
          classification: undefined,
          retryAttempt: retryAttempt + 1,
        });
      }
      throw error;
    }
  }
}

function parseState(value: unknown): PatientQuestionState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyPatientQuestionState();
  }
  const candidate = value as Partial<PatientQuestionState>;
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.version !== "number" ||
    !candidate.detectedEvents ||
    !Array.isArray(candidate.emittedQuestionIds)
  ) {
    return createEmptyPatientQuestionState();
  }
  return candidate as PatientQuestionState;
}

function toStoredTurn(turn: {
  requestId: string;
  patientMessageId: string;
  responseText: string;
  providerName: string;
  selectedQuestionId: string | null;
  stateVersion: number;
}): StoredConversationTurn {
  return {
    requestId: turn.requestId,
    patientMessageId: turn.patientMessageId,
    responseText: turn.responseText,
    providerName: turn.providerName,
    ...(turn.selectedQuestionId ? { selectedQuestionId: turn.selectedQuestionId } : {}),
    stateVersion: turn.stateVersion,
  };
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export const patientQuestionService = new PatientQuestionService();
