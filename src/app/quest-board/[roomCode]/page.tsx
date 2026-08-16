import { HostedBoardClient } from "./hosted-board-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function QuestBoardPage({
  params,
}: {
  readonly params: Promise<{ readonly roomCode: string }>;
}) {
  const { roomCode } = await params;
  return <HostedBoardClient roomCode={roomCode} />;
}
