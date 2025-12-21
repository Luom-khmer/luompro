
import React, { useRef } from 'react';
import { parseSrtContent } from '../utils/srtParser';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';

declare var mammoth: any;

interface SrtUploaderProps {
  onTextLoaded: (text: string) => void;
  disabled: boolean;
}

const SrtUploader: React.FC<SrtUploaderProps> = ({ onTextLoaded, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    try {
        if (fileName.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            onTextLoaded(result.value);
        } else if (fileName.endsWith('.txt')) {
             const text = await file.text();
             onTextLoaded(text);
        } else if (fileName.endsWith('.srt')) {
             const text = await file.text();
             try {
                const entries = parseSrtContent(text);
                const plainText = entries.map(e => e.text).join(' ');
                onTextLoaded(plainText);
             } catch (e) {
                 console.warn("SRT Parse failed, using raw text", e);
                 onTextLoaded(text);
             }
        } else {
            alert("Định dạng file không được hỗ trợ. Vui lòng chọn file .docx, .txt hoặc .srt");
        }
    } catch (error) {
        console.error("Failed to read file:", error);
        alert("Không thể đọc file.");
    }

    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-end">
      <label className="text-[10px] font-bold text-gray-500 uppercase mb-0.5 tracking-wider w-full text-right">
        NHẬP FILE
      </label>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".srt,.txt,.docx"
        className="hidden"
        disabled={disabled}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="h-[30px] flex items-center gap-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-gray-300 hover:text-white text-xs font-bold rounded transition-colors disabled:opacity-50 border border-zinc-700"
        title="Tải lên file Docx, Txt hoặc Srt"
      >
        <ArrowUpTrayIcon className="w-4 h-4" />
        <span>Tải lên</span>
      </button>
    </div>
  );
};

export default SrtUploader;
