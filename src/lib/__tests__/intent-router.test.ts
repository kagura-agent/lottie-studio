import { describe, it, expect } from "vitest";
import { detectIntent } from "../intent-router";

describe("intent-router", () => {
  describe("returns null for non-matching inputs", () => {
    it("returns null for empty string", () => {
      expect(detectIntent("")).toBeNull();
    });

    it("returns null for slash commands (already handled)", () => {
      expect(detectIntent("/shadow")).toBeNull();
      expect(detectIntent("/fade in")).toBeNull();
    });

    it("returns null for long creative descriptions", () => {
      expect(detectIntent("create a beautiful sunset animation with birds flying across the sky and clouds moving slowly")).toBeNull();
    });

    it("returns null for creative prompts starting with create/design/generate", () => {
      expect(detectIntent("create a bouncing ball")).toBeNull();
      expect(detectIntent("design a loading spinner")).toBeNull();
      expect(detectIntent("generate a logo reveal")).toBeNull();
      expect(detectIntent("draw me a heart")).toBeNull();
    });

    it("returns null for multi-intent messages", () => {
      expect(detectIntent("add a shadow and make it bounce")).toBeNull();
      expect(detectIntent("fade in then slide out")).toBeNull();
      expect(detectIntent("blur it and also add gradient")).toBeNull();
    });

    it("returns null for general questions", () => {
      expect(detectIntent("how do I export this?")).toBeNull();
      expect(detectIntent("what format is best for web?")).toBeNull();
    });

    it("returns null for messages over max length", () => {
      const longMsg = "make it bounce ".repeat(10);
      expect(detectIntent(longMsg)).toBeNull();
    });
  });

  describe("undo", () => {
    it.each(["undo", "undo that", "undo it", "go back", "never mind", "nvm", "revert", "revert that"])(
      "matches '%s'",
      (msg) => {
        expect(detectIntent(msg)).toEqual({ type: "undo" });
      },
    );

    it("does not match 'undo the animation'", () => {
      expect(detectIntent("undo the animation")).toBeNull();
    });
  });

  describe("redo", () => {
    it.each(["redo", "redo that", "redo it"])("matches '%s'", (msg) => {
      expect(detectIntent(msg)).toEqual({ type: "redo" });
    });

    it("does not match 'redo the whole thing'", () => {
      expect(detectIntent("redo the whole thing")).toBeNull();
    });
  });

  describe("reverse", () => {
    it("matches 'reverse'", () => {
      expect(detectIntent("reverse")).toEqual({ type: "reverse" });
    });

    it("matches 'play it backwards'", () => {
      expect(detectIntent("play it backwards")).toEqual({ type: "reverse" });
    });

    it("matches 'backwards'", () => {
      expect(detectIntent("backwards")).toEqual({ type: "reverse" });
    });
  });

  describe("loop", () => {
    it("matches 'loop it'", () => {
      expect(detectIntent("loop it")).toEqual({ type: "loop", mode: "seamless" });
    });

    it("matches 'make it loop'", () => {
      expect(detectIntent("make it loop")).toEqual({ type: "loop", mode: "seamless" });
    });

    it("matches 'repeat it forever'", () => {
      expect(detectIntent("repeat it forever")).toEqual({ type: "loop", mode: "seamless" });
    });

    it("matches 'pingpong'", () => {
      expect(detectIntent("pingpong")).toEqual({ type: "loop", mode: "pingpong" });
    });

    it("matches 'yo-yo'", () => {
      expect(detectIntent("yo-yo")).toEqual({ type: "loop", mode: "pingpong" });
    });
  });

  describe("fade", () => {
    it("matches 'fade in'", () => {
      const result = detectIntent("fade in");
      expect(result).toMatchObject({ type: "fade", mode: "in" });
    });

    it("matches 'fade it out'", () => {
      const result = detectIntent("fade it out");
      expect(result).toMatchObject({ type: "fade", mode: "out" });
    });

    it("matches 'add fade'", () => {
      const result = detectIntent("add fade");
      expect(result).toMatchObject({ type: "fade", mode: "in" });
    });
  });

  describe("shadow", () => {
    it("matches 'add a shadow'", () => {
      const result = detectIntent("add a shadow");
      expect(result).toMatchObject({ type: "shadow" });
    });

    it("matches 'drop shadow'", () => {
      const result = detectIntent("drop shadow");
      expect(result).toMatchObject({ type: "shadow", options: { type: "drop" } });
    });

    it("matches 'give it a shadow'", () => {
      const result = detectIntent("give it a shadow");
      expect(result).toMatchObject({ type: "shadow" });
    });

    it("matches 'add glow'", () => {
      const result = detectIntent("add glow");
      expect(result).toMatchObject({ type: "shadow", options: { type: "glow" } });
    });

    it("matches 'glow effect'", () => {
      const result = detectIntent("glow effect");
      expect(result).toMatchObject({ type: "shadow", options: { type: "glow" } });
    });
  });

  describe("blur", () => {
    it("matches 'add blur'", () => {
      expect(detectIntent("add blur")).toMatchObject({ type: "blur" });
    });

    it("matches 'make it blurry'", () => {
      expect(detectIntent("make it blurry")).toMatchObject({ type: "blur" });
    });

    it("matches 'blur it'", () => {
      expect(detectIntent("blur it")).toMatchObject({ type: "blur" });
    });

    it("matches 'depth of field'", () => {
      expect(detectIntent("depth of field")).toMatchObject({ type: "blur", options: { mode: "pulse" } });
    });
  });

  describe("mirror", () => {
    it("matches 'mirror it'", () => {
      expect(detectIntent("mirror it")).toEqual({ type: "mirror_h" });
    });

    it("matches 'flip horizontally'", () => {
      expect(detectIntent("flip horizontally")).toEqual({ type: "mirror_h" });
    });

    it("matches 'mirror vertically'", () => {
      expect(detectIntent("mirror vertically")).toEqual({ type: "mirror_v" });
    });

    it("matches 'flip it vertically'", () => {
      expect(detectIntent("flip it vertically")).toEqual({ type: "mirror_v" });
    });
  });

  describe("physics", () => {
    it("matches 'make it bounce'", () => {
      expect(detectIntent("make it bounce")).toMatchObject({ type: "physics", options: { effect: "bounce" } });
    });

    it("matches 'add bounce'", () => {
      expect(detectIntent("add bounce")).toMatchObject({ type: "physics", options: { effect: "bounce" } });
    });

    it("matches 'bouncing'", () => {
      expect(detectIntent("bouncing")).toMatchObject({ type: "physics", options: { effect: "bounce" } });
    });

    it("matches 'apply gravity'", () => {
      expect(detectIntent("apply gravity")).toMatchObject({ type: "physics", options: { effect: "gravity" } });
    });

    it("matches 'make it fall'", () => {
      expect(detectIntent("make it fall")).toMatchObject({ type: "physics", options: { effect: "gravity" } });
    });

    it("matches 'floating'", () => {
      expect(detectIntent("floating")).toMatchObject({ type: "physics", options: { effect: "float" } });
    });

    it("matches 'pendulum'", () => {
      expect(detectIntent("pendulum")).toMatchObject({ type: "physics", options: { effect: "pendulum" } });
    });
  });

  describe("wave", () => {
    it("matches 'add wave'", () => {
      expect(detectIntent("add wave")).toMatchObject({ type: "wave" });
    });

    it("matches 'wave effect'", () => {
      expect(detectIntent("wave effect")).toMatchObject({ type: "wave" });
    });

    it("matches 'make it wave'", () => {
      expect(detectIntent("make it wave")).toMatchObject({ type: "wave" });
    });
  });

  describe("shake", () => {
    it("matches 'shake it'", () => {
      expect(detectIntent("shake it")).toMatchObject({ type: "shake" });
    });

    it("matches 'add shake'", () => {
      expect(detectIntent("add shake")).toMatchObject({ type: "shake" });
    });
  });

  describe("wiggle", () => {
    it("matches 'wiggle it'", () => {
      expect(detectIntent("wiggle it")).toMatchObject({ type: "wiggle" });
    });

    it("matches 'add wiggle'", () => {
      expect(detectIntent("add wiggle")).toMatchObject({ type: "wiggle" });
    });
  });

  describe("spring", () => {
    it("matches 'add spring'", () => {
      expect(detectIntent("add spring")).toMatchObject({ type: "spring" });
    });

    it("matches 'make it springy'", () => {
      expect(detectIntent("make it springy")).toMatchObject({ type: "spring" });
    });
  });

  describe("particle", () => {
    it("matches 'add particles'", () => {
      expect(detectIntent("add particles")).toMatchObject({ type: "particle" });
    });

    it("matches 'confetti'", () => {
      expect(detectIntent("confetti")).toMatchObject({ type: "particle", particleType: "confetti" });
    });

    it("matches 'add snow'", () => {
      expect(detectIntent("add snow")).toMatchObject({ type: "particle", particleType: "snow" });
    });

    it("matches 'make it rain'", () => {
      expect(detectIntent("make it rain")).toMatchObject({ type: "particle", particleType: "rain" });
    });
  });

  describe("3d/threed", () => {
    it("matches 'make it 3d'", () => {
      expect(detectIntent("make it 3d")).toMatchObject({ type: "threed" });
    });

    it("matches 'add 3d effect'", () => {
      expect(detectIntent("add 3d effect")).toMatchObject({ type: "threed" });
    });

    it("matches 'add perspective'", () => {
      expect(detectIntent("add perspective")).toMatchObject({ type: "threed" });
    });
  });

  describe("gradient", () => {
    it("matches 'add gradient'", () => {
      expect(detectIntent("add gradient")).toMatchObject({ type: "gradient" });
    });

    it("matches 'gradient fill'", () => {
      expect(detectIntent("gradient fill")).toMatchObject({ type: "gradient" });
    });

    it("matches 'make it gradient'", () => {
      expect(detectIntent("make it gradient")).toMatchObject({ type: "gradient" });
    });
  });

  describe("mask", () => {
    it("matches 'add a mask'", () => {
      expect(detectIntent("add a mask")).toMatchObject({ type: "mask" });
    });

    it("matches 'reveal effect'", () => {
      expect(detectIntent("reveal effect")).toMatchObject({ type: "mask" });
    });
  });

  describe("repeat/pattern", () => {
    it("matches 'add pattern'", () => {
      expect(detectIntent("add pattern")).toMatchObject({ type: "repeat" });
    });

    it("matches 'make a grid'", () => {
      expect(detectIntent("make a grid")).toMatchObject({ type: "repeat" });
    });

    it("matches 'repeat pattern'", () => {
      expect(detectIntent("repeat pattern")).toMatchObject({ type: "repeat" });
    });
  });

  describe("trail", () => {
    it("matches 'add trail'", () => {
      expect(detectIntent("add trail")).toMatchObject({ type: "trail" });
    });

    it("matches 'motion trail'", () => {
      expect(detectIntent("motion trail")).toMatchObject({ type: "trail" });
    });
  });

  describe("draw", () => {
    it("matches 'draw effect'", () => {
      expect(detectIntent("draw effect")).toMatchObject({ type: "draw" });
    });

    it("matches 'stroke reveal'", () => {
      expect(detectIntent("stroke reveal")).toMatchObject({ type: "draw" });
    });
  });

  describe("slide", () => {
    it("matches 'slide in'", () => {
      expect(detectIntent("slide in")).toMatchObject({ type: "slide", direction: "left" });
    });

    it("matches 'slide it out'", () => {
      const result = detectIntent("slide it out");
      expect(result).toMatchObject({ type: "slide", options: { out: true } });
    });

    it("matches 'slide from right'", () => {
      expect(detectIntent("slide from right")).toMatchObject({ type: "slide", direction: "right" });
    });

    it("matches 'slide it up'", () => {
      expect(detectIntent("slide it up")).toMatchObject({ type: "slide", direction: "up" });
    });
  });

  describe("rotate", () => {
    it("matches 'spin'", () => {
      expect(detectIntent("spin")).toEqual({ type: "rotate", degrees: 360 });
    });

    it("matches 'make it spin'", () => {
      expect(detectIntent("make it spin")).toEqual({ type: "rotate", degrees: 360 });
    });
  });

  describe("scale", () => {
    it("matches 'make it bigger'", () => {
      expect(detectIntent("make it bigger")).toEqual({ type: "scale", factor: 1.5 });
    });

    it("matches 'shrink'", () => {
      expect(detectIntent("shrink")).toEqual({ type: "scale", factor: 0.5 });
    });

    it("matches 'scale up'", () => {
      expect(detectIntent("scale up")).toEqual({ type: "scale", factor: 1.5 });
    });
  });

  describe("speed", () => {
    it("matches 'make it faster'", () => {
      expect(detectIntent("make it faster")).toEqual({ type: "speed", speed: 2 });
    });

    it("matches 'speed it up'", () => {
      expect(detectIntent("speed it up")).toEqual({ type: "speed", speed: 2 });
    });

    it("matches 'slower'", () => {
      expect(detectIntent("slower")).toEqual({ type: "speed", speed: 0.5 });
    });

    it("matches 'slow it down'", () => {
      expect(detectIntent("slow it down")).toEqual({ type: "speed", speed: 0.5 });
    });
  });

  describe("camera", () => {
    it("matches 'zoom in'", () => {
      expect(detectIntent("zoom in")).toMatchObject({ type: "camera", movement: "zoom-in" });
    });

    it("matches 'zoom out'", () => {
      expect(detectIntent("zoom out")).toMatchObject({ type: "camera", movement: "zoom-out" });
    });

    it("matches 'pan'", () => {
      expect(detectIntent("pan")).toMatchObject({ type: "camera", movement: "pan-left" });
    });
  });

  describe("optimize", () => {
    it("matches 'optimize'", () => {
      expect(detectIntent("optimize")).toEqual({ type: "optimize" });
    });

    it("matches 'compress'", () => {
      expect(detectIntent("compress")).toEqual({ type: "optimize" });
    });

    it("matches 'reduce file size'", () => {
      expect(detectIntent("reduce file size")).toEqual({ type: "optimize" });
    });
  });

  describe("critique/fix/polish", () => {
    it("matches 'critique'", () => {
      expect(detectIntent("critique")).toEqual({ type: "critique" });
    });

    it("matches 'fix it'", () => {
      expect(detectIntent("fix it")).toEqual({ type: "fix" });
    });

    it("matches 'polish'", () => {
      expect(detectIntent("polish")).toEqual({ type: "polish" });
    });

    it("matches 'clean it up'", () => {
      expect(detectIntent("clean it up")).toEqual({ type: "polish" });
    });
  });

  describe("easing", () => {
    it("matches 'make it smooth'", () => {
      expect(detectIntent("make it smooth")).toMatchObject({ type: "easing" });
    });

    it("matches 'add easing'", () => {
      expect(detectIntent("add easing")).toMatchObject({ type: "easing" });
    });
  });

  describe("stagger", () => {
    it("matches 'stagger them'", () => {
      expect(detectIntent("stagger them")).toMatchObject({ type: "stagger" });
    });

    it("matches 'add stagger'", () => {
      expect(detectIntent("add stagger")).toMatchObject({ type: "stagger" });
    });
  });

  describe("help", () => {
    it("matches 'help'", () => {
      expect(detectIntent("help")).toEqual({ type: "help" });
    });

    it("matches 'what can you do'", () => {
      expect(detectIntent("what can you do")).toEqual({ type: "help" });
    });

    it("matches 'commands'", () => {
      expect(detectIntent("commands")).toEqual({ type: "help" });
    });
  });

  describe("transition", () => {
    it("matches 'add transition'", () => {
      expect(detectIntent("add transition")).toMatchObject({ type: "transition" });
    });

    it("matches 'transition effect'", () => {
      expect(detectIntent("transition effect")).toMatchObject({ type: "transition" });
    });
  });

  describe("morph", () => {
    it("matches 'morph it'", () => {
      expect(detectIntent("morph it")).toMatchObject({ type: "morph" });
    });

    it("matches 'shape morph'", () => {
      expect(detectIntent("shape morph")).toMatchObject({ type: "morph" });
    });
  });

  describe("color intents", () => {
    it("matches 'make it warm'", () => {
      expect(detectIntent("make it warm")).toMatchObject({ type: "color", subcommand: { action: "warm" } });
    });

    it("matches 'make it warmer'", () => {
      expect(detectIntent("make it warmer")).toMatchObject({ type: "color", subcommand: { action: "warm" } });
    });

    it("matches 'make it cool'", () => {
      expect(detectIntent("make it cool")).toMatchObject({ type: "color", subcommand: { action: "cool" } });
    });

    it("matches 'make it cooler'", () => {
      expect(detectIntent("make it cooler")).toMatchObject({ type: "color", subcommand: { action: "cool" } });
    });

    it("matches 'invert colors'", () => {
      expect(detectIntent("invert colors")).toMatchObject({ type: "color", subcommand: { action: "invert" } });
    });

    it("matches 'invert it'", () => {
      expect(detectIntent("invert it")).toMatchObject({ type: "color", subcommand: { action: "invert" } });
    });

    it("matches 'make it brighter'", () => {
      expect(detectIntent("make it brighter")).toMatchObject({ type: "color", subcommand: { action: "brighten", amount: 0.2 } });
    });

    it("matches 'make it lighter'", () => {
      expect(detectIntent("make it lighter")).toMatchObject({ type: "color", subcommand: { action: "brighten", amount: 0.2 } });
    });

    it("matches 'make it darker'", () => {
      expect(detectIntent("make it darker")).toMatchObject({ type: "color", subcommand: { action: "brighten", amount: -0.2 } });
    });

    it("matches 'make it dimmer'", () => {
      expect(detectIntent("make it dimmer")).toMatchObject({ type: "color", subcommand: { action: "brighten", amount: -0.2 } });
    });

    it("matches 'more saturated'", () => {
      expect(detectIntent("more saturated")).toMatchObject({ type: "color", subcommand: { action: "saturate", amount: 0.3 } });
    });

    it("matches 'vivid'", () => {
      expect(detectIntent("vivid")).toMatchObject({ type: "color", subcommand: { action: "saturate", amount: 0.3 } });
    });

    it("matches 'vibrant'", () => {
      expect(detectIntent("vibrant")).toMatchObject({ type: "color", subcommand: { action: "saturate", amount: 0.3 } });
    });

    it("matches 'desaturate'", () => {
      expect(detectIntent("desaturate")).toMatchObject({ type: "color", subcommand: { action: "saturate", amount: -0.3 } });
    });

    it("matches 'muted'", () => {
      expect(detectIntent("muted")).toMatchObject({ type: "color", subcommand: { action: "saturate", amount: -0.3 } });
    });

    it("matches 'grayscale'", () => {
      expect(detectIntent("grayscale")).toMatchObject({ type: "color", subcommand: { action: "mono" } });
    });

    it("matches 'black and white'", () => {
      expect(detectIntent("black and white")).toMatchObject({ type: "color", subcommand: { action: "mono" } });
    });

    it("matches 'monochrome'", () => {
      expect(detectIntent("monochrome")).toMatchObject({ type: "color", subcommand: { action: "mono" } });
    });

    it("matches 'make it red'", () => {
      expect(detectIntent("make it red")).toMatchObject({ type: "color", subcommand: { action: "swap", from: "all", to: "#ff0000" } });
    });

    it("matches 'make it blue'", () => {
      expect(detectIntent("make it blue")).toMatchObject({ type: "color", subcommand: { action: "swap", from: "all", to: "#0066ff" } });
    });

    it("matches 'make it gold'", () => {
      expect(detectIntent("make it gold")).toMatchObject({ type: "color", subcommand: { action: "swap", from: "all", to: "#ffd700" } });
    });

    it("matches 'make it #ff6600'", () => {
      expect(detectIntent("make it #ff6600")).toMatchObject({ type: "color", subcommand: { action: "swap", from: "all", to: "#ff6600" } });
    });

    it("matches 'change to #abc'", () => {
      expect(detectIntent("change to #abc")).toMatchObject({ type: "color", subcommand: { action: "swap", from: "all", to: "#abc" } });
    });

    it("matches 'show palette'", () => {
      expect(detectIntent("show palette")).toMatchObject({ type: "color", subcommand: { action: "palette" } });
    });

    it("matches 'show colors'", () => {
      expect(detectIntent("show colors")).toMatchObject({ type: "color", subcommand: { action: "palette" } });
    });

    it("matches 'what colors'", () => {
      expect(detectIntent("what colors")).toMatchObject({ type: "color", subcommand: { action: "palette" } });
    });
  });

  describe("text", () => {
    it("matches 'add text hello world'", () => {
      expect(detectIntent("add text hello world")).toMatchObject({ type: "text", text: "hello world", options: {} });
    });

    it("matches 'write welcome'", () => {
      expect(detectIntent("write welcome")).toMatchObject({ type: "text", text: "welcome", options: {} });
    });

    it("matches 'type out loading...'", () => {
      expect(detectIntent("type out loading...")).toMatchObject({ type: "text", text: "loading...", options: { style: "typewriter" } });
    });

    it("matches 'put text saying goodbye'", () => {
      expect(detectIntent("put text saying goodbye")).toMatchObject({ type: "text", text: "goodbye", options: {} });
    });

    it("matches 'text hello'", () => {
      expect(detectIntent("text hello")).toMatchObject({ type: "text", text: "hello", options: {} });
    });

    it("matches 'typewriter text hello'", () => {
      expect(detectIntent("typewriter text hello")).toMatchObject({ type: "text", text: "hello", options: { style: "typewriter" } });
    });

    it("matches 'bouncing text hello'", () => {
      expect(detectIntent("bouncing text hello")).toMatchObject({ type: "text", text: "hello", options: { style: "bounce" } });
    });

    it("matches 'glitch text hello'", () => {
      expect(detectIntent("glitch text hello")).toMatchObject({ type: "text", text: "hello", options: { style: "glitch" } });
    });

    it("matches 'wave text hello'", () => {
      expect(detectIntent("wave text hello")).toMatchObject({ type: "text", text: "hello", options: { style: "wave" } });
    });

    it("does NOT match long creative prompts", () => {
      expect(detectIntent("create an animation with text flying in from the left side")).toBeNull();
    });
  });

  describe("export", () => {
    it("matches 'export as gif'", () => {
      expect(detectIntent("export as gif")).toEqual({ type: "export_gif" });
    });

    it("matches 'save as gif'", () => {
      expect(detectIntent("save as gif")).toEqual({ type: "export_gif" });
    });

    it("matches 'download gif'", () => {
      expect(detectIntent("download gif")).toEqual({ type: "export_gif" });
    });

    it("matches 'export as video'", () => {
      expect(detectIntent("export as video")).toEqual({ type: "export_video" });
    });

    it("matches 'save as mp4'", () => {
      expect(detectIntent("save as mp4")).toEqual({ type: "export_video" });
    });

    it("matches 'download video'", () => {
      expect(detectIntent("download video")).toEqual({ type: "export_video" });
    });

    it("matches 'export mp4'", () => {
      expect(detectIntent("export mp4")).toEqual({ type: "export_video" });
    });

    it("matches 'export json'", () => {
      expect(detectIntent("export json")).toEqual({ type: "export_json" });
    });

    it("matches 'save json'", () => {
      expect(detectIntent("save json")).toEqual({ type: "export_json" });
    });

    it("matches 'download json'", () => {
      expect(detectIntent("download json")).toEqual({ type: "export_json" });
    });

    it("matches 'export as json'", () => {
      expect(detectIntent("export as json")).toEqual({ type: "export_json" });
    });

    it("matches 'export as dotlottie'", () => {
      expect(detectIntent("export as dotlottie")).toEqual({ type: "export_dotlottie" });
    });

    it("matches 'save as .lottie'", () => {
      expect(detectIntent("save as .lottie")).toEqual({ type: "export_dotlottie" });
    });

    it("matches 'export dotlottie'", () => {
      expect(detectIntent("export dotlottie")).toEqual({ type: "export_dotlottie" });
    });

    it("matches 'export as apng'", () => {
      expect(detectIntent("export as apng")).toEqual({ type: "export_apng" });
    });

    it("matches 'save as apng'", () => {
      expect(detectIntent("save as apng")).toEqual({ type: "export_apng" });
    });

    it("matches 'download apng'", () => {
      expect(detectIntent("download apng")).toEqual({ type: "export_apng" });
    });

    it("returns null for ambiguous 'export'", () => {
      expect(detectIntent("export")).toBeNull();
    });

    it("returns null for 'I want to export my creativity'", () => {
      expect(detectIntent("I want to export my creativity")).toBeNull();
    });
  });

  describe("trim", () => {
    it("matches 'trim to 2 seconds'", () => {
      expect(detectIntent("trim to 2 seconds")).toMatchObject({ type: "trim", range: { start: { value: 0, unit: "start" }, end: { value: 2, unit: "seconds" } } });
    });

    it("matches 'trim it to 2s'", () => {
      expect(detectIntent("trim it to 2s")).toMatchObject({ type: "trim", range: { start: { value: 0, unit: "start" }, end: { value: 2, unit: "seconds" } } });
    });

    it("matches 'cut first 1s'", () => {
      expect(detectIntent("cut first 1s")).toMatchObject({ type: "trim", range: { start: { value: 0, unit: "start" }, end: { value: 1, unit: "seconds" } } });
    });

    it("matches 'trim first second'", () => {
      expect(detectIntent("trim first second")).toMatchObject({ type: "trim", range: { start: { value: 0, unit: "start" }, end: { value: 1, unit: "seconds" } } });
    });

    it("matches 'keep last 2 seconds'", () => {
      expect(detectIntent("keep last 2 seconds")).toMatchObject({ type: "trim", range: { start: { value: 2, unit: "seconds" }, end: { value: 0, unit: "end" } } });
    });

    it("matches 'trim frames 10-50'", () => {
      expect(detectIntent("trim frames 10-50")).toMatchObject({ type: "trim", range: { start: { value: 10, unit: "frame" }, end: { value: 50, unit: "frame" } } });
    });

    it("matches 'keep frames 0-30'", () => {
      expect(detectIntent("keep frames 0-30")).toMatchObject({ type: "trim", range: { start: { value: 0, unit: "frame" }, end: { value: 30, unit: "frame" } } });
    });

    it("matches Chinese '裁剪到2秒'", () => {
      expect(detectIntent("裁剪到2秒")).toMatchObject({ type: "trim", range: { start: { value: 0, unit: "start" }, end: { value: 2, unit: "seconds" } } });
    });

    it("matches Chinese '截取前2秒'", () => {
      expect(detectIntent("截取前2秒")).toMatchObject({ type: "trim", range: { start: { value: 0, unit: "start" }, end: { value: 2, unit: "seconds" } } });
    });

    it("matches Chinese '保留最后3秒'", () => {
      expect(detectIntent("保留最后3秒")).toMatchObject({ type: "trim", range: { start: { value: 3, unit: "seconds" }, end: { value: 0, unit: "end" } } });
    });
  });

  describe("duration", () => {
    it("matches 'make it 2 seconds'", () => {
      expect(detectIntent("make it 2 seconds")).toEqual({ type: "duration", durationMs: 2000 });
    });

    it("matches 'set duration to 2s'", () => {
      expect(detectIntent("set duration to 2s")).toEqual({ type: "duration", durationMs: 2000 });
    });

    it("matches 'make it 500ms'", () => {
      expect(detectIntent("make it 500ms")).toEqual({ type: "duration", durationMs: 500 });
    });

    it("matches 'duration 3s'", () => {
      expect(detectIntent("duration 3s")).toEqual({ type: "duration", durationMs: 3000 });
    });

    it("matches 'change length to 3 seconds'", () => {
      expect(detectIntent("change length to 3 seconds")).toEqual({ type: "duration", durationMs: 3000 });
    });

    it("matches 'set length 3s'", () => {
      expect(detectIntent("set length 3s")).toEqual({ type: "duration", durationMs: 3000 });
    });

    it("matches Chinese '改成2秒'", () => {
      expect(detectIntent("改成2秒")).toEqual({ type: "duration", durationMs: 2000 });
    });

    it("matches Chinese '时长设为3秒'", () => {
      expect(detectIntent("时长设为3秒")).toEqual({ type: "duration", durationMs: 3000 });
    });

    it("matches Chinese '设置时长2秒'", () => {
      expect(detectIntent("设置时长2秒")).toEqual({ type: "duration", durationMs: 2000 });
    });

    it("matches Chinese '改为500毫秒'", () => {
      expect(detectIntent("改为500毫秒")).toEqual({ type: "duration", durationMs: 500 });
    });
  });

  describe("layers", () => {
    it("matches 'show layers'", () => {
      expect(detectIntent("show layers")).toEqual({ type: "layers" });
    });

    it("matches 'list layers'", () => {
      expect(detectIntent("list layers")).toEqual({ type: "layers" });
    });

    it("matches 'what layers'", () => {
      expect(detectIntent("what layers")).toEqual({ type: "layers" });
    });

    it("matches 'layers'", () => {
      expect(detectIntent("layers")).toEqual({ type: "layers" });
    });

    it("matches Chinese '显示图层'", () => {
      expect(detectIntent("显示图层")).toEqual({ type: "layers" });
    });

    it("matches Chinese '有哪些图层'", () => {
      expect(detectIntent("有哪些图层")).toEqual({ type: "layers" });
    });

    it("matches Chinese '图层列表'", () => {
      expect(detectIntent("图层列表")).toEqual({ type: "layers" });
    });

    it("matches Chinese '查看图层'", () => {
      expect(detectIntent("查看图层")).toEqual({ type: "layers" });
    });

    it("returns null for overly long message mentioning layers", () => {
      expect(detectIntent("show me all the layers in this animation and tell me what each one does in detail")).toBeNull();
    });
  });

  describe("path motion", () => {
    // circle
    it("matches 'move in a circle'", () => {
      expect(detectIntent("move in a circle")).toMatchObject({ type: "path", shape: "circle", options: { shape: "circle" } });
    });

    it("matches 'orbit'", () => {
      expect(detectIntent("orbit")).toMatchObject({ type: "path", shape: "circle" });
    });

    it("matches 'circular path'", () => {
      expect(detectIntent("circular path")).toMatchObject({ type: "path", shape: "circle" });
    });

    it("matches 'circular motion'", () => {
      expect(detectIntent("circular motion")).toMatchObject({ type: "path", shape: "circle" });
    });

    it("matches 'go around'", () => {
      expect(detectIntent("go around")).toMatchObject({ type: "path", shape: "circle" });
    });

    // wave path (disambiguated from wave visual effect)
    it("matches 'wave path'", () => {
      expect(detectIntent("wave path")).toMatchObject({ type: "path", shape: "wave" });
    });

    it("matches 'wavy path'", () => {
      expect(detectIntent("wavy path")).toMatchObject({ type: "path", shape: "wave" });
    });

    it("matches 'sine path'", () => {
      expect(detectIntent("sine path")).toMatchObject({ type: "path", shape: "wave" });
    });

    it("matches 'wave motion'", () => {
      expect(detectIntent("wave motion")).toMatchObject({ type: "path", shape: "wave" });
    });

    // spiral
    it("matches 'spiral'", () => {
      expect(detectIntent("spiral")).toMatchObject({ type: "path", shape: "spiral" });
    });

    it("matches 'spiral motion'", () => {
      expect(detectIntent("spiral motion")).toMatchObject({ type: "path", shape: "spiral" });
    });

    it("matches 'spiral path'", () => {
      expect(detectIntent("spiral path")).toMatchObject({ type: "path", shape: "spiral" });
    });

    // figure-8
    it("matches 'figure eight'", () => {
      expect(detectIntent("figure eight")).toMatchObject({ type: "path", shape: "figure-8" });
    });

    it("matches 'figure 8'", () => {
      expect(detectIntent("figure 8")).toMatchObject({ type: "path", shape: "figure-8" });
    });

    it("matches 'figure-8'", () => {
      expect(detectIntent("figure-8")).toMatchObject({ type: "path", shape: "figure-8" });
    });

    it("matches 'infinity path'", () => {
      expect(detectIntent("infinity path")).toMatchObject({ type: "path", shape: "figure-8" });
    });

    // arc
    it("matches 'arc motion'", () => {
      expect(detectIntent("arc motion")).toMatchObject({ type: "path", shape: "arc" });
    });

    it("matches 'arc path'", () => {
      expect(detectIntent("arc path")).toMatchObject({ type: "path", shape: "arc" });
    });

    it("matches 'curved path'", () => {
      expect(detectIntent("curved path")).toMatchObject({ type: "path", shape: "arc" });
    });

    it("matches 'move in an arc'", () => {
      expect(detectIntent("move in an arc")).toMatchObject({ type: "path", shape: "arc" });
    });

    // zigzag
    it("matches 'zigzag path'", () => {
      expect(detectIntent("zigzag path")).toMatchObject({ type: "path", shape: "zigzag" });
    });

    it("matches 'zigzag motion'", () => {
      expect(detectIntent("zigzag motion")).toMatchObject({ type: "path", shape: "zigzag" });
    });

    // pendulum path (disambiguated from physics pendulum)
    it("matches 'pendulum path'", () => {
      expect(detectIntent("pendulum path")).toMatchObject({ type: "path", shape: "pendulum" });
    });

    it("matches 'pendulum motion path'", () => {
      expect(detectIntent("pendulum motion path")).toMatchObject({ type: "path", shape: "pendulum" });
    });

    it("matches 'swing path'", () => {
      expect(detectIntent("swing path")).toMatchObject({ type: "path", shape: "pendulum" });
    });

    // clockwise/counterclockwise
    it("matches 'move clockwise'", () => {
      expect(detectIntent("move clockwise")).toMatchObject({ type: "path", shape: "circle", options: { clockwise: true } });
    });

    it("matches 'go counterclockwise'", () => {
      expect(detectIntent("go counterclockwise")).toMatchObject({ type: "path", shape: "circle", options: { clockwise: false } });
    });

    it("matches 'move ccw'", () => {
      expect(detectIntent("move ccw")).toMatchObject({ type: "path", shape: "circle", options: { clockwise: false } });
    });

    // Chinese path patterns
    it("matches Chinese '圆形路径'", () => {
      expect(detectIntent("圆形路径")).toMatchObject({ type: "path", shape: "circle" });
    });

    it("matches Chinese '绕圈'", () => {
      expect(detectIntent("绕圈")).toMatchObject({ type: "path", shape: "circle" });
    });

    it("matches Chinese '螺旋路径'", () => {
      expect(detectIntent("螺旋路径")).toMatchObject({ type: "path", shape: "spiral" });
    });

    it("matches Chinese '弧形路径'", () => {
      expect(detectIntent("弧形路径")).toMatchObject({ type: "path", shape: "arc" });
    });

    it("matches Chinese '之字形路径'", () => {
      expect(detectIntent("之字形路径")).toMatchObject({ type: "path", shape: "zigzag" });
    });

    it("matches Chinese '8字形'", () => {
      expect(detectIntent("8字形")).toMatchObject({ type: "path", shape: "figure-8" });
    });

    it("matches Chinese '钟摆路径'", () => {
      expect(detectIntent("钟摆路径")).toMatchObject({ type: "path", shape: "pendulum" });
    });

    it("matches Chinese '顺时针'", () => {
      expect(detectIntent("顺时针")).toMatchObject({ type: "path", shape: "circle", options: { clockwise: true } });
    });

    it("matches Chinese '逆时针'", () => {
      expect(detectIntent("逆时针")).toMatchObject({ type: "path", shape: "circle", options: { clockwise: false } });
    });

    // disambiguation: 'pendulum' alone → physics, not path
    it("'pendulum' alone maps to physics, not path", () => {
      expect(detectIntent("pendulum")).toMatchObject({ type: "physics", options: { effect: "pendulum" } });
    });

    // disambiguation: 'wave' alone → wave visual effect, not path
    it("'add wave' maps to wave effect, not path", () => {
      expect(detectIntent("add wave")).toMatchObject({ type: "wave" });
    });
  });

  describe("edge cases", () => {
    it("handles leading/trailing whitespace", () => {
      expect(detectIntent("  reverse  ")).toEqual({ type: "reverse" });
    });

    it("is case-insensitive", () => {
      expect(detectIntent("REVERSE")).toEqual({ type: "reverse" });
      expect(detectIntent("Make It Bounce")).toMatchObject({ type: "physics" });
    });

    it("does not match 'make me a bouncing ball' (creative prompt)", () => {
      expect(detectIntent("make me a bouncing ball")).toBeNull();
    });

    it("does not match 'build a loading animation'", () => {
      expect(detectIntent("build a loading animation")).toBeNull();
    });
  });
});
