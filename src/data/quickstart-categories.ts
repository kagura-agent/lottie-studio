export interface QuickStartCategory {
  emoji: string;
  label: string;
  prompts: string[];
}

export const quickStartCategories: QuickStartCategory[] = [
  {
    emoji: "⏳",
    label: "Loading & Progress",
    prompts: [
      "Create a smooth loading spinner with a gradient",
      "Pulsing dots loading indicator",
      "Circular progress bar filling up",
      "Hourglass flip animation",
    ],
  },
  {
    emoji: "💬",
    label: "Social Media",
    prompts: [
      "Animated like button with heart burst",
      "Message bubble typing indicator",
      "Instagram-style story ring animation",
      "Notification bell shake",
    ],
  },
  {
    emoji: "🎨",
    label: "Icons & UI",
    prompts: [
      "Checkmark drawing itself with a satisfying pop",
      "Hamburger menu morphing to X",
      "Toggle switch with bounce",
      "Download arrow animation",
    ],
  },
  {
    emoji: "✍️",
    label: "Text & Titles",
    prompts: [
      "Type-on effect spelling Hello World",
      "Text reveal with a sliding mask",
      "Bouncy letter-by-letter entrance",
      "Glitch text effect",
    ],
  },
  {
    emoji: "🧸",
    label: "Characters",
    prompts: [
      "Cute blob character waving hello",
      "Cat tail swish idle animation",
      "Robot eyes blinking",
      "Bird flapping wings",
    ],
  },
  {
    emoji: "✨",
    label: "Abstract & Decorative",
    prompts: [
      "Flowing gradient color waves",
      "Geometric pattern kaleidoscope",
      "Floating particles with depth",
      "Morphing abstract shapes",
    ],
  },
  {
    emoji: "🔄",
    label: "Transitions",
    prompts: [
      "Smooth page slide transition",
      "Circle wipe reveal",
      "Staggered card entrance",
      "Fade with scale transition",
    ],
  },
  {
    emoji: "🎉",
    label: "Celebrations",
    prompts: [
      "Confetti burst from center",
      "Fireworks display",
      "Trophy bounce with sparkles",
      "Balloon float animation",
    ],
  },
];
