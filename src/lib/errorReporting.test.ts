import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn().mockResolvedValue({ error: null });
const getSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession }, from: () => ({ insert }) },
}));

describe("reportError", () => {
  beforeEach(() => {
    vi.resetModules();
    insert.mockClear();
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    window.history.pushState({}, "", "/reset-password?code=secret#access_token=secret");
  });

  it("stores the error without query string or hash", async () => {
    const { reportError } = await import("./errorReporting");
    await reportError(new Error("boom"));
    expect(insert).toHaveBeenCalledOnce();
    const row = insert.mock.calls[0][0];
    expect(row.message).toBe("boom");
    expect(row.url).toBe(`${window.location.origin}/reset-password`);
  });

  it("skips reporting when signed out", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { reportError } = await import("./errorReporting");
    await reportError("oops");
    expect(insert).not.toHaveBeenCalled();
  });

  it("caps reports per page", async () => {
    const { reportError } = await import("./errorReporting");
    for (let i = 0; i < 30; i++) await reportError(new Error(`e${i}`));
    expect(insert).toHaveBeenCalledTimes(20);
  });
});
