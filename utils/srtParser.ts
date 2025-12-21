
import { SrtEntry } from '../types';

const timecodeToSeconds = (timecode: string): number => {
  const parts = timecode.split(/[:,]/);
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  const milliseconds = parseInt(parts[3], 10);
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
};

export const parseSrtContent = (srtContent: string): SrtEntry[] => {
  const entries: SrtEntry[] = [];
  // Normalize line endings and split into blocks
  const blocks = srtContent.replace(/\r/g, '').split('\n\n');

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const id = parseInt(lines[0], 10);
    const timeParts = lines[1].split(' --> ');
    
    if (isNaN(id) || timeParts.length !== 2) continue;

    const startTime = timecodeToSeconds(timeParts[0]);
    const endTime = timecodeToSeconds(timeParts[1]);
    const text = lines.slice(2).join('\n').replace(/<[^>]*>?/gm, ''); // Clean HTML-like tags

    entries.push({ id, startTime, endTime, text });
  }

  return entries;
};