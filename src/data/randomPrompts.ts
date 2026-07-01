export interface RandomPromptCategory {
  name: string;
  prompts: string[];
}

export const randomPromptCategories: RandomPromptCategory[] = [
  {
    name: "Nature",
    prompts: [
      "A butterfly emerging from a cocoon, wings slowly unfolding with iridescent colors",
      "Rain falling on a window pane with droplets sliding down and merging",
      "A flower blooming in fast-forward, petals unfurling one by one",
      "A tree swaying gently in the breeze with leaves rustling",
      "Ocean waves rolling onto a beach and receding in a loop",
      "Snowflakes drifting down, each with a unique crystalline pattern",
      "A sunrise over mountains with rays of light spreading across the sky",
      "A campfire flickering with sparks floating upward into the night",
      "A crescent moon with twinkling stars appearing one by one",
    ],
  },
  {
    name: "Abstract",
    prompts: [
      "Geometric shapes morphing into each other in a seamless loop",
      "A kaleidoscope pattern rotating with shifting colors",
      "Concentric circles expanding outward like ripples in water",
      "A Möbius strip rotating in 3D space with a gradient surface",
      "Particles swirling into a vortex and dispersing outward",
      "A grid of dots creating a wave pattern across the screen",
      "Liquid blobs merging and splitting with smooth surface tension",
      "Fractal patterns zooming infinitely inward",
      "Color gradients flowing and shifting like aurora borealis",
    ],
  },
  {
    name: "UI/UX",
    prompts: [
      "A smooth toggle switch sliding between on and off states",
      "A loading skeleton screen with shimmering placeholder blocks",
      "A hamburger menu icon morphing into an X close button",
      "A pull-to-refresh spinner with a fluid water-drop effect",
      "A success checkmark drawing itself with a green circle pop",
      "A floating action button expanding into a menu of options",
      "A card flipping over to reveal content on the back",
      "A tab bar with the active indicator sliding between items",
      "A search bar expanding from an icon to a full input field",
    ],
  },
  {
    name: "Characters",
    prompts: [
      "A cat stretching and yawning lazily",
      "A robot waving hello with a blinking LED face",
      "A bird flapping its wings and taking flight",
      "A happy ghost floating and fading in and out",
      "An astronaut floating in zero gravity with a tethered cord",
      "A fox curling up and falling asleep with a breathing motion",
      "A penguin sliding on its belly across ice",
      "An owl blinking its big eyes slowly",
    ],
  },
  {
    name: "Effects",
    prompts: [
      "A confetti explosion bursting outward with colorful pieces floating down",
      "A neon sign flickering on letter by letter, buzzing with glow",
      "Lightning bolts striking with a bright flash and fadeout",
      "Fireworks launching up and bursting into colorful starbursts",
      "A glitch effect with RGB channels splitting and reconnecting",
      "Sparkles twinkling around a central point like magic dust",
      "A smoke trail curling upward and dissipating",
      "A shockwave ring expanding outward from a central impact",
    ],
  },
  {
    name: "Scenes",
    prompts: [
      "A city skyline at night with windows lighting up randomly",
      "A hot air balloon rising gently into a cloudy sky",
      "A paper airplane folding itself and flying off screen",
      "A vinyl record spinning on a turntable with the needle bobbing",
      "A clock with hands spinning through a full day cycle",
      "A rocket ship launching with exhaust flames and rising upward",
      "A bicycle wheel spinning with spokes blurring at speed",
      "A lantern floating up into a dark sky among many others",
    ],
  },
  {
    name: "Food & Objects",
    prompts: [
      "A coffee cup with steam rising in curling wisps",
      "A pizza being sliced with cheese stretching between pieces",
      "A lightbulb flickering on with a warm glow radiating outward",
      "An hourglass with sand flowing from top to bottom then flipping",
      "A gift box lid popping open with a spring-loaded surprise inside",
    ],
  },
];

export function getRandomPrompt(): string {
  const allPrompts = randomPromptCategories.flatMap((cat) => cat.prompts);
  return allPrompts[Math.floor(Math.random() * allPrompts.length)];
}

export function getRandomPromptCount(): number {
  return randomPromptCategories.reduce((sum, cat) => sum + cat.prompts.length, 0);
}
