import { notFound } from "next/navigation";

import { FacultyReportPreviewClient } from "./FacultyReportPreviewClient";

export default function FacultyReportPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <FacultyReportPreviewClient />;
}

