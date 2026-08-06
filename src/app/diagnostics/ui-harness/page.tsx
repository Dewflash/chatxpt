import { notFound } from "next/navigation";

import {
  diagnosticUiGatewayPrincipals,
  diagnosticUiGatewayQuestCycleId,
  diagnosticUiGatewaySessionId,
} from "../../api/diagnostics/ui-gateway/gateway";
import { DiagnosticUiHarnessClient } from "./ui-harness-client";

function diagnosticsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.CHATXPT_ENABLE_DIAGNOSTICS === "true";
}

export default function DiagnosticUiHarnessPage() {
  if (!diagnosticsEnabled()) notFound();

  return (
    <DiagnosticUiHarnessClient
      contractVersion="1.0.0"
      endpoint="/api/diagnostics/ui-gateway"
      healthEndpoint="/api/health"
      principals={diagnosticUiGatewayPrincipals}
      questCycleId={diagnosticUiGatewayQuestCycleId}
      sessionId={diagnosticUiGatewaySessionId}
    />
  );
}
