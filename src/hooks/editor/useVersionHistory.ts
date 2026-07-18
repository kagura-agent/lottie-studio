import { useState, useCallback } from "react";

export interface VersionHistoryState {
  versionPreviewData: object | null;
  previewingVersion: number | null;
  handleVersionPreview: (lottieJson: object, versionNum: number) => void;
  handleExitVersionPreview: () => void;
}

export function useVersionHistory(): VersionHistoryState {
  const [versionPreviewData, setVersionPreviewData] = useState<object | null>(null);
  const [previewingVersion, setPreviewingVersion] = useState<number | null>(null);

  const handleVersionPreview = useCallback((lottieJson: object, versionNum: number) => {
    setVersionPreviewData(lottieJson);
    setPreviewingVersion(versionNum);
  }, []);

  const handleExitVersionPreview = useCallback(() => {
    setVersionPreviewData(null);
    setPreviewingVersion(null);
  }, []);

  return {
    versionPreviewData,
    previewingVersion,
    handleVersionPreview,
    handleExitVersionPreview,
  };
}
