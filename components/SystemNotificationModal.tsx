import React, { useEffect, useState } from 'react';
import { XMarkIcon, BellIcon, MapPinIcon, SparklesIcon, FireIcon } from '@heroicons/react/24/solid';
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Container với hiệu ứng viền chạy */}
      <div className="relative w-full max-w-md group">
        
        {/* Lớp nền tạo hiệu ứng chạy (Animated Gradient Border) */}
        <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-75 blur-sm group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>
        <div className="absolute -inset-[1px] rounded-2xl bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#a855f7_100%)] animate-[spin_3s_linear_infinite] opacity-100"></div>

        {/* Nội dung chính */}
        <div className="relative bg-[#09090b] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            
            {/* Header Modern */}
            <div className="relative px-6 py-5 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                            <BellIcon className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-white uppercase tracking-wide">
                                {data.title || "Thông Báo"}
                            </h3>
                            <p className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">System Notification</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleClose(false)} 
                        className="text-gray-500 hover:text-white hover:bg-white/10 rounded-full p-2 transition-all duration-200"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
                {/* Pinned Note - Giao diện thẻ nổi bật */}
                {data.pinnedNote && (
                    <div className="relative overflow-hidden rounded-xl border border-orange-500/30 bg-orange-900/10 p-4 group/note">
                        {/* Hiệu ứng nền nhẹ cho note */}
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent opacity-50"></div>
                        
                        <div className="relative flex items-start gap-3">
                            <div className="mt-0.5">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 ring-1 ring-orange-500/50">
                                    <FireIcon className="w-3.5 h-3.5 text-orange-400" />
                                </span>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-900/40 px-2 py-0.5 rounded border border-orange-500/20">
                                        Nổi bật
                                    </span>
                                    <span className="text-[10px] text-gray-500">
                                        {new Date().toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}
                                    </span>
                                </div>
                                <p className="text-orange-100/90 text-sm font-medium leading-relaxed">
                                    {data.pinnedNote}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content - Typography tốt hơn */}
                <div className="text-gray-300 text-sm leading-7 whitespace-pre-line font-light tracking-wide bg-white/5 p-4 rounded-xl border border-white/5">
                    {data.content}
                </div>

                {/* Footer Action */}
                <div className="pt-2">
                    <button 
                        onClick={() => handleClose(true)}
                        className="group relative w-full overflow-hidden rounded-xl bg-white p-[1px] transition-all hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-900"
                    >
                        <div className="relative flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-3.5 transition-all group-hover:bg-opacity-90">
                            <SparklesIcon className="w-4 h-4 text-purple-200" />
                            <span className="text-sm font-bold text-white tracking-wide uppercase">Đã hiểu (Tắt 1 giờ)</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SystemNotificationModal;