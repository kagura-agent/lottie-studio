const LOTTIE_SPEC = `
## Lottie JSON Structure

A Lottie animation is a JSON object with these top-level properties:
- "v": version string (use "5.7.1")
- "fr": frame rate (typically 30 or 60)
- "ip": in-point (first frame, usually 0)
- "op": out-point (last frame, e.g. 60 for a 2-second animation at 30fps)
- "w": width in pixels
- "h": height in pixels
- "layers": array of layer objects

## Layer Types
- Type 4: Shape layer (most common — contains shapes, fills, strokes, transforms)
- Type 0: Precomp layer (references another composition)
- Type 1: Solid layer
- Type 2: Image layer
- Type 3: Null layer (invisible, used as parent for other layers)

## Shape Layer Structure
A shape layer (ty: 4) has:
- "nm": name
- "ty": 4
- "ind": layer index
- "ip": in-point for this layer
- "op": out-point for this layer
- "ks": transform object
- "shapes": array of shape items

## Shape Items (inside "shapes" array)
Each shape item has a "ty" field:
- "gr": Group — contains sub-items in "it" array
- "rc": Rectangle — has "s" (size) and "p" (position)
- "el": Ellipse — has "s" (size) and "p" (position)
- "sh": Path — has "ks" with vertices, in/out tangents
- "fl": Fill — has "c" (color RGBA 0-1) and "o" (opacity)
- "st": Stroke — has "c" (color), "o" (opacity), "w" (width)
- "tr": Transform — position, scale, rotation, opacity for the group

## Transform Object ("ks" on layers, "tr" in groups)
- "p": position {a: 0, k: [x, y]} or animated {a: 1, k: [keyframes]}
- "s": scale {a: 0, k: [100, 100]} (percentage)
- "r": rotation {a: 0, k: 0} (degrees)
- "o": opacity {a: 0, k: 100} (0-100)
- "a": anchor point {a: 0, k: [x, y]}

## Static vs Animated Properties
Static: {"a": 0, "k": value}
Animated: {"a": 1, "k": [array of keyframes]}

## Keyframe Format
Each keyframe in the array:
- "t": time (frame number)
- "s": start value (array)
- "e": end value (array) — omit on last keyframe
- "i": in-tangent (easing) {"x": [0.42], "y": [0]}
- "o": out-tangent (easing) {"x": [0.58], "y": [1]}

Common easing presets:
- Linear: i: {x:[1], y:[1]}, o: {x:[0], y:[0]}
- Ease in-out: i: {x:[0.42], y:[0]}, o: {x:[0.58], y:[1]}

## Color Format
Colors use RGBA with values 0-1:
- Red: [1, 0, 0, 1]
- Green: [0, 1, 0, 1]
- Blue: [0, 0, 1, 1]
- White: [1, 1, 1, 1]
- Black: [0, 0, 0, 1]
- Yellow: [1, 1, 0, 1]
- Purple: [0.5, 0, 0.5, 1]
- Orange: [1, 0.5, 0, 1]
`;

const EXAMPLE_CIRCLE = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Circle", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Circle Group",
      it: [
        { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [150, 150] } },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.6, 1, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_BOUNCING_BALL = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Bouncing Ball", ind: 0, ip: 0, op: 60,
    ks: {
      p: {
        a: 1,
        k: [
          { t: 0, s: [256, 100], e: [256, 400], i: { x: [0.42], y: [0] }, o: { x: [0.58], y: [1] } },
          { t: 30, s: [256, 400], e: [256, 100], i: { x: [0.42], y: [0] }, o: { x: [0.58], y: [1] } },
          { t: 60, s: [256, 100] }
        ]
      },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Ball Group",
      it: [
        { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [80, 80] } },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [1, 0.3, 0.3, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_SPINNING_SQUARE = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Spinning Square", ind: 0, ip: 0, op: 90,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: {
        a: 1,
        k: [
          { t: 0, s: [0], e: [360], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
          { t: 90, s: [360] }
        ]
      },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Square Group",
      it: [
        { ty: "rc", nm: "Rect", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [120, 120] }, r: { a: 0, k: 0 } },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.8, 0.4, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

export function buildSystemPrompt(currentAnimation: object | null): string {
  let prompt = `You are a Lottie animation expert. You create and modify Lottie JSON animations based on user descriptions.

${LOTTIE_SPEC}

## Example Animations

### Blue circle (static)
\`\`\`json
${EXAMPLE_CIRCLE}
\`\`\`

### Red bouncing ball (animated position)
\`\`\`json
${EXAMPLE_BOUNCING_BALL}
\`\`\`

### Green spinning square (animated rotation)
\`\`\`json
${EXAMPLE_SPINNING_SQUARE}
\`\`\`

## Your Response Format

1. Briefly describe what you created or changed (1-2 sentences).
2. Output the COMPLETE Lottie JSON inside a single \`\`\`json code block.

Rules:
- Always output valid, complete Lottie JSON — never partial or pseudo-code.
- Use canvas size 512x512 unless the user specifies otherwise.
- Use 30fps frame rate unless specified otherwise.
- For 2-second animations, use op: 60 (at 30fps).
- Make animations visually interesting — use easing, not just linear interpolation.
- When modifying an existing animation, preserve unrelated layers and properties.
- Keep shapes centered on the canvas unless positioned otherwise.`;

  if (currentAnimation) {
    prompt += `

## Current Animation (to modify)
\`\`\`json
${JSON.stringify(currentAnimation)}
\`\`\`

When the user asks to modify this animation, update the JSON above according to their request. Preserve all existing properties that aren't being changed.`;
  }

  return prompt;
}
