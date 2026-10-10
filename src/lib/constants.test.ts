import { describe, expect, it } from "vitest";
import { nativeLanguageForAi, targetLanguageForAi, targetSpeechLang } from "./constants";

describe("target language helpers", () => {
  it("follow the chosen English variety", () => {
    const british = { native_language: "ko", target_language: "en", target_variety: "en-GB" };
    expect(targetLanguageForAi(british)).toBe("British English");
    expect(targetSpeechLang(british)).toBe("en-GB");
  });

  it("default English to American", () => {
    const english = { target_language: "en", target_variety: null };
    expect(targetLanguageForAi(english)).toBe("American English");
    expect(targetSpeechLang(english)).toBe("en-US");
    expect(targetLanguageForAi(null)).toBe("American English");
    expect(targetSpeechLang(undefined)).toBe("en-US");
  });

  it("ignore the variety for other languages", () => {
    const japanese = { native_language: "ko", target_language: "ja", target_variety: "en-GB" };
    expect(targetLanguageForAi(japanese)).toBe("Japanese");
    expect(targetSpeechLang(japanese)).toBe("ja-JP");
    expect(nativeLanguageForAi(japanese)).toBe("Korean");
  });
});
