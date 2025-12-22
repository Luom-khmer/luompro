
import React, { useState } from 'react';
import { ProcessedImage } from '../types';
import { ArrowPathIcon, TrashIcon, ArrowDownTrayIcon, CheckIcon, ScissorsIcon, EyeIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';

interface ImageCardProps {
  item: ProcessedImage;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRegenerate: (item: ProcessedImage) => void;
  isFullHeight?: boolean;
  onDoubleClick?: () => void;
  onCrop?: (item: ProcessedImage) => void;
  onView?: () => void;
  onUpscale?: (item: ProcessedImage) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ item, onToggleSelect, onDelete, onRegenerate, isFullHeight, onDoubleClick, onCrop, onView, onUpscale }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false); // State for right-click comparison
  
  const isCompleted = item.status === 'completed' && item.generatedImageUrl;
  const isGenerating = item.status === 'generating';
  
  // Logic: Show original if strictly holding right click OR hovering (if completed), otherwise show generated if available.
  const displayImage = (isCompleted && (showOriginal || isHovered)) 
    ? item.originalPreviewUrl 
    : (isCompleted ? item.generatedImageUrl : item.originalPreviewUrl);

  const handleMouseDown = (e: React.MouseEvent) => {
      // Button 2 is Right Click
      if (e.button === 2 && isCompleted) {
          setShowOriginal(true);
      }
  };

  const handleMouseUp = () => {
      setShowOriginal(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      // Prevent default context menu if the image is completed (to allow comparison view)
      if (isCompleted) {
          e.preventDefault();
      }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.generatedImageUrl) return;

    try {
        // Create filename
        const filename = `luom_pro_ai_${item.id}.jpg`;

        // If data URL, download directly
        if (item.generatedImageUrl.startsWith('data:')) {
            const a = document.createElement('a');
            a.href = item.generatedImageUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            // If remote URL, fetch as blob to force download
            // This prevents opening in new tab for external URLs (like Gommo)
            const response = await fetch(item.generatedImageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    } catch (err) {
        console.error("Download failed", err);
        // Fallback if fetch fails (e.g. CORS strict), try opening
        window.open(item.generatedImageUrl, '_blank');
    }
  };

  return (
    <div 
        className={`relative group border rounded-lg overflow-hidden bg-[#1e1e1e] flex flex-col w-full transition-shadow duration-200 ${item.isSelected ? 'border-sky-500 ring-1 ring-sky-500 shadow-lg shadow-sky-900/20' : 'border-gray-700'} ${isFullHeight ? 'h-full' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setShowOriginal(false); }}
        onDoubleClick={onDoubleClick}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
    >
      
      {/* Image Area - FIXED ASPECT RATIO DISPLAY */}
      <div className={`relative w-full bg-black overflow-hidden flex items-center justify-center ${isFullHeight ? 'flex-1 min-h-0' : 'min-h-[300px]'}`}>
        <img 
            src={displayImage} 
            alt="Content" 
            className={`${isFullHeight ? 'max-w-full max-h-full' : 'w-full h-full'} object-contain block transition-opacity duration-300 ${isGenerating ? 'opacity-40' : 'opacity-100'} cursor-zoom-in`}
        />
        
        {/* Checkbox (Top Left) */}
        <div 
            onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
            className={`absolute top-3 left-3 w-8 h-8 rounded border-2 cursor-pointer flex items-center justify-center transition-all z-30
                ${item.isSelected ? 'bg-sky-600 border-sky-600 scale-110 shadow-md' : 'bg-black/40 border-gray-400 hover:border-white'}
            `}
        >
            {item.isSelected && <CheckIcon className="w-5 h-5 text-white stroke-[3px]" />}
        </div>

        {/* Delete Button (Floating on Hover for better accessibility) */}
        <button 
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="absolute top-3 right-3 bg-black/50 hover:bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all z-30 shadow-lg"
            title="Xóa ảnh"
        >
            <TrashIcon className="w-5 h-5" />
        </button>

        {/* Status Loading Overlay */}
        {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/20">
                <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )}
        
        {/* Error Overlay */}
        {item.status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 p-4">
                 <div className="text-center">
                    <span className="text-red-500 text-sm font-bold block mb-1">LỖI XỬ LÝ</span>
                    <span className="text-gray-400 text-xs">{item.error || 'Vui lòng thử lại'}</span>
                 </div>
            </div>
        )}

        {/* Badge 'Final' - Fixed position in top right below delete button */}
        {isCompleted && (
            <div className={`absolute top-14 right-3 text-xs font-bold px-3 py-1 rounded shadow-sm pointer-events-none z-10 uppercase tracking-tight transition-colors ${(showOriginal || isHovered) ? 'bg-blue-600 text-white' : 'bg-[#ccc] text-[#333]'}`}>
                {(showOriginal || isHovered) ? "Ảnh gốc" : "Kết quả"}
            </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-gray-800 bg-[#1e1e1e] flex items-center justify-between gap-2">
        {/* 1. Create Button (Orange) */}
        <button 
            onClick={(e) => { e.stopPropagation(); onRegenerate(item); }}
            className={`flex-1 bg-[#e65100] hover:bg-[#ff6d00] text-white transition-colors py-2.5 rounded shadow-md flex items-center justify-center text-sm font-bold uppercase tracking-wider ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isGenerating}
            title="Tạo lại ảnh"
        >
            {isGenerating ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : "Tạo Ảnh"}
        </button>

        {/* 2. Upscale Button (Purple) - NEW */}
        {onUpscale && isCompleted && (
            <button 
                onClick={(e) => { e.stopPropagation(); onUpscale(item); }}
                className="w-10 bg-purple-900/50 hover:bg-purple-600 text-purple-300 hover:text-white transition-colors py-2.5 rounded shadow-md flex items-center justify-center border border-purple-500/30"
                title="Upscale (Nâng cấp ảnh)"
                disabled={isGenerating}
            >
                <ArrowsPointingOutIcon className="w-5 h-5" />
            </button>
        )}

        {/* 3. Crop Button (Gray/Purple) */}
        {onCrop && (
            <button 
                onClick={(e) => { e.stopPropagation(); onCrop(item); }}
                className="w-10 bg-zinc-700 hover:bg-zinc-600 text-white transition-colors py-2.5 rounded shadow-md flex items-center justify-center"
                title="Cắt & Xoay Ảnh"
                disabled={isGenerating}
            >
                <ScissorsIcon className="w-5 h-5" />
            </button>
        )}
        
        {/* 4. View Button (Gray/Blue) */}
        <button 
            onClick={(e) => { e.stopPropagation(); onView && onView(); }}
            className="w-10 bg-zinc-700 hover:bg-sky-600 text-white transition-colors py-2.5 rounded shadow-md flex items-center justify-center"
            title="Xem ảnh lớn"
            disabled={isGenerating}
        >
            <EyeIcon className="w-5 h-5" />
        </button>

        {/* 5. Download Button (Blue) */}
        <div className="flex-1">
            {isCompleted ? (
                <button 
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 bg-[#0288d1] hover:bg-[#03a9f4] text-white transition-colors rounded py-2.5 shadow-md text-sm font-bold uppercase tracking-wider"
                    title="Tải ảnh về máy ngay lập tức"
                >
                    <ArrowDownTrayIcon className="w-5 h-5 stroke-[2px]" />
                    Tải về
                </button>
            ) : (
                <div className="w-full h-[44px] flex items-center justify-center bg-gray-800/50 rounded cursor-not-allowed opacity-30">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    <span className="ml-2 text-xs font-bold">TẢI VỀ</span>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ImageCard;
