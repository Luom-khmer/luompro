
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

export const loginWithGoogle = async () => {
    if (!auth || !googleProvider || !db) throw new Error("Firebase chưa được cấu hình hoặc khởi tạo thất bại.");
    try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        
        // --- SYNC USER TO FIRESTORE ---
        if (user) {
            const isAdmin = (APP_CONFIG.ADMIN_EMAILS || []).includes(user.email || '');
            const userRef = db.collection('users').doc(user.uid);
            
            // Kiểm tra xem user đã tồn tại chưa để không reset credits nếu đã có
            const docSnap = await userRef.get();
            
            const userData: any = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                role: isAdmin ? 'admin' : 'user'
            };

            // Nếu user chưa tồn tại hoặc chưa có trường credits, tặng 10 credits dùng thử
            if (!docSnap.exists || docSnap.data()?.credits === undefined) {
                userData.credits = 10;
            }

            await userRef.set(userData, { merge: true });
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
        }
    });
};

// --- ADMIN FEATURES ---

export const fetchAllUsers = async () => {
    if (!db) return [];
    try {
        const snapshot = await db.collection('users').orderBy('lastLogin', 'desc').get();
        return snapshot.docs.map(doc => {
            const data = doc.data();
            // Convert Timestamp to readable string if needed
            const lastLoginDate = data.lastLogin?.toDate ? data.lastLogin.toDate().toLocaleString() : 'N/A';
            return {
                id: doc.id,
                ...data,
                lastLogin: lastLoginDate
            };
        });
    } catch (error) {
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
