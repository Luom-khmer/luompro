
import React, { useEffect, useState } from 'react';
import { XMarkIcon, CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { PricingConfig, PricingPackage } from '../types';
import { getPricingConfig } from '../services/firebaseService';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPackage: (pkg: PricingPackage) => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onSelectPackage }) => {
  const [config, setConfig] = useState<PricingConfig | null>(null);

  useEffect(() => {
    if (isOpen) {
        const loadConfig = async () => {
            const data = await getPricingConfig();
            setConfig(data);
        };
        loadConfig();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getThemeClasses = (theme: string, isPopular: boolean = false) => {
      switch (theme) {
          case 'purple':
              return {
                  card: 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] scale-105 z-10',
                  header: 'bg-gradient-to-r from-purple-600 to-indigo-600',
                  button: 'bg-purple-600 hover:bg-purple-500',
                  text: 'text-purple-400',
                  badge: 'bg-orange-500 text-white' // Bonus badge
              };
          case 'blue':
              return {
                  card: 'border-blue-500 shadow-lg',
                  header: 'bg-blue-600',
                  button: 'bg-blue-600 hover:bg-blue-500',
                  text: 'text-blue-400',
                  badge: 'bg-orange-500 text-white'
              };
          case 'green':
              return {
                  card: 'border-green-500 shadow-lg',
                  header: 'bg-green-600',
                  button: 'bg-green-600 hover:bg-green-500',
                  text: 'text-green-400',
                  badge: 'bg-orange-500 text-white'
              };
          case 'orange':
              return {
                  card: 'border-orange-500 shadow-lg',
                  header: 'bg-orange-600',
                  button: 'bg-orange-600 hover:bg-orange-500',
                  text: 'text-orange-400',
                  badge: 'bg-orange-500 text-white'
              };
          default:
              return {
                  card: 'border-gray-700',
                  header: 'bg-gray-700',
                  button: 'bg-gray-700',
                  text: 'text-gray-400',
                  badge: 'bg-gray-600'
              };
      }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-6xl relative animate-fade-in my-auto">
        
        {/* Close Button */}
        <button 
            onClick={onClose} 
            className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors p-2 bg-white/10 rounded-full"
        >
            <XMarkIcon className="w-8 h-8" />
        </button>

        {/* Promotion Banner */}
        {config && (
            <div className="bg-[#fffbeb] rounded-xl p-4 md:p-6 mb-8 text-center shadow-lg border border-orange-200">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-2xl">🎉</span>
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 uppercase tracking-tight">
                        {config.bannerTitle}
                    </h2>
                </div>
                <p className="text-gray-700 text-sm md:text-base font-medium">
                    {config.bannerSubtitle}
                </p>
            </div>
        )}

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 items-start">
            {config?.packages.map((pkg) => {
                const styles = getThemeClasses(pkg.theme, pkg.isPopular);
                
                return (
                    <div 
                        key={pkg.id} 
                        className={`bg-white rounded-xl overflow-hidden flex flex-col relative transition-transform duration-300 ${styles.card} ${pkg.isPopular ? 'border-4' : 'border-t-8'}`}
                        style={{ minHeight: '500px' }}
                    >
                        {/* Corner Ribbon for Tag */}
                        {pkg.tag && (
                            <div className="absolute top-0 right-0">
                                <div className={`text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase shadow-sm ${pkg.theme === 'purple' ? 'bg-[#fbbf24] text-red-900' : 'bg-orange-500 text-white'}`}>
                                    {pkg.tag}
                                </div>
                            </div>
                        )}
                        
                        {/* Popular Badge specific placement */}
                        {pkg.isPopular && (
                            <div className="bg-[#fbbf24] text-red-900 text-xs font-bold text-center py-1 flex items-center justify-center gap-1">
                                <span className="text-sm">🔥</span> PHỔ BIẾN
                            </div>
                        )}

                        {/* Header Section */}
                        <div className={`p-6 text-center text-white ${styles.header}`}>
                            <h3 className="font-black text-lg uppercase tracking-wider mb-1 opacity-90">{pkg.name}</h3>
                        </div>

                        {/* Price Section */}
                        <div className="p-6 text-center border-b border-gray-100 bg-gray-50">
                            <div className="flex items-center justify-center gap-1 mb-2">
                                <span className="text-4xl font-extrabold text-gray-900">{pkg.price}</span>
                                {pkg.price !== 'INCOMING' && <span className="text-sm font-bold text-gray-500 mt-2">VNĐ</span>}
                            </div>
                            
                            {/* Credits Display */}
                            <div className="flex items-center justify-center gap-2">
                                {pkg.originalCredits && (
                                    <span className="text-gray-400 line-through font-medium text-lg decoration-2 decoration-gray-400">
                                        {pkg.originalCredits}
                                    </span>
                                )}
                                <span className={`text-3xl font-black ${styles.text.replace('text-', 'text-opacity-90 text-')}`}>
                                    {pkg.credits > 0 ? pkg.credits : 'Toàn bộ'}
                                </span>
                                <span className={`text-sm font-bold ${styles.text}`}>Credits</span>
                            </div>
                            
                            <p className="text-xs text-gray-400 mt-2 font-medium flex items-center justify-center gap-1">
                                <span>⏰</span> Thời hạn: 1 {pkg.theme === 'orange' ? 'Năm' : 'tháng'}
                            </p>
                        </div>

                        {/* Features List */}
                        <div className="p-6 flex-1 bg-white">
                            <ul className="space-y-3">
                                {pkg.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-sm text-gray-700 font-medium">
                                        <div className={`mt-0.5 min-w-[16px] flex items-center justify-center rounded-full`}>
                                            <CheckCircleIcon className={`w-5 h-5 ${styles.text.replace('text-', 'text-opacity-80 text-')}`} />
                                        </div>
                                        <span className="leading-snug">
                                            {feature.replace(/~/, '')} 
                                            {/* Hacky way to handle bolding if needed, but simple text is fine */}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Footer Button */}
                        <div className="p-6 pt-0 bg-white">
                            <button
                                onClick={() => onSelectPackage(pkg)}
                                className={`w-full py-3 rounded-lg font-bold text-white uppercase tracking-wider shadow-md transform transition-all active:scale-95 ${styles.button}`}
                            >
                                {pkg.buttonText || "Đăng ký ngay"}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
