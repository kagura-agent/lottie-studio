import { useState, useCallback, type MouseEvent } from "react";
import { useToast } from "@/contexts/ToastContext";
import { ExportPreset, getPresetFilename } from "@/lib/exportPresets";
import { rescaleForExport } from "@/lib/rescaleForExport";

async function exportWithSizeLimit(
  animationData: object,
  maxSize: number,
  onProgress: (p: number) => void
): Promise<Blob> {
  const { exportToGif } = await import("@/lib/gifExporter");

  let blob = await exportToGif({ animationData, onProgress });
  if (blob.size <= maxSize) return blob;

  const data = JSON.parse(JSON.stringify(animationData)) as Record<string, unknown>;
  const originalFr = (data.fr as number) || 30;

  const fpsAttempts = [15, 10, 8, 5];
  for (const targetFps of fpsAttempts) {
    if (targetFps >= originalFr) continue;
    const ratio = targetFps / originalFr;
    const adjusted = JSON.parse(JSON.stringify(data));
    adjusted.fr = targetFps;
    adjusted.op = Math.round(((adjusted.op as number) || 60) * ratio);
    if (adjusted.ip) adjusted.ip = Math.round((adjusted.ip as number) * ratio);
    if (Array.isArray(adjusted.layers)) {
      for (const layer of adjusted.layers) {
        if (typeof layer.ip === "number") layer.ip = Math.round(layer.ip * ratio);
        if (typeof layer.op === "number") layer.op = Math.round(layer.op * ratio);
      }
    }
    onProgress(0);
    blob = await exportToGif({ animationData: adjusted, onProgress });
    if (blob.size <= maxSize) return blob;
  }

  return blob;
}

export interface ExportState {
  gifExporting: boolean;
  gifProgress: number;
  apngExporting: boolean;
  apngProgress: number;
  videoExporting: boolean;
  videoProgress: number;
  mp4Exporting: boolean;
  mp4Progress: number;
  presetExporting: boolean;
  presetProgress: number;
  presetExportingId: string | null;
  handleExport: () => void;
  handleExportDotLottie: () => Promise<void>;
  handleExportGif: (e: MouseEvent) => Promise<void>;
  handleExportApng: (e: MouseEvent) => Promise<void>;
  handleExportVideo: (e: MouseEvent) => Promise<void>;
  handleExportMp4: (e: MouseEvent) => Promise<void>;
  handleExportPreset: (preset: ExportPreset) => Promise<void>;
}

export function useExportState(animationData: object | null, name: string): ExportState {
  const { toast } = useToast();

  const [gifExporting, setGifExporting] = useState(false);
  const [gifProgress, setGifProgress] = useState(0);
  const [apngExporting, setApngExporting] = useState(false);
  const [apngProgress, setApngProgress] = useState(0);
  const [videoExporting, setVideoExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [mp4Exporting, setMp4Exporting] = useState(false);
  const [mp4Progress, setMp4Progress] = useState(0);
  const [presetExporting, setPresetExporting] = useState(false);
  const [presetProgress, setPresetProgress] = useState(0);
  const [presetExportingId, setPresetExportingId] = useState<string | null>(null);

  const sanitizedName = useCallback(() => {
    return name.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim() || "animation";
  }, [name]);

  const handleExport = useCallback(() => {
    if (!animationData) return;
    const json = JSON.stringify(animationData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizedName()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [animationData, sanitizedName]);

  const handleExportDotLottie = useCallback(async () => {
    if (!animationData) return;
    const { exportDotLottie } = await import("@/lib/dotlottieExporter");
    const blob = await exportDotLottie(animationData, name || "animation");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (name || "animation") + ".lottie";
    a.click();
    URL.revokeObjectURL(url);
  }, [animationData, name]);

  const handleExportGif = useCallback(async (e: MouseEvent) => {
    e.preventDefault();
    if (!animationData || gifExporting) return;
    setGifExporting(true);
    setGifProgress(0);
    try {
      const { exportToGif } = await import("@/lib/gifExporter");
      const blob = await exportToGif({
        animationData,
        onProgress: setGifProgress,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizedName()}.gif`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ message: "GIF exported successfully!", type: "success" });
    } catch (err) {
      console.error("GIF export failed:", err);
      toast({ message: "GIF export failed. Please try again.", type: "error" });
    } finally {
      setGifExporting(false);
      setGifProgress(0);
    }
  }, [animationData, gifExporting, sanitizedName, toast]);

  const handleExportApng = useCallback(async (e: MouseEvent) => {
    e.preventDefault();
    if (!animationData || apngExporting) return;
    setApngExporting(true);
    setApngProgress(0);
    try {
      const { exportToApng } = await import("@/lib/apngExporter");
      const blob = await exportToApng({
        animationData,
        onProgress: setApngProgress,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizedName()}.apng`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("APNG export failed:", err);
      toast({ message: "APNG export failed. Please try again.", type: "error" });
    } finally {
      setApngExporting(false);
      setApngProgress(0);
    }
  }, [animationData, apngExporting, sanitizedName, toast]);

  const handleExportVideo = useCallback(async (e: MouseEvent) => {
    e.preventDefault();
    if (!animationData || videoExporting) return;
    setVideoExporting(true);
    setVideoProgress(0);
    try {
      const { exportToVideo, getVideoExtension } = await import("@/lib/videoExporter");
      const blob = await exportToVideo({
        animationData,
        onProgress: setVideoProgress,
      });
      const ext = getVideoExtension();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizedName()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ message: "Video exported successfully!", type: "success" });
    } catch (err) {
      console.error("Video export failed:", err);
      toast({ message: "Video export failed. Please try again.", type: "error" });
    } finally {
      setVideoExporting(false);
      setVideoProgress(0);
    }
  }, [animationData, videoExporting, sanitizedName, toast]);

  const handleExportMp4 = useCallback(async (e: MouseEvent) => {
    e.preventDefault();
    if (!animationData || mp4Exporting) return;
    setMp4Exporting(true);
    setMp4Progress(0);
    try {
      const { exportToMp4, isMP4ExportSupported, formatFileSize } = await import("@/lib/mp4Exporter");
      if (!isMP4ExportSupported()) {
        toast({ message: "MP4 export requires Chrome 94+ or Edge 94+ (WebCodecs API).", type: "error" });
        return;
      }
      const blob = await exportToMp4({
        animationData,
        onProgress: setMp4Progress,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizedName()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ message: `MP4 exported (${formatFileSize(blob.size)})`, type: "success" });
    } catch (err) {
      console.error("MP4 export failed:", err);
      const message = err instanceof Error ? err.message : "MP4 export failed. Please try again.";
      toast({ message, type: "error" });
    } finally {
      setMp4Exporting(false);
      setMp4Progress(0);
    }
  }, [animationData, mp4Exporting, sanitizedName, toast]);

  const handleExportPreset = useCallback(async (preset: ExportPreset) => {
    if (!animationData || presetExporting) return;
    setPresetExporting(true);
    setPresetProgress(0);
    setPresetExportingId(preset.id);
    try {
      const { animationData: rescaledData } = rescaleForExport(animationData, {
        targetWidth: preset.width,
        targetHeight: preset.height,
        fit: "contain",
      });

      let blob: Blob;
      const onProgress = (p: number) => setPresetProgress(p);

      if (preset.format === "json") {
        const json = JSON.stringify(rescaledData, null, 2);
        blob = new Blob([json], { type: "application/json" });
      } else if (preset.format === "dotlottie") {
        const { exportDotLottie } = await import("@/lib/dotlottieExporter");
        blob = await exportDotLottie(rescaledData, name || "animation");
      } else if (preset.format === "gif") {
        const { exportToGif } = await import("@/lib/gifExporter");
        if (preset.maxFileSize) {
          blob = await exportWithSizeLimit(rescaledData, preset.maxFileSize, onProgress);
        } else {
          blob = await exportToGif({ animationData: rescaledData, onProgress });
        }
      } else if (preset.format === "mp4") {
        const { exportToMp4, isMP4ExportSupported } = await import("@/lib/mp4Exporter");
        if (!isMP4ExportSupported()) {
          toast({ message: "MP4 export requires Chrome 94+ or Edge 94+ (WebCodecs API).", type: "error" });
          return;
        }
        blob = await exportToMp4({ animationData: rescaledData, onProgress });
      } else if (preset.format === "apng") {
        const { exportToApng } = await import("@/lib/apngExporter");
        blob = await exportToApng({ animationData: rescaledData, onProgress });
      } else if (preset.format === "tgs") {
        const { exportToTgs } = await import("@/lib/tgsExporter");
        const result = await exportToTgs(rescaledData);
        if (result.warnings.length > 0) {
          toast({ message: result.warnings.join(". "), type: "info" });
        }
        blob = result.blob;
      } else {
        const { exportToApng } = await import("@/lib/apngExporter");
        blob = await exportToApng({ animationData: rescaledData, onProgress });
      }

      const url = URL.createObjectURL(blob);
      const filename = getPresetFilename(name, preset);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Preset export failed:", err);
      toast({ message: `Export failed for ${preset.platform}. Please try again.`, type: "error" });
    } finally {
      setPresetExporting(false);
      setPresetProgress(0);
      setPresetExportingId(null);
    }
  }, [animationData, presetExporting, name, toast]);

  return {
    gifExporting,
    gifProgress,
    apngExporting,
    apngProgress,
    videoExporting,
    videoProgress,
    mp4Exporting,
    mp4Progress,
    presetExporting,
    presetProgress,
    presetExportingId,
    handleExport,
    handleExportDotLottie,
    handleExportGif,
    handleExportApng,
    handleExportVideo,
    handleExportMp4,
    handleExportPreset,
  };
}
