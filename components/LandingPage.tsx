import React, { useState } from 'react';
import { ViewMode } from '../types';
import { 
    ShoppingBagIcon, 
    PaintBrushIcon, 
    SparklesIcon, 
    ClockIcon, 
    SpeakerWaveIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    BoltIcon // NEW IMPORT
} from '@heroicons/react/24/outline';

interface LandingPageProps {
  onNavigate: (mode: ViewMode) => void;
}

const TOOLS = [
  {
    id: 'generative-fill',
    title: 'GENERATIVE FILL',
    description: 'Xóa vật thể & mở rộng ảnh',
    icon: PaintBrushIcon,
    color: 'blue',
    mode: 'generative-fill'
  },
  {
    id: 'clothing',
    title: 'THAY TRANG PHỤC',
    description: 'Ghép trang phục tham chiếu',
    icon: ShoppingBagIcon,
    color: 'purple',
    mode: 'concept'
  },
  {
    id: 'hack-concept-pro', // NEW ITEM
    title: 'HACK CONCEPT PRO',
    description: 'Hack nền, ánh sáng & góc máy',
    icon: BoltIcon,
    color: 'purple',
    isHighlight: true,
    mode: 'hack-concept'
  },
  {
    id: 'restoration',
    title: 'PHỤC CHẾ ẢNH',
    description: 'Khôi phục màu & chi tiết',
    icon: ClockIcon,
    color: 'green',
    mode: 'restoration'
  }
];

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [activeIndex, setActiveIndex] = useState(2); // Mặc định chọn Hack Concept Pro (index 2 now)

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % TOOLS.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + TOOLS.length) % TOOLS.length);
  };

  const handleSelect = (index: number) => {
    setActiveIndex(index);
  };

  const handleEnter = () => {
    const tool = TOOLS[activeIndex];
    // Chuyển hướng dựa trên tool
    if (tool.id === 'fake-concept') {
        onNavigate('concept');
    } else if (tool.id === 'hack-concept-pro') {
        onNavigate('hack-concept');
    } else if (tool.id === 'restoration') {
        onNavigate('restoration');
    } else if (tool.id === 'generative-fill') {
        onNavigate('generative-fill');
    } else if (tool.id === 'clothing' || tool.id === 'painting') {
        // Tạm thời chuyển vào Concept
        onNavigate('concept'); 
    } else {
        onNavigate(tool.mode as ViewMode);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1012] flex flex-col items-center justify-between md:justify-center relative overflow-hidden font-sans selection:bg-red-500 selection:text-white py-8 md:py-0">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Header Text */}
      <div className="text-center mb-4 md:mb-12 z-10 animate-fade-in mt-4 md:mt-0 px-4">
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white mb-2">
            CÔNG CỤ <span className="text-orange-500">AI</span>
        </h1>
        <p className="text-gray-400 text-sm md:text-base font-medium tracking-wide">
            Chọn công cụ bạn muốn sử dụng
        </p>
      </div>

      {/* Carousel Container */}
      <div className="relative w-full max-w-7xl px-0 md:px-10 flex items-center justify-center gap-4 z-10 h-auto md:h-[450px] flex-1 md:flex-none">
        
        {/* Navigation Buttons */}
        <button onClick={handlePrev} className="hidden md:flex absolute left-4 z-20 w-12 h-12 rounded-full bg-gray-800/50 border border-gray-700 hover:bg-gray-700 hover:border-gray-500 items-center justify-center text-white transition-all">
            <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <button onClick={handleNext} className="hidden md:flex absolute right-4 z-20 w-12 h-12 rounded-full bg-gray-800/50 border border-gray-700 hover:bg-gray-700 hover:border-gray-500 items-center justify-center text-white transition-all">
            <ChevronRightIcon className="w-6 h-6" />
        </button>

        {/* Cards */}
        <div className="flex items-center justify-start md:justify-center gap-4 perspective-1000 w-full overflow-x-auto md:overflow-visible py-10 px-[calc(50%-110px)] md:px-0 no-scrollbar snap-x snap-mandatory h-full">
            {TOOLS.map((tool, index) => {
                const isActive = index === activeIndex;
                const isNeighbor = Math.abs(index - activeIndex) === 1;
                
                // Styles calculation
                let containerClass = "relative flex-shrink-0 transition-all duration-500 ease-out cursor-pointer snap-center ";
                let cardClass = "w-[220px] h-[320px] rounded-2xl border flex flex-col items-center justify-center p-6 transition-all duration-500 ";
                let glowClass = "";
                let iconClass = "w-12 h-12 mb-4 transition-all duration-500 ";

                if (isActive) {
                    containerClass += "z-10 scale-110 md:scale-125 mx-2 md:mx-6";
                    // Active Styling based on specific tool color
                    if (tool.isHighlight) {
                         cardClass += "bg-[#0f1215] border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.4)]";
                         iconClass += "text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] stroke-[1.5px]";
                    } else {
                         cardClass += "bg-[#141414] border-gray-500 shadow-[0_0_20px_rgba(255,255,255,0.1)]";
                         iconClass += "text-white stroke-[1.5px]";
                    }
                } else {
                    containerClass += "scale-90 opacity-60 hover:opacity-100 hover:scale-95";
                    cardClass += "bg-[#0a0a0a] border-gray-800 hover:border-gray-600";
                    iconClass += `text-gray-600 group-hover:text-${tool.color}-400`;
                }

                return (
                    <div 
                        key={tool.id} 
                        className={containerClass}
                        onClick={() => handleSelect(index)}
                    >
                        <div className={`${cardClass} group`}>
                            <tool.icon className={iconClass} />
                            
                            <h3 className={`text-sm font-bold uppercase tracking-widest mb-2 text-center transition-colors ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                {tool.title}
                            </h3>
                            
                            <p className={`text-[10px] font-medium text-center leading-relaxed transition-colors ${isActive ? 'text-gray-400' : 'text-gray-700'}`}>
                                {tool.description}
                            </p>

                            {isActive && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleEnter(); }}
                                    className="mt-8 px-5 py-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm transition-all hover:scale-105"
                                >
                                    Nhấn Enter để mở
                                </button>
                            )}
                        </div>
                        
                        {/* Reflection/Shadow underneath */}
                        {isActive && (
                            <div className="absolute -bottom-10 left-0 right-0 h-4 bg-black/50 blur-xl rounded-[100%]"></div>
                        )}
                    </div>
                );
            })}
        </div>
      </div>

      {/* Footer / Instructions */}
      <div className="relative md:absolute md:bottom-8 flex gap-4 text-[10px] text-gray-600 uppercase font-bold tracking-widest z-20 mt-4 md:mt-0">
         <div className="flex items-center gap-2">
            <button 
                onClick={handlePrev} 
                className="px-1.5 py-0.5 border border-gray-700 rounded bg-gray-800 hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-all cursor-pointer"
            >
                ←
            </button>
            <button 
                onClick={handleNext} 
                className="px-1.5 py-0.5 border border-gray-700 rounded bg-gray-800 hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-all cursor-pointer"
            >
                →
            </button>
            <span>Di chuyển</span>
         </div>
         <div className="w-px h-4 bg-gray-800"></div>
         <div className="flex items-center gap-2">
            <button 
                onClick={handleEnter} 
                className="px-2 py-0.5 border border-gray-700 rounded bg-gray-800 hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-all cursor-pointer"
            >
                ENTER
            </button>
            <span>Chọn</span>
         </div>
      </div>
      
      <div className="relative md:absolute bottom-2 text-[9px] text-gray-700 font-mono mt-2 md:mt-0">
         BẢN QUYỀN ỨNG DỤNG AI THUỘC SỞ HỮU LƯỢM
      </div>

    </div>
  );
};

export default LandingPage;