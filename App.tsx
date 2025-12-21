
import React, { useState, useEffect } from 'react';
import { generateStyledImage, resizeImage } from './services/geminiService';
import { uploadGommoImage, generateGommoImage, pollGommoImageCompletion, fetchGommoImages } from './services/gommoService';
import { ProcessedImage, GenerationSettings, WeatherOption, StoredImage } from './types';
import { initDB, saveImageToGallery, getGalleryImages } from './services/galleryService';
import { APP_CONFIG } from './config';

// UI Components
import ControlPanel from './components/ControlPanel';
import ImageCard from './components/ImageCard';
import DonationModal from './components/DonationModal';
import VisitorCounter from './components/VisitorCounter';
import Lightbox from './components/Lightbox';
import ConfirmationModal from './components/ConfirmationModal';

import { PhotoIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

// Default Settings Constant
const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
    userPrompt: '',
    blurAmount: 2.8,
    weather: WeatherOption.NONE,
    lightingEffects: [],
    preserveSubjectPosition: true,
    preservePose: false,
    preserveComposition: false,
    preserveFocalLength: false,
    preserveAspectRatio: false,
    disableForeground: false,
    originalImageCompatibility: false,
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
  const [isDonationModalOpen, setIsDonationModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  
  // GLOBAL API KEY STATE - Initialize with Config
  const [globalApiKey, setGlobalApiKey] = useState<string>(APP_CONFIG.GEMINI_API_KEY || '');
  const [globalGommoKey, setGlobalGommoKey] = useState<string>(APP_CONFIG.GOMMO_API_KEY || '');

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
  }, []);
  
  // Persist API Key changes
  useEffect(() => {
      if (globalApiKey) localStorage.setItem('gemini_api_key', globalApiKey);
      if (globalGommoKey) localStorage.setItem('gommo_api_key', globalGommoKey);
  }, [globalApiKey, globalGommoKey]);

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

        // CHECK PROVIDER: GOMMO VS GEMINI
        const provider = finalSettings.aiProvider || 'gemini';
        
        if (provider === 'gommo') {
             // --- GOMMO WORKFLOW ---
             if (!finalSettings.gommoApiKey) throw new Error("Vui lòng nhập Gommo Access Token.");
             
             // Optimize and Resize Image for Gommo
             const base64Data = await resizeImage(file, 1024, 1024, 0.9);
             
             // Create/Edit (Standard Gen)
             const modelId = finalSettings.gommoModel || 'google_image_gen_banana_pro';
             let prompt = finalSettings.userPrompt || "Enhance image";
             
             // Map Aspect Ratio from Settings to Gommo Format
             // Logic: Replace ':' with '_' (e.g., '16:9' -> '16_9')
             let gommoRatio = '1_1';
             if (finalSettings.aspectRatio) {
                 const raw = finalSettings.aspectRatio.replace(/\s*•.*/, ''); 
                 if (raw === 'auto') {
                     gommoRatio = 'auto';
                 } else {
                     gommoRatio = raw.replace(':', '_');
                 }
             }

             // Map Resolution (Normalize to lowercase, e.g. "1K" -> "1k")
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
                 // Fallback to flattened if response varies
                 url = genRes.imageInfo.url;
             } else {
                 throw new Error("Gommo không trả về URL ảnh.");
             }

        } else {
            // --- GEMINI WORKFLOW ---
            url = await generateStyledImage(file, finalSettings);
        }
        
        setConceptImages(prev => prev.map(p => p.id === id ? { ...p, status: 'completed', generatedImageUrl: url } : p));
        
        // Save to gallery
        const newItem: StoredImage = { id: crypto.randomUUID(), url, timestamp: Date.now() };
        await saveImageToGallery(newItem);
        setGalleryItems(prev => [newItem, ...prev]);

      } catch (e: any) {
        const errorMessage = e.message || 'Lỗi tạo ảnh';
        setConceptImages(prev => prev.map(p => p.id === id ? { ...p, status: 'error', error: errorMessage } : p));
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
                 <button 
                    onClick={handleDeleteAll}
                    className="flex items-center gap-2 px-4 py-2 bg-[#141414] border border-gray-700 hover:border-red-600 hover:bg-red-900/50 rounded transition-all text-xs font-semibold text-gray-300 hover:text-red-400 uppercase tracking-wide shadow-sm"
                >
                        <TrashIcon className="w-3.5 h-3.5 stroke-[2px]" />
                        Xoá tất cả ảnh
                </button>
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
                <button onClick={() => setIsDonationModalOpen(true)} className="text-yellow-500 hover:text-yellow-400 text-sm font-medium flex items-center gap-1 whitespace-nowrap border border-yellow-500/30 px-3 py-1.5 rounded hover:bg-yellow-500/10 transition-colors">
                    ☕ Donate
                </button>
                <div className="hidden sm:block">
                    <VisitorCounter />
                </div>
             </div>
        </header>

        {/* MAIN BODY - Only showing Concept Grid Layout */}
        <div className="flex-1 overflow-hidden relative">
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
                  />
              </aside>
          </div>
        </div>

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
