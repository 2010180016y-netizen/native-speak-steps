import { describe, it, expect } from "vitest";
import { getDisplayNameError, DISPLAY_NAME_MAX_LENGTH } from "./displayName";

describe("getDisplayNameError", () => {
  it("accepts a normal nickname", () => {
    expect(getDisplayNameError("  언어천재 ")).toBeNull();
  });

  it("rejects blank names", () => {
    expect(getDisplayNameError("   ")).not.toBeNull();
  });

  it("rejects email addresses and any '@'", () => {
    expect(getDisplayNameError("someone@example.com")).not.toBeNull();
    expect(getDisplayNameError("me@home")).not.toBeNull();
  });

  it("enforces the max length in characters", () => {
    expect(getDisplayNameError("가".repeat(DISPLAY_NAME_MAX_LENGTH))).toBeNull();
    expect(getDisplayNameError("가".repeat(DISPLAY_NAME_MAX_LENGTH + 1))).not.toBeNull();
  });
});
