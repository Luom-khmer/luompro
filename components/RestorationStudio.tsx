import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
    PhotoIcon, 
    ArrowDownTrayIcon, 
    SparklesIcon, 
    CheckCircleIcon, 
    ArrowsRightLeftIcon, 
    Square2StackIcon, 
    ArrowPathIcon,
    ExclamationTriangleIcon,
    ChevronDownIcon,
    CheckIcon,
    CubeIcon,
    BanknotesIcon
} from '@heroicons/react/24/outline';
import { resizeImage, fileToBase64 } from '../services/geminiService';
import { generateGommoImage, pollGommoImageCompletion, fetchGommoModels } from '../services/gommoService';
import { deductUserCredits } from '../services/firebaseService';
import { GommoModel } from '../types';

interface RestorationStudioProps {
    apiKey: string;
    gommoApiKey: string;
    userCredits: number;
    currentUser: any;
    onUpdateCredits: () => void;
}

const DEFAULT_ISSUES = [
    { id: 1, text: "Ảnh bị mờ và thiếu chi tiết sắc nét", checked: false },
    { id: 2, text: "Nhiễu hạt (noise) vùng tối", checked: false },
    { id: 3, text: "Màu sắc bị phai / Ám màu thời gian", checked: false },
    { id: 4, text: "Khuôn mặt thiếu chi tiết tự nhiên", checked: false },
    { id: 5, text: "Độ tương phản thấp", checked: false },
    { id: 6, text: "Vết xước nhỏ và bụi bẩn", checked: false },
];

const RATIO_LABELS: Record<string, string> = {
    '1:1': 'Vuông',
    '3:4': 'Dọc',
    '4:3': 'Ngang',
    '9:16': 'Story',
    '16:9': 'Điện ảnh',
    'auto': 'Gốc'
};

// Enhancement Options with English Prompts
const ENHANCEMENT_OPTIONS = [
    { 
        id: 'upscale', 
        label: 'Tăng nét', 
        prompt: "Upscale this image to 2k/4k using AI. Keep original details, increase sharpness and clarity without artifacts." 
    },
    { 
        id: 'restore_damage', 
        label: 'Phục hồi ảnh rách ố vàng', 
        prompt: "Analyze and perform 5 steps: 1. Increase sharpness 2. Restore color 3. Denoise 4. Brighten 5. Balance skin tone. Explain each step clearly." 
    },
    { 
        id: 'studio_bg', 
        label: 'Thay nền studio', 
        prompt: "Remove the old background and replace it with a bright minimal studio background, making the image look new, clear, and professional." 
    }
];

const RestorationStudio: React.FC<RestorationStudioProps> = ({ 
    apiKey, gommoApiKey, userCredits, currentUser, onUpdateCredits 
}) => {
    // State
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [originalPreview, setOriginalPreview] = useState<string | null>(null);
    const [restoredPreview, setRestoredPreview] = useState<string | null>(null);
    
    // UI Logic State
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false); // State for Gemini Analysis
    const [sliderPosition, setSliderPosition] = useState(50);
    const [viewMode, setViewMode] = useState<'compare' | 'single'>('compare');
    
    // Default English Prompt
    const [customPrompt, setCustomPrompt] = useState(
        "Upgrade and restore image quality based on the original image as the sole reference. Maintain identity and all content exactly as the original: same subject, facial features, expression, pose, body proportions, hairstyle, outfit, accessories, background, objects, composition, framing, and perspective. Absolutely DO NOT add, remove, replace, or 'hallucinate' any details."
    );

    const [issues, setIssues] = useState<typeof DEFAULT_ISSUES>([]); // Initialize empty for dynamic loading
    const [error, setError] = useState<string | null>(null);

    // --- Model & Config State ---
    const [models, setModels] = useState<GommoModel[]>([]);
    const [selectedModelId, setSelectedModelId] = useState<string>('google_image_gen_banana_pro');
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    
    // New Configuration States
    const [selectedRatio, setSelectedRatio] = useState<string>('auto');
    const [selectedMode, setSelectedMode] = useState<string>('');
    const [selectedResolution, setSelectedResolution] = useState<string>('1k');
    
    // Checkbox States
    const [activeEnhancements, setActiveEnhancements] = useState<string[]>([]);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    // --- Fetch Models on Mount or Key Change ---
    useEffect(() => {
        const loadModels = async () => {
            if (!gommoApiKey) return;
            setIsLoadingModels(true);
            try {
                const response = await fetchGommoModels(gommoApiKey, 'image');
                let fetchedModels: GommoModel[] = [];
                
                if (response?.success?.data && Array.isArray(response.success.data)) {
                    fetchedModels = response.success.data;
                } else if (response?.data && Array.isArray(response.data)) {
                    fetchedModels = response.data;
                } else if (Array.isArray(response)) {
                    fetchedModels = response as unknown as GommoModel[];
                }

                if (fetchedModels.length > 0) {
                    setModels(fetchedModels);
                    const exists = fetchedModels.find(m => m.model === selectedModelId);
                    if (!exists) {
                        const preferred = fetchedModels.find(m => m.model === 'google_image_gen_banana_pro') || fetchedModels[0];
                        setSelectedModelId(preferred.model);
                    }
                }
            } catch (err) {
                console.error("Failed to load models in Restoration Studio", err);
            } finally {
                setIsLoadingModels(false);
            }
        };

        loadModels();
    }, [gommoApiKey]);

    // --- Active Model & Derived Data ---
    const activeModel = useMemo(() => {
        return models.find(m => m.model === selectedModelId) || null;
    }, [models, selectedModelId]);

    const activeRatios = useMemo(() => {
        if (activeModel && activeModel.ratios && activeModel.ratios.length > 0) {
            return activeModel.ratios.map(r => r.name);
        }
        return ['auto', '1:1', '3:4', '4:3', '9:16', '16:9'];
    }, [activeModel]);

    const activeModes = useMemo(() => activeModel?.modes || [], [activeModel]);
    const activeResolutions = useMemo(() => activeModel?.resolutions || [], [activeModel]);

    // --- Calculate Price ---
    const estimatedCost = useMemo(() => {
        if (!activeModel) return 0;
        let price = activeModel.price || 0;

        if (activeModel.prices && activeModel.prices.length > 0) {
            const matchedPrice = activeModel.prices.find(p => {
                const modeMatch = !p.mode || p.mode === selectedMode;
                const resMatch = !p.resolution || p.resolution === selectedResolution;
                return modeMatch && resMatch;
            });
            if (matchedPrice) price = matchedPrice.price;
        }
        return price;
    }, [activeModel, selectedMode, selectedResolution]);

    // --- Set Defaults when Model Changes ---
    useEffect(() => {
        if (activeModel) {
            // Mode
            if (activeModel.modes && activeModel.modes.length > 0) {
                if (!activeModel.modes.find(m => m.type === selectedMode)) {
                    setSelectedMode(activeModel.modes[0].type);
                }
            } else {
                setSelectedMode(''); // Default if no modes
            }

            // Resolution
            if (activeModel.resolutions && activeModel.resolutions.length > 0) {
                if (!activeModel.resolutions.find(r => r.type === selectedResolution)) {
                    setSelectedResolution(activeModel.resolutions[0].type);
                }
            } else {
                setSelectedResolution('1k'); // Fallback
            }
        }
    }, [activeModel]);

    // --- Handle Click Outside Dropdown ---
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Helper: Analyze Image with Gemini
    const analyzeImageWithGemini = async (file: File) => {
        if (!apiKey || apiKey.length < 10) return;

        setIsAnalyzing(true);
        try {
            // Resize for analysis to save bandwidth/tokens
            const base64 = await resizeImage(file, 1024, 1024, 0.7);
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            // Note: Using flash model for speed
            const promptText = `
                You are a professional photo restoration expert. Analyze this image.
                
                PART 1: DETECT DEFECTS
                Identify if the following defects are present (return boolean true/false):
                1. Blurry or low detail (lack of sharpness)
                2. Noise or grain (especially in dark areas)
                3. Faded colors or color cast (aging)
                4. Unnatural or unclear facial features
                5. Low contrast
                6. Scratches, dust spots, or physical damage

                PART 2: RESTORATION PLAN
                Generate a "restoration_prompt" string in ENGLISH.
                
                STRICT REQUIREMENTS FOR "restoration_prompt":
                1. START EXACTLY WITH THIS SENTENCE: 
                   "Upgrade and restore image quality based on the original image as the sole reference. Maintain identity and all content exactly as the original: same subject, facial features, expression, pose, body proportions, hairstyle, outfit, accessories, background, objects, composition, framing, and perspective. Absolutely DO NOT add, remove, replace, or 'hallucinate' any details."
                
                2. FORBIDDEN: Do NOT describe the subject's appearance (e.g. gender, age, clothes, pose). Do NOT say "A woman..." or "A man...". The restoration engine uses the image itself.
                
                3. TECHNICAL FIXES: Append a section starting with "Technical improvements:" listing specific fixes for the defects found in Part 1 (e.g. "Denoise, sharpen details, white balance, skin recovery...").

                Return ONLY a JSON object with this structure:
                {
                    "defects": [bool, bool, bool, bool, bool, bool],
                    "restoration_prompt": "string"
                }
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
                        { text: promptText }
                    ]
                },
                config: {
                    responseMimeType: "application/json"
                }
            });

            const text = response.text;
            if (text) {
                const result = JSON.parse(text);
                
                // Update Issues List - Only show detected issues
                if (result.defects && Array.isArray(result.defects)) {
                    const detectedIssues = DEFAULT_ISSUES.filter((issue, index) => result.defects[index]);
                    setIssues(detectedIssues);
                }

                // Update Prompt
                if (result.restoration_prompt) {
                    setCustomPrompt(result.restoration_prompt);
                }
            }

        } catch (e) {
            console.error("Gemini Analysis Failed:", e);
            // Fallback: Don't break the app, just stop analyzing
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Handle Image Upload
    const handleFileUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) return;
        setOriginalFile(file);
        setOriginalPreview(URL.createObjectURL(file));
        setRestoredPreview(null);
        setError(null);
        
        // Reset issues and enhancements
        setIssues([]);
        setActiveEnhancements([]);
        setCustomPrompt("Upgrade and restore image quality based on the original image as the sole reference. Maintain identity and all content exactly as the original: same subject, facial features, expression, pose, body proportions, hairstyle, outfit, accessories, background, objects, composition, framing, and perspective. Absolutely DO NOT add, remove, replace, or 'hallucinate' any details.");
        
        // Trigger Analysis
        await analyzeImageWithGemini(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    // Handle Toggle Enhancements
    const handleEnhancementToggle = (id: string, promptText: string) => {
        if (activeEnhancements.includes(id)) {
            // Remove
            setActiveEnhancements(prev => prev.filter(item => item !== id));
            setCustomPrompt(prev => prev.replace(" " + promptText, "").replace(promptText, "").trim());
        } else {
            // Add
            setActiveEnhancements(prev => [...prev, id]);
            setCustomPrompt(prev => {
                const clean = prev.trim();
                return clean ? clean + " " + promptText : promptText;
            });
        }
    };

    // Handle Restoration Logic
    const handleRestore = async () => {
        if (!originalFile) return;
        if (!currentUser) return alert("Vui lòng đăng nhập.");
        if (!gommoApiKey) return alert("Chưa cấu hình Gommo API Key.");
        
        if (userCredits < estimatedCost) {
            return alert(`Không đủ Credits. Cần ${estimatedCost}, hiện có ${userCredits}.`);
        }

        setIsProcessing(true);
        setError(null);

        try {
            // 1. Prepare Image
            const base64Data = await resizeImage(originalFile, 1536, 1536, 0.6);
            let mimeType = originalFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const fullBase64 = `data:${mimeType};base64,${base64Data}`;

            // 2. Call API
            // Map Ratio: Convert '1:1' -> '1_1' for API if needed, usually API takes '1_1' or '1:1' depending on model doc.
            // Gommo usually takes '1_1'.
            let apiRatio = selectedRatio === 'auto' ? 'auto' : selectedRatio.replace(':', '_');

            const prompt = `${customPrompt} ${selectedResolution === '4k' ? '4k resolution, ultra sharp' : 'high quality'}`;
            
            const genRes = await generateGommoImage(
                gommoApiKey,
                selectedModelId,
                prompt,
                {
                    editImage: true,
                    base64Image: fullBase64,
                    resolution: selectedResolution, // Pass selected resolution
                    ratio: apiRatio,
                    mode: selectedMode || undefined, // Pass selected mode
                    project_id: 'restoration_tool'
                }
            );

            let resultUrl = '';
            
            if (genRes.success?.imageInfo?.url) {
                resultUrl = genRes.success.imageInfo.url;
            } else if (genRes.success?.imageInfo?.id_base) {
                resultUrl = await pollGommoImageCompletion(gommoApiKey, genRes.success.imageInfo.id_base);
            } else if (genRes.imageInfo?.url) {
                resultUrl = genRes.imageInfo.url;
            } else {
                throw new Error("Không nhận được phản hồi hợp lệ từ AI.");
            }

            if (!resultUrl) throw new Error("URL ảnh rỗng.");

            // 3. Success
            setRestoredPreview(resultUrl);
            await deductUserCredits(currentUser.uid, estimatedCost);
            onUpdateCredits();

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Lỗi phục chế ảnh.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle Download
    const handleDownload = async () => {
        if (!restoredPreview) return;
        try {
            const response = await fetch(restoredPreview);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `restored_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            window.open(restoredPreview, '_blank');
        }
    };

    // Slider Interaction
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isResizing || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        setSliderPosition(percent);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isResizing || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        setSliderPosition(percent);
    };

    return (
        <div className="flex flex-row h-[calc(100vh-80px)] w-full overflow-hidden bg-[#0f1012] text-gray-200 font-sans">
            
            {/* --- LEFT SIDEBAR --- */}
            <aside className="w-[320px] md:w-[360px] shrink-0 border-r border-gray-800 bg-[#141414] flex flex-col h-full overflow-y-auto custom-scrollbar">
                <div className="p-5 space-y-6">
                    
                    {/* Header / Model Selector */}
                    <div className="mb-2" ref={dropdownRef}>
                         <div 
                             className="bg-[#1e1e1e] border border-gray-700 hover:border-gray-500 rounded-xl p-3 flex items-center justify-between cursor-pointer transition-colors shadow-sm"
                             onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                         >
                             <div className="flex items-center gap-3">
                                 <div className="bg-purple-900/30 p-2 rounded-lg border border-purple-500/30">
                                     <CubeIcon className="w-5 h-5 text-purple-400" />
                                 </div>
                                 <div className="flex flex-col">
                                     <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">AI Model</span>
                                     <span className="text-sm font-bold text-white truncate max-w-[150px]">
                                         {isLoadingModels ? "Đang tải..." : (activeModel?.name || selectedModelId)}
                                     </span>
                                 </div>
                             </div>
                             <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                         </div>

                         {/* Dropdown List */}
                         {isModelDropdownOpen && (
                             <div className="absolute left-5 w-[280px] md:w-[320px] mt-2 bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
                                 {models.length === 0 ? (
                                     <div className="p-4 text-xs text-gray-500 text-center">Không có dữ liệu model</div>
                                 ) : (
                                     models.map((model) => (
                                         <div 
                                             key={model.model}
                                             onClick={() => {
                                                 setSelectedModelId(model.model);
                                                 setIsModelDropdownOpen(false);
                                             }}
                                             className={`px-4 py-3 text-sm cursor-pointer border-b border-gray-800 last:border-0 hover:bg-[#252525] flex justify-between items-center ${selectedModelId === model.model ? 'bg-purple-900/20 text-purple-400 font-bold' : 'text-gray-300'}`}
                                         >
                                             <span className="truncate pr-2">{model.name}</span>
                                             {selectedModelId === model.model && <CheckIcon className="w-4 h-4 shrink-0" />}
                                         </div>
                                     ))
                                 )}
                             </div>
                         )}
                    </div>

                    {/* --- NEW OUTPUT CONFIGURATION (Ratio, Mode, Res) --- */}
                    {/* Moved UP before Thumbnail */}
                    <div className="bg-[#1e1e1e] rounded-xl p-4 border border-gray-700/50">
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {/* RATIO */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1.5 uppercase">RATIO</label>
                                <div className="relative">
                                    <select 
                                        value={selectedRatio}
                                        onChange={(e) => setSelectedRatio(e.target.value)}
                                        className="w-full bg-[#151515] text-white text-[11px] font-bold py-2.5 pl-2 pr-5 rounded-lg border border-gray-700 appearance-none focus:outline-none focus:border-purple-500 cursor-pointer truncate"
                                    >
                                        {activeRatios.map(r => (
                                            <option key={r} value={r}>
                                                {r}{RATIO_LABELS[r] ? ` • ${RATIO_LABELS[r]}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDownIcon className="w-3 h-3 text-gray-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>

                            {/* MODE */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1.5 uppercase">MODE</label>
                                <div className="relative">
                                    <select 
                                        value={selectedMode}
                                        onChange={(e) => setSelectedMode(e.target.value)}
                                        className="w-full bg-[#151515] text-white text-[11px] font-bold py-2.5 pl-2 pr-5 rounded-lg border border-gray-700 appearance-none focus:outline-none focus:border-purple-500 cursor-pointer truncate"
                                        disabled={activeModes.length === 0}
                                    >
                                        {activeModes.length === 0 && <option value="">Default</option>}
                                        {activeModes.map(m => (
                                            <option key={m.type} value={m.type}>{m.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDownIcon className="w-3 h-3 text-gray-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>

                            {/* RES */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1.5 uppercase">RES</label>
                                <div className="relative">
                                    <select 
                                        value={selectedResolution}
                                        onChange={(e) => setSelectedResolution(e.target.value)}
                                        className="w-full bg-[#151515] text-white text-[11px] font-bold py-2.5 pl-2 pr-5 rounded-lg border border-gray-700 appearance-none focus:outline-none focus:border-purple-500 cursor-pointer truncate"
                                        disabled={activeResolutions.length === 0}
                                    >
                                        {activeResolutions.length === 0 && <option value="1k">1k</option>}
                                        {activeResolutions.map(r => (
                                            <option key={r.type} value={r.type}>{r.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDownIcon className="w-3 h-3 text-gray-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Price Estimation */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                            <span className="text-xs text-gray-500 font-medium">Chi phí ước tính:</span>
                            <div className="flex items-center gap-1.5 text-yellow-500 font-bold text-sm bg-yellow-900/10 px-2 py-0.5 rounded border border-yellow-500/20">
                                <BanknotesIcon className="w-4 h-4" />
                                <span>{estimatedCost} Credits</span>
                            </div>
                        </div>
                    </div>

                    {/* Imported Image Thumbnail */}
                    {/* Moved Here */}
                    <div className="bg-[#1e1e1e] rounded-xl p-3 border border-gray-700">
                        <div className="flex gap-3">
                            <div className="w-16 h-16 bg-black rounded-lg overflow-hidden border border-gray-700 shrink-0 relative group cursor-pointer">
                                {originalPreview ? (
                                    <img src={originalPreview} className="w-full h-full object-cover" alt="Thumb" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                                        <PhotoIcon className="w-6 h-6" />
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                    onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                                />
                            </div>
                            <div className="flex flex-col justify-center min-w-0">
                                <h3 className="font-bold text-sm text-gray-200 truncate">
                                    {originalFile ? originalFile.name : "Chưa chọn ảnh"}
                                </h3>
                                <p className="text-xs text-green-400 font-medium">
                                    {originalFile ? "Sẵn sàng xử lý" : "Vui lòng nhập ảnh"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Detected Issues */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">VẤN ĐỀ PHÁT HIỆN</label>
                             {isAnalyzing && (
                                 <span className="text-[10px] text-purple-400 flex items-center gap-1 animate-pulse">
                                     <SparklesIcon className="w-3 h-3" /> AI đang phân tích...
                                 </span>
                             )}
                        </div>
                        <div className="space-y-2 bg-[#1a1a1a] p-3 rounded-lg border border-gray-800 min-h-[60px]">
                            {issues.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500 text-[10px] italic py-2">
                                     {isAnalyzing ? "Đang quét lỗi ảnh..." : "Chưa phát hiện vấn đề"}
                                </div>
                            ) : (
                                issues.map((issue) => (
                                    <div key={issue.id} className="flex items-start gap-2.5 animate-fade-in">
                                         <div className="mt-0.5 w-4 h-4 rounded bg-red-900/30 border border-red-500/50 flex items-center justify-center shrink-0">
                                             <ExclamationTriangleIcon className="w-2.5 h-2.5 text-red-500" />
                                         </div>
                                         <p className="text-xs text-gray-300 leading-snug">{issue.text}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Restoration Plan */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-2">
                             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">KẾ HOẠCH PHỤC CHẾ</label>
                             <button onClick={() => setCustomPrompt("Upgrade and restore image quality based on the original image as the sole reference. Maintain identity and all content exactly as the original: same subject, facial features, expression, pose, body proportions, hairstyle, outfit, accessories, background, objects, composition, framing, and perspective. Absolutely DO NOT add, remove, replace, or 'hallucinate' any details.")} className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1"><ArrowPathIcon className="w-3 h-3"/> Reset</button>
                        </div>
                        <textarea 
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg p-3 text-xs text-gray-300 focus:outline-none focus:border-purple-500 resize-none h-32 leading-relaxed custom-scrollbar mb-3"
                            placeholder="Detailed restoration request..."
                        />
                        
                        {/* New Enhancement Options */}
                        <div className="space-y-2">
                            {ENHANCEMENT_OPTIONS.map((opt) => (
                                <label key={opt.id} className="flex items-start gap-2 cursor-pointer group p-2 rounded-lg bg-[#1a1a1a] border border-gray-700 hover:border-gray-500 transition-colors">
                                    <div className="relative flex items-center">
                                        <input 
                                            type="checkbox" 
                                            checked={activeEnhancements.includes(opt.id)}
                                            onChange={() => handleEnhancementToggle(opt.id, opt.prompt)}
                                            className="w-4 h-4 bg-gray-800 border-gray-600 rounded focus:ring-purple-500 focus:ring-1 text-purple-600 cursor-pointer" 
                                        />
                                    </div>
                                    <span className={`text-xs font-medium transition-colors ${activeEnhancements.includes(opt.id) ? 'text-purple-400' : 'text-gray-400 group-hover:text-gray-300'}`}>
                                        {opt.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Start Button */}
                    <button 
                        onClick={handleRestore}
                        disabled={isProcessing || !originalFile}
                        className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg transition-all transform active:scale-95 ${
                            isProcessing 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-purple-900/20'
                        }`}
                    >
                        {isProcessing ? (
                            <div className="flex items-center justify-center gap-2">
                                <ArrowPathIcon className="w-5 h-5 animate-spin" /> Đang xử lý...
                            </div>
                        ) : (
                            "Bắt đầu phục chế"
                        )}
                    </button>
                    {error && (
                        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-xs flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 flex flex-col bg-[#0f1012] relative min-w-0">
                
                {/* Top Bar */}
                <div className="absolute top-4 right-4 z-50 flex gap-2">
                    {restoredPreview && (
                        <div className="bg-[#1a1a1a]/90 backdrop-blur border border-gray-700 rounded-lg p-1 flex">
                            <button 
                                onClick={() => setViewMode('compare')}
                                className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'compare' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                <ArrowsRightLeftIcon className="w-4 h-4" /> So sánh
                            </button>
                            <button 
                                onClick={() => setViewMode('single')}
                                className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'single' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Square2StackIcon className="w-4 h-4" /> Kết quả
                            </button>
                        </div>
                    )}
                    {restoredPreview && (
                        <button 
                            onClick={handleDownload}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-sm shadow-lg flex items-center gap-2"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4" /> Tải về
                        </button>
                    )}
                </div>

                {/* Main Viewport */}
                <div 
                    className="flex-1 flex items-center justify-center p-8 bg-[#0a0a0a] relative overflow-hidden"
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                >
                    {/* Drag Overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 bg-purple-900/20 border-4 border-dashed border-purple-500 z-50 flex flex-col items-center justify-center pointer-events-none backdrop-blur-sm">
                            <ArrowDownTrayIcon className="w-16 h-16 text-purple-400 animate-bounce" />
                            <h3 className="text-xl font-bold text-white mt-4">Thả ảnh vào đây để phục chế</h3>
                        </div>
                    )}

                    {!originalFile ? (
                        <div className="text-center flex flex-col items-center">
                            <div className="w-24 h-24 bg-[#1a1a1a] rounded-3xl border border-gray-700 flex items-center justify-center mb-6 shadow-2xl">
                                <PhotoIcon className="w-10 h-10 text-gray-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Bắt đầu phục chế ảnh</h2>
                            <p className="text-gray-500 max-w-sm mb-8">
                                Kéo thả ảnh vào đây hoặc chọn từ menu bên trái. Hỗ trợ JPG, PNG chất lượng cao.
                            </p>
                            <label className="px-6 py-3 bg-[#1a1a1a] hover:bg-[#252525] border border-gray-700 rounded-xl cursor-pointer text-sm font-bold text-white transition-all">
                                Tải ảnh lên
                                <input type="file" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} />
                            </label>
                        </div>
                    ) : (
                        <div className="relative w-full h-full max-w-4xl max-h-full flex items-center justify-center">
                            {/* Compare Slider Mode */}
                            {viewMode === 'compare' && restoredPreview ? (
                                <div 
                                    ref={containerRef}
                                    className="relative w-full h-full select-none cursor-col-resize overflow-hidden rounded-xl shadow-2xl border border-gray-800"
                                    onMouseDown={() => setIsResizing(true)}
                                    onMouseUp={() => setIsResizing(false)}
                                    onMouseLeave={() => setIsResizing(false)}
                                    onMouseMove={handleMouseMove}
                                    onTouchStart={() => setIsResizing(true)}
                                    onTouchEnd={() => setIsResizing(false)}
                                    onTouchMove={handleTouchMove}
                                >
                                    {/* Restored Image (Underneath) */}
                                    <img 
                                        src={restoredPreview} 
                                        alt="Restored" 
                                        className="absolute inset-0 w-full h-full object-contain bg-[#111]"
                                        draggable={false}
                                    />

                                    {/* Original Image (On Top, Clipped) */}
                                    <div 
                                        className="absolute inset-0 overflow-hidden border-r-2 border-white/50"
                                        style={{ width: `${sliderPosition}%` }}
                                    >
                                        <img 
                                            src={originalPreview!} 
                                            alt="Original" 
                                            className="absolute inset-0 w-full h-full object-contain bg-[#111]"
                                            draggable={false}
                                            // Trick to keep aspect ratio matching parent even when clipped
                                            style={{ width: containerRef.current?.clientWidth, height: containerRef.current?.clientHeight }} 
                                        />
                                        {/* Label */}
                                        <div className="absolute top-4 left-4 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur">ẢNH GỐC</div>
                                    </div>

                                    {/* Handle */}
                                    <div 
                                        className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize z-20 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                        style={{ left: `${sliderPosition}%` }}
                                    >
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                                            <ArrowsRightLeftIcon className="w-4 h-4 text-black" />
                                        </div>
                                    </div>

                                    {/* Label Right */}
                                    <div className="absolute top-4 right-4 bg-purple-600/80 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur z-10">KẾT QUẢ</div>
                                </div>
                            ) : (
                                // Single View (Original or Result)
                                <div className="relative w-full h-full flex items-center justify-center">
                                    <img 
                                        src={restoredPreview || originalPreview!} 
                                        alt="View" 
                                        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-gray-800"
                                    />
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-xs font-bold backdrop-blur border border-white/10">
                                        {restoredPreview ? "KẾT QUẢ PHỤC CHẾ" : "ẢNH GỐC (CHƯA XỬ LÝ)"}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default RestorationStudio;