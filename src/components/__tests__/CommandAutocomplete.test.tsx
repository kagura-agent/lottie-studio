/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

Element.prototype.scrollIntoView = vi.fn();
import CommandAutocomplete, {
  filterCommands,
  COMMANDS,
  type CommandDef,
} from "../CommandAutocomplete";

describe("filterCommands", () => {
  it("returns all commands for '/'", () => {
    expect(filterCommands("/")).toEqual(COMMANDS);
  });

  it("filters by prefix", () => {
    const result = filterCommands("/play");
    expect(result).toEqual([
      { command: "/play", description: "Resume playback", hasParams: false },
    ]);
  });

  it("is case-insensitive", () => {
    const result = filterCommands("/PLAY");
    expect(result).toEqual([
      { command: "/play", description: "Resume playback", hasParams: false },
    ]);
  });

  it("returns empty for no match", () => {
    expect(filterCommands("/zzzzz")).toEqual([]);
  });

  it("matches multiple commands with shared prefix", () => {
    const result = filterCommands("/pa");
    expect(result.every((c) => c.command.startsWith("/pa"))).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(2); // /pause, /path, /particle
  });
});

describe("CommandAutocomplete", () => {
  let onSelect: Mock<(command: CommandDef) => void>;
  let onDismiss: Mock<() => void>;

  beforeEach(() => {
    onSelect = vi.fn();
    onDismiss = vi.fn();
  });

  function renderComponent(props: { query?: string; visible?: boolean } = {}) {
    return render(
      <CommandAutocomplete
        query={props.query ?? "/"}
        visible={props.visible ?? true}
        onSelect={onSelect}
        onDismiss={onDismiss}
      />
    );
  }

  it("renders null when not visible", () => {
    const { container } = renderComponent({ visible: false });
    expect(container.innerHTML).toBe("");
  });

  it("renders null when no commands match", () => {
    const { container } = renderComponent({ query: "/zzzzz" });
    expect(container.innerHTML).toBe("");
  });

  it("renders command list when visible with matches", () => {
    renderComponent({ query: "/play" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("/play")).toBeInTheDocument();
  });

  it("highlights first item by default (aria-selected)", () => {
    renderComponent({ query: "/pa" });
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
  });

  it("ArrowDown moves selection down", () => {
    renderComponent({ query: "/pa" });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
    });
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("ArrowDown wraps to top", () => {
    renderComponent({ query: "/play" }); // single match
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
    });
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("ArrowUp wraps to bottom", () => {
    renderComponent({ query: "/pa" });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
    });
    const options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveAttribute("aria-selected", "true");
  });

  it("ArrowUp moves selection up from non-zero", () => {
    renderComponent({ query: "/pa" });
    // Move down first, then up
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
    });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
    });
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("Enter selects the highlighted command", () => {
    renderComponent({ query: "/play" });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ command: "/play" })
    );
  });

  it("Tab selects the highlighted command", () => {
    renderComponent({ query: "/play" });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
      );
    });
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ command: "/play" })
    );
  });

  it("Escape calls onDismiss", () => {
    renderComponent({ query: "/play" });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it("mouse hover updates selection", () => {
    renderComponent({ query: "/pa" });
    const options = screen.getAllByRole("option");
    fireEvent.mouseEnter(options[1]);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("click selects the command", () => {
    renderComponent({ query: "/pa" });
    const options = screen.getAllByRole("option");
    fireEvent.click(options[1]);
    expect(onSelect).toHaveBeenCalled();
  });

  it("resets selection when query changes", () => {
    const { rerender } = render(
      <CommandAutocomplete
        query="/pa"
        visible={true}
        onSelect={onSelect}
        onDismiss={onDismiss}
      />
    );
    // Move selection down
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
    });
    let options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    // Change query
    rerender(
      <CommandAutocomplete
        query="/pau"
        visible={true}
        onSelect={onSelect}
        onDismiss={onDismiss}
      />
    );
    options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("scrollIntoView is called on selected item", () => {
    const scrollMock = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    scrollMock.mockClear();
    renderComponent({ query: "/pa" });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
    });
    expect(scrollMock).toHaveBeenCalled();
  });

  it("does not handle keys when not visible", () => {
    renderComponent({ visible: false });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not handle keys when filtered is empty", () => {
    renderComponent({ query: "/zzzzz" });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("removes keydown listener when visibility changes to false", () => {
    const { rerender } = render(
      <CommandAutocomplete
        query="/"
        visible={true}
        onSelect={onSelect}
        onDismiss={onDismiss}
      />
    );
    rerender(
      <CommandAutocomplete
        query="/"
        visible={false}
        onSelect={onSelect}
        onDismiss={onDismiss}
      />
    );
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ignores unhandled keys", () => {
    renderComponent({ query: "/play" });
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a", bubbles: true })
      );
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
