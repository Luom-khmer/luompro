
import React from 'react';

interface TextAreaInputProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
}

// Increased to 1 Million characters to satisfy "Unlimited" request
const MAX_CHARS = 1000000;

const TextAreaInput: React.FC<TextAreaInputProps> = ({ value, onChange, disabled }) => (
  <div>
    <label htmlFor="text-input" className="block text-sm font-medium text-gray-400 mb-2">
      Nhập văn bản của bạn
    </label>
    <div className="relative">
      <textarea
        id="text-input"
        rows={8}
        className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg p-4 pb-6 text-gray-200 placeholder-gray-500 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed outline-none glowing-textarea"
        placeholder="Viết điều gì đó ở đây (Không giới hạn ký tự)..."
        value={value}
        onChange={onChange}
        disabled={disabled}
        maxLength={MAX_CHARS}
      />
      <span className="absolute bottom-2 right-3 text-xs font-medium text-gray-500 select-none">
        {value.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
      </span>
    </div>
  </div>
);

export default TextAreaInput;
