export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  filename: string;
}

export const templates: TemplateMetadata[] = [
  {
    id: "bouncing-ball",
    name: "Bouncing Ball",
    description: "Classic bounce with squash & stretch",
    category: "Motion",
    filename: "bouncing-ball.json",
  },
  {
    id: "loading-spinner",
    name: "Loading Spinner",
    description: "8-dot circular spinner with opacity trail",
    category: "Looping",
    filename: "loading-spinner.json",
  },
  {
    id: "pulse-heartbeat",
    name: "Pulse Heartbeat",
    description: "Rhythmic scale pulse with glow ring",
    category: "Scale",
    filename: "pulse-heartbeat.json",
  },
  {
    id: "floating-particles",
    name: "Floating Particles",
    description: "Colorful particles drifting upward",
    category: "Multi-layer",
    filename: "floating-particles.json",
  },
  {
    id: "wave-background",
    name: "Wave Background",
    description: "Gentle animated wave shapes for backgrounds",
    category: "Decorative",
    filename: "wave-background.json",
  },
];
