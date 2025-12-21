
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { APP_CONFIG } from "../config";

// Initialize variables
let auth: firebase.auth.Auth | undefined;
let db: firebase.firestore.Firestore | undefined;
let googleProvider: firebase.auth.GoogleAuthProvider | undefined;
let isFirebaseInitialized = false;

// Initialize Firebase only if config is present to avoid crashes
try {
    if (APP_CONFIG.FIREBASE && APP_CONFIG.FIREBASE.apiKey && APP_CONFIG.FIREBASE.apiKey.length > 5) {
        if (!firebase.apps.length) {
            firebase.initializeApp(APP_CONFIG.FIREBASE);
        }
        auth = firebase.auth();
        db = firebase.firestore();
        googleProvider = new firebase.auth.GoogleAuthProvider();
        isFirebaseInitialized = true;
    }
} catch (error) {
    console.warn("Firebase initialization failed. Check your config.ts");
}

export const getFirebaseAuth = () => auth;

// Export Database instance for usage in other components
export const getFirebaseDB = () => db;

// --- CORE FUNCTION: SYNC USER TO FIRESTORE ---
// Hàm này đảm bảo thông tin user luôn được lưu vào DB
const syncUserToFirestore = async (user: firebase.User) => {
    if (!db) return;
    try {
        // Chuẩn hóa email về chữ thường để so sánh chính xác
        const userEmail = (user.email || '').toLowerCase().trim();
        const adminEmails = (APP_CONFIG.ADMIN_EMAILS || []).map(e => e.toLowerCase().trim());
        
        const isAdmin = adminEmails.includes(userEmail);
        const userRef = db.collection('users').doc(user.uid);
        
        const docSnap = await userRef.get();
        const currentData = docSnap.exists ? docSnap.data() : {};
        
        const userData: any = {
            uid: user.uid,
            email: user.email, // Giữ nguyên case hiển thị
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            // Logic Role:
            // 1. Nếu config file nói là admin -> Luôn set là admin
            // 2. Nếu DB đã là admin -> Giữ nguyên
            // 3. Còn lại -> user
            role: (isAdmin || currentData?.role === 'admin') ? 'admin' : 'user'
        };

        // Nếu user chưa tồn tại hoặc chưa có trường credits, tặng 10 credits dùng thử
        if (currentData?.credits === undefined) {
            userData.credits = 10;
        }

        await userRef.set(userData, { merge: true });
        console.log(`User synced: ${user.email} | Role: ${userData.role}`);
    } catch (error) {
        console.error("Error syncing user to Firestore:", error);
    }
};

export const loginWithGoogle = async () => {
    if (!auth || !googleProvider || !db) throw new Error("Firebase chưa được cấu hình hoặc khởi tạo thất bại.");
    try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        
        if (user) {
            await syncUserToFirestore(user);
        }
        
        return user;
    } catch (error: any) {
        console.error("Login Error:", error);
        throw error;
    }
};

export const logoutUser = async () => {
    if (!auth) return;
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Logout failed", error);
    }
};

// --- USER FEATURES ---

// Lắng nghe thay đổi dữ liệu User (Credits) realtime
export const listenToUserRealtime = (uid: string, callback: (data: any) => void) => {
    if (!db) return () => {};
    
    return db.collection('users').doc(uid).onSnapshot((doc) => {
        if (doc.exists) {
            callback(doc.data());
        } else {
            // Self-healing: Nếu user đã Auth nhưng không có Docs trong DB -> Tạo ngay
            if (auth && auth.currentUser && auth.currentUser.uid === uid) {
                console.warn("User authenticated but missing in DB. Auto-creating...");
                syncUserToFirestore(auth.currentUser);
            }
            callback({ credits: 0 });
        }
    });
};

// --- ADMIN FEATURES ---

export const fetchAllUsers = async () => {
    if (!db) return [];

    // Helper function để map dữ liệu
    const mapUsers = (snapshot: firebase.firestore.QuerySnapshot) => {
        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            const lastLoginDate = data.lastLogin?.toDate ? data.lastLogin.toDate().toLocaleString() : 'N/A';
            const timestamp = data.lastLogin?.toMillis ? data.lastLogin.toMillis() : 0;
            return {
                id: doc.id,
                ...data,
                lastLogin: lastLoginDate,
                _sortTime: timestamp
            };
        });
        // Sort Client-side: Mới nhất lên đầu
        users.sort((a, b) => b._sortTime - a._sortTime);
        return users;
    };

    try {
        // Thử lấy danh sách lần 1
        const snapshot = await db.collection('users').get();
        return mapUsers(snapshot);

    } catch (error: any) {
        // XỬ LÝ LỖI THÔNG MINH (SELF-REPAIR)
        // Nếu lỗi là "permission-denied", có thể do user hiện tại chưa có role 'admin' trong DB
        // mặc dù email của họ có trong Config.
        if (error.code === 'permission-denied' && auth?.currentUser) {
            console.warn("Permission denied fetching users. Attempting to repair Admin Role...");
            
            // 1. Force Sync lại thông tin user hiện tại (để set role: admin)
            await syncUserToFirestore(auth.currentUser);
            
            // 2. Thử lấy danh sách lần 2
            try {
                console.log("Retrying fetch users...");
                const retrySnapshot = await db.collection('users').get();
                return mapUsers(retrySnapshot);
            } catch (retryError) {
                console.error("Retry failed. Still permission denied.", retryError);
            }
        }
        
        console.error("Error fetching users:", error);
        return [];
    }
};

export const deleteUserFromFirestore = async (uid: string) => {
    if (!db) return;
    try {
        await db.collection('users').doc(uid).delete();
    } catch (error) {
        console.error("Error deleting user:", error);
        throw error;
    }
};

export const updateUserCredits = async (uid: string, newCredits: number) => {
    if (!db) return;
    try {
        await db.collection('users').doc(uid).update({
            credits: newCredits
        });
    } catch (error) {
        console.error("Error updating credits:", error);
        throw error;
    }
};

export const deductUserCredits = async (uid: string, amount: number) => {
    if (!db) return;
    try {
        await db.collection('users').doc(uid).update({
            credits: firebase.firestore.FieldValue.increment(-amount)
        });
    } catch (error) {
        console.error("Error deducting credits:", error);
        throw error;
    }
};

export const isFirebaseReady = () => isFirebaseInitialized;
