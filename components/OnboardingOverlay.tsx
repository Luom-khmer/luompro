
import React, { useState, useEffect } from 'react';
import { UserCircleIcon, KeyIcon, ArrowRightOnRectangleIcon, CheckCircleIcon, QuestionMarkCircleIcon, LinkIcon } from '@heroicons/react/24/outline';
import firebase from 'firebase/compat/app';

interface OnboardingOverlayProps {
  currentUser: firebase.User | null;
  onLogin: () => void;
  currentApiKey: string;
  onSaveApiKey: (key: string) => void;
}

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ currentUser, onLogin, currentApiKey, onSaveApiKey }) => {
  const [step, setStep] = useState<'login' | 'keys'>('login');
  const [keys, setKeys] = useState<string[]>(['', '', '', '', '']);
  const [isCompleted, setIsCompleted] = useState(false);

  // Tự động chuyển step nếu trạng thái thay đổi
  useEffect(() => {
    if (currentUser) {
      setStep('keys');
    } else {
      setStep('login');
    }
  }, [currentUser]);

  // Load key hiện tại vào các ô input (nếu có)
  useEffect(() => {
    if (currentApiKey && step === 'keys') {
      // Tách key hiện tại theo dấu phẩy hoặc xuống dòng để điền vào các ô
      const existingKeys = currentApiKey.split(/[\n,;]+/).map(k => k.trim()).filter(k => k);
      const newKeys = [...keys];
      existingKeys.forEach((k, i) => {
        if (i < 5) newKeys[i] = k;
      });
      setKeys(newKeys);
    }
  }, [currentApiKey, step]);

  const handleKeyChange = (index: number, value: string) => {
    const newKeys = [...keys];
    newKeys[index] = value;
    setKeys(newKeys);
  };

  const handleSaveKeys = () => {
    // Gộp các key không rỗng thành chuỗi ngăn cách bởi dấu phẩy
    const validKeys = keys.filter(k => k.trim().length > 10).join(',');
    
    if (validKeys.length === 0) {
      alert("Vui lòng nhập ít nhất 1 API Key hợp lệ để tiếp tục.");
      return;
    }

    onSaveApiKey(validKeys);
    setIsCompleted(true);
  };

  // Nếu đã hoàn thành, ẩn overlay (trả về null)
  if (isCompleted && currentUser && currentApiKey) return null;

  // Nếu đã có user và có key từ trước (localStorage) thì cũng coi như hoàn thành (tránh hiện lại khi F5)
  // Tuy nhiên, theo yêu cầu "khi vào app thì hiện", ta có thể bỏ qua check này nếu muốn bắt buộc nhập lại.
  // Ở đây tôi giữ logic: Nếu chưa Login -> Hiện Login. Nếu Login rồi mà chưa có Key -> Hiện Key. 
  // Nếu cả 2 đã có -> Ẩn.
  if (currentUser && currentApiKey && currentApiKey.length > 10 && !isCompleted) return null;


  return (
    <div className="fixed inset-0 z-[9999] bg-[#0f1012] flex flex-col items-center justify-center p-4">
      {/* Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-2xl bg-[#141414] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-fade-in">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-black p-8 text-center border-b border-gray-800">
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
            LUOM PRO <span className="text-red-600">TOOL AI</span>
          </h1>
          <p className="text-gray-400 text-sm font-medium">Hệ thống xử lý ảnh & nội dung tự động</p>
        </div>

        {/* Content */}
        <div className="p-8">
          
          {/* STEP 1: LOGIN */}
          {step === 'login' && (
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-2 animate-pulse">
                <UserCircleIcon className="w-10 h-10 text-gray-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Đăng nhập tài khoản</h2>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  Vui lòng đăng nhập để đồng bộ dữ liệu, lịch sử và sử dụng các tính năng cao cấp của hệ thống.
                </p>
              </div>
              <button 
                onClick={onLogin}
                className="flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all transform hover:scale-105 shadow-lg"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                Đăng nhập với Google
              </button>
            </div>
          )}

          {/* STEP 2: API KEYS */}
          {step === 'keys' && (
            <div className="flex flex-col space-y-6">
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                  <KeyIcon className="w-6 h-6 text-yellow-500" /> Cấu hình Google API Key
                </h2>
                <p className="text-gray-500 text-xs">
                  Nhập tối đa 5 Key để hệ thống tự động đổi khi hết lượt (Quota Exceeded).
                </p>
              </div>

              {/* Instructions Link */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
                <QuestionMarkCircleIcon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-200 font-bold mb-1">Chưa có API Key?</p>
                  <p className="text-gray-400 mb-2 text-xs">Truy cập Google AI Studio để lấy Key miễn phí.</p>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-white font-bold text-xs underline decoration-blue-400/50 hover:decoration-white"
                  >
                    <LinkIcon className="w-3 h-3" /> Lấy Key tại đây (aistudio.google.com)
                  </a>
                </div>
              </div>

              {/* 5 Input Fields */}
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {keys.map((keyVal, idx) => (
                  <div key={idx} className="relative group">
                    <span className="absolute left-3 top-3 text-xs font-bold text-gray-600 group-focus-within:text-gray-400">
                      KEY {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={keyVal}
                      onChange={(e) => handleKeyChange(idx, e.target.value)}
                      placeholder={idx === 0 ? "Bắt buộc nhập ít nhất 1 key..." : "Key dự phòng (Tùy chọn)"}
                      className={`w-full bg-[#0f1012] border rounded-lg py-3 pl-16 pr-4 text-sm text-white focus:outline-none focus:ring-1 transition-all font-mono ${keyVal ? 'border-green-500/50' : 'border-gray-700 focus:border-gray-500'}`}
                    />
                    {keyVal.length > 10 && (
                      <CheckCircleIcon className="absolute right-3 top-3 w-5 h-5 text-green-500" />
                    )}
                  </div>
                ))}
              </div>

              <button 
                onClick={handleSaveKeys}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                Lưu cấu hình & Vào App <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          )}

        </div>
      </div>
      
      <div className="absolute bottom-6 text-gray-600 text-xs font-mono">
        BẢN QUYỀN THUỘC VỀ LUOM PRO TOOL AI
      </div>
    </div>
  );
};

export default OnboardingOverlay;
