import { describe, it, expect } from "vitest";

type StripePlanId = "daily" | "weekly" | "monthly";

const STRIPE_PRICE_IDS: Record<"test" | "live", Record<StripePlanId, string>> = {
  test: {
    daily: "price_1TiiPLCvUJHVsIHmUNNilUt9",
    weekly: "price_1TiiPMCvUJHVsIHmsIRfmq17",
    monthly: "price_1TiiPMCvUJHVsIHmJAzZZb4w",
  },
  live: {
    daily: "price_1TiiAtCi3VTHILCd4WGCDIeA",
    weekly: "price_1TiiAuCi3VTHILCdPw3P8Ktz",
    monthly: "price_1TiiAuCi3VTHILCdCVv9Hv8T",
  },
};

function getStripePriceId(planId: StripePlanId, isProduction: boolean): string {
  return STRIPE_PRICE_IDS[isProduction ? "live" : "test"][planId];
}

describe("getStripePriceId — dérivation des prix Stripe côté serveur", () => {
  it("retourne un price ID test en dev pour chaque plan", () => {
    expect(getStripePriceId("daily", false)).toMatch(/^price_/);
    expect(getStripePriceId("weekly", false)).toMatch(/^price_/);
    expect(getStripePriceId("monthly", false)).toMatch(/^price_/);
  });

  it("retourne un price ID live en prod pour chaque plan", () => {
    expect(getStripePriceId("daily", true)).toMatch(/^price_/);
    expect(getStripePriceId("weekly", true)).toMatch(/^price_/);
    expect(getStripePriceId("monthly", true)).toMatch(/^price_/);
  });

  it("les price IDs test et live sont différents", () => {
    expect(getStripePriceId("daily", false)).not.toBe(getStripePriceId("daily", true));
    expect(getStripePriceId("weekly", false)).not.toBe(getStripePriceId("weekly", true));
    expect(getStripePriceId("monthly", false)).not.toBe(getStripePriceId("monthly", true));
  });

  it("tous les plans ont des price IDs distincts", () => {
    const testIds = ["daily", "weekly", "monthly"].map(p => getStripePriceId(p as StripePlanId, false));
    const unique = new Set(testIds);
    expect(unique.size).toBe(3);
  });
});
