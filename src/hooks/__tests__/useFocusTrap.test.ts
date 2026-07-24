// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

function createContainer(...buttonLabels: string[]): HTMLDivElement {
  const container = document.createElement("div");
  for (const label of buttonLabels) {
    const btn = document.createElement("button");
    btn.textContent = label;
    Object.defineProperty(btn, "offsetParent", { value: container, configurable: true });
    container.appendChild(btn);
  }
  document.body.appendChild(container);
  return container;
}

function pressTab(shiftKey = false) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true }));
}

describe("useFocusTrap", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  it("focuses first focusable element on activation", () => {
    const container = createContainer("A", "B", "C");
    const ref = { current: container } as React.RefObject<HTMLDivElement>;

    renderHook(() => useFocusTrap(true, ref));

    expect(document.activeElement).toBe(container.querySelector("button"));
  });

  it("Tab from last element wraps to first", () => {
    const container = createContainer("A", "B", "C");
    const ref = { current: container } as React.RefObject<HTMLDivElement>;
    const buttons = container.querySelectorAll("button");

    renderHook(() => useFocusTrap(true, ref));

    (buttons[2] as HTMLElement).focus();
    pressTab();

    expect(document.activeElement).toBe(buttons[0]);
  });

  it("Shift+Tab from first element wraps to last", () => {
    const container = createContainer("A", "B", "C");
    const ref = { current: container } as React.RefObject<HTMLDivElement>;
    const buttons = container.querySelectorAll("button");

    renderHook(() => useFocusTrap(true, ref));

    (buttons[0] as HTMLElement).focus();
    pressTab(true);

    expect(document.activeElement).toBe(buttons[2]);
  });

  it("restores focus to previous element on deactivation", () => {
    const outsideButton = document.createElement("button");
    outsideButton.textContent = "Outside";
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    const container = createContainer("A", "B");
    const ref = { current: container } as React.RefObject<HTMLDivElement>;

    const { rerender } = renderHook(
      ({ active }) => useFocusTrap(active, ref),
      { initialProps: { active: true } }
    );

    expect(document.activeElement).toBe(container.querySelector("button"));

    rerender({ active: false });

    expect(document.activeElement).toBe(outsideButton);
  });

  it("handles empty container (no focusable elements)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const ref = { current: container } as React.RefObject<HTMLDivElement>;

    renderHook(() => useFocusTrap(true, ref));

    pressTab();
    // Should not throw
  });

  it("filters non-visible elements (offsetParent === null)", () => {
    const container = document.createElement("div");
    const visibleBtn = document.createElement("button");
    visibleBtn.textContent = "Visible";
    Object.defineProperty(visibleBtn, "offsetParent", { value: container, configurable: true });

    const hiddenBtn = document.createElement("button");
    hiddenBtn.textContent = "Hidden";
    Object.defineProperty(hiddenBtn, "offsetParent", { value: null, configurable: true });

    container.appendChild(hiddenBtn);
    container.appendChild(visibleBtn);
    document.body.appendChild(container);

    const ref = { current: container } as React.RefObject<HTMLDivElement>;
    renderHook(() => useFocusTrap(true, ref));

    expect(document.activeElement).toBe(visibleBtn);
  });

  it("works with internal ref when no external ref provided", () => {
    const { result } = renderHook(() => useFocusTrap(false));
    expect(result.current).toBeDefined();
    expect(result.current.current).toBeNull();
  });

  it("does nothing when active is false", () => {
    const container = createContainer("A", "B");
    const ref = { current: container } as React.RefObject<HTMLDivElement>;

    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    renderHook(() => useFocusTrap(false, ref));

    expect(document.activeElement).toBe(outsideButton);
  });
});
