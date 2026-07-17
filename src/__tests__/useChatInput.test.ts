// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatInput } from "@/hooks/chat/useChatInput";
import { parseLottieFile } from "@/lib/importLottie";
import { apiFetch } from "@/lib/apiFetch";

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

  it("hides autocomplete when input does not start with /", () => {
    const { result, rerender } = renderHook(
      (props) => useChatInput(props),
      { initialProps: makeOptions({ input: "/s" }) }
    );
    rerender(makeOptions({ input: "hello" }));
    expect(result.current.showAutocomplete).toBe(false);
    expect(result.current.autocompleteQuery).toBe("");
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

  it("handleAutocompleteDismiss hides autocomplete", () => {
    const { result, rerender } = renderHook(
      (props) => useChatInput(props),
      { initialProps: makeOptions({ input: "" }) }
    );
    rerender(makeOptions({ input: "/s" }));
    expect(result.current.showAutocomplete).toBe(true);

    act(() => {
      result.current.handleAutocompleteDismiss();
    });
    expect(result.current.showAutocomplete).toBe(false);
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

  it("handleKeyDown passes through autocomplete keys when autocomplete is showing", () => {
    const handleSend = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      (props) => useChatInput(props),
      { initialProps: makeOptions({ input: "", handleSend }) }
    );

    rerender(makeOptions({ input: "/s", handleSend }));
    expect(result.current.showAutocomplete).toBe(true);

    for (const key of ["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"]) {
      const event = { key, shiftKey: false, preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
      act(() => {
        result.current.handleKeyDown(event);
      });
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
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

  it("processImageFile reads valid image as data URL", async () => {
    const setPendingImage = vi.fn();
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ setPendingImage }))
    );

    const file = new File(["imgdata"], "photo.png", { type: "image/png" });
    await act(async () => {
      result.current.processImageFile(file);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(setPendingImage).toHaveBeenCalled();
  });

  it("handlePaste processes image from clipboard", async () => {
    const setPendingImage = vi.fn();
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ setPendingImage }))
    );

    const file = new File(["imgdata"], "paste.png", { type: "image/png" });
    const event = {
      clipboardData: {
        items: [{ type: "image/png", getAsFile: () => file }],
      },
      preventDefault: vi.fn(),
    } as unknown as React.ClipboardEvent;

    await act(async () => {
      result.current.handlePaste(event);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(setPendingImage).toHaveBeenCalled();
  });

  it("handlePaste ignores non-image clipboard items", () => {
    const setPendingImage = vi.fn();
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ setPendingImage }))
    );

    const event = {
      clipboardData: {
        items: [{ type: "text/plain", getAsFile: () => null }],
      },
      preventDefault: vi.fn(),
    } as unknown as React.ClipboardEvent;

    act(() => {
      result.current.handlePaste(event);
    });

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(setPendingImage).not.toHaveBeenCalled();
  });

  it("handlePaste does nothing without clipboardData items", () => {
    const { result } = renderHook(() => useChatInput(makeOptions()));

    const event = {
      clipboardData: { items: null },
      preventDefault: vi.fn(),
    } as unknown as React.ClipboardEvent;

    act(() => {
      result.current.handlePaste(event);
    });
    expect(event.preventDefault).not.toHaveBeenCalled();
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

  it("handleDrop processes animation file", async () => {
    const setMessages = vi.fn();
    const setCurrentAnimationId = vi.fn();
    const onAnimationCreated = vi.fn();
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "anim-1" }),
    } as Response);

    const { result } = renderHook(() =>
      useChatInput(makeOptions({ setMessages, setCurrentAnimationId, onAnimationCreated }))
    );

    const lottie = JSON.stringify({ v: "5.0", fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [] });
    const file = new File([lottie], "anim.json", { type: "application/json" });
    const event = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [file] },
    } as unknown as React.DragEvent;

    await act(async () => {
      result.current.handleDrop(event);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.isDragOver).toBe(false);
    expect(setCurrentAnimationId).toHaveBeenCalledWith("anim-1");
  });

  it("handleDrop processes image file when no animation file found", async () => {
    const setPendingImage = vi.fn();
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ setPendingImage }))
    );

    const file = new File(["img"], "photo.png", { type: "image/png" });
    const event = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [file] },
    } as unknown as React.DragEvent;

    await act(async () => {
      result.current.handleDrop(event);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(setPendingImage).toHaveBeenCalled();
  });

  it("handleDrop does nothing with no files", () => {
    const { result } = renderHook(() => useChatInput(makeOptions()));

    const event = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [] },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDrop(event);
    });
    expect(result.current.isDragOver).toBe(false);
  });

  it("handleFileInputChange processes animation file", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "anim-2" }),
    } as Response);

    const setCurrentAnimationId = vi.fn();
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ setCurrentAnimationId }))
    );

    const lottie = JSON.stringify({ v: "5.0", fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [], nm: "Test" });
    const file = new File([lottie], "test.json", { type: "application/json" });
    const event = {
      target: { files: [file], value: "test.json" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      result.current.handleFileInputChange(event);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(setCurrentAnimationId).toHaveBeenCalledWith("anim-2");
    expect((event.target as HTMLInputElement).value).toBe("");
  });

  it("handleFileInputChange processes image file for non-animation extensions", async () => {
    const setPendingImage = vi.fn();
    const { result } = renderHook(() =>
      useChatInput(makeOptions({ setPendingImage }))
    );

    const file = new File(["img"], "photo.png", { type: "image/png" });
    const event = {
      target: { files: [file], value: "photo.png" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      result.current.handleFileInputChange(event);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(setPendingImage).toHaveBeenCalled();
  });

  it("handleFileInputChange does nothing with no file", () => {
    const { result } = renderHook(() => useChatInput(makeOptions()));

    const event = {
      target: { files: [], value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleFileInputChange(event);
    });
  });

  describe("processAnimationFile", () => {
    it("rejects files that are too large", async () => {
      const setMessages = vi.fn();
      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setMessages }))
      );

      const bigData = new Uint8Array(11 * 1024 * 1024);
      const file = new File([bigData], "big.json", { type: "application/json" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(setMessages).toHaveBeenCalled();
      const updater = setMessages.mock.calls[0][0];
      const msgs = updater([]);
      expect(msgs[0].content).toBe("fileTooLarge");
    });

    it("rejects unsupported extensions", async () => {
      const setMessages = vi.fn();
      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setMessages }))
      );

      const file = new File(["data"], "test.txt", { type: "text/plain" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      const updater = setMessages.mock.calls[0][0];
      const msgs = updater([]);
      expect(msgs[0].content).toBe("invalidFileType");
    });

    it("handles SVG import success", async () => {
      const setMessages = vi.fn();
      const setCurrentAnimationId = vi.fn();
      const onAnimationCreated = vi.fn();
      vi.mocked(apiFetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "svg-1", data: { layers: [] }, message: "SVG imported" }),
      } as unknown as Response);

      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setMessages, setCurrentAnimationId, onAnimationCreated }))
      );

      const file = new File(["<svg></svg>"], "icon.svg", { type: "image/svg+xml" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(setCurrentAnimationId).toHaveBeenCalledWith("svg-1");
      expect(onAnimationCreated).toHaveBeenCalledWith("svg-1", { layers: [] });
    });

    it("handles SVG import failure", async () => {
      const setMessages = vi.fn();
      vi.mocked(apiFetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "bad svg" }),
      } as unknown as Response);

      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setMessages }))
      );

      const file = new File(["<svg></svg>"], "bad.svg", { type: "image/svg+xml" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      const updater = setMessages.mock.calls[0][0];
      const msgs = updater([]);
      expect(msgs[0].content).toBe("importFailed");
    });

    it("handles invalid JSON in .json file", async () => {
      const setMessages = vi.fn();
      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setMessages }))
      );

      const file = new File(["not json{"], "bad.json", { type: "application/json" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      const updater = setMessages.mock.calls[0][0];
      const msgs = updater([]);
      expect(msgs[0].content).toBe("invalidJsonParse");
    });

    it("rejects JSON that is not an object", async () => {
      const setMessages = vi.fn();
      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setMessages }))
      );

      const file = new File(["[1,2,3]"], "arr.json", { type: "application/json" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      const updater = setMessages.mock.calls[0][0];
      const msgs = updater([]);
      expect(msgs[0].content).toBe("invalidLottieJson");
    });

    it("rejects JSON missing required Lottie fields", async () => {
      const setMessages = vi.fn();
      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setMessages }))
      );

      const file = new File([JSON.stringify({ v: "5.0" })], "partial.json", { type: "application/json" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      const updater = setMessages.mock.calls[0][0];
      const msgs = updater([]);
      expect(msgs[0].content).toBe("invalidLottieJson");
    });

    it("handles .lottie file import", async () => {
      const setCurrentAnimationId = vi.fn();
      const onAnimationCreated = vi.fn();
      vi.mocked(parseLottieFile).mockResolvedValue({
        data: { v: "5.0", fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [] },
        name: "DotLottie",
      });
      vi.mocked(apiFetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "dl-1" }),
      } as unknown as Response);

      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setCurrentAnimationId, onAnimationCreated }))
      );

      const file = new File(["binary"], "anim.lottie", { type: "application/octet-stream" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(setCurrentAnimationId).toHaveBeenCalledWith("dl-1");
      expect(onAnimationCreated).toHaveBeenCalled();
    });

    it("handles API failure when saving animation", async () => {
      const setMessages = vi.fn();
      vi.mocked(apiFetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "DB error" }),
      } as unknown as Response);

      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setMessages }))
      );

      const lottie = JSON.stringify({ v: "5.0", fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [] });
      const file = new File([lottie], "fail.json", { type: "application/json" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      const updater = setMessages.mock.calls[0][0];
      const msgs = updater([]);
      expect(msgs[0].content).toBe("importFailed");
    });

    it("handles exception during file processing", async () => {
      const setMessages = vi.fn();
      vi.mocked(parseLottieFile).mockRejectedValue(new Error("parse error"));

      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setMessages }))
      );

      const file = new File(["binary"], "broken.lottie", { type: "application/octet-stream" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      const updater = setMessages.mock.calls[0][0];
      const msgs = updater([]);
      expect(msgs[0].content).toBe("importFailed");
    });

    it("uses file name when nm field is missing", async () => {
      const setCurrentAnimationId = vi.fn();
      vi.mocked(apiFetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "nn-1" }),
      } as unknown as Response);

      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setCurrentAnimationId }))
      );

      const lottie = JSON.stringify({ v: "5.0", fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [] });
      const file = new File([lottie], "myAnim.json", { type: "application/json" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(apiFetch).toHaveBeenCalledWith("/api/animations", expect.objectContaining({
        body: expect.stringContaining('"myAnim"'),
      }));
    });
  });

  describe("insertText handling", () => {
    it("appends insertText to input when it changes", () => {
      const setInput = vi.fn();
      const { rerender } = renderHook(
        (props) => useChatInput(props),
        { initialProps: makeOptions({ setInput, insertText: undefined }) }
      );

      rerender(makeOptions({ setInput, insertText: " layer1" }));
      expect(setInput).toHaveBeenCalled();
    });

    it("does not append when insertText is unchanged", () => {
      const setInput = vi.fn();
      const { rerender } = renderHook(
        (props) => useChatInput(props),
        { initialProps: makeOptions({ setInput, insertText: "x" }) }
      );

      setInput.mockClear();
      rerender(makeOptions({ setInput, insertText: "x" }));
      expect(setInput).not.toHaveBeenCalled();
    });
  });

  describe("visualViewport effect", () => {
    it("cleans up resize listener on unmount", () => {
      const removeListener = vi.fn();
      Object.defineProperty(window, "visualViewport", {
        value: { addEventListener: vi.fn(), removeEventListener: removeListener },
        writable: true,
      });

      const { unmount } = renderHook(() => useChatInput(makeOptions()));
      unmount();
      expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
    });

    it("handles missing visualViewport", () => {
      Object.defineProperty(window, "visualViewport", { value: null, writable: true });
      const { unmount } = renderHook(() => useChatInput(makeOptions()));
      unmount();
    });
  });

  describe("SVG import edge cases", () => {
    it("uses default message on SVG import success without message", async () => {
      const setMessages = vi.fn();
      const setCurrentAnimationId = vi.fn();
      vi.mocked(apiFetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "svg-2", data: {} }),
      } as unknown as Response);

      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setMessages, setCurrentAnimationId }))
      );

      const file = new File(["<svg></svg>"], "icon.svg", { type: "image/svg+xml" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      const updater = setMessages.mock.calls[0][0];
      const msgs = updater([]);
      expect(msgs[0].content).toBe("importSuccess");
    });

    it("handles SVG import error with no parseable JSON response", async () => {
      const setMessages = vi.fn();
      vi.mocked(apiFetch).mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("no json")),
      } as unknown as Response);

      const { result } = renderHook(() =>
        useChatInput(makeOptions({ setMessages }))
      );

      const file = new File(["<svg></svg>"], "bad.svg", { type: "image/svg+xml" });

      await act(async () => {
        result.current.processAnimationFile(file);
        await new Promise((r) => setTimeout(r, 50));
      });

      const updater = setMessages.mock.calls[0][0];
      const msgs = updater([]);
      expect(msgs[0].content).toBe("importFailed");
    });
  });
});
