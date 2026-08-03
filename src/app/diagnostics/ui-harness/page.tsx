import { notFound, redirect } from "next/navigation";

import { diagnosticHarnessEnabled } from "@/realtime/server";

export const dynamic = "force-dynamic";

export default function DiagnosticHarnessIndex() {
  if (!diagnosticHarnessEnabled()) notFound();
  redirect("/diagnostics/ui-harness/studio");
}
