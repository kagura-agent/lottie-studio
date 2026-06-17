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
- Type 5: Text layer (contains text document data and optional text animators)
- Type 0: Precomp layer (references another composition)
- Type 1: Solid layer
- Type 2: Image layer
- Type 3: Null layer (invisible, used as parent for other layers)
- Type 5: Text layer (displays text content, requires font registration)

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
- "sh": Path — has "ks" with vertices, in/out tangents (see Path Shapes section)
- "sr": Polystar — parametric stars/polygons (prefer over manual paths for these)
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

## Trim Paths (ty: "tm")
Animates stroke drawing by controlling which portion of a path is visible.
- "s": start — animated property, 0-100 (percentage along the path)
- "e": end — animated property, 0-100
- "o": offset — animated property, 0-360 (degrees, shifts the visible segment)
Place after stroke ("st") in a group's "it" array. Animate "e" from 0→100 to draw a stroke on, or animate "s" from 0→100 to erase it.

## Repeater (ty: "rp")
Creates copies of shapes in a group with cumulative transforms.
- "c": copies — animated property (number of copies including original)
- "o": offset — animated property (shifts the starting index)
- "tr": transform per copy — contains "p" (position offset), "r" (rotation), "s" (scale), "o" (opacity) applied cumulatively to each copy
Place at the end of a group's "it" array (before the group transform "tr"). Example: 8 copies with 45° rotation each = a radial pattern.

## Gradient Fills (ty: "gf")
Fills shapes with a linear or radial gradient.
- "t": gradient type — 1 = linear, 2 = radial
- "s": start point — animated [x, y]
- "e": end point — animated [x, y]
- "g": gradient colors — {"p": numColorStops, "k": {"a": 0, "k": [stop1pos, r, g, b, stop2pos, r, g, b, ...]}}
  Color stop values: position (0-1), then r, g, b (0-1). For 2 stops: [0, r1, g1, b1, 1, r2, g2, b2].
- "o": opacity — animated, 0-100

## Gradient Strokes (ty: "gs")
Strokes shapes with a linear or radial gradient. Combines gradient properties with stroke properties.
- "t": gradient type — 1 = linear, 2 = radial
- "s": start point — animated [x, y] (relative to layer, same as gf)
- "e": end point — animated [x, y]
- "g": gradient colors — {"p": numColorStops, "k": {"a": 0, "k": [stop1pos, r, g, b, stop2pos, r, g, b, ...]}}
  Same format as gradient fill. For a rainbow: 6+ stops evenly spaced across hue wheel.
- "o": opacity — animated, 0-100
- "w": stroke width — animated property
- "lc": line cap — 1 = butt, 2 = round, 3 = square
- "lj": line join — 1 = miter, 2 = round, 3 = bevel
- "d": dash array — same format as regular strokes [{"n": "d", "v": {"a":0,"k":10}}, {"n": "g", "v": {"a":0,"k":5}}]
Use gradient stroke when the outline itself should show a gradient. For a gradient-filled shape with a solid border, use gradient fill (gf) + regular stroke (st) instead.

## Path Shapes (ty: "sh")
Custom shapes using bezier paths. The "ks" property contains path data:
{"a": 0, "k": {"v": [[x,y],...], "i": [[dx,dy],...], "o": [[dx,dy],...], "c": true}}
- "v": vertices (anchor points)
- "i": in-tangents (relative to each vertex, for curve arriving at vertex)
- "o": out-tangents (relative to each vertex, for curve leaving vertex)
- "c": true = closed path, false = open path
- Straight segments: tangents are [0,0]
- Circular arcs: tangent length ≈ 0.5523 × radius (kappa constant)

## Polystar Shape (ty: "sr")
Parametric stars and regular polygons. Simpler than manual path vertices.
- "sy": 1 = star, 2 = polygon
- "pt": number of points (animated property)
- "or": outer radius (animated property)
- "os": outer roundness 0-100 (animated property)
- "ir": inner radius — star only (animated property)
- "is": inner roundness 0-100 — star only (animated property)
- "r": rotation in degrees (animated property)
- "p": position [x,y] (animated property)
Polystar must be inside a group ("gr") with fill/stroke.
Prefer polystar ("sr") over manual path vertices for stars and regular polygons.

### Ready-made Path Data
Heart (512×512 canvas, centered at 256,256):
{"v":[[256,450],[256,180],[80,218],[80,370]],"i":[[97,0],[0,0],[0,90],[0,0]],"o":[[−97,0],[−120,0],[0,0],[0,0]],"c":true}
Note: a heart needs two mirrored cubic arcs — use two path groups or a single path with ~8 vertices:
{"v":[[256,416],[140,225],[186,144],[256,210],[326,144],[372,225],[256,416]],"i":[[40,30],[0,50],[-30,0],[0,-30],[30,0],[0,0],[-40,30]],"o":[[-40,30],[0,0],[30,0],[0,-30],[-30,0],[0,50],[40,30]],"c":true}

Arrow/chevron pointing right (centered, 200×200):
{"v":[[186,156],[306,256],[186,356]],"i":[[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0]],"c":false}

Crescent moon (two circular arcs, 512×512):
{"v":[[300,96],[300,416],[220,416],[220,96]],"i":[[−113,0],[0,113],[−75,0],[0,−75]],"o":[[0,−113],[113,0],[0,75],[75,0]],"c":true}

## Text Layer (ty: 5)
Displays and animates text.
- "ty": 5
- "nm": layer name
- "ind": layer index
- "ip"/"op": in/out points
- "ks": transform (same as other layers)
- "t": text data object containing "d" (document) and optional "a" (animators)

### Text Document ("t.d")
The "d" property holds keyframed text documents:
- "k": array of keyframes, each with "s" (document state) and "t" (time)

Document state ("s") properties:
- "s": font size (number, e.g. 48)
- "f": font family (string, e.g. "Arial")
- "t": text content (string, supports \\r for line breaks)
- "fc": fill color [r, g, b] (0-1 range, no alpha)
- "sc": stroke color [r, g, b] (0-1 range)
- "sw": stroke width (number)
- "lh": line height (number, in pixels)
- "j": justification (0 = left, 1 = right, 2 = center)
- "sz": text box size [width, height] — constrains text area
- "ps": text box position [x, y] — offset within layer
- "ls": line shift / tracking (number)

### Text Animators ("t.a")
Array of animator objects that apply transform-based animation to text characters.
Each animator has:
- "a": animated properties object — can include:
  - "o": opacity {a: 0/1, k: value}
  - "p": position {a: 0/1, k: [x, y]}
  - "s": scale {a: 0/1, k: [sx, sy]}
  - "r": rotation {a: 0/1, k: degrees}
  - "t": tracking (letter spacing) {a: 0/1, k: value}
- "s": range selector object:
  - "t": type (0 = expressible, 1 = per character)
  - "b": based on (1 = characters, 2 = characters excl. spaces, 3 = words, 4 = lines)
  - "s": start {a: 0/1, k: value} (0-100)
  - "e": end {a: 0/1, k: value} (0-100)
  - "sh": shape (1 = square, 2 = ramp up, 3 = ramp down, 5 = round, 6 = smooth)
  - "o": offset {a: 0/1, k: value}
  - "r": randomize (0 or 1)
  - "ne": ease high {a: 0, k: value}
  - "xe": ease low {a: 0, k: value}

To animate text character-by-character, animate the range selector's "s" (start) or "e" (end) from 0→100 over time, combined with a property offset (e.g. opacity 0 = characters start invisible, revealed as range sweeps).

### Font Limitations
- Use web-safe fonts: "Arial", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana"
- Default to "Arial" if no font specified
- Lottie players must have the font available; web-safe fonts ensure broadest compatibility
- For the "fonts" top-level property, list fonts used: {"list": [{"fName": "Arial", "fFamily": "Arial", "fStyle": "Regular"}]}

## Layer Parenting (parent / ind)
Layers can be parented to other layers, inheriting the parent's transform (position, rotation, scale).
- "ind": unique layer index (integer) — every layer must have one
- "parent": the "ind" value of the parent layer — the child inherits the parent's transform
Child layers' transforms become relative to the parent. If a parent moves, rotates, or scales, all children follow.

## Null Layer (ty: 3)
An invisible layer used purely as a parent/controller. It has no visual output but carries a full transform.
- "ty": 3
- "nm": name
- "ind": layer index (used as the "parent" value for child layers)
- "ip"/"op": in/out points
- "ks": transform (position, rotation, scale, opacity, anchor point)
- No "shapes" or visual content

Common patterns:
- **Orbiting**: Null at center with animated rotation; child shape layers offset from center orbit around it.
- **Group movement**: Null with animated position; multiple child layers move together as a unit.
- **Hierarchical chains**: Layer A parents to Null B, which parents to Null C — transforms cascade (e.g., pendulum arm + bob).

Tips:
- Set the null's anchor point to [0,0] and position to the desired pivot (e.g., [256,256] for canvas center).
- Child layers' position is relative to the parent's anchor, so offset the child to control orbit radius.
- Multiple layers can share the same parent for synchronized group behavior.

## Mask Shapes (masksProperties)
Masks clip or reveal portions of a layer using animated paths. Any layer can have a "masksProperties" array.
Each mask object:
- "inv": boolean — invert the mask (default false)
- "mode": mask mode string:
  - "a" = Add (union — default, most common)
  - "s" = Subtract (cut away)
  - "i" = Intersect (keep overlap)
  - "l" = Lighten
  - "d" = Darken
  - "f" = Difference
- "pt": path data — same format as shape paths ("sh" type): {"a": 0/1, "k": {"v": [...], "i": [...], "o": [...], "c": true}}
- "o": opacity — animated property, 0-100 (controls mask strength)
- "x": expansion — animated property (expands/contracts the mask edge in pixels)

Common pattern: Animate the mask path vertices ("pt" with a:1) over time for wipe/reveal effects.
Example mask (rectangle covering left half of 512×512 canvas):
{"inv": false, "mode": "a", "pt": {"a": 0, "k": {"v": [[0,0],[256,0],[256,512],[0,512]], "i": [[0,0],[0,0],[0,0],[0,0]], "o": [[0,0],[0,0],[0,0],[0,0]], "c": true}}, "o": {"a": 0, "k": 100}, "x": {"a": 0, "k": 0}}

## Track Mattes (tt / td)
Track mattes use one layer to define the visibility of another layer.
The matte layer (the "stencil") sits directly ABOVE the content layer in the layers array.
- Matte layer: has "td": 1 — marks it as a track matte source. This layer is invisible in the final render.
- Content layer: has "tt" property defining the matte type:
  - tt: 1 = Alpha Matte — content is visible where the matte layer has opacity
  - tt: 2 = Alpha Inverted Matte — content is visible where the matte layer is transparent
  - tt: 3 = Luma Matte — content is visible where the matte layer is bright
  - tt: 4 = Luma Inverted Matte — content is visible where the matte layer is dark

Layer order matters: in the "layers" array, the matte layer (td: 1) must come BEFORE the content layer (tt: N) since layers are rendered top-to-bottom (lower index = on top).
The matte layer's shapes/content define the clipping region — animate its shapes or transform to create dynamic clipping effects.

## Stroke Dashes ("d" property on "st" items)
Add a "d" array to any stroke ("st") to create dashed lines:
- Each entry: {"n": "d"|"g"|"o", "nm": "dash"|"gap"|"offset", "v": {"a": 0, "k": value}}
  - "d" = dash length, "g" = gap length, "o" = offset
- The offset ("o") is animatable — animate it for a marching ants effect.
- Example: [{"n":"d","nm":"dash","v":{"a":0,"k":10}}, {"n":"g","nm":"gap","v":{"a":0,"k":5}}]

## Line Caps ("lc") and Line Joins ("lj") on Strokes
Control how stroke endpoints and corners render:
- "lc" (line cap): 1 = butt (flat end), 2 = round, 3 = square (extends past endpoint)
- "lj" (line join): 1 = miter (sharp corner), 2 = round, 3 = bevel
- "ml" (miter limit): number, applies when lj: 1 — prevents overly long miter points
These are static number properties on the "st" object (not animated).

## Round Corners Modifier (ty: "rd")
Rounds the corners of rectangles and polygons.
- {"ty": "rd", "nm": "Round Corners", "r": {"a": 0, "k": radius}}
- Place after rectangle/polystar shapes in a group's "it" array (before fill/stroke or after shapes, before "tr")
- The "r" (radius) property is animatable — animate it to morph between sharp and rounded corners.

## Merge Paths Modifier (ty: "mm")
Combines multiple shapes in a group using boolean operations (union, subtract, intersect, etc.).
- {"ty": "mm", "nm": "Merge Paths", "mm": mode}
- "mm" (mode): integer selecting the boolean operation:
  - 1 = Merge (union/add — combine all shapes into one outline)
  - 2 = Add (same visual as merge in most renderers)
  - 3 = Subtract (cut subsequent shapes from the first shape)
  - 4 = Intersect (keep only overlapping areas)
  - 5 = Exclude Intersection (XOR — keep only non-overlapping areas)
- The modifier affects all shape items in the same group's "it" array.
- Place the merge paths modifier AFTER the shapes it should operate on (at the end of the "it" array, before fill/stroke and "tr").
- Common patterns:
  - Donut/ring: outer ellipse + smaller inner ellipse + merge paths mode 3 (subtract)
  - Crescent moon: two overlapping ellipses + merge paths mode 3 (subtract)
  - Venn overlap: two ellipses + merge paths mode 4 (intersect)

## Precomp Layers (ty: 0) and Assets

Precomps let you define a reusable composition in the top-level "assets" array and reference it from layers.

### Top-level "assets" array
Add an "assets" array at the root of the Lottie JSON (same level as "layers"):
- Each precomp asset: {"id": "unique_id", "layers": [...], "fr": 30, "w": 512, "h": 512}
- "id": unique string identifier referenced by precomp layers
- "layers": array of layer objects (same format as top-level layers)
- "fr"/"w"/"h": frame rate and dimensions (usually match the root)

### Precomp Layer (ty: 0)
A layer that renders an asset composition:
- "ty": 0
- "refId": string matching an asset's "id"
- "w": width of the precomp
- "h": height of the precomp
- "ks": transform (position, scale, rotation, opacity, anchor point — same as other layers)
- "ip"/"op": in/out points
- "ind": layer index
- "tm": time remapping — animated property that controls playback speed/direction of the precomp

### When to use precomps
- **Reusable elements**: Same shape group needed multiple times (e.g., multiple butterflies, repeated icons) — define once in assets, instantiate with different transforms
- **Nested compositions**: A sub-scene contained within a larger scene (e.g., a clock face inside a room)
- **Organization**: Break complex animations into logical groups

### When NOT to use precomps
- Simple animations with few layers — precomps add complexity for no benefit
- Single-use compositions — just use regular layers

## Easing Presets

Named easing curves for keyframe i (in-tangent) and o (out-tangent) values:

| Preset | i (in-tangent) | o (out-tangent) | Feel |
|---|---|---|---|
| linear | {x:[1],y:[1]} | {x:[0],y:[0]} | Constant speed, mechanical |
| ease-in-out | {x:[0.42],y:[1]} | {x:[0.58],y:[0]} | Smooth start and stop |
| ease-in | {x:[0.42],y:[0]} | {x:[1],y:[1]} | Slow start, fast end |
| ease-out | {x:[0],y:[0]} | {x:[0.58],y:[1]} | Fast start, slow stop |
| bounce | {x:[0.34],y:[1.56]} | {x:[0.64],y:[1]} | Overshoots target then settles |
| snappy | {x:[0.1],y:[1]} | {x:[0.9],y:[0]} | Fast start, sharp stop |
| gentle | {x:[0.25],y:[1]} | {x:[0.75],y:[0]} | Very slow, soft curve |

**Elastic** (multiple overshoots): Cannot be done with a single keyframe pair. Simulate with 3-4 keyframes that oscillate past the target with decreasing amplitude (e.g., target 100: 100→120→95→102→100).

### Keyword Mapping
When users describe timing with natural language, map to these presets:
- "bouncy", "springy" → bounce
- "smooth", "flowing" → ease-in-out
- "sharp", "crisp", "snappy" → snappy
- "soft", "gentle", "slow" → gentle
- "linear", "constant", "even" → linear
- "accelerate", "speed up" → ease-in
- "decelerate", "slow down" → ease-out
- "elastic", "rubbery", "jelly" → elastic (multi-keyframe)

## Layer Effects

Effects are applied at the layer level using the "ef" array (same level as "ks", "shapes", etc.).
Each effect object has:
- "ty": effect type number
- "nm": effect name
- "np": number of parameters (including the effect itself)
- "ix": effect index
- "en": enabled (1 = on, 0 = off)
- "ef": array of effect parameters

Each effect parameter:
- {"ty": 2, "nm": "name", "ix": index, "v": {"a": 0, "k": value}} — for color params (ty: 2, value is [r,g,b,a] 0-1)
- {"ty": 0, "nm": "name", "ix": index, "v": {"a": 0, "k": value}} — for scalar params (ty: 0)

Parameters can be animated (a: 1 with keyframes) just like other Lottie properties.

### Drop Shadow (ty: 25)
Parameters (in order):
0. Shadow Color — ty: 2, color [r, g, b, a] (0-1)
1. Opacity — ty: 0, range 0-255
2. Direction — ty: 0, angle in degrees (0-360)
3. Distance — ty: 0, pixels
4. Softness — ty: 0, blur size in pixels

### Gaussian Blur (ty: 29)
Parameters (in order):
0. Blurriness — ty: 0, blur amount in pixels
1. Dimensions — ty: 0, direction (1 = horizontal+vertical, 2 = horizontal only, 3 = vertical only)
2. Repeat Edge Pixels — ty: 0, (0 = off, 1 = on)

Effects go on the LAYER object, not inside shape groups. Example:
{"ty": 4, "nm": "Shape", "ks": {...}, "shapes": [...], "ef": [{...effect...}]}
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

const EXAMPLE_FADE_IN_OUT = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Fade Circle", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: {
        a: 1,
        k: [
          { t: 0, s: [0], e: [100], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
          { t: 20, s: [100], e: [100], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
          { t: 40, s: [100], e: [0], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
          { t: 60, s: [0] }
        ]
      },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Circle Group",
      it: [
        { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [200, 200] } },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.6, 1, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_SCALE_PULSE = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 30, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Pulse Heart", ind: 0, ip: 0, op: 30,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: {
        a: 1,
        k: [
          { t: 0, s: [100, 100], e: [130, 130], i: { x: [0.4], y: [1.6] }, o: { x: [0.3], y: [0] } },
          { t: 10, s: [130, 130], e: [90, 90], i: { x: [0.4], y: [1.4] }, o: { x: [0.3], y: [0] } },
          { t: 20, s: [90, 90], e: [100, 100], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
          { t: 30, s: [100, 100] }
        ]
      },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Heart Group",
      it: [
        { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [120, 120] } },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [0.9, 0.2, 0.3, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_LOADING_SPINNER = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Spinner", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: {
        a: 1,
        k: [
          { t: 0, s: [0], e: [360], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
          { t: 60, s: [360] }
        ]
      },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Arc Group",
      it: [
        { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [200, 200] } },
        { ty: "st", nm: "Stroke", c: { a: 0, k: [0.3, 0.5, 1, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 12 }, lc: 2, lj: 2 },
        { ty: "tm", nm: "Trim", s: { a: 0, k: 0 }, e: { a: 0, k: 75 }, o: {
          a: 1,
          k: [
            { t: 0, s: [0], e: [360], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
            { t: 60, s: [360] }
          ]
        } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_MULTI_LAYER = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  layers: [
    {
      ty: 4, nm: "Circle 1", ind: 0, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [256, 256] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [0, 0], e: [100, 100], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
            { t: 20, s: [100, 100] }
          ]
        },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "C1",
        it: [
          { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [180, 180] } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.6, 1, 1] }, o: { a: 0, k: 60 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    },
    {
      ty: 4, nm: "Circle 2", ind: 1, ip: 10, op: 90,
      ks: {
        p: { a: 0, k: [256, 256] },
        s: {
          a: 1,
          k: [
            { t: 10, s: [0, 0], e: [100, 100], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
            { t: 30, s: [100, 100] }
          ]
        },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "C2",
        it: [
          { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [120, 120] } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [1, 0.4, 0.2, 1] }, o: { a: 0, k: 70 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    },
    {
      ty: 4, nm: "Circle 3", ind: 2, ip: 20, op: 90,
      ks: {
        p: { a: 0, k: [256, 256] },
        s: {
          a: 1,
          k: [
            { t: 20, s: [0, 0], e: [100, 100], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
            { t: 40, s: [100, 100] }
          ]
        },
        r: {
          a: 1,
          k: [
            { t: 20, s: [0], e: [360], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
            { t: 90, s: [360] }
          ]
        },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "C3",
        it: [
          { ty: "rc", nm: "Rect", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [60, 60] }, r: { a: 0, k: 8 } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.8, 0.4, 1] }, o: { a: 0, k: 80 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    }
  ]
});

const EXAMPLE_COLOR_TRANSITION = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Color Shift", ind: 0, ip: 0, op: 90,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Shape Group",
      it: [
        { ty: "rc", nm: "Rect", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [200, 200] }, r: { a: 0, k: 20 } },
        { ty: "fl", nm: "Fill", c: {
          a: 1,
          k: [
            { t: 0, s: [0.2, 0.6, 1, 1], e: [0.9, 0.2, 0.5, 1], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
            { t: 30, s: [0.9, 0.2, 0.5, 1], e: [0.2, 0.8, 0.4, 1], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
            { t: 60, s: [0.2, 0.8, 0.4, 1], e: [0.2, 0.6, 1, 1], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
            { t: 90, s: [0.2, 0.6, 1, 1] }
          ]
        }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_TEXT_STATIC = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  fonts: { list: [{ fName: "Arial", fFamily: "Arial", fStyle: "Regular" }] },
  layers: [{
    ty: 5, nm: "Hello World", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    t: {
      d: { k: [{ s: { s: 48, f: "Arial", t: "Hello World", fc: [1, 1, 1], j: 2, lh: 57.6, sz: [400, 100], ps: [-200, -50] }, t: 0 }] },
      a: [],
      m: { g: 1, a: { a: 0, k: [0, 0] } }
    }
  }]
});

const EXAMPLE_TEXT_TYPEWRITER = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  fonts: { list: [{ fName: "Arial", fFamily: "Arial", fStyle: "Regular" }] },
  layers: [{
    ty: 5, nm: "Typewriter Text", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    t: {
      d: { k: [{ s: { s: 48, f: "Arial", t: "Typewriter Effect", fc: [1, 1, 1], j: 2, lh: 57.6, sz: [450, 100], ps: [-225, -50] }, t: 0 }] },
      a: [{
        a: { o: { a: 0, k: 0 } },
        s: {
          r: 1,
          b: 1,
          ne: { a: 0, k: 0 },
          xe: { a: 0, k: 0 },
          o: {
            a: 1,
            k: [
              { t: 0, s: [0], e: [100], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
              { t: 50, s: [100] }
            ]
          },
          a: { a: 0, k: 100 }
        }
      }],
      m: { g: 1, a: { a: 0, k: [0, 0] } }
    }
  }]
});

const EXAMPLE_TEXT_BOUNCE_IN = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  fonts: { list: [{ fName: "Arial", fFamily: "Arial", fStyle: "Regular" }] },
  layers: [{
    ty: 5, nm: "Bounce In Text", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    t: {
      d: { k: [{ s: { s: 48, f: "Arial", t: "Bounce In!", fc: [1, 1, 1], j: 2, lh: 57.6, sz: [400, 100], ps: [-200, -50] }, t: 0 }] },
      a: [{
        a: { s: { a: 0, k: [0, 0] } },
        s: {
          r: 1,
          b: 1,
          ne: { a: 0, k: 0 },
          xe: { a: 0, k: 6 },
          o: {
            a: 1,
            k: [
              { t: 0, s: [0], e: [100], i: { x: [0.2], y: [1.5] }, o: { x: [0.8], y: [0] } },
              { t: 45, s: [100] }
            ]
          },
          a: { a: 0, k: 100 }
        }
      }],
      m: { g: 1, a: { a: 0, k: [0, 0] } }
    }
  }]
});

const EXAMPLE_PATH_ANIMATION = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Path Mover", ind: 0, ip: 0, op: 90,
    ks: {
      p: {
        a: 1,
        k: [
          { t: 0, s: [100, 400], e: [256, 100], i: { x: 0.33, y: 1 }, o: { x: 0.67, y: 0 }, to: [0, -80], ti: [0, 0] },
          { t: 30, s: [256, 100], e: [412, 400], i: { x: 0.33, y: 1 }, o: { x: 0.67, y: 0 }, to: [0, 0], ti: [0, -80] },
          { t: 60, s: [412, 400], e: [100, 400], i: { x: 0.33, y: 1 }, o: { x: 0.67, y: 0 }, to: [80, 0], ti: [-80, 0] },
          { t: 90, s: [100, 400] }
        ]
      },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Dot Group",
      it: [
        { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [40, 40] } },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [1, 0.6, 0, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_MASK_TEXT_REVEAL = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  fonts: { list: [{ fName: "Arial", fFamily: "Arial", fStyle: "Regular" }] },
  layers: [{
    ty: 5, nm: "Revealed Text", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    masksProperties: [{
      inv: false,
      mode: "a",
      pt: {
        a: 1,
        k: [
          { t: 0, s: [{ v: [[0, 150], [0, 150], [0, 362], [0, 362]], i: [[0,0],[0,0],[0,0],[0,0]], o: [[0,0],[0,0],[0,0],[0,0]], c: true }], e: [{ v: [[0, 150], [512, 150], [512, 362], [0, 362]], i: [[0,0],[0,0],[0,0],[0,0]], o: [[0,0],[0,0],[0,0],[0,0]], c: true }], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
          { t: 45, s: [{ v: [[0, 150], [512, 150], [512, 362], [0, 362]], i: [[0,0],[0,0],[0,0],[0,0]], o: [[0,0],[0,0],[0,0],[0,0]], c: true }] }
        ]
      },
      o: { a: 0, k: 100 },
      x: { a: 0, k: 0 }
    }],
    t: {
      d: { k: [{ s: { s: 52, f: "Arial", t: "REVEAL", fc: [1, 1, 1], j: 2, lh: 62, sz: [400, 80], ps: [-200, -40] }, t: 0 }] },
      a: [],
      m: { g: 1, a: { a: 0, k: [0, 0] } }
    }
  }]
});

const EXAMPLE_MASK_CIRCLE_REVEAL = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Circle Reveal Shape", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    masksProperties: [{
      inv: false,
      mode: "a",
      pt: {
        a: 1,
        k: [
          { t: 0, s: [{ v: [[256,251],[251,256],[256,261],[261,256]], i: [[0,-2.76],[2.76,0],[0,2.76],[-2.76,0]], o: [[0,2.76],[-2.76,0],[0,-2.76],[2.76,0]], c: true }], e: [{ v: [[256,6],[6,256],[256,506],[506,256]], i: [[0,-138],[138,0],[0,138],[-138,0]], o: [[0,138],[-138,0],[0,-138],[138,0]], c: true }], i: { x: [0.25], y: [1] }, o: { x: [0.75], y: [0] } },
          { t: 50, s: [{ v: [[256,6],[6,256],[256,506],[506,256]], i: [[0,-138],[138,0],[0,138],[-138,0]], o: [[0,138],[-138,0],[0,-138],[138,0]], c: true }] }
        ]
      },
      o: { a: 0, k: 100 },
      x: { a: 0, k: 0 }
    }],
    shapes: [{
      ty: "gr", nm: "Colorful Square",
      it: [
        { ty: "rc", nm: "Rect", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [400, 400] }, r: { a: 0, k: 0 } },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.6, 1, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_TRACK_MATTE_CLIP = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  layers: [
    {
      ty: 4, nm: "Matte Shape", ind: 0, ip: 0, op: 90, td: 1,
      ks: {
        p: { a: 0, k: [256, 256] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [60, 60], e: [100, 100], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
            { t: 45, s: [100, 100] }
          ]
        },
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
        ty: "gr", nm: "Star Matte",
        it: [
          { ty: "sr", nm: "Star", sy: 1, p: { a: 0, k: [0, 0] }, or: { a: 0, k: 180 }, os: { a: 0, k: 0 }, ir: { a: 0, k: 90 }, is: { a: 0, k: 0 }, r: { a: 0, k: 0 }, pt: { a: 0, k: 5 } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    },
    {
      ty: 4, nm: "Clipped Content", ind: 1, ip: 0, op: 90, tt: 1,
      ks: {
        p: { a: 0, k: [256, 256] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "Gradient Rect",
        it: [
          { ty: "rc", nm: "Rect", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [400, 400] }, r: { a: 0, k: 0 } },
          { ty: "gf", nm: "Gradient", t: 1, s: { a: 0, k: [-200, -200] }, e: { a: 0, k: [200, 200] }, g: { p: 3, k: { a: 0, k: [0, 1, 0.2, 0.3, 0.5, 0.2, 0.6, 1, 1, 0.8, 0.2, 0.9] } }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    }
  ]
});

const EXAMPLE_ORBITING_DOTS = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  layers: [
    {
      ty: 3, nm: "Orbit Null", ind: 0, ip: 0, op: 90,
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
        o: { a: 0, k: 0 },
        a: { a: 0, k: [0, 0] }
      }
    },
    {
      ty: 4, nm: "Red Dot", ind: 1, parent: 0, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [120, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "Dot",
        it: [
          { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [40, 40] } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [1, 0.3, 0.3, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    },
    {
      ty: 4, nm: "Green Dot", ind: 2, parent: 0, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [-60, 104] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "Dot",
        it: [
          { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [40, 40] } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.8, 0.4, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    },
    {
      ty: 4, nm: "Blue Dot", ind: 3, parent: 0, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [-60, -104] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "Dot",
        it: [
          { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [40, 40] } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.6, 1, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    }
  ]
});

const EXAMPLE_GROUP_MOVEMENT = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  layers: [
    {
      ty: 3, nm: "Group Null", ind: 0, ip: 0, op: 90,
      ks: {
        p: {
          a: 1,
          k: [
            { t: 0, s: [100, 256], e: [412, 256], i: { x: [0.42], y: [0] }, o: { x: [0.58], y: [1] } },
            { t: 45, s: [412, 256], e: [100, 256], i: { x: [0.42], y: [0] }, o: { x: [0.58], y: [1] } },
            { t: 90, s: [100, 256] }
          ]
        },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 0 },
        a: { a: 0, k: [0, 0] }
      }
    },
    {
      ty: 4, nm: "Square", ind: 1, parent: 0, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [0, -60] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "Shape",
        it: [
          { ty: "rc", nm: "Rect", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [50, 50] }, r: { a: 0, k: 6 } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [1, 0.4, 0.2, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    },
    {
      ty: 4, nm: "Circle", ind: 2, parent: 0, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "Shape",
        it: [
          { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [55, 55] } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.6, 1, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    },
    {
      ty: 4, nm: "Triangle", ind: 3, parent: 0, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [0, 60] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "Shape",
        it: [
          { ty: "sr", nm: "Triangle", sy: 2, p: { a: 0, k: [0, 0] }, or: { a: 0, k: 30 }, os: { a: 0, k: 0 }, r: { a: 0, k: 0 }, pt: { a: 0, k: 3 } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.8, 0.4, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    }
  ]
});

const EXAMPLE_DASHED_CIRCLE = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Dashed Circle", ind: 0, ip: 0, op: 90,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Dashed Circle Group",
      it: [
        { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [300, 300] } },
        { ty: "st", nm: "Dashed Stroke", c: { a: 0, k: [0.2, 0.6, 1, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 6 }, lc: 2, lj: 2, d: [
          { n: "d", nm: "dash", v: { a: 0, k: 15 } },
          { n: "g", nm: "gap", v: { a: 0, k: 10 } },
          { n: "o", nm: "offset", v: { a: 1, k: [
            { t: 0, s: [0], e: [360], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
            { t: 90, s: [360] }
          ] } }
        ] },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_ROUNDED_RECT = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Rounded Rectangle", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Rounded Rect Group",
      it: [
        { ty: "rc", nm: "Rect", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [240, 180] }, r: { a: 0, k: 0 } },
        { ty: "rd", nm: "Round Corners", r: { a: 1, k: [
          { t: 0, s: [0], e: [40], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
          { t: 30, s: [40], e: [0], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
          { t: 60, s: [0] }
        ] } },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [0.95, 0.4, 0.3, 1] }, o: { a: 0, k: 100 } },
        { ty: "st", nm: "Stroke", c: { a: 0, k: [0.75, 0.2, 0.15, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 3 }, lc: 2, lj: 2 },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_EASING_SHOWCASE = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  layers: [
    {
      ty: 4, nm: "Linear", ind: 0, ip: 0, op: 60,
      ks: {
        p: { a: 1, k: [
          { t: 0, s: [60, 100], e: [452, 100], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
          { t: 60, s: [452, 100] }
        ] },
        s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] }
      },
      shapes: [{ ty: "gr", nm: "G", it: [
        { ty: "el", nm: "E", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [50, 50] } },
        { ty: "fl", nm: "F", c: { a: 0, k: [0.4, 0.7, 1, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ] }]
    },
    {
      ty: 4, nm: "Ease-in-out", ind: 1, ip: 0, op: 60,
      ks: {
        p: { a: 1, k: [
          { t: 0, s: [60, 230], e: [452, 230], i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
          { t: 60, s: [452, 230] }
        ] },
        s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] }
      },
      shapes: [{ ty: "gr", nm: "G", it: [
        { ty: "el", nm: "E", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [50, 50] } },
        { ty: "fl", nm: "F", c: { a: 0, k: [0.2, 0.8, 0.4, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ] }]
    },
    {
      ty: 4, nm: "Bounce", ind: 2, ip: 0, op: 60,
      ks: {
        p: { a: 1, k: [
          { t: 0, s: [60, 360], e: [452, 360], i: { x: [0.34], y: [1.56] }, o: { x: [0.64], y: [1] } },
          { t: 60, s: [452, 360] }
        ] },
        s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] }
      },
      shapes: [{ ty: "gr", nm: "G", it: [
        { ty: "el", nm: "E", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [50, 50] } },
        { ty: "fl", nm: "F", c: { a: 0, k: [1, 0.4, 0.2, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ] }]
    },
    {
      ty: 4, nm: "Snappy", ind: 3, ip: 0, op: 60,
      ks: {
        p: { a: 1, k: [
          { t: 0, s: [60, 490], e: [452, 490], i: { x: [0.1], y: [1] }, o: { x: [0.9], y: [0] } },
          { t: 60, s: [452, 490] }
        ] },
        s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] }
      },
      shapes: [{ ty: "gr", nm: "G", it: [
        { ty: "el", nm: "E", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [50, 50] } },
        { ty: "fl", nm: "F", c: { a: 0, k: [0.9, 0.2, 0.6, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ] }]
    }
  ]
});

const EXAMPLE_PRECOMP_REUSE = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  assets: [{
    id: "star_comp",
    layers: [{
      ty: 4, nm: "Star Shape", ind: 0, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [64, 64] },
        s: { a: 0, k: [100, 100] },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0], e: [360], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
            { t: 90, s: [360] }
          ]
        },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [64, 64] }
      },
      shapes: [{
        ty: "gr", nm: "Star",
        it: [
          { ty: "sr", nm: "Star", sy: 1, p: { a: 0, k: [64, 64] }, or: { a: 0, k: 50 }, os: { a: 0, k: 0 }, ir: { a: 0, k: 25 }, is: { a: 0, k: 0 }, r: { a: 0, k: 0 }, pt: { a: 0, k: 5 } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [1, 0.8, 0, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    }],
    fr: 30, w: 128, h: 128
  }],
  layers: [
    {
      ty: 0, nm: "Star 1", refId: "star_comp", ind: 0, ip: 0, op: 90, w: 128, h: 128,
      ks: {
        p: { a: 0, k: [128, 256] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [64, 64] }
      }
    },
    {
      ty: 0, nm: "Star 2", refId: "star_comp", ind: 1, ip: 0, op: 90, w: 128, h: 128,
      ks: {
        p: { a: 0, k: [256, 256] },
        s: { a: 0, k: [150, 150] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [64, 64] }
      }
    },
    {
      ty: 0, nm: "Star 3", refId: "star_comp", ind: 2, ip: 0, op: 90, w: 128, h: 128,
      ks: {
        p: { a: 0, k: [384, 256] },
        s: { a: 0, k: [75, 75] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 80 },
        a: { a: 0, k: [64, 64] }
      }
    }
  ]
});

const EXAMPLE_REPEATER_RADIAL = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Radial Ring", ind: 0, ip: 0, op: 90,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 1, k: [
        { t: 0, s: [0], e: [360], i: { x: [0.42], y: [0] }, o: { x: [0.58], y: [1] } },
        { t: 90, s: [360] }
      ] },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Circle Group",
      it: [
        { ty: "el", nm: "Circle", p: { a: 0, k: [0, -120] }, s: { a: 0, k: [50, 50] } },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [0, 0.75, 0.75, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    },
    {
      ty: "rp", nm: "Repeater",
      c: { a: 0, k: 8 },
      o: { a: 0, k: 0 },
      tr: {
        p: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 45 },
        so: { a: 0, k: 100 },
        eo: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      m: 1
    }]
  }]
});

const EXAMPLE_DROP_SHADOW = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Shadow Box", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Rounded Rect Group",
      it: [
        { ty: "rc", nm: "Rect", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [200, 200] }, r: { a: 0, k: 20 } },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.5, 0.9, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }],
    ef: [{
      ty: 25, nm: "Drop Shadow", np: 6, ix: 0, en: 1,
      ef: [
        { ty: 2, nm: "Shadow Color", ix: 1, v: { a: 0, k: [0, 0, 0, 1] } },
        { ty: 0, nm: "Opacity", ix: 2, v: { a: 0, k: 180 } },
        { ty: 0, nm: "Direction", ix: 3, v: { a: 0, k: 135 } },
        { ty: 0, nm: "Distance", ix: 4, v: { a: 1, k: [
          { t: 0, s: [5], e: [25], i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
          { t: 30, s: [25], e: [5], i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
          { t: 60, s: [5] }
        ] } },
        { ty: 0, nm: "Softness", ix: 5, v: { a: 0, k: 20 } }
      ]
    }]
  }]
});

const EXAMPLE_GAUSSIAN_BLUR = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Blurry Circle", ind: 0, ip: 0, op: 60,
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
        { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [180, 180] } },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [1, 0.5, 0.1, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }],
    ef: [{
      ty: 29, nm: "Gaussian Blur", np: 4, ix: 0, en: 1,
      ef: [
        { ty: 0, nm: "Blurriness", ix: 1, v: { a: 1, k: [
          { t: 0, s: [0], e: [20], i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
          { t: 30, s: [20], e: [0], i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
          { t: 60, s: [0] }
        ] } },
        { ty: 0, nm: "Dimensions", ix: 2, v: { a: 0, k: 1 } },
        { ty: 0, nm: "Repeat Edge Pixels", ix: 3, v: { a: 0, k: 1 } }
      ]
    }]
  }]
});

const EXAMPLE_PENDULUM = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  layers: [
    {
      ty: 3, nm: "Pivot Null", ind: 0, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [256, 80] },
        s: { a: 0, k: [100, 100] },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0], e: [45], i: { x: [0.42], y: [0] }, o: { x: [0.58], y: [1] } },
            { t: 22, s: [45], e: [-45], i: { x: [0.42], y: [0] }, o: { x: [0.58], y: [1] } },
            { t: 67, s: [-45], e: [0], i: { x: [0.42], y: [0] }, o: { x: [0.58], y: [1] } },
            { t: 90, s: [0] }
          ]
        },
        o: { a: 0, k: 0 },
        a: { a: 0, k: [0, 0] }
      }
    },
    {
      ty: 4, nm: "Arm", ind: 1, parent: 0, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "Rod",
        it: [
          { ty: "rc", nm: "Rect", p: { a: 0, k: [0, 140] }, s: { a: 0, k: [6, 280] }, r: { a: 0, k: 3 } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [0.7, 0.7, 0.7, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    },
    {
      ty: 4, nm: "Bob", ind: 2, parent: 0, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [0, 280] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "Weight",
        it: [
          { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [60, 60] } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [0.9, 0.3, 0.2, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    },
    {
      ty: 4, nm: "Pivot Pin", ind: 3, ip: 0, op: 90,
      ks: {
        p: { a: 0, k: [256, 80] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 },
        a: { a: 0, k: [0, 0] }
      },
      shapes: [{
        ty: "gr", nm: "Pin",
        it: [
          { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [16, 16] } },
          { ty: "fl", nm: "Fill", c: { a: 0, k: [0.4, 0.4, 0.4, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
        ]
      }]
    }
  ]
});

const EXAMPLE_MERGE_SUBTRACT = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Donut Ring", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: {
        a: 1,
        k: [
          { t: 0, s: [0], e: [360], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
          { t: 60, s: [360] }
        ]
      },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Donut Group",
      it: [
        { ty: "el", nm: "Outer Circle", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [200, 200] } },
        { ty: "el", nm: "Inner Circle", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] } },
        { ty: "mm", nm: "Merge Paths", mm: 3 },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [0.2, 0.8, 0.6, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_MERGE_INTERSECT = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Crescent Moon", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: {
        a: 1,
        k: [
          { t: 0, s: [-5], e: [5], i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
          { t: 30, s: [5], e: [-5], i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
          { t: 60, s: [-5] }
        ]
      },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Crescent Group",
      it: [
        { ty: "el", nm: "Main Circle", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [180, 180] } },
        { ty: "el", nm: "Cutout Circle", p: { a: 0, k: [50, 0] }, s: { a: 0, k: [180, 180] } },
        { ty: "mm", nm: "Merge Paths", mm: 3 },
        { ty: "fl", nm: "Fill", c: { a: 0, k: [1, 0.85, 0.2, 1] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

const EXAMPLE_GRADIENT_STROKE_RING = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 90, w: 512, h: 512,
  layers: [{
    ty: 4, nm: "Rainbow Ring", ind: 0, ip: 0, op: 90,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    shapes: [{
      ty: "gr", nm: "Ring Group",
      it: [
        { ty: "el", nm: "Ellipse", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [300, 300] } },
        { ty: "gs", nm: "Gradient Stroke", t: 1,
          s: { a: 0, k: [-150, 0] }, e: { a: 0, k: [150, 0] },
          g: { p: 6, k: { a: 0, k: [0, 1, 0, 0, 0.2, 1, 1, 0, 0.4, 0, 1, 0, 0.6, 0, 1, 1, 0.8, 0, 0, 1, 1, 0.8, 0, 1] } },
          o: { a: 0, k: 100 }, w: { a: 0, k: 8 }, lc: 2, lj: 2 },
        { ty: "tm", nm: "Trim",
          s: { a: 0, k: 0 },
          e: { a: 1, k: [
            { t: 0, s: [0], e: [75], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
            { t: 90, s: [75] }
          ] },
          o: { a: 0, k: 0 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, a: { a: 0, k: [0, 0] } }
      ]
    }]
  }]
});

interface ExampleEntry {
  name: string;
  title: string;
  categories: string[];
  json: string;
}

const EXAMPLE_REGISTRY: ExampleEntry[] = [
  { name: "EXAMPLE_CIRCLE", title: "Blue circle (static)", categories: ["basic"], json: EXAMPLE_CIRCLE },
  { name: "EXAMPLE_BOUNCING_BALL", title: "Red bouncing ball (animated position)", categories: ["basic", "motion", "scale"], json: EXAMPLE_BOUNCING_BALL },
  { name: "EXAMPLE_SPINNING_SQUARE", title: "Green spinning square (animated rotation)", categories: ["basic", "rotation"], json: EXAMPLE_SPINNING_SQUARE },
  { name: "EXAMPLE_FADE_IN_OUT", title: "Fade in/out (animated opacity)", categories: ["opacity"], json: EXAMPLE_FADE_IN_OUT },
  { name: "EXAMPLE_SCALE_PULSE", title: "Scale pulse / heartbeat (animated scale with overshoot easing)", categories: ["scale"], json: EXAMPLE_SCALE_PULSE },
  { name: "EXAMPLE_LOADING_SPINNER", title: "Loading spinner (rotation + trim paths)", categories: ["rotation", "stroke", "modifier"], json: EXAMPLE_LOADING_SPINNER },
  { name: "EXAMPLE_MULTI_LAYER", title: "Multi-layer composition (staggered timing, 3 elements)", categories: ["multi"], json: EXAMPLE_MULTI_LAYER },
  { name: "EXAMPLE_COLOR_TRANSITION", title: "Color transition (animated fill color)", categories: ["color"], json: EXAMPLE_COLOR_TRANSITION },
  { name: "EXAMPLE_PATH_ANIMATION", title: "Path animation (bezier curve movement with tangents)", categories: ["motion", "path"], json: EXAMPLE_PATH_ANIMATION },
  { name: "EXAMPLE_TEXT_STATIC", title: "Static text display", categories: ["text"], json: EXAMPLE_TEXT_STATIC },
  { name: "EXAMPLE_TEXT_TYPEWRITER", title: "Typewriter effect (character-by-character)", categories: ["text"], json: EXAMPLE_TEXT_TYPEWRITER },
  { name: "EXAMPLE_TEXT_BOUNCE_IN", title: "Bounce-in text (per-character scale)", categories: ["text", "scale"], json: EXAMPLE_TEXT_BOUNCE_IN },
  { name: "EXAMPLE_MASK_TEXT_REVEAL", title: "Text reveal wipe (animated mask expands left to right)", categories: ["mask", "text"], json: EXAMPLE_MASK_TEXT_REVEAL },
  { name: "EXAMPLE_MASK_CIRCLE_REVEAL", title: "Circular reveal (expanding ellipse mask from center)", categories: ["mask"], json: EXAMPLE_MASK_CIRCLE_REVEAL },
  { name: "EXAMPLE_TRACK_MATTE_CLIP", title: "Shape clipping with track matte (star-shaped alpha matte clips gradient)", categories: ["mask", "color", "path"], json: EXAMPLE_TRACK_MATTE_CLIP },
  { name: "EXAMPLE_ORBITING_DOTS", title: "Orbiting dots (null layer parent with rotating children)", categories: ["parent", "rotation"], json: EXAMPLE_ORBITING_DOTS },
  { name: "EXAMPLE_GROUP_MOVEMENT", title: "Group movement (shapes parented to a translating null)", categories: ["parent", "motion", "multi"], json: EXAMPLE_GROUP_MOVEMENT },
  { name: "EXAMPLE_PENDULUM", title: "Pendulum (pivot null with oscillating rotation, parented arm and bob)", categories: ["parent", "rotation"], json: EXAMPLE_PENDULUM },
  { name: "EXAMPLE_DASHED_CIRCLE", title: "Dashed circle with marching ants (stroke dashes + animated offset)", categories: ["stroke"], json: EXAMPLE_DASHED_CIRCLE },
  { name: "EXAMPLE_ROUNDED_RECT", title: "Rounded rectangle with animated corner radius (round corners modifier)", categories: ["modifier", "stroke"], json: EXAMPLE_ROUNDED_RECT },
  { name: "EXAMPLE_EASING_SHOWCASE", title: "Easing comparison (4 circles with linear, ease-in-out, bounce, snappy)", categories: ["easing"], json: EXAMPLE_EASING_SHOWCASE },
  { name: "EXAMPLE_PRECOMP_REUSE", title: "Precomp reuse (3 spinning stars from one asset definition)", categories: ["precomp", "multi", "rotation"], json: EXAMPLE_PRECOMP_REUSE },
  { name: "EXAMPLE_REPEATER_RADIAL", title: "Radial pattern with repeater (8 circles in a ring using shape repeater modifier)", categories: ["modifier", "multi"], json: EXAMPLE_REPEATER_RADIAL },
  { name: "EXAMPLE_DROP_SHADOW", title: "Drop shadow on a rounded rectangle (animated shadow distance)", categories: ["effect"], json: EXAMPLE_DROP_SHADOW },
  { name: "EXAMPLE_GAUSSIAN_BLUR", title: "Gaussian blur on a circle (animated blurriness)", categories: ["effect"], json: EXAMPLE_GAUSSIAN_BLUR },
  { name: "EXAMPLE_MERGE_SUBTRACT", title: "Donut ring (merge paths subtract — inner circle cut from outer)", categories: ["modifier"], json: EXAMPLE_MERGE_SUBTRACT },
  { name: "EXAMPLE_MERGE_INTERSECT", title: "Crescent moon (merge paths subtract — offset circle cuts into main circle)", categories: ["modifier"], json: EXAMPLE_MERGE_INTERSECT },
  { name: "EXAMPLE_GRADIENT_STROKE_RING", title: "Rainbow progress ring (gradient stroke with trim paths)", categories: ["stroke", "gradient", "color", "modifier"], json: EXAMPLE_GRADIENT_STROKE_RING },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  basic: [],
  motion: ["bounce", "move", "slide", "translate", "position", "path", "orbit", "pendulum", "float", "sway"],
  rotation: ["spin", "rotate", "turn", "twist", "orbit", "pendulum"],
  text: ["text", "word", "letter", "character", "type", "typewriter", "font", "title", "heading", "label", "write"],
  color: ["color", "gradient", "rainbow", "hue", "transition", "shift", "fade", "gradient stroke", "gradient border", "gradient outline", "neon"],
  opacity: ["fade", "opacity", "appear", "disappear", "ghost", "transparent", "invisible", "reveal"],
  scale: ["scale", "pulse", "heartbeat", "grow", "shrink", "zoom", "pop", "bounce"],
  stroke: ["stroke", "dash", "dotted", "line", "border", "outline", "draw", "marching", "gradient stroke", "gradient border", "gradient outline", "neon stroke", "gradient ring", "rainbow border", "rainbow outline"],
  mask: ["mask", "clip", "reveal", "wipe", "matte", "stencil"],
  parent: ["orbit", "group", "parent", "follow", "chain", "hierarchy", "pendulum", "solar"],
  path: ["path", "bezier", "curve", "heart", "star", "polygon", "arrow", "custom shape", "crescent", "moon"],
  modifier: ["round corner", "repeater", "trim", "modifier", "merge", "combine", "subtract", "intersect", "boolean", "cut out", "cutout", "donut", "ring", "crescent", "punch", "hole"],
  multi: ["composition", "multi", "layer", "stagger", "sequence", "multiple", "scene"],
  precomp: ["precomp", "reuse", "repeat", "multiple copies", "duplicate", "instance", "nested", "composition", "asset"],
  easing: ["bounce", "spring", "elastic", "smooth", "gentle", "snappy", "ease", "timing", "speed", "slow", "fast", "crisp", "sharp"],
  effect: ["shadow", "blur", "glow", "effect", "blurry", "sharp", "soft", "drop shadow", "gaussian", "neon"],
  gradient: ["gradient", "rainbow", "gradient fill", "gradient stroke", "linear gradient", "radial gradient", "color stops"],
};

export function selectExamples(userMessage: string, maxExamples: number = 5): ExampleEntry[] {
  const lower = userMessage.toLowerCase();

  // Find which categories match the user message
  const matchedCategories = new Set<string>();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === "basic") continue;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        matchedCategories.add(category);
        break;
      }
    }
  }

  // Always start with 1 basic example (the circle)
  const basicExample = EXAMPLE_REGISTRY.find(e => e.name === "EXAMPLE_CIRCLE")!;
  const selected: ExampleEntry[] = [basicExample];
  const usedNames = new Set<string>([basicExample.name]);

  if (matchedCategories.size === 0) {
    // No keyword matches — return a diverse default set
    const defaults = ["EXAMPLE_BOUNCING_BALL", "EXAMPLE_SPINNING_SQUARE", "EXAMPLE_FADE_IN_OUT", "EXAMPLE_COLOR_TRANSITION"];
    for (const name of defaults) {
      const entry = EXAMPLE_REGISTRY.find(e => e.name === name);
      if (entry) {
        selected.push(entry);
        usedNames.add(name);
      }
    }
    return selected;
  }

  // Score each non-basic example by how many matched categories it belongs to
  const scored = EXAMPLE_REGISTRY
    .filter(e => !usedNames.has(e.name))
    .map(e => ({
      entry: e,
      score: e.categories.filter(c => matchedCategories.has(c)).length,
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { entry } of scored) {
    if (selected.length >= maxExamples) break;
    selected.push(entry);
    usedNames.add(entry.name);
  }

  // If we still have room, fill with diverse defaults
  if (selected.length < maxExamples) {
    const fillers = EXAMPLE_REGISTRY.filter(e => !usedNames.has(e.name));
    for (const filler of fillers) {
      if (selected.length >= maxExamples) break;
      selected.push(filler);
    }
  }

  return selected;
}

export function buildSystemPrompt(currentAnimation: object | null, userMessage?: string): string {
  const examples = userMessage
    ? selectExamples(userMessage)
    : EXAMPLE_REGISTRY.slice(0, 5);

  const exampleBlocks = examples
    .map(e => `### ${e.title}\n\`\`\`json\n${e.json}\n\`\`\``)
    .join("\n\n");
  let prompt = `You are a Lottie animation expert. You create and modify Lottie JSON animations based on user descriptions.

${LOTTIE_SPEC}

## Example Animations

${exampleBlocks}

## Your Response Format

1. Briefly describe what you created or changed (1-2 sentences).
2. Output the COMPLETE Lottie JSON inside a single \`\`\`json code block.

3. After the JSON block, include a line with 2-3 contextual follow-up suggestions:
SUGGESTIONS: ["Add a shadow effect", "Speed up the animation", "Change to sunset colors"]
These should be specific, actionable refinements based on what was just created or modified. Make them diverse (e.g., one about color, one about motion, one about adding elements).

Rules:
- Always output valid, complete Lottie JSON — never partial or pseudo-code.
- Use canvas size 512x512 unless the user specifies otherwise.`;

  if (currentAnimation) {
    const anim = currentAnimation as Record<string, unknown>;
    const w = anim.w as number | undefined;
    const h = anim.h as number | undefined;
    if (w && h) {
      prompt += `\n- The current artboard dimensions are ${w}\u00d7${h} pixels. Use these dimensions for any modifications unless the user asks to change them.`;
    }
  }

  prompt += `
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
