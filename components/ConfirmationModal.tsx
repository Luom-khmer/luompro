
import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Xác nhận",
  message = "Bạn có chắc chắn muốn thực hiện hành động này?",
  confirmLabel = "Đồng ý",
  cancelLabel = "Hủy bỏ"
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-[#1a1a1a] border border-red-900/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-red-900/20 transform transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-900/20 rounded-full">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        
        <p className="text-gray-300 mb-8 leading-relaxed text-sm">
            {message}
        </p>
        
        <div className="flex gap-3">
           <button 
             onClick={onClose}
             className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-bold transition-colors border border-gray-700"
           >
             {cancelLabel}
           </button>
           <button 
             onClick={() => { onConfirm(); onClose(); }}
             className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-900/30"
           >
             {confirmLabel}
           </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
