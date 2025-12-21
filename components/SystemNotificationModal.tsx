
import React, { useEffect, useState } from 'react';
import { XMarkIcon, BellIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { getSystemAnnouncement, SystemAnnouncement } from '../services/firebaseService';

const STORAGE_KEY = 'luom_pro_notify_dismiss_until';

const SystemNotificationModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<SystemAnnouncement | null>(null);

  useEffect(() => {
    const checkAndLoad = async () => {
      // 1. Check local storage timestamp
      const dismissUntil = localStorage.getItem(STORAGE_KEY);
      if (dismissUntil) {
        const now = Date.now();
        if (now < parseInt(dismissUntil, 10)) {
          return; // Still suppressed
        }
      }

      // 2. Fetch data
      const announcement = await getSystemAnnouncement();
      if (announcement && announcement.isActive) {
        setData(announcement);
        setIsOpen(true);
      }
    };

    checkAndLoad();
  }, []);

  const handleClose = (muteForHour: boolean = false) => {
    setIsOpen(false);
    if (muteForHour) {
      const oneHourLater = Date.now() + 60 * 60 * 1000;
      localStorage.setItem(STORAGE_KEY, oneHourLater.toString());
    }
  };

  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#18181b] rounded-xl overflow-hidden shadow-2xl border border-gray-800">
        {/* Header - Purple */}
        <div className="bg-[#8b5cf6] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
                <BellIcon className="w-5 h-5 animate-pulse" />
                <span>{data.title || "Thông báo hệ thống"}</span>
            </div>
            <button 
                onClick={() => handleClose(false)} 
                className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            >
                <XMarkIcon className="w-6 h-6" />
            </button>
        </div>

        {/* Body */}
        <div className="p-5">
            {/* Pinned Note - Brown/Orange */}
            {data.pinnedNote && (
                <div className="bg-[#3f2c22] border-l-4 border-orange-500 p-3 rounded mb-4">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-orange-700/50 text-orange-200 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                            <MapPinIcon className="w-3 h-3" /> GIM
                        </span>
                        {/* Fake Timestamp if not provided in data, use simple format */}
                        <span className="text-gray-400 text-xs">
                           {new Date().toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}
                        </span>
                    </div>
                    <p className="text-white font-medium text-sm leading-relaxed">
                        {data.pinnedNote}
                    </p>
                </div>
            )}

            {/* Main Content */}
            <div className="text-gray-300 text-sm leading-6 space-y-2 whitespace-pre-line border-t border-gray-800 pt-3 mt-3">
                {data.content}
            </div>

            {/* Footer Action */}
            <button 
                onClick={() => handleClose(true)}
                className="w-full mt-6 bg-[#27272a] hover:bg-[#3f3f46] text-gray-200 font-medium py-3 rounded-lg transition-colors border border-gray-700 text-sm"
            >
                Đã hiểu, tắt trong 1 giờ
            </button>
        </div>
      </div>
    </div>
  );
};

export default SystemNotificationModal;
