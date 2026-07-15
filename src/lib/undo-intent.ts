export interface UndoIntent {
  isUndo: boolean;
  isRedo: boolean;
  steps?: number;
  namedRef?: string;
}

const UNDO_EXACT = [
  "undo", "revert", "go back", "undo that", "undo this", "undo it",
  "undo last change", "revert to previous", "undo last",
  "undo last edit", "undo last step", "undo last one",
  "undo please", "undo pls", "go back one step",
  "revert it", "revert that", "revert this",
  "撤销", "回退", "撤回", "取消上一步", "回到之前",
];

const REDO_EXACT = [
  "redo", "redo that", "go forward", "bring it back", "重做", "恢复",
];

const UNDO_N_RE = /^(?:undo|revert|go back|撤销|回退)\s+(?:last\s+)?(\d+)(?:\s+(?:changes?|steps?|edits?))?$/i;
const REDO_N_RE = /^(?:redo|go forward|重做)\s+(?:last\s+)?(\d+)(?:\s+(?:changes?|steps?|edits?))?$/i;

const NAMED_REF_RE = /^(?:go back|revert|undo)\s+(?:to\s+)?(?:before\s+(?:the\s+)?|until\s+(?:the\s+)?)(.+)$/i;

export function detectUndoIntent(message: string): UndoIntent | null {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;

  if (REDO_EXACT.includes(normalized)) {
    return { isUndo: false, isRedo: true };
  }

  const redoN = normalized.match(REDO_N_RE);
  if (redoN) {
    return { isUndo: false, isRedo: true, steps: parseInt(redoN[1], 10) };
  }

  if (UNDO_EXACT.includes(normalized)) {
    return { isUndo: true, isRedo: false };
  }

  const undoN = normalized.match(UNDO_N_RE);
  if (undoN) {
    return { isUndo: true, isRedo: false, steps: parseInt(undoN[1], 10) };
  }

  // Short messages starting with "go back"
  if (normalized.startsWith("go back") && normalized.split(/\s+/).length <= 5) {
    return { isUndo: true, isRedo: false };
  }

  // Named reference: "go back to before the shadow", "revert to before the bounce"
  const namedMatch = normalized.match(NAMED_REF_RE);
  if (namedMatch) {
    return { isUndo: true, isRedo: false, namedRef: namedMatch[1].trim() };
  }

  return null;
}
