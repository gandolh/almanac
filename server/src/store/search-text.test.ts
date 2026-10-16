import { describe, expect, it } from "vitest";
import { eventSearchText, foldSearchText } from "./search-text.js";

describe("foldSearchText", () => {
  it("folds Romanian diacritics, comma and cedilla forms alike, and case", () => {
    expect(foldSearchText("Ședință")).toBe("sedinta");
    expect(foldSearchText("ȘEDINȚĂ")).toBe("sedinta");
    expect(foldSearchText("Şedinţă")).toBe("sedinta");
    expect(foldSearchText("Învățământ în Timișoara")).toBe("invatamant in timisoara");
  });

  it("folds a decomposed spelling the same as a composed one", () => {
    expect(foldSearchText("Ședință")).toBe(foldSearchText("Ședință"));
  });

  it("joins an event's fields one per line", () => {
    expect(eventSearchText({ title: "Café", location: "Piața Unirii", notes: "" })).toBe("cafe\npiata unirii\n");
  });
});
