
import React from 'react';

interface GenerateButtonProps {
  onClick: () => void;
  isLoading: boolean;
  text?: string;
}

const GenerateButton: React.FC<GenerateButtonProps> = ({ onClick, isLoading, text }) => (
  <button
    onClick={onClick}
    disabled={isLoading}
    className="w-full flex justify-center items-center bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-red-600 focus:ring-opacity-50 transform hover:scale-105 disabled:scale-100"
  >
    {isLoading ? (
      <>
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Đang xử lý...
      </>
    ) : (
      text || 'Tạo âm thanh'
    )}
  </button>
);

export default GenerateButton;
