
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
        const isAdmin = (APP_CONFIG.ADMIN_EMAILS || []).includes(user.email || '');
        const userRef = db.collection('users').doc(user.uid);
        
        const docSnap = await userRef.get();
        const currentData = docSnap.exists ? docSnap.data() : {};
        
        const userData: any = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            // Giữ nguyên role nếu đã có, nếu chưa thì set theo logic admin
            role: currentData?.role ? currentData.role : (isAdmin ? 'admin' : 'user')
        };

        // Nếu user chưa tồn tại hoặc chưa có trường credits, tặng 10 credits dùng thử
        // Kiểm tra kỹ undefined để tránh reset khi credits = 0
        if (currentData?.credits === undefined) {
            userData.credits = 10;
        }

        await userRef.set(userData, { merge: true });
        console.log("User synced to Firestore:", user.email);
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
// & TỰ ĐỘNG KHÔI PHỤC DỮ LIỆU NẾU THIẾU
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
    try {
        // QUAN TRỌNG: Bỏ orderBy('lastLogin') ở server để tránh lỗi "Missing Index"
        // Thay vào đó ta lấy toàn bộ list về và sort ở client (JavaScript)
        const snapshot = await db.collection('users').get();

        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            // Convert Timestamp to readable string if needed
            const lastLoginDate = data.lastLogin?.toDate ? data.lastLogin.toDate().toLocaleString() : 'N/A';
            const timestamp = data.lastLogin?.toMillis ? data.lastLogin.toMillis() : 0;
            
            return {
                id: doc.id,
                ...data,
                lastLogin: lastLoginDate,
                _sortTime: timestamp // Dùng để sort
            };
        });
        
        // Sort Client-side: Mới nhất lên đầu
        users.sort((a, b) => b._sortTime - a._sortTime);

        return users;
    } catch (error) {
        console.error("Error fetching users:", error);
        // Trả về mảng rỗng thay vì crash
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
