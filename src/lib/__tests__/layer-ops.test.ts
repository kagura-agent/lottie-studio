import { describe, it, expect } from "vitest";
import { listLayers, duplicateLayer, deleteLayer, renameLayer } from "../layer-ops";

// Helper: minimal Lottie animation with layers
function makeAnimation(layers: object[] = []): object {
  return {
    v: "5.7.1",
    fr: 30,
    ip: 0,
    op: 60,
    w: 512,
    h: 512,
    layers,
    assets: [],
  };
}

function shapeLayer(name: string, ind: number, opts: Record<string, unknown> = {}): object {
  return {
    nm: name,
    ty: 4, // shape
    ind,
    ip: 0,
    op: 60,
    ks: {
      p: { a: 0, k: [100, 200, 0] },
      s: { a: 0, k: [100, 100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      a: { a: 0, k: [0, 0, 0] },
    },
    ...opts,
  };
}

function textLayer(name: string, ind: number): object {
  return {
    nm: name,
    ty: 5, // text
    ind,
    ip: 0,
    op: 60,
    ks: {
      p: { a: 0, k: [50, 50] },
    },
  };
}

function nullLayer(name: string, ind: number): object {
  return {
    nm: name,
    ty: 3, // null
    ind,
    ip: 10,
    op: 50,
    ks: {},
  };
}

describe("listLayers", () => {
  it("returns empty array for animation with no layers", () => {
    expect(listLayers(makeAnimation())).toEqual([]);
  });

  it("returns empty array for animation without layers property", () => {
    expect(listLayers({ v: "5.7.1" })).toEqual([]);
  });

  it("lists layers with correct metadata", () => {
    const anim = makeAnimation([
      shapeLayer("Background", 1),
      textLayer("Title", 2),
      nullLayer("Controller", 3),
    ]);
    const result = listLayers(anim);
    expect(result).toHaveLength(3);

    expect(result[0]).toEqual({
      index: 1,
      name: "Background",
      type: 4,
      typeName: "shape",
      inPoint: 0,
      outPoint: 60,
      hidden: false,
    });

    expect(result[1]).toEqual({
      index: 2,
      name: "Title",
      type: 5,
      typeName: "text",
      inPoint: 0,
      outPoint: 60,
      hidden: false,
    });

    expect(result[2]).toEqual({
      index: 3,
      name: "Controller",
      type: 3,
      typeName: "null",
      inPoint: 10,
      outPoint: 50,
      hidden: false,
    });
  });

  it("reports hidden layers", () => {
    const anim = makeAnimation([
      shapeLayer("Hidden", 1, { hd: true }),
    ]);
    const result = listLayers(anim);
    expect(result[0].hidden).toBe(true);
  });

  it("reports parent references", () => {
    const anim = makeAnimation([
      nullLayer("Parent", 1),
      shapeLayer("Child", 2, { parent: 1 }),
    ]);
    const result = listLayers(anim);
    expect(result[0].parent).toBeUndefined();
    expect(result[1].parent).toBe(1);
  });

  it("handles unknown layer types", () => {
    const anim = makeAnimation([{ nm: "Weird", ty: 99, ind: 1, ip: 0, op: 30 }]);
    const result = listLayers(anim);
    expect(result[0].typeName).toBe("unknown");
  });
});

describe("duplicateLayer", () => {
  it("duplicates a layer with new ind and name suffix", () => {
    const anim = makeAnimation([shapeLayer("Circle", 1)]);
    const { animation, newLayerName } = duplicateLayer(anim, "Circle");

    expect(newLayerName).toBe("Circle (copy)");
    const layers = (animation as { layers: { nm: string; ind: number }[] }).layers;
    expect(layers).toHaveLength(2);
    expect(layers[0].nm).toBe("Circle");
    expect(layers[0].ind).toBe(1);
    expect(layers[1].nm).toBe("Circle (copy)");
    expect(layers[1].ind).toBe(2); // max(1) + 1
  });

  it("does not mutate the original animation", () => {
    const original = makeAnimation([shapeLayer("Circle", 1)]);
    const originalStr = JSON.stringify(original);
    duplicateLayer(original, "Circle");
    expect(JSON.stringify(original)).toBe(originalStr);
  });

  it("deep clones the layer", () => {
    const anim = makeAnimation([shapeLayer("Shape", 1)]);
    const { animation } = duplicateLayer(anim, "Shape");
    const layers = (animation as { layers: { ks: object }[] }).layers;

    // Verify they are different objects
    expect(layers[0].ks).not.toBe(layers[1].ks);
    expect(layers[0]).not.toBe(layers[1]);
  });

  it("offsets static position by [20, 20]", () => {
    const anim = makeAnimation([shapeLayer("Circle", 1)]);
    const { animation } = duplicateLayer(anim, "Circle");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layers = (animation as any).layers;
    // Original: [100, 200, 0]
    expect(layers[1].ks.p.k).toEqual([120, 220, 0]);
    // Original unchanged
    expect(layers[0].ks.p.k).toEqual([100, 200, 0]);
  });

  it("does not offset animated position", () => {
    const animatedPosLayer = {
      nm: "Moving",
      ty: 4,
      ind: 1,
      ip: 0,
      op: 60,
      ks: {
        p: {
          a: 1, // animated
          k: [
            { t: 0, s: [0, 0] },
            { t: 30, s: [100, 100] },
          ],
        },
      },
    };
    const anim = makeAnimation([animatedPosLayer]);
    const { animation } = duplicateLayer(anim, "Moving");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layers = (animation as any).layers;
    // Animated position should not be offset
    expect(layers[1].ks.p.k[0].s).toEqual([0, 0]);
    expect(layers[1].ks.p.k[1].s).toEqual([100, 100]);
  });

  it("uses case-insensitive matching", () => {
    const anim = makeAnimation([shapeLayer("MyLayer", 1)]);
    const { newLayerName } = duplicateLayer(anim, "mylayer");
    expect(newLayerName).toBe("MyLayer (copy)");
  });

  it("throws for non-existent layer", () => {
    const anim = makeAnimation([shapeLayer("Circle", 1)]);
    expect(() => duplicateLayer(anim, "NonExistent")).toThrow('Layer "NonExistent" not found');
  });

  it("throws for animation with no layers", () => {
    const anim = makeAnimation();
    expect(() => duplicateLayer(anim, "Anything")).toThrow('Layer "Anything" not found');
  });

  it("assigns correct ind when multiple layers exist", () => {
    const anim = makeAnimation([
      shapeLayer("A", 5),
      shapeLayer("B", 10),
      shapeLayer("C", 3),
    ]);
    const { animation } = duplicateLayer(anim, "B");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layers = (animation as any).layers;
    expect(layers).toHaveLength(4);
    // New ind should be max(5, 10, 3) + 1 = 11
    expect(layers[2].ind).toBe(11); // inserted after B at index 1, so now at index 2
    expect(layers[2].nm).toBe("B (copy)");
  });

  it("handles 2D position (no z component)", () => {
    const layer2d = {
      nm: "Flat",
      ty: 4,
      ind: 1,
      ip: 0,
      op: 60,
      ks: {
        p: { a: 0, k: [50, 75] },
      },
    };
    const anim = makeAnimation([layer2d]);
    const { animation } = duplicateLayer(anim, "Flat");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layers = (animation as any).layers;
    expect(layers[1].ks.p.k).toEqual([70, 95]);
  });
});

describe("deleteLayer", () => {
  it("removes the layer from the animation", () => {
    const anim = makeAnimation([
      shapeLayer("Keep", 1),
      shapeLayer("Remove", 2),
      shapeLayer("AlsoKeep", 3),
    ]);
    const result = deleteLayer(anim, "Remove");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layers = (result as any).layers;
    expect(layers).toHaveLength(2);
    expect(layers[0].nm).toBe("Keep");
    expect(layers[1].nm).toBe("AlsoKeep");
  });

  it("does not mutate the original", () => {
    const original = makeAnimation([shapeLayer("A", 1), shapeLayer("B", 2)]);
    const originalStr = JSON.stringify(original);
    deleteLayer(original, "A");
    expect(JSON.stringify(original)).toBe(originalStr);
  });

  it("cleans up parent references", () => {
    const anim = makeAnimation([
      nullLayer("Parent", 1),
      shapeLayer("Child1", 2, { parent: 1 }),
      shapeLayer("Child2", 3, { parent: 1 }),
      shapeLayer("Independent", 4),
    ]);
    const result = deleteLayer(anim, "Parent");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layers = (result as any).layers;
    expect(layers).toHaveLength(3);
    // Parent references should be cleaned up
    expect(layers[0].parent).toBeUndefined();
    expect(layers[1].parent).toBeUndefined();
    expect(layers[2].parent).toBeUndefined();
  });

  it("uses case-insensitive matching", () => {
    const anim = makeAnimation([shapeLayer("Background", 1)]);
    const result = deleteLayer(anim, "BACKGROUND");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).layers).toHaveLength(0);
  });

  it("throws for non-existent layer", () => {
    const anim = makeAnimation([shapeLayer("Exists", 1)]);
    expect(() => deleteLayer(anim, "Ghost")).toThrow('Layer "Ghost" not found');
  });

  it("throws for empty animation", () => {
    const anim = makeAnimation();
    expect(() => deleteLayer(anim, "Nothing")).toThrow('Layer "Nothing" not found');
  });

  it("preserves unrelated parent references", () => {
    const anim = makeAnimation([
      nullLayer("ParentA", 1),
      nullLayer("ParentB", 2),
      shapeLayer("ChildOfA", 3, { parent: 1 }),
      shapeLayer("ChildOfB", 4, { parent: 2 }),
    ]);
    // Delete ParentA — only children of A should lose parent
    const result = deleteLayer(anim, "ParentA");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layers = (result as any).layers;
    expect(layers).toHaveLength(3);
    expect(layers[1].parent).toBeUndefined(); // was child of A
    expect(layers[2].parent).toBe(2); // still child of B
  });
});

describe("renameLayer", () => {
  it("renames a layer", () => {
    const anim = makeAnimation([shapeLayer("OldName", 1)]);
    const result = renameLayer(anim, "OldName", "NewName");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).layers[0].nm).toBe("NewName");
  });

  it("does not mutate the original", () => {
    const original = makeAnimation([shapeLayer("Original", 1)]);
    const originalStr = JSON.stringify(original);
    renameLayer(original, "Original", "Changed");
    expect(JSON.stringify(original)).toBe(originalStr);
  });

  it("uses case-insensitive matching", () => {
    const anim = makeAnimation([shapeLayer("MyLayer", 1)]);
    const result = renameLayer(anim, "MYLAYER", "Renamed");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).layers[0].nm).toBe("Renamed");
  });

  it("throws for non-existent layer", () => {
    const anim = makeAnimation([shapeLayer("Exists", 1)]);
    expect(() => renameLayer(anim, "Ghost", "NewName")).toThrow('Layer "Ghost" not found');
  });

  it("throws for empty animation", () => {
    const anim = makeAnimation();
    expect(() => renameLayer(anim, "Nothing", "Something")).toThrow('Layer "Nothing" not found');
  });

  it("preserves other layers", () => {
    const anim = makeAnimation([
      shapeLayer("First", 1),
      shapeLayer("Second", 2),
      shapeLayer("Third", 3),
    ]);
    const result = renameLayer(anim, "Second", "Middle");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layers = (result as any).layers;
    expect(layers[0].nm).toBe("First");
    expect(layers[1].nm).toBe("Middle");
    expect(layers[2].nm).toBe("Third");
  });
});
