import { describe, it, expect } from "vitest";
import { analyzeTextContent, computeTextStats } from "./textProcessor";

describe("computeTextStats", () => {
  it("counts words after stripping Korean particles", () => {
    const stats = computeTextStats("친구가 커피를 샀어. 친구는 커피가 좋대. 학교에서 친구를 만났어.", "ko");
    expect(stats.wordFrequency[0]).toEqual({ word: "친구", count: 3, percentage: 33.3 });
    expect(stats.wordFrequency.find((w) => w.word === "커피")?.count).toBe(2);
    expect(stats.wordFrequency.find((w) => w.word === "학교")?.count).toBe(1);
    expect(stats.totalSentences).toBe(3);
    expect(stats.wordCount).toBe(9);
  });

  it("keeps short words whose last letter only looks like a particle", () => {
    const words = computeTextStats("사과 하나 주세요", "ko").wordFrequency.map((w) => w.word);
    expect(words).toEqual(expect.arrayContaining(["사과", "하나"]));
  });

  it("excludes given words and ignores numbers and punctuation", () => {
    const stats = computeTextStats("민수 hello 123 !!! Hello", "en", ["민수"]);
    expect(stats.wordFrequency).toEqual([{ word: "hello", count: 2, percentage: 100 }]);
  });

  it("reports only bigrams that repeat", () => {
    const stats = computeTextStats("진짜 좋아 진짜 좋아 너무", "ko");
    expect(stats.topBigrams).toEqual([{ phrase: "진짜 좋아", count: 2 }]);
  });
});

describe("analyzeTextContent", () => {
  it("drops speaker names, timestamps and masked data before counting", () => {
    const chat = "민수: 내일 회의 몇 시야? 010-1234-5678\n지영: 회의는 10:30 오전이야\n민수: 회의 끝나고 밥 먹자";
    const result = analyzeTextContent(chat);
    const words = result.stats.wordFrequency.map((w) => w.word);
    expect(words[0]).toBe("회의");
    expect(words).not.toContain("민수");
    expect(words).not.toContain("지영");
    expect(words).not.toContain("전화번호");
    expect(result.maskedText).toContain("[전화번호]");
  });
});
