/**
 * Splits a long text into chunks suitable for TTS API limits (approx < 3000 chars).
 * Attempts to split by sentence endings to preserve natural flow, including Vietnamese punctuation.
 */
export const splitTextIntoChunks = (text: string, maxChunkLength: number = 2800): string[] => {
  if (text.length <= maxChunkLength) return [text];

  const chunks: string[] = [];
  let currentChunk = '';

  // Split by sentence delimiters (., !, ?, newline, ;, :) but keep them
  // Added support for common sentence breaks
  const sentences = text.match(/[^.!?\n;:]+[.!?\n;:]*/g) || [text];

  for (const sentence of sentences) {
    if ((currentChunk.length + sentence.length) > maxChunkLength) {
      if (currentChunk.trim()) chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  return chunks;
};