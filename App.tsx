
import React, { useState, useEffect } from 'react';
import { generateStyledImage, resizeImage } from './services/geminiService';
import { uploadGommoImage, generateGommoImage, pollGommoImageCompletion, fetchGommoImages, fetchGommoUserInfo, fetchGommoModels } from './services/gommoService';
import { ProcessedImage, GenerationSettings, WeatherOption, StoredImage, ViewMode, GommoModel } from './types';
import { initDB, saveImageToGallery, getGalleryImages } from './services/galleryService';
import { APP_CONFIG } from './config';
import { getFirebaseAuth, loginWithGoogle, logoutUser, listenToUserRealtime, deductUserCredits } from './services/firebaseService';
import firebase from 'firebase/compat/app';

// UI Components
import ControlPanel from './components/ControlPanel';
import ImageCard from './components/ImageCard';
import DonationModal from './components/DonationModal';
import VisitorCounter from './components/VisitorCounter';
import Lightbox from './components/Lightbox';
import ConfirmationModal from './components/ConfirmationModal';
import AdminPanel from './components/AdminPanel';
import SystemNotificationModal from './components/SystemNotificationModal';

import { PhotoIcon, TrashIcon, PlusIcon, CurrencyDollarIcon, ArrowPathIcon, UserCircleIcon, ArrowRightOnRectangleIcon, ShieldCheckIcon, HomeIcon, WalletIcon } from '@heroicons/react/24/outline';

// Default Settings Constant
const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
    userPrompt: '',
    blurAmount: 2.8,
    weather: WeatherOption.NONE,
    lightingEffects: [],
    preservePose: false,
    preserveComposition: false,
    preserveFocalLength: false,
    preserveAspectRatio: false,
    disableForeground: false,
    originalImageCompatibility: false,
    preserveFaceDetail: false, // Default value for new option
    preserveSubjectPosition: true,
    keepOriginalOutfit: false,
    enableUpscale: false,
    restorationCustomPrompt: '',
    minimalCustomization: false,
    referenceImage: null,
    referenceImagePreview: null,
    model: 'gemini-2.5-flash-image',
    aspectRatio: '1:1',
    imageSize: '1K',
    apiKey: '',
    
    // Default to Gemini
    aiProvider: 'gemini',
    // Set a valid default from the provided JSON list
    gommoModel: 'google_image_gen_banana_pro', 
    gommoApiKey: ''
};

const App: React.FC = () => {
  // --- GLOBAL STATE ---
  const [currentView, setCurrentView] = useState<ViewMode>('concept');
  const [isDonationModalOpen, setIsDonationModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  
  // GLOBAL API KEY STATE - Initialize with Config
  const [globalApiKey, setGlobalApiKey] = useState<string>(APP_CONFIG.GEMINI_API_KEY || '');
  const [globalGommoKey, setGlobalGommoKey] = useState<string>(APP_CONFIG.GOMMO_API_KEY || '');
  
  // Credit State
  const [gommoCredits, setGommoCredits] = useState<number | null>(null);
  const [isUpdatingCredits, setIsUpdatingCredits] = useState<boolean>(false);
  
  // User & Local App Credits State
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [userCredits, setUserCredits] = useState<number>(0);

  // Cached Gommo Models to check prices
  const [gommoModelsCache, setGommoModelsCache] = useState<GommoModel[]>([]);

  const handleModelsLoaded = (models: GommoModel[]) => {
     setGommoModelsCache(models);
  };

  // Check if User is Admin
  const isAdmin = React.useMemo(() => {
     if (!currentUser || !currentUser.email) return false;
     return (APP_CONFIG.ADMIN_EMAILS || []).includes(currentUser.email);
  }, [currentUser]);

  // If user logs out while in admin view, redirect to home
  useEffect(() => {
      if (!isAdmin && currentView === 'admin') {
          setCurrentView('concept');
      }
  }, [isAdmin, currentView]);

  // --- CONCEPT MODE STATE (ONLY) ---
  const [conceptImages, setConceptImages] = useState<ProcessedImage[]>([]);
  const [conceptSettings, setConceptSettings] = useState<GenerationSettings>({ ...DEFAULT_GENERATION_SETTINGS });

  const [galleryItems, setGalleryItems] = useState<StoredImage[]>([]);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Lightbox Data
  const [lightboxData, setLightboxData] = useState<{ src: string; originalSrc: string } | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Load Saved API Key
    try {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) setGlobalApiKey(savedKey);
      
      const savedGommoKey = localStorage.getItem('gommo_api_key');
      if (savedGommoKey) setGlobalGommoKey(savedGommoKey);
    } catch (e) { console.error("Key load error", e); }

    // Load Image Gallery
    const loadGallery = async () => {
        try {
            await initDB();
            const items = await getGalleryImages();
            const now = Date.now();
            const valid = items.filter(i => (now - i.timestamp) < 259200000);
            setGalleryItems(valid);
        } catch (e) { console.error("Gallery init error", e); }
    };
    loadGallery();

    // Init Auth Listener & Realtime Credit Listener
    const auth = getFirebaseAuth();
    if (auth) {
        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            if (user) {
                // Subscribe to user credits
                const unsubscribeFirestore = listenToUserRealtime(user.uid, (data) => {
                     if (data && typeof data.credits === 'number') {
                         setUserCredits(data.credits);
                     } else {
                         setUserCredits(0);
                     }
                });
                return () => unsubscribeFirestore();
            } else {
                setUserCredits(0);
            }
        });
        return () => unsubscribeAuth();
    }
  }, []);
  
  // Persist API Key changes & Poll Credits
  useEffect(() => {
      if (globalApiKey) localStorage.setItem('gemini_api_key', globalApiKey);
      if (globalGommoKey) {
          localStorage.setItem('gommo_api_key', globalGommoKey);
          
          // Initial fetch
          updateGommoCredits();
          // Fetch models to know prices
          fetchModelsForPricing();

          // Poll every 15 seconds to keep credits updated (auto update on top-up)
          const interval = setInterval(() => {
              updateGommoCredits(true); // silent update
          }, 15000);

          return () => clearInterval(interval);
      }
  }, [globalApiKey, globalGommoKey]);

  // Helper to fetch credits
  const updateGommoCredits = async (silent = false) => {
      if (!globalGommoKey || globalGommoKey.length < 10) return;
      
      if (!silent) setIsUpdatingCredits(true);
      try {
          const data = await fetchGommoUserInfo(globalGommoKey);
          if (data.balancesInfo && typeof data.balancesInfo.credits_ai === 'number') {
              setGommoCredits(data.balancesInfo.credits_ai);
          } else if (data.success?.data?.credits !== undefined) {
              setGommoCredits(data.success.data.credits);
          }
      } catch (e) {
          if (!silent) console.warn("Failed to fetch credits", e);
      } finally {
          if (!silent) setIsUpdatingCredits(false);
      }
  };
  
  const fetchModelsForPricing = async () => {
      if (!globalGommoKey) return;
      try {
          const response = await fetchGommoModels(globalGommoKey, 'image');
           let models: GommoModel[] = [];
          if (response?.success?.data && Array.isArray(response.success.data)) {
              models = response.success.data;
          } else if (response?.data && Array.isArray(response.data)) {
              models = response.data;
          }
          setGommoModelsCache(models);
      } catch (e) { console.warn("Pricing fetch failed", e); }
  }

  const handleLogin = async () => {
      try {
          await loginWithGoogle();
      } catch (error: any) {
          alert("Đăng nhập thất bại: " + error.message);
      }
  };

  const handleLogout = async () => {
      const confirm = window.confirm("Bạn có chắc chắn muốn đăng xuất?");
      if (confirm) {
          await logoutUser();
      }
  };

  // --- IMAGE LOGIC ---
  const handleImageUpload = (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
      if (files.length === 0) return;
      
      const initialStatus = 'idle';
      const defaultSelected = false;

      const newImgs: ProcessedImage[] = files.map(file => ({
          id: crypto.randomUUID(),
          originalPreviewUrl: URL.createObjectURL(file),
          file: file,
          status: initialStatus,
          isSelected: defaultSelected
      }));
      
      setConceptImages(prev => [...prev, ...newImgs]); 
  };

  const generateSingleImage = async (file: File, id: string) => {
      // 1. CHECK LOGIN
      if (!currentUser) {
          alert("Vui lòng đăng nhập để sử dụng tính năng.");
          return;
      }

      // 2. CALCULATE COST
      const provider = conceptSettings.aiProvider || 'gemini';
      let estimatedCost = 1; // Default Gemini Cost

      if (provider === 'gommo') {
          const modelId = conceptSettings.gommoModel || 'google_image_gen_banana_pro';
          const modelInfo = gommoModelsCache.find(m => m.model === modelId);
          // Fix: Check strictly for number type to allow 0 cost
          if (modelInfo && typeof modelInfo.price === 'number') {
              estimatedCost = modelInfo.price;
          } else {
              estimatedCost = 4; // Fallback cost for Gommo if unknown
          }
      }

      // 3. CHECK BALANCE (But don't deduct yet)
      if (userCredits < estimatedCost) {
          alert(`Số dư không đủ! Cần ${estimatedCost} credits, bạn đang có ${userCredits}.\nVui lòng liên hệ Admin để nạp thêm.`);
          // Đánh dấu ảnh là lỗi do thiếu tiền
          setConceptImages(prev => prev.map(p => p.id === id ? { ...p, status: 'error', error: 'Không đủ Credits' } : p));
          return;
      }

      // NO DEDUCTION HERE - WE DEDUCT ON SUCCESS ONLY

      setIsImageProcessing(true);
      // Update status to generating
      setConceptImages(prev => prev.map(p => p.id === id ? { ...p, status: 'generating', error: undefined } : p));
      
      try {
        let url = '';
        
        // Merge Global Keys
        const finalSettings = { 
            ...conceptSettings, 
            apiKey: globalApiKey,
            gommoApiKey: globalGommoKey
        };
        
        if (provider === 'gommo') {
             // --- GOMMO WORKFLOW ---
             if (!finalSettings.gommoApiKey) throw new Error("Vui lòng nhập Gommo Access Token.");
             
             // Optimize and Resize Image for Gommo
             const base64Data = await resizeImage(file, 1024, 1024, 0.9);
             
             // Create/Edit (Standard Gen)
             const modelId = finalSettings.gommoModel || 'google_image_gen_banana_pro';
             let prompt = finalSettings.userPrompt || "Enhance image";
             
             // Map Aspect Ratio from Settings to Gommo Format
             let gommoRatio = '1_1';
             if (finalSettings.aspectRatio) {
                 const raw = finalSettings.aspectRatio.replace(/\s*•.*/, ''); 
                 if (raw === 'auto') {
                     gommoRatio = 'auto';
                 } else {
                     gommoRatio = raw.replace(':', '_');
                 }
             }

             let gommoResolution = (finalSettings.imageSize || '1k').toLowerCase();
             
             let mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
             const fullBase64 = `data:${mimeType};base64,${base64Data}`;

             // Start Generation (Async)
             const genRes = await generateGommoImage(
                 finalSettings.gommoApiKey, 
                 modelId, 
                 prompt, 
                 {
                    editImage: true, 
                    base64Image: fullBase64, 
                    ratio: gommoRatio,
                    resolution: gommoResolution // Passed correct resolution here
                 }
             );

             // New API structure check
             if (genRes.success && genRes.success.imageInfo && genRes.success.imageInfo.url) {
                 url = genRes.success.imageInfo.url;
             } else if (genRes.imageInfo?.url) {
                 url = genRes.imageInfo.url;
             } else {
                 throw new Error("Gommo không trả về URL ảnh.");
             }
             
             updateGommoCredits();

        } else {
            // --- GEMINI WORKFLOW ---
            url = await generateStyledImage(file, finalSettings);
        }
        
        // --- SUCCESS LOGIC: DEDUCT CREDITS NOW ---
        if (estimatedCost > 0) {
            try {
                await deductUserCredits(currentUser.uid, estimatedCost);
            } catch (deductErr) {
                console.error("Lỗi trừ credits sau khi tạo (Ignored):", deductErr);
                // Người dùng đã nhận ảnh, lỗi trừ tiền ở đây không nên chặn hiển thị ảnh
            }
        }

        setConceptImages(prev => prev.map(p => p.id === id ? { ...p, status: 'completed', generatedImageUrl: url } : p));
        
        // Save to gallery
        const newItem: StoredImage = { id: crypto.randomUUID(), url, timestamp: Date.now() };
        await saveImageToGallery(newItem);
        setGalleryItems(prev => [newItem, ...prev]);

      } catch (e: any) {
        // --- ERROR LOGIC ---
        // Không cần hoàn tiền vì chưa trừ
        
        const errorMessage = e.message || 'Lỗi tạo ảnh';
        setConceptImages(prev => prev.map(p => p.id === id ? { ...p, status: 'error', error: errorMessage } : p));
        alert(`Tạo ảnh thất bại: ${errorMessage}. (Không bị trừ Credits)`);
      } finally {
        setIsImageProcessing(false);
      }
  };

  // --- GOMMO GALLERY SYNC ---
  const handleSyncGommoGallery = async () => {
      // Feature not fully supported in new API list provided, but keeping stub
      if (!globalGommoKey) {
          alert("Vui lòng nhập và lưu Gommo Access Token trước khi đồng bộ.");
          return;
      }
      setIsImageProcessing(true);
      try {
          const response = await fetchGommoImages(globalGommoKey);
          // If empty array, show alert
          if (response.data && response.data.length > 0) {
             // ... sync logic
             alert("Đồng bộ hoàn tất (Demo Mode: API chưa hỗ trợ list)");
          } else {
             alert("Chưa có ảnh nào trên hệ thống hoặc API chưa hỗ trợ.");
          }
      } catch (error: any) {
          console.error("Sync error", error);
          alert(error.message || "Lỗi đồng bộ thư viện ảnh.");
      } finally {
          setIsImageProcessing(false);
      }
  };

  const handleRegenerateImage = async (item: ProcessedImage) => {
     if (item.status === 'generating') return; 
     try {
         let file = item.file;
         if (!file) {
            const resp = await fetch(item.originalPreviewUrl);
            const blob = await resp.blob();
            file = new File([blob], "retry.jpg", { type: blob.type });
         }
         generateSingleImage(file, item.id);
     } catch (e) {
         alert("Không thể tải lại ảnh gốc.");
     }
  };
  
  const handleSelectFromGallery = async (item: StoredImage) => {
      try {
          const resp = await fetch(item.url);
          const blob = await resp.blob();
          const file = new File([blob], `gallery_${item.id}.jpg`, { type: blob.type });
          handleImageUpload([file]);
      } catch (e) { alert("Lỗi tải ảnh từ thư viện"); }
  };

  const openLightbox = (img: ProcessedImage) => {
      const src = (img.status === 'completed' && img.generatedImageUrl) 
        ? img.generatedImageUrl 
        : img.originalPreviewUrl;
      
      setLightboxData({
          src: src,
          originalSrc: img.originalPreviewUrl
      });
  };

  // --- BATCH ACTIONS ---
  const handleDeleteAll = () => {
      if (conceptImages.length > 0) setIsDeleteModalOpen(true);
  };
  
  const confirmDeleteAll = () => {
      setConceptImages([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0f1012] text-gray-200 font-sans overflow-hidden">
        {/* APP HEADER */}
        <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#141414] relative">
             <div className="w-1/3 flex items-center justify-start gap-3">
                 {/* Only show "Delete All" in Concept Mode */}
                 {currentView === 'concept' && (
                    <button 
                        onClick={handleDeleteAll}
                        className="flex items-center gap-2 px-4 py-2 bg-[#141414] border border-gray-700 hover:border-red-600 hover:bg-red-900/50 rounded transition-all text-xs font-semibold text-gray-300 hover:text-red-400 uppercase tracking-wide shadow-sm"
                    >
                            <TrashIcon className="w-3.5 h-3.5 stroke-[2px]" />
                            Xoá tất cả ảnh
                    </button>
                 )}
                 {currentView === 'admin' && (
                     <button 
                         onClick={() => setCurrentView('concept')}
                         className="flex items-center gap-2 px-4 py-2 bg-[#141414] border border-gray-700 hover:border-blue-600 hover:bg-blue-900/50 rounded transition-all text-xs font-semibold text-gray-300 hover:text-blue-400 uppercase tracking-wide shadow-sm"
                     >
                         <HomeIcon className="w-3.5 h-3.5 stroke-[2px]" />
                         Về trang chủ
                     </button>
                 )}
             </div>

             <div className="flex flex-col items-center text-center w-1/3">
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tighter text-white whitespace-nowrap">
                  LUOM PRO <span className="text-red-600">TOOL AI</span>
                </h1>
                <p className="text-zinc-500 text-[10px] font-medium tracking-wide mt-1">
                    FAKE CONCEPT STUDIO
                </p>
             </div>

             <div className="flex items-center gap-3 justify-end w-1/3">
                {/* ADMIN BUTTON (Visible only if isAdmin) */}
                {isAdmin && (
                    <button 
                        onClick={() => setCurrentView(currentView === 'admin' ? 'concept' : 'admin')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-all whitespace-nowrap border ${currentView === 'admin' ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-red-500'}`}
                        title="Trang quản trị"
                    >
                        <ShieldCheckIcon className="w-4 h-4" />
                        Admin
                    </button>
                )}

                {/* LOGIN / USER SECTION */}
                {currentUser ? (
                    <div className="flex items-center gap-3 mr-2">
                        {/* USER WALLET DISPLAY */}
                         <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/50 border border-gray-600 rounded-full text-sm font-bold shadow-inner" title="Số dư App">
                            <WalletIcon className={`w-4 h-4 ${userCredits > 0 ? 'text-green-400' : 'text-red-400'}`} />
                            <span className={userCredits > 0 ? 'text-green-400' : 'text-red-400'}>{userCredits.toLocaleString()}</span>
                         </div>

                        <div className="flex items-center gap-2">
                             {currentUser.photoURL ? (
                                <img src={currentUser.photoURL} alt="User" className="w-7 h-7 rounded-full border border-gray-600" />
                            ) : (
                                <UserCircleIcon className="w-7 h-7 text-gray-400" />
                            )}
                            <span className="hidden xl:inline text-xs font-bold text-gray-300 truncate max-w-[100px]">{currentUser.displayName}</span>
                            <button onClick={handleLogout} title="Đăng xuất" className="text-gray-500 hover:text-red-400 transition-colors">
                                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={handleLogin}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 rounded text-gray-300 text-sm font-bold shadow-sm transition-all mr-2 whitespace-nowrap"
                    >
                        <UserCircleIcon className="w-4 h-4" />
                        Đăng nhập
                    </button>
                )}

                {/* Credit Display - Only show for Admin */}
                {isAdmin && gommoCredits !== null && (
                   <button 
                        onClick={() => updateGommoCredits(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-900/20 border border-teal-500/30 rounded text-teal-400 text-sm font-bold shadow-sm animate-fade-in whitespace-nowrap hover:bg-teal-900/40 transition-colors focus:outline-none" 
                        title="Số dư Gommo API - Nhấn để cập nhật"
                   >
                       {isUpdatingCredits ? (
                           <ArrowPathIcon className="w-4 h-4 text-teal-500 animate-spin" />
                       ) : (
                           <CurrencyDollarIcon className="w-4 h-4 text-teal-500" />
                       )}
                       <span className="text-white">{gommoCredits.toLocaleString()}</span>
                       <span className="text-[10px] text-teal-500/70 font-normal">api</span>
                   </button>
                )}

                <button onClick={() => setIsDonationModalOpen(true)} className="text-yellow-500 hover:text-yellow-400 text-sm font-medium flex items-center gap-1 whitespace-nowrap border border-yellow-500/30 px-3 py-1.5 rounded hover:bg-yellow-500/10 transition-colors">
                    ☕ Donate
                </button>
                <div className="hidden sm:block">
                    <VisitorCounter />
                </div>
             </div>
        </header>

        {/* MAIN BODY SWITCHER */}
        <div className="flex-1 overflow-hidden relative">
            {currentView === 'admin' ? (
                // ADMIN VIEW
                <AdminPanel currentUser={currentUser} gommoCredits={gommoCredits} />
            ) : (
                // CONCEPT VIEW (Standard)
                <div className="flex flex-row h-[calc(100vh-80px)] w-full overflow-hidden">
                    <main className="flex-1 flex flex-col bg-[#0f1012] min-h-0">
                        <div 
                            className={`flex-1 overflow-y-auto p-6 scroll-smooth relative transition-colors ${isDragging ? 'bg-gray-900/50' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleImageUpload(e.dataTransfer.files); }}
                        >
                            {conceptImages.length === 0 ? (
                                // EMPTY STATE
                                <div className="h-full flex flex-col items-center justify-center pb-20">
                                    <label className="group relative w-full max-w-3xl h-48 border border-dashed border-gray-600 hover:border-sky-500 bg-[#151515] hover:bg-[#1a1a1a] rounded-2xl cursor-pointer transition-all duration-300 flex items-center justify-center gap-6 shadow-xl hover:shadow-sky-500/10 overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                        <div className="relative w-16 h-16 rounded-full bg-[#222] group-hover:bg-sky-500/20 border border-gray-700 group-hover:border-sky-500 flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-lg">
                                            <PlusIcon className="w-8 h-8 text-gray-400 group-hover:text-sky-400 transition-colors" />
                                        </div>
                                        <div className="relative flex flex-col items-start z-10">
                                            <span className="text-xl font-bold text-gray-300 group-hover:text-white transition-colors uppercase tracking-wide">
                                                Thêm ảnh Concept
                                            </span>
                                            <span className="text-sm text-gray-500 group-hover:text-gray-400 mt-1 flex items-center gap-2">
                                                <PhotoIcon className="w-4 h-4" /> Hỗ trợ JPG, PNG, WEBP
                                            </span>
                                        </div>
                                        <input type="file" multiple onChange={(e) => e.target.files && handleImageUpload(e.target.files)} className="hidden" accept="image/*" />
                                    </label>
                                </div>
                            ) : (
                                // POPULATED STATE: GRID
                                <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-20 items-stretch transition-all duration-500`}>
                                    {conceptImages.map(img => (
                                        <div key={img.id} className="h-auto">
                                        <ImageCard 
                                            item={img} 
                                            onToggleSelect={(id) => setConceptImages(p => p.map(x => x.id === id ? { ...x, isSelected: !x.isSelected } : x))}
                                            onDelete={(id) => setConceptImages(p => p.filter(x => x.id !== id))}
                                            onRegenerate={handleRegenerateImage}
                                            onDoubleClick={() => openLightbox(img)}
                                            onView={() => openLightbox(img)}
                                        />
                                        </div>
                                    ))}
                                    <label 
                                    className="border-2 border-dashed border-gray-700 bg-[#151515] hover:bg-[#1a1a1a] hover:border-gray-500 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group min-h-[300px]"
                                    title="Thêm ảnh mới"
                                    >
                                        <div className="bg-gray-800 group-hover:bg-gray-700 p-4 rounded-full transition-colors mb-4">
                                            <PlusIcon className="w-8 h-8 text-gray-400 group-hover:text-white" />
                                        </div>
                                        <span className="text-gray-400 group-hover:text-white font-medium text-sm">Thêm ảnh</span>
                                        <input type="file" multiple onChange={(e) => e.target.files && handleImageUpload(e.target.files)} className="hidden" accept="image/*" />
                                    </label>
                                </div>
                            )}
                        </div>
                    </main>
                    
                    <aside className="w-[400px] shrink-0 border-l border-gray-800 bg-[#111]">
                        <ControlPanel 
                            settings={{...conceptSettings, apiKey: globalApiKey, gommoApiKey: globalGommoKey}}
                            onSettingsChange={(newS) => {
                                if(newS.apiKey !== undefined) setGlobalApiKey(newS.apiKey);
                                if(newS.gommoApiKey !== undefined) setGlobalGommoKey(newS.gommoApiKey);
                                setConceptSettings(prev => ({ ...prev, ...newS }));
                            }}
                            isProcessing={isImageProcessing}
                            galleryItems={galleryItems}
                            onSelectFromGallery={handleSelectFromGallery}
                            onSyncGallery={handleSyncGommoGallery}
                            viewMode={'concept'}
                            setViewMode={() => {}}
                            isAdmin={isAdmin}
                            onModelsLoaded={handleModelsLoaded}
                        />
                    </aside>
                </div>
            )}
        </div>

        {/* System Notification Popup */}
        <SystemNotificationModal />

        <DonationModal isOpen={isDonationModalOpen} onClose={() => setIsDonationModalOpen(false)} />
        {lightboxData && (
            <Lightbox 
                isOpen={!!lightboxData} 
                src={lightboxData.src}
                originalSrc={lightboxData.originalSrc}
                onClose={() => setLightboxData(null)} 
            />
        )}
        <ConfirmationModal 
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={confirmDeleteAll}
            title="Xoá Tất Cả Ảnh?"
            message="Hành động này sẽ xoá toàn bộ ảnh đang làm việc. Ảnh đã lưu trong 'Kho Ảnh' sẽ KHÔNG bị xoá."
            confirmLabel="Xoá"
            cancelLabel="Không Xoá"
        />
    </div>
  );
};

export default App;
