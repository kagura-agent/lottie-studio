import { describe, it, expect } from "vitest";
import { handleExport } from "../export";

async function readSSEResponse(response: Response): Promise<string[]> {
  const text = await response.text();
  return text.split("\n\n").filter(Boolean).map(line => line.replace(/^data: /, ""));
}

describe("handleExport", () => {
  it("returns error when no animationId", async () => {
    const res = handleExport("gif", null);
    const text = await res.text();
    expect(text).toContain("Cannot export");
    expect(text).toContain("no animation is open");
  });

  it("returns streaming response with text and client_action for gif", async () => {
    const res = handleExport("gif", "anim-123");
    const events = await readSSEResponse(res);

    const textEvent = JSON.parse(events[0]);
    expect(textEvent.type).toBe("text");
    expect(textEvent.content).toContain("GIF");

    const actionEvent = JSON.parse(events[1]);
    expect(actionEvent.type).toBe("client_action");
    expect(actionEvent.action).toBe("export");
    expect(actionEvent.format).toBe("gif");

    const doneEvent = JSON.parse(events[2]);
    expect(doneEvent.type).toBe("done");
  });

  it("handles all export formats", async () => {
    const formats = ["gif", "apng", "video", "json", "dotlottie"] as const;
    for (const format of formats) {
      const res = handleExport(format, "anim-123");
      const events = await readSSEResponse(res);
      const actionEvent = JSON.parse(events[1]);
      expect(actionEvent.format).toBe(format);
    }
  });

  it("returns correct content-type header", () => {
    const res = handleExport("json", "anim-123");
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });
});
