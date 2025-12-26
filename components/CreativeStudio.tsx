import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    SparklesIcon, 
    MagnifyingGlassPlusIcon, 
    MagnifyingGlassMinusIcon,
    ArrowPathIcon,
    ArrowDownTrayIcon,
    PhotoIcon,
    TrashIcon,
    XMarkIcon,
    ChevronDownIcon,
    BoltIcon,
    PlusIcon,
    MinusIcon,
    Square2StackIcon,
    AdjustmentsHorizontalIcon,
    UserCircleIcon,
    PaintBrushIcon,
    CubeIcon
} from '@heroicons/react/24/outline';
import { generateGommoImage, pollGommoImageCompletion, fetchGommoModels } from '../services/gommoService';
import { resizeImage, fileToBase64 } from '../services/geminiService';
import { deductUserCredits } from '../services/firebaseService';
import { GommoModel } from '../types';
import CropperModal from './CropperModal';

// --- HELPERS FOR METADATA ---
const formatBytes = (bytes: number, decimals = 1) => {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b);
};

const getAspectRatio = (w: number, h: number): string => {
    if (!w || !h) return '';
    const ratio = w / h;
    const commonRatios = [
        { label: "1:1", value: 1 },
        { label: "2:3", value: 2/3 }, { label: "3:2", value: 3/2 },
        { label: "3:4", value: 3/4 }, { label: "4:3", value: 4/3 },
        { label: "9:16", value: 9/16 }, { label: "16:9", value: 16/9 }
    ];
    const match = commonRatios.find(r => Math.abs(ratio - r.value) < 0.03);
    if (match) return match.label;
    
    const divisor = gcd(w, h);
    return `${Math.round(w / divisor)}:${Math.round(h / divisor)}`;
};

interface CreativeStudioProps {
    gommoApiKey: string;
    userCredits: number;
    currentUser: any;
    onUpdateCredits: () => void;
}

interface ReferenceImage {
    id: string;
    file: File;
    preview: string;
    type: 'image' | 'face' | 'style' | 'structure';
    strength: number; // 0 - 100
}

const CreativeStudio: React.FC<CreativeStudioProps> = ({ 
    gommoApiKey, userCredits, currentUser, onUpdateCredits 
}) => {
    // --- Main Canvas State ---
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(30);
    
    // --- Metadata State ---
    const [imgMetadata, setImgMetadata] = useState<{ width: number, height: number, size: string }>({ width: 0, height: 0, size: '...' });

    // --- Model Management State ---
    const [models, setModels] = useState<GommoModel[]>([]);
    const [selectedModelId, setSelectedModelId] = useState<string>('google_image_gen_banana_pro');
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // --- Advanced Reference State ---
    const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
    const [activeRefIndex, setActiveRefIndex] = useState<number | null>(null); // To show settings for specific ref
    
    // --- Cropper State ---
    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [pendingRefFile, setPendingRefFile] = useState<File | null>(null);

    // UI State for Hover Panel
    const [isHovered, setIsHovered] = useState(false);
    const [qty, setQty] = useState(1);
    const [res, setRes] = useState('1k');
    
    // --- NEW: Ratio and Mode State ---
    const [selectedRatio, setSelectedRatio] = useState('1:1');
    const [selectedMode, setSelectedMode] = useState('');

    const [isRefPanelExpanded, setIsRefPanelExpanded] = useState(false);

    // --- INITIAL LOAD: FETCH MODELS ---
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

                // Filter only models that support image generation or reference features
                // Prioritize models with 'withSubject' or 'withReference' flags if available
                if (fetchedModels.length > 0) {
                    setModels(fetchedModels);
                    // Default to existing if valid, else first available
                    if (!fetchedModels.find(m => m.model === selectedModelId)) {
                        const preferred = fetchedModels.find(m => m.model === 'google_image_gen_banana_pro') || fetchedModels[0];
                        setSelectedModelId(preferred.model);
                    }
                }
            } catch (e) {
                console.error("Failed to load models", e);
            } finally {
                setIsLoadingModels(false);
            }
        };
        loadModels();
    }, [gommoApiKey]);

    // Click Outside Dropdown Handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- DERIVED STATE ---
    const activeModel = useMemo(() => models.find(m => m.model === selectedModelId), [models, selectedModelId]);
    
    // Calculate Max Slots based on Model Capability
    const maxRefSlots = useMemo(() => {
        return activeModel?.maxSubject || (activeModel?.withSubject ? 1 : 0);
    }, [activeModel]);

    // Derived Ratios and Modes
    const activeRatios = useMemo(() => {
        return activeModel?.ratios?.map(r => r.name) || ['1:1', '3:4', '4:3', '9:16', '16:9'];
    }, [activeModel]);

    const activeModes = useMemo(() => {
        return activeModel?.modes || [];
    }, [activeModel]);

    // Update defaults when model changes
    useEffect(() => {
        if (activeModel) {
            if (activeModel.modes && activeModel.modes.length > 0) {
                if (!activeModel.modes.find(m => m.type === selectedMode)) {
                    setSelectedMode(activeModel.modes[0].type);
                }
            } else {
                setSelectedMode('');
            }
        }
    }, [activeModel]);

    // Calculate Estimated Cost
    const estimatedCost = useMemo(() => {
        if (!activeModel) return 0;
        let price = activeModel.price || 150;
        
        // Dynamic price based on mode and resolution
        if (activeModel.prices && activeModel.prices.length > 0) {
             const matched = activeModel.prices.find(p => {
                 const modeMatch = !p.mode || p.mode === selectedMode;
                 const resMatch = !p.resolution || p.resolution === res;
                 return modeMatch && resMatch;
             });
             if (matched) price = matched.price;
        }

        return price * qty;
    }, [activeModel, qty, selectedMode, res]);

    // --- METADATA EFFECT ---
    const activeImage = generatedUrl || previewUrl;
    
    useEffect(() => {
        if (!activeImage) return;
        
        // Reset metadata
        setImgMetadata(prev => ({ ...prev, size: '...' }));

        // 1. Get Size via Head/Blob
        fetch(activeImage)
            .then(res => res.blob())
            .then(blob => {
                setImgMetadata(prev => ({ ...prev, size: formatBytes(blob.size) }));
            })
            .catch(() => setImgMetadata(prev => ({ ...prev, size: 'Unknown' })));

    }, [activeImage]);

    // --- HANDLERS ---

    const handleWheelZoom = (e: React.WheelEvent) => {
        if (!activeImage) return;
        e.stopPropagation();
        const delta = e.deltaY * -0.05; // Adjust sensitivity
        setZoomLevel(prev => Math.min(Math.max(10, prev + delta), 300));
    };

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setImgMetadata(prev => ({ ...prev, width: naturalWidth, height: naturalHeight }));
    };

    const handleMainFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setGeneratedUrl(null);
        }
    };

    const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if (referenceImages.length >= maxRefSlots) {
                alert(`Model này chỉ hỗ trợ tối đa ${maxRefSlots} ảnh tham chiếu.`);
                return;
            }
            const file = e.target.files[0];
            
            // Initiate Crop Flow
            setPendingRefFile(file);
            setIsCropperOpen(true);
            
            // Reset input value to allow re-uploading same file if needed
            e.target.value = '';
        }
    };

    const handleCropSave = (croppedFile: File, previewUrl: string) => {
        const newRef: ReferenceImage = {
            id: crypto.randomUUID(),
            file: croppedFile,
            preview: previewUrl,
            type: 'image', // Default type
            strength: 80
        };
        setReferenceImages([...referenceImages, newRef]);
        setPendingRefFile(null);
        setIsRefPanelExpanded(true);
    };

    const updateReferenceImage = (id: string, updates: Partial<ReferenceImage>) => {
        setReferenceImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
    };

    const removeReferenceImage = (id: string) => {
        setReferenceImages(prev => prev.filter(img => img.id !== id));
        if (activeRefIndex !== null) setActiveRefIndex(null);
    };

    const handleClear = () => {
        setImageFile(null);
        setPreviewUrl(null);
        setGeneratedUrl(null);
        setPrompt('');
        setReferenceImages([]);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return alert("Vui lòng nhập mô tả.");
        if (!currentUser) return alert("Vui lòng đăng nhập.");
        if (userCredits < estimatedCost) return alert("Không đủ Credits.");
        
        // Validation: Some models might require at least one reference if withSubject is true but no main image
        if (!imageFile && referenceImages.length === 0) {
            return alert("Vui lòng tải lên ít nhất một ảnh chính hoặc ảnh tham chiếu.");
        }

        setIsProcessing(true);
        try {
            // 1. Process Main Image (Image-to-Image base)
            let fullBase64 = undefined;
            if (imageFile) {
                const base64Data = await resizeImage(imageFile, 1536, 1536, 0.6);
                fullBase64 = `data:${imageFile.type};base64,${base64Data}`;
            }

            // 2. Process Reference Images (Subjects)
            const subjectsPayload = await Promise.all(referenceImages.map(async (ref) => {
                const refBase64 = await resizeImage(ref.file, 1024, 1024, 0.6);
                return {
                    data: `data:${ref.file.type};base64,${refBase64}`,
                    type: ref.type,
                    strength: ref.strength / 100 // Convert 0-100 to 0.0-1.0
                };
            }));

            // 3. Call API
            const genRes = await generateGommoImage(
                gommoApiKey,
                selectedModelId,
                prompt,
                {
                    editImage: !!imageFile, // True if Img2Img
                    base64Image: fullBase64,
                    resolution: res,
                    ratio: selectedRatio,
                    mode: selectedMode || undefined,
                    project_id: 'creative_studio_advanced',
                    subjects: subjectsPayload.length > 0 ? subjectsPayload : undefined
                }
            );

            let url = '';
            if (genRes.success?.imageInfo?.url) {
                url = genRes.success.imageInfo.url;
            } else if (genRes.success?.imageInfo?.id_base) {
                url = await pollGommoImageCompletion(gommoApiKey, genRes.success.imageInfo.id_base);
            } else if (genRes.imageInfo?.url) {
                url = genRes.imageInfo.url;
            }

            if (url) {
                setGeneratedUrl(url);
                await deductUserCredits(currentUser.uid, estimatedCost);
                onUpdateCredits();
            } else {
                throw new Error("Không nhận được kết quả.");
            }
        } catch (e: any) {
            alert("Lỗi: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = async () => {
        if (!generatedUrl) return;
        try {
            const response = await fetch(generatedUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `creative_advanced_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            window.open(generatedUrl, '_blank');
        }
    };

    return (
        <div className="relative h-[calc(100vh-80px)] w-full bg-[#050505] flex flex-col items-center justify-center overflow-hidden font-sans">
            
            <CropperModal 
                isOpen={isCropperOpen}
                onClose={() => { setIsCropperOpen(false); setPendingRefFile(null); }}
                imageFile={pendingRefFile}
                onSave={handleCropSave}
                instruction="Hãy cắt ảnh rõ mặt của bạn"
            />

            {/* Top Overlay Controls */}
            {activeImage && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#1a1a1a]/80 backdrop-blur border border-gray-700 rounded-full px-4 py-2 shadow-xl animate-fade-in">
                    <button className="text-gray-400 hover:text-white p-1" onClick={() => setZoomLevel(z => Math.max(10, z - 10))}>
                        <MagnifyingGlassMinusIcon className="w-5 h-5" />
                    </button>
                    <span className="text-xs font-bold text-white min-w-[40px] text-center">{Math.round(zoomLevel)}%</span>
                    <button className="text-gray-400 hover:text-white p-1" onClick={() => setZoomLevel(z => Math.min(300, z + 10))}>
                        <MagnifyingGlassPlusIcon className="w-5 h-5" />
                    </button>
                    <div className="w-px h-4 bg-gray-600 mx-1"></div>
                    <button className="text-gray-400 hover:text-white p-1" onClick={handleClear} title="Xóa ảnh">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                    {generatedUrl && (
                        <>
                            <div className="w-px h-4 bg-gray-600 mx-1"></div>
                             <button className="text-green-400 hover:text-green-300 p-1" onClick={handleDownload} title="Tải về">
                                <ArrowDownTrayIcon className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Main Image Area */}
            <div 
                className="flex-1 w-full flex items-center justify-center p-10 relative overflow-hidden cursor-zoom-in active:cursor-grabbing"
                onWheel={handleWheelZoom}
            >
                {activeImage ? (
                    <div 
                        className="relative transition-transform duration-100 ease-linear shadow-2xl"
                        style={{ transform: `scale(${zoomLevel / 100})` }}
                    >
                        <img 
                            src={activeImage} 
                            alt="Preview" 
                            className="max-w-[80vw] max-h-[60vh] object-contain rounded-lg border border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                            draggable={false}
                            onLoad={handleImageLoad}
                        />
                        {isProcessing && (
                             <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg backdrop-blur-[2px]">
                                 <div className="bg-black/80 px-6 py-3 rounded-full flex items-center gap-3 border border-gray-700 shadow-xl">
                                     <SparklesIcon className="w-5 h-5 text-purple-500 animate-spin" />
                                     <span className="text-sm font-bold text-white tracking-wide">AI ĐANG VẼ...</span>
                                 </div>
                             </div>
                        )}
                        {/* Label Badge */}
                        <div className="absolute bottom-4 left-4 pointer-events-none">
                            <span className="bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10 uppercase">
                                {generatedUrl ? "Kết quả" : "Ảnh gốc (Image2Image)"}
                            </span>
                        </div>

                        {/* NEW: Info Overlay (Dimensions, Ratio, Size) */}
                        <div className="absolute top-4 right-4 pointer-events-none flex flex-col gap-1 items-end">
                            <div className="bg-black/70 backdrop-blur text-gray-300 text-[10px] font-mono px-2 py-1 rounded border border-white/10 flex items-center gap-2 shadow-lg">
                                <span className="text-sky-400 font-bold">{imgMetadata.width} x {imgMetadata.height}</span>
                                <span className="w-px h-3 bg-gray-600"></span>
                                <span className="text-green-400">{getAspectRatio(imgMetadata.width, imgMetadata.height)}</span>
                                <span className="w-px h-3 bg-gray-600"></span>
                                <span className="text-yellow-400 font-bold">{imgMetadata.size}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center animate-fade-in pointer-events-none select-none opacity-50">
                        <div className="flex flex-col items-center justify-center w-64 h-64 border-2 border-dashed border-gray-800 rounded-2xl bg-[#0a0a0a]">
                            <SparklesIcon className="w-12 h-12 text-gray-700 mb-4" />
                            <span className="text-sm text-gray-600 font-bold uppercase">KẾT QUẢ SẼ HIỆN Ở ĐÂY</span>
                            <span className="text-[10px] text-gray-700 mt-2">Thêm tham chiếu bên dưới để bắt đầu</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Floating Panel (Workbench) */}
            <div className="absolute bottom-6 w-full flex justify-center px-4 z-30">
                <div 
                    className="relative w-full max-w-5xl transition-all duration-300 ease-out group"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => { setIsHovered(false); setIsModelDropdownOpen(false); }}
                >
                    {/* Animated Border */}
                    <div className="absolute inset-[-2px] rounded-2xl overflow-hidden pointer-events-none">
                        <div className="absolute inset-[-500%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#3b82f6_75%,#a855f7_100%)] opacity-80" />
                    </div>

                    {/* Main Content */}
                    <div className="relative bg-[#0f1012] rounded-2xl p-4 flex gap-4 shadow-2xl border border-gray-800/80 backdrop-blur-xl">
                        
                        {/* SECTION 0: ORIGINAL IMAGE (Fixed 1 Slot) */}
                        <div className="flex flex-col gap-2 border-r border-gray-800 pr-4 mr-2">
                            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase whitespace-nowrap px-1 mb-1">
                                <span className="flex items-center gap-1"><PhotoIcon className="w-3 h-3"/> Ảnh gốc</span>
                            </div>
                            
                            <div className="flex gap-2 items-center h-full">
                                {imageFile && previewUrl ? (
                                    <div className="relative group/slot shrink-0">
                                        <div 
                                            className="w-16 h-16 rounded-lg border border-gray-700 bg-black overflow-hidden relative cursor-pointer hover:border-blue-500 transition-all"
                                        >
                                            <img src={previewUrl} className="w-full h-full object-cover" />
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setImageFile(null); 
                                                    setPreviewUrl(null); 
                                                    setGeneratedUrl(null); 
                                                }}
                                                className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover/slot:opacity-100 transition-opacity"
                                            >
                                                <XMarkIcon className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div 
                                        className="w-16 h-16 rounded-lg border border-dashed border-gray-700 hover:border-blue-500 bg-[#1a1a1a] flex flex-col items-center justify-center cursor-pointer transition-colors shrink-0 group/add"
                                        onClick={() => document.getElementById('main-upload')?.click()}
                                    >
                                        <PlusIcon className="w-5 h-5 text-gray-500 group-hover/add:text-blue-500" />
                                        <span className="text-[9px] text-gray-600 font-bold mt-1">THÊM</span>
                                    </div>
                                )}
                                <input id="main-upload" type="file" className="hidden" onChange={handleMainFileUpload} accept="image/*" />
                            </div>
                        </div>

                        {/* SECTION 1: REFERENCE INPUTS (Dynamic Slots) */}
                        <div 
                            className={`flex flex-col gap-2 transition-all duration-500 ease-out overflow-hidden border-r border-gray-800 pr-4 mr-2 ${isHovered || isRefPanelExpanded || referenceImages.length > 0 ? 'w-auto min-w-[120px] max-w-[400px] opacity-100' : 'w-12 opacity-80'}`}
                            onMouseEnter={() => setIsRefPanelExpanded(true)}
                            onMouseLeave={() => setIsRefPanelExpanded(false)}
                        >
                            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase whitespace-nowrap px-1 mb-1">
                                <span className="flex items-center gap-1"><Square2StackIcon className="w-3 h-3"/> Tham chiếu</span>
                                <span>{referenceImages.length}/{maxRefSlots}</span>
                            </div>
                            
                            {/* Slots Container */}
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar items-center h-full">
                                {referenceImages.map((ref, idx) => (
                                    <div key={ref.id} className="relative group/slot shrink-0 flex flex-col gap-1">
                                        <div 
                                            className="w-16 h-16 rounded-lg border border-gray-700 bg-black overflow-hidden relative cursor-pointer hover:border-blue-500 transition-all"
                                            onClick={() => setActiveRefIndex(activeRefIndex === idx ? null : idx)}
                                        >
                                            <img src={ref.preview} className="w-full h-full object-cover" />
                                            {/* Type Badge */}
                                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white text-center font-bold uppercase py-0.5 backdrop-blur-sm">
                                                {ref.type}
                                            </div>
                                            {/* Remove Btn */}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); removeReferenceImage(ref.id); }}
                                                className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover/slot:opacity-100 transition-opacity"
                                            >
                                                <XMarkIcon className="w-3 h-3" />
                                            </button>
                                        </div>
                                        
                                        {/* Reference Settings Popover (When Clicked) */}
                                        {activeRefIndex === idx && (
                                            <div className="absolute bottom-full left-0 mb-3 bg-[#1e1e1e] border border-gray-700 rounded-lg p-3 w-48 shadow-xl z-50 animate-fade-in">
                                                <div className="text-[10px] text-gray-500 font-bold mb-2 uppercase">Cấu hình ảnh {idx + 1}</div>
                                                
                                                {/* Type Selector */}
                                                <div className="mb-2">
                                                    <label className="text-[9px] text-gray-400 block mb-1">Vai trò (Role)</label>
                                                    <select 
                                                        value={ref.type}
                                                        onChange={(e) => updateReferenceImage(ref.id, { type: e.target.value as any })}
                                                        className="w-full bg-black border border-gray-700 text-white text-xs rounded px-1 py-1"
                                                    >
                                                        <option value="image">Image (Chung)</option>
                                                        {activeModel?.withFace && <option value="face">Face ID (Khuôn mặt)</option>}
                                                        {activeModel?.withStyle && <option value="style">Style (Phong cách)</option>}
                                                        <option value="structure">Structure (Cấu trúc)</option>
                                                    </select>
                                                </div>

                                                {/* Strength Slider */}
                                                <div>
                                                    <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                                                        <span>Ảnh hưởng</span>
                                                        <span>{ref.strength}%</span>
                                                    </div>
                                                    <input 
                                                        type="range" min="0" max="100" 
                                                        value={ref.strength}
                                                        onChange={(e) => updateReferenceImage(ref.id, { strength: parseInt(e.target.value) })}
                                                        className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Add Button */}
                                {referenceImages.length < maxRefSlots && (
                                    <div 
                                        className="w-16 h-16 rounded-lg border border-dashed border-gray-700 hover:border-blue-500 bg-[#1a1a1a] flex flex-col items-center justify-center cursor-pointer transition-colors shrink-0 group/add"
                                        onClick={() => document.getElementById('ref-upload')?.click()}
                                    >
                                        <PlusIcon className="w-5 h-5 text-gray-500 group-hover/add:text-blue-500" />
                                        <span className="text-[9px] text-gray-600 font-bold mt-1">THÊM</span>
                                    </div>
                                )}
                                <input id="ref-upload" type="file" className="hidden" onChange={handleReferenceUpload} accept="image/*" />
                            </div>
                        </div>

                        {/* SECTION 2: PROMPT & MODEL (Center) */}
                        <div className="flex-1 flex flex-col gap-3 justify-center min-w-0">
                            
                            {/* Input Row */}
                            <div className="h-10 w-full flex items-center relative">
                                <input 
                                    type="text" 
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Mô tả prompt"
                                    className="w-full bg-[#151515] border border-gray-800 hover:border-gray-700 focus:border-blue-600 rounded-xl px-4 text-gray-200 text-sm font-medium outline-none placeholder-gray-600 h-12 transition-all"
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                     <span className="text-[10px] text-gray-600 font-bold uppercase bg-gray-800 px-1.5 py-0.5 rounded">Enter</span>
                                </div>
                            </div>

                            {/* Settings Row (Expandable on Hover) */}
                            <div className={`flex items-center gap-3 transition-all duration-300 ease-out overflow-visible ${isHovered ? 'h-10 opacity-100' : 'h-0 opacity-0 pointer-events-none'}`}>
                                
                                {/* Model Selector */}
                                <div className="relative" ref={dropdownRef}>
                                    <div 
                                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                        className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 whitespace-nowrap cursor-pointer hover:bg-[#252525] hover:text-white transition-all shadow-sm"
                                    >
                                        <CubeIcon className="w-3.5 h-3.5 text-purple-400" />
                                        <span className="font-bold truncate max-w-[100px]">{activeModel?.name || "Chọn Model"}</span>
                                        <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                                    </div>

                                    {/* Dropdown */}
                                    {isModelDropdownOpen && (
                                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl z-[60] max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
                                            {models.map(m => (
                                                <div 
                                                    key={m.model}
                                                    onClick={() => { setSelectedModelId(m.model); setIsModelDropdownOpen(false); }}
                                                    className={`px-4 py-3 text-xs cursor-pointer border-b border-gray-800 last:border-0 hover:bg-[#252525] flex justify-between items-center ${selectedModelId === m.model ? 'bg-purple-900/20 text-purple-400 font-bold' : 'text-gray-300'}`}
                                                >
                                                    <div className="flex flex-col">
                                                        <span>{m.name}</span>
                                                        <div className="flex gap-1 mt-0.5">
                                                            {m.withFace && <span className="text-[8px] bg-blue-900/30 text-blue-400 px-1 rounded">FACE</span>}
                                                            {m.withStyle && <span className="text-[8px] bg-pink-900/30 text-pink-400 px-1 rounded">STYLE</span>}
                                                            {m.maxSubject && m.maxSubject > 1 && <span className="text-[8px] bg-green-900/30 text-green-400 px-1 rounded">MULTI</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Ratio Selector */}
                                <div className="relative">
                                    <select 
                                        value={selectedRatio}
                                        onChange={(e) => setSelectedRatio(e.target.value)}
                                        className="bg-[#1a1a1a] text-gray-300 text-[10px] font-bold py-1.5 pl-2 pr-5 rounded-lg border border-gray-700 appearance-none focus:outline-none hover:text-white"
                                    >
                                        {activeRatios.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <ChevronDownIcon className="w-3 h-3 text-gray-500 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>

                                {/* Mode Selector */}
                                {activeModes.length > 0 && (
                                    <div className="relative">
                                        <select 
                                            value={selectedMode}
                                            onChange={(e) => setSelectedMode(e.target.value)}
                                            className="bg-[#1a1a1a] text-gray-300 text-[10px] font-bold py-1.5 pl-2 pr-5 rounded-lg border border-gray-700 appearance-none focus:outline-none hover:text-white uppercase"
                                        >
                                            {activeModes.map(m => <option key={m.type} value={m.type}>{m.name}</option>)}
                                        </select>
                                        <ChevronDownIcon className="w-3 h-3 text-gray-500 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                )}

                                {/* Resolution Segment */}
                                <div className="flex bg-[#1a1a1a] rounded-lg border border-gray-700 p-0.5">
                                    {['1k', '2k', '4k'].map((r) => (
                                        <button 
                                            key={r}
                                            onClick={() => setRes(r)}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${res === r ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>

                                {/* Cost Display */}
                                <div className="flex items-center gap-1 text-yellow-500 font-bold text-xs px-2 whitespace-nowrap bg-yellow-900/10 rounded border border-yellow-500/20 py-1">
                                    <span>{estimatedCost}</span>
                                    <BoltIcon className="w-3 h-3" />
                                </div>

                                {/* Quantity Stepper */}
                                <div className="flex items-center bg-[#1a1a1a] rounded-lg border border-gray-700 ml-auto">
                                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-2 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-l-lg transition-colors"><MinusIcon className="w-3 h-3" /></button>
                                    <span className="px-2 text-xs font-bold text-gray-300 min-w-[20px] text-center">{qty}</span>
                                    <button onClick={() => setQty(Math.min(10, qty + 1))} className="px-2 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-r-lg transition-colors"><PlusIcon className="w-3 h-3" /></button>
                                </div>

                            </div>
                        </div>

                        {/* SECTION 3: ACTION BUTTON */}
                        <div className={`flex flex-col justify-end transition-all duration-300 pl-2`}>
                             <button 
                                onClick={handleGenerate}
                                disabled={(!imageFile && referenceImages.length === 0) || !prompt || isProcessing}
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg hover:shadow-cyan-500/20 hover:scale-105 active:scale-95 group ${
                                    (!imageFile && referenceImages.length === 0) || !prompt 
                                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                                    : 'bg-gradient-to-tr from-blue-600 to-cyan-500 text-white'
                                }`}
                            >
                                 {isProcessing ? (
                                    <ArrowPathIcon className="w-6 h-6 animate-spin text-white/50"/> 
                                 ) : (
                                    <SparklesIcon className="w-7 h-7 fill-white/20 group-hover:fill-white/50 transition-all" />
                                 )}
                            </button>
                        </div>

                    </div>
                </div>
            </div>

        </div>
    );
};

export default CreativeStudio;