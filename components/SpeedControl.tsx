
import React from 'react';

interface SpeedControlProps {
  speed: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
}

const SpeedControl: React.FC<SpeedControlProps> = ({ speed, onChange, disabled }) => (
  <div>
    <label htmlFor="speed-control" className="block text-sm font-medium text-gray-400 mb-2">
      Tốc độ phát ({speed.toFixed(1)}x)
    </label>
    <input
      id="speed-control"
      type="range"
      min="0.5"
      max="2.0"
      step="0.1"
      value={speed}
      onChange={onChange}
      disabled={disabled}
      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-600 accent-red-600"
    />
  </div>
);

export default SpeedControl;
