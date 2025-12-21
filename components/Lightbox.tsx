
import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface LightboxProps {
  isOpen: boolean;
  src: string;          // Ảnh kết quả (hoặc ảnh hiện tại)
  originalSrc: string;  // Ảnh gốc để so sánh
  onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ isOpen, src, originalSrc, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false); // State để toggle ảnh
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setShowOriginal(false); // Mặc định hiển thị ảnh kết quả khi mở
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Lắng nghe phím Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); // Ngăn cuộn trang
        setShowOriginal(prev => !prev);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    // Zoom logic
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.5, scale + delta), 5); // Limit zoom 0.5x to 5x
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check right click
    if (e.button === 2) {
        setShowOriginal(true);
        e.preventDefault();
        return;
    }
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setShowOriginal(false); // Reset on mouse up if holding right click
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
  };

  if (!isOpen) return null;

  // Xác định ảnh cần hiển thị
  const currentImageSrc = showOriginal ? originalSrc : src;
  const isDiff = src !== originalSrc;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center overflow-hidden"
      onWheel={handleWheel}
      onDoubleClick={onClose} // Double click background to close
      onContextMenu={handleContextMenu}
    >
      <div className="absolute top-4 right-4 z-[101]">
        <button onClick={onClose} className="p-2 bg-gray-800/50 hover:bg-red-600 rounded-full text-white transition-colors">
          <XMarkIcon className="w-8 h-8" />
        </button>
      </div>

      {/* Badge hiển thị trạng thái ảnh */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[101] pointer-events-none">
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide shadow-lg ${showOriginal ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'}`}>
          {showOriginal ? 'ẢNH GỐC' : 'KẾT QUẢ'}
        </span>
      </div>

      <img 
        src={currentImageSrc} 
        alt="Fullscreen"
        draggable={false}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={(e) => { e.stopPropagation(); onClose(); }} // Double click image to close
        className="max-w-none transition-transform duration-75 ease-linear cursor-grab active:cursor-grabbing"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          maxHeight: '100vh',
          maxWidth: '100vw',
          objectFit: 'contain'
        }}
      />
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full text-white text-sm pointer-events-none whitespace-nowrap">
        Lăn chuột để Zoom • Kéo để di chuyển • {isDiff ? <strong>Giữ chuột phải để so sánh</strong> : 'Đang xem gốc'} • Kích đôi để thoát
      </div>
    </div>
  );
};

export default Lightbox;
