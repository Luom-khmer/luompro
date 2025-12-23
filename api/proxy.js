
export default async function handler(req, res) {
    // 1. XỬ LÝ CORS (Theo yêu cầu: check Origin, Allowlist Regex, Set Headers)
    const origin = req.headers.origin;
    
    // Danh sách domain cho phép (Regex pattern)
    const allowedPatterns = [
        /^http:\/\/localhost:\d+$/,          // Localhost (Mọi port)
        /^https:\/\/.*\.vercel\.app$/,       // Các sub-domain Vercel
        /^https:\/\/.*\.aivideoauto\.com$/   // Domain hệ thống
    ];

    // Kiểm tra Origin có khớp pattern không
    const isAllowed = origin && allowedPatterns.some(pattern => pattern.test(origin));

    // Set CORS headers nếu hợp lệ (hoặc server-to-server không có origin)
    if (isAllowed || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Xử lý Preflight Request (OPTIONS) -> Trả về 204 No Content
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // 2. XỬ LÝ PROXY (Chuyển tiếp request sang Gommo)
    const { path, ...queryParams } = req.query;

    if (!path) {
        return res.status(400).json({ error: "Path parameter is missing" });
    }

    // Tái tạo URL đích
    const pathStr = Array.isArray(path) ? path.join('/') : path;
    const queryString = new URLSearchParams(queryParams).toString();
    const targetUrl = `https://api.gommo.net/${pathStr}${queryString ? '?' + queryString : ''}`;

    try {
        const fetchOptions = {
            method: req.method,
            headers: {
                // Forward các header quan trọng
                'Content-Type': req.headers['content-type'] || 'application/json',
                'Authorization': req.headers['authorization'] || '',
                // Giả lập User-Agent để tránh bị chặn bởi firewall đơn giản
                'User-Agent': 'Mozilla/5.0 (compatible; LuomProProxy/1.0)',
                'Accept': 'application/json, text/plain, */*'
            }
        };

        // Xử lý Body cho các method POST/PUT
        if (req.method !== 'GET' && req.method !== 'HEAD') {
             const contentType = req.headers['content-type'] || '';
             
             // Vercel tự động parse body thành object, cần stringify lại để fetch
             if (contentType.includes('application/x-www-form-urlencoded')) {
                 fetchOptions.body = new URLSearchParams(req.body).toString();
             } else if (contentType.includes('application/json')) {
                 fetchOptions.body = JSON.stringify(req.body);
             } else {
                 fetchOptions.body = req.body;
             }
        }

        // Gọi sang Server Gommo
        const response = await fetch(targetUrl, fetchOptions);
        const data = await response.text();

        // Forward lại Content-Type từ Gommo về Client
        const resContentType = response.headers.get('content-type');
        if (resContentType) {
            res.setHeader('Content-Type', resContentType);
        }

        // Trả kết quả về
        res.status(response.status).send(data);

    } catch (error) {
        console.error("Proxy Error:", error);
        res.status(502).json({ error: "Bad Gateway", details: error.message });
    }
}
