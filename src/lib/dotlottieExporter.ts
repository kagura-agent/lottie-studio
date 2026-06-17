import JSZip from "jszip";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parameter reserved for future filename customization
export async function exportDotLottie(animationData: object, name: string): Promise<Blob> {
  const zip = new JSZip();

  zip.file("manifest.json", JSON.stringify({
    generator: "Lottie Studio",
    version: 1,
    animations: [{ id: "animation", speed: 1, loop: true }],
  }));

  zip.file("animations/animation.json", JSON.stringify(animationData, null, 2));

  return zip.generateAsync({ type: "blob" });
}
