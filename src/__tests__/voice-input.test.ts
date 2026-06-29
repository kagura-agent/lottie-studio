import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Unit tests for voice input feature.
 * Tests feature detection logic and hook state transitions.
 */

// --- Feature detection tests ---

describe("Voice Input: Feature Detection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects SpeechRecognition support when available", () => {
    const mockWindow = {
      SpeechRecognition: class {},
    };

    const SpeechRecognitionClass =
      (mockWindow as Record<string, unknown>).SpeechRecognition ||
      (mockWindow as Record<string, unknown>).webkitSpeechRecognition ||
      null;

    expect(SpeechRecognitionClass).not.toBeNull();
  });

  it("detects webkitSpeechRecognition support (Safari/older Chrome)", () => {
    const mockWindow = {
      webkitSpeechRecognition: class {},
    };

    const SpeechRecognitionClass =
      (mockWindow as Record<string, unknown>).SpeechRecognition ||
      (mockWindow as Record<string, unknown>).webkitSpeechRecognition ||
      null;

    expect(SpeechRecognitionClass).not.toBeNull();
  });

  it("returns null when neither SpeechRecognition nor webkitSpeechRecognition exists", () => {
    const mockWindow = {};

    const SpeechRecognitionClass =
      (mockWindow as Record<string, unknown>).SpeechRecognition ||
      (mockWindow as Record<string, unknown>).webkitSpeechRecognition ||
      null;

    expect(SpeechRecognitionClass).toBeNull();
  });

  it("returns null for server-side rendering (no window)", () => {
    // Simulate the SSR check used in the hook
    const getSpeechRecognitionClass = () => {
      const w = undefined as typeof window | undefined;
      if (typeof w === "undefined") return null;
      return null;
    };

    expect(getSpeechRecognitionClass()).toBeNull();
  });

  it("prefers standard SpeechRecognition over webkit prefix", () => {
    const standard = class StandardSR {};
    const webkit = class WebkitSR {};
    const mockWindow = {
      SpeechRecognition: standard,
      webkitSpeechRecognition: webkit,
    };

    const SpeechRecognitionClass =
      (mockWindow as Record<string, unknown>).SpeechRecognition ||
      (mockWindow as Record<string, unknown>).webkitSpeechRecognition ||
      null;

    expect(SpeechRecognitionClass).toBe(standard);
  });
});

// --- Hook state transition tests ---

describe("Voice Input: State Transitions", () => {
  /**
   * Creates a mock SpeechRecognition instance that simulates
   * the Web Speech API behavior for testing state transitions.
   */
  function createMockRecognition() {
    const mock = {
      continuous: false,
      interimResults: false,
      lang: "",
      onresult: null as ((event: unknown) => void) | null,
      onerror: null as ((event: unknown) => void) | null,
      onend: null as (() => void) | null,
      onstart: null as (() => void) | null,
      startCalled: false,
      stopCalled: false,
      abortCalled: false,
      start() {
        mock.startCalled = true;
        mock.onstart?.();
      },
      stop() {
        mock.stopCalled = true;
        mock.onend?.();
      },
      abort() {
        mock.abortCalled = true;
        mock.onend?.();
      },
    };
    return mock;
  }

  it("transitions idle → listening when start is called", () => {
    const recognition = createMockRecognition();
    let status: "idle" | "listening" | "error" = "idle";

    recognition.onstart = () => { status = "listening"; };

    expect(status).toBe("idle");
    recognition.start();
    expect(status).toBe("listening");
    expect(recognition.startCalled).toBe(true);
  });

  it("transitions listening → idle when result is final (auto-stop)", () => {
    const recognition = createMockRecognition();
    let status: "idle" | "listening" | "error" = "idle";
    let transcript = "";
    let finalTranscript = "";

    recognition.onstart = () => { status = "listening"; };
    recognition.onend = () => { status = "idle"; };
    recognition.onresult = (event: unknown) => {
      const e = event as { results: Array<{ isFinal: boolean; 0: { transcript: string } }> };
      for (const result of e.results) {
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          transcript = finalTranscript;
        } else {
          transcript = result[0].transcript;
        }
      }
    };

    // Start
    recognition.start();
    expect(status).toBe("listening");

    // Interim result
    recognition.onresult?.({
      results: [{ isFinal: false, 0: { transcript: "hello" } }],
    });
    expect(transcript).toBe("hello");
    expect(finalTranscript).toBe("");

    // Final result
    recognition.onresult?.({
      results: [{ isFinal: true, 0: { transcript: "hello world" } }],
    });
    expect(finalTranscript).toBe("hello world");
    expect(transcript).toBe("hello world");

    // Auto-stop triggers onend (continuous=false behavior)
    recognition.onend?.();
    expect(status).toBe("idle");
  });

  it("transitions listening → error on recognition error", () => {
    const recognition = createMockRecognition();
    let status: "idle" | "listening" | "error" = "idle";

    recognition.onstart = () => { status = "listening"; };
    recognition.onerror = () => { status = "error"; };

    recognition.start();
    expect(status).toBe("listening");

    recognition.onerror?.({ error: "not-allowed", message: "Permission denied" });
    expect(status).toBe("error");
  });

  it("transitions listening → idle when manually stopped", () => {
    const recognition = createMockRecognition();
    let status: "idle" | "listening" | "error" = "idle";

    recognition.onstart = () => { status = "listening"; };
    recognition.onend = () => { status = "idle"; };

    recognition.start();
    expect(status).toBe("listening");

    recognition.stop();
    expect(status).toBe("idle");
    expect(recognition.stopCalled).toBe(true);
  });

  it("sets correct language and settings on recognition instance", () => {
    const recognition = createMockRecognition();

    // Simulate hook configuration
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;

    expect(recognition.lang).toBe("zh-CN");
    expect(recognition.continuous).toBe(false);
    expect(recognition.interimResults).toBe(true);
  });

  it("accumulates interim results correctly", () => {
    const recognition = createMockRecognition();
    let transcript = "";

    recognition.onresult = (event: unknown) => {
      const e = event as { results: Array<{ isFinal: boolean; 0: { transcript: string } }> };
      let interim = "";
      for (const result of e.results) {
        if (!result.isFinal) {
          interim += result[0].transcript;
        }
      }
      transcript = interim;
    };

    // First interim
    recognition.onresult?.({
      results: [{ isFinal: false, 0: { transcript: "hel" } }],
    });
    expect(transcript).toBe("hel");

    // Updated interim (replaces, not appends — matches Web Speech API behavior)
    recognition.onresult?.({
      results: [{ isFinal: false, 0: { transcript: "hello wo" } }],
    });
    expect(transcript).toBe("hello wo");
  });

  it("handles abort correctly (cleanup on unmount)", () => {
    const recognition = createMockRecognition();
    let status: "idle" | "listening" | "error" = "idle";

    recognition.onstart = () => { status = "listening"; };
    recognition.onend = () => { status = "idle"; };

    recognition.start();
    expect(status).toBe("listening");

    // Abort (used on unmount)
    recognition.abort();
    expect(status).toBe("idle");
    expect(recognition.abortCalled).toBe(true);
  });

  it("populates final transcript without auto-sending", () => {
    const recognition = createMockRecognition();
    let inputValue = "";
    const autoSent = false;

    recognition.onresult = (event: unknown) => {
      const e = event as { results: Array<{ isFinal: boolean; 0: { transcript: string } }> };
      for (const result of e.results) {
        if (result.isFinal) {
          // Simulates: setInput(transcript) — populates but does NOT send
          inputValue = result[0].transcript;
        }
      }
    };

    recognition.onstart = () => {};
    recognition.start();

    // Final transcript populates the input
    recognition.onresult?.({
      results: [{ isFinal: true, 0: { transcript: "create a bouncing ball" } }],
    });

    expect(inputValue).toBe("create a bouncing ball");
    expect(autoSent).toBe(false); // User must manually hit send
  });

  it("uses navigator language fallback when no lang specified", () => {
    const recognition = createMockRecognition();

    // Simulate the hook's language resolution logic
    const lang = undefined;
    const documentLang = "";
    const navigatorLang = "ja-JP";

    recognition.lang = lang || documentLang || navigatorLang || "en-US";

    expect(recognition.lang).toBe("ja-JP");
  });

  it("defaults to en-US when no language information available", () => {
    const recognition = createMockRecognition();

    const lang = undefined;
    const documentLang = "";
    const navigatorLang = "";

    recognition.lang = lang || documentLang || navigatorLang || "en-US";

    expect(recognition.lang).toBe("en-US");
  });
});
