import JSZip from "jszip";

interface ParsedLottie {
  name: string;
  data: object;
}

function validateLottieData(data: unknown): asserts data is Record<string, unknown> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Invalid Lottie file: expected a JSON object");
  }
  const obj = data as Record<string, unknown>;
  if (!("v" in obj)) throw new Error("Invalid Lottie file: missing version (v)");
  if (!("layers" in obj) || !Array.isArray(obj.layers)) throw new Error("Invalid Lottie file: missing or invalid layers array");
  if (typeof obj.w !== "number") throw new Error("Invalid Lottie file: missing width (w)");
  if (typeof obj.h !== "number") throw new Error("Invalid Lottie file: missing height (h)");
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

async function parseJsonFile(file: File): Promise<ParsedLottie> {
  const text = await readFileAsText(file);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON: could not parse file contents");
  }
  validateLottieData(data);
  const name = file.name.replace(/\.json$/i, "");
  return { name, data: data as object };
}

async function parseDotLottieFile(file: File): Promise<ParsedLottie> {
  const buf = await readFileAsArrayBuffer(file);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new Error("Invalid .lottie file: could not unzip archive");
  }

  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("Invalid .lottie file: missing manifest.json");
  }

  let manifest: { animations?: { id: string }[] };
  try {
    manifest = JSON.parse(await manifestFile.async("text"));
  } catch {
    throw new Error("Invalid .lottie file: could not parse manifest.json");
  }

  if (!manifest.animations || manifest.animations.length === 0) {
    throw new Error("Invalid .lottie file: no animations found in manifest");
  }

  const animId = manifest.animations[0].id;
  const animPath = `animations/${animId}.json`;
  const animFile = zip.file(animPath);
  if (!animFile) {
    throw new Error(`Invalid .lottie file: animation "${animId}" not found in archive`);
  }

  let data: unknown;
  try {
    data = JSON.parse(await animFile.async("text"));
  } catch {
    throw new Error("Invalid .lottie file: could not parse animation JSON");
  }

  validateLottieData(data);
  const name = file.name.replace(/\.lottie$/i, "");
  return { name, data: data as object };
}

export async function parseLottieFile(file: File): Promise<ParsedLottie> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".lottie")) {
    return parseDotLottieFile(file);
  }
  if (lower.endsWith(".json")) {
    return parseJsonFile(file);
  }
  throw new Error("Unsupported file type: expected .json or .lottie");
}
