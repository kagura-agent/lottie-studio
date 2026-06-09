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

## Text Layer (ty: 5)
A text layer displays text content. It has ty: 5 and a "t" property containing text data.

Text layer structure:
- "ty": 5
- "nm": layer name
- "ind": layer index
- "ip": in-point, "op": out-point
- "ks": standard transform (position, scale, rotation, opacity) — animate these for movement/effects
- "t": text data object (see below)

### Text Data ("t" property)
- "d": animated text document
  - "k": array of text document keyframes, each with:
    - "t": time (frame number)
    - "s": text document object:
      - "f": font family name (must match fName in fonts list)
      - "fc": fill color [r, g, b, a] (0-1 range)
      - "sc": stroke color [r, g, b, a] (optional)
      - "sw": stroke width (optional)
      - "s": font size (number)
      - "t": text content string (use \r for newlines)
      - "j": justify — 0 = left, 1 = right, 2 = center
      - "lh": line height (optional)
      - "tr": tracking / letter spacing (optional)
      - "ls": baseline shift (optional)
      - "sz": text box size [width, height] (optional, for wrapping)
      - "ps": text box position [x, y] (optional)
- "a": text animators/ranges array (optional, for per-character effects — advanced)
- "m": alignment options (optional)

### Font Registration (REQUIRED)
Fonts must be registered at the animation root level:
"fonts": { "list": [{ "fFamily": "Arial", "fName": "Arial", "fStyle": "Regular" }] }

Use web-safe fonts that don't need external loading:
- Arial, Helvetica, Georgia, Times New Roman, Courier New, monospace

### Important Notes
- Text content changes are discrete — keyframes switch text instantly, no interpolation between text states
- Animate text movement/appearance using the standard "ks" transform (position, scale, rotation, opacity)
- Each font used must have a corresponding entry in the root "fonts.list" array
- The "f" value in the text document must match an "fName" in fonts.list
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

const EXAMPLE_STATIC_TEXT = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  fonts: { list: [{ fFamily: "Arial", fName: "Arial", fStyle: "Regular" }] },
  layers: [{
    ty: 5, nm: "Hello Text", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0] }
    },
    t: {
      d: { k: [{ t: 0, s: { f: "Arial", fc: [0, 0, 0, 1], s: 48, t: "Hello World", j: 2, lh: 60 } }] },
      a: [],
      m: { a: { a: 0, k: [0, 0] }, g: 0 }
    }
  }]
});

const EXAMPLE_FADE_IN_TEXT = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  fonts: { list: [{ fFamily: "Arial", fName: "Arial", fStyle: "Regular" }] },
  layers: [{
    ty: 5, nm: "Fade In Text", ind: 0, ip: 0, op: 60,
    ks: {
      p: { a: 0, k: [256, 256] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: {
        a: 1,
        k: [
          { t: 0, s: [0], e: [100], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
          { t: 30, s: [100] }
        ]
      },
      a: { a: 0, k: [0, 0] }
    },
    t: {
      d: { k: [{ t: 0, s: { f: "Arial", fc: [0.2, 0.6, 1, 1], s: 42, t: "Fade In", j: 2, lh: 52 } }] },
      a: [],
      m: { a: { a: 0, k: [0, 0] }, g: 0 }
    }
  }]
});

const EXAMPLE_SLIDE_UP_TEXT = JSON.stringify({
  v: "5.7.1", fr: 30, ip: 0, op: 60, w: 512, h: 512,
  fonts: { list: [{ fFamily: "Arial", fName: "Arial", fStyle: "Regular" }] },
  layers: [{
    ty: 5, nm: "Slide Up Text", ind: 0, ip: 0, op: 60,
    ks: {
      p: {
        a: 1,
        k: [
          { t: 0, s: [256, 400], e: [256, 256], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
          { t: 30, s: [256, 256] }
        ]
      },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: {
        a: 1,
        k: [
          { t: 0, s: [0], e: [100], i: { x: [0.33], y: [1] }, o: { x: [0.67], y: [0] } },
          { t: 20, s: [100] }
        ]
      },
      a: { a: 0, k: [0, 0] }
    },
    t: {
      d: { k: [{ t: 0, s: { f: "Arial", fc: [0.2, 0.8, 0.4, 1], s: 36, t: "Slide Up", j: 2, lh: 46 } }] },
      a: [],
      m: { a: { a: 0, k: [0, 0] }, g: 0 }
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

### Static centered text (text layer, type 5)
\`\`\`json
${EXAMPLE_STATIC_TEXT}
\`\`\`

### Fade-in text (text layer with opacity animation)
\`\`\`json
${EXAMPLE_FADE_IN_TEXT}
\`\`\`

### Slide-up text (text layer with position + opacity animation)
\`\`\`json
${EXAMPLE_SLIDE_UP_TEXT}
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
