
import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { 
    UsersIcon, 
    ChartBarIcon, 
    Cog6ToothIcon, 
    LockClosedIcon, 
    TrashIcon, 
    ShieldCheckIcon,
    ArrowPathIcon,
    CurrencyDollarIcon,
    PencilSquareIcon,
    ExclamationTriangleIcon,
    WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import VisitorCounter from './VisitorCounter';
import { fetchAllUsers, deleteUserFromFirestore, updateUserCredits, checkAndRepairAdminRole } from '../services/firebaseService';

interface AdminPanelProps {
    currentUser: firebase.User | null;
    gommoCredits: number | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, gommoCredits }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'settings'>('dashboard');
    
    // State dữ liệu
    const [users, setUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isRepairing, setIsRepairing] = useState(false);

    // Load users khi vào tab Users
    useEffect(() => {
        if (activeTab === 'users') {
            loadUsers();
        }
    }, [activeTab]);

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        setFetchError(null);
        try {
            const data = await fetchAllUsers();
            setUsers(data);
        } catch (error: any) {
            setFetchError(error.message);
            setUsers([]);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleRepairPermissions = async () => {
        setIsRepairing(true);
        try {
            await checkAndRepairAdminRole();
            alert("Đã cập nhật quyền Admin thành công! Hệ thống sẽ tải lại danh sách.");
            await loadUsers(); // Thử tải lại ngay
        } catch (error: any) {
            alert("Lỗi cấp quyền: " + error.message);
        } finally {
            setIsRepairing(false);
        }
    };

    const handleDeleteUser = async (id: string, email: string) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa dữ liệu của user ${email}?`)) {
            try {
                await deleteUserFromFirestore(id);
                setUsers(users.filter(u => u.id !== id));
            } catch (error) {
                alert("Lỗi khi xóa user: " + error);
            }
        }
    };

    const handleEditCredits = async (id: string, currentCredits: number, name: string) => {
        const input = window.prompt(`Nhập số Credit mới cho user ${name}:`, currentCredits.toString());
        if (input !== null) {
            const newCredits = parseInt(input, 10);
            if (!isNaN(newCredits) && newCredits >= 0) {
                try {
                    await updateUserCredits(id, newCredits);
                    setUsers(users.map(u => u.id === id ? { ...u, credits: newCredits } : u));
                } catch (error) {
                    alert("Lỗi cập nhật: " + error);
                }
            } else {
                alert("Số credit không hợp lệ.");
            }
        }
    };

    const filteredUsers = users.filter(u => 
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-[#0f1012] text-gray-200">
            {/* Admin Header */}
            <div className="p-6 border-b border-gray-800 bg-[#141414] flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-red-500 flex items-center gap-2">
                        <ShieldCheckIcon className="w-8 h-8" />
                        ADMIN DASHBOARD
                    </h2>
                    <p className="text-sm text-gray-500">Xin chào, {currentUser?.displayName || currentUser?.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                     <div className="bg-red-900/20 border border-red-500/30 px-4 py-2 rounded-lg text-center">
                        <span className="text-red-400 font-bold text-sm block">SUPER ADMIN</span>
                     </div>
                     <span className="text-[10px] text-gray-500">{currentUser?.email}</span>
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
                        <UsersIcon className="w-5 h-5" /> Quản Lý User
                    </button>
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'settings' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                    >
                        <Cog6ToothIcon className="w-5 h-5" /> Cài Đặt
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-[#0f1012]">
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6 animate-fade-in">
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
                                    <h4 className="text-3xl font-bold text-white">{users.length > 0 ? users.length : (isLoadingUsers ? '...' : '-')}</h4>
                                    <p className="text-sm text-gray-500 mt-1">Trong Database</p>
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
                                    <p className="text-sm text-gray-500 mt-1">Đang online</p>
                                </div>

                                {/* Stat Card 3 */}
                                <div className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-700 shadow-lg">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-purple-900/30 rounded-lg">
                                            <LockClosedIcon className="w-6 h-6 text-purple-400" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 uppercase">Credits Gommo</span>
                                    </div>
                                    <h4 className="text-3xl font-bold text-white">{gommoCredits !== null ? gommoCredits.toLocaleString() : '---'}</h4>
                                    <p className="text-sm text-gray-500 mt-1">API Balance</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    Danh sách người dùng
                                    {isLoadingUsers && <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-500" />}
                                </h3>
                                <div className="flex gap-2">
                                    <button onClick={loadUsers} className="p-2 bg-gray-800 rounded hover:bg-gray-700 border border-gray-600" title="Tải lại">
                                        <ArrowPathIcon className={`w-5 h-5 text-gray-400 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                                    </button>
                                    <input 
                                        type="text" 
                                        placeholder="Tìm kiếm email..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 w-64"
                                    />
                                </div>
                            </div>
                            
                            {/* ERROR DISPLAY & FIX BUTTON */}
                            {fetchError && (
                                <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 mb-6 flex flex-col gap-4 items-start">
                                    <div className="flex items-center gap-3">
                                        <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
                                        <div>
                                            <h4 className="text-red-400 font-bold text-lg">Không thể lấy danh sách User</h4>
                                            <p className="text-gray-400 text-sm mt-1">{fetchError}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 w-full bg-black/30 p-4 rounded text-xs font-mono text-gray-400">
                                        <p>Nguyên nhân có thể:</p>
                                        <ul className="list-disc pl-5">
                                            <li>Tài khoản của bạn chưa được cấp quyền 'admin' trong Database.</li>
                                            <li>Rules Firestore chặn truy cập.</li>
                                        </ul>
                                    </div>
                                    <button 
                                        onClick={handleRepairPermissions}
                                        disabled={isRepairing}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg transition-all"
                                    >
                                        {isRepairing ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : <WrenchScrewdriverIcon className="w-5 h-5" />}
                                        {isRepairing ? "Đang xử lý..." : "Cấp quyền Admin & Tải lại"}
                                    </button>
                                </div>
                            )}

                            {!fetchError && (
                                <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl overflow-hidden shadow-lg">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#222] text-gray-400 text-xs uppercase border-b border-gray-700">
                                                <th className="p-4 font-semibold">User</th>
                                                <th className="p-4 font-semibold">Email</th>
                                                <th className="p-4 font-semibold text-center">Credits</th>
                                                <th className="p-4 font-semibold">Vai trò</th>
                                                <th className="p-4 font-semibold">Đăng nhập cuối</th>
                                                <th className="p-4 font-semibold text-right">Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {filteredUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                                        {isLoadingUsers ? 'Đang tải dữ liệu...' : 'Không tìm thấy user nào (hoặc Database trống).'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredUsers.map((user) => (
                                                    <tr key={user.id} className="hover:bg-[#252525] transition-colors text-sm">
                                                        <td className="p-4 font-medium text-white flex items-center gap-3">
                                                            {user.photoURL ? (
                                                                <img src={user.photoURL} className="w-8 h-8 rounded-full border border-gray-600" alt="" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                                                                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                            <div className="flex flex-col">
                                                                <span>{user.displayName || 'No Name'}</span>
                                                                <span className="text-[10px] text-gray-500 font-mono">{user.uid.slice(0, 8)}...</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-gray-300">{user.email}</td>
                                                        <td className="p-4 text-center">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-bold ${user.credits > 0 ? 'text-green-400 bg-green-900/20 border border-green-500/30' : 'text-red-400 bg-red-900/20 border border-red-500/30'}`}>
                                                                {user.credits ?? 0}
                                                            </span>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                                user.role === 'admin' ? 'bg-red-900/30 text-red-400 border border-red-500/30' :
                                                                'bg-gray-800 text-gray-400'
                                                            }`}>
                                                                {user.role || 'user'}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-gray-400">{user.lastLogin}</td>
                                                        <td className="p-4 text-right flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleEditCredits(user.id, user.credits || 0, user.displayName || user.email)}
                                                                className="text-gray-400 hover:text-green-400 transition-colors p-2 rounded hover:bg-green-900/20"
                                                                title="Cộng/Trừ Credits"
                                                            >
                                                                <PencilSquareIcon className="w-5 h-5" />
                                                            </button>
                                                            {user.role !== 'admin' && (
                                                                <button 
                                                                    onClick={() => handleDeleteUser(user.id, user.email)}
                                                                    className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded hover:bg-red-900/20"
                                                                    title="Xóa dữ liệu user này"
                                                                >
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-6 animate-fade-in">
                             <h3 className="text-xl font-bold text-white mb-4">Cài đặt hệ thống</h3>
                             <div className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-700">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-500 mb-1">Trạng thái Database</label>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></div>
                                            <span className="text-green-400 font-bold">Cloud Firestore: Connected</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                         <button onClick={handleRepairPermissions} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-600 text-sm">
                                            Đồng bộ quyền Admin thủ công
                                         </button>
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
