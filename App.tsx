import React, { useState, useEffect } from 'react';
import { generateStyledImage, resizeImage } from './services/geminiService';
import { uploadGommoImage, generateGommoImage, pollGommoImageCompletion, fetchGommoImages, fetchGommoUserInfo, fetchGommoModels, upscaleGommoImage } from './services/gommoService';
import { ProcessedImage, GenerationSettings, WeatherOption, StoredImage, ViewMode, GommoModel, PricingPackage } from './types';
import { initDB, saveImageToGallery, getGalleryImages } from './services/galleryService';
import { APP_CONFIG } from './config';
import { getFirebaseAuth, loginWithGoogle, logoutUser, listenToUserRealtime, deductUserCredits } from './services/firebaseService';
import firebase from 'firebase/compat/app';

// UI Components
import ControlPanel from './components/ControlPanel';
import ImageCard from './components/ImageCard';
import DonationModal from './components/DonationModal';
import PricingModal from './components/PricingModal';
import VisitorCounter from './components/VisitorCounter';
import Lightbox from './components/Lightbox';
import ConfirmationModal from './components/ConfirmationModal';
import AdminPanel from './components/AdminPanel';
import SystemNotificationModal from './components/SystemNotificationModal';
import LandingPage from './components/LandingPage';
import RestorationStudio from './components/RestorationStudio';
import GenerativeFillStudio from './components/GenerativeFillStudio';
import CreativeStudio from './components/CreativeStudio'; // Import mới

import { PhotoIcon, PlusIcon, WalletIcon, Squares2X2Icon, ShieldCheckIcon, HomeIcon, TrashIcon, CurrencyDollarIcon, UserCircleIcon, ArrowRightOnRectangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

// Default Settings Constant - FORCED GOMMO PROVIDER
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
    preserveFaceDetail: false, 
    preserveSubjectPosition: true,
    keepOriginalOutfit: false,
    enableUpscale: false,
    restorationCustomPrompt: '',
    minimalCustomization: false,
    referenceImage: null,
    referenceImagePreview: null,
    model: 'gemini-2.5-flash-image', // Placeholder, not used in Gommo mode mostly
    aspectRatio: '1:1',
    imageSize: '1K',
    apiKey: '',
    
    // ENFORCE GOMMO AS DEFAULT
    aiProvider: 'gommo',
    gommoModel: 'google_image_gen_banana_pro', 
    gommoApiKey: '',
    gommoMode: undefined,
    gommoResolution: undefined,
    quantity: 1
};

const App: React.FC = () => {
  // --- GLOBAL STATE ---
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  
  // Modal States
  const [isDonationModalOpen, setIsDonationModalOpen] = useState<boolean>(false);
  const [donationModalMode, setDonationModalMode] = useState<'donate' | 'topup'>('donate');
  const [isPricingModalOpen, setIsPricingModalOpen] = useState<boolean>(false); 
  const [selectedPricingPackage, setSelectedPricingPackage] = useState<PricingPackage | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  
  // GLOBAL API KEY STATE
  const [globalApiKey, setGlobalApiKey] = useState<string>(APP_CONFIG.GEMINI_API_KEY || '');
  const [globalGommoKey, setGlobalGommoKey] = useState<string>(APP_CONFIG.GOMMO_API_KEY || '');
  
  // Credit State
  const [gommoCredits, setGommoCredits] = useState<number | null>(null);
  const [isUpdatingCredits, setIsUpdatingCredits] = useState<boolean>(false);
  
  // User & Local App Credits State
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [userCredits, setUserCredits] = useState<number>(0);

  // Cached Gommo Models
  const [gommoModelsCache, setGommoModelsCache] = useState<GommoModel[]>([]);

  const handleModelsLoaded = (models: GommoModel[]) => {
     setGommoModelsCache(models);
  };

  const isAdmin = React.useMemo(() => {
     if (!currentUser || !currentUser.email) return false;
     return (APP_CONFIG.ADMIN_EMAILS || []).includes(currentUser.email);
  }, [currentUser]);

  useEffect(() => {
      if (!isAdmin && currentView === 'admin') {
          setCurrentView('home');
      }
  }, [isAdmin, currentView]);

  // --- CONCEPT MODE STATE ---
  const [conceptImages, setConceptImages] = useState<ProcessedImage[]>([]);
  const [conceptSettings, setConceptSettings] = useState<GenerationSettings>({ ...DEFAULT_GENERATION_SETTINGS });

  // --- HACK CONCEPT MODE STATE ---
  const [hackConceptImages, setHackConceptImages] = useState<ProcessedImage[]>([]);
  const [hackConceptSettings, setHackConceptSettings] = useState<GenerationSettings>({ ...DEFAULT_GENERATION_SETTINGS });

  const [galleryItems, setGalleryItems] = useState<StoredImage[]>([]);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [lightboxData, setLightboxData] = useState<{ src: string; originalSrc: string } | null>(null);

  const activeImages = currentView === 'hack-concept' ? hackConceptImages : conceptImages;
  const setActiveImages = currentView === 'hack-concept' ? setHackConceptImages : setConceptImages;
  const activeSettings = currentView === 'hack-concept' ? hackConceptSettings : conceptSettings;
  const setActiveSettings = currentView === 'hack-concept' ? setHackConceptSettings : setConceptSettings;

  // --- INITIALIZATION ---
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) setGlobalApiKey(savedKey);
      
      const savedGommoKey = localStorage.getItem('gommo_api_key');
      if (savedGommoKey) setGlobalGommoKey(savedGommoKey);
    } catch (e) { console.error("Key load error", e); }

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

    const auth = getFirebaseAuth();
    if (auth) {
        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            if (user) {
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
  
  useEffect(() => {
      if (globalApiKey) localStorage.setItem('gemini_api_key', globalApiKey);
      if (globalGommoKey) {
          localStorage.setItem('gommo_api_key', globalGommoKey);
          updateGommoCredits();
          fetchModelsForPricing();
          const interval = setInterval(() => {
              updateGommoCredits(true);
          }, 15000);
          return () => clearInterval(interval);
      }
  }, [globalApiKey, globalGommoKey]);

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
      
      setActiveImages(prev => [...prev, ...newImgs]); 
  };

  const generateSingleImage = async (file: File, id: string) => {
      if (!currentUser) {
          alert("Vui lòng đăng nhập để sử dụng tính năng.");
          return;
      }

      // STRICT PROVIDER ENFORCEMENT: ALWAYS GOMMO
      const provider = 'gommo'; 
      let estimatedCost = 0; 

      if (provider === 'gommo') {
          const modelId = activeSettings.gommoModel || 'google_image_gen_banana_pro';
          const modelInfo = gommoModelsCache.find(m => m.model === modelId);
          
          if (modelInfo) {
              // Calculate dynamic price based on mode and resolution
              if (modelInfo.prices && modelInfo.prices.length > 0) {
                  const mode = activeSettings.gommoMode;
                  const res = activeSettings.gommoResolution || activeSettings.imageSize;
                  const matched = modelInfo.prices.find(p => {
                      const modeMatch = !p.mode || p.mode === mode;
                      const resMatch = !p.resolution || p.resolution === res;
                      return modeMatch && resMatch;
                  });
                  estimatedCost = matched ? matched.price : (modelInfo.price || 150);
              } else {
                  estimatedCost = modelInfo.price || 150;
              }
          } else {
              estimatedCost = 150; // Fallback
          }
      }

      if (userCredits < estimatedCost) {
          alert(`Số dư không đủ! Cần ${estimatedCost} credits, bạn đang có ${userCredits}.\nVui lòng liên hệ Admin để nạp thêm.`);
          setActiveImages(prev => prev.map(p => p.id === id ? { ...p, status: 'error', error: 'Không đủ Credits' } : p));
          return;
      }

      setIsImageProcessing(true);
      setActiveImages(prev => prev.map(p => p.id === id ? { ...p, status: 'generating', error: undefined } : p));
      
      try {
        let url = '';
        
        const finalSettings = { 
            ...activeSettings, 
            apiKey: globalApiKey,
            gommoApiKey: globalGommoKey
        };
        
        if (provider === 'gommo') {
             if (!finalSettings.gommoApiKey) throw new Error("Vui lòng nhập Gommo Access Token.");
             
             // UPDATED: Resize quality to 0.5 to fix 524 Timeout
             const base64Data = await resizeImage(file, 1024, 1024, 0.5);
             
             const modelId = finalSettings.gommoModel || 'google_image_gen_banana_pro';
             let prompt = finalSettings.userPrompt || "Enhance image";
             
             // Handle Ratio format from JSON (e.g. 1_1, 16_9) or default
             let gommoRatio = '1_1';
             if (finalSettings.aspectRatio) {
                 const raw = finalSettings.aspectRatio.replace(/\s*•.*/, ''); 
                 if (raw === 'auto') {
                     gommoRatio = 'auto';
                 } else {
                     gommoRatio = raw.replace(':', '_');
                 }
             }

             // Resolution logic
             let gommoResolution = (finalSettings.gommoResolution || finalSettings.imageSize || '1k').toLowerCase();
             
             let mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
             const fullBase64 = `data:${mimeType};base64,${base64Data}`;

             let projectId = 'default';
             let subjectsPayload: any[] | undefined = undefined;

             if (currentView === 'hack-concept') {
                 projectId = crypto.randomUUID(); 
                 subjectsPayload = [];
                 subjectsPayload.push({ data: fullBase64 });

                 if (finalSettings.referenceImage) {
                     // UPDATED: Resize ref image to 0.5 quality
                     const refBase64Raw = await resizeImage(finalSettings.referenceImage, 1024, 1024, 0.5);
                     const refMime = finalSettings.referenceImage.type || 'image/jpeg';
                     subjectsPayload.push({
                         data: `data:${refMime};base64,${refBase64Raw}`
                     });
                 }
             }

             const genRes = await generateGommoImage(
                 finalSettings.gommoApiKey, 
                 modelId, 
                 prompt, 
                 {
                    editImage: true, 
                    base64Image: fullBase64, 
                    ratio: gommoRatio,
                    resolution: gommoResolution,
                    project_id: projectId,
                    subjects: subjectsPayload,
                    mode: finalSettings.gommoMode // Pass the mode (fast, relaxed, etc.)
                 }
             );

             if (genRes.success && genRes.success.imageInfo) {
                 const info = genRes.success.imageInfo;
                 if (info.url) {
                    url = info.url;
                 } else if (info.id_base) {
                     url = await pollGommoImageCompletion(finalSettings.gommoApiKey, info.id_base);
                 }
             } else if (genRes.imageInfo) {
                 const info = genRes.imageInfo;
                 if (info.url) {
                     url = info.url;
                 } else if (info.id_base) {
                     url = await pollGommoImageCompletion(finalSettings.gommoApiKey, info.id_base);
                 }
             }
             
             if (!url) {
                 throw new Error("Gommo không trả về URL ảnh sau khi hoàn tất.");
             }
             
             updateGommoCredits();

        } else {
            // FALLBACK BLOCK - SHOULD NOT REACH HERE IF GOMMO ENFORCED
            throw new Error("Chức năng tạo ảnh bằng Google API đã bị tắt theo yêu cầu.");
        }
        
        if (estimatedCost > 0) {
            try {
                await deductUserCredits(currentUser.uid, estimatedCost);
            } catch (deductErr) {
                console.error("Lỗi trừ credits sau khi tạo (Ignored):", deductErr);
            }
        }

        setActiveImages(prev => prev.map(p => p.id === id ? { ...p, status: 'completed', generatedImageUrl: url } : p));
        
        const newItem: StoredImage = { id: crypto.randomUUID(), url, timestamp: Date.now() };
        await saveImageToGallery(newItem);
        setGalleryItems(prev => [newItem, ...prev]);

      } catch (e: any) {
        const errorMessage = e.message || 'Lỗi tạo ảnh';
        setActiveImages(prev => prev.map(p => p.id === id ? { ...p, status: 'error', error: errorMessage } : p));
        alert(`Tạo ảnh thất bại: ${errorMessage}. (Không bị trừ Credits)`);
      } finally {
        setIsImageProcessing(false);
      }
  };

  const handleUpscaleImage = async (item: ProcessedImage) => {
      // ... existing upscale logic ...
      if (!currentUser) return alert("Vui lòng đăng nhập.");
      if (!globalGommoKey) return alert("Chưa cấu hình Gommo API Key.");

      setIsImageProcessing(true);
      try {
          let targetUrl = item.generatedImageUrl;
          if (!targetUrl) throw new Error("Không tìm thấy ảnh.");

          if (targetUrl.startsWith('data:')) {
               const base64 = targetUrl.split(',')[1];
               const uploadRes = await uploadGommoImage(globalGommoKey, base64);
               if (uploadRes.imageInfo?.url || uploadRes.success?.imageInfo?.url) {
                   targetUrl = uploadRes.imageInfo?.url || uploadRes.success?.imageInfo?.url;
               } else {
                   throw new Error("Lỗi upload ảnh tạm thời.");
               }
          }

          if (!targetUrl) throw new Error("URL ảnh không hợp lệ.");

          const res = await upscaleGommoImage(globalGommoKey, targetUrl, 'hack-concept-upscale');
          
          let newUrl = '';
          const info = res.imageInfo || (res.success ? res.success.imageInfo : null);

          if (info) {
               if (info.url) newUrl = info.url;
               else if (info.id_base) newUrl = await pollGommoImageCompletion(globalGommoKey, info.id_base);
          }
          
          if (newUrl) {
               const newImage: ProcessedImage = {
                   id: crypto.randomUUID(),
                   originalPreviewUrl: item.originalPreviewUrl,
                   generatedImageUrl: newUrl,
                   status: 'completed',
                   isSelected: true,
                   file: item.file
               };
               setActiveImages(prev => [newImage, ...prev]);
               if (res.balancesInfo?.credits_ai) setGommoCredits(res.balancesInfo.credits_ai);
               await saveImageToGallery({ id: newImage.id, url: newUrl, timestamp: Date.now() });
               alert("Upscale thành công!");
          } else {
               throw new Error(res.message || "Upscale thất bại.");
          }

      } catch (e: any) {
          alert("Lỗi Upscale: " + e.message);
      } finally {
          setIsImageProcessing(false);
      }
  };

  // ... (Rest of existing functions like handleSyncGommoGallery, handleRegenerateImage remain unchanged) ...
  // Re-inserting handleSyncGommoGallery and others to ensure file completeness
  const handleSyncGommoGallery = async () => {
      if (!globalGommoKey) return alert("Vui lòng nhập và lưu Gommo Access Token trước khi đồng bộ.");
      setIsImageProcessing(true);
      try {
          const projectsToSync = ['default'];
          if (currentView === 'hack-concept') projectsToSync.push('hack-concept-upscale');

          let totalSynced = 0;
          for (const pid of projectsToSync) {
              try {
                  const response = await fetchGommoImages(globalGommoKey, pid);
                  if (response.data && Array.isArray(response.data)) {
                     const newItems = response.data
                        .filter((img: any) => img.status === 'SUCCESS' && img.url)
                        .map((img: any) => ({
                            id: img.id_base || crypto.randomUUID(),
                            url: img.url,
                            timestamp: img.created_at ? img.created_at * 1000 : Date.now()
                        }));
                     for (const item of newItems) await saveImageToGallery(item);
                     if (newItems.length > 0) totalSynced += newItems.length;
                  }
              } catch (e) { console.warn("Sync error", e); }
          }
          const updated = await getGalleryImages();
          setGalleryItems(updated);
          alert(totalSynced > 0 ? `Đã đồng bộ ${totalSynced} ảnh mới từ hệ thống.` : "Tất cả ảnh đã được cập nhật (Không có ảnh mới).");
      } catch (error: any) { alert(error.message); } finally { setIsImageProcessing(false); }
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
     } catch (e) { alert("Lỗi tải ảnh gốc."); }
  };
  
  const handleSelectFromGallery = async (item: StoredImage) => {
      try {
          const resp = await fetch(item.url);
          const blob = await resp.blob();
          const file = new File([blob], `gallery_${item.id}.jpg`, { type: blob.type });
          handleImageUpload([file]);
      } catch (e) { alert("Lỗi tải ảnh."); }
  };

  const openLightbox = (img: ProcessedImage) => {
      setLightboxData({ src: (img.status === 'completed' && img.generatedImageUrl) ? img.generatedImageUrl : img.originalPreviewUrl, originalSrc: img.originalPreviewUrl });
  };

  const handleDeleteAll = () => { if (activeImages.length > 0) setIsDeleteModalOpen(true); };
  const confirmDeleteAll = () => { setActiveImages([]); };
  
  const handlePackageSelection = (pkg: PricingPackage) => {
      setIsPricingModalOpen(false);
      if (pkg.id === 'unlimited') return alert("Sắp ra mắt!");
      setSelectedPricingPackage(pkg);
      setDonationModalMode('topup');
      setIsDonationModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0f1012] text-gray-200 font-sans overflow-hidden">
        <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#141414] relative z-50">
             <div className="w-1/3 flex items-center justify-start gap-3">
                 <a href="https://www.facebook.com/luom68g1" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-9 h-9 rounded-full bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/30 text-[#1877F2] transition-all hover:scale-105" title="Facebook Fanpage">
                    <svg fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                        <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-2.048 0-2.606.492-2.606 1.691v1.861h3.888l-.536 3.669h-3.352v7.98h-5.208Z" />
                    </svg>
                 </a>
                 {currentView !== 'home' && (
                     <button onClick={() => setCurrentView('home')} className="flex items-center gap-2 px-4 py-2 bg-[#141414] border border-gray-700 hover:border-blue-600 hover:bg-blue-900/50 rounded transition-all text-xs font-semibold text-gray-300 hover:text-blue-400 uppercase tracking-wide shadow-sm">
                         <Squares2X2Icon className="w-3.5 h-3.5 stroke-[2px]" /> Chọn Công Cụ
                     </button>
                 )}
                 {(currentView === 'concept' || currentView === 'hack-concept') && (
                    <button onClick={handleDeleteAll} className="flex items-center gap-2 px-4 py-2 bg-[#141414] border border-gray-700 hover:border-red-600 hover:bg-red-900/50 rounded transition-all text-xs font-semibold text-gray-300 hover:text-red-400 uppercase tracking-wide shadow-sm">
                            <TrashIcon className="w-3.5 h-3.5 stroke-[2px]" /> Xoá tất cả ảnh
                    </button>
                 )}
                 {currentView === 'admin' && (
                     <button onClick={() => setCurrentView('home')} className="flex items-center gap-2 px-4 py-2 bg-[#141414] border border-gray-700 hover:border-blue-600 hover:bg-blue-900/50 rounded transition-all text-xs font-semibold text-gray-300 hover:text-blue-400 uppercase tracking-wide shadow-sm">
                         <HomeIcon className="w-3.5 h-3.5 stroke-[2px]" /> Về trang chủ
                     </button>
                 )}
             </div>

             <div className="flex flex-col items-center text-center w-1/3">
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tighter text-white whitespace-nowrap">LUOM PRO <span className="text-red-600">TOOL AI</span></h1>
                <p className="text-zinc-500 text-[10px] font-medium tracking-wide mt-1 uppercase">
                    {currentView === 'home' ? 'TỔNG HỢP CÔNG CỤ SÁNG TẠO' : 
                     (currentView === 'hack-concept' ? 'HACK CONCEPT PRO' : 
                     (currentView === 'restoration' ? 'PHỤC CHẾ ẢNH CHUYÊN NGHIỆP' : 
                     (currentView === 'creative-studio' ? 'GHÉP ẢNH SÁNG TẠO' :
                     (currentView === 'generative-fill' ? 'GENERATIVE FILL' : 'CHẾ ĐỘ XỬ LÝ'))))}
                </p>
             </div>

             <div className="flex items-center gap-3 justify-end w-1/3">
                {isAdmin && (
                    <button onClick={() => setCurrentView(currentView === 'admin' ? 'home' : 'admin')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-all whitespace-nowrap border ${currentView === 'admin' ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-red-500'}`}>
                        <ShieldCheckIcon className="w-4 h-4" /> Admin
                    </button>
                )}
                {currentUser ? (
                    <div className="flex items-center gap-3 mr-2">
                         <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/50 border border-gray-600 rounded-full text-sm font-bold shadow-inner">
                            <WalletIcon className={`w-4 h-4 ${userCredits > 0 ? 'text-green-400' : 'text-red-400'}`} />
                            <span className="text-green-400">{userCredits.toLocaleString()}</span>
                         </div>
                        <div className="flex items-center gap-2">
                             {currentUser.photoURL ? <img src={currentUser.photoURL} alt="User" className="w-7 h-7 rounded-full border border-gray-600" /> : <UserCircleIcon className="w-7 h-7 text-gray-400" />}
                            <span className="hidden xl:inline text-xs font-bold text-gray-300 truncate max-w-[100px]">{currentUser.displayName}</span>
                            <button onClick={handleLogout} title="Đăng xuất" className="text-gray-500 hover:text-red-400 transition-colors"><ArrowRightOnRectangleIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                ) : (
                    <button onClick={handleLogin} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 rounded text-gray-300 text-sm font-bold shadow-sm transition-all mr-2 whitespace-nowrap">
                        <UserCircleIcon className="w-4 h-4" /> Đăng nhập
                    </button>
                )}
                {isAdmin && gommoCredits !== null && (
                   <button onClick={() => updateGommoCredits(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-900/20 border border-teal-500/30 rounded text-teal-400 text-sm font-bold shadow-sm animate-fade-in whitespace-nowrap hover:bg-teal-900/40 transition-colors">
                       {isUpdatingCredits ? <ArrowPathIcon className="w-4 h-4 text-teal-500 animate-spin" /> : <CurrencyDollarIcon className="w-4 h-4 text-teal-500" />}
                       <span className="text-white">{gommoCredits.toLocaleString()}</span>
                   </button>
                )}
                <button onClick={() => setIsPricingModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/50 rounded text-green-400 text-sm font-bold shadow-sm transition-all whitespace-nowrap">
                    <CurrencyDollarIcon className="w-4 h-4" /> Nạp Credits
                </button>
                <button onClick={() => { setDonationModalMode('donate'); setSelectedPricingPackage(null); setIsDonationModalOpen(true); }} className="text-yellow-500 hover:text-yellow-400 text-sm font-medium flex items-center gap-1 whitespace-nowrap border border-yellow-500/30 px-3 py-1.5 rounded hover:bg-yellow-500/10 transition-colors">☕ Donate</button>
                <div className="hidden sm:block"><VisitorCounter /></div>
             </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
            {currentView === 'home' ? (
                <LandingPage onNavigate={setCurrentView} />
            ) : currentView === 'admin' ? (
                <AdminPanel currentUser={currentUser} gommoCredits={gommoCredits} />
            ) : currentView === 'restoration' ? (
                <RestorationStudio 
                    apiKey={globalApiKey}
                    gommoApiKey={globalGommoKey}
                    userCredits={userCredits}
                    currentUser={currentUser}
                    onUpdateCredits={updateGommoCredits}
                />
            ) : currentView === 'generative-fill' ? (
                <GenerativeFillStudio 
                    apiKey={globalApiKey}
                    gommoApiKey={globalGommoKey}
                    userCredits={userCredits}
                    currentUser={currentUser}
                    onUpdateCredits={updateGommoCredits}
                />
            ) : currentView === 'creative-studio' ? (
                <CreativeStudio 
                    apiKey={globalApiKey}
                    gommoApiKey={globalGommoKey}
                    userCredits={userCredits}
                    currentUser={currentUser}
                    onUpdateCredits={updateGommoCredits}
                />
            ) : (
                <div className="flex flex-row h-[calc(100vh-80px)] w-full overflow-hidden">
                    <main className="flex-1 flex flex-col bg-[#0f1012] min-h-0">
                        <div className={`flex-1 overflow-y-auto p-6 scroll-smooth relative transition-colors ${isDragging ? 'bg-gray-900/50' : ''}`} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }} onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleImageUpload(e.dataTransfer.files); }}>
                            {activeImages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center pb-20">
                                    <label className={`group relative w-full max-w-3xl h-48 border border-dashed rounded-2xl cursor-pointer transition-all duration-300 flex items-center justify-center gap-6 shadow-xl overflow-hidden ${isDragging ? 'border-sky-500 bg-sky-900/10 ring-2 ring-sky-500/20' : 'border-gray-600 hover:border-sky-500 bg-[#151515] hover:bg-[#1a1a1a] hover:shadow-sky-500/10'}`} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); handleImageUpload(e.dataTransfer.files); }}>
                                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                        <div className="relative w-16 h-16 rounded-full bg-[#222] group-hover:bg-sky-500/20 border border-gray-700 group-hover:border-sky-500 flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-lg"><PlusIcon className="w-8 h-8 text-gray-400 group-hover:text-sky-400 transition-colors" /></div>
                                        <div className="relative flex flex-col items-start z-10"><span className="text-xl font-bold text-gray-300 group-hover:text-white transition-colors uppercase tracking-wide">Thêm ảnh {currentView === 'hack-concept' ? 'Hack Concept' : 'Concept'}</span><span className="text-sm text-gray-500 group-hover:text-gray-400 mt-1 flex items-center gap-2"><PhotoIcon className="w-4 h-4" /> Hỗ trợ JPG, PNG, WEBP (Kéo thả vào đây)</span></div>
                                        <input type="file" multiple onChange={(e) => e.target.files && handleImageUpload(e.target.files)} className="hidden" accept="image/*" />
                                    </label>
                                </div>
                            ) : (
                                <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-20 items-stretch transition-all duration-500`}>
                                    {activeImages.map(img => (
                                        <div key={img.id} className="h-auto">
                                        <ImageCard item={img} onToggleSelect={(id) => setActiveImages(p => p.map(x => x.id === id ? { ...x, isSelected: !x.isSelected } : x))} onDelete={(id) => setActiveImages(p => p.filter(x => x.id !== id))} onRegenerate={handleRegenerateImage} onDoubleClick={() => openLightbox(img)} onView={() => openLightbox(img)} onUpscale={currentView === 'hack-concept' ? handleUpscaleImage : undefined} />
                                        </div>
                                    ))}
                                    <label className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group min-h-[300px] ${isDragging ? 'border-sky-500 bg-sky-900/10 ring-2 ring-sky-500/20' : 'border-gray-700 bg-[#151515] hover:bg-[#1a1a1a] hover:border-gray-500'}`} title="Thêm ảnh mới" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); handleImageUpload(e.dataTransfer.files); }}>
                                        <div className="bg-gray-800 group-hover:bg-gray-700 p-4 rounded-full transition-colors mb-4"><PlusIcon className="w-8 h-8 text-gray-400 group-hover:text-white" /></div>
                                        <span className="text-gray-400 group-hover:text-white font-medium text-sm">Thêm ảnh</span>
                                        <input type="file" multiple onChange={(e) => e.target.files && handleImageUpload(e.target.files)} className="hidden" accept="image/*" />
                                    </label>
                                </div>
                            )}
                        </div>
                    </main>
                    <aside className="w-[400px] shrink-0 border-l border-gray-800 bg-[#111]">
                        <ControlPanel 
                            settings={{...activeSettings, apiKey: globalApiKey, gommoApiKey: globalGommoKey}}
                            onSettingsChange={(newS) => {
                                if(newS.apiKey !== undefined) setGlobalApiKey(newS.apiKey);
                                if(newS.gommoApiKey !== undefined) setGlobalGommoKey(newS.gommoApiKey);
                                setActiveSettings(prev => ({ ...prev, ...newS }));
                            }}
                            isProcessing={isImageProcessing}
                            galleryItems={galleryItems}
                            onSelectFromGallery={handleSelectFromGallery}
                            onSyncGallery={handleSyncGommoGallery}
                            viewMode={currentView}
                            setViewMode={() => {}}
                            isAdmin={isAdmin}
                            onModelsLoaded={handleModelsLoaded}
                        />
                    </aside>
                </div>
            )}
        </div>
        <SystemNotificationModal />
        <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} onSelectPackage={handlePackageSelection} />
        <DonationModal isOpen={isDonationModalOpen} onClose={() => setIsDonationModalOpen(false)} mode={donationModalMode} selectedPackage={selectedPricingPackage} />
        {lightboxData && (<Lightbox isOpen={!!lightboxData} src={lightboxData.src} originalSrc={lightboxData.originalSrc} onClose={() => setLightboxData(null)} />)}
        <ConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={confirmDeleteAll} title="Xoá Tất Cả Ảnh?" message="Hành động này sẽ xoá toàn bộ ảnh đang làm việc. Ảnh đã lưu trong 'Kho Ảnh' sẽ KHÔNG bị xoá." confirmLabel="Xoá" cancelLabel="Không Xoá" />
    </div>
  );
};

export default App;