
import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, CheckIcon, ArrowPathIcon, ArrowsPointingOutIcon, ScissorsIcon } from '@heroicons/react/24/outline';

interface CropperModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageFile: File | null;
    onSave: (croppedFile: File, previewUrl: string) => void;
}

const CropperModal: React.FC<CropperModalProps> = ({ isOpen, onClose, imageFile, onSave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [rotation, setRotation] = useState(0); // 0-360
    
    // Crop selection (relative to the ROTATED image coordinate space)
    // x, y, w, h are in canvas pixels (which display the image)
    const [selection, setSelection] = useState<{x: number, y: number, w: number, h: number} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);

    // Load Image
    useEffect(() => {
        if (imageFile) {
            const img = new Image();
            img.src = URL.createObjectURL(imageFile);
            img.onload = () => {
                setImage(img);
                setRotation(0);
                setSelection(null);
            };
        }
    }, [imageFile]);

    // Draw Canvas
    useEffect(() => {
        if (!image || !canvasRef.current || !containerRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Determine canvas size based on rotation to fit the whole image
        // To allow 360 rotation without clipping, diagonal length is the safe bound
        const diagonal = Math.sqrt(image.width ** 2 + image.height ** 2);
        
        // However, for display, we want to fit it in the screen
        const containerW = containerRef.current.clientWidth;
        const containerH = containerRef.current.clientHeight;
        
        // Logic: The canvas internal resolution should be high (close to image)
        // But CSS scales it down.
        // Let's make internal resolution reasonable (max 1200px)
        const scale = Math.min(1200 / diagonal, 1);
        const canvasW = diagonal * scale;
        const canvasH = diagonal * scale;

        canvas.width = canvasW;
        canvas.height = canvasH;
        
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Fill background dark for empty space
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        
        // Move to center
        ctx.translate(canvas.width / 2, canvas.height / 2);
        // Rotate
        ctx.rotate((rotation * Math.PI) / 180);
        
        // Draw Image Centered
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
        
        ctx.restore();

        // Draw Selection Overlay
        if (selection) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.strokeStyle = '#ef4444'; // Red outline
            ctx.lineWidth = 2;

            ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
            ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
            
            // Draw corner handles visualization
            const cornerSize = 8;
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(selection.x - cornerSize/2, selection.y - cornerSize/2, cornerSize, cornerSize);
            ctx.fillRect(selection.x + selection.w - cornerSize/2, selection.y + selection.h - cornerSize/2, cornerSize, cornerSize);
        }

    }, [image, rotation, selection]);

    // --- Interaction Handlers ---

    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        
        // Map CSS coordinates to Canvas internal coordinates
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const pos = getMousePos(e);
        setDragStart(pos);
        setSelection({ x: pos.x, y: pos.y, w: 0, h: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging || !dragStart) return;
        const pos = getMousePos(e);
        
        const w = pos.x - dragStart.x;
        const h = pos.y - dragStart.y;
        
        setSelection({
            x: w < 0 ? pos.x : dragStart.x,
            y: h < 0 ? pos.y : dragStart.y,
            w: Math.abs(w),
            h: Math.abs(h)
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragStart(null);
    };

    const handleSave = () => {
        if (!image || !canvasRef.current) return;
        
        // If no selection, save whole rotated canvas content (trimmed)
        // Or enforce selection. Let's enforce selection if it exists, else whole visible image.
        
        // To be accurate: We need to draw the rotated image onto a temp canvas, get data, and crop.
        const tempCanvas = document.createElement('canvas');
        // Match the visual canvas size
        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;

        // Re-draw clean image without overlay
        const diagonal = Math.sqrt(image.width ** 2 + image.height ** 2);
        const scale = Math.min(1200 / diagonal, 1);
        
        ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);

        // Prepare Final Output
        const finalCanvas = document.createElement('canvas');
        
        let sourceX, sourceY, sourceW, sourceH;

        if (selection && selection.w > 10 && selection.h > 10) {
            sourceX = selection.x;
            sourceY = selection.y;
            sourceW = selection.w;
            sourceH = selection.h;
        } else {
            // No valid selection, export whole canvas (might have black borders)
            // Ideally we'd calculate bounding box but simplest is export what user sees
            sourceX = 0;
            sourceY = 0;
            sourceW = tempCanvas.width;
            sourceH = tempCanvas.height;
        }

        finalCanvas.width = sourceW;
        finalCanvas.height = sourceH;
        
        const fCtx = finalCanvas.getContext('2d');
        if (!fCtx) return;

        fCtx.drawImage(tempCanvas, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);

        finalCanvas.toBlob((blob) => {
            if (blob) {
                const newFile = new File([blob], "cropped_edited.jpg", { type: "image/jpeg" });
                onSave(newFile, URL.createObjectURL(newFile));
                onClose();
            }
        }, 'image/jpeg', 0.95);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4">
            <div className="relative bg-[#1e1e1e] border border-gray-700 rounded-xl p-4 w-full max-w-4xl h-[90vh] flex flex-col gap-4">
                 
                 {/* Header */}
                 <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <ScissorsIcon className="w-5 h-5" />
                        Cắt & Xoay 360°
                    </h3>
                    <button onClick={onClose}><XMarkIcon className="w-6 h-6 text-gray-400 hover:text-white" /></button>
                 </div>
                 
                 {/* Main Canvas Area */}
                 <div ref={containerRef} className="flex-1 bg-[#111] rounded flex items-center justify-center overflow-hidden border border-gray-800 relative cursor-crosshair">
                     <canvas 
                        ref={canvasRef} 
                        className="max-w-full max-h-full"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleMouseDown}
                        onTouchMove={handleMouseMove}
                        onTouchEnd={handleMouseUp}
                     />
                     {!selection && (
                         <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-white/30 font-bold text-xl select-none">
                             Kéo chuột để chọn vùng cắt
                         </div>
                     )}
                 </div>
                 
                 {/* Controls */}
                 <div className="flex flex-col gap-4 p-2 bg-[#151515] rounded border border-gray-800">
                     {/* Rotation Control */}
                     <div className="flex items-center gap-4">
                         <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full">
                            <ArrowPathIcon className="w-5 h-5 text-gray-300" />
                         </div>
                         <div className="flex-1 flex flex-col">
                             <div className="flex justify-between text-xs text-gray-400 mb-1">
                                 <span>Xoay Tự Do (Giữ chuột và kéo)</span>
                                 <span className="text-sky-400 font-bold">{rotation}°</span>
                             </div>
                             <input 
                                type="range" 
                                min="-180" 
                                max="180" 
                                value={rotation} 
                                onChange={(e) => setRotation(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                             />
                         </div>
                         <button 
                            onClick={() => setRotation(0)} 
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-white rounded"
                         >
                             Reset
                         </button>
                     </div>
                 </div>
                 
                 {/* Actions */}
                 <div className="flex gap-2 pt-2 border-t border-gray-700">
                     <button onClick={onClose} className="flex-1 bg-gray-800 text-gray-300 py-3 rounded font-bold hover:bg-gray-700">Hủy</button>
                     <button onClick={handleSave} className="flex-1 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white py-3 rounded font-bold flex items-center justify-center gap-2 shadow-lg">
                         <CheckIcon className="w-5 h-5" /> Áp dụng Cắt & Xoay
                     </button>
                 </div>
            </div>
        </div>
    );
};

export default CropperModal;
