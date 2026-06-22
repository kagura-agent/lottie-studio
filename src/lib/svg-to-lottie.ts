/**
 * SVG-to-Lottie converter — regex-based SVG parsing, no external deps.
 * Supports: rect, circle, ellipse, path, line, polyline, polygon, g (groups).
 * Handles: fill, stroke, stroke-width, opacity, transform (translate/rotate/scale).
 */

interface SP { a: 0; k: number | number[] }
type Shape = { ty: "rc"; nm: string; p: SP; s: SP; r: SP }
  | { ty: "el"; nm: string; p: SP; s: SP }
  | { ty: "sh"; nm: string; ks: { a: 0; k: { v: number[][]; i: number[][]; o: number[][]; c: boolean } } }
  | { ty: "fl"; nm: string; c: SP; o: SP }
  | { ty: "st"; nm: string; c: SP; o: SP; w: SP }
  | { ty: "gr"; nm: string; it: Shape[] }
  | { ty: "tr"; p: SP; a: SP; s: SP; r: SP; o: SP };

export interface LottieLayer {
  ty: number; nm: string; ind: number; ip: number; op: number; st: number;
  ks: { o: SP; r: SP; p: SP; a: SP; s: SP }; shapes: Shape[];
}

export interface LottieJson {
  v: string; fr: number; ip: number; op: number; w: number; h: number; layers: LottieLayer[];
}

interface El { tag: string; attrs: Record<string, string>; children: El[] }

const sp = (k: number | number[]): SP => ({ a: 0, k });

// --- Named Colors ---
const COLORS: Record<string, [number, number, number]> = {
  black:[0,0,0],white:[255,255,255],red:[255,0,0],green:[0,128,0],blue:[0,0,255],
  yellow:[255,255,0],cyan:[0,255,255],magenta:[255,0,255],orange:[255,165,0],
  purple:[128,0,128],pink:[255,192,203],gray:[128,128,128],grey:[128,128,128],
  lime:[0,255,0],navy:[0,0,128],teal:[0,128,128],maroon:[128,0,0],olive:[128,128,0],
  aqua:[0,255,255],silver:[192,192,192],gold:[255,215,0],coral:[255,127,80],
  tomato:[255,99,71],salmon:[250,128,114],khaki:[240,230,140],indigo:[75,0,130],
  violet:[238,130,238],tan:[210,180,140],crimson:[220,20,60],turquoise:[64,224,208],
};

export function parseColor(color: string | undefined): [number, number, number, number] | null {
  if (!color || color === "none" || color === "transparent") return null;
  const c = color.trim().toLowerCase();
  if (c.startsWith("#")) {
    const h = c.slice(1);
    if (h.length === 3) return [parseInt(h[0]+h[0],16)/255, parseInt(h[1]+h[1],16)/255, parseInt(h[2]+h[2],16)/255, 1];
    if (h.length === 6) return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255, 1];
    return null;
  }
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (m) return [+m[1]/255, +m[2]/255, +m[3]/255, m[4] !== undefined ? +m[4] : 1];
  if (c in COLORS) { const [r,g,b] = COLORS[c]; return [r/255, g/255, b/255, 1]; }
  return null;
}

// --- SVG XML Parsing ---
export function parseSvgXml(svg: string): El | null {
  svg = svg.replace(/<\?xml[^?]*\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").trim();
  const stack: El[] = [];
  let root: El | null = null;
  const re = /<\/?([a-zA-Z][\w:-]*)((?:\s+[\w-]+\s*=\s*"[^"]*"|\s+[\w-]+\s*=\s*'[^']*')*)\s*(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg)) !== null) {
    const full = match[0], tag = match[1].toLowerCase(), attrStr = match[2] || "";
    const selfClose = match[3] === "/" || full.endsWith("/>");
    if (full.startsWith("</")) { stack.pop(); continue; }
    const attrs: Record<string, string> = {};
    const ar = /([\w-]+)\s*=\s*["']([^"']*)["']/g;
    let am: RegExpExecArray | null;
    while ((am = ar.exec(attrStr)) !== null) attrs[am[1]] = am[2];
    const el: El = { tag, attrs, children: [] };
    if (stack.length > 0) stack[stack.length - 1].children.push(el); else root = el;
    if (!selfClose) stack.push(el);
  }
  return root;
}

// --- Transform Parsing ---
export function parseTransform(t: string | undefined) {
  let tx = 0, ty = 0, sx = 100, sy = 100, rotation = 0;
  if (!t) return { tx, ty, sx, sy, rotation, rot: rotation };
  const tr = t.match(/translate\(\s*([-\d.]+)(?:\s*[,\s]\s*([-\d.]+))?\s*\)/);
  if (tr) { tx = +tr[1]; ty = tr[2] ? +tr[2] : 0; }
  const ro = t.match(/rotate\(\s*([-\d.]+)/);
  if (ro) rotation = +ro[1];
  const sc = t.match(/scale\(\s*([-\d.]+)(?:\s*[,\s]\s*([-\d.]+))?\s*\)/);
  if (sc) { sx = +sc[1] * 100; sy = sc[2] ? +sc[2] * 100 : sx; }
  return { tx, ty, sx, sy, rotation, rot: rotation };
}

// --- Path d-attribute Parsing ---
interface PathData {
  vertices: number[][]; inTangents: number[][]; outTangents: number[][]; closed: boolean;
  v: number[][]; i: number[][]; o: number[][]; c: boolean;
}

export function parsePath(d: string): PathData[] {
  const paths: PathData[] = [];
  let verts: number[][] = [], ins: number[][] = [], outs: number[][] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  const toks: string[] = [];
  const tr = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  let tk: RegExpExecArray | null;
  while ((tk = tr.exec(d)) !== null) toks.push(tk[0]);
  let idx = 0, cmd = "";
  const num = (): number => {
    while (idx < toks.length && /^[A-Za-z]$/.test(toks[idx])) idx++;
    return idx < toks.length ? parseFloat(toks[idx++]) : 0;
  };
  const flush = (closed: boolean) => {
    if (verts.length > 0) {
      const v = [...verts], i = [...ins], o = [...outs];
      paths.push({ vertices: v, inTangents: i, outTangents: o, closed, v, i, o, c: closed });
    }
    verts = []; ins = []; outs = [];
  };
  const addVert = (px: number, py: number) => { verts.push([px, py]); ins.push([0,0]); outs.push([0,0]); };

  while (idx < toks.length) {
    if (/^[A-Za-z]$/.test(toks[idx])) { cmd = toks[idx]; idx++; }
    switch (cmd) {
      case "M": flush(false); x=num(); y=num(); sx=x; sy=y; addVert(x,y); cmd="L"; break;
      case "m": flush(false); x+=num(); y+=num(); sx=x; sy=y; addVert(x,y); cmd="l"; break;
      case "L": x=num(); y=num(); addVert(x,y); break;
      case "l": x+=num(); y+=num(); addVert(x,y); break;
      case "H": x=num(); addVert(x,y); break;
      case "h": x+=num(); addVert(x,y); break;
      case "V": y=num(); addVert(x,y); break;
      case "v": y+=num(); addVert(x,y); break;
      case "C": { const c1x=num(),c1y=num(),c2x=num(),c2y=num(),ex=num(),ey=num();
        outs[outs.length-1]=[c1x-x,c1y-y]; verts.push([ex,ey]); ins.push([c2x-ex,c2y-ey]); outs.push([0,0]); x=ex; y=ey; break; }
      case "c": { const c1x=num(),c1y=num(),c2x=num(),c2y=num(),dx=num(),dy=num();
        outs[outs.length-1]=[c1x,c1y]; const nx=x+dx,ny=y+dy; verts.push([nx,ny]); ins.push([c2x-dx,c2y-dy]); outs.push([0,0]); x=nx; y=ny; break; }
      case "Q": { const qx=num(),qy=num(),ex=num(),ey=num();
        outs[outs.length-1]=[(2/3)*(qx-x),(2/3)*(qy-y)]; verts.push([ex,ey]); ins.push([(2/3)*(qx-ex),(2/3)*(qy-ey)]); outs.push([0,0]); x=ex; y=ey; break; }
      case "q": { const dqx=num(),dqy=num(),dx=num(),dy=num(); const qx=x+dqx,qy=y+dqy,ex=x+dx,ey=y+dy;
        outs[outs.length-1]=[(2/3)*(qx-x),(2/3)*(qy-y)]; verts.push([ex,ey]); ins.push([(2/3)*(qx-ex),(2/3)*(qy-ey)]); outs.push([0,0]); x=ex; y=ey; break; }
      case "S": { const c2x=num(),c2y=num(),ex=num(),ey=num(); const p=outs[outs.length-1];
        outs[outs.length-1]=[-p[0],-p[1]]; verts.push([ex,ey]); ins.push([c2x-ex,c2y-ey]); outs.push([0,0]); x=ex; y=ey; break; }
      case "s": { const dc2x=num(),dc2y=num(),dx=num(),dy=num(); const p=outs[outs.length-1];
        outs[outs.length-1]=[-p[0],-p[1]]; const nx=x+dx,ny=y+dy; verts.push([nx,ny]); ins.push([dc2x-dx,dc2y-dy]); outs.push([0,0]); x=nx; y=ny; break; }
      case "A": case "a": {
        const rx=num(),ry=num(); num(); num(); num(); // rotation, large-arc, sweep
        let ex: number, ey: number;
        if (cmd==="A") { ex=num(); ey=num(); } else { ex=x+num(); ey=y+num(); }
        const mx=(x+ex)/2, my=(y+ey)/2, dx2=ex-x, dy2=ey-y;
        const cl=Math.sqrt(dx2*dx2+dy2*dy2), r=Math.max(rx,ry);
        const bulge=cl>0?(r*0.5523)*(2*r/cl):r*0.55;
        const nx2=-dy2/(cl||1), ny2=dx2/(cl||1);
        outs[outs.length-1]=[mx+nx2*bulge-x, my+ny2*bulge-y];
        verts.push([ex,ey]); ins.push([mx+nx2*bulge-ex, my+ny2*bulge-ey]); outs.push([0,0]);
        x=ex; y=ey; break; }
      case "Z": case "z": x=sx; y=sy; flush(true); break;
      default: idx++; break;
    }
  }
  if (verts.length > 0) flush(false);
  return paths;
}

// --- Shape Builders ---
function styleShapes(shapes: Shape[], el: El) {
  const { fill, stroke, opacity } = el.attrs;
  const sw = el.attrs["stroke-width"];
  const fc = parseColor(fill !== undefined ? fill : (stroke ? "none" : "black"));
  if (fc) shapes.push({ ty:"fl", nm:"Fill", c:sp([fc[0],fc[1],fc[2],1]), o:sp(opacity ? +opacity*100 : 100) });
  if (stroke && stroke !== "none") {
    const sc = parseColor(stroke);
    if (sc) shapes.push({ ty:"st", nm:"Stroke", c:sp([sc[0],sc[1],sc[2],1]), o:sp(100), w:sp(sw ? +sw : 1) });
  }
}

function trShape(t: ReturnType<typeof parseTransform>): Shape {
  return { ty:"tr", p:sp([t.tx,t.ty]), a:sp([0,0]), s:sp([t.sx,t.sy]), r:sp(t.rotation), o:sp(100) };
}

function cvtRect(el: El): Shape[] {
  const x=+(el.attrs.x||0), y=+(el.attrs.y||0), w=+(el.attrs.width||0), h=+(el.attrs.height||0), rx=+(el.attrs.rx||0);
  const s: Shape[] = [{ ty:"rc", nm:"Rect", p:sp([x+w/2,y+h/2]), s:sp([w,h]), r:sp(rx) }];
  styleShapes(s, el); return s;
}

function cvtCircle(el: El): Shape[] {
  const cx=+(el.attrs.cx||0), cy=+(el.attrs.cy||0), r=+(el.attrs.r||0);
  const s: Shape[] = [{ ty:"el", nm:"Ellipse", p:sp([cx,cy]), s:sp([r*2,r*2]) }];
  styleShapes(s, el); return s;
}

function cvtEllipse(el: El): Shape[] {
  const cx=+(el.attrs.cx||0), cy=+(el.attrs.cy||0), rx=+(el.attrs.rx||0), ry=+(el.attrs.ry||0);
  const s: Shape[] = [{ ty:"el", nm:"Ellipse", p:sp([cx,cy]), s:sp([rx*2,ry*2]) }];
  styleShapes(s, el); return s;
}

function cvtLine(el: El): Shape[] {
  const x1=+(el.attrs.x1||0),y1=+(el.attrs.y1||0),x2=+(el.attrs.x2||0),y2=+(el.attrs.y2||0);
  const s: Shape[] = [{ ty:"sh", nm:"Line", ks:{a:0,k:{v:[[x1,y1],[x2,y2]],i:[[0,0],[0,0]],o:[[0,0],[0,0]],c:false}} }];
  styleShapes(s, el); return s;
}

function cvtPoly(el: El, closed: boolean): Shape[] {
  const nums = (el.attrs.points||"").trim().split(/[\s,]+/).map(Number);
  const v: number[][] = [];
  for (let i=0; i<nums.length-1; i+=2) v.push([nums[i], nums[i+1]]);
  if (!v.length) return [];
  const s: Shape[] = [{ ty:"sh", nm:closed?"Polygon":"Polyline", ks:{a:0,k:{v, i:v.map(()=>[0,0]), o:v.map(()=>[0,0]), c:closed}} }];
  styleShapes(s, el); return s;
}

function cvtPath(el: El): Shape[] {
  if (!el.attrs.d) return [];
  const pds = parsePath(el.attrs.d);
  const s: Shape[] = pds.map(pd => ({ ty:"sh" as const, nm:"Path", ks:{a:0 as const, k:{v:pd.vertices, i:pd.inTangents, o:pd.outTangents, c:pd.closed}} }));
  styleShapes(s, el); return s;
}

function cvtElement(el: El, w: string[]): Shape[] {
  switch (el.tag) {
    case "rect": return cvtRect(el);
    case "circle": return cvtCircle(el);
    case "ellipse": return cvtEllipse(el);
    case "line": return cvtLine(el);
    case "polyline": return cvtPoly(el, false);
    case "polygon": return cvtPoly(el, true);
    case "path": return cvtPath(el);
    case "g": return cvtGroup(el, w);
    default: w.push(`Unsupported element <${el.tag}> skipped`); return [];
  }
}

function cvtGroup(el: El, w: string[]): Shape[] {
  const items: Shape[] = [];
  for (const child of el.children) items.push(...cvtElement(child, w));
  if (!items.length) return [];
  items.push(trShape(parseTransform(el.attrs.transform)));
  return [{ ty:"gr", nm: el.attrs.id || el.attrs.class || "Group", it: items }];
}

// --- Main Export ---
export function convertSvgToLottie(svgString: string): { data: LottieJson; warnings: string[] } {
  const warnings: string[] = [];
  const root = parseSvgXml(svgString);
  if (!root || root.tag !== "svg") throw new Error("Invalid SVG: missing <svg> root element");

  let w = 512, h = 512;
  if (root.attrs.viewBox) {
    const p = root.attrs.viewBox.split(/[\s,]+/).map(Number);
    if (p.length === 4) { w = p[2]; h = p[3]; }
  } else {
    warnings.push("No viewBox found; using width/height or defaulting to 512x512");
  }
  if (root.attrs.width) { const v = +root.attrs.width; if (!isNaN(v)) w = v; }
  if (root.attrs.height) { const v = +root.attrs.height; if (!isNaN(v)) h = v; }

  const op = 60;
  const layers: LottieLayer[] = [];
  let li = 0;

  for (const child of root.children) {
    if (["defs","style","title","desc","metadata"].includes(child.tag)) {
      if (child.tag === "defs" || child.tag === "style")
        warnings.push(`<${child.tag}> ignored; CSS/definitions not supported`);
      continue;
    }
    const shapes = cvtElement(child, warnings);
    if (!shapes.length) continue;
    const t = parseTransform(child.tag !== "g" ? child.attrs.transform : undefined);
    layers.push({
      ty: 4, nm: child.attrs.id || child.attrs.class || `Layer ${li+1}`, ind: li,
      ip: 0, op, st: 0,
      ks: { o:sp(100), r:sp(t.rotation), p:sp([t.tx,t.ty,0]), a:sp([0,0,0]), s:sp([t.sx,t.sy,100]) },
      shapes,
    });
    li++;
  }

  return { data: { v:"5.7.1", fr:30, ip:0, op, w, h, layers }, warnings };
}
