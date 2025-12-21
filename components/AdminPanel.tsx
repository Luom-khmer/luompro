
import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { 
    UsersIcon, 
    ChartBarIcon, 
    Cog6ToothIcon, 
    LockClosedIcon, 
    TrashIcon, 
    ShieldCheckIcon 
} from '@heroicons/react/24/outline';
import VisitorCounter from './VisitorCounter';

interface AdminPanelProps {
    currentUser: User | null;
    gommoCredits: number | null;
}

// Fake data for demonstration (Since we don't have a real DB connected to this specific view yet)
const MOCK_USERS = [
    { id: 1, email: 'user1@example.com', name: 'Nguyen Van A', role: 'user', lastLogin: '2024-05-20', credits: 120 },
    { id: 2, email: 'user2@example.com', name: 'Le Thi B', role: 'vip', lastLogin: '2024-05-21', credits: 5000 },
    { id: 3, email: 'admin@gmail.com', name: 'Super Admin', role: 'admin', lastLogin: 'Now', credits: 99999 },
    { id: 4, email: 'khach@example.com', name: 'Khach Vang Lai', role: 'user', lastLogin: '2024-05-19', credits: 0 },
];

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, gommoCredits }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'settings'>('dashboard');
    const [users, setUsers] = useState(MOCK_USERS);
    const [searchTerm, setSearchTerm] = useState('');

    const handleDeleteUser = (id: number) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
            setUsers(users.filter(u => u.id !== id));
        }
    };

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-[#0f1012] text-gray-200">
            {/* Admin Header */}
            <div className="p-6 border-b border-gray-800 bg-[#141414] flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-red-500 flex items-center gap-2">
                        <ShieldCheckIcon className="w-8 h-8" />
                        ADMINISTRATOR
                    </h2>
                    <p className="text-sm text-gray-500">Xin chào, {currentUser?.displayName || currentUser?.email}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 px-4 py-2 rounded-lg">
                    <span className="text-red-400 font-bold text-sm">CHẾ ĐỘ QUẢN TRỊ VIÊN</span>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <div className="w-64 bg-[#111] border-r border-gray-800 p-4 flex flex-col gap-2">
                    <button 
                        onClick={() => setActiveTab('dashboard')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'dashboard' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                    >
                        <ChartBarIcon className="w-5 h-5" /> Tổng Quan
                    </button>
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'users' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                    >
                        <UsersIcon className="w-5 h-5" /> Quản Lý Người Dùng
                    </button>
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'settings' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                    >
                        <Cog6ToothIcon className="w-5 h-5" /> Cài Đặt Hệ Thống
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-[#0f1012]">
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-white mb-4">Thống kê hệ thống</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Stat Card 1 */}
                                <div className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-700 shadow-lg">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-blue-900/30 rounded-lg">
                                            <UsersIcon className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 uppercase">Tổng User</span>
                                    </div>
                                    <h4 className="text-3xl font-bold text-white">{users.length}</h4>
                                    <p className="text-sm text-gray-500 mt-1">+2 hôm nay</p>
                                </div>

                                {/* Stat Card 2 */}
                                <div className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-700 shadow-lg">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-green-900/30 rounded-lg">
                                            <ChartBarIcon className="w-6 h-6 text-green-400" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 uppercase">Traffic Realtime</span>
                                    </div>
                                    <div className="text-2xl font-bold text-white"><VisitorCounter /></div>
                                    <p className="text-sm text-gray-500 mt-1">Đang hoạt động</p>
                                </div>

                                {/* Stat Card 3 */}
                                <div className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-700 shadow-lg">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-purple-900/30 rounded-lg">
                                            <LockClosedIcon className="w-6 h-6 text-purple-400" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 uppercase">Credits Hệ Thống</span>
                                    </div>
                                    <h4 className="text-3xl font-bold text-white">{gommoCredits !== null ? gommoCredits.toLocaleString() : '---'}</h4>
                                    <p className="text-sm text-gray-500 mt-1">Gommo API Balance</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white">Danh sách người dùng</h3>
                                <input 
                                    type="text" 
                                    placeholder="Tìm kiếm email..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 w-64"
                                />
                            </div>
                            
                            <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl overflow-hidden shadow-lg">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#222] text-gray-400 text-xs uppercase border-b border-gray-700">
                                            <th className="p-4 font-semibold">ID</th>
                                            <th className="p-4 font-semibold">Tên hiển thị</th>
                                            <th className="p-4 font-semibold">Email</th>
                                            <th className="p-4 font-semibold">Vai trò</th>
                                            <th className="p-4 font-semibold">Đăng nhập cuối</th>
                                            <th className="p-4 font-semibold text-right">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {filteredUsers.map((user) => (
                                            <tr key={user.id} className="hover:bg-[#252525] transition-colors text-sm">
                                                <td className="p-4 text-gray-500">#{user.id}</td>
                                                <td className="p-4 font-medium text-white flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                                                        {user.name.charAt(0)}
                                                    </div>
                                                    {user.name}
                                                </td>
                                                <td className="p-4 text-gray-300">{user.email}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                        user.role === 'admin' ? 'bg-red-900/30 text-red-400 border border-red-500/30' :
                                                        user.role === 'vip' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' :
                                                        'bg-gray-800 text-gray-400'
                                                    }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-400">{user.lastLogin}</td>
                                                <td className="p-4 text-right">
                                                    {user.role !== 'admin' && (
                                                        <button 
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded hover:bg-red-900/20"
                                                            title="Xóa người dùng"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredUsers.length === 0 && (
                                    <div className="p-8 text-center text-gray-500">
                                        Không tìm thấy người dùng nào.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-6">
                             <h3 className="text-xl font-bold text-white mb-4">Cài đặt hệ thống</h3>
                             <div className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-700">
                                <p className="text-gray-400 mb-4">Các cấu hình hệ thống (API Keys) đang được quản lý tại file <code>config.ts</code> hoặc trong Control Panel của trang chủ.</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-500 mb-1">Phiên bản App</label>
                                        <input disabled value="v1.0.0 (Luom Pro AI)" className="bg-[#111] border border-gray-600 rounded px-3 py-2 w-full text-gray-400 cursor-not-allowed"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-500 mb-1">Database Mode</label>
                                        <input disabled value="Local IndexedDB + Firebase Auth" className="bg-[#111] border border-gray-600 rounded px-3 py-2 w-full text-gray-400 cursor-not-allowed"/>
                                    </div>
                                    <div className="p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-yellow-500 text-sm">
                                        <strong>Lưu ý:</strong> Chức năng quản lý User hiện tại đang hiển thị dữ liệu giả lập (Mock Data). Để quản lý User thực tế, vui lòng tích hợp thêm Firestore Database.
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
