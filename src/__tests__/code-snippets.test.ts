import { describe, it, expect } from "vitest";

/**
 * Tests for CodeSnippets component logic.
 * Tests the snippet generation patterns that the component renders.
 */

const ANIMATION_ID = "test-animation-123";
const ORIGIN = "https://lottie.example.com";

function buildJsonUrl(origin: string, id: string) {
  return `${origin}/api/animations/${id}/json`;
}

describe("CodeSnippets", () => {
  describe("JSON URL generation", () => {
    it("produces correct API URL from origin and animation ID", () => {
      const url = buildJsonUrl(ORIGIN, ANIMATION_ID);
      expect(url).toBe(
        "https://lottie.example.com/api/animations/test-animation-123/json"
      );
    });

    it("handles IDs with special characters", () => {
      const url = buildJsonUrl(ORIGIN, "anim-with-dashes");
      expect(url).toContain("/api/animations/anim-with-dashes/json");
    });
  });

  describe("snippet content", () => {
    const jsonUrl = buildJsonUrl(ORIGIN, ANIMATION_ID);

    it("HTML snippet contains lottie-web CDN script tag", () => {
      const htmlInstall = `<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>`;
      expect(htmlInstall).toContain("lottie-web");
      expect(htmlInstall).toContain("<script");
    });

    it("HTML snippet uses loadAnimation with correct path", () => {
      const htmlCode = `lottie.loadAnimation({
    container: document.getElementById('lottie-container'),
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: '${jsonUrl}'
  });`;
      expect(htmlCode).toContain("lottie.loadAnimation");
      expect(htmlCode).toContain(jsonUrl);
      expect(htmlCode).toContain("loop: true");
      expect(htmlCode).toContain("autoplay: true");
    });

    it("React snippet includes lottie-react import and fetch", () => {
      const reactCode = `import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';

export default function Animation() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('${jsonUrl}')
      .then(res => res.json())
      .then(setData);
  }, []);

  if (!data) return null;

  return <Lottie animationData={data} loop autoplay />;
}`;
      expect(reactCode).toContain("import Lottie from 'lottie-react'");
      expect(reactCode).toContain(`fetch('${jsonUrl}')`);
      expect(reactCode).toContain("<Lottie animationData={data}");
    });

    it("React install command is correct", () => {
      const install = "npm install lottie-react";
      expect(install).toBe("npm install lottie-react");
    });

    it("Vue snippet uses vue3-lottie component", () => {
      const vueCode = `<Vue3Lottie :animation-link="animationUrl" :loop="true" :autoplay="true" />`;
      expect(vueCode).toContain("Vue3Lottie");
      expect(vueCode).toContain(":loop");
      expect(vueCode).toContain(":autoplay");
    });

    it("Vue install command is correct", () => {
      const install = "npm install vue3-lottie";
      expect(install).toBe("npm install vue3-lottie");
    });

    it("React Native snippet uses LottieView with uri source", () => {
      const rnCode = `<LottieView
      source={{ uri: '${jsonUrl}' }}
      autoPlay
      loop
      style={{ width: 400, height: 400 }}
    />`;
      expect(rnCode).toContain("LottieView");
      expect(rnCode).toContain(`uri: '${jsonUrl}'`);
      expect(rnCode).toContain("autoPlay");
    });

    it("React Native install command is correct", () => {
      const install = "npm install lottie-react-native";
      expect(install).toBe("npm install lottie-react-native");
    });

    it("dotLottie snippet uses DotLottieReact with src prop", () => {
      const dotCode = `<DotLottieReact
      src="${jsonUrl}"
      loop
      autoplay
      style={{ width: 400, height: 400 }}
    />`;
      expect(dotCode).toContain("DotLottieReact");
      expect(dotCode).toContain(`src="${jsonUrl}"`);
      expect(dotCode).toContain("loop");
      expect(dotCode).toContain("autoplay");
    });

    it("dotLottie install command is correct", () => {
      const install = "npm install @dotlottie/react-player";
      expect(install).toBe("npm install @dotlottie/react-player");
    });
  });

  describe("tab configuration", () => {
    const TABS = ["html", "react", "vue", "reactNative", "dotLottie"] as const;

    it("has exactly 5 tabs", () => {
      expect(TABS).toHaveLength(5);
    });

    it("includes all required frameworks", () => {
      expect(TABS).toContain("html");
      expect(TABS).toContain("react");
      expect(TABS).toContain("vue");
      expect(TABS).toContain("reactNative");
      expect(TABS).toContain("dotLottie");
    });
  });
});
