
import React from 'react';
import { HistoryItem, VoiceOption } from '../types';

interface HistoryPanelProps {
  history: HistoryItem[];
  voices: VoiceOption[];
  onUse: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, voices, onUse, onDelete }) => {
  const getVoiceName = (voiceId: string) => {
    return voices.find(v => v.id === voiceId)?.name || voiceId;
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <h2 className="text-2xl font-bold text-white mb-4 text-center">Lịch sử tạo</h2>
      {history.length === 0 ? (
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 text-center text-gray-500">
          <p>Chưa có mục nào trong lịch sử.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <div key={item.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-shadow hover:shadow-lg hover:shadow-red-900/20">
              <div className="flex-1 min-w-0">
                <p className="text-gray-300 text-sm truncate" title={item.text}>
                  "{item.text}"
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                  <span>
                    <strong className="font-semibold text-gray-400">Giọng:</strong> {getVoiceName(item.voice)}
                  </span>
                  <span>
                    <strong className="font-semibold text-gray-400">Tốc độ:</strong> {item.speed.toFixed(1)}x
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <button
                  onClick={() => onUse(item)}
                  className="bg-zinc-800 text-gray-300 text-xs font-bold py-1 px-3 rounded-md hover:bg-zinc-700 hover:text-white transition-colors duration-200"
                >
                  Sử dụng
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="bg-red-900/50 text-red-300 text-xs font-bold py-1 px-3 rounded-md hover:bg-red-800/70 hover:text-white transition-colors duration-200"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
