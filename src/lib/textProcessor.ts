// Text preprocessing utilities for privacy and accurate analysis

// Patterns for sensitive data
const PATTERNS = {
  // Korean phone numbers
  phoneKr: /01[0-9]-?\d{3,4}-?\d{4}/g,
  // International phone
  phoneIntl: /\+\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Korean resident registration number
  residentId: /\d{6}-?[1-4]\d{6}/g,
  // Credit card numbers
  creditCard: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,
  // IP addresses
  ip: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
  // Bank account numbers (Korean format)
  bankAccount: /\d{3,4}-?\d{2,4}-?\d{4,6}/g,
  // URLs with query params (may contain tokens)
  urlWithParams: /https?:\/\/[^\s]+\?[^\s]+/g,
};

/**
 * Mask sensitive personal information in text
 */
export function maskSensitiveData(text: string): string {
  let masked = text;
  
  // Mask phone numbers
  masked = masked.replace(PATTERNS.phoneKr, "[전화번호]");
  masked = masked.replace(PATTERNS.phoneIntl, "[전화번호]");
  
  // Mask emails
  masked = masked.replace(PATTERNS.email, "[이메일]");
  
  // Mask resident IDs
  masked = masked.replace(PATTERNS.residentId, "[주민번호]");
  
  // Mask credit cards
  masked = masked.replace(PATTERNS.creditCard, "[카드번호]");
  
  // Mask IPs
  masked = masked.replace(PATTERNS.ip, "[IP주소]");
  
  // Mask bank accounts
  masked = masked.replace(PATTERNS.bankAccount, "[계좌번호]");
  
  // Mask URLs with params
  masked = masked.replace(PATTERNS.urlWithParams, "[URL]");
  
  return masked;
}

/**
 * Extract speaker names from chat text
 * Also detects frequently repeated short words that are likely usernames
 */
export function extractSpeakers(text: string): string[] {
  const speakers = new Set<string>();
  
  // KakaoTalk format: [Name] [Time]
  const kakaoMatches = text.matchAll(/^\[([^\]]+)\]\s*\[/gm);
  for (const match of kakaoMatches) {
    if (match[1] && match[1].length < 30) {
      speakers.add(match[1].trim());
    }
  }
  
  // Common format: Name:
  const colonMatches = text.matchAll(/^([가-힣A-Za-z0-9_]{1,20})\s*:\s*/gm);
  for (const match of colonMatches) {
    if (match[1]) {
      speakers.add(match[1].trim());
    }
  }

  // Line/WhatsApp format: Name (Time) or [Time] Name:
  const lineMatches = text.matchAll(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*([가-힣A-Za-z0-9_ ]{1,20})\s*:/gm);
  for (const match of lineMatches) {
    if (match[1]) speakers.add(match[1].trim());
  }
  
  // Heuristic: detect frequently repeated short words at line starts (likely names)
  // Count words that appear at the beginning of lines
  const lineStartWords = new Map<string, number>();
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Get first word (1-20 chars, Korean or alphanumeric)
    const firstWordMatch = trimmed.match(/^([가-힣A-Za-z]{1,20})/);
    if (firstWordMatch) {
      const word = firstWordMatch[1];
      lineStartWords.set(word, (lineStartWords.get(word) || 0) + 1);
    }
  }
  
  // Words appearing at line starts more than 3% of total lines are likely speaker names
  const threshold = Math.max(3, lines.length * 0.03);
  for (const [word, count] of lineStartWords) {
    if (count >= threshold && word.length >= 2 && word.length <= 15) {
      speakers.add(word);
    }
  }
  
  return Array.from(speakers);
}

/**
 * Remove speaker names and metadata from text for accurate word counting
 */
export function removeMetadata(text: string): string {
  let cleaned = text;
  
  // Remove KakaoTalk format headers: [Name] [Time]
  cleaned = cleaned.replace(/^\[([^\]]+)\]\s*\[([^\]]*)\]\s*/gm, "");
  
  // Remove date lines
  cleaned = cleaned.replace(/^-+\s*\d{4}년\s*\d{1,2}월\s*\d{1,2}일.*-+$/gm, "");
  
  // Remove speaker prefixes: Name:
  cleaned = cleaned.replace(/^([가-힣A-Za-z0-9_]{1,20})\s*:\s*/gm, "");
  
  // Remove timestamps
  cleaned = cleaned.replace(/\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|오전|오후)?/gi, "");
  
  // Remove date formats
  cleaned = cleaned.replace(/\d{4}[년./-]\d{1,2}[월./-]\d{1,2}[일]?/g, "");
  
  // Remove mask placeholders from counting
  cleaned = cleaned.replace(/\[(전화번호|이메일|주민번호|카드번호|IP주소|계좌번호|URL)\]/g, "");
  
  return cleaned;
}

// Korean particles (조사), longest first. A one-letter particle is only stripped when at
// least two letters remain, so words like "사과" or "하나" stay intact.
// ponytail: suffix heuristic, still splits nouns such as "고양이"; use a morphological analyzer if accuracy matters.
const KO_PARTICLES = [
  "에서는", "에게서", "으로는", "이랑", "에서", "에게", "한테", "까지", "부터", "처럼", "보다", "으로",
  "은", "는", "이", "가", "을", "를", "에", "의", "도", "만", "로", "와", "과", "랑",
];

function stripParticle(word: string): string {
  if (!/^[가-힣]+$/.test(word)) return word;
  for (const particle of KO_PARTICLES) {
    const stem = word.slice(0, -particle.length);
    if (word.endsWith(particle) && stem.length >= (particle.length === 1 ? 2 : 1)) return stem;
  }
  return word;
}

/** Lowercased words of `text` as Intl.Segmenter splits them for `locale`; numbers and punctuation dropped. */
function wordTokens(text: string, locale: string): string[] {
  const tokens: string[] = [];
  for (const { segment, isWordLike } of new Intl.Segmenter(locale, { granularity: "word" }).segment(text)) {
    const token = segment.toLowerCase();
    if (isWordLike && /\p{L}/u.test(token)) tokens.push(token);
  }
  return tokens;
}

/** The words `text` is counted as in word frequencies: its tokens with Korean particles stripped. */
export const countedWords = (text: string, locale: string) => wordTokens(text, locale).map(stripParticle);

/**
 * Word statistics computed in code with Intl.Segmenter. The model never counts:
 * frequencies, bigrams and sentence stats all come from here.
 */
export function computeTextStats(text: string, locale: string, excludeWords: string[] = []) {
  const excluded = new Set(excludeWords.map((w) => w.toLowerCase()));
  const tokens = wordTokens(text, locale).filter((token) => !excluded.has(token));
  const words = tokens.map(stripParticle).filter((w) => !excluded.has(w));
  const countOf = (items: string[]) => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  };

  const wordCounts = countOf(words);
  const bigrams = tokens.slice(1).map((token, i) => `${tokens[i]} ${token}`);
  const sentences = [...new Intl.Segmenter(locale, { granularity: "sentence" }).segment(text)]
    .filter(({ segment }) => /\p{L}/u.test(segment)).length;
  const percent = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  return {
    wordCount: words.length,
    uniqueWords: wordCounts.length,
    wordFrequency: wordCounts.slice(0, 50).map(([word, count]) => ({ word, count, percentage: percent(count, words.length) })),
    topBigrams: countOf(bigrams).filter(([, count]) => count > 1).slice(0, 15).map(([phrase, count]) => ({ phrase, count })),
    totalSentences: sentences,
    avgSentenceLength: sentences > 0 ? Math.round((words.length / sentences) * 10) / 10 : 0,
    vocabularyRichness: percent(wordCounts.length, words.length),
  };
}

/**
 * Masks sensitive data, strips chat metadata and computes word statistics.
 */
export function analyzeTextContent(rawText: string, locale = "ko") {
  const maskedText = maskSensitiveData(rawText);
  const speakers = extractSpeakers(maskedText);
  const cleanedText = removeMetadata(maskedText);
  const stats = computeTextStats(cleanedText, locale, speakers);

  return {
    maskedText,
    cleanedText,
    speakers,
    wordCount: stats.wordCount,
    uniqueWords: stats.uniqueWords,
    stats,
  };
}
