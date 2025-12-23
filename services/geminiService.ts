import { GoogleGenAI, Modality, Part } from "@google/genai";
import { GenerationSettings, WeatherOption, ProfileSettings } from "../types";
import { APP_CONFIG } from '../config';

// HELPER: Trích xuất danh sách Key từ chuỗi nhập vào
// Hỗ trợ phân tách bằng xuống dòng, dấu phẩy hoặc dấu chấm phẩy
const extractKeys = (input?: string): string[] => {
    const keys = new Set<string>();
    
    // 1. Ưu tiên Key người dùng nhập vào trước
    if (input && input.trim().length > 0) {
        const rawKeys = input.split(/[\n,;]+/);
        rawKeys.forEach(k => {
            const trimmed = k.trim();
            if (trimmed.length > 10) { // Basic validation
                keys.add(trimmed);
            }
        });
    }

    // 2. Sau đó mới đến key mặc định từ env/config (Fallback)
    // Logic: Nếu process.env.API_KEY có giá trị (từ Vite define) thì dùng, nếu không thì dùng từ Config
    const envKey = process.env.API_KEY;
    const configKey = APP_CONFIG.GEMINI_API_KEY;
    
    const defaultKey = envKey && envKey.length > 10 ? envKey : (configKey || "");
    
    if (defaultKey && defaultKey.trim().length > 10) {
        keys.add(defaultKey.trim());
    }
    
    return Array.from(keys);
};

// HELPER: Xử lý lỗi và tự động đổi key nếu cần
// Trả về kết quả của callback operation, hoặc ném lỗi nếu tất cả key đều thất bại
async function withKeyRotation<T>(
    userKeyInput: string | undefined, 
    operation: (ai: GoogleGenAI) => Promise<T>,
    modelName: string = 'gemini'
): Promise<T> {
    const keys = extractKeys(userKeyInput);
    
    if (keys.length === 0) {
        throw new Error("Vui lòng nhập API Key để sử dụng. (Chưa có key trong Config hoặc Settings)");
    }

    let lastError: any = null;

    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[i];
        try {
            const ai = new GoogleGenAI({ apiKey });
            // Thực thi operation với key hiện tại
            return await operation(ai);
        } catch (error: any) {
            lastError = error;
            const msg = (error.message || error.toString()).toLowerCase();
            
            // Chỉ retry nếu lỗi liên quan đến Quota (429) hoặc Server quá tải (503)
            const isQuotaError = msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted');
            const isServerError = msg.includes('503') || msg.includes('overloaded');
            
            if (isQuotaError || isServerError) {
                console.warn(`Key ...${apiKey.slice(-4)} bị lỗi ${isQuotaError ? '429 (Hết lượt)' : '503'}. Đang chuyển sang key tiếp theo...`);
                // Continue loop to next key
                continue;
            } else {
                // Các lỗi khác (400, 403, 404...) thường do input/key sai, không nên retry mù quáng
                break; 
            }
        }
    }

    // Nếu chạy hết vòng lặp mà vẫn lỗi, ném lỗi cuối cùng ra
    throw handleGeminiError(lastError, modelName);
}

// --- ERROR HANDLING HELPER (Updated to return Error object) ---
const handleGeminiError = (error: any, modelName: string = '') => {
    console.error("Gemini API Error details:", error);
    const msg = (error.message || error.toString()).toLowerCase();
    
    if (msg.includes('permission denied') || msg.includes('403')) {
        if (modelName.includes('pro')) {
            return new Error("Lỗi Quyền (403): Model Pro yêu cầu API Key có Billing. Vui lòng đổi key khác hoặc dùng bản Free.");
        } else {
            return new Error("Lỗi Quyền (403): API Key bị từ chối. Vui lòng kiểm tra lại Key.");
        }
    }
    
    if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
        return new Error("Lỗi Quota (429): Tất cả các Key đã hết lượt dùng. Vui lòng thêm Key mới.");
    }

    if (msg.includes('400') || msg.includes('invalid_argument')) {
        return new Error("Lỗi Dữ liệu (400): Ảnh đầu vào không hợp lệ hoặc model không hỗ trợ tác vụ này.");
    }

    if (msg.includes('not found') || msg.includes('404')) {
         return new Error(`Lỗi Model (404): Model '${modelName}' không khả dụng với Key này.`);
    }
    
    return new Error(error.message || "Lỗi không xác định khi gọi AI.");
};

// --- API VALIDATION HELPER ---
export const validateApiKey = async (apiKey: string): Promise<{ valid: boolean; message?: string }> => {
    // Validate list of keys logic
    const keys = extractKeys(apiKey);
    if (keys.length === 0) return { valid: false, message: "Key quá ngắn hoặc không hợp lệ." };
    
    // Test the first key
    try {
        const ai = new GoogleGenAI({ apiKey: keys[0] });
        await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: 'ping' }] },
            config: { maxOutputTokens: 1 }
        });
        return { valid: true };
    } catch (error: any) {
        let msg = "Kết nối thất bại.";
        const errStr = (error.message || "").toLowerCase();
        if (errStr.includes('403')) msg = "Key bị từ chối (403).";
        else if (errStr.includes('400')) msg = "Key không tồn tại.";
        return { valid: false, message: msg };
    }
};

// --- IMAGE HELPERS ---

export const resizeImage = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(img.height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        let mimeType = file.type;
        if (mimeType !== 'image/png' && mimeType !== 'image/webp') {
            mimeType = 'image/jpeg';
        }

        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
    });
};

export const fileToPart = async (file: File): Promise<Part> => {
    const base64Data = await fileToBase64(file);
    return {
        inlineData: {
            data: base64Data,
            mimeType: file.type,
        },
    };
};

// --- IMAGE GENERATION SERVICE ---

const LIGHTING_MAPPING: Record<string, string> = {
  "Ánh sáng viền tóc": "Rim light on hair, glowing hair edges",
  "Ánh sáng vành tóc trái": "Left side rim light on hair",
  "Ánh sáng vành tóc phải": "Right side rim light on hair",
  "Đèn nền trái": "Strong backlight from the left",
  "Đèn nền phải": "Strong backlight from the right",
  "Đèn gáy": "Nape lighting, accent light on back of neck",
  "Đèn đỉnh đầu sau": "Top-back kicker light on head",
  "Vai trái": "Rim light highlighting left shoulder",
  "Vai phải": "Rim light highlighting right shoulder",
  "Đường viền cổ áo": "Accent light on neckline",
  "Lưng": "Soft lighting on back",
  "Sống lưng": "Highlight along the spine",
  "Vành eo": "Rim light accentuating waistline",
  "Vành hông trái": "Rim light on left hip",
  "Vành hông phải": "Rim light on right hip",
  "Tay": "Light contouring on arms",
  "Vệt sáng chéo trên váy": "Diagonal light shaft across the dress",
  "Ren váy": "Detail lighting on dress lace texture",
  "Nếp gấp váy": "Shadows and highlights emphasizing dress folds",
  "Gấu váy": "Light hitting the bottom hem of the dress",
  "Đuôi váy": "Illuminated dress train",
  "Đèn nền khăn voan": "Backlit veil, glowing translucent fabric",
  "Ánh sáng xuyên qua khăn voan": "Light beams passing through veil",
  "Vệt sáng sàn phía trước": "Light streaks on floor in foreground",
  "Vệt sáng sàn phía sau": "Light streaks on floor in background",
  "Vệt sáng cửa sổ trên nền": "Window gobo light pattern on floor",
  "Vệt sáng ngang": "Horizontal light beam across the scene"
};

const QUALITY_PROMPT = "A hyper-realistic, extremely detailed cinematic shot. 8k resolution, sharp focus, intricate textures, dramatic lighting, volumetric lighting, ray tracing, masterpiece, professional photography, shot on 35mm lens, depth of field, vivid colors. Photorealistic high-quality restoration. Enhance image resolution and fine facial detail while preserving original identity, wrinkles, and facial expression. Correct color balance and natural lighting; keep skin texture realistic. Authentic.";
const NEGATIVE_PROMPT = "blurry, low quality, low resolution, pixelated, distorted, deformed, ugly, bad anatomy, cartoon, illustration, sketch, watermark, text, signature, noise, grainy, overexposed, underexposed, floating subject, missing chair, missing furniture, hovering people";

export const generateStyledImage = async (
  originalFile: File,
  settings: GenerationSettings
): Promise<string> => {
    // Wrap entire logic in withKeyRotation
    return withKeyRotation(settings.apiKey, async (ai) => {
        const { 
            userPrompt, blurAmount, weather, lightingEffects, 
            preserveSubjectPosition, preservePose, preserveComposition, preserveFocalLength, preserveAspectRatio, disableForeground, originalImageCompatibility,
            preserveFaceDetail, // Extract new setting
            keepOriginalOutfit, minimalCustomization, enableUpscale, restorationCustomPrompt,
            model, aspectRatio, imageSize, referenceImage
        } = settings;
        
        let originalBase64 = await resizeImage(originalFile);
        let mimeType = originalFile.type;
        if (mimeType !== 'image/png' && mimeType !== 'image/webp') mimeType = 'image/jpeg';

        const upscalePrompt = enableUpscale 
            ? `\n[QUALITY UPGRADE ACTIVE]: Upscale and Refine. RESOLUTION TARGET: 4x Upscaling. Maximize micro-contrast and edge sharpness. Apply 'GFP-GAN' style face restoration. Output must be crystal clear.` 
            : "";

        const userRefinementPrompt = restorationCustomPrompt 
            ? `\n[SPECIFIC USER REFINEMENT]:\n${restorationCustomPrompt}\nExecute these specific instructions exactly.` 
            : "";

        // CONFIG CONSTRUCTION
        const effectiveModel = model || 'gemini-2.5-flash-image';
        const imageConfig: any = {};
        // Only apply aspect ratio if explicitly set and NOT 'auto'
        if (aspectRatio && aspectRatio !== 'auto') {
            imageConfig.aspectRatio = aspectRatio;
        }
        // imageSize is only supported by Pro Image model
        if (effectiveModel === 'gemini-3-pro-image-preview' && imageSize) {
            imageConfig.imageSize = imageSize;
        }

        const generationConfig = {
            imageConfig: imageConfig,
        };

        if (minimalCustomization) {
            const pythonEmulationPrompt = `
            ROLE: Professional Photo Compositor & Retoucher.
            TASK: Professional Composite.
            INPUT IMAGE: This contains the SUBJECT to be preserved.
            TARGET CONCEPT: ${userPrompt || "Cinematic background suitable for the subject"}
            ${upscalePrompt}
            ${userRefinementPrompt}
            
            STEPS:
            1. Extract subject (keep 100% intact).
            2. Generate NEW background based on TARGET CONCEPT.
            3. Color Harmonization: Match subject tone to background (60% intensity).
            4. NO EDGE LIGHTING / NO LIGHT WRAP: Edges must be sharp.
            5. Brightness Match.
            FINAL OUTPUT: Seamless composite, high fidelity.
            `;
            
            const response = await ai.models.generateContent({
                model: effectiveModel,
                contents: { parts: [{ inlineData: { mimeType, data: originalBase64 } }, { text: pythonEmulationPrompt }] },
                config: generationConfig
            });
            return `data:image/jpeg;base64,${response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data}`;
        }

        let blurPrompt = "";
        if (blurAmount <= 3.5) blurPrompt = `Aperture: f/${blurAmount}. STRONG BOKEH. Background HEAVILY BLURRED.`;
        else if (blurAmount <= 8.0) blurPrompt = `Aperture: f/${blurAmount}. MEDIUM DEPTH OF FIELD. Background slightly blurred.`;
        else blurPrompt = `Aperture: f/${blurAmount}. EVERYTHING IN FOCUS. Background SHARP.`;

        let weatherPrompt = "";
        switch (weather) {
          case WeatherOption.LIGHT_SUN: weatherPrompt = "Weather: Light sunshine. Soft natural sunlight."; break;
          case WeatherOption.HARSH_SUN: weatherPrompt = "Weather: Harsh strong sun. High-contrast daylight."; break;
          case WeatherOption.SUNSET: weatherPrompt = "Weather: Sunset. Golden hour, warm directional light."; break;
          case WeatherOption.NIGHT: weatherPrompt = "Weather: Night time. Dark cinematic, moonlight."; break;
          case WeatherOption.FOG: weatherPrompt = "Weather: Foggy. Misty atmosphere, soft diffused light."; break;
          default: weatherPrompt = "Lighting: Natural lighting matching the concept.";
        }

        const specificLightingPrompts = (lightingEffects || []).map(effect => LIGHTING_MAPPING[effect] || "").filter(p => p !== "").join(". ");

        const commands = [
            "SCOPE: 'Preserve' commands apply EXCLUSIVELY to the Subject. You MUST change the background.",
            preservePose ? "1. SUBJECT POSE LOCK: Keep pose EXACTLY as original." : "",
            preserveComposition ? "2. SUBJECT COMPOSITION LOCK: Keep size and position EXACTLY." : "",
            preserveFocalLength ? "3. LENS LOCK: Preserve focal length." : "",
            preserveAspectRatio ? "4. FRAME LOCK: Output aspect ratio matches input." : "",
            disableForeground ? "5. NO FOREGROUND: Do not generate objects in front of subject." : "",
            preserveSubjectPosition ? "6. PRESERVE SUBJECT POSITION: Subject remains in EXACT SAME PIXEL COORDINATES." : "",
            originalImageCompatibility ? "7. SMART CONTEXT: Adapt background to Original Image's framing (Headshot vs Full Body)." : "",
            preserveFaceDetail ? "8. FACE INTEGRITY LOCK: Preserve the subject's original facial features, expression, and likeness 100%. Do not alter the face." : "",
            keepOriginalOutfit ? "9. OUTFIT LOCK: Keep the subject's original clothing 100% unchanged. Do not alter color or style of clothes." : ""
        ].filter(Boolean).join("\n");

        let refInstruction = "";
        
        // Prepare parts array with Main Subject Image first
        const parts: Part[] = [{ inlineData: { mimeType, data: originalBase64 } }];

        // Attach Reference Image if present (Hack Concept Pro feature)
        if (referenceImage) {
            const refBase64 = await resizeImage(referenceImage);
            const refMime = referenceImage.type || 'image/jpeg';
            parts.push({
                inlineData: { mimeType: refMime, data: refBase64 }
            });
            refInstruction = `
            INPUT CONTEXT:
            - The FIRST image is the SUBJECT (Person/Object to preserve).
            - The SECOND image is the BACKGROUND/STYLE REFERENCE.
            
            INSTRUCTION: 
            Extract the background environment, lighting, and atmosphere from the SECOND image and merge the SUBJECT from the FIRST image into it.
            Replace the background of the first image with the scene from the second image. Match lighting and perspective.
            `;
        }

        const finalPrompt = `
        ROLE: Expert Image Compositor & Retoucher.
        TASK: BACKGROUND REPLACEMENT & RELIGHTING.
        ${refInstruction}
        
        SUPREME COMMANDS:
        ${commands}
        ${userRefinementPrompt}
        
        LOGIC:
        - If subject is SITTING/LEANING, REPLACE the support object with one matching the NEW concept.
        - Subject MUST be preserved 100% in scale/position.
        - Background MUST adapt to subject.
        
        TARGET CONCEPT: ${userPrompt || "Studio lighting background"}
        
        QUALITY: ${QUALITY_PROMPT}
        ${upscalePrompt}
        NEGATIVE: ${NEGATIVE_PROMPT}
        TECHNICAL: ${blurPrompt} ${weatherPrompt}
        LIGHTING: ${specificLightingPrompts}
        `;

        parts.push({ text: finalPrompt });

        const response = await ai.models.generateContent({
          model: effectiveModel,
          contents: { parts: parts },
          config: generationConfig
        });

        const generatedImageBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!generatedImageBase64) throw new Error("No image generated.");
        return `data:image/jpeg;base64,${generatedImageBase64}`;
    });
};

export const analyzeReferenceImage = async (file: File, mode: 'basic' | 'deep' | 'painting' | 'background' = 'basic', apiKey?: string): Promise<string> => {
    return withKeyRotation(apiKey, async (ai) => {
        const base64Data = await resizeImage(file, 1024, 1024, 0.8);
        let mimeType = file.type;
        if (mimeType !== 'image/png' && mimeType !== 'image/webp') mimeType = 'image/jpeg';

        let prompt = "";
        
        // LOGIC CHỌN PROMPT DỰA TRÊN MODE
        if (mode === 'painting') {
            // Chế độ phân tích tranh vẽ
            prompt = `
            Bạn là Nhà phê bình nghệ thuật (Art Critic) và Họa sĩ bậc thầy.
            Nhiệm vụ: Phân tích bức tranh này để trích xuất phong cách vẽ, trường phái nghệ thuật (Art Movement), kỹ thuật dùng cọ (Brushwork), bảng màu (Palette), và cảm xúc (Mood).
            MỤC ĐÍCH: Dùng mô tả này để yêu cầu AI vẽ lại một ảnh khác theo phong cách này.
            ĐẦU RA: Viết một đoạn văn mô tả phong cách vẽ bằng TIẾNG VIỆT thật hay và chuyên nghiệp. Bắt đầu bằng: "Phong cách vẽ: ..."
            `;
        } else if (mode === 'basic') {
            // Chế độ cơ bản: Tập trung vào từ khóa Style, Ánh sáng, Vật liệu
            prompt = `
            Bạn là chuyên gia phân tích thẩm mỹ nhiếp ảnh (Aesthetic & Lighting Expert).
            Nhiệm vụ: Trích xuất các từ khóa về Phong cách (Style), Ánh sáng (Lighting), và Chất liệu (Texture) để làm prompt ghép ảnh.
            YÊU CẦU CỰC KỲ QUAN TRỌNG: Loại bỏ các từ chỉ không gian cụ thể, con người. Tập trung vào Vật liệu, Ánh sáng, Màu sắc & Mood.
            Định dạng: Chỉ liệt kê từ khóa, ngăn cách bằng dấu phẩy. Ngôn ngữ: Tiếng Việt.
            `;
        } else if (mode === 'background') {
            // Chế độ Phân tích nền (Background Only)
            prompt = `
            Bạn là Chuyên gia Thiết kế Bối cảnh (Set Designer).
            Nhiệm vụ: Phân tích chi tiết BỐI CẢNH (Background) trong ảnh.
            
            QUAN TRỌNG: 
            1. TUYỆT ĐỐI KHÔNG mô tả nhân vật, con người, hay chủ thể chính. 
            2. TUYỆT ĐỐI KHÔNG mô tả thông số máy ảnh như: góc máy (camera angle), độ xóa phông (DOF, blur, bokeh) trong phần mô tả bối cảnh.
            3. Chỉ tập trung vào: không gian, kiến trúc, đồ vật nền, ánh sáng môi trường, thời gian, địa điểm.

            ĐẦU RA: Bắt buộc bắt đầu bằng cụm từ chính xác: "thay đổi nền trong ảnh thành " theo sau là mô tả chi tiết bối cảnh đó bằng Tiếng Việt.
            
            Sau đó, nối tiếp ngay đoạn văn bản cố định này vào cuối (giữ nguyên văn, không sửa đổi):
            “Tự động lấy góc máy/độ cao camera/tiêu cự ước lượng từ ảnh gốc của chủ thể và chỉnh nền mới khớp phối cảnh tương ứng; đồng bộ ánh sáng (hướng/cường độ/độ mềm), nhiệt độ màu & tint, phơi sáng–tương phản, DOF–độ sắc nét và grain/noise; cân tỷ lệ không gian, thêm contact shadow/ambient occlusion linh hoạt theo điểm chạm (không thấy chân thì shadow mềm dưới vùng thấp nhất hoặc vùng tiếp giáp), thêm light wrap quanh viền để xóa halo; kết quả photorealistic như ảnh chụp thật, không lộ dấu ghép/AI.”
            `;
        } else {
            // Chế độ chuyên sâu: Đóng vai Đạo diễn hình ảnh, mô tả chi tiết không khí
            prompt = `
            Bạn là Đạo diễn Hình ảnh (Director of Photography) và Chuyên gia Thiết kế Bối cảnh (Set Designer) cao cấp.
            Nhiệm vụ: Phân tích CHUYÊN SÂU và CỤ THỂ ảnh tham chiếu để tái tạo lại không khí và bối cảnh đó.
            OUTPUT FORMAT: Viết một đoạn văn mô tả chi tiết bằng TIẾNG VIỆT.
            `;
        }

        // --- FIXED MODEL FOR ANALYSIS ---
        // Using 'gemini-3-flash-preview' for Multimodal input (Image) -> Text output.
        // The previous model 'gemini-2.5-flash-image' was strictly for Image Generation and caused errors.
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { 
            parts: [
              { inlineData: { mimeType, data: base64Data } }, 
              { text: prompt } 
            ] 
          }
        });

        return response.text?.trim() || "";
    });
};