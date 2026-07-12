import { InteractionConversation } from "@/components/InteractionConversation";
import type { ConversationMessage } from "@/lib/conversationEngine";

type EncounterConversationProps = {
  messages: ConversationMessage[];
  isOpen: boolean;
};

export function EncounterConversation({
  messages,
  isOpen,
}: EncounterConversationProps) {
  return (
    <InteractionConversation
      messages={messages}
      isActive={isOpen}
      roleLabels={{
        student: "Student",
        patient: "Patient",
      }}
    />
  );
}
