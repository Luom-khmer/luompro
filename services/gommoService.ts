
import { 
    GommoModelResponse, 
    GommoImageUploadResponse, 
    GommoImageGenerationResponse, 
    GommoCreateVideoResponse, 
    GommoCheckStatusResponse, 
    GommoImagesResponse,
    GommoUserInfoResponse
} from '../types';
import { APP_CONFIG } from '../config';

// --- CẤU HÌNH DOMAIN THÔNG MINH (AUTO-SWITCH) ---
// Logic: 
// 1. Nếu có PROXY (GOMMO_PROXY_URL có giá trị): Dùng ID ảo "secure-mode-active" để ẩn danh.
// 2. Nếu chưa có PROXY: Dùng ID thật "aivideoauto.com" để App vẫn hoạt động bình thường (Fallback).
const HAS_PROXY = !!(APP_CONFIG.GOMMO_PROXY_URL && APP_CONFIG.GOMMO_PROXY_URL.length > 10);

const DOMAIN = HAS_PROXY ? "secure-mode-active" : "aivideoauto.com";

// Logic chọn Base URL:
// Nếu có Proxy thì dùng Proxy, không thì dùng API gốc.
const BASE_URL = HAS_PROXY
    ? APP_CONFIG.GOMMO_PROXY_URL!.replace(/\/$/, '') 
    : "https://api.gommo.net";

// Constants for endpoints (Dynamic)
const ENDPOINTS = {
    MODELS: `${BASE_URL}/ai/models`,
    CREATE_VIDEO: `${BASE_URL}/ai/create-video`,
    CHECK_VIDEO: `${BASE_URL}/ai/video`,
    CHECK_IMAGE: `${BASE_URL}/ai/image`,
    UPLOAD_IMAGE: `${BASE_URL}/ai/image-upload`,
    GENERATE_IMAGE: `${BASE_URL}/ai/generateImage`,
    USER_INFO: `${BASE_URL}/api/apps/go-mmo/ai/me`,
    UPSCALE: `${BASE_URL}/api/apps/go-mmo/ai_templates/tools`,
    LIST_IMAGES: `${BASE_URL}/ai/images`
};

// Helper to create body matching the requirement
const createBody = (accessToken: string, params: Record<string, any>) => {
    const paramsObj = new URLSearchParams();
    
    // Required fields - Token in body
    paramsObj.append('access_token', accessToken);
    paramsObj.append('domain', DOMAIN);
    
    Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== undefined && value !== null) {
            if (typeof value === 'object' || Array.isArray(value)) {
                paramsObj.append(key, JSON.stringify(value));
            } else {
                paramsObj.append(key, String(value));
            }
        }
    });
    return paramsObj;
};

// Helper to handle Fetch responses
const processResponse = async (response: Response) => {
    // Xử lý lỗi HTTP level
    if (!response.ok) {
        // Xử lý lỗi 524 Timeout từ Cloudflare
        if (response.status === 524) {
            throw new Error("Lỗi 524 (Timeout): Ảnh tải lên quá nặng hoặc Gommo phản hồi chậm. Vui lòng thử lại với ảnh nhỏ hơn hoặc thử lại sau.");
        }
        if (response.status === 429) {
            throw new Error("Lỗi 429 (Too Many Requests): Hệ thống đang quá tải, vui lòng chờ vài phút.");
        }

        let errorMessage = `HTTP Error ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData.error && errorData.error.message) {
                errorMessage = errorData.error.message;
            } else if (errorData.message) {
                errorMessage = errorData.message;
            }
        } catch (e) {
            errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    if (data.error) {
         const msg = (typeof data.error === 'object' && data.error.message) 
            ? data.error.message 
            : (typeof data.message === 'string' ? data.message : "Gommo API Error");
         throw new Error(msg);
    }
    
    return data;
};

// Generic Error Handler wrapper
const handleGommoError = (error: any): Error => {
    const msg = error.message || "";
    if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
        if (HAS_PROXY) {
            return new Error("Lỗi kết nối tới Cloudflare Worker. Vui lòng kiểm tra lại Link Proxy trong config.ts");
        }
        return new Error("Lỗi kết nối mạng (CORS). Vui lòng cấu hình Cloudflare Proxy để khắc phục.");
    }
    return new Error(msg || "Lỗi không xác định từ Gommo Service.");
};

/**
 * 1. List Models
 */
export const fetchGommoModels = async (accessToken: string, type: 'video' | 'image' = 'image'): Promise<GommoModelResponse> => {
    try {
        const body = createBody(accessToken, { type });
        const response = await fetch(ENDPOINTS.MODELS, {
            method: 'POST',
            body: body
        });
        return await processResponse(response);
    } catch (error) {
        throw handleGommoError(error);
    }
};

/**
 * 2. Create Video
 */
export const createGommoVideo = async (
    accessToken: string,
    model: string,
    prompt: string,
    options: {
        privacy?: 'PRIVATE' | 'PUBLIC';
        translate_to_en?: 'true' | 'false';
        project_id?: string;
        mode?: 'standard' | 'professional' | '';
        images?: Array<{ id_base: string; url: string }>;
    } = {}
): Promise<GommoCreateVideoResponse> => {
    try {
        const params = {
            model,
            prompt,
            privacy: options.privacy || 'PRIVATE',
            translate_to_en: options.translate_to_en || 'true',
            project_id: options.project_id || 'default',
            mode: options.mode || '',
            images: options.images || []
        };
        
        const body = createBody(accessToken, params);
        const response = await fetch(ENDPOINTS.CREATE_VIDEO, {
            method: 'POST',
            body: body
        });
        return await processResponse(response);
    } catch (error) {
        throw handleGommoError(error);
    }
};

/**
 * 3. Check Video Status
 */
export const checkGommoVideoStatus = async (
    accessToken: string,
    videoId: string
): Promise<GommoCheckStatusResponse> => {
    try {
        const body = createBody(accessToken, { videoId });
        const response = await fetch(ENDPOINTS.CHECK_VIDEO, {
            method: 'POST',
            body: body
        });
        return await processResponse(response);
    } catch (error) {
        throw handleGommoError(error);
    }
};

/**
 * 4. Upload Image
 */
export const uploadGommoImage = async (
    accessToken: string,
    base64Data: string, // raw base64 (no prefix)
    fileName: string = 'image.jpg'
): Promise<GommoImageUploadResponse> => {
    try {
        // Calculate approximate size
        const size = Math.ceil(base64Data.length * 0.75);
        
        const params = {
            data: base64Data,
            project_id: 'default',
            file_name: fileName,
            size: String(size)
        };
        
        const body = createBody(accessToken, params);
        const response = await fetch(ENDPOINTS.UPLOAD_IMAGE, {
            method: 'POST',
            body: body
        });
        return await processResponse(response);
    } catch (error) {
        throw handleGommoError(error);
    }
};

/**
 * 5. Create Image (Generate or Edit)
 */
export interface GenerateGommoImageOptions {
    editImage?: boolean;
    base64Image?: string; // includes data:image/jpeg;base64, prefix
    ratio?: string; // Relaxed type to allow all string ratios like '3_4', '16_9' etc.
    resolution?: string; // e.g. '1k', '2k'
    subjects?: Array<{ id_base?: string; url?: string; data?: string }>;
    project_id?: string;
}

export const generateGommoImage = async (
    accessToken: string,
    model: string,
    prompt: string,
    options: GenerateGommoImageOptions = {}
): Promise<GommoImageGenerationResponse> => {
    try {
        const params: any = {
            action_type: 'create',
            model: model,
            prompt: prompt,
            project_id: options.project_id || 'default',
            ratio: options.ratio || '1_1'
        };

        if (options.resolution) {
            params.resolution = options.resolution;
        }

        if (options.editImage) {
            params.editImage = 'true';
            if (options.base64Image) {
                params.base64Image = options.base64Image;
            }
        } else {
            params.editImage = 'false';
        }

        if (options.subjects && options.subjects.length > 0) {
            params.subjects = options.subjects;
        }

        const body = createBody(accessToken, params);
        const response = await fetch(ENDPOINTS.GENERATE_IMAGE, {
            method: 'POST',
            body: body
        });
        return await processResponse(response);
    } catch (error) {
        throw handleGommoError(error);
    }
};

/**
 * 6. Get User Info (Credits)
 */
export const fetchGommoUserInfo = async (accessToken: string): Promise<GommoUserInfoResponse> => {
    try {
        const body = createBody(accessToken, {});
        const response = await fetch(ENDPOINTS.USER_INFO, {
            method: 'POST',
            body: body
        });
        return await processResponse(response);
    } catch (error) {
        console.warn("Could not fetch user info:", error);
        return { error: { message: "Could not fetch" } };
    }
};

/**
 * 7. Check Image Status (New)
 */
export const checkGommoImageStatus = async (
    accessToken: string,
    idBase: string
): Promise<any> => {
    try {
        const body = createBody(accessToken, { id_base: idBase });
        const response = await fetch(ENDPOINTS.CHECK_IMAGE, {
            method: 'POST',
            body: body
        });
        return await processResponse(response);
    } catch (error) {
        throw handleGommoError(error);
    }
};

/**
 * 8. Upscale Image (New)
 */
export const upscaleGommoImage = async (
    accessToken: string,
    imageUrl: string,
    projectId: string = 'default'
): Promise<any> => {
    try {
        const params = {
            id_base: 'image_resolution',
            url: imageUrl,
            project_id: projectId
        };
        const body = createBody(accessToken, params);
        const response = await fetch(ENDPOINTS.UPSCALE, {
            method: 'POST',
            body: body
        });
        return await processResponse(response);
    } catch (error) {
        throw handleGommoError(error);
    }
};

// --- Compatibility & Polling Helpers ---

export const pollGommoImageCompletion = async (
    accessToken: string,
    idBase: string,
    maxRetries = 2160, 
    interval = 5000
): Promise<string> => {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const data = await checkGommoImageStatus(accessToken, idBase);
            const status = data.status;

            if (status === 'SUCCESS') {
                if (data.url) return data.url;
                if (data.imageInfo && data.imageInfo.url) return data.imageInfo.url;
                throw new Error("Trạng thái SUCCESS nhưng không tìm thấy URL.");
            } else if (status === 'ERROR' || status === 'FAILED') {
                 throw new Error("Gommo báo lỗi: Tạo ảnh thất bại.");
            }
        } catch (err: any) {
            console.warn("Polling status error:", err.message);
            if (err.message.includes("báo lỗi")) {
                throw err;
            }
        }
        await new Promise(r => setTimeout(r, interval));
        retries++;
    }
    throw new Error("Quá thời gian chờ xử lý (Timeout > 3 giờ).");
};

/**
 * 9. List Images
 */
export const fetchGommoImages = async (
    accessToken: string, 
    projectId: string = 'default'
): Promise<GommoImagesResponse> => {
    try {
        const body = createBody(accessToken, { project_id: projectId });
        const response = await fetch(ENDPOINTS.LIST_IMAGES, {
            method: 'POST',
            body: body
        });
        return await processResponse(response);
    } catch (error) {
        throw handleGommoError(error);
    }
};
