
import React, { useState } from 'react';
import { ErrorDetails } from '../types';
import ErrorMessage from './ErrorMessage';

interface TranslatorPanelProps {
  inputText: string;
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  outputText: string;
  isLoading: boolean;
  error: ErrorDetails | null;
  onTranslate: () => void;
}

const TranslatorPanel: React.FC<TranslatorPanelProps> = ({
  inputText,
  onInputChange,
  outputText,
  isLoading,
  error,
  onTranslate,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="bg-zinc-900 p-6 md:p-8 rounded-2xl shadow-2xl shadow-red-900/20 border border-zinc-800 h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-4">TienAdobe Dịch không giới hạn</h2>
      <p className="text-gray-400 mb-6 text-sm">Dịch thuật văn bản không giới hạn, nhanh chóng và chính xác.</p>
      
      <div className="flex-grow flex flex-col space-y-4">
        <textarea
          rows={8}
          className="w-full bg-zinc-800 border-2 border-zinc-700 rounded-lg p-4 text-gray-200 placeholder-gray-500 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed outline-none glowing-textarea"
          placeholder="Nhập văn bản cần dịch..."
          value={inputText}
          onChange={onInputChange}
          disabled={isLoading}
        />
        
        <button
          onClick={onTranslate}
          disabled={isLoading || !inputText.trim()}
          className="w-full flex justify-center items-center bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-red-600 focus:ring-opacity-50 transform hover:scale-105 disabled:scale-100"
        >
           {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Đang dịch...
            </>
          ) : (
            'Dịch sang Tiếng Việt'
          )}
        </button>

        <div className="mt-4 min-h-[150px] flex-grow">
            {error && <ErrorMessage errorDetails={error} />}
            {!isLoading && !error && (
                <div className="relative bg-zinc-800 border border-zinc-700 rounded-lg p-4 h-full min-h-[200px]">
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Kết quả dịch</h3>
                    {outputText ? (
                        <>
                            <button 
                                onClick={handleCopy}
                                className="absolute top-2 right-2 bg-zinc-700 text-gray-300 text-xs font-bold py-1 px-2 rounded-md hover:bg-zinc-600 transition-colors z-10"
                            >
                                {copied ? 'Đã sao chép!' : 'Sao chép'}
                            </button>
                            <pre className="text-gray-200 whitespace-pre-wrap font-sans text-sm h-full overflow-y-auto">
                                {outputText}
                            </pre>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                           <p>Bản dịch sẽ xuất hiện ở đây.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default TranslatorPanel;
