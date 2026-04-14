import { describe, it, expect } from "vitest";
import { APP_NAME, APP_DESCRIPTION, SUPPORT_EMAIL } from "./config";

describe("shared/config", () => {
  it("exports a non-empty APP_NAME", () => {
    expect(APP_NAME).toBeTypeOf("string");
    expect(APP_NAME.length).toBeGreaterThan(0);
  });

  it("exports a non-empty APP_DESCRIPTION", () => {
    expect(APP_DESCRIPTION).toBeTypeOf("string");
    expect(APP_DESCRIPTION.length).toBeGreaterThan(0);
  });

  it("exports a SUPPORT_EMAIL shaped like an email address", () => {
    expect(SUPPORT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
