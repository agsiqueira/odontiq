import { notFound } from "next/navigation";

import { FacultyReportCompareClient } from "./FacultyReportCompareClient";

export default function FacultyReportComparePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <FacultyReportCompareClient />;
}

