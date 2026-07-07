import vm from "node:vm";

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024; // 2MB
const EXECUTION_TIMEOUT_MS = 5000;

export interface PluginExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

export function executePluginTransform(
  code: string,
  animationJson: unknown,
  config: Record<string, unknown> = {}
): PluginExecutionResult {
  const wrappedCode = `
    const transform = ${code};
    const __result = transform(__animationJson, __config);
    __result;
  `;

  const context = vm.createContext({
    __animationJson: JSON.parse(JSON.stringify(animationJson)),
    __config: JSON.parse(JSON.stringify(config)),
    JSON: {
      parse: JSON.parse,
      stringify: JSON.stringify,
    },
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Date,
    RegExp,
    Map,
    Set,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
  });

  try {
    const result = vm.runInContext(wrappedCode, context, {
      timeout: EXECUTION_TIMEOUT_MS,
      filename: "plugin-transform.js",
    });

    const serialized = JSON.stringify(result);
    if (serialized === undefined) {
      return { success: false, error: "Transform returned non-JSON-serializable value" };
    }

    if (Buffer.byteLength(serialized, "utf-8") > MAX_OUTPUT_BYTES) {
      return { success: false, error: `Output exceeds ${MAX_OUTPUT_BYTES / 1024 / 1024}MB limit` };
    }

    return { success: true, output: JSON.parse(serialized) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Script execution timed out")) {
      return { success: false, error: "Plugin execution timed out (5s limit)" };
    }
    return { success: false, error: message };
  }
}
