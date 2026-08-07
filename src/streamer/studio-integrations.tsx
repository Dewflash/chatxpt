import { demoStudioIntegrationHealthView } from "./demo-integration-health";
import {
  countByStatus,
  isDemoReady,
  statusLabel,
  type IntegrationStatus,
  type StudioIntegrationHealthItem,
  type StudioIntegrationHealthView,
} from "./integration-health-model";
import styles from "./studio.module.css";

const statusOrder: readonly IntegrationStatus[] = ["configured", "degraded", "not-configured", "not-ready"];

export interface StudioIntegrationsHealthProps {
  readonly view: StudioIntegrationHealthView;
}

function statusClass(status: IntegrationStatus): string {
  return `${styles.statusBadge} ${styles[status]}`;
}

function IntegrationRow({ item }: { readonly item: StudioIntegrationHealthItem }) {
  return (
    <article className={styles.integrationRow}>
      <div className={styles.integrationMain}>
        <div className={styles.rowHeader}>
          <h3>{item.name}</h3>
          <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
        </div>
        <p>{item.purpose}</p>
        <dl>
          <div>
            <dt>Owner</dt>
            <dd>{item.owner}</dd>
          </div>
          <div>
            <dt>Streamers configure?</dt>
            <dd>{item.streamerFacing ? "Yes, guided by Studio" : "No, ChatXPT infrastructure"}</dd>
          </div>
        </dl>
      </div>
      <div className={styles.integrationDetail}>
        <p><strong>Technical:</strong> {item.technicalDetail}</p>
        <p><strong>Next:</strong> {item.nextAction}</p>
        <p className={styles.serviceMessage}>{item.service.message}</p>
      </div>
    </article>
  );
}

export function StudioIntegrationsHealth({ view }: StudioIntegrationsHealthProps) {
  const counts = countByStatus(view.items);
  const ready = isDemoReady(view);

  return (
    <main className={styles.studioShell}>
      <aside className={styles.sidebar} aria-label="Studio sections">
        <a className={styles.brand} href="/studio">
          <span className={styles.brandMark}>XP</span>
          <span>ChatXPT Studio</span>
        </a>
        <nav>
          <a href="/studio">Overview</a>
          <a className={styles.activeNav} href="/studio/integrations">Integrations</a>
          <a href="/studio">Live Quests</a>
          <a href="/studio">Profile</a>
          <a href="/studio">Test Lab</a>
        </nav>
      </aside>

      <section className={styles.content}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>Technical health</p>
            <h1>Integrations</h1>
            <p>
              Operational status for the systems ChatXPT needs to run the Twitch demo. This is fixture evidence until
              Role 1 wires real health checks.
            </p>
          </div>
          <span className={ready ? styles.readyPill : styles.blockedPill}>
            {ready ? "Demo ready" : "Demo blocked"}
          </span>
        </header>

        <section className={styles.summaryGrid} aria-label="Integration status summary">
          {statusOrder.map((status) => (
            <div className={styles.summaryTile} key={status}>
              <span>{statusLabel(status)}</span>
              <strong>{counts[status]}</strong>
            </div>
          ))}
        </section>

        <section className={styles.healthPanel} aria-label="Integration health details">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Configured / not configured</p>
              <h2>Runtime dependencies</h2>
            </div>
            <span>{view.evidenceClass} view</span>
          </div>
          <div className={styles.integrationList}>
            {view.items.map((item) => (
              <IntegrationRow item={item} key={item.id} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export function StudioIntegrationsHealthDemo() {
  return <StudioIntegrationsHealth view={demoStudioIntegrationHealthView} />;
}
