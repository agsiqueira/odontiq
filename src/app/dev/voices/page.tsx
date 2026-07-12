import { notFound } from "next/navigation";

import { VoiceAuditionClient } from "./VoiceAuditionClient";

export default function DeveloperVoiceAuditionPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <VoiceAuditionClient />;
}
