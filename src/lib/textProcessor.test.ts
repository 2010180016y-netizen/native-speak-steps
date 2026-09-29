import { afterAll, beforeEach, describe, it, expect } from "vitest";
import { analyzeTextContent, computeTextStats, countedWords } from "./textProcessor";

const nativeSegmenter = Intl.Segmenter;
const setSegmenter = (value: typeof Intl.Segmenter | undefined) =>
  Object.defineProperty(Intl, "Segmenter", { value, configurable: true, writable: true });
afterAll(() => setSegmenter(nativeSegmenter));

// The same expectations must hold with Intl.Segmenter and without it (Firefox before 125).
describe.each([
  ["with Intl.Segmenter", true],
  ["without Intl.Segmenter", false],
])("text analysis %s", (_name, native) => {
  beforeEach(() => {
    setSegmenter(native ? nativeSegmenter : undefined);
    expect(typeof Intl.Segmenter).toBe(native ? "function" : "undefined");
  });

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

    it("keeps Latin words whole and separates Hangul, digits and hyphenated parts", () => {
      expect(countedWords("Don't stop, well-known iPhone을 2026년 U.S.A snake_case", "en")).toEqual([
        "don't", "stop", "well", "known", "iphone", "을", "년", "u.s.a", "snake_case",
      ]);
      expect(countedWords("안녕하세요.반갑습니다 삼성전자Galaxy", "ko")).toEqual(["안녕하세요", "반갑습니다", "삼성전자", "galaxy"]);
    });

    it("counts sentences by terminators and line breaks", () => {
      const count = (text: string, locale = "en") => computeTextStats(text, locale).totalSentences;
      expect(count("Hello there. How are you? Fine!")).toBe(3);
      expect(count("오늘 뭐 해\n집에 있어\r\n너는?", "ko")).toBe(3);
      expect(count("응. 알겠어. 내일 봐", "ko")).toBe(3);
      expect(count("그래.알겠어", "ko")).toBe(2);
      expect(count("Really?yes")).toBe(2);
      expect(count('He said "Go." Then he left.')).toBe(2);
    });

    it("does not end a sentence at a decimal point, an ellipsis or a period before a lowercase word", () => {
      const count = (text: string) => computeTextStats(text, "en").totalSentences;
      expect(count("It costs 3.5 dollars today.")).toBe(1);
      expect(count("wait… what")).toBe(1);
      expect(count("ok. see you")).toBe(1);
      expect(count("Ok. See you")).toBe(2);
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
});

describe("without Intl.Segmenter", () => {
  beforeEach(() => setSegmenter(undefined));

  it("splits Japanese and Chinese by script instead of returning whole sentences", () => {
    expect(countedWords("今日は天気です", "ja")).toEqual(["今", "日", "は", "天", "気", "です"]);
    expect(countedWords("コーヒーを飲む", "ja")).toEqual(["コーヒー", "を", "飲", "む"]);
    expect(countedWords("我喜欢咖啡", "zh")).toEqual(["我", "喜", "欢", "咖", "啡"]);
  });

  it("does not glue Latin letters to CJK characters", () => {
    expect(countedWords("abc漢字def", "ja")).toEqual(["abc", "漢", "字", "def"]);
  });

  it("ends Japanese sentences at 。 without a space", () => {
    expect(computeTextStats("今日は天気です。明日は雨です。", "ja").totalSentences).toBe(2);
  });
});
