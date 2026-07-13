import { db, getAllPresets, getPresetByName, createPreset, deletePresetByName, renamePreset } from "@/lib/db";
import { sendDoneEvent } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handlePresetCommand(parsedCmd: any, animationId: string | undefined, request: Request): Response {
  if (parsedCmd.subcommand === "list") {
    const presets = getAllPresets();
    let reply: string;
    if (presets.length === 0) {
      reply = "No presets available yet. Use `/presets save <name>` after creating an animation to save the current motion as a preset.";
    } else {
      const lines = presets.map(
        (p) => `- **${p.name}**${p.description ? ` — ${p.description}` : ""}${p.is_builtin ? " _(built-in)_" : ""}`
      );
      reply = `Available presets:\n${lines.join("\n")}\n\nTo apply a preset, just say "apply bounce" or describe the style you want.`;
    }
    return sendDoneEvent({ reply, animationId: animationId || undefined });
  }

  if (typeof parsedCmd.subcommand === "object" && parsedCmd.subcommand.action === "save") {
    const presetName = parsedCmd.subcommand.name;
    const presetDescription = parsedCmd.subcommand.description || null;
    const creatorIdHeader = request.headers.get("x-creator-id") || undefined;

    let instructions: string | null = null;
    if (animationId) {
      const lastAssistant = db.prepare(
        "SELECT content FROM messages WHERE animation_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1"
      ).get(animationId) as { content: string } | undefined;
      if (lastAssistant) {
        instructions = lastAssistant.content;
      }
    }

    if (!instructions) {
      return sendDoneEvent({
        reply: "Cannot save preset — no previous assistant message found. Create an animation first, then save it as a preset.",
        animationId: animationId || undefined,
      });
    }

    try {
      createPreset(presetName, presetDescription, instructions, creatorIdHeader);
      return sendDoneEvent({
        reply: `Saved preset **"${presetName}"**. You can apply it anytime by saying "apply ${presetName}".`,
        animationId: animationId || undefined,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to save preset";
      const reply = errMsg.includes("UNIQUE constraint")
        ? `A preset named "${presetName}" already exists. Choose a different name.`
        : `Failed to save preset: ${errMsg}`;
      return sendDoneEvent({ reply, animationId: animationId || undefined });
    }
  }

  if (typeof parsedCmd.subcommand === "object" && parsedCmd.subcommand.action === "delete") {
    const presetName = parsedCmd.subcommand.name;
    const deleted = deletePresetByName(presetName);
    let reply: string;
    if (deleted) {
      reply = `Deleted preset **"${presetName}"**.`;
    } else {
      const exists = getPresetByName(presetName);
      if (exists && exists.is_builtin) {
        reply = `Cannot delete **"${presetName}"** — it's a built-in preset.`;
      } else {
        reply = `Preset **"${presetName}"** not found.`;
      }
    }
    return sendDoneEvent({ reply, animationId: animationId || undefined });
  }

  if (typeof parsedCmd.subcommand === "object" && parsedCmd.subcommand.action === "rename") {
    const { oldName, newName } = parsedCmd.subcommand;
    const renamed = renamePreset(oldName, newName);
    let reply: string;
    if (renamed) {
      reply = `Renamed preset **"${oldName}"** → **"${newName}"**.`;
    } else {
      const exists = getPresetByName(oldName);
      if (!exists) {
        reply = `Preset **"${oldName}"** not found.`;
      } else if (exists.is_builtin) {
        reply = `Cannot rename **"${oldName}"** — it's a built-in preset.`;
      } else {
        reply = `Cannot rename — a preset named **"${newName}"** already exists.`;
      }
    }
    return sendDoneEvent({ reply, animationId: animationId || undefined });
  }

  if (typeof parsedCmd.subcommand === "object" && parsedCmd.subcommand.action === "info") {
    const presetName = parsedCmd.subcommand.name;
    const preset = getPresetByName(presetName);
    let reply: string;
    if (!preset) {
      reply = `Preset **"${presetName}"** not found.`;
    } else {
      reply = `**${preset.name}**${preset.is_builtin ? " _(built-in)_" : ""}\n\n`;
      if (preset.description) reply += `${preset.description}\n\n`;
      reply += `**Instructions:** ${preset.instructions}\n\n`;
      reply += `**Created:** ${preset.created_at}`;
    }
    return sendDoneEvent({ reply, animationId: animationId || undefined });
  }

  return sendDoneEvent({ reply: "Unknown preset command.", animationId: animationId || undefined });
}
