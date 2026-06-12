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

### Fade in/out (animated opacity)
\`\`\`json
${EXAMPLE_FADE_IN_OUT}
\`\`\`

### Scale pulse / heartbeat (animated scale with overshoot easing)
\`\`\`json
${EXAMPLE_SCALE_PULSE}
\`\`\`

### Loading spinner (rotation + trim paths)
\`\`\`json
${EXAMPLE_LOADING_SPINNER}
\`\`\`

### Multi-layer composition (staggered timing, 3 elements)
\`\`\`json
${EXAMPLE_MULTI_LAYER}
\`\`\`

### Color transition (animated fill color)
\`\`\`json
${EXAMPLE_COLOR_TRANSITION}
\`\`\`

### Path animation (bezier curve movement with tangents)
\`\`\`json
${EXAMPLE_PATH_ANIMATION}
\`\`\`

### Static text display
\`\`\`json
${EXAMPLE_TEXT_STATIC}
\`\`\`

### Typewriter effect (character-by-character)
\`\`\`json
${EXAMPLE_TEXT_TYPEWRITER}
\`\`\`

### Bounce-in text (per-character scale)
\`\`\`json
${EXAMPLE_TEXT_BOUNCE_IN}
\`\`\`

### Text reveal wipe (animated mask expands left to right)
\`\`\`json
${EXAMPLE_MASK_TEXT_REVEAL}
\`\`\`

### Circular reveal (expanding ellipse mask from center)
\`\`\`json
${EXAMPLE_MASK_CIRCLE_REVEAL}
\`\`\`

### Shape clipping with track matte (star-shaped alpha matte clips gradient)
\`\`\`json
${EXAMPLE_TRACK_MATTE_CLIP}
\`\`\`

## Your Response Format

1. Briefly describe what you created or changed (1-2 sentences).
2. Output the COMPLETE Lottie JSON inside a single \`\`\`json code block.

3. After the JSON block, include a line with 2-3 contextual follow-up suggestions:
SUGGESTIONS: ["Add a shadow effect", "Speed up the animation", "Change to sunset colors"]
These should be specific, actionable refinements based on what was just created or modified. Make them diverse (e.g., one about color, one about motion, one about adding elements).

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
