import { describe, it, expect } from "vitest";
import { extractTitle } from "../titleExtractor";

describe("extractTitle", () => {
  describe("English prefix stripping", () => {
    it("strips 'make a'", () => {
      expect(extractTitle("make a bouncing red ball")).toBe("Bouncing Red Ball");
    });

    it("strips 'create'", () => {
      expect(extractTitle("create a smooth loading spinner")).toBe("Smooth Loading Spinner");
    });

    it("strips 'can you make'", () => {
      expect(extractTitle("can you make confetti bursting from the center")).toBe("Confetti Bursting From the Center");
    });

    it("strips 'can you create'", () => {
      expect(extractTitle("can you create a wave animation")).toBe("Wave Animation");
    });

    it("strips 'please make'", () => {
      expect(extractTitle("please make a spinning star")).toBe("Spinning Star");
    });

    it("strips 'I want'", () => {
      expect(extractTitle("I want a pulsing heart")).toBe("Pulsing Heart");
    });

    it("strips 'give me'", () => {
      expect(extractTitle("give me a glowing neon sign")).toBe("Glowing Neon Sign");
    });

    it("strips 'show me'", () => {
      expect(extractTitle("show me a rocket launching")).toBe("Rocket Launching");
    });

    it("strips 'animate'", () => {
      expect(extractTitle("animate a circle morphing into a square")).toBe("Circle Morphing Into a Square");
    });

    it("strips 'generate'", () => {
      expect(extractTitle("generate a loading dots animation")).toBe("Loading Dots Animation");
    });

    it("strips 'design'", () => {
      expect(extractTitle("design a toggle switch")).toBe("Toggle Switch");
    });
  });

  describe("Chinese prefix stripping", () => {
    it("strips '做一个'", () => {
      expect(extractTitle("做一个樱花飘落的动画")).toBe("樱花飘落的动画");
    });

    it("strips '帮我做一个'", () => {
      expect(extractTitle("帮我做一个弹跳的球")).toBe("弹跳的球");
    });

    it("strips '创建一个'", () => {
      expect(extractTitle("创建一个旋转的星星")).toBe("旋转的星星");
    });

    it("strips '画一个'", () => {
      expect(extractTitle("画一个跳动的心")).toBe("跳动的心");
    });

    it("strips '生成一个'", () => {
      expect(extractTitle("生成一个加载动画")).toBe("加载动画");
    });

    it("strips '我想要'", () => {
      expect(extractTitle("我想要一个闪烁的霓虹灯")).toBe("闪烁的霓虹灯");
    });

    it("strips '来一个'", () => {
      expect(extractTitle("来一个彩色波浪")).toBe("彩色波浪");
    });
  });

  describe("Suffix stripping", () => {
    it("strips 'for me'", () => {
      expect(extractTitle("create a loading spinner for me")).toBe("Loading Spinner");
    });

    it("strips 'please' at end", () => {
      expect(extractTitle("make a bouncing ball please")).toBe("Bouncing Ball");
    });

    it("strips 'for me please'", () => {
      expect(extractTitle("create a loading spinner for me please")).toBe("Loading Spinner");
    });

    it("strips 'thanks'", () => {
      expect(extractTitle("make a star animation thanks")).toBe("Star Animation");
    });

    it("strips Chinese '吧'", () => {
      expect(extractTitle("做一个弹跳的球吧")).toBe("弹跳的球");
    });

    it("strips Chinese '谢谢'", () => {
      expect(extractTitle("帮我画一个星星谢谢")).toBe("星星");
    });
  });

  describe("Title casing", () => {
    it("title-cases English text", () => {
      expect(extractTitle("bouncing ball with shadow")).toBe("Bouncing Ball with Shadow");
    });

    it("keeps small words lowercase in middle", () => {
      expect(extractTitle("make a ball on the floor")).toBe("Ball on the Floor");
    });

    it("capitalizes first word even if it's a small word", () => {
      expect(extractTitle("the spinning wheel")).toBe("Spinning Wheel");
    });

    it("does NOT title-case Chinese text", () => {
      expect(extractTitle("弹跳的红色小球")).toBe("弹跳的红色小球");
    });
  });

  describe("Truncation", () => {
    it("truncates long English text at word boundary", () => {
      const longMsg = "make a very elaborate and incredibly detailed animation of a magical unicorn flying through rainbow clouds while sparkling";
      const result = extractTitle(longMsg);
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).not.toMatch(/\s$/); // no trailing space
      expect(result.length).toBeGreaterThan(20); // reasonable length
    });

    it("truncates long Chinese text", () => {
      const longMsg = "做一个非常复杂的包含很多元素的动画包括旋转的星星跳动的心形还有飘落的樱花花瓣以及闪烁的霓虹灯效果";
      const result = extractTitle(longMsg);
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it("does not truncate short text", () => {
      expect(extractTitle("make a red ball")).toBe("Red Ball");
    });
  });

  describe("Edge cases", () => {
    it("returns 'Untitled' for empty string", () => {
      expect(extractTitle("")).toBe("Untitled");
    });

    it("returns 'Untitled' for whitespace-only input", () => {
      expect(extractTitle("   ")).toBe("Untitled");
    });

    it("handles input that IS just a prefix", () => {
      expect(extractTitle("create")).toBe("Untitled");
    });

    it("handles input with no prefix to strip", () => {
      expect(extractTitle("sakura petals")).toBe("Sakura Petals");
    });

    it("handles input already clean", () => {
      expect(extractTitle("Bouncing ball")).toBe("Bouncing Ball");
    });

    it("handles extra whitespace", () => {
      expect(extractTitle("  make   a   spinning   wheel  ")).toBe("Spinning Wheel");
    });

    it("does not strip prefix that's part of the content", () => {
      // "create" at start followed by more content
      expect(extractTitle("creative circles bouncing")).toBe("Creative Circles Bouncing");
    });

    it("handles combined prefix + suffix", () => {
      expect(extractTitle("can you make confetti for me please")).toBe("Confetti");
    });

    it("preserves meaningful content after stripping", () => {
      expect(extractTitle("I want a smooth toggle switch animation with spring easing")).toBe("Smooth Toggle Switch Animation with Spring Easing");
    });
  });

  describe("Article stripping", () => {
    it("strips leading 'a' after prefix removal", () => {
      expect(extractTitle("make a circle")).toBe("Circle");
    });

    it("strips leading 'an' after prefix removal", () => {
      expect(extractTitle("create an animated clock")).toBe("Animated Clock");
    });

    it("strips leading 'the' after prefix removal", () => {
      expect(extractTitle("animate the logo")).toBe("Logo");
    });

    it("does NOT strip articles from non-leading position", () => {
      expect(extractTitle("ball on a hill")).toBe("Ball on a Hill");
    });
  });
});
