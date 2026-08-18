import { describe, expect, it } from "vitest";
import {
  boundaryBriefFilename,
  createBoundaryBriefMailto,
  createBoundaryBriefMarkdown,
  isContactEmail,
  type BoundaryBriefDraft,
  validateBoundaryBrief
} from "./boundary-brief";

const completeDraft = (): BoundaryBriefDraft => ({
  organisation: "Example Labs",
  stage: "Internal or sandbox workflow",
  action: "Provision approved inference capacity for a nightly evaluation run.",
  consequence: "Stop if the vendor is not approved or the action exceeds the hard ceiling.",
  humanLine: "Manual approval outside the product",
  executionContext: "OpenAI API through an internal procurement service.",
  usefulOutcome: "A reviewed mandate and synthetic authorization path the team can replay."
});

describe("boundary brief", () => {
  it("validates a complete exact-action brief", () => {
    expect(validateBoundaryBrief(completeDraft())).toEqual({});
  });

  it("fails closed when consequential fields are vague or missing", () => {
    const draft = completeDraft();
    draft.action = "Use AI";
    draft.consequence = "";
    draft.usefulOutcome = "";
    expect(validateBoundaryBrief(draft)).toMatchObject({
      action: expect.any(String),
      consequence: expect.any(String),
      usefulOutcome: expect.any(String)
    });
    expect(() => createBoundaryBriefMarkdown(draft)).toThrow("complete, valid");
  });

  it("creates a portable Markdown brief without uploading state", () => {
    const markdown = createBoundaryBriefMarkdown(completeDraft(), "2026-08-18T00:00:00.000Z");
    expect(markdown).toContain("# CAPYN private boundary brief");
    expect(markdown).toContain("boundary-brief/v1");
    expect(markdown).toContain("Example Labs");
    expect(markdown).toContain("Provision approved inference capacity");
    expect(boundaryBriefFilename(" Example Labs / AU ")).toBe("capyn-boundary-brief-example-labs-au.md");
  });

  it("accepts only bounded public contact addresses and encodes mail safely", () => {
    expect(isContactEmail("briefs@example.com")).toBe(true);
    expect(isContactEmail("bad\nbcc@example.com")).toBe(false);
    const href = createBoundaryBriefMailto("briefs@example.com", completeDraft());
    expect(href).toMatch(/^mailto:briefs@example\.com\?/);
    const params = new URLSearchParams(href.split("?", 2)[1]);
    expect(params.get("subject")).toBe("CAPYN boundary brief — Example Labs");
  });
});
