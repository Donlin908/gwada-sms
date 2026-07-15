import { describe, it, expect } from "vitest";

function readCap(caps: any, key: string): boolean {
  if (!caps) return false;
  return (
    caps[key] === true ||
    caps[key.toUpperCase()] === true ||
    caps[key.toLowerCase()] === true
  );
}

describe("readCap — lecture des capacités Twilio", () => {
  it("retourne true pour une clé en minuscule", () => {
    expect(readCap({ sms: true }, "sms")).toBe(true);
  });

  it("retourne true pour une clé en majuscule (Twilio renvoie parfois SMS)", () => {
    expect(readCap({ SMS: true }, "sms")).toBe(true);
  });

  it("retourne false si la capacité est absente", () => {
    expect(readCap({ voice: true }, "sms")).toBe(false);
  });

  it("retourne false si caps est null", () => {
    expect(readCap(null, "sms")).toBe(false);
  });

  it("retourne false si caps est undefined", () => {
    expect(readCap(undefined, "sms")).toBe(false);
  });

  it("retourne false si la valeur est false", () => {
    expect(readCap({ sms: false }, "sms")).toBe(false);
  });

  it("fonctionne aussi pour MMS et voice", () => {
    expect(readCap({ MMS: true, voice: true }, "mms")).toBe(true);
    expect(readCap({ MMS: true, voice: true }, "voice")).toBe(true);
  });
});
