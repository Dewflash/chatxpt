import { NextResponse } from "next/server";

import { createFixtureUiGatewaySnapshot } from "../../../../core";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(createFixtureUiGatewaySnapshot());
}
