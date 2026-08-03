import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { uiGatewaySurfaceSchema } from "@/core";
import { diagnosticHarnessEnabled } from "@/realtime/server";

import { HarnessClient } from "../harness-client";

export const metadata: Metadata = {
  title: "ChatXPT diagnostic harness",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DiagnosticSurfacePage({
  params,
}: {
  readonly params: Promise<{ surface: string }>;
}) {
  if (!diagnosticHarnessEnabled()) notFound();
  const parsed = uiGatewaySurfaceSchema.safeParse((await params).surface);
  if (!parsed.success) notFound();
  return <HarnessClient surface={parsed.data} />;
}
