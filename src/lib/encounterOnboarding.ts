export const encounterOnboardingContent = {
  title: "Before you begin",
  introduction:
    "Conduct this encounter as you would with a real patient. Ask questions, review the available examination information, explain your clinical plan, and complete the consultation when you are finished.",
  steps: [
    {
      title: "Talk with the patient",
      description:
        "Use the message field to ask questions and explain your assessment or plan. The patient will respond based on the information available in this case.",
    },
    {
      title: "Review examinations",
      description:
        "Select Exam to open the Examination section and review available vital signs, images, and clinical findings.",
    },
    {
      title: "Let the conversation develop",
      description:
        "The patient may provide additional information when you ask relevant follow-up questions.",
    },
    {
      title: "Finish the encounter",
      description:
        "When you are done, select Finish Consultation. A performance report will become available after completion.",
    },
  ],
  startLabel: "Begin Consultation",
} as const;

export function shouldShowEncounterOnboarding(options: {
  hasLocalSnapshot: boolean;
  hasActiveServerEncounter: boolean;
}) {
  return !options.hasLocalSnapshot && !options.hasActiveServerEncounter;
}
