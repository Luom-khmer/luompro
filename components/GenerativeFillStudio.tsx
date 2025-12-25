import React, { useState, useRef, useEffect, useMemo, MouseEvent } from 'react';
import { 
    PaintBrushIcon, 
    ArrowPathIcon, 
    TrashIcon, 
    SparklesIcon, 
    EyeIcon, 
    ArrowsRightLeftIcon, 
    ArrowDownTrayIcon, 
    PhotoIcon, 
    Cog6ToothIcon, 
    ChevronDownIcon, 
    CheckIcon, 
    CubeIcon, 
    BanknotesIcon 
} from '@heroicons/react/24/outline';
import { generateGommoImage, pollGommoImageCompletion, fetchGommoModels } from '../services/gommoService';
import { resizeImage } from '../services/geminiService';
import { deductUserCredits } from '../services/firebaseService';
import { GommoModel } from '../types';

interface GenerativeFillStudioProps {
    apiKey: string;
    gommoApiKey: string;
    userCredits: number;
    currentUser: any;
    onUpdateCredits: () => void;
}

const BRUSH_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#ec4899', '#22d3ee', '#f97316'];

const RATIO_LABELS: Record<string, string> = {
    '1:1': 'Vuông',
    '3:4': 'Dọc',
    '4:3': 'Ngang',
    '9:16': 'Story',
    '16:9': 'Điện ảnh',
    'auto': 'Gốc'
};

const GenerativeFillStudio: React.FC<GenerativeFillStudioProps> = ({ 
    gommoApiKey, userCredits, currentUser, onUpdateCredits 
}) => {
    // --- State ---
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [resultSrc, setResultSrc] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Tools
    const [brushSize, setBrushSize] = useState(35);
    const [brushColor, setBrushColor] = useState(BRUSH_COLORS[0]);
    const [prompt, setPrompt] = useState('');
    const [viewMode, setViewMode] = useState<'original' | 'edited' | 'compare'>('original');
    
    // --- Advanced Settings State ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [models, setModels] = useState<GommoModel[]>([]);
    const [selectedModelId, setSelectedModelId] = useState<string>('google_image_gen_banana_pro');
    const [selectedRatio, setSelectedRatio] = useState<string>('auto');
    const [selectedMode, setSelectedMode] = useState<string>('');
    const [selectedResolution, setSelectedResolution] = useState<string>('1k');
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

    // Canvas Refs
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Drawing State
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPos = useRef<{x: number, y: number} | null>(null);

    // --- Helpers ---
    
    // Fetch Models
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
                    // Set default if current selection is invalid
                    if (!fetchedModels.find(m => m.model === selectedModelId)) {
                        const preferred = fetchedModels.find(m => m.model === 'google_image_gen_banana_pro') || fetchedModels[0];
                        setSelectedModelId(preferred.model);
                    }
                }
            } catch (err) {
                console.error("Failed to load models", err);
            } finally {
                setIsLoadingModels(false);
            }
        };
        loadModels();
    }, [gommoApiKey]);

    // Derived Data for Model
    const activeModel = useMemo(() => models.find(m => m.model === selectedModelId), [models, selectedModelId]);
    
    const activeRatios = useMemo(() => {
        return activeModel?.ratios?.map(r => r.name) || ['auto', '1:1', '3:4', '4:3', '9:16', '16:9'];
    }, [activeModel]);

    const activeModes = useMemo(() => activeModel?.modes || [], [activeModel]);
    const activeResolutions = useMemo(() => activeModel?.resolutions || [], [activeModel]);

    // Calculate Price
    const estimatedCost = useMemo(() => {
        if (!activeModel) return 0;
        let price = activeModel.price || 0;
        if (activeModel.prices && activeModel.prices.length > 0) {
            const matched = activeModel.prices.find(p => {
                const modeMatch = !p.mode || p.mode === selectedMode;
                const resMatch = !p.resolution || p.resolution === selectedResolution;
                return modeMatch && resMatch;
            });
            if (matched) price = matched.price;
        }
        return price;
    }, [activeModel, selectedMode, selectedResolution]);

    // Set Defaults on Model Change
    useEffect(() => {
        if (activeModel) {
            if (activeModel.modes && activeModel.modes.length > 0 && !activeModel.modes.find(m => m.type === selectedMode)) {
                setSelectedMode(activeModel.modes[0].type);
            } else if (!activeModel.modes || activeModel.modes.length === 0) {
                setSelectedMode('');
            }

            if (activeModel.resolutions && activeModel.resolutions.length > 0 && !activeModel.resolutions.find(r => r.type === selectedResolution)) {
                setSelectedResolution(activeModel.resolutions[0].type);
            } else if (!activeModel.resolutions || activeModel.resolutions.length === 0) {
                setSelectedResolution('1k');
            }
        }
    }, [activeModel]);

    // Click Outside Dropdown
    useEffect(() => {
        function handleClickOutside(event: globalThis.MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleFileUpload = (file: File) => {
        if (!file.type.startsWith('image/')) return;
        setImageFile(file);
        const url = URL.createObjectURL(file);
        setImageSrc(url);
        setResultSrc(null);
        setViewMode('original');
        
        // Clear mask
        if (maskCanvasRef.current) {
            const ctx = maskCanvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
        }
    };

    // Draw Image to Canvas when loaded
    useEffect(() => {
        if (!imageSrc || !imageCanvasRef.current || !maskCanvasRef.current) return;
        
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            const w = img.width;
            const h = img.height;
            
            imageCanvasRef.current!.width = w;
            imageCanvasRef.current!.height = h;
            maskCanvasRef.current!.width = w;
            maskCanvasRef.current!.height = h;
            
            const ctx = imageCanvasRef.current!.getContext('2d');
            if (ctx) ctx.drawImage(img, 0, 0, w, h);
        };
    }, [imageSrc]);

    // Update Result View
    useEffect(() => {
        if (resultSrc) setViewMode('edited');
    }, [resultSrc]);

    // --- Drawing Logic ---
    const getMousePos = (e: MouseEvent) => {
        if (!maskCanvasRef.current) return { x: 0, y: 0 };
        const rect = maskCanvasRef.current.getBoundingClientRect();
        const scaleX = maskCanvasRef.current.width / rect.width;
        const scaleY = maskCanvasRef.current.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e: MouseEvent) => {
        if (!imageSrc || viewMode === 'edited' || viewMode === 'compare') return; 
        setIsDrawing(true);
        const pos = getMousePos(e);
        lastPos.current = pos;
        draw(pos, pos);
    };

    const draw = (start: {x: number, y: number}, end: {x: number, y: number}) => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = brushSize * (canvas.width / (canvasContainerRef.current?.clientWidth || 500)); 
        ctx.strokeStyle = `${brushColor}80`; 
        
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    };

    const moveDrawing = (e: MouseEvent) => {
        if (!isDrawing || !lastPos.current) return;
        const currentPos = getMousePos(e);
        draw(lastPos.current, currentPos);
        lastPos.current = currentPos;
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        lastPos.current = null;
    };

    const clearMask = () => {
        if (maskCanvasRef.current) {
            const ctx = maskCanvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
        }
    };

    // --- Generate Logic ---
    const handleGenerate = async () => {
        if (!imageFile || !currentUser || !gommoApiKey) {
            alert("Vui lòng đăng nhập và cấu hình API Key.");
            return;
        }
        if (userCredits < estimatedCost) {
            alert(`Không đủ credits (Cần ${estimatedCost}).`);
            return;
        }
        if (!prompt.trim()) {
            alert("Vui lòng nhập mô tả thay đổi.");
            return;
        }

        setIsProcessing(true);
        try {
            const base64Data = await resizeImage(imageFile, 1536, 1536, 0.7);
            const mimeType = imageFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const fullBase64 = `data:${mimeType};base64,${base64Data}`;

            let apiRatio = selectedRatio === 'auto' ? 'auto' : selectedRatio.replace(':', '_');

            const genRes = await generateGommoImage(
                gommoApiKey,
                selectedModelId, // Use selected model
                prompt,
                {
                    editImage: true,
                    base64Image: fullBase64,
                    resolution: selectedResolution, // Use selected resolution
                    ratio: apiRatio, // Use selected ratio
                    mode: selectedMode || undefined, // Use selected mode
                    project_id: 'generative_fill'
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
                setResultSrc(url);
                await deductUserCredits(currentUser.uid, estimatedCost);
                onUpdateCredits();
            } else {
                throw new Error("Không nhận được ảnh kết quả.");
            }

        } catch (e: any) {
            alert("Lỗi: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-row h-[calc(100vh-80px)] w-full overflow-hidden bg-[#111] text-gray-200 font-sans">
            
            {/* --- LEFT SIDEBAR (TOOLS) --- */}
            <aside className="w-[340px] shrink-0 border-r border-gray-800 bg-[#141414] flex flex-col h-full overflow-y-auto custom-scrollbar p-5">
                
                {/* Header with Settings Icon on Right - UPDATED TO ADOBE STYLE */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded bg-gradient-to-tr from-blue-600 to-purple-600 shadow-lg shadow-blue-900/20">
                             <PaintBrushIcon className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 bg-clip-text text-transparent tracking-tight">
                            Generative Fill
                        </h2>
                    </div>
                    <button 
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`p-2 rounded-lg border transition-colors shadow-sm ${isSettingsOpen ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-400 hover:text-white'}`}
                        title="Cấu hình Model"
                    >
                        <Cog6ToothIcon className={`w-5 h-5 transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`} />
                    </button>
                </div>

                {/* --- ADVANCED SETTINGS PANEL --- */}
                {isSettingsOpen && (
                    <div className="bg-[#1e1e1e] p-4 rounded-xl border border-gray-700 shadow-xl mb-6 relative animate-fade-in">
                        
                        {/* Model Label */}
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">MODEL</label>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 font-medium">Đa model</span>
                                <div className="w-8 h-4 bg-gray-700 rounded-full relative opacity-50"><div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full"></div></div>
                            </div>
                        </div>

                        {/* Model Dropdown */}
                        <div className="relative mb-4" ref={dropdownRef}>
                            <button 
                                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                className="w-full bg-[#151515] border border-gray-700 hover:border-gray-500 text-white font-bold py-3 px-4 rounded-xl flex justify-between items-center transition-all"
                            >
                                <span className="truncate">{activeModel ? activeModel.name : (isLoadingModels ? "Đang tải..." : "Chọn Model")}</span>
                                <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isModelDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                                    {models.map((model) => (
                                        <div 
                                            key={model.model}
                                            onClick={() => { setSelectedModelId(model.model); setIsModelDropdownOpen(false); }}
                                            className={`px-4 py-3 text-sm cursor-pointer border-b border-gray-800 last:border-0 hover:bg-[#252525] flex justify-between items-center ${selectedModelId === model.model ? 'bg-blue-900/20 text-blue-400 font-bold' : 'text-gray-300'}`}
                                        >
                                            <span>{model.name}</span>
                                            {selectedModelId === model.model && <CheckIcon className="w-4 h-4" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Config Grid */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {/* RATIO */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1 uppercase">RATIO</label>
                                <div className="relative">
                                    <select value={selectedRatio} onChange={(e) => setSelectedRatio(e.target.value)} className="w-full bg-[#151515] text-white text-[11px] font-bold py-2 px-2 rounded-lg border border-gray-700 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer">
                                        {activeRatios.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>
                            {/* MODE */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1 uppercase">MODE</label>
                                <div className="relative">
                                    <select value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)} disabled={activeModes.length === 0} className="w-full bg-[#151515] text-white text-[11px] font-bold py-2 px-2 rounded-lg border border-gray-700 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50">
                                        {activeModes.length === 0 && <option value="">Default</option>}
                                        {activeModes.map(m => <option key={m.type} value={m.type}>{m.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            {/* RES */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1 uppercase">RES</label>
                                <div className="relative">
                                    <select value={selectedResolution} onChange={(e) => setSelectedResolution(e.target.value)} disabled={activeResolutions.length === 0} className="w-full bg-[#151515] text-white text-[11px] font-bold py-2 px-2 rounded-lg border border-gray-700 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50">
                                        {activeResolutions.length === 0 && <option value="1k">1k</option>}
                                        {activeResolutions.map(r => <option key={r.type} value={r.type}>{r.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                            <span className="text-xs text-gray-500 font-medium">Chi phí ước tính:</span>
                            <div className="flex items-center gap-1.5 text-yellow-500 font-bold text-sm bg-yellow-900/10 px-2 py-0.5 rounded border border-yellow-500/20">
                                <BanknotesIcon className="w-4 h-4" />
                                <span>{estimatedCost} Credits</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Brush Size */}
                <div className="mb-6">
                    <div className="flex justify-between text-xs text-gray-400 mb-2 font-bold uppercase">
                        <span>Brush Size</span>
                        <span>{brushSize}px</span>
                    </div>
                    <input 
                        type="range" 
                        min="5" 
                        max="200" 
                        value={brushSize} 
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    {/* Visual dot */}
                    <div className="mt-2 h-6 flex items-center justify-center">
                        <div 
                            className="rounded-full transition-all" 
                            style={{ width: brushSize/4, height: brushSize/4, backgroundColor: brushColor }}
                        />
                    </div>
                </div>

                {/* Brush Color */}
                <div className="mb-6">
                    <label className="text-xs text-gray-400 font-bold uppercase mb-2 block">Brush Color</label>
                    <div className="flex gap-2">
                        {BRUSH_COLORS.map(c => (
                            <button 
                                key={c}
                                onClick={() => setBrushColor(c)}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${brushColor === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mb-6">
                    <button 
                        onClick={clearMask}
                        className="flex-1 py-2 rounded bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 flex items-center justify-center gap-2 border border-gray-700"
                    >
                        <TrashIcon className="w-4 h-4" /> Clear mask
                    </button>
                    <button 
                        onClick={() => { setBrushSize(35); setPrompt(''); }}
                        className="flex-1 py-2 rounded bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 flex items-center justify-center gap-2 border border-gray-700"
                    >
                        <ArrowPathIcon className="w-4 h-4" /> Reset settings
                    </button>
                </div>

                {/* Prompt */}
                <div className="mb-6">
                    <label className="text-xs text-gray-400 font-bold uppercase mb-2 block">Mô tả thay đổi</label>
                    <div className="relative">
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ví dụ: 'Thêm kính mát', 'Đổi màu mắt thành xanh', 'Xóa vật thể này'..."
                            className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 h-28 resize-none"
                        />
                        <SparklesIcon className="w-5 h-5 text-gray-500 absolute bottom-3 right-3" />
                    </div>
                </div>

                {/* Generate Button */}
                <button 
                    onClick={handleGenerate}
                    disabled={isProcessing || !imageFile}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 mb-6 ${
                        isProcessing || !imageFile
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 active:scale-95'
                    }`}
                >
                    {isProcessing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PaintBrushIcon className="w-5 h-5" />}
                    {isProcessing ? 'Đang xử lý...' : 'Generative Fill'}
                </button>

                {/* View Modes */}
                <div className="mb-6">
                    <label className="text-xs text-gray-400 font-bold uppercase mb-2 block">Chế độ xem</label>
                    <div className="grid grid-cols-3 gap-1 bg-[#1a1a1a] p-1 rounded-lg border border-gray-800">
                        <button 
                            onClick={() => setViewMode('original')}
                            className={`py-1.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'original' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Gốc
                        </button>
                        <button 
                            onClick={() => resultSrc && setViewMode('edited')}
                            disabled={!resultSrc}
                            className={`py-1.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'edited' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300 disabled:opacity-30'}`}
                        >
                            Đã sửa
                        </button>
                        <button 
                            onClick={() => resultSrc && setViewMode('compare')}
                            disabled={!resultSrc}
                            className={`py-1.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'compare' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300 disabled:opacity-30'}`}
                        >
                            So sánh
                        </button>
                    </div>
                </div>

                {/* Instructions */}
                <div className="mt-auto p-4 bg-[#1a1a1a] border border-gray-800 rounded-xl text-[11px] text-gray-400 leading-relaxed">
                    <strong className="block text-white mb-2 uppercase">Hướng dẫn:</strong>
                    <ul className="list-decimal pl-3 space-y-1">
                        <li>Vẽ lên vùng bạn muốn chỉnh sửa</li>
                        <li>Nhập mô tả thay đổi vào ô bên trên</li>
                        <li>Nhấn "Generative Fill"</li>
                        <li>Nếu không vẽ vùng, thay đổi sẽ áp dụng cho toàn ảnh</li>
                        <li>Nếu để trống prompt và có mask, sẽ xóa đối tượng được mask</li>
                    </ul>
                </div>
            </aside>

            {/* --- MAIN CANVAS --- */}
            <main className="flex-1 flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden p-8">
                {!imageSrc ? (
                    <div className="text-center">
                        <label className="cursor-pointer group flex flex-col items-center">
                            <div className="w-20 h-20 bg-[#1a1a1a] border border-gray-700 rounded-2xl flex items-center justify-center mb-4 group-hover:border-blue-500 transition-colors shadow-xl">
                                <PhotoIcon className="w-8 h-8 text-gray-500 group-hover:text-blue-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1">Tải ảnh lên</h3>
                            <p className="text-sm text-gray-500">JPG, PNG (Max 10MB)</p>
                            <input type="file" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} />
                        </label>
                    </div>
                ) : (
                    <div className="relative w-full h-full flex items-center justify-center" ref={canvasContainerRef}>
                        {/* Wrapper to center and contain canvases */}
                        <div className="relative shadow-2xl border border-gray-800 rounded-lg overflow-hidden max-w-full max-h-full inline-block">
                            
                            {/* Comparison View */}
                            {viewMode === 'compare' && resultSrc ? (
                                <div className="relative w-full h-full flex gap-1">
                                    <div className="relative">
                                        <img src={imageSrc} className="max-h-[85vh] object-contain" />
                                        <span className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 text-xs rounded">Gốc</span>
                                    </div>
                                    <div className="relative">
                                        <img src={resultSrc} className="max-h-[85vh] object-contain" />
                                        <span className="absolute bottom-2 left-2 bg-blue-600/80 text-white px-2 py-1 text-xs rounded">Đã sửa</span>
                                    </div>
                                </div>
                            ) : (
                                /* Single View (Original + Mask OR Edited) */
                                <>
                                    {viewMode === 'edited' && resultSrc ? (
                                        <img src={resultSrc} className="max-w-full max-h-[85vh] object-contain block" />
                                    ) : (
                                        <>
                                            {/* Original Image Canvas */}
                                            <canvas 
                                                ref={imageCanvasRef}
                                                className="max-w-full max-h-[85vh] block object-contain pointer-events-none"
                                            />
                                            {/* Mask Canvas (Overlay) - Handle Events Here */}
                                            <canvas 
                                                ref={maskCanvasRef}
                                                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                                                onMouseDown={startDrawing}
                                                onMouseMove={moveDrawing}
                                                onMouseUp={stopDrawing}
                                                onMouseLeave={stopDrawing}
                                            />
                                        </>
                                    )}
                                </>
                            )}

                            {/* View Label Badge */}
                            <div className="absolute top-4 left-4 pointer-events-none">
                                <span className="bg-black/70 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 uppercase">
                                    {viewMode === 'compare' ? 'Chế độ so sánh' : (viewMode === 'edited' ? 'Kết quả' : 'Gốc')}
                                </span>
                            </div>
                            
                            {/* Download Button (Only if Edited) */}
                            {resultSrc && (
                                <div className="absolute top-4 right-4 z-20">
                                    <a href={resultSrc} download="generative_fill_result.jpg" className="p-2 bg-white/10 hover:bg-blue-600 text-white rounded-lg backdrop-blur border border-white/20 transition-all flex items-center gap-2">
                                        <ArrowDownTrayIcon className="w-5 h-5" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default GenerativeFillStudio;