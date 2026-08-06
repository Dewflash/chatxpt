import { NextResponse } from "next/server";

import {
  resolveServerEnvironmentHealth,
  statusForServerEnvironmentHealth,
} from "../../../realtime/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = resolveServerEnvironmentHealth(process.env);
  return NextResponse.json(report, { status: statusForServerEnvironmentHealth(report) });
}
