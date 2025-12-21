
import React, { useState, useEffect } from 'react';

const VisitorCounter: React.FC = () => {
  // Bắt đầu với một số ngẫu nhiên từ 80 đến 120 để tạo cảm giác thực tế
  const [count, setCount] = useState(Math.floor(Math.random() * 41) + 80);

  useEffect(() => {
    const interval = setInterval(() => {
      // Tăng thêm một số ngẫu nhiên nhỏ (1 đến 3)
      setCount(prevCount => prevCount + Math.floor(Math.random() * 3) + 1);
    }, Math.random() * 3000 + 2000); // Cập nhật sau mỗi 2-5 giây

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center space-x-2 text-gray-400" title={`${count} người đang truy cập`}>
      <div className="relative flex items-center justify-center h-5 w-5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
      </div>
      <span className="font-semibold text-white">{count}</span>
      <span className="text-sm hidden sm:inline">đang truy cập</span>
    </div>
  );
};

export default VisitorCounter;
