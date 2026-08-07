import { resolveDeploymentHealthReport } from "@/realtime/server";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(resolveDeploymentHealthReport(process.env));
}
