
import React from 'react';
import { VoiceOption } from '../types';

interface VoiceSelectorProps {
  voices: VoiceOption[];
  selectedValue: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled: boolean;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ voices, selectedValue, onChange, disabled }) => (
  <div>
    <label htmlFor="voice-selector" className="block text-sm font-medium text-gray-400 mb-2">
      Chọn giọng đọc
    </label>
    <select
      id="voice-selector"
      className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-red-600 focus:border-red-600 transition duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
      value={selectedValue}
      onChange={onChange}
      disabled={disabled}
    >
      {voices.map((voice) => (
        <option key={voice.id} value={voice.id}>
          {voice.name}
        </option>
      ))}
    </select>
  </div>
);

export default VoiceSelector;
