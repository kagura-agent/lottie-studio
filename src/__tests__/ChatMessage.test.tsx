// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ChatMessage from "@/components/chat/ChatMessage";
import type { Message } from "@/lib/chat-types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/MarkdownMessage", () => ({
  default: ({ content }: { content: string }) => <span data-testid="markdown">{content}</span>,
}));

vi.mock("@/components/InlineLottiePreview", () => ({
  default: () => <div data-testid="lottie-preview" />,
}));

vi.mock("@/components/VariationGrid", () => ({
  default: () => <div data-testid="variation-grid" />,
}));

vi.mock("@/components/SequencePlayer", () => ({
  default: () => <div data-testid="sequence-player" />,
}));

vi.mock("@/components/FeedbackButtons", () => ({
  default: () => <div data-testid="feedback-buttons" />,
}));

function makeProps(msgOverrides: Partial<Message> = {}, propOverrides = {}) {
  const msg: Message = {
    id: "msg-1",
    role: "assistant",
    content: "Hello world",
    ...msgOverrides,
  };
  return {
    msg,
    isEditing: false,
    editText: "",
    onEditTextChange: vi.fn(),
    onEditStart: vi.fn(),
    onEditCancel: vi.fn(),
    onEditSave: vi.fn(),
    onRetry: vi.fn(),
    isRetrying: false,
    isLastAssistant: true,
    isThinking: false,
    isStreaming: false,
    onVariationSelect: vi.fn(),
    currentAnimationId: "anim-1",
    warningDismissed: false,
    onDismissWarning: vi.fn(),
    isLastSuggestion: false,
    onSuggestionClick: vi.fn(),
    t: (key: string) => key,
    ...propOverrides,
  };
}

describe("ChatMessage", () => {
  it("renders assistant message with markdown", () => {
    render(<ChatMessage {...makeProps()} />);
    expect(screen.getByTestId("markdown")).toHaveTextContent("Hello world");
  });

  it("renders user message as plain text", () => {
    render(<ChatMessage {...makeProps({ role: "user", content: "Hi" })} />);
    expect(screen.getByText("Hi")).toBeInTheDocument();
  });

  it("shows lottie preview for assistant with lottieJson", () => {
    render(<ChatMessage {...makeProps({ lottieJson: { v: "5.0" } as object })} />);
    expect(screen.getByTestId("lottie-preview")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-buttons")).toBeInTheDocument();
  });

  it("shows retry button for last assistant message when idle", () => {
    render(<ChatMessage {...makeProps()} />);
    expect(screen.getByLabelText("retry")).toBeInTheDocument();
  });

  it("hides retry button when thinking", () => {
    render(<ChatMessage {...makeProps({}, { isThinking: true })} />);
    expect(screen.queryByLabelText("retry")).not.toBeInTheDocument();
  });

  it("shows edit button for user messages when idle", () => {
    render(<ChatMessage {...makeProps({ role: "user" }, { isLastAssistant: false })} />);
    expect(screen.getByLabelText("edit")).toBeInTheDocument();
  });

  it("renders edit mode with textarea", () => {
    render(<ChatMessage {...makeProps({ role: "user" }, { isEditing: true, editText: "edited" })} />);
    expect(screen.getByDisplayValue("edited")).toBeInTheDocument();
    expect(screen.getByText("saveAndRegenerate")).toBeInTheDocument();
  });

  it("shows warning when present and not dismissed", () => {
    render(<ChatMessage {...makeProps({ warning: "Something off" })} />);
    expect(screen.getByText("Something off")).toBeInTheDocument();
  });

  it("hides warning when dismissed", () => {
    render(<ChatMessage {...makeProps({ warning: "Something off" }, { warningDismissed: true })} />);
    expect(screen.queryByText("Something off")).not.toBeInTheDocument();
  });

  it("shows suggestion chips for last suggestion message", () => {
    const onSuggestionClick = vi.fn();
    render(<ChatMessage {...makeProps(
      { suggestions: ["Try this", "Or that"] },
      { isLastSuggestion: true, onSuggestionClick }
    )} />);
    expect(screen.getByText("Try this")).toBeInTheDocument();
    expect(screen.getByText("Or that")).toBeInTheDocument();
  });

  it("shows bouncing dots when retrying with no content", () => {
    const { container } = render(<ChatMessage {...makeProps({ content: "" }, { isRetrying: true })} />);
    const dots = container.querySelectorAll(".animate-bounce");
    expect(dots.length).toBe(3);
  });

  it("shows image for user message with imageUrl", () => {
    render(<ChatMessage {...makeProps({ role: "user", imageUrl: "data:image/png;base64,abc" })} />);
    expect(screen.getByAltText("Attached")).toBeInTheDocument();
  });
});
