import { GameplayExtractionDiagnostic } from "./GameplayExtractionDiagnostic";

export default async function GameplayExtractionDiagnosticPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly sessionId?: string }>;
}) {
  const { sessionId = "" } = await searchParams;
  return <GameplayExtractionDiagnostic initialSessionId={sessionId} />;
}
