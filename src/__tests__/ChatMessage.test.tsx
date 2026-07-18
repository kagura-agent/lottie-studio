// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatMessage from "@/components/chat/ChatMessage";
import VersionBadge from "@/components/chat/VersionBadge";
import type { Message } from "@/lib/chat-types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/MarkdownMessage", () => ({
  default: ({ content }: { content: string }) => <span data-testid="markdown">{content}</span>,
}));

vi.mock("@/components/InlineLottiePreview", () => ({
  default: ({ lottieJson, previousLottieJson }: { lottieJson: object; previousLottieJson?: object }) => (
    <div data-testid="lottie-preview" data-has-previous={previousLottieJson ? "true" : "false"} />
  ),
}));

vi.mock("@/components/VariationGrid", () => ({
  default: ({ loading }: { loading?: boolean }) => <div data-testid="variation-grid" data-loading={loading ? "true" : "false"} />,
}));

vi.mock("@/components/SequencePlayer", () => ({
  default: ({ sequenceId }: { sequenceId: string }) => <div data-testid="sequence-player" data-id={sequenceId} />,
}));

vi.mock("@/components/FeedbackButtons", () => ({
  default: () => <div data-testid="feedback-buttons" />,
}));

function makeProps(msgOverrides: Partial<Message> = {}, propOverrides: Record<string, unknown> = {}) {
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
    qualityHintsDismissed: false,
    onDismissQualityHints: vi.fn(),
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

  // --- New tests for uncovered paths ---

  it("edit mode: cancel button calls onEditCancel", () => {
    const onEditCancel = vi.fn();
    render(<ChatMessage {...makeProps({ role: "user" }, { isEditing: true, editText: "text", onEditCancel })} />);
    fireEvent.click(screen.getByText("cancel"));
    expect(onEditCancel).toHaveBeenCalled();
  });

  it("edit mode: save button calls onEditSave", () => {
    const onEditSave = vi.fn();
    render(<ChatMessage {...makeProps({ role: "user" }, { isEditing: true, editText: "text", onEditSave })} />);
    fireEvent.click(screen.getByText("saveAndRegenerate"));
    expect(onEditSave).toHaveBeenCalled();
  });

  it("edit mode: save button disabled when editText is empty", () => {
    render(<ChatMessage {...makeProps({ role: "user" }, { isEditing: true, editText: "" })} />);
    expect(screen.getByText("saveAndRegenerate")).toBeDisabled();
  });

  it("edit mode: save button disabled when editText is whitespace", () => {
    render(<ChatMessage {...makeProps({ role: "user" }, { isEditing: true, editText: "   " })} />);
    expect(screen.getByText("saveAndRegenerate")).toBeDisabled();
  });

  it("edit mode: textarea onChange calls onEditTextChange", () => {
    const onEditTextChange = vi.fn();
    render(<ChatMessage {...makeProps({ role: "user" }, { isEditing: true, editText: "old", onEditTextChange })} />);
    fireEvent.change(screen.getByDisplayValue("old"), { target: { value: "new" } });
    expect(onEditTextChange).toHaveBeenCalledWith("new");
  });

  it("edit mode: shows editWarning text", () => {
    render(<ChatMessage {...makeProps({ role: "user" }, { isEditing: true, editText: "x" })} />);
    expect(screen.getByText("editWarning")).toBeInTheDocument();
  });

  it("lottie preview passes previousLottieJson", () => {
    const prev = { v: "4.0" };
    render(<ChatMessage {...makeProps({ lottieJson: { v: "5.0" } as object, previousLottieJson: prev as object })} />);
    const preview = screen.getByTestId("lottie-preview");
    expect(preview).toHaveAttribute("data-has-previous", "true");
  });

  it("renders VersionBadge when assistant msg has lottieJson and versionNum", () => {
    const onVersionRestore = vi.fn();
    render(<ChatMessage {...makeProps(
      { lottieJson: { v: "5.0" } as object, versionNum: 3 },
      { onVersionRestore }
    )} />);
    const btn = screen.getByTitle("Restore version 3");
    expect(btn).toHaveTextContent("v3");
  });

  it("clicking VersionBadge calls onVersionRestore", () => {
    const onVersionRestore = vi.fn();
    render(<ChatMessage {...makeProps(
      { lottieJson: { v: "5.0" } as object, versionNum: 2 },
      { onVersionRestore }
    )} />);
    fireEvent.click(screen.getByTitle("Restore version 2"));
    expect(onVersionRestore).toHaveBeenCalledWith(2);
  });

  it("renders VariationGrid when variations present", () => {
    render(<ChatMessage {...makeProps({ variations: [{ id: "v1", lottieJson: {} }] as Message["variations"] })} />);
    expect(screen.getByTestId("variation-grid")).toBeInTheDocument();
  });

  it("renders VariationGrid when variationsLoading", () => {
    render(<ChatMessage {...makeProps({ variationsLoading: true })} />);
    const grid = screen.getByTestId("variation-grid");
    expect(grid).toHaveAttribute("data-loading", "true");
  });

  it("renders SequencePlayer when sequenceId present", () => {
    render(<ChatMessage {...makeProps({ sequenceId: "seq-42" })} />);
    const player = screen.getByTestId("sequence-player");
    expect(player).toHaveAttribute("data-id", "seq-42");
  });

  it("renders repair message with amber styling", () => {
    render(<ChatMessage {...makeProps({ content: "Repaired!", isRepair: true })} />);
    const markdown = screen.getByTestId("markdown");
    expect(markdown).toHaveTextContent("Repaired!");
    expect(markdown.parentElement).toHaveClass("text-amber-300");
  });

  it("hides retry button when streaming", () => {
    render(<ChatMessage {...makeProps({}, { isStreaming: true })} />);
    expect(screen.queryByLabelText("retry")).not.toBeInTheDocument();
  });

  it("hides retry button when not last assistant", () => {
    render(<ChatMessage {...makeProps({}, { isLastAssistant: false })} />);
    expect(screen.queryByLabelText("retry")).not.toBeInTheDocument();
  });

  it("retry button calls onRetry", () => {
    const onRetry = vi.fn();
    render(<ChatMessage {...makeProps({}, { onRetry })} />);
    fireEvent.click(screen.getByLabelText("retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("hides edit button when thinking", () => {
    render(<ChatMessage {...makeProps({ role: "user" }, { isThinking: true })} />);
    expect(screen.queryByLabelText("edit")).not.toBeInTheDocument();
  });

  it("hides edit button when streaming", () => {
    render(<ChatMessage {...makeProps({ role: "user" }, { isStreaming: true })} />);
    expect(screen.queryByLabelText("edit")).not.toBeInTheDocument();
  });

  it("hides edit button when editing", () => {
    render(<ChatMessage {...makeProps({ role: "user" }, { isEditing: true, editText: "x" })} />);
    expect(screen.queryByLabelText("edit")).not.toBeInTheDocument();
  });

  it("edit button calls onEditStart", () => {
    const onEditStart = vi.fn();
    render(<ChatMessage {...makeProps({ role: "user" }, { onEditStart })} />);
    fireEvent.click(screen.getByLabelText("edit"));
    expect(onEditStart).toHaveBeenCalled();
  });

  it("hides FeedbackButtons when thinking", () => {
    render(<ChatMessage {...makeProps({ lottieJson: { v: "5.0" } as object }, { isThinking: true })} />);
    expect(screen.queryByTestId("feedback-buttons")).not.toBeInTheDocument();
  });

  it("hides FeedbackButtons when streaming", () => {
    render(<ChatMessage {...makeProps({ lottieJson: { v: "5.0" } as object }, { isStreaming: true })} />);
    expect(screen.queryByTestId("feedback-buttons")).not.toBeInTheDocument();
  });

  it("does not show FeedbackButtons for assistant without lottieJson", () => {
    render(<ChatMessage {...makeProps()} />);
    expect(screen.queryByTestId("feedback-buttons")).not.toBeInTheDocument();
  });

  it("dismiss warning button calls onDismissWarning", () => {
    const onDismissWarning = vi.fn();
    render(<ChatMessage {...makeProps({ warning: "Warn" }, { onDismissWarning })} />);
    fireEvent.click(screen.getByLabelText("Dismiss warning"));
    expect(onDismissWarning).toHaveBeenCalled();
  });

  it("renders quality hints and expands on click", () => {
    const hints = [
      { id: "h1", label: "Framerate", detail: "Too low", suggestion: "Use 30fps", status: "fail" as const },
      { id: "h2", label: "Colors", detail: "Limited", suggestion: "Add more", status: "warn" as const },
    ];
    render(<ChatMessage {...makeProps({ qualityHints: hints })} />);
    expect(screen.getByText("Quality Tips")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(screen.queryByText("Framerate:")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Quality Tips"));
    expect(screen.getByText("Framerate:")).toBeInTheDocument();
    expect(screen.getByText("Too low")).toBeInTheDocument();
    expect(screen.getByText("Use 30fps")).toBeInTheDocument();
    expect(screen.getByText("Colors:")).toBeInTheDocument();
  });

  it("quality hints dismiss button calls onDismissQualityHints", () => {
    const onDismissQualityHints = vi.fn();
    const hints = [{ id: "h1", label: "L", detail: "D", suggestion: "S", status: "fail" as const }];
    render(<ChatMessage {...makeProps({ qualityHints: hints }, { onDismissQualityHints })} />);
    fireEvent.click(screen.getByLabelText("Dismiss quality tips"));
    expect(onDismissQualityHints).toHaveBeenCalled();
  });

  it("does not render quality hints when dismissed", () => {
    const hints = [{ id: "h1", label: "L", detail: "D", suggestion: "S", status: "fail" as const }];
    render(<ChatMessage {...makeProps({ qualityHints: hints }, { qualityHintsDismissed: true })} />);
    expect(screen.queryByText("Quality Tips")).not.toBeInTheDocument();
  });

  it("suggestion chips clicking calls onSuggestionClick", () => {
    const onSuggestionClick = vi.fn();
    render(<ChatMessage {...makeProps(
      { suggestions: ["Chip A"] },
      { isLastSuggestion: true, onSuggestionClick }
    )} />);
    fireEvent.click(screen.getByText("Chip A"));
    expect(onSuggestionClick).toHaveBeenCalledWith("Chip A");
  });

  it("does not show suggestions when thinking", () => {
    render(<ChatMessage {...makeProps(
      { suggestions: ["Chip"] },
      { isLastSuggestion: true, isThinking: true }
    )} />);
    expect(screen.queryByText("Chip")).not.toBeInTheDocument();
  });

  it("does not show suggestions when streaming", () => {
    render(<ChatMessage {...makeProps(
      { suggestions: ["Chip"] },
      { isLastSuggestion: true, isStreaming: true }
    )} />);
    expect(screen.queryByText("Chip")).not.toBeInTheDocument();
  });

  it("does not show suggestions when not isLastSuggestion", () => {
    render(<ChatMessage {...makeProps({ suggestions: ["Chip"] })} />);
    expect(screen.queryByText("Chip")).not.toBeInTheDocument();
  });

  it("quality hints: fail status shows filled dot, warn shows open dot", () => {
    const hints = [
      { id: "h1", label: "A", detail: "D", suggestion: "S", status: "fail" as const },
      { id: "h2", label: "B", detail: "D", suggestion: "S", status: "warn" as const },
    ];
    render(<ChatMessage {...makeProps({ qualityHints: hints })} />);
    fireEvent.click(screen.getByText("Quality Tips"));
    expect(screen.getByText("●")).toBeInTheDocument();
    expect(screen.getByText("○")).toBeInTheDocument();
  });
});

describe("VersionBadge", () => {
  it("renders version number", () => {
    render(<VersionBadge versionNum={5} animationId="anim-1" />);
    expect(screen.getByText("v5")).toBeInTheDocument();
    expect(screen.getByTitle("Restore version 5")).toBeInTheDocument();
  });

  it("clicking calls onRestore with versionNum", () => {
    const onRestore = vi.fn();
    render(<VersionBadge versionNum={3} animationId="anim-1" onRestore={onRestore} />);
    fireEvent.click(screen.getByText("v3"));
    expect(onRestore).toHaveBeenCalledWith(3);
  });

  it("handles missing onRestore gracefully", () => {
    render(<VersionBadge versionNum={1} animationId="anim-1" />);
    expect(() => fireEvent.click(screen.getByText("v1"))).not.toThrow();
  });
});
