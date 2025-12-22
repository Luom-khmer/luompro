
import React from 'react';

// Using VietQR API to generate the specific QR code style matching the user's request
// Bank: Vietcombank, Account: 1038605000, Name: DANH LUOM
const BASE_QR_URL = "https://img.vietqr.io/image/VCB-1038605000-print.png?accountName=DANH%20LUOM";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'donate' | 'topup';
  selectedPackage?: {
      name: string;
      price: string;
      credits: number;
  } | null;
}

const DonationModal: React.FC<DonationModalProps> = ({ isOpen, onClose, mode = 'donate', selectedPackage }) => {
  if (!isOpen) return null;

  const title = mode === 'donate' ? "Ủng hộ ly cafe" : "Thanh Toán Credits";
  
  // Construct content for transfer
  let transferContent = "[Email của bạn]";
  if (selectedPackage) {
      // Remove dots from price to get numeric value for QR if needed, but display string is fine
      transferContent = `[Email] ${selectedPackage.name}`; 
  }

  const message = mode === 'donate' 
    ? "Quét mã QR để ủng hộ tác giả. Cảm ơn bạn rất nhiều!" 
    : `Quét mã QR để thanh toán cho gói ${selectedPackage?.name || ''}`;

  // Generate dynamic QR URL
  let qrUrl = BASE_QR_URL;
  if (mode === 'donate') {
      qrUrl += "&addInfo=Ung%20ho%20LuomPro";
  } else if (selectedPackage) {
      // Convert price string "149.000" to number 149000
      const numericPrice = parseInt(selectedPackage.price.replace(/\./g, ''), 10);
      if (!isNaN(numericPrice)) {
          qrUrl += `&amount=${numericPrice}`;
      }
      qrUrl += `&addInfo=Nap%20${selectedPackage.name.replace(/\s/g, '%20')}`;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[200] transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 rounded-2xl p-8 border border-zinc-700 shadow-2xl shadow-red-900/30 w-full max-w-md relative transform transition-all duration-300 scale-95 animate-fade-in"
        onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          aria-label="Close donation modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          {selectedPackage && (
              <div className="mb-4">
                  <span className="text-green-400 font-bold text-xl">{selectedPackage.price} VNĐ</span>
                  <span className="text-gray-400 mx-2">/</span>
                  <span className="text-yellow-400 font-bold">{selectedPackage.credits} Credits</span>
              </div>
          )}
          <p className="text-gray-400 mb-6 text-sm">{message}</p>
          
          <div className="bg-white p-2 rounded-lg mb-6 overflow-hidden">
            <img 
                src={qrUrl} 
                alt="Quét mã QR Vietcombank - DANH LUOM" 
                className="w-full h-auto rounded-lg object-contain" 
            />
          </div>

          <div className="mt-4 text-left bg-zinc-800 p-4 rounded-lg border border-zinc-700 shadow-inner">
            <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className="text-gray-400 text-sm">Ngân hàng</span>
                    <span className="font-bold text-white text-lg">Vietcombank</span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className="text-gray-400 text-sm">Chủ tài khoản</span>
                    <span className="font-bold text-red-400 text-md uppercase text-right">DANH LUOM</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                    <span className="text-gray-400 text-sm">Số tài khoản</span>
                    <span className="font-mono font-bold text-green-400 text-xl tracking-wider">1038605000</span>
                </div>
            </div>
          </div>
          
          {mode === 'topup' && (
              <div className="mt-4 text-xs text-yellow-500 bg-yellow-900/20 p-2 rounded border border-yellow-500/30 text-left">
                  <p className="font-bold mb-1">⚠️ Nội dung chuyển khoản bắt buộc:</p>
                  <p className="font-mono bg-black/40 p-1 rounded select-all text-white">
                      [Email đăng nhập của bạn]
                  </p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DonationModal;
