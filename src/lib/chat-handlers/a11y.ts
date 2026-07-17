import {
  sendDoneEvent,
  animationExists,
  readAnimationFile,
  saveUserMessage,
  saveAssistantMessage,
} from "./helpers";
import { analyzeAccessibility } from "@/lib/a11y";
import type { A11yResult } from "@/lib/a11y";

function formatReport(result: A11yResult): string {
  const statusIcon = result.status === "pass" ? "✅" : result.status === "warn" ? "⚠️" : "❌";
  let report = `## ${statusIcon} Accessibility Audit\n\n`;

  for (const check of result.checks) {
    const icon = check.status === "pass" ? "🟢" : check.status === "warn" ? "🟡" : "🔴";
    report += `${icon} **${check.label}**: ${check.detail}\n`;
    if (check.suggestion) {
      report += `   → ${check.suggestion}\n`;
    }
    report += "\n";
  }

  report += `**Motion Intensity Score**: ${result.motionScore}/100\n\n`;
  report += `**Auto-generated description**: "${result.description}"\n`;

  if (result.reducedMotion) {
    report += "\n---\n_A reduced-motion alternative is available. Ask me to apply it with \"apply reduced motion\"._";
  }

  return report;
}

export async function handleA11y(animationId: string | undefined, message: string): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then I can audit its accessibility." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const animJson = readAnimationFile(animationId);
  if (!animJson) {
    return sendDoneEvent({ reply: "No animation file found. Create an animation first." });
  }

  const result = analyzeAccessibility(animJson as Record<string, unknown>);
  const reply = formatReport(result);

  saveUserMessage(animationId, message);
  saveAssistantMessage(animationId, reply);

  return sendDoneEvent({ reply, animationId });
}
