
import React, { useEffect, useState } from 'react';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import { PricingConfig, PricingPackage } from '../types';
import { getPricingConfig } from '../services/firebaseService';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPackage: (pkg: PricingPackage) => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onSelectPackage }) => {
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
        setSelectedId(null); // Reset selection on open
        const loadConfig = async () => {
            const data = await getPricingConfig();
            setConfig(data);
        };
        loadConfig();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePackageClick = (pkg: PricingPackage) => {
      if (pkg.price === 'INCOMING') return; // Prevent clicking disabled/incoming packages
      
      setSelectedId(pkg.id);
      
      // Delay callback to allow animation to play
      setTimeout(() => {
          onSelectPackage(pkg);
      }, 800); // 800ms match transition duration
  };

  const getThemeClasses = (theme: string) => {
      switch (theme) {
          case 'purple':
              return {
                  cardBorder: 'border-purple-500',
                  header: 'bg-gradient-to-r from-purple-600 to-indigo-600',
                  button: 'bg-purple-600 hover:bg-purple-500',
                  text: 'text-purple-400',
                  badge: 'bg-[#fbbf24] text-red-900',
                  glow: 'shadow-[0_0_30px_rgba(168,85,247,0.4)]'
              };
          case 'blue':
              return {
                  cardBorder: 'border-blue-500',
                  header: 'bg-blue-600',
                  button: 'bg-blue-600 hover:bg-blue-500',
                  text: 'text-blue-400',
                  badge: 'bg-orange-500 text-white',
                  glow: 'shadow-[0_0_20px_rgba(37,99,235,0.3)]'
              };
          case 'green':
              return {
                  cardBorder: 'border-green-500',
                  header: 'bg-green-600',
                  button: 'bg-green-600 hover:bg-green-500',
                  text: 'text-green-400',
                  badge: 'bg-orange-500 text-white',
                  glow: 'shadow-[0_0_20px_rgba(22,163,74,0.3)]'
              };
          case 'orange':
              return {
                  cardBorder: 'border-orange-500',
                  header: 'bg-orange-600',
                  button: 'bg-orange-600 hover:bg-orange-500',
                  text: 'text-orange-400',
                  badge: 'bg-orange-500 text-white',
                  glow: 'shadow-[0_0_20px_rgba(234,88,12,0.3)]'
              };
          default:
              return {
                  cardBorder: 'border-gray-700',
                  header: 'bg-gray-700',
                  button: 'bg-gray-700',
                  text: 'text-gray-400',
                  badge: 'bg-gray-600',
                  glow: ''
              };
      }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md overflow-y-auto overflow-x-hidden">
      <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-8 relative">
        
        {/* Close Button - Fixed to viewport corner so it's always accessible */}
        {!selectedId && (
            <button 
                onClick={onClose} 
                className="fixed top-6 right-6 text-white/70 hover:text-white transition-colors p-2 bg-white/10 rounded-full z-[160] hover:rotate-90 duration-300"
            >
                <XMarkIcon className="w-8 h-8" />
            </button>
        )}

        <div className={`w-full max-w-7xl flex flex-col items-center transition-all duration-500 ${selectedId ? '' : ''}`}>
            
            {/* Promotion Banner - Will fade out on selection */}
            {config && (
                <div className={`w-full max-w-4xl bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 mb-10 text-center shadow-lg border border-orange-200 shrink-0 transition-all duration-500 ${selectedId ? 'opacity-0 -translate-y-10 pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex items-center justify-center gap-3 mb-2 animate-bounce">
                        <span className="text-3xl">🎉</span>
                        <h2 className="text-xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">
                            {config.bannerTitle}
                        </h2>
                        <span className="text-3xl">🎉</span>
                    </div>
                    <p className="text-gray-700 text-sm md:text-lg font-medium">
                        {config.bannerSubtitle}
                    </p>
                </div>
            )}

            {/* Pricing Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                {config?.packages.map((pkg) => {
                    const styles = getThemeClasses(pkg.theme);
                    const isSelected = selectedId === pkg.id;
                    const isOtherSelected = selectedId !== null && !isSelected;
                    
                    // Base container classes
                    let containerClasses = `bg-white rounded-2xl overflow-hidden flex flex-col relative transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) cursor-pointer group`;
                    
                    // Inline styles for transformation
                    let styleObj: React.CSSProperties = { minHeight: '520px' };

                    if (isSelected) {
                        // Selected State: Fixed Center, Purple Border
                        containerClasses += ` fixed top-1/2 left-1/2 z-[200] shadow-[0_0_100px_rgba(147,51,234,0.6)] border-[6px] border-purple-600`;
                        styleObj = {
                            ...styleObj,
                            transform: 'translate(-50%, -50%) scale(1.15)',
                            width: '90%',
                            maxWidth: '400px',
                            height: 'auto',
                            maxHeight: '90vh'
                        };
                    } else if (isOtherSelected) {
                        // Fade out others
                        containerClasses += ` opacity-0 scale-75 blur-md pointer-events-none`;
                    } else {
                        // Normal State
                        containerClasses += ` hover:-translate-y-2 hover:shadow-2xl ${styles.cardBorder} ${pkg.isPopular ? 'border-4' : 'border-t-8'} ${styles.glow}`;
                        if (pkg.isPopular) containerClasses += ' scale-105 z-10 md:-mt-4 mb-4 md:mb-0';
                    }

                    return (
                        <div 
                            key={pkg.id} 
                            className={containerClasses}
                            style={styleObj}
                            onClick={() => handlePackageClick(pkg)}
                        >
                            {/* Tags */}
                            {pkg.tag && (
                                <div className="absolute top-0 right-0 z-20">
                                    <div className={`text-[10px] font-bold px-4 py-1.5 rounded-bl-xl uppercase shadow-sm ${styles.badge}`}>
                                        {pkg.tag}
                                    </div>
                                </div>
                            )}
                            
                            {/* Popular Header */}
                            {pkg.isPopular && !isSelected && (
                                <div className="bg-[#fbbf24] text-red-900 text-xs font-bold text-center py-1.5 flex items-center justify-center gap-1">
                                    <span className="text-base">🔥</span> ĐƯỢC MUA NHIỀU NHẤT
                                </div>
                            )}

                            {/* Card Header */}
                            <div className={`p-6 text-center text-white ${styles.header} relative overflow-hidden`}>
                                {/* Decorative background circle */}
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-black/10 rounded-full blur-2xl"></div>
                                
                                <h3 className="font-black text-xl uppercase tracking-wider mb-1 relative z-10 drop-shadow-md">
                                    {pkg.name}
                                </h3>
                            </div>

                            {/* Price Section */}
                            <div className="p-8 text-center border-b border-gray-100 bg-gray-50/50">
                                <div className="flex items-center justify-center gap-1 mb-3 transition-transform group-hover:scale-110 duration-300">
                                    <span className="text-5xl font-extrabold text-gray-900 tracking-tight">{pkg.price}</span>
                                    {pkg.price !== 'INCOMING' && <span className="text-sm font-bold text-gray-500 mt-3 bg-gray-200 px-1.5 rounded">VNĐ</span>}
                                </div>
                                
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    {pkg.originalCredits && (
                                        <span className="text-gray-400 line-through font-medium text-lg decoration-2 decoration-gray-400/50">
                                            {pkg.originalCredits}
                                        </span>
                                    )}
                                    <div className={`flex items-center gap-1 px-3 py-1 rounded-full bg-${pkg.theme}-50 border border-${pkg.theme}-100`}>
                                        <span className={`text-2xl font-black ${styles.text}`}>
                                            {pkg.credits > 0 ? pkg.credits : 'Toàn bộ'}
                                        </span>
                                        <span className={`text-xs font-bold uppercase text-gray-500`}>Credits</span>
                                    </div>
                                </div>
                                
                                <p className="text-xs text-gray-400 font-semibold flex items-center justify-center gap-1">
                                    <span>⏳</span> Thời hạn: 1 {pkg.theme === 'orange' ? 'Năm' : 'tháng'}
                                </p>
                            </div>

                            {/* Features List */}
                            <div className="p-6 flex-1 bg-white">
                                <ul className="space-y-4">
                                    {pkg.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-sm text-gray-600 font-medium group/item hover:text-gray-900 transition-colors">
                                            <div className={`mt-0.5 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-${pkg.theme}-100`}>
                                                <CheckCircleIcon className={`w-4 h-4 ${styles.text}`} />
                                            </div>
                                            <span className="leading-snug">
                                                {feature.replace(/~/, '')} 
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Footer Button */}
                            <div className="p-6 pt-0 bg-white mt-auto">
                                <button
                                    className={`w-full py-4 rounded-xl font-black text-white uppercase tracking-widest shadow-lg shadow-${pkg.theme}-500/30 transform transition-all duration-300 ${styles.button} ${pkg.price === 'INCOMING' ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-1 hover:shadow-xl active:scale-95'}`}
                                >
                                    {isSelected ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Đang chuyển hướng...
                                        </span>
                                    ) : (
                                        pkg.buttonText || "Đăng ký ngay"
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
