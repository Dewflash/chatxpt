import { demoStudioIntegrationHealthView } from "./demo-integration-health";
import { DesignSystemRoot, Notice, Panel, StatusBadge } from "../design-system";
import {
  countByStatus,
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
  return styles[status];
}

function statusTone(status: IntegrationStatus): "success" | "warning" | "danger" {
  switch (status) {
    case "configured":
      return "success";
    case "degraded":
      return "warning";
    case "not-configured":
    case "not-ready":
      return "danger";
  }
}

function IntegrationRow({ item }: { readonly item: StudioIntegrationHealthItem }) {
  return (
    <article className={styles.integrationRow}>
      <div className={styles.integrationMain}>
        <div className={styles.rowHeader}>
          <h3>{item.name}</h3>
          <StatusBadge className={statusClass(item.status)} tone={statusTone(item.status)}>
            {statusLabel(item.status)}
          </StatusBadge>
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

  return (
    <DesignSystemRoot className={styles.integrationSurface} theme="twitch">
      <section className={styles.contentOnly}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>Technical health</p>
            <h1>Integrations</h1>
            <p>
              Operational status for the systems ChatXPT needs to run the Twitch demo. This is fixture evidence until
              Role 1 wires real health checks.
            </p>
          </div>
          <StatusBadge tone={view.evidenceClass === "live" ? "success" : "diagnostic"}>
            {`${view.evidenceClass} health`}
          </StatusBadge>
        </header>

        <section className={styles.summaryGrid} aria-label="Integration status summary">
          {statusOrder.map((status) => (
            <div className={styles.summaryTile} key={status}>
              <span>{statusLabel(status)}</span>
              <strong>{counts[status]}</strong>
            </div>
          ))}
        </section>

        <Panel className={styles.healthPanel} aria-label="Integration health details">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Configured / not configured</p>
              <h2>Runtime dependencies</h2>
            </div>
            <StatusBadge tone={view.evidenceClass === "live" ? "success" : "diagnostic"}>
              {`${view.evidenceClass} view`}
            </StatusBadge>
          </div>
          <div className={styles.integrationList}>
            {view.items.map((item) => (
              <IntegrationRow item={item} key={item.id} />
            ))}
          </div>
          <Notice title="Evidence boundary" tone={view.evidenceClass === "live" ? "success" : "warning"}>
            This surface shows technical health supplied to Role 4. Fixture or diagnostic health does not prove real
            Twitch, OBS, Supabase, AI, or extraction readiness.
          </Notice>
        </Panel>
      </section>
    </DesignSystemRoot>
  );
}

export function StudioIntegrationHealthPanel(props: StudioIntegrationsHealthProps) {
  return <StudioIntegrationsHealth {...props} />;
}

export function StudioIntegrationsHealthDemo() {
  return <StudioIntegrationsHealth view={demoStudioIntegrationHealthView} />;
}
