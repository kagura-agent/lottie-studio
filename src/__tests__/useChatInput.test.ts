// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatInput } from "@/hooks/chat/useChatInput";

vi.mock("@/lib/importLottie", () => ({
  parseLottieFile: vi.fn(),
}));

vi.mock("@/lib/apiFetch", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/chat-types", () => ({
  SUPPORTED_TYPES: ["image/png", "image/jpeg"],
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,
  MAX_ANIMATION_FILE_SIZE: 10 * 1024 * 1024,
  ANIMATION_EXTENSIONS: [".json", ".svg", ".lottie"],
  LOTTIE_REQUIRED_FIELDS: ["v", "fr", "ip", "op", "w", "h", "layers"],
}));

function makeOptions(overrides = {}) {
  return {
    input: "",
    setInput: vi.fn(),
    setPendingImage: vi.fn(),
    setError: vi.fn(),
    setMessages: vi.fn(),
    setCurrentAnimationId: vi.fn(),
    onAnimationCreated: vi.fn(),
    handleSend: vi.fn().mockResolvedValue(undefined),
    insertText: undefined as string | undefined,
    t: (key: string) => key,
    ...overrides,
  };
}

describe("useChatInput", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "visualViewport", {
      value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      writable: true,
    });
  });

  it("initializes with drag and autocomplete state", () => {
    const { result } = renderHook(() => useChatInput(makeOptions()));
    expect(result.current.isDragOver).toBe(false);
    expect(result.current.showAutocomplete).toBe(false);
    expect(result.current.autocompleteQuery).toBe("");
  });

  it("shows autocomplete when input starts with /", () => {
    const { result, rerender } = renderHook(
      (props) => useChatInput(props),
      { initialProps: makeOptions({ input: "" }) }
    );

    rerender(makeOptions({ input: "/sty" }));
    expect(result.current.showAutocomplete).toBe(true);
    expect(result.current.autocompleteQuery).toBe("/sty");
  });

  it("hides autocomplete when input has a space after command", () => {
    const { result, rerender } = renderHook(
      (props) => useChatInput(props),
      { initialProps: makeOptions({ input: "/style" }) }
    );

    rerender(makeOptions({ input: "/style neon" }));
    expect(result.current.showAutocomplete).toBe(false);
  });

  it("handleAutocompleteSelect sets input to command", () => {
    const setInput = vi.fn();
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ setInput }))
    );

    act(() => {
      result.current.handleAutocompleteSelect({ command: "/play", description: "Play", hasParams: false });
    });

    expect(setInput).toHaveBeenCalledWith("/play");
  });

  it("handleAutocompleteSelect appends space for commands with params", () => {
    const setInput = vi.fn();
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ setInput }))
    );

    act(() => {
      result.current.handleAutocompleteSelect({ command: "/style", description: "Style", hasParams: true });
    });

    expect(setInput).toHaveBeenCalledWith("/style ");
  });

  it("handleKeyDown calls handleSend on Enter without shift", () => {
    const handleSend = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ handleSend }))
    );

    const event = { key: "Enter", shiftKey: false, preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(handleSend).toHaveBeenCalled();
  });

  it("handleKeyDown does not send on Shift+Enter", () => {
    const handleSend = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ handleSend }))
    );

    const event = { key: "Enter", shiftKey: true, preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(handleSend).not.toHaveBeenCalled();
  });

  it("processImageFile rejects unsupported types", () => {
    const setError = vi.fn();
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ setError }))
    );

    const file = new File(["data"], "test.bmp", { type: "image/bmp" });
    act(() => {
      result.current.processImageFile(file);
    });

    expect(setError).toHaveBeenCalledWith("unsupportedType");
  });

  it("processImageFile rejects oversized files", () => {
    const setError = vi.fn();
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ setError }))
    );

    const bigData = new Uint8Array(6 * 1024 * 1024);
    const file = new File([bigData], "big.png", { type: "image/png" });
    act(() => {
      result.current.processImageFile(file);
    });

    expect(setError).toHaveBeenCalledWith("imageTooBig");
  });

  it("handleDragOver sets isDragOver to true", () => {
    const { result } = renderHook(() => useChatInput(makeOptions()));

    const event = { preventDefault: vi.fn() } as unknown as React.DragEvent;
    act(() => {
      result.current.handleDragOver(event);
    });

    expect(result.current.isDragOver).toBe(true);
  });

  it("handleDragLeave sets isDragOver to false", () => {
    const { result } = renderHook(() => useChatInput(makeOptions()));

    act(() => {
      result.current.handleDragOver({ preventDefault: vi.fn() } as unknown as React.DragEvent);
    });
    act(() => {
      result.current.handleDragLeave({ preventDefault: vi.fn() } as unknown as React.DragEvent);
    });

    expect(result.current.isDragOver).toBe(false);
  });
});
