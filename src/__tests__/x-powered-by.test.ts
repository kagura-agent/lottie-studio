import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

describe("X-Powered-By header", () => {
  it("is stripped from responses", async () => {
    const server = createServer((req, res) => {
      const origWriteHead = res.writeHead;
      res.writeHead = function (this: typeof res, ...args: Parameters<typeof origWriteHead>) {
        this.removeHeader("X-Powered-By");
        return origWriteHead.apply(this, args);
      } as typeof origWriteHead;

      res.setHeader("X-Powered-By", "Next.js");
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(res.headers.has("x-powered-by")).toBe(false);
      expect(await res.text()).toBe("ok");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
