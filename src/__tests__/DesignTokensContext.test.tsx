// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import {
  DesignTokensProvider,
  useDesignTokens,
} from "../contexts/DesignTokensContext";

const STORAGE_KEY = "lottie-studio-design-tokens";

function wrapper({ children }: { children: React.ReactNode }) {
  return <DesignTokensProvider>{children}</DesignTokensProvider>;
}

describe("DesignTokensContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders children", () => {
    render(
      <DesignTokensProvider>
        <div data-testid="child">hello</div>
      </DesignTokensProvider>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent("hello");
  });

  it("returns correct default values", () => {
    const { result } = renderHook(() => useDesignTokens(), { wrapper });
    expect(result.current.tokens).toEqual({});
    expect(result.current.hasTokens).toBe(false);
  });

  it("setToken updates a token and persists to localStorage", () => {
    const { result } = renderHook(() => useDesignTokens(), { wrapper });

    act(() => {
      result.current.setToken("primary", "#ff0000");
    });

    expect(result.current.tokens.primary).toBe("#ff0000");
    expect(result.current.hasTokens).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      primary: "#ff0000",
    });
  });

  it("setToken with multiple tokens", () => {
    const { result } = renderHook(() => useDesignTokens(), { wrapper });

    act(() => {
      result.current.setToken("primary", "#ff0000");
    });
    act(() => {
      result.current.setToken("secondary", "#00ff00");
    });

    expect(result.current.tokens).toEqual({
      primary: "#ff0000",
      secondary: "#00ff00",
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      primary: "#ff0000",
      secondary: "#00ff00",
    });
  });

  it("clearTokens resets tokens and removes from localStorage", () => {
    const { result } = renderHook(() => useDesignTokens(), { wrapper });

    act(() => {
      result.current.setToken("primary", "#ff0000");
    });
    act(() => {
      result.current.clearTokens();
    });

    expect(result.current.tokens).toEqual({});
    expect(result.current.hasTokens).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("hasTokens reflects whether any tokens are set", () => {
    const { result } = renderHook(() => useDesignTokens(), { wrapper });
    expect(result.current.hasTokens).toBe(false);

    act(() => {
      result.current.setToken("accent", "#0000ff");
    });
    expect(result.current.hasTokens).toBe(true);

    act(() => {
      result.current.setToken("accent", "");
    });
    expect(result.current.hasTokens).toBe(false);
  });

  describe("loadTokens", () => {
    it("loads from localStorage on mount", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ primary: "#123456" }),
      );
      const { result } = renderHook(() => useDesignTokens(), { wrapper });
      expect(result.current.tokens.primary).toBe("#123456");
    });

    it("handles empty localStorage", () => {
      const { result } = renderHook(() => useDesignTokens(), { wrapper });
      expect(result.current.tokens).toEqual({});
    });

    it("handles invalid JSON in localStorage", () => {
      localStorage.setItem(STORAGE_KEY, "{not valid json");
      const { result } = renderHook(() => useDesignTokens(), { wrapper });
      expect(result.current.tokens).toEqual({});
    });

    it("handles array value in localStorage (passes typeof check)", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
      const { result } = renderHook(() => useDesignTokens(), { wrapper });
      expect(result.current.tokens).toEqual([1, 2, 3]);
    });

    it("handles non-object values (string)", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify("hello"));
      const { result } = renderHook(() => useDesignTokens(), { wrapper });
      expect(result.current.tokens).toEqual({});
    });

    it("handles non-object values (number)", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(42));
      const { result } = renderHook(() => useDesignTokens(), { wrapper });
      expect(result.current.tokens).toEqual({});
    });

    it("handles null value in localStorage", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(null));
      const { result } = renderHook(() => useDesignTokens(), { wrapper });
      expect(result.current.tokens).toEqual({});
    });
  });

  describe("saveTokens", () => {
    it("writes to localStorage when tokens exist", () => {
      const { result } = renderHook(() => useDesignTokens(), { wrapper });
      act(() => {
        result.current.setToken("background", "#ffffff");
      });
      expect(localStorage.getItem(STORAGE_KEY)).toBe(
        JSON.stringify({ background: "#ffffff" }),
      );
    });

    it("removes from localStorage when all tokens are empty", () => {
      const { result } = renderHook(() => useDesignTokens(), { wrapper });
      act(() => {
        result.current.setToken("primary", "#ff0000");
      });
      act(() => {
        result.current.setToken("primary", "");
      });
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  it("useDesignTokens throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useDesignTokens());
    }).toThrow("useDesignTokens must be used within a DesignTokensProvider");
  });
});
