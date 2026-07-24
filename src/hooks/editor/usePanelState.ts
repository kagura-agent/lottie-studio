import { useState, useEffect } from "react";
import type { MobileTab } from "@/components/MobileTabBar";

export interface PanelState {
  rightPanel: "chat" | "json" | "layers";
  setRightPanel: (panel: "chat" | "json" | "layers") => void;
  versionPanelOpen: boolean;
  setVersionPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  shortcutsHelpOpen: boolean;
  setShortcutsHelpOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  fullscreenOpen: boolean;
  setFullscreenOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  embedOpen: boolean;
  setEmbedOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  submitTemplateOpen: boolean;
  setSubmitTemplateOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  presetDialogOpen: boolean;
  setPresetDialogOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  themePanelOpen: boolean;
  setThemePanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  shareChat: boolean;
  setShareChat: (open: boolean | ((prev: boolean) => boolean)) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  jsonSheetOpen: boolean;
  setJsonSheetOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  settingsSheetOpen: boolean;
  setSettingsSheetOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  mobileView: MobileTab;
  setMobileView: (view: MobileTab) => void;
}

export function usePanelState(menuRef: React.RefObject<HTMLDivElement | null>): PanelState {
  const [rightPanel, setRightPanel] = useState<"chat" | "json" | "layers">("chat");
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [submitTemplateOpen, setSubmitTemplateOpen] = useState(false);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [shareChat, setShareChat] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [jsonSheetOpen, setJsonSheetOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileTab>("chat");
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileMenuOpen, menuRef]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return {
    rightPanel,
    setRightPanel,
    versionPanelOpen,
    setVersionPanelOpen,
    shortcutsHelpOpen,
    setShortcutsHelpOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    fullscreenOpen,
    setFullscreenOpen,
    embedOpen,
    setEmbedOpen,
    submitTemplateOpen,
    setSubmitTemplateOpen,
    presetDialogOpen,
    setPresetDialogOpen,
    themePanelOpen,
    setThemePanelOpen,
    shareChat,
    setShareChat,
    mobileMenuOpen,
    setMobileMenuOpen,
    jsonSheetOpen,
    setJsonSheetOpen,
    settingsSheetOpen,
    setSettingsSheetOpen,
    mobileView,
    setMobileView,
  };
}
