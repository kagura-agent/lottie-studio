export type StaggerOrder = "normal" | "reverse" | "random";

export function staggerAnimation(
  lottieJson: object,
  delayMs: number,
  order: StaggerOrder = "normal"
): object {
  const json = JSON.parse(JSON.stringify(lottieJson)) as Record<string, unknown>;

  if (!Array.isArray(json.layers) || json.layers.length <= 1) return json;

  const fr = (json.fr as number) || 30;
  const delayFrames = (delayMs * fr) / 1000;

  const layers = json.layers as Record<string, unknown>[];
  const indices = layers.map((_, i) => i);

  if (order === "reverse") {
    indices.reverse();
  } else if (order === "random") {
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
  }

  let maxOp = (json.op as number) || 0;

  for (let rank = 0; rank < indices.length; rank++) {
    const layerIdx = indices[rank];
    const layer = layers[layerIdx];
    const offset = rank * delayFrames;
    layer.ip = ((layer.ip as number) || 0) + offset;
    layer.op = ((layer.op as number) || 0) + offset;
    if ((layer.op as number) > maxOp) {
      maxOp = layer.op as number;
    }
  }

  if (maxOp > (json.op as number)) {
    json.op = maxOp;
  }

  return json;
}
