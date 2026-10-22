import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "./id";

describe("newId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "secure-id" });

    expect(newId()).toBe("secure-id");
  });

  it("falls back when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});

    expect(newId()).toMatch(/^[a-z0-9]+-[a-z0-9]*$/);
  });
});
