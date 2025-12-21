
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
const syncUserToFirestore = async (user: firebase.User) => {
    if (!db) return;
    try {
        const userEmail = (user.email || '').toLowerCase().trim();
        const adminEmails = (APP_CONFIG.ADMIN_EMAILS || []).map(e => e.toLowerCase().trim());
        
        const isAdminConfig = adminEmails.includes(userEmail);
        const userRef = db.collection('users').doc(user.uid);
        
        const docSnap = await userRef.get();
        const currentData = docSnap.exists ? docSnap.data() : {};
        
        // Logic xác định Role:
        // 1. Nếu Email có trong Config -> Force thành 'admin'
        // 2. Nếu DB đã là 'admin' -> Giữ nguyên
        // 3. Ngược lại là 'user'
        let finalRole = currentData?.role;
        if (isAdminConfig) finalRole = 'admin';
        if (!finalRole) finalRole = 'user';

        const userData: any = {
            uid: user.uid,
            email: user.email, 
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            role: finalRole
        };

        if (currentData?.credits === undefined) {
            userData.credits = 10;
        }

        await userRef.set(userData, { merge: true });
        console.log(`User Synced: ${user.email} | Role: ${finalRole}`);
    } catch (error) {
        console.error("Error syncing user to Firestore:", error);
        throw error; // Ném lỗi để UI bắt được nếu gọi thủ công
    }
};

// --- EXPORTED REPAIR FUNCTION ---
export const checkAndRepairAdminRole = async () => {
    if (!auth?.currentUser) throw new Error("Chưa đăng nhập.");
    await syncUserToFirestore(auth.currentUser);
    return true;
};

export const loginWithGoogle = async () => {
    if (!auth || !googleProvider || !db) throw new Error("Firebase chưa được cấu hình hoặc khởi tạo thất bại.");
    try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        if (user) await syncUserToFirestore(user);
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

export const listenToUserRealtime = (uid: string, callback: (data: any) => void) => {
    if (!db) return () => {};
    return db.collection('users').doc(uid).onSnapshot((doc) => {
        if (doc.exists) callback(doc.data());
        else callback({ credits: 0 });
    });
};

// --- SYSTEM ANNOUNCEMENT FEATURES ---

export interface SystemAnnouncement {
    isActive: boolean;
    title: string;
    pinnedNote: string;
    content: string;
    lastUpdated: any;
    version?: number;
}

export const getSystemAnnouncement = async (): Promise<SystemAnnouncement | null> => {
    if (!db) return null;
    try {
        const doc = await db.collection('system').doc('announcement').get();
        if (doc.exists) {
            return doc.data() as SystemAnnouncement;
        }
        return null;
    } catch (error) {
        console.warn("Error fetching announcement:", error);
        return null;
    }
};

export const updateSystemAnnouncement = async (data: Partial<SystemAnnouncement>) => {
    if (!db) throw new Error("Database not initialized");
    await db.collection('system').doc('announcement').set({
        ...data,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
};

// --- ADMIN FEATURES ---

export const fetchAllUsers = async () => {
    if (!db) throw new Error("Database chưa kết nối.");

    try {
        // Lấy danh sách
        const snapshot = await db.collection('users').get();
        
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
        
        users.sort((a, b) => b._sortTime - a._sortTime);
        return users;

    } catch (error: any) {
        console.error("Fetch Users Error:", error);
        // Ném lỗi ra ngoài để AdminPanel hiển thị thông báo
        throw new Error(error.message || "Không thể lấy danh sách User.");
    }
};

export const deleteUserFromFirestore = async (uid: string) => {
    if (!db) return;
    await db.collection('users').doc(uid).delete();
};

export const updateUserCredits = async (uid: string, newCredits: number) => {
    if (!db) return;
    await db.collection('users').doc(uid).update({ credits: newCredits });
};

export const deductUserCredits = async (uid: string, amount: number) => {
    if (!db) return;
    await db.collection('users').doc(uid).update({
        credits: firebase.firestore.FieldValue.increment(-amount)
    });
};

export const isFirebaseReady = () => isFirebaseInitialized;
