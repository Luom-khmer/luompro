
// --- CẤU HÌNH API KEY ---
// Để deploy chạy ngay, bạn hãy dán Key vào bên dưới.

export const APP_CONFIG = {
    // 1. Google Gemini API Key (Bắt buộc cho chức năng chính)
    // -> Lấy miễn phí tại: https://aistudio.google.com/app/apikey
    // -> Video hướng dẫn: https://www.youtube.com/results?search_query=get+gemini+api+key
    GEMINI_API_KEY: "AIzaSyBmYVtAzKEO168mbZUEPZq0QWIoPSnnYAA", 

    // 2. Gommo Access Token (Tùy chọn - Dùng cho chức năng nâng cao/video)
    // -> Lấy tại: https://aivideoauto.com/pages/account/apikeys
    GOMMO_API_KEY: "Jgfrhaf/dLPeJmdj7A4RgMJzk4TQakr1PmK14mFhC9FG7VM/I16+ZMvETX/TpokBlAjEO/sb2xNW5a09BG1UUnMOuL6lco2051HwUZY9lBTqvvgETPkQeO/ND5VHWUTgsXb6llG271cbgRhiZJMR1xUx8zm/TQYNs10RzCocpAOIiadIWhypWqBt8uWduO9rM6kWNxBiishkUf49ICR2cQ==",
    
    // 3. Cloudflare Worker URL (BẮT BUỘC ĐỂ TRÁNH LỖI CORS & TIMEOUT)
    // Thay thế bằng link Worker của bạn. VD: "https://my-proxy.user.workers.dev"
    // Link này giúp ẩn danh và giữ kết nối lâu hơn Vercel (giới hạn 10-60s).
    GOMMO_PROXY_URL: "https://red-unit-gommo-proxy.dluom4198.workers.dev", 

    // 4. Firebase Config (Dành cho chức năng Đăng nhập)
    // -> Lấy tại Firebase Console > Project Settings > General > Your apps
    FIREBASE: {
        apiKey: "AIzaSyCAhx1Bor7eAK7MrTbbK4tHr0Z0vP2kN1E",
        authDomain: "gemini-47e46.firebaseapp.com",
        projectId: "gemini-47e46",
        storageBucket: "gemini-47e46.firebasestorage.app",
        messagingSenderId: "202468401310",
        appId: "1:202468401310:web:00a0b0b6e6704b68bd5b8f",
        measurementId: "G-PGV1ZZ3PR6"
    },

    // 5. Danh sách Email Admin (Thay thế bằng email thật của bạn)
    ADMIN_EMAILS: [
        "admin@gmail.com", 
        "nguyendinhtien@gmail.com",
        "luompro@gmail.com",
        "danhluom68g1@gmail.com"
    ]
};
