import { describe, expect, it } from "vitest";
import { hashCsv } from "./hash.ts";

describe("hashCsv", () => {
  it("returns a 64-char lowercase hex string (SHA-256)", async () => {
    const h = await hashCsv("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches the canonical SHA-256 of 'hello'", async () => {
    // Pre-computed: echo -n 'hello' | shasum -a 256
    expect(await hashCsv("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("deterministic — same input gives same hash", async () => {
    const a = await hashCsv("Some flight CSV data");
    const b = await hashCsv("Some flight CSV data");
    expect(a).toBe(b);
  });

  it("different inputs give different hashes", async () => {
    expect(await hashCsv("a")).not.toBe(await hashCsv("b"));
  });

  it("handles empty string", async () => {
    // SHA-256("") known value
    expect(await hashCsv("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("handles UTF-8 multi-byte input", async () => {
    const h = await hashCsv("✈️ 🛩️");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    // Different from the ASCII version
    expect(h).not.toBe(await hashCsv("plane plane"));
  });
});
