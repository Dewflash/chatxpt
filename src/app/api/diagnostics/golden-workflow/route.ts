import { NextResponse } from "next/server";
import { runFixtureGoldenWorkflow } from "./runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.CHATXPT_ENABLE_DIAGNOSTICS !== "true") {
    return NextResponse.json(
      {
        error: "Diagnostic fixture routes are disabled in production.",
      },
      { status: 404 },
    );
  }

  try {
    return NextResponse.json(await runFixtureGoldenWorkflow());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reality: {
          evidenceClass: "fixture",
          liveInputsUsed: false,
          label: "local diagnostic golden workflow",
        },
        error: error instanceof Error ? error.message : "Golden workflow harness failed",
      },
      { status: 500 },
    );
  }
}
