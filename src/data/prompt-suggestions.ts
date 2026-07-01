export interface PromptSuggestion {
  emoji: string;
  label: string;
  prompt: string;
}

export interface SuggestionCategory {
  title: string;
  suggestions: PromptSuggestion[];
}

export const promptSuggestionCategories: SuggestionCategory[] = [
  {
    title: "Getting Started",
    suggestions: [
      {
        emoji: "⚽",
        label: "Bouncing ball",
        prompt:
          "A colorful ball that bounces up and down with a squash-and-stretch effect, casting a soft shadow on the ground",
      },
      {
        emoji: "🟦",
        label: "Spinning square",
        prompt:
          "A rounded square that continuously rotates 360 degrees with a smooth ease-in-out, changing color as it spins",
      },
      {
        emoji: "❤️",
        label: "Pulsing heart",
        prompt:
          "A heart shape that gently pulses bigger and smaller in a heartbeat rhythm, with a soft glow effect",
      },
      {
        emoji: "🌊",
        label: "Color wave",
        prompt:
          "A horizontal wave of circles that ripple across the screen, each changing color in sequence like a rainbow wave",
      },
    ],
  },
  {
    title: "UI Components",
    suggestions: [
      {
        emoji: "🔄",
        label: "Loading spinner",
        prompt:
          "A sleek circular loading spinner with a gradient trail that rotates smoothly, suitable for a modern app",
      },
      {
        emoji: "▓",
        label: "Progress bar",
        prompt:
          "An animated progress bar that fills from left to right with a subtle shimmer effect, going from 0% to 100%",
      },
      {
        emoji: "🔘",
        label: "Toggle switch",
        prompt:
          "A toggle switch that animates between on and off states with a sliding circle and background color change",
      },
      {
        emoji: "🔔",
        label: "Notification bell",
        prompt:
          "A notification bell icon that swings side to side with a small badge that pops in with a bounce effect",
      },
    ],
  },
  {
    title: "Social Media",
    suggestions: [
      {
        emoji: "👍",
        label: "Thumbs up reaction",
        prompt:
          "A thumbs-up icon that pops up with a bouncy scale animation and sparkle particles around it",
      },
      {
        emoji: "🎉",
        label: "Confetti burst",
        prompt:
          "A burst of colorful confetti pieces that explode outward from the center and float down with gentle rotation",
      },
      {
        emoji: "💕",
        label: "Floating hearts",
        prompt:
          "Multiple small hearts in different colors that float upward gently, fading out as they rise, like a social media reaction",
      },
      {
        emoji: "🔥",
        label: "Fire emoji",
        prompt:
          "An animated fire emoji with flickering flames that dance and shift colors from orange to yellow",
      },
    ],
  },
  {
    title: "Branding",
    suggestions: [
      {
        emoji: "✨",
        label: "Logo reveal",
        prompt:
          "A circular logo placeholder that reveals with a starburst wipe effect and a subtle shine sweeping across it",
      },
      {
        emoji: "⌨️",
        label: "Text typewriter",
        prompt:
          'Text that types out letter by letter with a blinking cursor, spelling "Hello World" in a clean font',
      },
      {
        emoji: "📥",
        label: "Slide-in banner",
        prompt:
          "A rectangular banner that slides in from the right with a bounce at the end, containing a simple message",
      },
      {
        emoji: "🌟",
        label: "Particle intro",
        prompt:
          "Scattered particles that converge from all directions to form a circular shape in the center, then pulse once",
      },
    ],
  },
];
