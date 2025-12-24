
export interface VoiceOption {
  id: string;
  name: string;
}

export interface ErrorDetails {
  title: string;
  message: string;
  suggestions: string[];
}

export interface HistoryItem {
  id:string;
  text: string;
  voice: string;
  speed: number;
}

export interface SrtEntry {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

export enum WeatherOption {
  NONE = "Không",
  LIGHT_SUN = "Nắng nhẹ",
  HARSH_SUN = "Nắng gắt",
  SUNSET = "Hoàng hôn",
  NIGHT = "Ban đêm",
  FOG = "Sương mù"
}

export interface GenerationSettings {
    userPrompt: string;
    referenceImage: File | null;
    referenceImagePreview: string | null;
    lightingEffects: string[];
    weather: WeatherOption;
    blurAmount: number;
    minimalCustomization: boolean;
    originalImageCompatibility: boolean;
    preserveFaceDetail: boolean; // New option added
    preservePose: boolean;
    preserveComposition: boolean;
    preserveFocalLength: boolean;
    preserveAspectRatio: boolean;
    disableForeground: false;
    preserveSubjectPosition: boolean;
    keepOriginalOutfit: boolean;
    enableUpscale: boolean;
    restorationCustomPrompt: string;
    model: string;
    aspectRatio: string;
    imageSize: string;
    apiKey?: string;
    
    // --- New Fields for Multi-Provider ---
    aiProvider: 'gemini' | 'gommo';
    gommoApiKey?: string;
    gommoModel?: string;

    // --- Hack Concept Pro Specific ---
    hackPrompts?: {
        detailed: string;
        fullBody: string;
        portrait: string;
        closeUp: string;
    };
}

export interface ProfileSettings {
    gender: 'nam' | 'nu';
    subject: 'nguoi-lon' | 'thanh-nien' | 'tre-em';
    attire: string;
    hairstyle: string;
    background: string;
    aspectRatio: string;
    customBackgroundColor: string | null;
    beautifyLevel: number;
    customPrompt: string;
    customAttireImage: File | null;
    customAttirePreview: string | null;
    
    apiKey?: string;
    aiProvider?: 'gemini' | 'gommo';
    gommoApiKey?: string;
    model?: string;
}

export interface StoredImage {
    id: string;
    url: string;
    timestamp: number;
}

export type ViewMode = 'home' | 'concept' | 'hack-concept' | 'restoration' | 'voice' | 'profile' | 'clothing' | 'painting' | 'admin';

export interface ProcessedImage {
  id: string;
  originalPreviewUrl: string;
  file?: File;
  generatedImageUrl?: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
  error?: string;
  isSelected: boolean;
}

// --- Pricing Interfaces ---
export interface PricingPackage {
    id: string;
    name: string;
    price: string; // Display string e.g. "49.000"
    originalPrice?: string; // e.g. "600" (credits) or old price
    credits: number;
    originalCredits?: number; // for strikethrough effect
    features: string[];
    theme: 'blue' | 'purple' | 'green' | 'orange';
    tag?: string; // e.g. "BONUS", "EXTRA CREDIT"
    isPopular?: boolean;
    buttonText?: string;
}

export interface PricingConfig {
    bannerTitle: string;
    bannerSubtitle: string;
    packages: PricingPackage[];
}

// --- Gommo AI Interfaces (Updated per API List) ---

export interface GommoRatio {
  name: string;
  type: string;
}

export interface GommoResolution {
  name: string;
  type: string;
}

export interface GommoMode {
  name: string;
  type: string;
  description: string;
}

export interface GommoModel {
  id_base?: string; // Made optional as API JSON doesn't always return it
  name: string;
  server: string;
  model: string;
  price: number;
  startText?: boolean;
  startImage?: boolean;
  description?: string;
  ratios?: GommoRatio[];
  resolutions?: GommoResolution[];
  modes?: GommoMode[];
}

export interface GommoModelResponse {
  success?: {
    data: GommoModel[];
    runtime: number;
  };
  error?: {
    error: number;
    message: string;
  };
  // Fallback for flat structure if API varies
  data?: GommoModel[];
}

export interface GommoImageInfo {
  id_base: string;
  project_id?: string;
  status: string;
  url: string;
  file_name?: string;
  file_size?: string;
  created_at?: number;
}

export interface GommoImageUploadResponse {
  success?: {
    imageInfo: GommoImageInfo;
    success: boolean;
    runtime: number;
  };
  error?: {
    message: string;
    error: string | number;
  };
  // Flattened fallbacks
  imageInfo?: GommoImageInfo;
}

export interface GommoGenImageInfo {
  id_base: string;
  project_id?: string;
  status: string;
  url: string;
  prompt: string;
  server_ai?: string;
  model?: string;
}

export interface GommoImageGenerationResponse {
  success?: {
    imageInfo: GommoGenImageInfo;
    success: boolean;
    runtime: number;
  };
  error?: {
    message: string;
    error: string | number;
  };
  // Flattened fallbacks
  imageInfo?: GommoGenImageInfo;
}

export interface GommoVideoInfo {
    id_base: string;
    task_id: string;
    status: string;
    credit_fee: number;
    prompt: string;
}

export interface GommoCreateVideoResponse {
    success?: {
        message: string;
        runtime: number;
        videoInfo: GommoVideoInfo;
    };
    error?: {
        message: string;
        error: string | number;
    };
}

export interface GommoCheckStatusResponse {
    success?: {
        id_base: string;
        status: string;
        download_url: string;
        thumbnail_url: string;
    };
    error?: {
        message: string;
        error: string | number;
    };
    // Compatibility
    status?: string;
    url?: string | null;
}

export interface GommoImagesResponse {
  data?: any[]; // Keep as generic for now as it's not in the main list
}

// --- New User Info Interface (Updated to match actual API response) ---
export interface GommoUserInfoResponse {
    userInfo?: {
        id_private?: string;
        name: string;
        email?: string;
        avatar: string;
        username?: string;
    };
    balancesInfo?: {
        balance: number;
        credits_ai: number;
        currency?: string;
    };
    videoCount?: number;
    runtime?: number;

    // Compatibility for other potential structures / Legacy wrappers
    success?: {
        data: {
            credits: number;
        };
    };
    error?: {
        message: string;
    };
}