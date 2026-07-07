import { describe, it, expect } from "vitest";
import { executePluginTransform } from "@/lib/plugin-sandbox";
import { parseCommand } from "@/lib/commands";

// --- Pure helper functions extracted from plugin logic ---

interface Plugin {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  author_id: string;
  code: string;
  config_schema: string;
  category: string;
  downloads: number;
  created_at: string;
  updated_at: string;
}

interface PluginInstall {
  id: string;
  user_id: string;
  plugin_id: string;
  installed_at: string;
  enabled: number;
}

const VALID_CATEGORIES = ["transition", "effect", "generator", "modifier", "utility"];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function validateCreateInput(body: {
  name?: string;
  code?: string;
  category?: string;
}): string | null {
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return "name is required";
  }
  if (!body.code || typeof body.code !== "string") {
    return "code is required";
  }
  if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
    return `category must be one of: ${VALID_CATEGORIES.join(", ")}`;
  }
  const slug = slugify(body.name.trim());
  if (!slug) {
    return "name produces an invalid slug";
  }
  return null;
}

function buildPlugin(params: {
  name: string;
  code: string;
  category: string;
  author_id: string;
  description?: string;
  version?: string;
  config_schema?: unknown;
}): Plugin {
  return {
    id: `plugin-${Date.now()}`,
    name: params.name,
    slug: slugify(params.name),
    description: params.description || "",
    version: params.version || "1.0.0",
    author_id: params.author_id,
    code: params.code,
    config_schema: params.config_schema ? JSON.stringify(params.config_schema) : "{}",
    category: params.category,
    downloads: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function checkSlugUniqueness(plugins: Plugin[], slug: string): boolean {
  return !plugins.some((p) => p.slug === slug);
}

function installPlugin(
  installs: PluginInstall[],
  userId: string,
  pluginId: string
): { installs: PluginInstall[]; error?: string } {
  const existing = installs.find(
    (i) => i.user_id === userId && i.plugin_id === pluginId
  );
  if (existing) {
    return { installs, error: "Plugin already installed" };
  }
  return {
    installs: [
      ...installs,
      {
        id: `install-${Date.now()}`,
        user_id: userId,
        plugin_id: pluginId,
        installed_at: new Date().toISOString(),
        enabled: 1,
      },
    ],
  };
}

function uninstallPlugin(
  installs: PluginInstall[],
  userId: string,
  pluginId: string
): { installs: PluginInstall[]; removed: boolean } {
  const before = installs.length;
  const after = installs.filter(
    (i) => !(i.user_id === userId && i.plugin_id === pluginId)
  );
  return { installs: after, removed: after.length < before };
}

function incrementDownloads(plugins: Plugin[], pluginId: string): Plugin[] {
  return plugins.map((p) =>
    p.id === pluginId ? { ...p, downloads: p.downloads + 1 } : p
  );
}

function filterByCategory(plugins: Plugin[], category: string): Plugin[] {
  return plugins.filter((p) => p.category === category);
}

function searchPlugins(plugins: Plugin[], query: string): Plugin[] {
  const lower = query.toLowerCase();
  return plugins.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower)
  );
}

function getUserInstalledPlugins(
  plugins: Plugin[],
  installs: PluginInstall[],
  userId: string
): Plugin[] {
  const installedIds = new Set(
    installs.filter((i) => i.user_id === userId).map((i) => i.plugin_id)
  );
  return plugins.filter((p) => installedIds.has(p.id));
}

function validateConfigSchema(schemaStr: string): boolean {
  try {
    JSON.parse(schemaStr);
    return true;
  } catch {
    return false;
  }
}

// --- Tests ---

describe("Plugin CRUD", () => {
  it("creates a plugin with valid input", () => {
    const plugin = buildPlugin({
      name: "Fade Effect",
      code: "function transform(a, c) { return a; }",
      category: "effect",
      author_id: "user-1",
      description: "Adds a fade effect",
    });

    expect(plugin.name).toBe("Fade Effect");
    expect(plugin.slug).toBe("fade-effect");
    expect(plugin.category).toBe("effect");
    expect(plugin.downloads).toBe(0);
    expect(plugin.description).toBe("Adds a fade effect");
  });

  it("validates required fields", () => {
    expect(validateCreateInput({})).toBe("name is required");
    expect(validateCreateInput({ name: "test" })).toBe("code is required");
    expect(validateCreateInput({ name: "test", code: "fn" })).toContain("category");
    expect(
      validateCreateInput({ name: "test", code: "fn", category: "effect" })
    ).toBeNull();
  });

  it("rejects invalid categories", () => {
    const err = validateCreateInput({
      name: "test",
      code: "fn",
      category: "invalid",
    });
    expect(err).toContain("category must be one of");
  });

  it("lists plugins from a registry", () => {
    const plugins = [
      buildPlugin({ name: "A", code: "x", category: "effect", author_id: "u1" }),
      buildPlugin({ name: "B", code: "x", category: "transition", author_id: "u1" }),
      buildPlugin({ name: "C", code: "x", category: "effect", author_id: "u2" }),
    ];
    expect(plugins).toHaveLength(3);
  });

  it("updates plugin fields", () => {
    const plugin = buildPlugin({
      name: "My Plugin",
      code: "fn",
      category: "effect",
      author_id: "user-1",
    });

    const updated = {
      ...plugin,
      description: "Updated description",
      version: "2.0.0",
      updated_at: new Date().toISOString(),
    };

    expect(updated.description).toBe("Updated description");
    expect(updated.version).toBe("2.0.0");
    expect(updated.slug).toBe(plugin.slug);
  });
});

describe("Slug uniqueness", () => {
  it("detects duplicate slugs", () => {
    const plugins = [
      buildPlugin({ name: "My Plugin", code: "fn", category: "effect", author_id: "u1" }),
    ];

    expect(checkSlugUniqueness(plugins, "my-plugin")).toBe(false);
    expect(checkSlugUniqueness(plugins, "other-plugin")).toBe(true);
  });

  it("generates consistent slugs from names", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("  Trim Spaces  ")).toBe("trim-spaces");
    expect(slugify("Special!@#Characters")).toBe("special-characters");
    expect(slugify("multiple---dashes")).toBe("multiple-dashes");
  });

  it("handles edge case names", () => {
    expect(slugify("")).toBe("");
    expect(slugify("A")).toBe("a");
    expect(slugify("123")).toBe("123");
  });
});

describe("Plugin sandbox execution", () => {
  it("executes a simple transform", () => {
    const code = `function transform(animation, config) {
      animation.modified = true;
      return animation;
    }`;
    const result = executePluginTransform(code, { fr: 30, layers: [] });
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ fr: 30, layers: [], modified: true });
  });

  it("passes config to the transform", () => {
    const code = `function transform(animation, config) {
      animation.speed = config.speed;
      return animation;
    }`;
    const result = executePluginTransform(code, { fr: 30 }, { speed: 2 });
    expect(result.success).toBe(true);
    expect((result.output as Record<string, unknown>).speed).toBe(2);
  });

  it("handles transform errors gracefully", () => {
    const code = `function transform(animation, config) {
      throw new Error("Something broke");
    }`;
    const result = executePluginTransform(code, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("Something broke");
  });

  it("returns error for non-JSON-serializable output", () => {
    const code = `function transform(animation, config) {
      return undefined;
    }`;
    const result = executePluginTransform(code, {});
    expect(result.success).toBe(false);
  });
});

describe("Sandbox security", () => {
  it("blocks access to process", () => {
    const code = `function transform(a) {
      return { pid: process.pid };
    }`;
    const result = executePluginTransform(code, {});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("blocks access to require", () => {
    const code = `function transform(a) {
      const fs = require("fs");
      return a;
    }`;
    const result = executePluginTransform(code, {});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("blocks access to global", () => {
    const code = `function transform(a) {
      return { keys: Object.keys(globalThis) };
    }`;
    const result = executePluginTransform(code, {});
    expect(result.success).toBe(true);
    const output = result.output as Record<string, unknown>;
    const keys = output.keys as string[];
    expect(keys).not.toContain("process");
    expect(keys).not.toContain("require");
    expect(keys).not.toContain("fs");
  });

  it("does not allow fs access", () => {
    const code = `function transform(a) {
      const fs = require("fs");
      fs.readFileSync("/etc/passwd");
      return a;
    }`;
    const result = executePluginTransform(code, {});
    expect(result.success).toBe(false);
  });

  it("does not allow net access", () => {
    const code = `function transform(a) {
      const http = require("http");
      return a;
    }`;
    const result = executePluginTransform(code, {});
    expect(result.success).toBe(false);
  });
});

describe("Execution timeout", () => {
  it("times out long-running transforms", () => {
    const code = `function transform(a) {
      while(true) {}
      return a;
    }`;
    const result = executePluginTransform(code, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("timed out");
  }, 10000);
});

describe("Config schema validation", () => {
  it("accepts valid JSON schemas", () => {
    expect(validateConfigSchema("{}")).toBe(true);
    expect(
      validateConfigSchema(
        JSON.stringify({
          speed: { type: "number", default: 1 },
          color: { type: "string", default: "#fff" },
        })
      )
    ).toBe(true);
  });

  it("rejects invalid JSON", () => {
    expect(validateConfigSchema("{invalid}")).toBe(false);
    expect(validateConfigSchema("")).toBe(false);
  });

  it("stores config schema as JSON string in plugin", () => {
    const schema = { intensity: { type: "number", min: 0, max: 100 } };
    const plugin = buildPlugin({
      name: "Test",
      code: "fn",
      category: "effect",
      author_id: "u1",
      config_schema: schema,
    });
    expect(JSON.parse(plugin.config_schema)).toEqual(schema);
  });
});

describe("Install/uninstall flow", () => {
  const pluginId = "plugin-1";
  const userId = "user-1";

  it("installs a plugin for a user", () => {
    const result = installPlugin([], userId, pluginId);
    expect(result.error).toBeUndefined();
    expect(result.installs).toHaveLength(1);
    expect(result.installs[0].user_id).toBe(userId);
    expect(result.installs[0].plugin_id).toBe(pluginId);
    expect(result.installs[0].enabled).toBe(1);
  });

  it("prevents duplicate installs", () => {
    const first = installPlugin([], userId, pluginId);
    const second = installPlugin(first.installs, userId, pluginId);
    expect(second.error).toBe("Plugin already installed");
    expect(second.installs).toHaveLength(1);
  });

  it("allows different users to install the same plugin", () => {
    const first = installPlugin([], "user-1", pluginId);
    const second = installPlugin(first.installs, "user-2", pluginId);
    expect(second.error).toBeUndefined();
    expect(second.installs).toHaveLength(2);
  });

  it("uninstalls a plugin", () => {
    const installed = installPlugin([], userId, pluginId);
    const result = uninstallPlugin(installed.installs, userId, pluginId);
    expect(result.removed).toBe(true);
    expect(result.installs).toHaveLength(0);
  });

  it("returns false when uninstalling a plugin not installed", () => {
    const result = uninstallPlugin([], userId, pluginId);
    expect(result.removed).toBe(false);
  });
});

describe("Download count", () => {
  it("increments download count on install", () => {
    const plugins = [
      buildPlugin({ name: "P1", code: "fn", category: "effect", author_id: "u1" }),
    ];
    expect(plugins[0].downloads).toBe(0);

    const updated = incrementDownloads(plugins, plugins[0].id);
    expect(updated[0].downloads).toBe(1);

    const again = incrementDownloads(updated, plugins[0].id);
    expect(again[0].downloads).toBe(2);
  });

  it("only increments the target plugin", () => {
    const p1 = { ...buildPlugin({ name: "P1", code: "fn", category: "effect", author_id: "u1" }), id: "p-1" };
    const p2 = { ...buildPlugin({ name: "P2", code: "fn", category: "effect", author_id: "u1" }), id: "p-2" };
    const plugins = [p1, p2];
    const updated = incrementDownloads(plugins, "p-1");
    expect(updated[0].downloads).toBe(1);
    expect(updated[1].downloads).toBe(0);
  });
});

describe("Category filtering", () => {
  const plugins = [
    buildPlugin({ name: "A", code: "x", category: "effect", author_id: "u1" }),
    buildPlugin({ name: "B", code: "x", category: "transition", author_id: "u1" }),
    buildPlugin({ name: "C", code: "x", category: "effect", author_id: "u2" }),
    buildPlugin({ name: "D", code: "x", category: "generator", author_id: "u1" }),
    buildPlugin({ name: "E", code: "x", category: "modifier", author_id: "u1" }),
    buildPlugin({ name: "F", code: "x", category: "utility", author_id: "u1" }),
  ];

  it("filters by effect category", () => {
    const result = filterByCategory(plugins, "effect");
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.category === "effect")).toBe(true);
  });

  it("filters by transition category", () => {
    const result = filterByCategory(plugins, "transition");
    expect(result).toHaveLength(1);
  });

  it("returns empty for non-matching category", () => {
    const result = filterByCategory(plugins, "nonexistent");
    expect(result).toHaveLength(0);
  });

  it("covers all valid categories", () => {
    for (const cat of VALID_CATEGORIES) {
      const result = filterByCategory(plugins, cat);
      expect(result.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("Search functionality", () => {
  const plugins = [
    buildPlugin({
      name: "Glow Effect",
      code: "x",
      category: "effect",
      author_id: "u1",
      description: "Adds a glowing border",
    }),
    buildPlugin({
      name: "Slide Transition",
      code: "x",
      category: "transition",
      author_id: "u1",
      description: "Smooth sliding between scenes",
    }),
    buildPlugin({
      name: "Color Shifter",
      code: "x",
      category: "modifier",
      author_id: "u1",
      description: "Shifts hue of all colors",
    }),
  ];

  it("searches by name", () => {
    const result = searchPlugins(plugins, "glow");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Glow Effect");
  });

  it("searches by description", () => {
    const result = searchPlugins(plugins, "sliding");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Slide Transition");
  });

  it("is case-insensitive", () => {
    const result = searchPlugins(plugins, "GLOW");
    expect(result).toHaveLength(1);
  });

  it("returns all for empty query", () => {
    const result = searchPlugins(plugins, "");
    expect(result).toHaveLength(3);
  });

  it("returns empty for no matches", () => {
    const result = searchPlugins(plugins, "nonexistent");
    expect(result).toHaveLength(0);
  });

  it("matches partial terms across name and description", () => {
    const result = searchPlugins(plugins, "smooth");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Slide Transition");
  });
});

describe("User installed plugins", () => {
  it("returns only plugins installed by the user", () => {
    const plugins = [
      { ...buildPlugin({ name: "A", code: "x", category: "effect", author_id: "u1" }), id: "p1" },
      { ...buildPlugin({ name: "B", code: "x", category: "effect", author_id: "u1" }), id: "p2" },
      { ...buildPlugin({ name: "C", code: "x", category: "effect", author_id: "u1" }), id: "p3" },
    ];
    const installs: PluginInstall[] = [
      { id: "i1", user_id: "user-1", plugin_id: "p1", installed_at: "", enabled: 1 },
      { id: "i2", user_id: "user-1", plugin_id: "p3", installed_at: "", enabled: 1 },
      { id: "i3", user_id: "user-2", plugin_id: "p2", installed_at: "", enabled: 1 },
    ];

    const result = getUserInstalledPlugins(plugins, installs, "user-1");
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("returns empty when no plugins installed", () => {
    const plugins = [
      buildPlugin({ name: "A", code: "x", category: "effect", author_id: "u1" }),
    ];
    const result = getUserInstalledPlugins(plugins, [], "user-1");
    expect(result).toHaveLength(0);
  });
});

describe("Plugin commands", () => {
  it("parses /plugins command", () => {
    const cmd = parseCommand("/plugins");
    expect(cmd).toEqual({ type: "plugins_list" });
  });

  it("parses /plugin install <slug>", () => {
    const cmd = parseCommand("/plugin install glow-effect");
    expect(cmd).toEqual({ type: "plugin_install", slug: "glow-effect" });
  });

  it("parses /plugin remove <slug>", () => {
    const cmd = parseCommand("/plugin remove glow-effect");
    expect(cmd).toEqual({ type: "plugin_remove", slug: "glow-effect" });
  });

  it("parses /plugin uninstall as alias for remove", () => {
    const cmd = parseCommand("/plugin uninstall my-plugin");
    expect(cmd).toEqual({ type: "plugin_remove", slug: "my-plugin" });
  });

  it("returns error for /plugin with no subcommand", () => {
    const cmd = parseCommand("/plugin");
    expect(cmd).toEqual({
      type: "error",
      message: "Usage: /plugin install <slug> | /plugin remove <slug>",
    });
  });

  it("returns error for /plugin install with no slug", () => {
    const cmd = parseCommand("/plugin install");
    expect(cmd).toEqual({ type: "error", message: "Usage: /plugin install <slug>" });
  });

  it("returns error for unknown plugin subcommand", () => {
    const cmd = parseCommand("/plugin unknown");
    expect(cmd).not.toBeNull();
    expect(cmd!.type).toBe("error");
  });
});
