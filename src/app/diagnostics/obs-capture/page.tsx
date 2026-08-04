import { notFound } from "next/navigation";

import { ObsCaptureDiagnostic } from "@/integrations";

export const dynamic = "force-dynamic";

export default function ObsCaptureDiagnosticPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.CHATXPT_ENABLE_CAPTURE_DIAGNOSTIC !== "true"
  ) {
    notFound();
  }

  return <ObsCaptureDiagnostic />;
}
