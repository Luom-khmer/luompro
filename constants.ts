
import { VoiceOption } from './types';

export const AVAILABLE_VOICES: VoiceOption[] = [
  { id: 'Kore', name: 'Giọng Nữ Miền Nam (Nhẹ Nhàng - Chuẩn)' },
  { id: 'Zephyr', name: 'Giọng Nữ Miền Bắc (Trong Sáng - Chuẩn)' },
  { id: 'Puck', name: 'Giọng Nam Truyền Cảm (Thuyết Minh)' },
  { id: 'Charon', name: 'Giọng Nữ Trưởng Thành (Trầm)' },
  { id: 'Fenrir', name: 'Giọng Nam Mạnh Mẽ (Trầm Ấm)' },
  { id: 'child-male-north', name: 'Bé Trai (Hà Nội - Hồn Nhiên)' },
  { id: 'child-female-north', name: 'Bé Gái (Hà Nội - Dễ Thương)' },
  { id: 'old-man', name: 'Giọng Cụ Già (Kể Chuyện Xưa)' },
  { id: 'news-reporter', name: 'Phát Thanh Viên (Tin Tức Trang Trọng)' },
  { id: 'scary-story', name: 'Giọng Kể Chuyện Ma (Rùng Rợn)' },
];

export const HISTORY_STORAGE_KEY = 'tts-generation-history';
export const MAX_HISTORY_ITEMS = 10;
