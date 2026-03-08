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

// Common speaker identifiers in chat exports
const SPEAKER_PATTERNS = [
  // KakaoTalk format: [Name] [Time]
  /^\[([^\]]+)\]\s*\[.*?\]/gm,
  // KakaoTalk date line
  /^-+\s*\d{4}년\s*\d{1,2}월\s*\d{1,2}일.*-+$/gm,
  // Common chat format: Name:
  /^([가-힣A-Za-z0-9_]+)\s*:\s*/gm,
  // Line format: Name (Time)
  /^([가-힣A-Za-z0-9_]+)\s*\(\d{1,2}:\d{2}\)/gm,
  // Timestamps
  /\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|오전|오후)?/gi,
  // Date formats
  /\d{4}[년./-]\d{1,2}[월./-]\d{1,2}[일]?/g,
];

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

/**
 * Analyze text with preprocessing
 */
export function analyzeTextContent(rawText: string) {
  // Step 1: Mask sensitive data first
  const maskedText = maskSensitiveData(rawText);
  
  // Step 2: Extract speakers before removing metadata
  const speakers = extractSpeakers(maskedText);
  
  // Step 3: Remove metadata for accurate counting
  const cleanedText = removeMetadata(maskedText);
  
  // Step 4: Count words (excluding empty strings)
  const words = cleanedText
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);
  
  const uniqueWords = new Set(words);
  
  return {
    maskedText,
    cleanedText,
    speakers,
    wordCount: words.length,
    uniqueWords: uniqueWords.size,
  };
}

/**
 * Split large text into chunks for processing
 */
export function splitIntoChunks(text: string, maxChunkSize: number = 8000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?。！？\n])\s*/);
  let currentChunk = "";
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += " " + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
