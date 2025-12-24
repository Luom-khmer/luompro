

import React, { useState, useEffect } from 'react';
import { GenerationSettings, WeatherOption, StoredImage, ViewMode, GommoModel, GommoRatio, GommoResolution, GommoMode } from '../types';
import { MicrophoneIcon, XCircleIcon, ChevronDownIcon, ChevronUpIcon, PhotoIcon, ArrowPathIcon, SparklesIcon, TrashIcon, CheckIcon, BoltIcon, ArchiveBoxIcon, ArrowDownTrayIcon, DocumentMagnifyingGlassIcon, CpuChipIcon, ArrowsPointingOutIcon, KeyIcon, LinkIcon, GlobeAltIcon, ServerStackIcon, CloudArrowDownIcon, ArrowUturnLeftIcon, EyeIcon, ExclamationCircleIcon, CheckCircleIcon, PaintBrushIcon, Cog6ToothIcon, InformationCircleIcon, ShieldCheckIcon, LightBulbIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';
import { analyzeReferenceImage, analyzeHackConceptImage, validateApiKey } from '../services/geminiService';
import { fetchGommoModels } from '../services/gommoService';
import { APP_CONFIG } from '../config';

interface ControlPanelProps {
  settings: GenerationSettings;
  onSettingsChange: (newSettings: Partial<GenerationSettings>) => void;
  isProcessing: boolean;
  galleryItems: StoredImage[];
  onSelectFromGallery: (item: StoredImage) => void;
  onSyncGallery?: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isAdmin?: boolean;
  onModelsLoaded?: (models: GommoModel[]) => void;
}

// Giá trị mặc định để reset
const DEFAULT_RESET_VALUES = {
    blurAmount: 2.8,
    weather: WeatherOption.NONE,
    lightingEffects: [],
    preservePose: false,
    preserveComposition: false,
    preserveFocalLength: false,
    preserveAspectRatio: false,
    disableForeground: false,
    originalImageCompatibility: false,
    preserveFaceDetail: false, // Default reset
    preserveSubjectPosition: true,
    keepOriginalOutfit: false,
    minimalCustomization: false,
    enableUpscale: false,
    restorationCustomPrompt: '',
    hackPrompts: undefined // Reset hack prompts
};

// Cấu hình tự động khi phân tích xong
const AUTO_PRESET_SETTINGS = {
    preservePose: false,
    preserveComposition: false,
    preserveFocalLength: false,
    preserveAspectRatio: false,
    disableForeground: false,
};

// Mapping giữa Option Key và Prompt Text hiển thị
const OPTION_PROMPTS: Record<string, string> = {
    minimalCustomization: "CHẾ ĐỘ: Ghép ảnh tối giản (Giữ nguyên gốc tối đa)",
    originalImageCompatibility: "BỐI CẢNH THÔNG MINH: Tự động điều chỉnh nền theo khung hình ảnh gốc",
    preserveFaceDetail: "KHÓA KHUÔN MẶT: Giữ nguyên 100% chi tiết gương mặt gốc",
    preservePose: "KHÓA DÁNG: Giữ nguyên tư thế nhân vật giống hệt ảnh gốc",
    keepOriginalOutfit: "KHÓA TRANG PHỤC: Giữ nguyên quần áo gốc không thay đổi",
    preserveComposition: "KHÓA BỐ CỤC: Giữ nguyên vị trí và kích thước chủ thể",
    preserveFocalLength: "KHÓA TIÊU CỰ: Giữ nguyên độ sâu trường ảnh gốc",
    preserveAspectRatio: "KHÓA TỶ LỆ: Giữ nguyên tỷ lệ khung hình ảnh đầu vào",
    disableForeground: "XÓA TIỀN CẢNH: Không tạo vật thể che chắn phía trước chủ thể"
};

// Mapping cho Thời tiết
const WEATHER_PROMPTS: Record<string, string> = {
  [WeatherOption.LIGHT_SUN]: "THỜI TIẾT: Nắng nhẹ, ánh sáng tự nhiên dịu dàng",
  [WeatherOption.HARSH_SUN]: "THỜI TIẾT: Nắng gắt, độ tương phản cao, ánh sáng mạnh",
  [WeatherOption.SUNSET]: "THỜI TIẾT: Hoàng hôn, giờ vàng, ánh sáng ấm áp",
  [WeatherOption.NIGHT]: "THỜI TIẾT: Ban đêm, ánh trăng, phong cách điện ảnh tối",
  [WeatherOption.FOG]: "THỜI TIẾT: Sương mù, mờ ảo, ánh sáng khuếch tán mềm"
};

// Mapping cho Hiệu ứng ánh sáng
const LIGHTING_PROMPTS: Record<string, string> = {
  "Ánh sáng viền tóc": "ÁNH SÁNG: Viền sáng tóc, tóc phát sáng nhẹ",
  "Ánh sáng vành tóc trái": "ÁNH SÁNG: Viền sáng tóc bên trái",
  "Ánh sáng vành tóc phải": "ÁNH SÁNG: Viền sáng tóc bên phải",
  "Đèn nền trái": "ÁNH SÁNG: Đèn nền mạnh từ phía trái",
  "Đèn nền phải": "ÁNH SÁNG: Đèn nền mạnh từ phía phải",
  "Đèn gáy": "ÁNH SÁNG: Chiếu sáng vùng gáy",
  "Đèn đỉnh đầu sau": "ÁNH SÁNG: Đèn chiếu từ phía sau đỉnh đầu",
  "Vai trái": "ÁNH SÁNG: Viền sáng nhấn vai trái",
  "Vai phải": "ÁNH SÁNG: Viền sáng nhấn vai phải",
  "Đường viền cổ áo": "ÁNH SÁNG: Nhấn sáng đường viền cổ áo",
  "Lưng": "ÁNH SÁNG: Ánh sáng mềm vùng lưng",
  "Sống lưng": "ÁNH SÁNG: Highlight dọc sống lưng",
  "Vành eo": "ÁNH SÁNG: Viền sáng nhấn vòng eo",
  "Vành hông trái": "ÁNH SÁNG: Viền sáng hông trái",
  "Vành hông phải": "ÁNH SÁNG: Viền sáng hông phải",
  "Tay": "ÁNH SÁNG: Tạo khối ánh sáng trên tay",
  "Vệt sáng chéo trên váy": "ÁNH SÁNG: Vệt sáng chiếu chéo trên váy",
  "Ren váy": "ÁNH SÁNG: Nhấn chi tiết ren váy",
  "Nếp gấp váy": "ÁNH SÁNG: Đổ bóng và sáng nhấn nếp gấp váy",
  "Gấu váy": "ÁNH SÁNG: Ánh sáng chiếu vào gấu váy",
  "Đuôi váy": "ÁNH SÁNG: Làm sáng đuôi váy",
  "Đèn nền khăn voan": "ÁNH SÁNG: Đèn nền xuyên qua khăn voan",
  "Ánh sáng xuyên qua khăn voan": "ÁNH SÁNG: Tia sáng xuyên qua lớp voan mỏng",
  "Vệt sáng sàn phía trước": "ÁNH SÁNG: Vệt sáng trên sàn phía trước",
  "Vệt sáng sàn phía sau": "ÁNH SÁNG: Vệt sáng trên sàn phía sau",
  "Vệt sáng cửa sổ trên nền": "ÁNH SÁNG: Bóng đổ khung cửa sổ trên nền",
  "Vệt sáng ngang": "ÁNH SÁNG: Chùm sáng ngang qua khung hình"
};

const BODY_LIGHTING_OPTIONS = [
    "Vai trái", "Vai phải", "Đường viền cổ áo", "Lưng", "Sống lưng", "Vành eo", "Vành hông trái", "Vành hông phải"
];

// Fallback options if model doesn't specify
const ASPECT_RATIO_OPTIONS = ['auto', '1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'];

const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  onSettingsChange,
  isProcessing,
  galleryItems,
  onSelectFromGallery,
  onSyncGallery,
  viewMode,
  isAdmin = false,
  onModelsLoaded
}) => {
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'studio' | 'keys'>('studio');

  // Collapsible States
  const [isRefImageOpen, setIsRefImageOpen] = useState(false);
  const [isLightingOpen, setIsLightingOpen] = useState(false);
  const [isVisualEffectsOpen, setIsVisualEffectsOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(true); 
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
  // Analysis States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [pendingReferenceFile, setPendingReferenceFile] = useState<File | null>(null);
  
  // API Key State (Gemini)
  const [keyConnected, setKeyConnected] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Gommo State
  const [gommoModelsList, setGommoModelsList] = useState<GommoModel[]>([]);
  const [isLoadingGommoModels, setIsLoadingGommoModels] = useState(false);
  const [gommoConnected, setGommoConnected] = useState(false);
  const [gommoError, setGommoError] = useState<string | null>(null);

  // --- HACK CONCEPT PRO SPECIFIC STATES ---
  const [hackModalStep, setHackModalStep] = useState<'intro' | 'analyzing' | 'selection' | 'off'>('off');
  const [activeHackTab, setActiveHackTab] = useState<'fullBody' | 'portrait' | 'closeUp'>('fullBody');

  // --- TOP LEVEL HOOKS FOR MODEL & RATIO LOGIC ---
  const isGommoProvider = true; // FORCE GOMMO ALWAYS FOR UI
  const hasProxy = !!APP_CONFIG.GOMMO_PROXY_URL;
  
  const activeGommoModel = React.useMemo(() => {
     return gommoModelsList.find(m => m.model === settings.gommoModel) || null;
  }, [gommoModelsList, settings.gommoModel]);

  const activeRatios = React.useMemo(() => {
      if (activeGommoModel && activeGommoModel.ratios) {
          return activeGommoModel.ratios.map(r => r.name);
      }
      return ASPECT_RATIO_OPTIONS;
  }, [activeGommoModel]);

  const availableModes = React.useMemo(() => {
      return (activeGommoModel && activeGommoModel.modes) ? activeGommoModel.modes : [];
  }, [activeGommoModel]);

  // Set default mode when model changes
  useEffect(() => {
      if (availableModes.length > 0) {
          // If current mode is not valid for this model, select first one
          const currentValid = availableModes.find(m => m.type === settings.gommoMode);
          if (!currentValid) {
               onSettingsChange({ gommoMode: availableModes[0].type });
          }
      } else {
          // If no modes, clear setting
          if (settings.gommoMode) onSettingsChange({ gommoMode: undefined });
      }
  }, [activeGommoModel, availableModes]);

  // Helper to estimate price
  const getEstimatedPrice = (mode?: string, resolution?: string) => {
      if (!activeGommoModel) return null;
      if (!activeGommoModel.prices) return activeGommoModel.price;

      const targetMode = mode || settings.gommoMode;
      const targetRes = (resolution || settings.imageSize || '1k').toLowerCase();

      const found = activeGommoModel.prices.find(p => {
           const modeMatch = targetMode ? p.mode === targetMode : true;
           const resMatch = p.resolution.toLowerCase() === targetRes;
           return modeMatch && resMatch;
      });

      return found ? found.price : activeGommoModel.price;
  };

  // Validate Aspect Ratio Effect
  useEffect(() => {
      if (activeRatios.length > 0 && !activeRatios.includes(settings.aspectRatio)) {
          const fallback = activeRatios.find(r => r.includes('1:1')) || activeRatios[0];
          if (fallback && fallback !== settings.aspectRatio) {
              onSettingsChange({ aspectRatio: fallback });
          }
      }
  }, [activeRatios, settings.aspectRatio]);

  // Validate API Key changes
  useEffect(() => {
      if (!settings.apiKey) setKeyConnected(false);
  }, [settings.apiKey]);

  // Initial Load for Gommo
  useEffect(() => {
      let isMounted = true;
      if (settings.gommoApiKey) {
          if (!gommoConnected && !isLoadingGommoModels) {
               if (gommoModelsList.length === 0) {
                   handleSaveAndTestGommoToken();
               }
          }
      }
      return () => { isMounted = false; };
  }, [settings.gommoApiKey]); // Added dependency to re-check when key changes

  // --- Handlers ---

  const handleSaveAndTestGommoToken = async () => {
      if (!settings.gommoApiKey || settings.gommoApiKey.length < 10) {
          setGommoError("Token quá ngắn hoặc không hợp lệ.");
          return;
      }

      setIsLoadingGommoModels(true);
      setGommoConnected(false);
      setGommoError(null);

      try {
          const response = await fetchGommoModels(settings.gommoApiKey, 'image');
          let models: GommoModel[] = [];
          if (response?.success?.data && Array.isArray(response.success.data)) {
              models = response.success.data;
          } else if (response?.data && Array.isArray(response.data)) {
              models = response.data;
          } else if (Array.isArray(response)) {
              models = response as unknown as GommoModel[];
          }
          
          if (models.length > 0) {
              setGommoModelsList(models);
              setGommoConnected(true);
              if (onModelsLoaded) onModelsLoaded(models); // Pass models up

              const currentExists = models.find(m => m.model === settings.gommoModel);
              if (!currentExists && models.length > 0) {
                  onSettingsChange({ gommoModel: models[0].model });
              }
          } else {
              throw new Error("Không lấy được danh sách Model (Danh sách trống).");
          }
      } catch (error: any) {
          setGommoConnected(false);
          setGommoError(error.message || "Lỗi kết nối không xác định.");
          alert(`Lỗi kết nối: ${error.message || "Lỗi không xác định !"}`);
      } finally {
          setIsLoadingGommoModels(false);
      }
  };

  const handleResetGommoKey = () => {
      const configKey = APP_CONFIG.GOMMO_API_KEY;
      if (configKey) {
          onSettingsChange({ gommoApiKey: configKey });
          setGommoConnected(false);
          setGommoError(null);
      } else {
          alert("Không tìm thấy Key trong file Config.");
      }
  };

  const handleResetGeminiKey = () => {
      const configKey = APP_CONFIG.GEMINI_API_KEY;
      if (configKey) {
          onSettingsChange({ apiKey: configKey });
          setKeyConnected(false);
          setKeyError(null);
      }
  };

  const formatAutoPrompt = (content: string) => {
      if (content.toLowerCase().startsWith("thay đổi nền")) {
          return `${content}\n\nGiữ nguyên kích thước và vị trí của chủ thể gốc.`;
      }
      return `Thay đổi hoàn toàn bối cảnh sang:\n[${content}]\nGiữ nguyên kích thước và vị trí của chủ thể gốc.`;
  };

  // Helper function to add/remove tags from prompt
  const updatePromptWithTag = (prompt: string, tag: string, add: boolean): string => {
      let current = prompt || "";
      if (add) {
          if (!current.includes(tag)) {
              return current.trim().length > 0 ? `${current.trim()}\n${tag}` : tag;
          }
          return current;
      } else {
          return current.split('\n').filter(line => line.trim() !== tag).join('\n').trim();
      }
  };

  const handleLightingChange = (effect: string) => {
    const currentEffects = settings.lightingEffects || [];
    let newEffects;
    let isAdding = false;
    
    if (currentEffects.includes(effect)) {
        newEffects = currentEffects.filter(e => e !== effect);
        isAdding = false;
    } else {
        newEffects = [...currentEffects, effect];
        isAdding = true;
    }

    const tag = LIGHTING_PROMPTS[effect];
    let newPrompt = settings.userPrompt;
    if (tag) {
        newPrompt = updatePromptWithTag(newPrompt, tag, isAdding);
    }

    onSettingsChange({ lightingEffects: newEffects, userPrompt: newPrompt });
  };

  const handleWeatherChange = (opt: WeatherOption) => {
    const isSame = settings.weather === opt;
    const newWeather = isSame ? WeatherOption.NONE : opt;
    
    let newPrompt = settings.userPrompt;

    if (settings.weather !== WeatherOption.NONE) {
        const oldTag = WEATHER_PROMPTS[settings.weather];
        if (oldTag) newPrompt = updatePromptWithTag(newPrompt, oldTag, false);
    }

    if (newWeather !== WeatherOption.NONE) {
        const newTag = WEATHER_PROMPTS[newWeather];
        if (newTag) newPrompt = updatePromptWithTag(newPrompt, newTag, true);
    }

    onSettingsChange({ weather: newWeather, userPrompt: newPrompt });
  };

  const handleBlurChange = (val: number) => {
      let blurDescription = "";
      if (val <= 3.5) {
          blurDescription = "ĐỘ MỜ: Xóa phông mạnh (Strong Bokeh), nền mờ ảo, nổi bật chủ thể";
      } else if (val <= 8.0) {
          blurDescription = "ĐỘ MỜ: Xóa phông nhẹ (Medium Depth), nền mờ tự nhiên";
      } else {
          blurDescription = "ĐỘ MỜ: Rõ nét toàn cảnh (Sharp Background), lấy nét sâu";
      }

      let currentPrompt = settings.userPrompt || "";
      const lines = currentPrompt.split('\n').filter(line => !line.trim().startsWith("ĐỘ MỜ:"));
      lines.push(blurDescription);
      const newPrompt = lines.join('\n').trim();

      onSettingsChange({ blurAmount: val, userPrompt: newPrompt });
  };

  const handleBlurCommit = () => {};

  const handleOptionToggle = (key: keyof GenerationSettings, label: string) => {
      const currentValue = !!settings[key];
      const newValue = !currentValue;
      
      const promptText = OPTION_PROMPTS[key as string];
      let newPrompt = settings.userPrompt;

      if (promptText) {
          newPrompt = updatePromptWithTag(newPrompt, promptText, newValue);
      }

      onSettingsChange({ 
          [key]: newValue,
          userPrompt: newPrompt
      } as Partial<GenerationSettings>);
  };

  const handleAnalysisSelection = async (mode: 'basic' | 'deep' | 'painting' | 'background') => {
      if (!pendingReferenceFile) return;
      
      setShowAnalysisModal(false);
      const file = pendingReferenceFile;
      const previewUrl = URL.createObjectURL(file);
      
      onSettingsChange({ 
          referenceImage: file, 
          referenceImagePreview: previewUrl, 
          userPrompt: '', 
          ...DEFAULT_RESET_VALUES 
      });
      setIsAnalyzing(true);
      setIsRefImageOpen(true);

      try {
        const analysisText = await analyzeReferenceImage(file, mode, settings.apiKey);
        onSettingsChange({ 
            userPrompt: formatAutoPrompt(analysisText), 
            ...AUTO_PRESET_SETTINGS 
        });
      } catch (error: any) { 
        alert(`Lỗi khi phân tích: ${error.message || "Vui lòng thử lại."}`);
      } finally { 
        setIsAnalyzing(false); 
        setPendingReferenceFile(null); 
      }
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (viewMode === 'hack-concept') {
          // --- HACK CONCEPT PRO LOGIC ---
          setPendingReferenceFile(file);
          setHackModalStep('intro'); // Start Hack Flow
      } else {
          setPendingReferenceFile(file);
          setShowAnalysisModal(true);
      }
      e.target.value = '';
  };

  // --- HACK CONCEPT PRO FUNCTIONS ---
  const performHackAnalysis = async () => {
      if (!pendingReferenceFile) return;
      setHackModalStep('analyzing');
      try {
          const results = await analyzeHackConceptImage(pendingReferenceFile, settings.apiKey);
          onSettingsChange({
              hackPrompts: results,
              userPrompt: results.detailed // Default to detailed
          });
          setHackModalStep('selection');
      } catch (e: any) {
          alert("Lỗi phân tích Hack Concept: " + e.message);
          setHackModalStep('off');
          setPendingReferenceFile(null);
      }
  };

  const handleHackOptionSelect = (option: 1 | 2) => {
      if (option === 1) {
          // Option 1: Just Prompt (Clear image)
          onSettingsChange({ 
              referenceImage: null, 
              referenceImagePreview: null 
          });
      } else {
          // Option 2: Keep Image
          const previewUrl = URL.createObjectURL(pendingReferenceFile!);
          onSettingsChange({
              referenceImage: pendingReferenceFile,
              referenceImagePreview: previewUrl
          });
      }
      setPendingReferenceFile(null);
      setHackModalStep('off');
      setActiveHackTab('fullBody');
      // Set initial prompts (Detailed is already in userPrompt from analysis step)
      // Also apply the Full Body to the tab state logic if needed, but we keep detailed in main
  };

  const handleHackTabSwitch = (tab: 'fullBody' | 'portrait' | 'closeUp') => {
      if (!settings.hackPrompts) return;
      setActiveHackTab(tab);
      let text = "";
      if (tab === 'fullBody') text = settings.hackPrompts.fullBody;
      if (tab === 'portrait') text = settings.hackPrompts.portrait;
      if (tab === 'closeUp') text = settings.hackPrompts.closeUp;
      onSettingsChange({ userPrompt: text });
  };

  const clearReferenceImage = () => {
      onSettingsChange({ referenceImage: null, referenceImagePreview: null });
  };
  
  const handleConnectKey = async () => {
      if (!settings.apiKey || settings.apiKey.trim().length < 10) {
          alert("Vui lòng nhập ít nhất một API Key hợp lệ.");
          return;
      }
      setIsValidatingKey(true);
      setKeyConnected(false);
      setKeyError(null);
      const result = await validateApiKey(settings.apiKey);
      setIsValidatingKey(false);
      if (result.valid) {
          setKeyConnected(true);
          onSettingsChange({ apiKey: settings.apiKey }); 
      } else {
          setKeyError(result.message || "Lỗi không xác định");
          setKeyConnected(false);
      }
  };

  const lightingGroups = [
    { name: "Tóc", options: ["Ánh sáng viền tóc", "Ánh sáng vành tóc trái", "Ánh sáng vành tóc phải", "Đèn nền trái", "Đèn nền phải", "Đèn gáy", "Đèn đỉnh đầu sau"] },
    { name: "Cơ thể", options: BODY_LIGHTING_OPTIONS },
    { name: "Tay / Váy", options: ["Tay", "Vệt sáng chéo trên váy", "Ren váy", "Nếp gấp váy", "Gấu váy", "Đuôi váy", "Đèn nền khăn voan", "Ánh sáng xuyên qua khăn voan"] },
    { name: "Môi trường", options: ["Vệt sáng sàn phía trước", "Vệt sáng sàn phía sau", "Vệt sáng cửa sổ trên nền", "Vệt sáng ngang"] }
  ];

  // --- RENDER SUB-FUNCTIONS ---

  const renderTabNavigation = () => (
      <div className="flex p-1 bg-[#1a1a1a] rounded-lg border border-gray-700 mb-4">
          <button onClick={() => setActiveTab('studio')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold transition-all duration-300 ${activeTab === 'studio' ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            <PaintBrushIcon className="w-4 h-4" /> Studio Tạo Ảnh
          </button>
          
          {/* Cấu Hình Key - Hiển thị cho tất cả mọi người */}
          <button onClick={() => setActiveTab('keys')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold transition-all duration-300 ${activeTab === 'keys' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <KeyIcon className="w-4 h-4" /> Cấu Hình Key
          </button>
      </div>
  );

  const renderKeysTabContent = () => (
      <div className="space-y-6 animate-fade-in">
           {/* Section 1: Google Gemini Key - VISIBLE TO EVERYONE */}
           <div className="border border-indigo-500/30 rounded-lg p-4 bg-[#1a1a1a]">
               <div className="flex justify-between items-center mb-3">
                   <h3 className="font-bold text-indigo-400 flex items-center gap-2 uppercase text-sm"><CpuChipIcon className="w-5 h-5"/> Google API Key (Dùng cho Phân Tích)</h3>
                   {keyConnected && <span className="text-[10px] bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">Đã lưu</span>}
               </div>

               <div className="mb-3 p-3 bg-indigo-900/10 border border-indigo-500/20 rounded text-xs text-gray-300">
                    <p className="flex items-start gap-2">
                        <InformationCircleIcon className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <span>Key này chỉ dùng để <strong>Phân Tích ảnh mẫu</strong> và tạo Prompt. Không dùng để tạo ảnh.</span>
                    </p>
               </div>

               <div className="relative">
                   <input type="password" value={settings.apiKey || ''} onChange={(e) => { onSettingsChange({ apiKey: e.target.value }); setKeyConnected(false); }} placeholder="Dán API Key (AIza...)" className={`w-full bg-[#222] border rounded p-2.5 text-sm text-white focus:outline-none focus:ring-1 pr-9 ${keyConnected ? 'border-indigo-500 focus:ring-indigo-500' : 'border-gray-600 focus:border-indigo-500'}`}/>
                   {settings.apiKey && <button onClick={handleResetGeminiKey} className="absolute right-2 top-2.5 text-gray-500 hover:text-white"><ArrowUturnLeftIcon className="w-4 h-4"/></button>}
               </div>
               <div className="mt-3 flex gap-2">
                   <button onClick={handleConnectKey} disabled={isValidatingKey} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded text-xs font-bold uppercase tracking-wide transition-all shadow-md">{isValidatingKey ? 'Đang kiểm tra...' : 'Lưu & Kiểm tra Key'}</button>
               </div>
               {keyError && <p className="text-red-400 text-xs mt-2 flex items-center gap-1"><ExclamationCircleIcon className="w-3 h-3"/> {keyError}</p>}
           </div>

           {/* Section 2: Gommo / Aivideoauto Token - ONLY FOR ADMIN */}
           {isAdmin && (
               <div className={`border rounded-lg bg-[#1a1a1a] overflow-hidden transition-all ${gommoConnected ? 'border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.1)]' : 'border-gray-700'}`}>
                    <div className="p-4 border-b border-gray-800/50 bg-black/20">
                         <div className="flex items-center justify-between mb-1">
                             <div className="flex items-center gap-2">
                                <KeyIcon className={`w-5 h-5 ${gommoConnected ? 'text-teal-400' : 'text-gray-400'}`} />
                                <h3 className={`font-bold text-sm uppercase ${gommoConnected ? 'text-teal-100' : 'text-gray-300'}`}>Aivideoauto Access Token (Tạo Ảnh)</h3>
                                {gommoConnected && <CheckCircleIcon className="w-4 h-4 text-teal-500" />}
                             </div>
                             {hasProxy ? (
                                 <span className="text-[10px] text-green-400 bg-green-900/30 px-2 py-0.5 rounded border border-green-500/30 flex items-center gap-1">
                                     <ShieldCheckIcon className="w-3 h-3" /> Proxy OK
                                 </span>
                             ) : (
                                 <span className="text-[10px] text-orange-400 bg-orange-900/30 px-2 py-0.5 rounded border border-orange-500/30 flex items-center gap-1">
                                     <ExclamationCircleIcon className="w-3 h-3" /> No Proxy
                                 </span>
                             )}
                         </div>
                    </div>
                    <div className="p-4">
                         <div className="flex flex-col gap-3">
                              <div className="relative">
                                  <input type="password" placeholder="Dán Access Token (Jgfr...)" value={settings.gommoApiKey || ''} onChange={(e) => { onSettingsChange({ gommoApiKey: e.target.value }); setGommoConnected(false); setGommoError(null); }} className={`w-full bg-[#222] border rounded p-2.5 text-sm text-white focus:outline-none focus:ring-1 placeholder-gray-600 transition-all ${gommoConnected ? 'border-teal-500 focus:ring-teal-500' : gommoError ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:border-teal-500'}`}/>
                                  {settings.gommoApiKey && <button onClick={handleResetGommoKey} className="absolute right-2 top-2.5 text-gray-500 hover:text-white"><ArrowUturnLeftIcon className="w-4 h-4"/></button>}
                              </div>
                              {gommoError && <p className="text-red-400 text-xs flex items-center gap-1"><ExclamationCircleIcon className="w-3 h-3"/> {gommoError}</p>}
                              <div className="flex flex-col gap-2">
                                  <button onClick={handleSaveAndTestGommoToken} disabled={isLoadingGommoModels} className={`w-full py-2.5 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md transform active:scale-95 ${gommoConnected ? 'bg-teal-600 hover:bg-teal-500 text-white' : 'bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white'}`}>
                                      {isLoadingGommoModels ? <ArrowPathIcon className="w-4 h-4 animate-spin"/> : <CheckIcon className="w-4 h-4"/>}
                                      {isLoadingGommoModels ? 'Đang kết nối...' : 'Lưu & Kết nối tài khoản'}
                                  </button>
                              </div>
                              {hasProxy && (
                                  <p className="text-[10px] text-gray-500 text-center mt-1">
                                      Kết nối an toàn qua: <span className="text-gray-400 font-mono">{APP_CONFIG.GOMMO_PROXY_URL?.split('//')[1]?.split('.')[0]}...</span>
                                  </p>
                              )}
                         </div>
                    </div>
               </div>
           )}
      </div>
  );

  const renderModelList = () => {
      // ONLY SHOW GOMMO LIST
      return (
          <div className="border border-teal-500/30 rounded-lg p-4 bg-[#1a1a1a] mb-4">
              <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-teal-400 uppercase tracking-wide flex items-center gap-2"><CpuChipIcon className="w-4 h-4" /> Luom premium</label>
                  <button onClick={handleSaveAndTestGommoToken} className="text-[10px] text-teal-500 hover:underline flex items-center gap-1"><ArrowPathIcon className={`w-3 h-3 ${isLoadingGommoModels ? 'animate-spin' : ''}`}/> Reload</button>
              </div>
              {gommoModelsList.length === 0 ? (
                  <div className="text-center p-4 bg-black/20 rounded border border-dashed border-gray-700">
                      <p className="text-xs text-gray-500">Chưa tải được danh sách Model.</p>
                      {isAdmin && (
                         <p className="text-[10px] text-gray-600">Vui lòng sang tab <strong className="text-teal-400 cursor-pointer" onClick={() => setActiveTab('keys')}>Cấu Hình Key</strong> để kết nối.</p>
                      )}
                      {!isAdmin && (
                          <p className="text-[10px] text-gray-600">Vui lòng liên hệ Admin để kiểm tra kết nối.</p>
                      )}
                  </div>
              ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                      {gommoModelsList.map((m) => {
                          // Display range if pricing varies by mode
                          let priceDisplay = `${m.price} credits`;
                          if (m.prices && m.prices.length > 0) {
                              const min = Math.min(...m.prices.map(p => p.price));
                              const max = Math.max(...m.prices.map(p => p.price));
                              if (min !== max) {
                                  priceDisplay = `${min} - ${max} credits`;
                              } else {
                                  priceDisplay = `${min} credits`;
                              }
                          }

                          return (
                              <button key={m.model} onClick={() => onSettingsChange({ gommoModel: m.model })} className={`py-2 px-2 rounded-lg text-xs font-bold transition-all border flex flex-col items-center justify-center text-center gap-1 h-full min-h-[50px] ${settings.gommoModel === m.model ? 'bg-teal-600 border-teal-500 text-white shadow-lg' : 'bg-[#222] border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`} title={`${m.name}\n${m.description || ''}`}>
                                  <span className="line-clamp-2">{m.name}</span>
                                  <span className="text-[10px] opacity-70 font-normal bg-black/30 px-1 rounded">{priceDisplay}</span>
                              </button>
                          );
                      })}
                  </div>
              )}
          </div>
      );
  };

  const renderModeSelector = () => {
      if (availableModes.length === 0) return null;

      return (
          <div className="border border-indigo-500/30 rounded-lg bg-[#1a1a1a] mb-4 overflow-hidden">
               <div className="p-3 border-b border-gray-800 bg-black/20 flex justify-between items-center">
                    <h3 className="font-bold text-indigo-400 text-xs uppercase tracking-wide flex items-center gap-2">
                        <RocketLaunchIcon className="w-4 h-4" /> Chế độ xử lý
                    </h3>
               </div>
               <div className="p-3">
                   <div className="grid grid-cols-3 gap-2">
                       {availableModes.map((mode) => {
                           const isSelected = settings.gommoMode === mode.type;
                           // Estimate price for this mode at current resolution
                           const estimated = getEstimatedPrice(mode.type);

                           return (
                               <button 
                                  key={mode.type}
                                  onClick={() => onSettingsChange({ gommoMode: mode.type })}
                                  className={`py-2 px-1 rounded border transition-all flex flex-col items-center justify-center gap-1 ${isSelected ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-[#222] border-gray-700 text-gray-400 hover:bg-gray-800'}`}
                                  title={mode.description}
                               >
                                   <span className="text-xs font-bold uppercase">{mode.name}</span>
                                   {estimated !== null && (
                                       <span className={`text-[10px] px-1.5 rounded-full ${isSelected ? 'bg-black/30 text-white' : 'bg-black/50 text-gray-500'}`}>
                                           {estimated} cr
                                       </span>
                                   )}
                               </button>
                           );
                       })}
                   </div>
                   <p className="text-[10px] text-gray-500 mt-2 italic text-center">
                       * Giá credits thay đổi tùy theo chế độ và độ phân giải.
                   </p>
               </div>
          </div>
      );
  };

  const renderSizeConfig = () => {
    const showResolution = (activeGommoModel && activeGommoModel.resolutions && activeGommoModel.resolutions.length > 0);
    const resolutions = activeGommoModel ? (activeGommoModel.resolutions || []) : [];

    // Chỉ hiển thị khi đã chọn Model
    const isModelSelected = !!activeGommoModel;
    if (!isModelSelected) return null;

    return (
    <div className="border border-gray-700 rounded-lg bg-[#1a1a1a] mb-4">
        <div className="p-4 border-b border-gray-800">
            <h3 className="font-semibold text-gray-200 text-sm uppercase tracking-wide flex items-center gap-2"><ArrowsPointingOutIcon className="w-4 h-4 text-purple-500" /> Kích thước & Độ phân giải</h3>
        </div>
        <div className="p-4">
            <div className="mb-4">
                <label className="text-xs text-gray-500 block mb-2 font-medium">Tỷ lệ khung hình <span className="text-teal-500 font-normal ml-1 text-[10px]">(Theo Model)</span></label>
                <div className="grid grid-cols-4 gap-2">
                    {activeRatios.map((ratio) => (
                        <button key={ratio} onClick={() => onSettingsChange({ aspectRatio: ratio })} className={`py-1.5 rounded text-xs font-bold border transition-all truncate px-1 ${settings.aspectRatio === ratio ? 'bg-purple-600 border-purple-500 text-white shadow-lg' : 'bg-[#222] border-gray-700 text-gray-400 hover:bg-gray-800'}`} title={ratio}>{ratio}</button>
                    ))}
                </div>
            </div>
            {showResolution && (
                <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-500 block font-medium">Độ phân giải</label>
                    <div className="flex bg-black/40 rounded-lg p-1 border border-gray-700 flex-wrap gap-1">
                        {resolutions.map((res) => {
                             // Estimate price for this resolution at current mode
                             const est = getEstimatedPrice(undefined, res.type);
                             return (
                                <button key={res.type} onClick={() => onSettingsChange({ imageSize: res.type })} className={`flex-1 py-1.5 px-2 rounded-md text-xs font-bold transition-all min-w-[50px] flex flex-col items-center ${settings.imageSize === res.type ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                    <span>{res.name}</span>
                                    {est !== null && settings.imageSize !== res.type && <span className="text-[8px] opacity-60 font-normal">{est} cr</span>}
                                </button>
                             );
                        })}
                    </div>
                </div>
            )}
        </div>
    </div>
    );
  };

  const renderReferenceImageSection = () => {
    // Tự động mở nếu đang ở chế độ Hack Concept
    const isOpen = viewMode === 'hack-concept' || isRefImageOpen;

    return (
      <div className={`border rounded-lg bg-[#1a1a1a] ${viewMode === 'hack-concept' ? 'border-purple-500/50' : 'border-gray-700'}`}>
          <div 
              className={`relative flex justify-center items-center p-5 rounded-t-lg transition-colors ${viewMode === 'hack-concept' ? '' : 'cursor-pointer hover:bg-gray-800'}`} 
              onClick={() => { 
                  // Chỉ cho phép toggle nếu KHÔNG PHẢI là hack-concept
                  if (viewMode !== 'hack-concept') {
                      setIsRefImageOpen(!isRefImageOpen);
                  }
              }}
          >
              <h3 className={`font-semibold text-lg ${viewMode === 'hack-concept' ? 'text-purple-300' : 'text-gray-200'}`}>
                  {viewMode === 'hack-concept' ? "Ảnh tham chiếu" : "Ảnh tham chiếu (Style)"}
              </h3>
              {/* Ẩn icon mũi tên nếu đang ở chế độ Hack Concept (vì luôn mở) */}
              {viewMode !== 'hack-concept' && (
                  <div className="absolute right-5">{isRefImageOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}</div>
              )}
          </div>
          {isOpen && (
              <div className="p-5 pt-0 border-t border-gray-800 mt-3">
                  {settings.referenceImage && settings.referenceImagePreview ? (
                      <div className="relative group w-full flex justify-center bg-black/40 rounded-lg border border-gray-600 overflow-hidden">
                          <img src={settings.referenceImagePreview} alt="Reference" className="w-full h-auto max-h-[400px] object-contain"/>
                          <button onClick={clearReferenceImage} className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 p-1.5 rounded-full text-white transition-colors z-20"><TrashIcon className="w-5 h-5" /></button>
                          
                          {/* Only show 'Extract' button if NOT in Hack Concept Pro mode */}
                          {viewMode !== 'hack-concept' && (
                              <div className="absolute bottom-2 right-2 flex gap-2 z-20">
                                  <button onClick={() => { setPendingReferenceFile(settings.referenceImage as File); setShowAnalysisModal(true); }} disabled={isAnalyzing} className="bg-black/60 hover:bg-sky-600 text-white text-sm px-3 py-1.5 rounded backdrop-blur flex items-center gap-1 transition-colors border border-gray-500/50">
                                      {isAnalyzing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                                      {isAnalyzing ? '...' : 'Trích xuất lại'}
                                  </button>
                              </div>
                          )}
                          {/* Hack Concept Pro Badge */}
                          {viewMode === 'hack-concept' && (
                              <div className="absolute bottom-2 left-2 flex gap-2 z-20">
                                  <span className="bg-purple-600/80 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur">
                                      Đính kèm tạo ảnh
                                  </span>
                              </div>
                          )}
                      </div>
                  ) : (
                      <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 relative overflow-hidden ${isAnalyzing ? 'bg-gray-800 border-sky-500/50' : isDraggingRef ? 'bg-gray-800 border-sky-400 scale-[1.02]' : 'bg-[#222] border-gray-600 hover:bg-gray-800 hover:border-gray-500'}`} onDragOver={(e) => { e.preventDefault(); setIsDraggingRef(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDraggingRef(false); }} onDrop={(e) => { e.preventDefault(); setIsDraggingRef(false); const f = e.dataTransfer.files?.[0]; if(f) { 
                          if (viewMode === 'hack-concept') {
                              // Handle Drop for Hack Concept
                              setPendingReferenceFile(f);
                              setHackModalStep('intro');
                          } else {
                              setPendingReferenceFile(f); 
                              setShowAnalysisModal(true); 
                          }
                      }}}>
                          {isAnalyzing ? (
                              <div className="flex flex-col items-center text-sky-500 gap-2"><ArrowPathIcon className="w-8 h-8 animate-spin" /><span className="text-base font-medium">Đang xử lý...</span></div>
                          ) : (
                              <div className="flex flex-col items-center text-gray-400 gap-2 pointer-events-none">
                                  <PhotoIcon className={`w-8 h-8 ${isDraggingRef ? 'text-sky-400' : ''}`} /><span className={`text-base ${isDraggingRef ? 'text-sky-400 font-medium' : ''}`}>{isDraggingRef ? 'Thả ảnh vào đây' : 'Tải lên Ảnh mẫu'}</span>
                              </div>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={handleRefUpload} disabled={isAnalyzing} />
                      </label>
                  )}
              </div>
          )}
      </div>
    );
  };

  const renderPromptSection = () => (
    <div className="border border-gray-700 rounded-lg p-5 bg-[#1a1a1a]">
        
        {/* NEW TAB SWITCHER FOR HACK CONCEPT PRO */}
        {viewMode === 'hack-concept' && settings.hackPrompts && (
            <div className="flex gap-2 mb-3 bg-[#111] p-1 rounded-lg border border-gray-800">
                <button 
                    onClick={() => handleHackTabSwitch('fullBody')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded uppercase transition-all ${activeHackTab === 'fullBody' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                    Toàn thân
                </button>
                <button 
                    onClick={() => handleHackTabSwitch('portrait')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded uppercase transition-all ${activeHackTab === 'portrait' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                    Chân dung
                </button>
                <button 
                    onClick={() => handleHackTabSwitch('closeUp')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded uppercase transition-all ${activeHackTab === 'closeUp' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                    Cận cảnh
                </button>
            </div>
        )}

        <div className="relative flex justify-center items-center mb-3"><h3 className="font-semibold text-gray-200 text-lg">Mô tả prompt</h3></div>
        <div className="relative">
            <textarea value={settings.userPrompt} onChange={(e) => onSettingsChange({ userPrompt: e.target.value })} placeholder={settings.referenceImage ? "Mô tả bổ sung..." : "Mô tả chi tiết bối cảnh..."} className="w-full bg-[#333] border border-gray-600 rounded px-3 py-2 text-gray-200 text-lg focus:outline-none focus:border-sky-500 min-h-[140px] resize-y pr-14 leading-relaxed"/>
            <div className="absolute right-2 top-2 flex gap-1 text-gray-400">
                {settings.userPrompt && <button onClick={() => onSettingsChange({ userPrompt: '' })}><XCircleIcon className="w-6 h-6 hover:text-white" /></button>}
                <MicrophoneIcon className="w-6 h-6 cursor-pointer hover:text-white" />
            </div>
        </div>
    </div>
  );

  const renderOriginalOptions = () => (
    <div className={`border border-teal-500/50 rounded-lg bg-[#1a1a1a]`}>
        <div className="relative flex justify-center items-center p-5 cursor-pointer hover:bg-gray-800 rounded-t-lg transition-colors" onClick={() => setIsOptionsOpen(!isOptionsOpen)}>
            <h3 className="font-semibold text-gray-200 text-lg">Tùy chọn ảnh gốc</h3>
            <div className="absolute right-5">{isOptionsOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}</div>
        </div>
        {isOptionsOpen && (
            <div className="p-5 pt-0 border-t border-gray-800 space-y-3 mt-3">
                {[
                    { key: 'minimalCustomization', label: 'Ghép Ít Tuỳ Biến' },
                    { key: 'originalImageCompatibility', label: 'Tương thích ảnh gốc' },
                    { key: 'preserveFaceDetail', label: 'Giữ nguyên biểu cảm và khuôn mặt ảnh gốc' }, // New Option Added
                    { key: 'preservePose', label: 'Giữ nguyên dáng' },
                    { key: 'keepOriginalOutfit', label: 'Giữ nguyên trang phục ảnh gốc' },
                    { key: 'preserveComposition', label: 'Giữ nguyên bố cục' },
                    { key: 'preserveFocalLength', label: 'Giữ tiêu cự và khoảng cách máy' },
                    { key: 'preserveAspectRatio', label: 'Giữ tỷ lệ khung hình' },
                    { key: 'disableForeground', label: 'Không tạo hiệu ứng tiền cảnh tự động' }
                ].map((opt) => (
                    <div key={opt.key} className="flex items-center justify-between cursor-pointer group" onClick={() => handleOptionToggle(opt.key as keyof GenerationSettings, opt.label)}>
                        <span className={`text-lg ${settings[opt.key as keyof GenerationSettings] ? 'text-sky-400 font-bold' : 'text-gray-500'}`}>{opt.label}</span>
                        <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${settings[opt.key as keyof GenerationSettings] ? 'bg-sky-600 border-sky-600' : 'border-gray-600 group-hover:border-gray-500'}`}>
                            {settings[opt.key as keyof GenerationSettings] && <CheckIcon className="w-4 h-4 text-white" />}
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );

  const renderVisualEffects = () => (
    <div className="border border-blue-500/50 rounded-lg bg-[#1a1a1a]">
        <div className="relative flex justify-center items-center p-5 cursor-pointer hover:bg-gray-800 rounded-t-lg transition-colors" onClick={() => setIsVisualEffectsOpen(!isVisualEffectsOpen)}>
            <h3 className="font-semibold text-gray-200 text-lg">Hiệu ứng hình ảnh</h3>
            <div className="absolute right-5">{isVisualEffectsOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}</div>
        </div>
        {isVisualEffectsOpen && (
            <div className="p-5 pt-0 border-t border-gray-800 space-y-5">
                <div>
                    <label className="text-base text-gray-400 mb-2 block font-medium">Tùy chọn thời tiết</label>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                        {[WeatherOption.NONE, WeatherOption.LIGHT_SUN, WeatherOption.HARSH_SUN, WeatherOption.SUNSET, WeatherOption.NIGHT, WeatherOption.FOG].map((opt) => (
                        <label key={opt} className="flex items-center cursor-pointer group">
                            <input type="radio" name="weather_option" checked={settings.weather === opt} onChange={() => handleWeatherChange(opt)} className="w-5 h-5 text-sky-500 bg-gray-700 border-gray-500 focus:ring-sky-500 focus:ring-1"/>
                            <span className={`ml-2 text-base group-hover:text-sky-300 transition-colors ${settings.weather === opt ? 'text-sky-400 font-medium' : 'text-gray-400'}`}>{opt}</span>
                        </label>
                        ))}
                    </div>
                </div>
                <div className="pt-3 border-t border-gray-700">
                    <div className="flex justify-between text-base text-gray-400 mb-2">
                        <span>Độ mờ ống kính (Xóa phông)</span>
                        <span className={`${settings.blurAmount <= 3.5 ? 'text-sky-400 font-bold' : ''}`}>f/{settings.blurAmount.toFixed(1)}</span>
                    </div>
                    <input type="range" min="1.4" max="16.0" step="0.1" value={settings.blurAmount} onChange={(e) => handleBlurChange(parseFloat(e.target.value))} onMouseUp={handleBlurCommit} onTouchEnd={handleBlurCommit} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                </div>
            </div>
        )}
    </div>
  );

  const renderLightingEffects = () => (
    <div className="border border-orange-500/50 rounded-lg bg-[#1a1a1a]">
        <div className="relative flex justify-center items-center p-5 cursor-pointer hover:bg-gray-800 rounded-t-lg transition-colors" onClick={() => setIsLightingOpen(!isLightingOpen)}>
            <h3 className="font-semibold text-gray-200 text-lg">Hiệu ứng ánh sáng</h3>
            <div className="absolute right-5">{isLightingOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}</div>
        </div>
        {isLightingOpen && (
            <div className="p-5 pt-0 border-t border-gray-800 space-y-5">
                {lightingGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="pt-2">
                        <h4 className="text-base font-bold text-sky-500 mb-3 uppercase tracking-wider">{group.name}</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {group.options.map((option) => (
                                <label key={option} className="flex items-start cursor-pointer group">
                                    <input type="checkbox" checked={(settings.lightingEffects || []).includes(option)} onChange={() => handleLightingChange(option)} className="mt-1 w-5 h-5 text-sky-500 bg-gray-700 border-gray-600 rounded focus:ring-sky-500 focus:ring-1"/>
                                    <span className={`ml-2 text-base leading-tight transition-colors ${(settings.lightingEffects || []).includes(option) ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-400'}`}>{option}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );

  const renderGallery = () => (
    <div className="border border-purple-500/50 rounded-lg bg-[#1a1a1a] mt-5">
        <div className="relative flex justify-center items-center p-5 cursor-pointer hover:bg-gray-800 rounded-t-lg transition-colors" onClick={() => setIsGalleryOpen(!isGalleryOpen)}>
            <h3 className="font-semibold text-gray-200 text-lg flex items-center gap-2"><ArchiveBoxIcon className="w-6 h-6 text-purple-500" /> Kho Ảnh ({galleryItems.length})</h3>
            <div className="absolute right-5 flex items-center gap-2">
                {onSyncGallery && <button onClick={(e) => { e.stopPropagation(); onSyncGallery(); }} className="bg-teal-600/30 hover:bg-teal-600 text-teal-400 hover:text-white p-1.5 rounded transition-all"><CloudArrowDownIcon className="w-5 h-5" /></button>}
                {isGalleryOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
            </div>
        </div>
        {isGalleryOpen && (
            <div className="p-4 pt-0 border-t border-gray-800">
                <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto overflow-x-visible pr-1 p-2">
                    {galleryItems.map((item) => (
                        <div key={item.id} onClick={() => onSelectFromGallery(item)} className="relative group rounded overflow-visible border border-gray-700 bg-black cursor-pointer hover:scale-[1.8] hover:z-50 hover:shadow-2xl hover:border-sky-500 hover:ring-2 hover:ring-sky-500/50 transition-all duration-300">
                            <img src={item.url} alt="Stored" className="w-full h-24 object-contain bg-[#111] rounded"/>
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 rounded">
                                <a href={item.url} download={`archive_${item.id}.jpg`} className="bg-white/10 hover:bg-sky-600 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors" onClick={(e) => e.stopPropagation()}><ArrowDownTrayIcon className="w-4 h-4" /></a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
  );

  const renderQualitySection = () => (
    <div className="border border-gray-700 rounded-lg bg-[#1a1a1a] mb-4">
        <div className="p-4 border-b border-gray-800">
            <h3 className="font-semibold text-gray-200 text-sm uppercase tracking-wide flex items-center gap-2"><SparklesIcon className="w-4 h-4 text-yellow-500" /> Chất lượng & Chi tiết</h3>
        </div>
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => onSettingsChange({ enableUpscale: !settings.enableUpscale })}>
                <span className="text-sm text-gray-400">Upscale 4K & Phục hồi chi tiết</span>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.enableUpscale ? 'bg-yellow-600' : 'bg-gray-700'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.enableUpscale ? 'left-6' : 'left-1'}`}></div>
                </div>
            </div>
            <div>
                 <label className="text-xs text-gray-500 font-bold mb-1 block uppercase">Yêu cầu chi tiết (Tùy chỉnh)</label>
                 <textarea value={settings.restorationCustomPrompt || ''} onChange={(e) => onSettingsChange({ restorationCustomPrompt: e.target.value })} placeholder="VD: Giữ nốt ruồi, làm rõ mắt, da tự nhiên..." className="w-full bg-[#222] border border-gray-700 rounded p-2 text-sm text-gray-300 focus:border-yellow-500 h-16 resize-none"/>
            </div>
        </div>
    </div>
  );

  // --- NEW HACK CONCEPT PRO MODAL ---
  const renderHackConceptModal = () => {
    if (hackModalStep === 'off') return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
             <div className="bg-[#1e1e1e] border border-purple-500/50 rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.3)] max-w-lg w-full overflow-hidden animate-fade-in relative">
                 
                 {/* Close Button */}
                 <button onClick={() => { setHackModalStep('off'); setPendingReferenceFile(null); }} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                     <XCircleIcon className="w-6 h-6" />
                 </button>

                 {/* Step 1: Intro/Confirm */}
                 {hackModalStep === 'intro' && (
                     <div className="p-8 text-center flex flex-col items-center">
                         <div className="w-16 h-16 rounded-full bg-purple-900/30 flex items-center justify-center mb-6 ring-2 ring-purple-500/50 animate-pulse">
                             <BoltIcon className="w-8 h-8 text-purple-400" />
                         </div>
                         <h2 className="text-xl font-bold text-white mb-2">Tôi đã nhận thấy ảnh tham chiếu.</h2>
                         <p className="text-gray-300 mb-8">
                             Bạn có muốn tôi phân tích bối cảnh và màu sắc cho ảnh này không?
                         </p>
                         <button 
                             onClick={performHackAnalysis}
                             className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-purple-500/30 flex items-center justify-center gap-2"
                         >
                             <SparklesIcon className="w-5 h-5" /> Phân tích ngay
                         </button>
                     </div>
                 )}

                 {/* Step 2: Analyzing */}
                 {hackModalStep === 'analyzing' && (
                     <div className="p-12 text-center flex flex-col items-center">
                         <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                         <h3 className="text-lg font-bold text-white">Đang phân tích bối cảnh...</h3>
                         <p className="text-gray-400 text-sm mt-2">Đang trích xuất mã màu & style</p>
                     </div>
                 )}

                 {/* Step 3: Selection */}
                 {hackModalStep === 'selection' && (
                     <div className="p-8">
                         <h3 className="text-lg font-bold text-white mb-6 text-center border-b border-gray-800 pb-4">Kết quả đã sẵn sàng! Chọn chế độ:</h3>
                         <div className="grid gap-4">
                             <button 
                                 onClick={() => handleHackOptionSelect(1)}
                                 className="group text-left p-4 rounded-xl border border-gray-700 bg-[#252525] hover:bg-purple-900/20 hover:border-purple-500 transition-all"
                             >
                                 <div className="flex justify-between items-center mb-1">
                                     <span className="font-bold text-white group-hover:text-purple-300">Chỉ dùng Prompt (Khuyên dùng)</span>
                                     <CheckCircleIcon className="w-5 h-5 text-gray-600 group-hover:text-purple-500" />
                                 </div>
                                 <p className="text-xs text-gray-400 flex items-center gap-1">
                                     <LightBulbIcon className="w-3 h-3 text-yellow-500" /> AI sẽ tự do sáng tạo bối cảnh tốt nhất từ mô tả.
                                 </p>
                             </button>

                             <button 
                                 onClick={() => handleHackOptionSelect(2)}
                                 className="group text-left p-4 rounded-xl border border-gray-700 bg-[#252525] hover:bg-blue-900/20 hover:border-blue-500 transition-all"
                             >
                                 <div className="flex justify-between items-center mb-1">
                                     <span className="font-bold text-white group-hover:text-blue-300">Dùng Prompt + Ảnh tham chiếu</span>
                                     <PhotoIcon className="w-5 h-5 text-gray-600 group-hover:text-blue-500" />
                                 </div>
                                 <p className="text-xs text-gray-400 flex items-center gap-1">
                                     <ExclamationCircleIcon className="w-3 h-3 text-orange-500" /> Lưu ý: Chỉ đẹp nếu ảnh gốc và ảnh mẫu cùng hướng sáng.
                                 </p>
                             </button>
                         </div>
                     </div>
                 )}
             </div>
        </div>
    );
  };

  // Analysis Modal rendered as function call (inline) to avoid remounting
  const renderAnalysisModal = () => {
    if (!showAnalysisModal) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-gray-600 rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100">
                <div className="p-6 border-b border-gray-700">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><DocumentMagnifyingGlassIcon className="w-6 h-6 text-sky-500" /> Chọn chế độ phân tích</h3>
                </div>
                <div className="p-6 grid gap-4">
                    {/* HACK CONCEPT PRO MODE is handled by separate modal now, keeping UI logic clean */}
                    
                    <button onClick={() => handleAnalysisSelection('basic')} className="flex flex-col gap-1 p-4 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-sky-500 transition-all text-left group">
                        <span className="text-white font-bold text-lg flex items-center justify-between">Phân tích Cơ bản<SparklesIcon className="w-5 h-5 text-gray-500 group-hover:text-sky-400" /></span>
                    </button>
                    
                    <button onClick={() => handleAnalysisSelection('deep')} className="flex flex-col gap-1 p-4 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-purple-500 transition-all text-left group">
                        <span className="text-white font-bold text-lg flex items-center justify-between">Phân tích Chuyên sâu<EyeIcon className="w-5 h-5 text-gray-500 group-hover:text-purple-400" /></span>
                    </button>

                    {/* Standard Mode: Show Background option normally */}
                    {viewMode !== 'hack-concept' && (
                        <button onClick={() => handleAnalysisSelection('background')} className="flex flex-col gap-1 p-4 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-emerald-500 transition-all text-left group">
                            <span className="text-white font-bold text-lg flex items-center justify-between">Phân tích Nền<PhotoIcon className="w-5 h-5 text-gray-500 group-hover:text-emerald-400" /></span>
                            <span className="text-xs text-gray-400">Chỉ lấy thông tin bối cảnh, bỏ qua nhân vật</span>
                        </button>
                    )}
                </div>
                <div className="p-4 bg-gray-900 border-t border-gray-700 flex justify-end">
                    <button onClick={() => { setShowAnalysisModal(false); setPendingReferenceFile(null); }} className="px-4 py-2 text-gray-300 hover:text-white font-medium hover:underline">Hủy bỏ</button>
                </div>
            </div>
        </div>
    );
  };

  return (
    <>
        {renderAnalysisModal()}
        {renderHackConceptModal()}

        <div className="h-full bg-[#111] border-l border-gray-800 p-4 flex flex-col gap-4 overflow-y-auto text-lg custom-scrollbar">
            <div className="flex items-center justify-center py-4 border-b border-gray-800 mb-2">
                <h2 className={`text-xl font-bold uppercase tracking-wide text-center ${viewMode === 'hack-concept' ? 'text-purple-500' : 'text-blue-500'}`}>
                    {viewMode === 'hack-concept' ? 'HACK CONCEPT PRO' : 'FAKE CONCEPT'}
                </h2>
            </div>

            {renderTabNavigation()}
            
            {activeTab === 'studio' ? (
                <>
                    {/* renderServiceSelection removed - forcing Gommo */}
                    {renderModelList()}
                    {renderModeSelector()} {/* NEW: Mode Selector */}
                    {renderSizeConfig()}
                    {renderReferenceImageSection()}
                    
                    {/* Hide Quality Section in Hack Concept Pro */}
                    {viewMode !== 'hack-concept' && renderQualitySection()}
                    
                    {renderPromptSection()}
                    
                    {/* Updated: Show Advanced Options in both Concept and Hack Concept Pro */}
                    {renderOriginalOptions()}
                    {renderVisualEffects()}
                    {renderLightingEffects()}
                    
                    {renderGallery()}
                </>
            ) : (
                renderKeysTabContent()
            )}

            <div className="mt-4 text-center text-sm text-gray-600 pb-4">
                BẢN QUYỀN ỨNG DỤNG AI THUỘC SỞ HỮU LƯỢM
            </div>
        </div>
    </>
  );
};

export default ControlPanel;