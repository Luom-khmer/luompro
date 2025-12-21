
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, Auth } from "firebase/auth";
import { APP_CONFIG } from "../config";

// Initialize variables
let auth: Auth | undefined;
let googleProvider: GoogleAuthProvider | undefined;
let isFirebaseInitialized = false;

// Initialize Firebase only if config is present to avoid crashes
try {
    if (APP_CONFIG.FIREBASE && APP_CONFIG.FIREBASE.apiKey && APP_CONFIG.FIREBASE.apiKey.length > 5) {
        const app = initializeApp(APP_CONFIG.FIREBASE);
        auth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
        isFirebaseInitialized = true;
    }
} catch (error) {
    console.warn("Firebase initialization failed. Check your config.ts", error);
}

export const getFirebaseAuth = () => auth;

export const loginWithGoogle = async () => {
    if (!isFirebaseInitialized || !auth || !googleProvider) {
        throw new Error("Firebase chưa được cấu hình. Vui lòng cập nhật config.ts");
    }
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error: any) {
        console.error("Login Error:", error);
        throw error;
    }
};

export const logoutUser = async () => {
    if (!auth) return;
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error);
    }
};
