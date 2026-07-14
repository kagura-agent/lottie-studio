// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatInputBar from "@/components/chat/ChatInputBar";
import React from "react";

vi.mock("@/components/CommandAutocomplete", () => ({
  default: ({ visible }: { visible: boolean }) => visible ? <div data-testid="autocomplete" /> : null,
}));

vi.mock("@/components/VoiceInput", () => ({
  default: () => <div data-testid="voice-input" />,
}));

function makeProps(overrides = {}) {
  return {
    input: "",
    onInputChange: vi.fn(),
    onKeyDown: vi.fn(),
    onPaste: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    isThinking: false,
    isStreaming: false,
    pendingImage: null as string | null,
    onRemoveImage: vi.fn(),
    isDragOver: false,
    onDrop: vi.fn(),
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    showAutocomplete: false,
    autocompleteQuery: "",
    onAutocompleteSelect: vi.fn(),
    onAutocompleteDismiss: vi.fn(),
    onFileClick: vi.fn(),
    onFileChange: vi.fn(),
    currentAnimationId: undefined as string | undefined,
    selectedLayerIndex: null as number | null | undefined,
    animationDataProp: null as object | null | undefined,
    onLayerContextConsumed: vi.fn(),
    inputRef: { current: null } as React.RefObject<HTMLTextAreaElement | null>,
    inputAreaRef: { current: null } as React.RefObject<HTMLDivElement | null>,
    fileInputRef: { current: null } as React.RefObject<HTMLInputElement | null>,
    t: (key: string) => key,
    ...overrides,
  };
}

describe("ChatInputBar", () => {
  it("renders textarea with placeholder", () => {
    render(<ChatInputBar {...makeProps()} />);
    expect(screen.getByPlaceholderText("placeholder")).toBeInTheDocument();
  });

  it("shows different placeholder when animation exists", () => {
    render(<ChatInputBar {...makeProps({ currentAnimationId: "anim-1" })} />);
    expect(screen.getByPlaceholderText("placeholderWithAnimation")).toBeInTheDocument();
  });

  it("shows send button when idle", () => {
    render(<ChatInputBar {...makeProps()} />);
    expect(screen.getByText("send")).toBeInTheDocument();
  });

  it("shows stop button when thinking", () => {
    render(<ChatInputBar {...makeProps({ isThinking: true })} />);
    expect(screen.getByLabelText("stop")).toBeInTheDocument();
    expect(screen.queryByText("send")).not.toBeInTheDocument();
  });

  it("disables send when input is empty", () => {
    render(<ChatInputBar {...makeProps()} />);
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });

  it("enables send when input has text", () => {
    render(<ChatInputBar {...makeProps({ input: "hello" })} />);
    expect(screen.getByLabelText("Send message")).not.toBeDisabled();
  });

  it("shows pending image preview", () => {
    render(<ChatInputBar {...makeProps({ pendingImage: "data:image/png;base64,abc" })} />);
    expect(screen.getByAltText("Attachment preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove image")).toBeInTheDocument();
  });

  it("calls onRemoveImage when remove button clicked", () => {
    const onRemoveImage = vi.fn();
    render(<ChatInputBar {...makeProps({ pendingImage: "data:image/png;base64,abc", onRemoveImage })} />);
    fireEvent.click(screen.getByLabelText("Remove image"));
    expect(onRemoveImage).toHaveBeenCalled();
  });

  it("shows drag overlay when isDragOver", () => {
    render(<ChatInputBar {...makeProps({ isDragOver: true })} />);
    expect(screen.getByText("dropFileHere")).toBeInTheDocument();
  });

  it("shows autocomplete when showAutocomplete is true", () => {
    render(<ChatInputBar {...makeProps({ showAutocomplete: true, autocompleteQuery: "/st" })} />);
    expect(screen.getByTestId("autocomplete")).toBeInTheDocument();
  });

  it("shows layer context badge when selectedLayerIndex is set", () => {
    const animationDataProp = { layers: [{ nm: "Circle" }] };
    render(<ChatInputBar {...makeProps({ selectedLayerIndex: 0, animationDataProp })} />);
    expect(screen.getByText("Editing: Circle")).toBeInTheDocument();
  });

  it("calls onSend when send button clicked", () => {
    const onSend = vi.fn();
    render(<ChatInputBar {...makeProps({ input: "hello", onSend })} />);
    fireEvent.click(screen.getByLabelText("Send message"));
    expect(onSend).toHaveBeenCalled();
  });

  it("shows voice input when not thinking", () => {
    render(<ChatInputBar {...makeProps()} />);
    expect(screen.getByTestId("voice-input")).toBeInTheDocument();
  });

  it("hides voice input when thinking", () => {
    render(<ChatInputBar {...makeProps({ isThinking: true })} />);
    expect(screen.queryByTestId("voice-input")).not.toBeInTheDocument();
  });
});
