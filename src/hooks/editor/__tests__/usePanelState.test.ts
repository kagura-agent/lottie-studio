/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";
import { usePanelState } from "../usePanelState";

describe("usePanelState", () => {
  const menuRef = createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default panel states", () => {
    const { result } = renderHook(() => usePanelState(menuRef));
    expect(result.current.rightPanel).toBe("chat");
    expect(result.current.versionPanelOpen).toBe(false);
    expect(result.current.shortcutsHelpOpen).toBe(false);
    expect(result.current.commandPaletteOpen).toBe(false);
    expect(result.current.fullscreenOpen).toBe(false);
    expect(result.current.embedOpen).toBe(false);
    expect(result.current.submitTemplateOpen).toBe(false);
    expect(result.current.presetDialogOpen).toBe(false);
    expect(result.current.themePanelOpen).toBe(false);
    expect(result.current.shareChat).toBe(false);
    expect(result.current.mobileMenuOpen).toBe(false);
    expect(result.current.jsonSheetOpen).toBe(false);
    expect(result.current.settingsSheetOpen).toBe(false);
    expect(result.current.mobileView).toBe("chat");
  });

  it("setRightPanel changes panel", () => {
    const { result } = renderHook(() => usePanelState(menuRef));
    act(() => result.current.setRightPanel("json"));
    expect(result.current.rightPanel).toBe("json");
  });

  it("toggle functions work with callbacks", () => {
    const { result } = renderHook(() => usePanelState(menuRef));
    act(() => result.current.setFullscreenOpen((v) => !v));
    expect(result.current.fullscreenOpen).toBe(true);
    act(() => result.current.setFullscreenOpen((v) => !v));
    expect(result.current.fullscreenOpen).toBe(false);
  });

  it("Ctrl+K opens command palette", () => {
    const { result } = renderHook(() => usePanelState(menuRef));
    act(() => {
      const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true });
      document.dispatchEvent(event);
    });
    expect(result.current.commandPaletteOpen).toBe(true);
  });

  it("closes mobile menu on outside click when menuRef has no matching target", () => {
    const menuEl = document.createElement("div");
    document.body.appendChild(menuEl);
    const localMenuRef = createRef<HTMLDivElement>() as React.MutableRefObject<HTMLDivElement | null>;
    localMenuRef.current = menuEl;

    const { result } = renderHook(() => usePanelState(localMenuRef));

    act(() => result.current.setMobileMenuOpen(true));
    expect(result.current.mobileMenuOpen).toBe(true);

    // Click outside the menu element
    const outsideEl = document.createElement("div");
    document.body.appendChild(outsideEl);
    act(() => {
      outsideEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(result.current.mobileMenuOpen).toBe(false);

    document.body.removeChild(menuEl);
    document.body.removeChild(outsideEl);
  });

  it("setMobileView changes view", () => {
    const { result } = renderHook(() => usePanelState(menuRef));
    act(() => result.current.setMobileView("layers"));
    expect(result.current.mobileView).toBe("layers");
  });
});
