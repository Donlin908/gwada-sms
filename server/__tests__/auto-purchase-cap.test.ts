/**
 * Tests unitaires du plafond journalier d'achat automatique.
 * Logique pure — aucune base de données, aucun provider.
 */
import { describe, it, expect } from "vitest";
import {
  parseDailyPurchaseData,
  isDailyCapReached,
  buildIncrementedDailyData,
} from "../number-monitor";

const TODAY = "2026-08-12";
const YESTERDAY = "2026-08-11";

// ── parseDailyPurchaseData ────────────────────────────────────────────────────

describe("parseDailyPurchaseData", () => {
  it("retourne date vide et count 0 si undefined", () => {
    expect(parseDailyPurchaseData(undefined)).toEqual({ date: "", count: 0 });
  });

  it("parse correctement un JSON valide", () => {
    expect(parseDailyPurchaseData('{"date":"2026-08-12","count":2}')).toEqual({
      date: "2026-08-12",
      count: 2,
    });
  });

  it("retourne valeurs par défaut si JSON invalide", () => {
    expect(parseDailyPurchaseData("not-json")).toEqual({ date: "", count: 0 });
  });
});

// ── isDailyCapReached ─────────────────────────────────────────────────────────

describe("isDailyCapReached", () => {
  it("retourne false si le compteur est inférieur au max", () => {
    expect(isDailyCapReached({ date: TODAY, count: 0 }, 1, TODAY)).toBe(false);
  });

  it("retourne true si le compteur atteint exactement le max", () => {
    expect(isDailyCapReached({ date: TODAY, count: 1 }, 1, TODAY)).toBe(true);
  });

  it("retourne true si le compteur dépasse le max", () => {
    expect(isDailyCapReached({ date: TODAY, count: 5 }, 1, TODAY)).toBe(true);
  });

  it("retourne false si la date est différente (nouveau jour → compteur réinitialisé)", () => {
    // Même si count=99, c'est hier — le cap ne s'applique pas
    expect(isDailyCapReached({ date: YESTERDAY, count: 99 }, 1, TODAY)).toBe(false);
  });

  it("retourne false si la date est vide (jamais d'achat)", () => {
    expect(isDailyCapReached({ date: "", count: 0 }, 1, TODAY)).toBe(false);
  });

  it("respecte un max configurable (ex: 3/jour)", () => {
    expect(isDailyCapReached({ date: TODAY, count: 2 }, 3, TODAY)).toBe(false);
    expect(isDailyCapReached({ date: TODAY, count: 3 }, 3, TODAY)).toBe(true);
  });
});

// ── buildIncrementedDailyData ─────────────────────────────────────────────────

describe("buildIncrementedDailyData", () => {
  it("commence à 1 si c'est un nouveau jour", () => {
    expect(buildIncrementedDailyData({ date: YESTERDAY, count: 5 }, TODAY)).toEqual({
      date: TODAY,
      count: 1,
    });
  });

  it("commence à 1 si aucune donnée (date vide)", () => {
    expect(buildIncrementedDailyData({ date: "", count: 0 }, TODAY)).toEqual({
      date: TODAY,
      count: 1,
    });
  });

  it("incrémente si c'est le même jour", () => {
    expect(buildIncrementedDailyData({ date: TODAY, count: 2 }, TODAY)).toEqual({
      date: TODAY,
      count: 3,
    });
  });

  it("incrémente correctement de 0 à 1 pour le premier achat du jour", () => {
    expect(buildIncrementedDailyData({ date: TODAY, count: 0 }, TODAY)).toEqual({
      date: TODAY,
      count: 1,
    });
  });
});

// ── Scénario bout en bout : le 2e achat est bloqué ───────────────────────────

describe("scénario : plafond journalier bloque le 2e achat", () => {
  it("le premier achat passe, le second est bloqué (max=1)", () => {
    const maxPerDay = 1;
    let data = parseDailyPurchaseData(undefined);

    // 1er achat
    expect(isDailyCapReached(data, maxPerDay, TODAY)).toBe(false);
    data = buildIncrementedDailyData(data, TODAY);
    expect(data).toEqual({ date: TODAY, count: 1 });

    // 2e achat → bloqué
    expect(isDailyCapReached(data, maxPerDay, TODAY)).toBe(true);
  });

  it("le lendemain le compteur repart de zéro", () => {
    const maxPerDay = 1;
    // Fin de journée : cap atteint
    let data = { date: TODAY, count: 1 };
    expect(isDailyCapReached(data, maxPerDay, TODAY)).toBe(true);

    // Lendemain : cap non atteint
    const TOMORROW = "2026-08-13";
    expect(isDailyCapReached(data, maxPerDay, TOMORROW)).toBe(false);

    // Achat du lendemain s'enregistre correctement
    data = buildIncrementedDailyData(data, TOMORROW);
    expect(data).toEqual({ date: TOMORROW, count: 1 });
  });
});
