"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CONTRACT_VERSION,
  type UiGatewayCommand,
  type UiGatewayCommandResult,
  type UiGatewayReadResult,
  type UiGatewaySurface,
} from "@/core";
import { FetchUiGatewayClient } from "@/realtime/browser";

import styles from "./harness.module.css";

const surfaces: readonly UiGatewaySurface[] = [
  "studio",
  "config",
  "live-config",
  "viewer",
  "hosted-board",
  "overlay",
];

type IdentityChoice =
  | "correct"
  | "moderator"
  | "anonymous"
  | "expired"
  | "wrong-role"
  | "none";
type DiagnosticScenario =
  | "ready"
  | "permission-denied"
  | "misconfigured"
  | "disconnected"
  | "stale"
  | "dependency-failure";

function roleForSurface(surface: UiGatewaySurface) {
  if (["studio", "config", "live-config"].includes(surface)) return "streamer" as const;
  if (["viewer", "hosted-board"].includes(surface)) return "viewer" as const;
  return "overlay" as const;
}

function tokenFor(surface: UiGatewaySurface, identity: IdentityChoice): string | null {
  if (identity === "none") return null;
  if (identity === "expired") return "diagnostic-expired";
  if (identity === "moderator") return "diagnostic-moderator";
  if (identity === "anonymous") return "diagnostic-anonymous";
  const role = roleForSurface(surface);
  if (identity === "wrong-role") {
    return role === "streamer" ? "diagnostic-viewer" : "diagnostic-broadcaster";
  }
  if (role === "streamer") return "diagnostic-broadcaster";
  if (role === "viewer") return "diagnostic-viewer";
  return "diagnostic-overlay";
}

function commandActor(surface: UiGatewaySurface, identity: IdentityChoice) {
  if (roleForSurface(surface) === "streamer") {
    if (identity === "moderator") {
      return { kind: "moderator" as const, actorId: "fixture-moderator" };
    }
    return { kind: "broadcaster" as const, actorId: "fixture-broadcaster" };
  }
  if (identity === "anonymous") {
    return { kind: "anonymous" as const, actorId: null };
  }
  return { kind: "viewer" as const, actorId: "fixture-viewer" };
}

function sampleCommand(
  surface: UiGatewaySurface,
  identity: IdentityChoice,
  expectedRevision: number,
): UiGatewayCommand | null {
  const commandId = `diagnostic-${surface}-${crypto.randomUUID()}`;
  const common = {
    contractVersion: CONTRACT_VERSION,
    sessionId: "fixture-session",
    commandId,
    correlationId: `correlation-${commandId}`,
    expectedRevision,
    issuedAt: Date.now(),
  };
  if (surface === "studio") {
    return {
      ...common,
      actor: commandActor(surface, identity),
      type: "streamer.setup",
      service: "realtime",
      action: "retry-service",
    };
  }
  if (surface === "config") {
    return {
      ...common,
      actor: commandActor(surface, identity),
      type: "streamer.profile",
      profile: {
        profileId: "fixture-profile",
        streamerId: "fixture-broadcaster",
        revision: expectedRevision,
        displayName: "Fixture Streamer",
        gameId: null,
        gameName: null,
        experience: { intensity: 0.5, creativity: 0.5 },
        restrictions: [],
        preferredQuestTypes: [],
        forbiddenQuestTypes: [],
        accessibilityNeeds: [],
      },
    };
  }
  if (surface === "live-config") {
    return {
      ...common,
      questCycleId: "fixture-cycle",
      actor: commandActor(surface, identity),
      type: "streamer.quest",
      action: "skip",
      candidateId: null,
    };
  }
  if (surface === "viewer" || surface === "hosted-board") {
    return {
      ...common,
      questCycleId: "fixture-cycle",
      actor: commandActor(surface, identity),
      type: "viewer.vote",
      candidateId: "fixture-candidate-1",
    };
  }
  return null;
}

export function HarnessClient({ surface }: { readonly surface: UiGatewaySurface }) {
  const [identity, setIdentity] = useState<IdentityChoice>("correct");
  const [scenario, setScenario] = useState<DiagnosticScenario>("ready");
  const [readResult, setReadResult] = useState<UiGatewayReadResult | null>(null);
  const [commandResult, setCommandResult] = useState<UiGatewayCommandResult | null>(null);
  const [busy, setBusy] = useState(false);
  const accessToken = tokenFor(surface, identity);
  const client = useMemo(
    () => new FetchUiGatewayClient({ getAccessToken: () => accessToken }),
    [accessToken],
  );

  const loadSnapshot = useCallback(async () => {
    setBusy(true);
    setCommandResult(null);
    try {
      setReadResult(
        await client.read({
          surface,
          sessionId: "fixture-session",
          scenario,
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [client, scenario, surface]);

  useEffect(() => {
    let active = true;
    void client
      .read({ surface, sessionId: "fixture-session", scenario })
      .then((result) => {
        if (active) {
          setCommandResult(null);
          setReadResult(result);
        }
      });
    return () => {
      active = false;
    };
  }, [client, scenario, surface]);

  async function dispatchSample() {
    const revision = readResult?.ok ? readResult.snapshot.currentRevision : 0;
    const command = sampleCommand(surface, identity, revision);
    if (command === null) return;
    setBusy(true);
    try {
      setCommandResult(await client.dispatch({ surface, scenario, command }));
    } finally {
      setBusy(false);
    }
  }

  const snapshot = readResult?.ok ? readResult.snapshot : null;
  const readError = readResult !== null && !readResult.ok ? readResult.error : null;

  return (
    <main
      className={`${styles.page} ${surface === "overlay" ? styles.transparentPage : ""}`}
      data-chatxpt-diagnostic-harness
      data-surface={surface}
    >
      <div className={styles.banner} role="status">
        <span>FIXTURE / DIAGNOSTIC HARNESS</span>
        <span>NOT LIVE EVIDENCE</span>
      </div>
      <div className={styles.shell}>
        <nav className={styles.nav} aria-label="Diagnostic surfaces">
          {surfaces.map((item) => (
            <Link
              key={item}
              href={`/diagnostics/ui-harness/${item}`}
              aria-current={item === surface ? "page" : undefined}
            >
              {item}
            </Link>
          ))}
        </nav>

        <section className={styles.panel}>
          <h1>{surface} host</h1>
          <p>
            Role 1 transport and fixture state only. Role-owned product UI mounts here when its
            public component is available.
          </p>

          <div className={styles.controls}>
            <label>
              Identity fixture
              <select
                aria-label="Identity fixture"
                value={identity}
                onChange={(event) => setIdentity(event.target.value as IdentityChoice)}
              >
                <option value="correct">Correct scoped grant</option>
                {surface === "live-config" && (
                  <option value="moderator">Moderator live-control grant</option>
                )}
                {(surface === "viewer" || surface === "hosted-board") && (
                  <option value="anonymous">Anonymous grant</option>
                )}
                <option value="expired">Expired token</option>
                <option value="wrong-role">Wrong role</option>
                <option value="none">No token</option>
              </select>
            </label>
            <label>
              Failure fixture
              <select
                aria-label="Failure fixture"
                value={scenario}
                onChange={(event) => setScenario(event.target.value as DiagnosticScenario)}
              >
                <option value="ready">Ready</option>
                <option value="permission-denied">Capture permission denied</option>
                <option value="misconfigured">Twitch misconfigured</option>
                <option value="disconnected">Realtime disconnected</option>
                <option value="stale">Stale revision</option>
                <option value="dependency-failure">Dependency failure</option>
              </select>
            </label>
            <button type="button" disabled={busy} onClick={() => void loadSnapshot()}>
              Refresh snapshot
            </button>
            <button
              type="button"
              disabled={busy || surface === "overlay" || !readResult?.ok}
              onClick={() => void dispatchSample()}
            >
              Send typed sample command
            </button>
          </div>

          {snapshot !== null && (
            <div className={styles.summary} aria-label="Snapshot summary">
              <span>role: {snapshot.role}</span>
              <span>auth: {snapshot.auth.status}</span>
              <span>revision: {snapshot.currentRevision}</span>
              <span>evidence: {snapshot.view.envelope.evidenceClass}</span>
            </div>
          )}
          {readError !== null && (
            <p className={styles.error} role="alert">
              {readError.code}: {readError.message}
            </p>
          )}
          {commandResult !== null && (
            <p className={commandResult.ok ? styles.success : styles.error} role="status">
              {commandResult.ok
                ? `${commandResult.outcome}: revision ${commandResult.currentRevision}`
                : `${commandResult.error.code}: ${commandResult.error.message}`}
            </p>
          )}

          <h2>Canonical gateway payload</h2>
          <pre className={styles.json} data-testid="gateway-payload">
            {JSON.stringify(readResult, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
