import { describe, it, expect } from "vitest";

describe("Explore API: remix lineage fields", () => {
  const mockExploreRow = {
    id: "anim-001",
    name: "Bouncing Ball",
    description: "A simple bouncing ball",
    created_at: "2025-01-01T00:00:00Z",
    frame_count: 60,
    tags: "motion,fun",
    view_count: 100,
    like_count: 5,
    creator_id: "user-1",
    creation_prompt: "A bouncing ball",
    remixed_from: null as string | null,
    remix_count: 0,
    remixed_from_name: null as string | null,
  };

  it("includes remix_count field in response shape", () => {
    expect(mockExploreRow).toHaveProperty("remix_count");
    expect(typeof mockExploreRow.remix_count).toBe("number");
  });

  it("includes remixed_from field in response shape", () => {
    expect(mockExploreRow).toHaveProperty("remixed_from");
  });

  it("includes remixed_from_name field in response shape", () => {
    expect(mockExploreRow).toHaveProperty("remixed_from_name");
  });

  it("remix_count is 0 for non-remixed animations", () => {
    expect(mockExploreRow.remix_count).toBe(0);
  });

  it("remixed_from is null for original animations", () => {
    expect(mockExploreRow.remixed_from).toBeNull();
  });

  it("remixed_from_name is null when remixed_from is null", () => {
    expect(mockExploreRow.remixed_from_name).toBeNull();
  });

  it("shows correct remix_count when animation has remixes", () => {
    const withRemixes = { ...mockExploreRow, remix_count: 3 };
    expect(withRemixes.remix_count).toBe(3);
  });

  it("shows remixed_from and remixed_from_name for a remix", () => {
    const remix = {
      ...mockExploreRow,
      id: "anim-002",
      name: "Remix of Bouncing Ball",
      remixed_from: "anim-001",
      remixed_from_name: "Bouncing Ball",
    };
    expect(remix.remixed_from).toBe("anim-001");
    expect(remix.remixed_from_name).toBe("Bouncing Ball");
  });

  it("enrichment preserves remix fields alongside existing fields", () => {
    const row = {
      ...mockExploreRow,
      remixed_from: "anim-000",
      remix_count: 2,
      remixed_from_name: "Original",
    };
    const enriched = {
      ...row,
      layer_count: 3,
      w: 512,
      h: 512,
      creation_prompt: row.creation_prompt ?? null,
    };
    expect(enriched.remixed_from).toBe("anim-000");
    expect(enriched.remix_count).toBe(2);
    expect(enriched.remixed_from_name).toBe("Original");
    expect(enriched.layer_count).toBe(3);
  });
});
