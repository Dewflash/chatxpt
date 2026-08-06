"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import type {
  OverlayViewModel,
  StreamerViewModel,
  ViewerViewModel,
} from "../../../core";

type SnapshotRole = "streamer" | "viewer" | "overlay";

interface HarnessPrincipals {
  readonly streamer: string;
  readonly viewer: string;
  readonly overlay: string;
}

interface HarnessProps {
  readonly contractVersion: "1.0.0";
  readonly endpoint: string;
  readonly principals: HarnessPrincipals;
  readonly questCycleId: string;
  readonly sessionId: string;
}

interface HarnessSnapshots {
  readonly streamer: StreamerViewModel | null;
  readonly viewer: ViewerViewModel | null;
  readonly overlay: OverlayViewModel | null;
}

interface UiX09FixtureCatalog {
  readonly intelligence: Record<
    string,
    {
      readonly envelope: { readonly evidenceClass: string };
      readonly gameplay: {
        readonly signals: readonly {
          readonly observation: { readonly status: string; readonly reason?: string };
        }[];
      };
    }
  >;
  readonly generation: Record<
    string,
    {
      readonly providerHealth: { readonly service: string; readonly status: string };
      readonly batch: {
        readonly candidates: readonly {
          readonly generation: { readonly method: string; readonly provider: string | null };
        }[];
      };
    }
  >;
}

interface HarnessError {
  readonly code: string;
  readonly message: string;
}

interface SnapshotResponse<Role extends SnapshotRole> {
  readonly ok: boolean;
  readonly snapshot?: HarnessSnapshots[Role];
  readonly error?: HarnessError;
  readonly reality?: {
    readonly evidenceClass: string;
    readonly liveInputsUsed: boolean;
    readonly label: string;
  };
  readonly fixtureCatalog?: UiX09FixtureCatalog;
}

interface CommandResponse {
  readonly ok: boolean;
  readonly revision?: number;
  readonly receipt?: {
    readonly commandId: string;
    readonly eventTypes: readonly string[];
  };
  readonly views?: {
    readonly viewer?: ViewerViewModel;
  } | null;
  readonly error?: HarnessError;
}

const surfaceLabels = {
  studio: "Studio",
  live: "Live Config",
  viewer: "Viewer Board",
  overlay: "Overlay",
} as const;

type Surface = keyof typeof surfaceLabels;

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function formatStatus(status: string): string {
  return status.replaceAll("-", " ");
}

function voteWindowDuration(viewer: ViewerViewModel | null): string {
  const { endsAt, startsAt } = viewer?.questCycle ?? {};
  if (endsAt === null || endsAt === undefined || startsAt === null || startsAt === undefined) return "--";
  const seconds = Math.max(0, Math.round((endsAt - startsAt) / 1_000));
  return `${seconds}s`;
}

function voteSharePercent(votes: number, totalVotes: number): number {
  if (totalVotes === 0) return 0;
  return Math.round((votes / totalVotes) * 100);
}

export function DiagnosticUiHarnessClient({
  contractVersion,
  endpoint,
  principals,
  questCycleId,
  sessionId,
}: HarnessProps) {
  const [activeSurface, setActiveSurface] = useState<Surface>("studio");
  const [snapshots, setSnapshots] = useState<HarnessSnapshots>({
    streamer: null,
    viewer: null,
    overlay: null,
  });
  const [fixtureCatalog, setFixtureCatalog] = useState<UiX09FixtureCatalog | null>(null);
  const [status, setStatus] = useState("Loading fixture state");
  const [error, setError] = useState<HarnessError | null>(null);
  const [acceptedChoice, setAcceptedChoice] = useState<string | null>(null);
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const commandSequence = useRef(0);
  const voterKey = `ui-harness-browser-${useId().replaceAll(":", "id")}`;

  const readSnapshot = useCallback(
    async <Role extends SnapshotRole>(
      role: Role,
      principalId: string,
    ): Promise<{ readonly snapshot: HarnessSnapshots[Role]; readonly fixtureCatalog: UiX09FixtureCatalog | null }> => {
      const query = new URLSearchParams({ sessionId, role, principalId });
      const response = await fetch(`${endpoint}?${query.toString()}`, { cache: "no-store" });
      const body = await readJson<SnapshotResponse<Role>>(response);
      if (!body.ok || body.snapshot === undefined) {
        throw body.error ?? { code: "internal", message: `Could not load ${role}` };
      }
      return { snapshot: body.snapshot, fixtureCatalog: body.fixtureCatalog ?? null };
    },
    [endpoint, sessionId],
  );

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [streamerResult, viewerResult, overlayResult] = await Promise.all([
        readSnapshot("streamer", principals.streamer),
        readSnapshot("viewer", principals.viewer),
        readSnapshot("overlay", principals.overlay),
      ]);
      const { snapshot: streamer } = streamerResult;
      const { snapshot: viewer } = viewerResult;
      const { snapshot: overlay } = overlayResult;
      if (streamer === null || viewer === null || overlay === null) {
        throw { code: "internal", message: "Diagnostic gateway returned an empty snapshot" };
      }
      setSnapshots({ streamer, viewer, overlay });
      setFixtureCatalog(streamerResult.fixtureCatalog ?? viewerResult.fixtureCatalog ?? overlayResult.fixtureCatalog);
      setStatus(`Fixture revision ${viewer.envelope.revision}`);
    } catch (caught) {
      const next = caught as HarnessError;
      setError(next);
      setStatus("Fixture unavailable");
    }
  }, [principals.overlay, principals.streamer, principals.viewer, readSnapshot]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  async function castVote(candidateId: string) {
    const expectedRevision = snapshots.viewer?.envelope.revision;
    if (expectedRevision === undefined) return;
    commandSequence.current += 1;
    const issuedAt = (snapshots.viewer?.questCycle.startsAt ?? 1_786_200_000_000) + commandSequence.current;
    setPendingCandidateId(candidateId);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          command: {
            contractVersion,
            sessionId,
            questCycleId,
            commandId: `ui-harness-vote-${commandSequence.current}`,
            correlationId: `ui-harness-correlation-${commandSequence.current}`,
            expectedRevision,
            issuedAt,
            actor: { kind: "anonymous", actorId: null },
            type: "viewer.vote",
            candidateId,
            voterKey,
            sourceMode: "hosted-board",
          },
        }),
      });
      const body = await readJson<CommandResponse>(response);
      if (!body.ok) {
        throw body.error ?? { code: "internal", message: "Vote command failed" };
      }
      setAcceptedChoice(body.views?.viewer?.acceptedCandidateId ?? candidateId);
      setStatus(`Vote accepted at revision ${body.revision ?? expectedRevision + 1}`);
      await refresh();
    } catch (caught) {
      setError(caught as HarnessError);
    } finally {
      setPendingCandidateId(null);
    }
  }

  const streamer = snapshots.streamer;
  const viewer = snapshots.viewer;
  const overlay = snapshots.overlay;
  const options = viewer?.questCycle.options ?? [];
  const totalVotes = viewer?.questCycle.voteTallies.reduce((sum, tally) => sum + tally.votes, 0) ?? 0;
  const intelligenceExamples = fixtureCatalog === null ? [] : Object.entries(fixtureCatalog.intelligence);
  const generationExamples = fixtureCatalog === null ? [] : Object.entries(fixtureCatalog.generation);

  return (
    <main className="diagnostic-shell">
      <div className="diagnostic-evidence-banner" role="note">
        FIXTURE / NOT LIVE EVIDENCE
      </div>

      <header className="diagnostic-header">
        <div>
          <p className="diagnostic-kicker">Fixture Harness</p>
          <h1>ChatXPT UI Runtime</h1>
        </div>
        <div className="diagnostic-status" data-state={error === null ? "ready" : "error"}>
          <span>{error === null ? status : `${error.code}: ${error.message}`}</span>
          <button type="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </header>

      <nav className="diagnostic-tabs" aria-label="Diagnostic surfaces">
        {(Object.keys(surfaceLabels) as Surface[]).map((surface) => (
          <button
            aria-pressed={activeSurface === surface}
            key={surface}
            onClick={() => setActiveSurface(surface)}
            type="button"
          >
            {surfaceLabels[surface]}
          </button>
        ))}
      </nav>

      <section className="diagnostic-grid">
        <aside className="diagnostic-panel diagnostic-sidebar">
          <p className="diagnostic-kicker">Session</p>
          <strong>{streamer?.profile.displayName ?? "Loading"}</strong>
          <dl>
            <div>
              <dt>State</dt>
              <dd>{viewer === null ? "--" : formatStatus(viewer.questCycle.status)}</dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>{viewer?.envelope.revision ?? "--"}</dd>
            </div>
            <div>
              <dt>Vote Window</dt>
              <dd>{voteWindowDuration(viewer)}</dd>
            </div>
            <div>
              <dt>Votes</dt>
              <dd>{totalVotes}</dd>
            </div>
          </dl>
        </aside>

        {activeSurface === "studio" ? (
          <section className="diagnostic-panel diagnostic-main">
            <p className="diagnostic-kicker">Studio</p>
            <h2>{streamer?.questCycle.status === "voting" ? "Vote In Progress" : "Session Ready"}</h2>
            <div className="diagnostic-metrics">
              {streamer?.services.map((service) => (
                <span key={service.service}>{service.service}: {service.status}</span>
              ))}
            </div>
            <div className="diagnostic-list">
              {options.map((candidate, index) => (
                <article key={candidate.candidateId}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{candidate.title}</strong>
                    <p>{candidate.instruction}</p>
                  </div>
                  <small>{candidate.rewardPoints} pts</small>
                </article>
              ))}
            </div>
            <section className="diagnostic-fixture-catalog" aria-label="Intelligence fixture examples">
              <h3>Intelligence Examples</h3>
              <div>
                {intelligenceExamples.map(([fixtureId, fixture]) => {
                  const primarySignal = fixture.gameplay.signals[0]?.observation;
                  const reason = primarySignal?.reason === undefined ? "" : ` / ${primarySignal.reason}`;
                  return (
                    <span key={fixtureId}>
                      {fixtureId}: {primarySignal?.status ?? "unknown"}{reason} ({fixture.envelope.evidenceClass})
                    </span>
                  );
                })}
                {generationExamples.map(([fixtureId, fixture]) => {
                  const generation = fixture.batch.candidates[0]?.generation;
                  return (
                    <span key={fixtureId}>
                      {fixtureId}: {generation?.method ?? "unknown"} / {fixture.providerHealth.status}
                    </span>
                  );
                })}
              </div>
            </section>
          </section>
        ) : null}

        {activeSurface === "live" ? (
          <section className="diagnostic-panel diagnostic-main">
            <p className="diagnostic-kicker">Live Config</p>
            <h2>{viewer === null ? "Loading" : `${formatStatus(viewer.questCycle.status)} Controls`}</h2>
            <div className="diagnostic-action-row">
              {streamer?.questCycle.availableStreamerActions.map((action) => (
                <button disabled key={action} type="button">
                  {formatStatus(action)}
                </button>
              ))}
            </div>
            <p className="diagnostic-muted">
              Emergency, result, and progress controls stay disabled here until Role 4 consumes this fixture seam.
            </p>
          </section>
        ) : null}

        {activeSurface === "viewer" ? (
          <section className="diagnostic-panel diagnostic-main">
            <p className="diagnostic-kicker">Viewer Board</p>
            <h2>{acceptedChoice === null ? "Choose A Quest" : "Vote Accepted"}</h2>
            <div className="diagnostic-list">
              {options.map((candidate, index) => {
                const votes = viewer?.questCycle.voteTallies.find((tally) => tally.candidateId === candidate.candidateId)?.votes ?? 0;
                const voteShare = voteSharePercent(votes, totalVotes);
                return (
                  <article key={candidate.candidateId}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{candidate.title}</strong>
                      <p>{candidate.instruction}</p>
                      <div className="diagnostic-vote-track">
                        <i style={{ width: `${voteShare}%` }} />
                      </div>
                    </div>
                    <button
                      disabled={!viewer?.canVote || pendingCandidateId !== null}
                      onClick={() => void castVote(candidate.candidateId)}
                      type="button"
                    >
                      {pendingCandidateId === candidate.candidateId ? "Sending" : `${votes} votes`}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {activeSurface === "overlay" ? (
          <section className="diagnostic-overlay-preview">
            <div>
              <p>{overlay === null ? "Waiting" : formatStatus(overlay.questCycle.status)}</p>
              <h2>{options[0]?.title ?? "Quest Pending"}</h2>
              <span>{options[0]?.instruction ?? "No active fixture option."}</span>
              <div className="diagnostic-overlay-meter">
                <i style={{ width: `${Math.min(100, totalVotes * 35)}%` }} />
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
