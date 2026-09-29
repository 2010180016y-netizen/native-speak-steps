import { describe, it, expect } from "vitest";
import { pickPracticeCards, usesPhrase } from "./phrasePractice";

const card = (id: string, target_text: string) => ({ id, target_text, ease_factor: 2.5, interval_days: 1, review_count: 0 });

describe("usesPhrase", () => {
  it("matches whole words regardless of case and punctuation", () => {
    expect(usesPhrase("Can I get an iced latte, please?", "iced latte")).toBe(true);
    expect(usesPhrase("i'm running late!!", "I'm running late")).toBe(true);
  });

  it("does not match inside other words", () => {
    expect(usesPhrase("I like cats", "cat")).toBe(false);
    expect(usesPhrase("anything", "")).toBe(false);
  });
});

describe("pickPracticeCards", () => {
  it("keeps short, distinct phrases up to the limit", () => {
    const picked = pickPracticeCards([
      card("1", "iced latte"),
      card("2", "This sentence is far too long to be used as a quick phrase"),
      card("3", "Iced latte!"),
      card("4", "on my way"),
      card("5", "no worries"),
      card("6", "see you"),
    ]);
    expect(picked.map((c) => c.id)).toEqual(["1", "4", "5"]);
  });
});
