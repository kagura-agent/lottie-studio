// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatMessageList from "@/components/chat/ChatMessageList";
import type { Message } from "@/lib/chat-types";
import React from "react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/chat/ChatMessage", () => ({
  default: ({ msg }: { msg: Message }) => <div data-testid={`msg-${msg.id}`}>{msg.content}</div>,
}));

vi.mock("@/components/PromptSuggestions", () => ({
  default: () => <div data-testid="prompt-suggestions" />,
}));

function makeProps(overrides = {}) {
  return {
    messages: [] as Message[],
    isThinking: false,
    isStreaming: false,
    isRepairing: false,
    retryingMsgId: null,
    editingMsgId: null,
    editText: "",
    onEditTextChange: vi.fn(),
    onEditStart: vi.fn(),
    onEditCancel: vi.fn(),
    onEditSave: vi.fn(),
    onRetry: vi.fn(),
    lastAssistantMsgId: null,
    lastSuggestionMsgId: null,
    onVariationSelect: vi.fn(),
    currentAnimationId: undefined,
    dismissedWarnings: new Set<string>(),
    onDismissWarning: vi.fn(),
    onSuggestionClick: vi.fn(),
    onPromptSelect: vi.fn(),
    hasDesignTokens: false,
    dynamicSuggestions: null,
    messagesEndRef: { current: null } as React.RefObject<HTMLDivElement | null>,
    t: (key: string) => key,
    ...overrides,
  };
}

describe("ChatMessageList", () => {
  it("shows prompt suggestions when no messages", () => {
    render(<ChatMessageList {...makeProps()} />);
    expect(screen.getByTestId("prompt-suggestions")).toBeInTheDocument();
  });

  it("renders messages and hides suggestions", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "hi" },
      { id: "2", role: "assistant", content: "hello" },
    ];
    render(<ChatMessageList {...makeProps({ messages })} />);
    expect(screen.queryByTestId("prompt-suggestions")).not.toBeInTheDocument();
    expect(screen.getByTestId("msg-1")).toBeInTheDocument();
    expect(screen.getByTestId("msg-2")).toBeInTheDocument();
  });

  it("shows thinking indicator when isThinking and no retryingMsgId", () => {
    const { container } = render(<ChatMessageList {...makeProps({ isThinking: true })} />);
    const dots = container.querySelectorAll(".animate-bounce");
    expect(dots.length).toBe(3);
  });

  it("shows repairing indicator", () => {
    render(<ChatMessageList {...makeProps({ isThinking: true, isRepairing: true })} />);
    expect(screen.getByText("repairing")).toBeInTheDocument();
  });

  it("hides thinking indicator when retryingMsgId is set", () => {
    const { container } = render(<ChatMessageList {...makeProps({ isThinking: true, retryingMsgId: "msg-1" })} />);
    const dots = container.querySelectorAll(".animate-bounce");
    expect(dots.length).toBe(0);
  });

  it("has proper aria attributes", () => {
    render(<ChatMessageList {...makeProps()} />);
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("aria-label", "Chat messages");
  });
});
