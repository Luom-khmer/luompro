
import { GoogleGenAI, Modality, Part } from "@google/genai";
import { GenerationSettings, WeatherOption, ProfileSettings } from "../types";
import { APP_CONFIG } from '../config';

// HELPER: Trích xuất danh sách Key từ chuỗi nhập vào
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
    const envKey = process.env.API_KEY;
    const configKey = APP_CONFIG.GEMINI_API_KEY;
    
    const defaultKey = envKey && envKey.length > 10 ? envKey : (configKey || "");
    
    if (defaultKey && defaultKey.trim().length > 10) {
        keys.add(defaultKey.trim());
    }
    
    return Array.from(keys);
};

// HELPER: Xử lý lỗi và tự động đổi key nếu cần
async function withKeyRotation<T>(
    userKeyInput: string | undefined, 
    operation: (ai: GoogleGenAI) => Promise<T>,
    modelName: string = 'gemini'
): Promise<T> {
    const keys = extractKeys(userKeyInput);
    
    if (keys.length === 0) {
        throw new Error("Vui lòng nhập API Key để sử dụng tính năng Phân tích.");
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
            console.warn(`Key ...${apiKey.slice(-4)} failed: ${msg}`);
            
            // Chỉ retry nếu lỗi liên quan đến Quota (429) hoặc Server quá tải (503)
            const isQuotaError = msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted');
            const isServerError = msg.includes('503') || msg.includes('overloaded');
            
            if (isQuotaError || isServerError) {
                console.warn(`Key ...${apiKey.slice(-4)} bị lỗi. Đang chuyển sang key tiếp theo...`);
                continue;
            } else {
                // Break on other errors (like 400 Bad Request, 403 Permission Denied) to avoid useless retries
                break; 
            }
        }
    }

    throw handleGeminiError(lastError, modelName);
}

// --- ERROR HANDLING HELPER ---
const handleGeminiError = (error: any, modelName: string = '') => {
    console.error("Gemini API Error details:", error);
    const msg = (error.message || error.toString()).toLowerCase();
    
    if (msg.includes('permission denied') || msg.includes('403')) {
        return new Error("Lỗi Quyền (403): API Key bị từ chối hoặc không có quyền truy cập model này.");
    }
    
    if (msg.includes('429') || msg.includes('quota')) {
        return new Error("Lỗi Quota (429): Key hết lượt dùng. Vui lòng thử lại sau.");
    }

    if (msg.includes('404') || msg.includes('not found')) {
        return new Error(`Lỗi Model (404): Model '${modelName}' không khả dụng (Google chưa hỗ trợ tại khu vực này hoặc sai tên).`);
    }

    if (msg.includes('400')) {
        return new Error("Lỗi Dữ liệu (400): Yêu cầu không hợp lệ.");
    }
    
    return new Error(error.message || "Lỗi không xác định khi gọi AI.");
};

// --- API VALIDATION HELPER ---
export const validateApiKey = async (apiKey: string): Promise<{ valid: boolean; message?: string }> => {
    const keys = extractKeys(apiKey);
    if (keys.length === 0) return { valid: false, message: "Key quá ngắn hoặc không hợp lệ." };
    
    try {
        const ai = new GoogleGenAI({ apiKey: keys[0] });
        await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', // Updated to 2.0 Flash Exp for better Vision support
            contents: { parts: [{ text: 'ping' }] },
            config: { maxOutputTokens: 1 }
        });
        return { valid: true };
    } catch (error: any) {
        const err = handleGeminiError(error, 'gemini-2.0-flash-exp');
        return { valid: false, message: err.message };
    }
};

// --- IMAGE HELPERS ---

// UPDATED: Forced JPEG compression to avoid 524 Timeouts
export const resizeImage = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.6): Promise<string> => {
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
        // Fill white background for JPEG conversion (incase of transparent PNG)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // FORCE JPEG for maximum compression to avoid Cloudflare 524
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
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

// --- IMAGE GENERATION SERVICE (LEGACY / UNUSED FOR GENERATION IF GOMMO ENFORCED) ---
export const generateStyledImage = async (
  originalFile: File,
  settings: GenerationSettings
): Promise<string> => {
    throw new Error("Chế độ tạo ảnh bằng Google API đang tắt. Vui lòng sử dụng Aivideoauto (Gommo).");
};

// --- ANALYSIS SERVICE (ONLY THIS SHOULD CALL GOOGLE API) ---
export const analyzeReferenceImage = async (file: File, mode: 'basic' | 'deep' | 'painting' | 'background' = 'basic', apiKey?: string): Promise<string> => {
    return withKeyRotation(apiKey, async (ai) => {
        // Resize ảnh để phân tích nhanh hơn
        const base64Data = await resizeImage(file, 1024, 1024, 0.5);
        // Analysis accepts JPEG from resizeImage
        const mimeType = 'image/jpeg';

        let prompt = "";
        
        if (mode === 'painting') {
            prompt = `Phân tích phong cách vẽ, trường phái, kỹ thuật cọ và màu sắc của bức tranh này. Viết một đoạn văn mô tả ngắn gọn bằng Tiếng Việt.`;
        } else if (mode === 'basic') {
            prompt = `Liệt kê các từ khóa về Phong cách, Ánh sáng, Vật liệu trong ảnh này. Ngăn cách bằng dấu phẩy. Tiếng Việt.`;
        } else if (mode === 'background') {
            prompt = `
            Phân tích BỐI CẢNH (Background) trong ảnh. Bỏ qua nhân vật.
            Đầu ra bắt buộc bắt đầu bằng: "thay đổi nền trong ảnh thành " theo sau là mô tả chi tiết bối cảnh.
            Sau đó nối tiếp: “Tự động lấy góc máy/độ cao camera/tiêu cự ước lượng từ ảnh gốc của chủ thể và chỉnh nền mới khớp phối cảnh tương ứng; đồng bộ ánh sáng (hướng/cường độ/độ mềm), nhiệt độ màu & tint, phơi sáng–tương phản, DOF–độ sắc nét và grain/noise; cân tỷ lệ không gian, thêm contact shadow/ambient occlusion linh hoạt theo điểm chạm, thêm light wrap quanh viền để xóa halo; kết quả photorealistic như ảnh chụp thật.”
            `;
        } else {
            prompt = `Mô tả chi tiết không khí và bối cảnh trong ảnh này bằng Tiếng Việt.`;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash-exp', // Updated to 2.0 Flash Exp for better Vision support
          contents: { 
            parts: [
              { inlineData: { mimeType, data: base64Data } }, 
              { text: prompt } 
            ] 
          }
        });

        return response.text?.trim() || "";
    }, 'gemini-2.0-flash-exp');
};
