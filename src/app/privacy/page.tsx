import type { Metadata } from "next";

import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy Notice — ChatXPT",
  description: "How the ChatXPT livestream sidequest prototype handles streamer, viewer, chat, and gameplay data.",
};

export default function PrivacyNoticePage() {
  return (
    <main className={styles.page}>
      <article className={styles.notice}>
        <header>
          <a className={styles.brand} href="/studio">ChatXPT</a>
          <p>Prototype privacy notice</p>
          <h1>Privacy Notice</h1>
          <p className={styles.updated}>Effective 22 August 2026</p>
        </header>

        <section>
          <h2>What ChatXPT does</h2>
          <p>
            ChatXPT helps a streamer turn gameplay signals and audience activity into safe,
            viewer-voted sidequests. Twitch remains the viewing and account platform; ChatXPT
            supplies the Studio controls, participation service, and broadcast overlay.
          </p>
        </section>

        <section>
          <h2>Information processed</h2>
          <ul>
            <li><strong>Streamer connection:</strong> Twitch broadcaster and channel identifiers, display name, current game metadata, and server-side OAuth authorization needed for live-status and chat EventSub delivery.</li>
            <li><strong>Streamer settings:</strong> game selection, challenge preferences, intensity, safety limits, accessibility preferences, session controls, and privacy-safe quest history.</li>
            <li><strong>Viewer participation:</strong> Twitch-issued Extension authorization or an anonymous hosted-board identity, converted into a session-scoped pseudonymous participant key, plus votes, reactions, quest progress, and non-monetary session rewards.</li>
            <li><strong>Chat activity:</strong> signed Twitch chat events are classified as an exact <code>1</code>/<code>2</code>/<code>3</code> vote or converted into rolling aggregate activity and audience signals.</li>
            <li><strong>Gameplay observations:</strong> OBS Virtual Camera frames are analyzed ephemerally in the capture browser. Only bounded normalized game facts, confidence, freshness, and supported-or-unknown status enter the ChatXPT session.</li>
          </ul>
        </section>

        <section>
          <h2>Information ChatXPT does not retain</h2>
          <ul>
            <li>Raw OBS camera frames, screenshots, or gameplay video.</li>
            <li>Raw Twitch chat text in authoritative session state, viewer views, or the OBS overlay.</li>
            <li>Viewer usernames, Twitch IDs, or cross-stream viewer personality profiles in authoritative participation state.</li>
            <li>Payment, betting, wagering, or monetary reward information.</li>
          </ul>
        </section>

        <section>
          <h2>How information is used and shared</h2>
          <p>
            Information is used to authenticate the broadcaster, detect whether the stream is live,
            summarize current gameplay and audience conditions, validate exactly three quest choices,
            accept first-vote-final participation, show quest progress, and recover the current session.
            ChatXPT does not sell personal information or use it for advertising profiles.
          </p>
          <p>
            Twitch supplies account authorization, Extension identity, live-status, and chat delivery.
            A configured hosting and database provider may store streamer settings and revisioned session
            records. When the optional OpenAI provider is enabled, it receives only bounded normalized
            gameplay facts, audience aggregates, streamer preferences, restrictions, and recent quest
            context—never raw frames, raw chat, usernames, viewer identity, Twitch IDs, or credentials.
            Provider output remains subject to deterministic safety validation and a credential-free fallback.
          </p>
        </section>

        <section>
          <h2>Retention and security</h2>
          <p>
            Viewer participation and rewards are session-scoped. Streamer-owned settings and privacy-safe
            quest history may persist so setup does not need to be repeated. OAuth credentials and signing
            secrets stay server-side; localhost authorization is encrypted in owner-only, ignored storage.
            Raw gameplay frames are released by the capture browser after analysis.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            Viewers can use the Twitch Extension anonymously where Twitch permits it, use the hosted-board
            fallback, or choose not to participate. Broadcasters can stop a session, disconnect or revoke
            ChatXPT through Twitch account connections, and ask the project owner to remove retained
            prototype data. Unsupported or unavailable signals are reported as unknown rather than invented.
          </p>
        </section>

        <section>
          <h2>Contact and changes</h2>
          <p>
            For Local Test support or a privacy request, contact the ChatXPT project owner through the
            <a href="https://github.com/Dewflash"> project-owner profile</a>. This notice will be updated when
            the prototype adds a new platform, provider, retention practice, or material data use.
          </p>
        </section>

        <footer>
          <p>This notice describes the current prototype implementation and is not legal advice.</p>
          <a href="/studio">Return to ChatXPT Studio</a>
        </footer>
      </article>
    </main>
  );
}
