
import React from 'react';

interface ProgressBarProps {
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const isComplete = progress >= 100;

  return (
    <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden border border-zinc-700">
      <div
        className={`h-full rounded-full bg-red-600 transition-all duration-500 ease-out ${isComplete ? 'neon-flash' : ''}`}
        style={{ width: `${Math.min(progress, 100)}%` }}
      ></div>
       <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-white mix-blend-difference">
                {Math.round(Math.min(progress, 100))}%
            </span>
        </div>
    </div>
  );
};

export default ProgressBar;