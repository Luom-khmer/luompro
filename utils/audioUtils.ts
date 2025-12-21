
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function stitchAudioBuffers(
  clips: { buffer: AudioBuffer; startTime: number }[],
  totalDuration: number,
  audioContext: AudioContext
): AudioBuffer {
  const sampleRate = 24000;
  const numberOfChannels = 1;
  const totalLengthInFrames = Math.ceil(totalDuration * sampleRate);
  
  const finalBuffer = audioContext.createBuffer(
    numberOfChannels,
    totalLengthInFrames,
    sampleRate
  );

  for (const clip of clips) {
    const offsetInFrames = Math.floor(clip.startTime * sampleRate);
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = finalBuffer.getChannelData(channel);
      // Ensure we don't write past the end of the buffer
      if (offsetInFrames + clip.buffer.length <= channelData.length) {
          channelData.set(clip.buffer.getChannelData(channel), offsetInFrames);
      } else {
          console.warn("Audio clip exceeds total duration, trimming.");
          const partialClipData = clip.buffer.getChannelData(channel).slice(0, channelData.length - offsetInFrames);
          channelData.set(partialClipData, offsetInFrames);
      }
    }
  }

  return finalBuffer;
}


function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array): void {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

export function pcmToWavBlob(pcmData: Float32Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const dataSize = pcmData.length * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    floatTo16BitPCM(view, 44, pcmData);

    return new Blob([view], { type: 'audio/wav' });
}