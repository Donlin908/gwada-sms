import { describe, it, expect } from "vitest";

const pricingPlans: Record<string, { durationHours: number }> = {
  daily: { durationHours: 24 },
  weekly: { durationHours: 24 * 7 },
  monthly: { durationHours: 24 * 30 },
};

function computeExpiry(planId: string, from: Date): Date {
  const plan = pricingPlans[planId];
  if (!plan) throw new Error(`Plan inconnu : ${planId}`);
  return new Date(from.getTime() + plan.durationHours * 60 * 60 * 1000);
}

describe("calcul d'expiration de réservation", () => {
  const base = new Date("2026-07-15T12:00:00.000Z");

  it("plan daily expire après exactement 24h", () => {
    const exp = computeExpiry("daily", base);
    const diffHours = (exp.getTime() - base.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBe(24);
  });

  it("plan weekly expire après exactement 168h (7 jours)", () => {
    const exp = computeExpiry("weekly", base);
    const diffHours = (exp.getTime() - base.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBe(168);
  });

  it("plan monthly expire après exactement 720h (30 jours)", () => {
    const exp = computeExpiry("monthly", base);
    const diffHours = (exp.getTime() - base.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBe(720);
  });

  it("l'expiration est toujours dans le futur par rapport à la date de base", () => {
    ["daily", "weekly", "monthly"].forEach(plan => {
      const exp = computeExpiry(plan, base);
      expect(exp.getTime()).toBeGreaterThan(base.getTime());
    });
  });

  it("lève une erreur pour un plan inexistant", () => {
    expect(() => computeExpiry("unknown", base)).toThrow("Plan inconnu");
  });
});
