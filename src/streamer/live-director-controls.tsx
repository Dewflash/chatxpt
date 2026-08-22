"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  Button,
  Card,
  CardGrid,
  ControlRow,
  Notice,
  StatusBadge,
  type StatusTone,
} from "../design-system";
import {
  MIN_CONFIRMED_STREAMER_SPEECH_CONFIDENCE,
  type DirectorCueAction,
  type LiveContextFact,
  type LiveContextSourceClass,
  type StreamerViewModel,
} from "../core";
import {
  browserSpeechRecognitionAvailable,
  startBrowserSpeechRecognition,
  type StreamerSpeechFailure,
  type StreamerSpeechSession,
  type StreamerSpeechTranscript,
} from "./browser-speech-recognition";
import {
  buildLiveDirectorCueCommand,
  buildLiveDirectorIntentCommand,
  defaultStreamerCommandFactory,
  type StreamerCommandFactory,
  type StreamerUiCommand,
} from "./streamer-commands";

import styles from "./live-director-controls.module.css";

export interface LiveDirectorControlsProps {
  readonly view: StreamerViewModel;
  readonly compact?: boolean;
  readonly pending?: boolean;
  readonly onCommand?: (command: StreamerUiCommand) => void;
  readonly commandFactory?: StreamerCommandFactory;
}

const sourceLabels: Readonly<Record<LiveContextSourceClass, string>> = {
  "streamer-declared": "Streamer says",
  "gameplay-observed": "ChatXPT detects",
  "audience-derived": "Chat suggests",
};

const sourceDescriptions: Readonly<Record<LiveContextSourceClass, string>> = {
  "streamer-declared": "Only the goal and objective the streamer explicitly saved.",
  "gameplay-observed": "Normalised gameplay observations, never invented advice.",
  "audience-derived": "A short-lived aggregate; no raw chat, usernames, or viewer IDs.",
};

const cueLabels: Readonly<Record<DirectorCueAction, string>> = {
  acknowledge: "Acknowledge",
  "turn-into-vote": "Turn into vote",
  later: "Later",
  dismiss: "Dismiss",
};

function titleCase(value: string): string {
  return value
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function statusTone(status: LiveContextFact["status"]): StatusTone {
  if (status === "known") return "success";
  if (status === "stale" || status === "conflicting") return "warning";
  if (status === "permission-denied") return "danger";
  return "neutral";
}

function factValue(fact: LiveContextFact): string {
  if (fact.value !== null) return String(fact.value);
  if (fact.status === "permission-denied") return "Permission is not available.";
  if (fact.status === "conflicting") return "Signals conflict; no conclusion was retained.";
  if (fact.status === "stale") return "The last observation is stale.";
  return "Unknown; ChatXPT will not guess.";
}

function SourceCard({
  sourceClass,
  facts,
  view,
}: {
  readonly sourceClass: LiveContextSourceClass;
  readonly facts: readonly LiveContextFact[];
  readonly view: StreamerViewModel;
}) {
  const pointer = view.liveDirector?.audiencePointer ?? null;
  return (
    <Card className={styles.sourceCard}>
      <div>
        <h3>{sourceLabels[sourceClass]}</h3>
        <p>{sourceDescriptions[sourceClass]}</p>
      </div>
      {facts.length === 0 ? (
        <div className={styles.fact}>
          <StatusBadge tone="neutral">Unknown</StatusBadge>
          <strong>No trusted fact is available.</strong>
        </div>
      ) : facts.map((fact) => (
        <div className={styles.fact} key={fact.factId}>
          <ControlRow>
            <small>{titleCase(fact.kind)}</small>
            <StatusBadge tone={statusTone(fact.status)}>{titleCase(fact.status)}</StatusBadge>
          </ControlRow>
          <strong>{factValue(fact)}</strong>
          <small>{`${Math.round(fact.confidence * 100)}% confidence · ${fact.evidenceClass === "live" ? "Live signal" : "Unconfirmed signal"}`}</small>
        </div>
      ))}
      {sourceClass === "audience-derived" && pointer !== null ? (
        pointer.status === "known" || pointer.status === "stale" ? (
          <small className={styles.pointerMeta}>
            {`${pointer.uniqueParticipants} unique participants · ${pointer.qualifyingMessages} qualifying messages`}
          </small>
        ) : (
          <small className={styles.pointerMeta}>{pointer.reason}</small>
        )
      ) : null}
    </Card>
  );
}

function DirectorCueCard({
  view,
  pending,
  onCommand,
  commandFactory,
}: Required<Pick<LiveDirectorControlsProps, "view" | "pending" | "commandFactory">> &
  Pick<LiveDirectorControlsProps, "onCommand">) {
  const cue = view.liveDirector?.cue ?? null;
  if (cue === null) {
    return (
      <Notice title="No Director Cue">
        ChatXPT has no fresh private suggestion. Existing sidequest controls remain available.
      </Notice>
    );
  }
  const actionable = cue.availableActions.length > 0;
  return (
    <Card className={styles.cueCard}>
      <ControlRow>
        <div>
          <small>Director Cue</small>
          <h3>{actionable ? "A private moment to consider" : titleCase(cue.state)}</h3>
        </div>
        <StatusBadge tone={actionable ? "info" : cue.state === "stale" || cue.state === "expired" ? "warning" : "neutral"}>
          {titleCase(cue.state)}
        </StatusBadge>
      </ControlRow>
      <p>{cue.reason}</p>
      {actionable ? (
        <>
          <div className={styles.cueActions}>
            {cue.availableActions.map((action) => (
              <Button
                key={action}
                variant={action === "turn-into-vote" ? "primary" : action === "dismiss" ? "ghost" : "secondary"}
                disabled={onCommand === undefined || pending}
                onClick={() => onCommand?.(
                  buildLiveDirectorCueCommand(view, cue.cueId, action, commandFactory),
                )}
              >
                {cueLabels[action]}
              </Button>
            ))}
          </div>
          <small>
            Turn into vote prepares exactly three private quest options for approval before viewers can see them; it does not publish candidates by itself.
          </small>
        </>
      ) : (
        <small>This cue has no available action. ChatXPT will not replay stale controls.</small>
      )}
    </Card>
  );
}

function IntentEditor({
  view,
  pending,
  onCommand,
  commandFactory,
}: Required<Pick<LiveDirectorControlsProps, "view" | "pending" | "commandFactory">> &
  Pick<LiveDirectorControlsProps, "onCommand">) {
  const current = view.liveDirector?.declaredIntent;
  const voiceContextHeadingId = useId();
  const retained = current?.status === "known" || current?.status === "stale" ? current : null;
  const [goal, setGoal] = useState(retained?.goal ?? "");
  const [objective, setObjective] = useState(retained?.objective ?? "");
  const [involvement, setInvolvement] = useState(retained?.desiredAudienceInvolvement ?? "");
  const [objectiveInputMethod, setObjectiveInputMethod] = useState<"manual" | "speech">(
    retained?.inputMethod ?? "manual",
  );
  const [objectiveConfidence, setObjectiveConfidence] = useState(retained?.confidence ?? 1);
  const [speechStatus, setSpeechStatus] = useState<
    "unavailable" | "idle" | "listening" | "processing" | "captured" | "error"
  >("idle");
  const [speechTranscript, setSpeechTranscript] = useState<StreamerSpeechTranscript | null>(null);
  const [speechFailure, setSpeechFailure] = useState<StreamerSpeechFailure | null>(null);
  const speechSession = useRef<StreamerSpeechSession | null>(null);
  const latestSpeechTranscript = useRef<StreamerSpeechTranscript | null>(null);
  const speechFailed = useRef(false);
  const ignoreSpeechAbort = useRef(false);

  useEffect(() => {
    return () => {
      ignoreSpeechAbort.current = true;
      speechSession.current?.abort();
      speechSession.current = null;
    };
  }, []);

  function startListening() {
    if (!browserSpeechRecognitionAvailable()) {
      setSpeechFailure({
        code: "service-unavailable",
        message: "Voice input is not available in this browser. Type the objective instead.",
      });
      setSpeechStatus("unavailable");
      return;
    }
    latestSpeechTranscript.current = null;
    speechFailed.current = false;
    ignoreSpeechAbort.current = false;
    setSpeechTranscript(null);
    setSpeechFailure(null);
    try {
      speechSession.current = startBrowserSpeechRecognition({
        onListening() {
          setSpeechStatus("listening");
        },
        onTranscript(transcript) {
          latestSpeechTranscript.current = transcript;
          setSpeechTranscript(transcript);
        },
        onFailure(failure) {
          if (failure.code === "aborted" && ignoreSpeechAbort.current) return;
          speechFailed.current = true;
          setSpeechFailure(failure);
          setSpeechStatus("error");
        },
        onEnd() {
          speechSession.current = null;
          if (speechFailed.current || ignoreSpeechAbort.current) return;
          setSpeechStatus(latestSpeechTranscript.current?.isFinal ? "captured" : "idle");
        },
      });
      setSpeechStatus("listening");
    } catch {
      setSpeechFailure({
        code: "service-unavailable",
        message: "Voice input is not available in this browser. Type the objective instead.",
      });
      setSpeechStatus("unavailable");
    }
  }

  function stopListening() {
    if (speechSession.current === null) return;
    setSpeechStatus("processing");
    speechSession.current.stop();
  }

  function useSpeechTranscript() {
    if (speechTranscript === null || !speechTranscript.isFinal) return;
    if (speechTranscript.transcript.length < 3 || speechTranscript.transcript.length > 240) return;
    setObjective(speechTranscript.transcript);
    if (speechTranscript.confidence >= MIN_CONFIRMED_STREAMER_SPEECH_CONFIDENCE) {
      setObjectiveInputMethod("speech");
      setObjectiveConfidence(speechTranscript.confidence);
    } else {
      // Explicit review turns an uncertain recognition into a manual declaration.
      setObjectiveInputMethod("manual");
      setObjectiveConfidence(1);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCommand?.(buildLiveDirectorIntentCommand(view, {
      goal,
      objective,
      desiredAudienceInvolvement: involvement.trim() === "" ? null : involvement,
      inputMethod: objectiveInputMethod,
      confidence: objectiveConfidence,
    }, commandFactory));
  }

  const speechUsable =
    speechStatus === "captured" &&
    speechTranscript?.isFinal === true &&
    speechTranscript.transcript.length >= 3 &&
    speechTranscript.transcript.length <= 240;
  const speechLowConfidence =
    speechTranscript?.isFinal === true &&
    speechTranscript.confidence < MIN_CONFIRMED_STREAMER_SPEECH_CONFIDENCE;
  const speechStatusLabels = {
    unavailable: "Unavailable",
    idle: "Ready",
    listening: "Listening",
    processing: "Finishing",
    captured: "Review",
    error: "Needs attention",
  } as const;
  const speechStatusTone: StatusTone =
    speechStatus === "captured" ? "success"
      : speechStatus === "listening" || speechStatus === "processing" ? "info"
        : speechStatus === "error" ? "danger"
          : speechStatus === "unavailable" ? "warning" : "neutral";

  return (
    <form className={styles.intentForm} onSubmit={submit}>
      <label>
        <span>Session Goal</span>
        <input
          value={goal}
          minLength={3}
          maxLength={120}
          required
          disabled={pending || onCommand === undefined}
          onChange={(event) => setGoal(event.currentTarget.value)}
        />
      </label>
      <label>
        <span>Current Objective</span>
        <textarea
          value={objective}
          minLength={3}
          maxLength={240}
          rows={3}
          required
          disabled={pending || onCommand === undefined}
          onChange={(event) => {
            setObjective(event.currentTarget.value);
            setObjectiveInputMethod("manual");
            setObjectiveConfidence(1);
          }}
        />
        <small>
          {objectiveInputMethod === "speech"
            ? `Confirmed voice transcript · ${Math.round(objectiveConfidence * 100)}% recognition confidence`
            : "Typed or manually confirmed by the streamer"}
        </small>
      </label>
      <section className={styles.speechPanel} aria-labelledby={voiceContextHeadingId}>
        <ControlRow>
          <div>
            <strong id={voiceContextHeadingId}>Voice context</strong>
            <small>Capture a spoken goal or broad activity, then review it before saving.</small>
          </div>
          <StatusBadge tone={speechStatusTone}>{speechStatusLabels[speechStatus]}</StatusBadge>
        </ControlRow>
        <div className={styles.speechActions}>
          {speechStatus === "listening" || speechStatus === "processing" ? (
            <Button
              variant="secondary"
              disabled={speechStatus === "processing" || pending}
              onClick={stopListening}
            >
              {speechStatus === "processing" ? "Finishing…" : "Stop listening"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={speechStatus === "unavailable" || pending}
              onClick={startListening}
            >
              Start listening
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={!speechUsable || pending}
            onClick={useSpeechTranscript}
          >
            {speechLowConfidence ? "Review as typed objective" : "Use as current objective"}
          </Button>
        </div>
        <div className={styles.transcript} aria-live="polite">
          <small>Transcript</small>
          <strong>{speechTranscript?.transcript || "Nothing captured yet."}</strong>
          {speechTranscript !== null ? (
            <small>
              {speechTranscript.isFinal
                ? `${Math.round(speechTranscript.confidence * 100)}% recognition confidence`
                : "Listening result is still changing"}
            </small>
          ) : null}
        </div>
        {speechLowConfidence ? (
          <Notice tone="warning" title="Check the transcript carefully">
            Recognition confidence is low. Using it places the text in the objective editor as a manual declaration so you can correct it before saving.
          </Notice>
        ) : null}
        {speechTranscript !== null && speechTranscript.transcript.length > 240 ? (
          <Notice tone="warning" title="Transcript is too long">
            Keep the Current Objective under 240 characters, then try a shorter statement.
          </Notice>
        ) : null}
        {speechFailure !== null ? (
          <Notice tone="danger" title="Voice input needs attention">{speechFailure.message}</Notice>
        ) : null}
        <small className={styles.speechPrivacy}>
          Your browser may recognise speech on this device or through its own speech service. ChatXPT does not store raw microphone audio and never changes the objective until you confirm it.
        </small>
      </section>
      <label>
        <span>Desired audience involvement <small>(optional)</small></span>
        <input
          value={involvement}
          maxLength={160}
          disabled={pending || onCommand === undefined}
          onChange={(event) => setInvolvement(event.currentTarget.value)}
        />
      </label>
      <div className={styles.intentActions}>
        <Button type="submit" disabled={pending || onCommand === undefined}>Save live intent</Button>
        {retained !== null ? (
          <Button
            variant="ghost"
            disabled={pending || onCommand === undefined}
            onClick={() => onCommand?.(buildLiveDirectorIntentCommand(view, null, commandFactory))}
          >
            Clear live intent
          </Button>
        ) : null}
      </div>
      <small>Live intent expires automatically and never rewrites saved profile defaults.</small>
    </form>
  );
}

export function LiveDirectorControls({
  view,
  compact = false,
  pending = false,
  onCommand,
  commandFactory = defaultStreamerCommandFactory,
}: LiveDirectorControlsProps) {
  const state = view.liveDirector ?? null;
  const intent = state?.declaredIntent ?? null;
  const retainedIntent = intent?.status === "known" || intent?.status === "stale" ? intent : null;
  const facts = state?.liveContext?.facts ?? [];
  const sourceClasses = [
    "streamer-declared",
    "gameplay-observed",
    "audience-derived",
  ] as const satisfies readonly LiveContextSourceClass[];

  return (
    <div className={styles.workspace} data-compact={compact || undefined}>
      {view.session.status !== "live" ? (
        <Notice tone="warning" title="Live Director is not live">
          This is the last stream snapshot. Controls remain unavailable when the session is not ready.
        </Notice>
      ) : null}
      <Card className={styles.intentCard}>
        <ControlRow>
          <div>
            <small>Streamer-declared direction</small>
            <h3>{retainedIntent?.goal ?? "Session Goal not set"}</h3>
          </div>
          <StatusBadge tone={intent?.status === "known" ? "success" : intent?.status === "stale" ? "warning" : "neutral"}>
            {intent === null ? "Unavailable" : titleCase(intent.status)}
          </StatusBadge>
        </ControlRow>
        <p>{retainedIntent?.objective ?? "Current Objective is unknown until the streamer declares it."}</p>
        {retainedIntent?.desiredAudienceInvolvement ? (
          <small>{`Audience involvement: ${retainedIntent.desiredAudienceInvolvement}`}</small>
        ) : null}
        {retainedIntent?.inputMethod === "speech" ? (
          <small>{`Confirmed from voice · ${Math.round(retainedIntent.confidence * 100)}% recognition confidence`}</small>
        ) : null}
        {!compact ? (
          <IntentEditor
            key={retainedIntent?.intentId ?? `intent-${intent?.status ?? "missing"}`}
            view={view}
            pending={pending}
            onCommand={onCommand}
            commandFactory={commandFactory}
          />
        ) : null}
      </Card>

      <div>
        <ControlRow>
          <div>
            <small>Private Live Context</small>
            <h3>Sources stay separate</h3>
          </div>
          <StatusBadge tone={state?.liveContext ? "info" : "neutral"}>
            {state?.liveContext ? "Authoritative" : "Unknown"}
          </StatusBadge>
        </ControlRow>
        <CardGrid className={styles.sourceGrid}>
          {sourceClasses.map((sourceClass) => (
            <SourceCard
              key={sourceClass}
              sourceClass={sourceClass}
              facts={facts.filter((fact) => fact.sourceClass === sourceClass)}
              view={view}
            />
          ))}
        </CardGrid>
      </div>

      <DirectorCueCard
        view={view}
        pending={pending}
        onCommand={onCommand}
        commandFactory={commandFactory}
      />

      <small className={styles.privacyNote}>
        Private broadcaster view · raw chat, usernames, viewer identifiers, and provider payloads are not retained here.
      </small>
    </div>
  );
}
