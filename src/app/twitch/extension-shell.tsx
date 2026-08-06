import {
  TWITCH_EXTENSION_CONFIG_PATH,
  TWITCH_EXTENSION_LIVE_CONFIG_PATH,
  TWITCH_EXTENSION_VIEWER_PATH,
  resolveTwitchSetupReadiness,
} from "../../integrations";

type TwitchExtensionSurface = "viewer" | "config" | "live-config";

const surfaceCopy: Record<
  TwitchExtensionSurface,
  {
    readonly eyebrow: string;
    readonly title: string;
    readonly owner: string;
    readonly route: string;
  }
> = {
  viewer: {
    eyebrow: "Twitch Viewer",
    title: "Viewer Quest Surface Reserved",
    owner: "Role 5",
    route: TWITCH_EXTENSION_VIEWER_PATH,
  },
  config: {
    eyebrow: "Twitch Config",
    title: "Extension Config Surface Reserved",
    owner: "Role 4",
    route: TWITCH_EXTENSION_CONFIG_PATH,
  },
  "live-config": {
    eyebrow: "Twitch Live Config",
    title: "Live Control Surface Reserved",
    owner: "Role 4",
    route: TWITCH_EXTENSION_LIVE_CONFIG_PATH,
  },
};

function serviceStateLabel(status: string): string {
  return status.replaceAll("-", " ");
}

export function TwitchExtensionRouteShell({
  surface,
}: {
  readonly surface: TwitchExtensionSurface;
}) {
  const copy = surfaceCopy[surface];
  const readiness = resolveTwitchSetupReadiness(process.env);

  return (
    <main className="twitch-extension-shell">
      <section className="twitch-extension-panel" aria-label={`${copy.eyebrow} setup status`}>
        <p className="diagnostic-kicker">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>
          {copy.route} is ready for Twitch registration. {copy.owner} will replace this shell with
          the final role-owned module.
        </p>
        <dl>
          <div>
            <dt>Readiness</dt>
            <dd>{readiness.ok ? "ready" : "setup required"}</dd>
          </div>
          <div>
            <dt>Callback</dt>
            <dd>{readiness.callbackPath}</dd>
          </div>
        </dl>
        <div className="twitch-extension-services" aria-label="Twitch service readiness">
          {readiness.services.map((service) => (
            <span data-state={service.status} key={service.service}>
              {service.service}: {serviceStateLabel(service.status)}
            </span>
          ))}
        </div>
        <ul>
          {readiness.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
