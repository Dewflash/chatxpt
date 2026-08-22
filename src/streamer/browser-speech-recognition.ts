export type StreamerSpeechFailureCode =
  | "no-speech"
  | "microphone-unavailable"
  | "network"
  | "permission-denied"
  | "service-unavailable"
  | "language-unsupported"
  | "aborted"
  | "unknown";

export interface StreamerSpeechFailure {
  readonly code: StreamerSpeechFailureCode;
  readonly message: string;
}

export interface StreamerSpeechTranscript {
  readonly transcript: string;
  readonly finalTranscript: string;
  readonly interimTranscript: string;
  readonly confidence: number;
  readonly isFinal: boolean;
}

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
  item?(index: number): SpeechRecognitionAlternativeLike | null;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
  item?(index: number): SpeechRecognitionResultLike | null;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

export interface BrowserSpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognitionLike;

export interface BrowserSpeechRecognitionRoot {
  readonly SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  readonly webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
}

export interface StreamerSpeechSession {
  stop(): void;
  abort(): void;
}

export interface StartStreamerSpeechRecognitionOptions {
  readonly language?: string;
  readonly onListening?: () => void;
  readonly onTranscript: (transcript: StreamerSpeechTranscript) => void;
  readonly onFailure: (failure: StreamerSpeechFailure) => void;
  readonly onEnd: () => void;
}

function resultAt(
  results: SpeechRecognitionResultListLike,
  index: number,
): SpeechRecognitionResultLike | null {
  return results.item?.(index) ?? results[index] ?? null;
}

function alternativeAt(
  result: SpeechRecognitionResultLike,
  index: number,
): SpeechRecognitionAlternativeLike | null {
  return result.item?.(index) ?? result[index] ?? null;
}

function normaliseTranscript(parts: readonly string[]): string {
  return parts.join(" ").replace(/\s+/gu, " ").trim();
}

function normaliseConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function readSpeechRecognitionEvent(
  event: SpeechRecognitionEventLike,
): StreamerSpeechTranscript {
  const finalParts: string[] = [];
  const interimParts: string[] = [];
  const finalConfidences: number[] = [];
  const interimConfidences: number[] = [];

  for (let index = 0; index < event.results.length; index += 1) {
    const result = resultAt(event.results, index);
    if (result === null || result.length === 0) continue;
    const alternative = alternativeAt(result, 0);
    if (alternative === null) continue;
    const transcript = alternative.transcript.trim();
    if (transcript === "") continue;
    if (result.isFinal) {
      finalParts.push(transcript);
      finalConfidences.push(normaliseConfidence(alternative.confidence));
    } else {
      interimParts.push(transcript);
      interimConfidences.push(normaliseConfidence(alternative.confidence));
    }
  }

  const finalTranscript = normaliseTranscript(finalParts);
  const interimTranscript = normaliseTranscript(interimParts);
  const transcript = normaliseTranscript([finalTranscript, interimTranscript].filter(Boolean));
  const confidences = finalConfidences.length > 0 ? finalConfidences : interimConfidences;
  const confidence = confidences.length === 0
    ? 0
    : confidences.reduce((total, value) => total + value, 0) / confidences.length;

  return {
    transcript,
    finalTranscript,
    interimTranscript,
    confidence,
    isFinal: finalTranscript !== "" && interimTranscript === "",
  };
}

export function describeSpeechRecognitionFailure(error: string): StreamerSpeechFailure {
  const failures: Readonly<Record<string, StreamerSpeechFailure>> = {
    "no-speech": {
      code: "no-speech",
      message: "No speech was detected. Check the microphone and try again.",
    },
    "audio-capture": {
      code: "microphone-unavailable",
      message: "ChatXPT cannot access a working microphone.",
    },
    network: {
      code: "network",
      message: "Speech recognition could not reach the browser's recognition service.",
    },
    "not-allowed": {
      code: "permission-denied",
      message: "Microphone permission was blocked. Allow it in the browser, then try again.",
    },
    "service-not-allowed": {
      code: "service-unavailable",
      message: "The browser's speech recognition service is not available here.",
    },
    "language-not-supported": {
      code: "language-unsupported",
      message: "The browser's speech service does not support this language.",
    },
    aborted: {
      code: "aborted",
      message: "Listening stopped before a final transcript was ready.",
    },
  };
  return failures[error] ?? {
    code: "unknown",
    message: "Speech recognition failed. Try again or type the objective instead.",
  };
}

function recognitionConstructor(
  root: BrowserSpeechRecognitionRoot,
): BrowserSpeechRecognitionConstructor | null {
  return root.SpeechRecognition ?? root.webkitSpeechRecognition ?? null;
}

export function browserSpeechRecognitionAvailable(
  root: BrowserSpeechRecognitionRoot = globalThis as unknown as BrowserSpeechRecognitionRoot,
): boolean {
  return recognitionConstructor(root) !== null;
}

export function startBrowserSpeechRecognition(
  options: StartStreamerSpeechRecognitionOptions,
  root: BrowserSpeechRecognitionRoot = globalThis as unknown as BrowserSpeechRecognitionRoot,
): StreamerSpeechSession {
  const Recognition = recognitionConstructor(root);
  if (Recognition === null) {
    throw new Error("Browser speech recognition is unavailable");
  }

  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  if (options.language !== undefined) recognition.lang = options.language;
  recognition.onstart = () => options.onListening?.();
  recognition.onresult = (event) => options.onTranscript(readSpeechRecognitionEvent(event));
  recognition.onerror = (event) => options.onFailure(describeSpeechRecognitionFailure(event.error));
  recognition.onend = options.onEnd;
  recognition.start();

  return {
    stop() {
      recognition.stop();
    },
    abort() {
      recognition.abort();
    },
  };
}
