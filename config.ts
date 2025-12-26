
// --- CẤU HÌNH API KEY ---
// Để deploy chạy ngay, bạn hãy dán Key vào bên dưới.

export const APP_CONFIG = {
    // 1. Google Gemini API Key (Bắt buộc cho chức năng chính)
    // -> Lấy miễn phí tại: https://aistudio.google.com/app/apikey
    // -> Video hướng dẫn: https://www.youtube.com/results?search_query=get+gemini+api+key
    GEMINI_API_KEY: "AIzaSyBmYVtAzKEO168mbZUEPZq0QWIoPSnnYAA", 

    // 2. Gommo Access Token (ĐÃ BẢO MẬT)
    // Thay vì để Key thật ở đây, ta để một mã định danh. 
    // Proxy Server (Cloudflare Worker) sẽ tự động thay thế mã này bằng Key thật.
    GOMMO_API_KEY: "SECURE_PROXY_MODE",
    
    // 3. Cloudflare Worker URL (BẮT BUỘC ĐỂ TRÁNH LỖI CORS & TIMEOUT & BẢO MẬT)
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