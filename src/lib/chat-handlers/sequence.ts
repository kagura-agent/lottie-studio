import {
  db,
  createSequence,
  getSequence,
  listSequences,
  findSequencesByName,
  deleteSequence,
  addSequenceItem,
  updateSequenceItem,
} from "@/lib/db";
import { sequenceLayers } from "@/lib/sequence";
import { sendDoneEvent, readAnimationFile } from "./helpers";

type SequenceCommand =
  | { type: "sequence_create"; name: string }
  | { type: "sequence_add"; name?: string }
  | { type: "sequence_list" }
  | { type: "sequence_show"; name: string }
  | { type: "sequence_reorder"; name: string; positions: string }
  | { type: "sequence_delete"; name: string }
  | { type: "sequence_play"; name: string };

const CREATOR_ID = "default";

export function handleSequence(
  cmd: SequenceCommand,
  animationId: string | undefined,
  _message: string,
): Response {
  switch (cmd.type) {
    case "sequence_create":
      return handleCreate(cmd.name);
    case "sequence_add":
      return handleAdd(cmd.name, animationId);
    case "sequence_list":
      return handleList();
    case "sequence_show":
      return handleShow(cmd.name);
    case "sequence_reorder":
      return handleReorder(cmd.name, cmd.positions);
    case "sequence_delete":
      return handleDelete(cmd.name);
    case "sequence_play":
      return handlePlay(cmd.name);
  }
}

function handleCreate(name: string): Response {
  const existing = findSequencesByName(name);
  if (existing.length > 0) {
    return sendDoneEvent({ reply: `A sequence named "${name}" already exists.` });
  }
  const seq = createSequence(name, "", CREATOR_ID);
  return sendDoneEvent({ reply: `Created sequence "${seq.name}" (id: ${seq.id}).` });
}

function handleAdd(name: string | undefined, animationId: string | undefined): Response {
  if (!animationId) {
    return sendDoneEvent({ reply: "No current animation to add. Create or select an animation first." });
  }

  const animRow = db.prepare("SELECT id, name FROM animations WHERE id = ?").get(animationId) as { id: string; name: string } | undefined;
  if (!animRow) {
    return sendDoneEvent({ reply: "Current animation not found." });
  }

  let sequences = name ? findSequencesByName(name) : [];
  if (name && sequences.length === 0) {
    const created = createSequence(name, "", CREATOR_ID);
    const seq = getSequence(created.id);
    if (seq) sequences = [seq];
  }

  if (sequences.length === 0) {
    const all = listSequences(CREATOR_ID);
    if (all.length === 0) {
      return sendDoneEvent({ reply: "No sequences exist. Create one with `/sequence create <name>` first." });
    }
    return sendDoneEvent({ reply: `Please specify a sequence name: \`/sequence add <name>\`` });
  }

  const seq = sequences[0];
  addSequenceItem(seq.id, animationId);
  const updatedSeq = getSequence(seq.id);
  const count = updatedSeq?.items.length ?? 1;
  return sendDoneEvent({
    reply: `Added "${animRow.name}" to sequence "${seq.name}" (now ${count} step${count !== 1 ? "s" : ""}).`,
  });
}

function handleList(): Response {
  const seqs = listSequences(CREATOR_ID);
  if (seqs.length === 0) {
    return sendDoneEvent({ reply: "No sequences yet. Create one with `/sequence create <name>`." });
  }
  const lines = seqs.map((s, i) => `${i + 1}. **${s.name}** — ${s.item_count} step${s.item_count !== 1 ? "s" : ""}`);
  return sendDoneEvent({ reply: `**Your sequences:**\n${lines.join("\n")}` });
}

function handleShow(name: string): Response {
  const sequences = findSequencesByName(name);
  if (sequences.length === 0) {
    return sendDoneEvent({ reply: `No sequence named "${name}" found.` });
  }
  const seq = sequences[0];
  if (seq.items.length === 0) {
    return sendDoneEvent({ reply: `Sequence "${seq.name}" is empty. Add animations with \`/sequence add ${name}\`.` });
  }
  const lines = seq.items.map((item, i) =>
    `${i + 1}. ${item.animation_name || item.animation_id} (${item.duration_seconds?.toFixed(1) ?? "?"}s, transition: ${item.transition_type})`
  );
  return sendDoneEvent({ reply: `**${seq.name}** (${seq.items.length} steps):\n${lines.join("\n")}` });
}

function handleReorder(name: string, positions: string): Response {
  const sequences = findSequencesByName(name);
  if (sequences.length === 0) {
    return sendDoneEvent({ reply: `No sequence named "${name}" found.` });
  }
  const seq = sequences[0];
  if (seq.items.length === 0) {
    return sendDoneEvent({ reply: `Sequence "${seq.name}" is empty — nothing to reorder.` });
  }

  const newOrder = positions.split(",").map((s) => parseInt(s.trim(), 10));
  if (newOrder.some(isNaN) || newOrder.length !== seq.items.length) {
    return sendDoneEvent({
      reply: `Provide a comma-separated list of ${seq.items.length} positions (e.g. "2,1,3").`,
    });
  }

  for (let i = 0; i < newOrder.length; i++) {
    const idx = newOrder[i] - 1;
    if (idx < 0 || idx >= seq.items.length) {
      return sendDoneEvent({ reply: `Position ${newOrder[i]} is out of range (1–${seq.items.length}).` });
    }
    updateSequenceItem(seq.items[idx].id, { position: i });
  }

  return sendDoneEvent({ reply: `Reordered "${seq.name}" to: ${positions}.` });
}

function handleDelete(name: string): Response {
  const sequences = findSequencesByName(name);
  if (sequences.length === 0) {
    return sendDoneEvent({ reply: `No sequence named "${name}" found.` });
  }
  deleteSequence(sequences[0].id);
  return sendDoneEvent({ reply: `Deleted sequence "${name}".` });
}

function handlePlay(name: string): Response {
  const sequences = findSequencesByName(name);
  if (sequences.length === 0) {
    return sendDoneEvent({ reply: `No sequence named "${name}" found.` });
  }
  const seq = sequences[0];
  if (seq.items.length === 0) {
    return sendDoneEvent({ reply: `Sequence "${seq.name}" is empty — nothing to play.` });
  }

  let composed: object = { v: "5.7.1", fr: 30, ip: 0, op: 0, w: 512, h: 512, layers: [], assets: [] };

  for (const item of seq.items) {
    const animJson = readAnimationFile(item.animation_id);
    if (!animJson) {
      const label = item.animation_name || item.animation_id;
      return sendDoneEvent({ reply: `Cannot play — animation "${label}" has no JSON file.` });
    }
    composed = sequenceLayers(composed, animJson);
  }

  return sendDoneEvent({
    reply: `Playing sequence "${seq.name}" (${seq.items.length} steps composed end-to-end).`,
    lottieJson: composed,
  });
}
