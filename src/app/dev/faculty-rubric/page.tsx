import { notFound } from "next/navigation";

import { FacultyRubricInspectorClient } from "./FacultyRubricInspectorClient";

export default function DeveloperFacultyRubricPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <FacultyRubricInspectorClient />;
}
