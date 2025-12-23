
import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface LightboxProps {
  isOpen: boolean;
  src: string;          // Ảnh kết quả (hoặc ảnh hiện tại)
  originalSrc: string;  // Ảnh gốc để so sánh
  onClose: () => void;
}

// Helper: Format bytes to human readable string
const formatBytes = (bytes: number, decimals = 1) => {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// Helper: Calculate Aspect Ratio with Fuzzy Matching for Standard Ratios
const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b);
};

const getAspectRatio = (w: number, h: number): string => {
    if (!w || !h) return '';
    const ratio = w / h;

    // Danh sách các tỷ lệ phổ biến cần ưu tiên hiển thị
    const commonRatios = [
        { label: "1:1", value: 1 },
        { label: "2:3", value: 2/3 },
        { label: "3:2", value: 3/2 },
        { label: "3:4", value: 3/4 },
        { label: "4:3", value: 4/3 },
        { label: "16:9", value: 16/9 },
        { label: "9:16", value: 9/16 },
        { label: "21:9", value: 21/9 },
        { label: "4:5", value: 4/5 },
        { label: "5:4", value: 5/4 }
    ];

    // Tìm tỷ lệ gần đúng nhất (sai số cho phép 0.03 để chấp nhận ảnh bị crop lệch 1 vài pixel)
    const match = commonRatios.find(r => Math.abs(ratio - r.value) < 0.03);
    
    if (match) {
        return match.label;
    }

    // Nếu không khớp tỷ lệ chuẩn, dùng thuật toán tối giản phân số (GCD)
    const divisor = gcd(w, h);
    const ratioW = Math.round(w / divisor);
    const ratioH = Math.round(h / divisor);
    
    // Nếu số quá lẻ (ví dụ 135:241), hiển thị dạng thập phân gọn (ví dụ 0.56:1)
    if (ratioW > 20 || ratioH > 20) {
        return (w / h).toFixed(2) + ':1';
    }
    return `${ratioW}:${ratioH}`;
};

const Lightbox: React.FC<LightboxProps> = ({ isOpen, src, originalSrc, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false); // State để toggle ảnh
  
  // State metadata ảnh
  const [imgInfo, setImgInfo] = useState<{ width: number, height: number, size: string | null }>({ width: 0, height: 0, size: null });
  
  const dragStart = useRef({ x: 0, y: 0 });

  // Xác định ảnh cần hiển thị
  const currentImageSrc = showOriginal ? originalSrc : src;
  const isDiff = src !== originalSrc;

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

  // Reset và tính toán lại Size khi ảnh thay đổi
  useEffect(() => {
      if (!isOpen || !currentImageSrc) return;

      setImgInfo(prev => ({ width: 0, height: 0, size: '...' })); // Reset dimensions on switch

      // Fetch blob để lấy size thực tế
      fetch(currentImageSrc)
          .then(res => res.blob())
          .then(blob => {
              // Lấy kích thước thực tế từ Image Object (đã load ở dưới)
              // size lấy từ blob
              setImgInfo(prev => ({ ...prev, size: formatBytes(blob.size) }));
          })
          .catch(() => {
              setImgInfo(prev => ({ ...prev, size: 'Unknown' }));
          });

  }, [currentImageSrc, isOpen]);

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

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setImgInfo(prev => ({
          ...prev,
          width: img.naturalWidth,
          height: img.naturalHeight
      }));
  };

  if (!isOpen) return null;

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
        onLoad={handleImageLoad}
        onDoubleClick={(e) => { e.stopPropagation(); onClose(); }} // Double click image to close
        className="max-w-none transition-transform duration-75 ease-linear cursor-grab active:cursor-grabbing"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          maxHeight: '100vh',
          maxWidth: '100vw',
          objectFit: 'contain'
        }}
      />
      
      {/* Footer Info Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[101] flex flex-col items-center gap-2 pointer-events-none w-full max-w-2xl px-4">
          
          {/* Metadata Display */}
          {imgInfo.width > 0 && (
              <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg text-white text-xs font-mono border border-gray-700 flex items-center gap-4 shadow-xl">
                  <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 font-bold">KT:</span>
                      <span className="text-sky-400 font-bold">{imgInfo.width} x {imgInfo.height}</span>
                  </div>
                  <div className="w-px h-3 bg-gray-600"></div>
                  <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 font-bold">Tỉ lệ:</span>
                      <span className="text-green-400">{getAspectRatio(imgInfo.width, imgInfo.height)}</span>
                  </div>
                  {imgInfo.size && (
                      <>
                        <div className="w-px h-3 bg-gray-600"></div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 font-bold">Dung lượng:</span>
                            <span className="text-yellow-400">{imgInfo.size}</span>
                        </div>
                      </>
                  )}
              </div>
          )}

          {/* Instructions */}
          <div className="bg-black/50 px-4 py-1.5 rounded-full text-white/60 text-[10px] whitespace-nowrap">
            Lăn chuột: Zoom • Kéo: Di chuyển • {isDiff ? <strong>Giữ chuột phải: So sánh</strong> : 'Đang xem gốc'} • Kích đôi: Thoát
          </div>
      </div>
    </div>
  );
};

export default Lightbox;
