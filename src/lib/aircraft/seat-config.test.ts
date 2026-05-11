import { beforeEach, describe, expect, it } from "vitest";
import { bootstrapTestData } from "../test-helpers.ts";
import { getSeatConfig } from "./seat-config.ts";

beforeEach(() => bootstrapTestData());

describe("getSeatConfig — exact ICAO hits", () => {
  it("returns the curated B789 config", () => {
    const r = getSeatConfig("B789");
    expect(r.source).toBe("exact");
    expect(r.config.body).toBe("wide");
    expect(r.config.J).toBe(28);
    expect(r.config.Y).toBe(262);
    expect(r.config.total).toBe(290);
  });

  it("returns narrow body for B738", () => {
    const r = getSeatConfig("B738");
    expect(r.source).toBe("exact");
    expect(r.config.body).toBe("narrow");
    expect(r.config.total).toBeGreaterThan(140);
    expect(r.config.total).toBeLessThan(200);
  });

  it("returns wide body for A359", () => {
    const r = getSeatConfig("A359");
    expect(r.source).toBe("exact");
    expect(r.config.body).toBe("wide");
  });

  it("uppercases ICAO codes", () => {
    expect(getSeatConfig("b789").source).toBe("exact");
  });
});

describe("getSeatConfig — default fallback", () => {
  it("returns the default for an unknown ICAO", () => {
    const r = getSeatConfig("XXXX");
    expect(r.source).toBe("default");
    expect(r.config.body).toBe("narrow");
    expect(r.config.total).toBe(50);
    expect(r.config.Y).toBe(50);
  });

  it("default config has zero premium classes", () => {
    const r = getSeatConfig("XXXX");
    expect(r.config.F).toBe(0);
    expect(r.config.J).toBe(0);
    expect(r.config.W).toBe(0);
  });
});

describe("config invariants", () => {
  it("every curated config has F + J + W + Y === total", () => {
    // Sample a handful of common ICAOs
    for (const icao of ["B789", "B788", "B738", "A320", "A321", "A359", "A388", "CRJ9", "E190"]) {
      const r = getSeatConfig(icao);
      const sum = r.config.F + r.config.J + r.config.W + r.config.Y;
      expect(sum).toBe(r.config.total);
    }
  });
});
