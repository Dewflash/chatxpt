import { NextResponse } from "next/server";

import { validateFixtureUiGatewayCommand } from "../../../../core";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "invalid",
        error: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const result = validateFixtureUiGatewayCommand(body);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.httpStatus });
  }
  return NextResponse.json(result);
}
