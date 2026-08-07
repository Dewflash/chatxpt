import { createFixtureUiGatewaySnapshot, type UiGatewayCommandRoute } from "@/core";
import type { ReactNode } from "react";

import styles from "./page.module.css";

function SurfacePanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function CommandPanel({ title, route }: { title: string; route: UiGatewayCommandRoute }) {
  return (
    <article className={`${styles.panel} ${styles.command}`}>
      <h3>{title}</h3>
      <span className={styles.status}>{route.method} {route.href}</span>
      <p>{route.boundary}</p>
      <pre>{JSON.stringify(route.command, null, 2)}</pre>
    </article>
  );
}

export default function UiHarnessPage() {
  const snapshot = createFixtureUiGatewaySnapshot();
  const options = snapshot.views.viewer.questCycle.options;
  const totalVotes = snapshot.views.viewer.questCycle.voteTallies.reduce(
    (total, tally) => total + tally.votes,
    0,
  );

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Role 1 diagnostic gateway</p>
        <div className={styles.titleRow}>
          <h1>One fixture session across Studio, Viewer, and OBS overlay.</h1>
          <a className={styles.link} href={snapshot.routes.fixtureJson}>Open JSON</a>
        </div>
        <p>
          This page is a browser-safe integration target. It proves shape, revision, and
          command-envelope compatibility only; it is not live Twitch, OBS, AI, Supabase, or
          multi-viewer evidence.
        </p>
      </header>

      <section className={styles.metaGrid} aria-label="Gateway identity">
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Session</span>
          <strong>{snapshot.sessionId}</strong>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Quest cycle</span>
          <strong>{snapshot.questCycleId}</strong>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Revision</span>
          <strong>{snapshot.revision}</strong>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Evidence</span>
          <strong>{snapshot.evidenceClass}</strong>
        </div>
      </section>

      <section className={styles.surfaceGrid} aria-label="Role surfaces">
        <SurfacePanel title="Streamer view">
          <span className={styles.status}>{snapshot.views.streamer.session.status}</span>
          <p>
            {snapshot.views.streamer.profile.displayName} is viewing the same voting cycle at
            revision {snapshot.views.streamer.envelope.revision}.
          </p>
          <ul className={styles.list}>
            {snapshot.views.streamer.services.map((service) => (
              <li key={service.service}>
                <strong>{service.service}</strong>: {service.status}
                {service.message ? ` - ${service.message}` : ""}
              </li>
            ))}
          </ul>
        </SurfacePanel>

        <SurfacePanel title="Viewer view">
          <span className={styles.status}>{snapshot.views.viewer.participationMode}</span>
          <p>
            Voting is {snapshot.views.viewer.canVote ? "enabled" : "disabled"} with {totalVotes}
            {" "}fixture votes counted across exactly three options.
          </p>
          <div className={styles.options}>
            {options.map((option) => {
              const tally = snapshot.views.viewer.questCycle.voteTallies.find(
                (vote) => vote.candidateId === option.candidateId,
              );
              return (
                <article className={styles.option} key={option.candidateId}>
                  <h4>{option.title}</h4>
                  <p>{option.instruction}</p>
                  <p className={styles.label}>{tally?.votes ?? 0} fixture votes</p>
                </article>
              );
            })}
          </div>
        </SurfacePanel>

        <SurfacePanel title="Overlay view">
          <span className={styles.status}>{snapshot.views.overlay.questCycle.status}</span>
          <p>
            Overlay is read-only and shares revision {snapshot.views.overlay.envelope.revision};
            community hype is {snapshot.views.overlay.communityHype}.
          </p>
          <ul className={styles.list}>
            <li>Read-only: {snapshot.views.overlay.readOnly ? "true" : "false"}</li>
            <li>Connection: {snapshot.views.overlay.connection.status}</li>
            <li className={styles.warning}>OBS Browser Source is not verified by this page.</li>
          </ul>
        </SurfacePanel>
      </section>

      <section className={styles.commands} aria-label="Command envelopes">
        {snapshot.commands.streamer.map((route) => (
          <CommandPanel key={route.command.commandId} title={route.command.commandId} route={route} />
        ))}
        {snapshot.commands.viewer.map((route) => (
          <CommandPanel key={route.command.commandId} title={route.command.commandId} route={route} />
        ))}
      </section>

      <footer className={`${styles.panel} ${styles.footer}`}>
        <h2>Boundaries</h2>
        <ul className={styles.list}>
          {snapshot.boundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ul>
      </footer>
    </main>
  );
}
