import { describe, expect, it } from "vitest";

import {
  browserSpeechRecognitionAvailable,
  describeSpeechRecognitionFailure,
  readSpeechRecognitionEvent,
  startBrowserSpeechRecognition,
  type BrowserSpeechRecognitionLike,
  type BrowserSpeechRecognitionRoot,
  type SpeechRecognitionEventLike,
  type StreamerSpeechFailure,
  type StreamerSpeechTranscript,
} from "./browser-speech-recognition";

class FakeSpeechRecognition implements BrowserSpeechRecognitionLike {
  static latest: FakeSpeechRecognition | null = null;

  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: ((event: { readonly error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  aborted = false;

  constructor() {
    FakeSpeechRecognition.latest = this;
  }

  start() {
    this.started = true;
    this.onstart?.();
  }

  stop() {
    this.stopped = true;
  }

  abort() {
    this.aborted = true;
  }
}

function result(
  transcript: string,
  confidence: number,
  isFinal: boolean,
) {
  const alternatives = [{ transcript, confidence }];
  return Object.assign(alternatives, {
    isFinal,
    item(index: number) {
      return alternatives[index] ?? null;
    },
  });
}

function event(...results: ReturnType<typeof result>[]): SpeechRecognitionEventLike {
  return {
    resultIndex: 0,
    results: Object.assign(results, {
      item(index: number) {
        return results[index] ?? null;
      },
    }),
  };
}

describe("browser streamer speech recognition", () => {
  it("reads separate final and interim text without claiming interim words are final", () => {
    expect(readSpeechRecognitionEvent(event(
      result("I am building", 0.8, true),
      result("a house", 0.6, false),
    ))).toEqual({
      transcript: "I am building a house",
      finalTranscript: "I am building",
      interimTranscript: "a house",
      confidence: 0.8,
      isFinal: false,
    });

    expect(readSpeechRecognitionEvent(event(
      result("I am building", 0.8, true),
      result("a house", 0.6, true),
    ))).toEqual({
      transcript: "I am building a house",
      finalTranscript: "I am building a house",
      interimTranscript: "",
      confidence: 0.7,
      isFinal: true,
    });
  });

  it("supports standard and prefixed browser constructors", () => {
    expect(browserSpeechRecognitionAvailable({ SpeechRecognition: FakeSpeechRecognition })).toBe(true);
    expect(browserSpeechRecognitionAvailable({ webkitSpeechRecognition: FakeSpeechRecognition })).toBe(true);
    expect(browserSpeechRecognitionAvailable({})).toBe(false);
  });

  it("configures explicit continuous listening and reports only bounded transcript data", () => {
    const transcripts: StreamerSpeechTranscript[] = [];
    const failures: StreamerSpeechFailure[] = [];
    let listening = false;
    let ended = false;
    const root: BrowserSpeechRecognitionRoot = { SpeechRecognition: FakeSpeechRecognition };

    const session = startBrowserSpeechRecognition({
      language: "en-SG",
      onListening: () => { listening = true; },
      onTranscript: (transcript) => transcripts.push(transcript),
      onFailure: (failure) => failures.push(failure),
      onEnd: () => { ended = true; },
    }, root);
    const recognition = FakeSpeechRecognition.latest!;

    expect(recognition).toMatchObject({
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      lang: "en-SG",
      started: true,
    });
    expect(listening).toBe(true);

    recognition.onresult?.(event(result("I am going mining", 0.91, true)));
    expect(transcripts).toEqual([{
      transcript: "I am going mining",
      finalTranscript: "I am going mining",
      interimTranscript: "",
      confidence: 0.91,
      isFinal: true,
    }]);
    expect(JSON.stringify(transcripts)).not.toContain("audio");

    session.stop();
    expect(recognition.stopped).toBe(true);
    recognition.onend?.();
    expect(ended).toBe(true);
    expect(failures).toEqual([]);

    session.abort();
    expect(recognition.aborted).toBe(true);
  });

  it("turns browser failures into specific user-safe recovery copy", () => {
    expect(describeSpeechRecognitionFailure("not-allowed")).toEqual({
      code: "permission-denied",
      message: "Microphone permission was blocked. Allow it in the browser, then try again.",
    });
    expect(describeSpeechRecognitionFailure("network")).toMatchObject({ code: "network" });
    expect(describeSpeechRecognitionFailure("browser-secret-error")).toEqual({
      code: "unknown",
      message: "Speech recognition failed. Try again or type the objective instead.",
    });
  });
});
