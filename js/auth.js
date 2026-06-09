/**
 * Core Authentication Service for Google Play App Publishing Portal.
 * Binds Firebase Auth and backend JWT validation.
 */

const API_BASE = window.location.port === '8001' ? '' : 'http://localhost:8001';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCZC5cJQhg7p_quhl-Cp30mnLfz2rD8E8I",
    authDomain: "pub-apps-ef155.firebaseapp.com",
    projectId: "pub-apps-ef155",
    storageBucket: "pub-apps-ef155.firebasestorage.app",
    messagingSenderId: "201931640068",
    appId: "1:201931640068:web:a0ac1789a399df27091451",
    measurementId: "G-1LPG3BYSPW"
};

// Initialize Firebase if not already initialized
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const AuthService = {
    /**
     * Signs in using Google Auth provider.
     * @returns {Promise<{accessToken: string, role: string}>}
     */
    async signInWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        const idToken = await result.user.getIdToken();
        return await this.verifyWithBackend(idToken);
    },

    /**
     * Signs in or signs up using Email & Password.
     * @param {string} email 
     * @param {string} password 
     * @param {'signin'|'signup'} mode 
     * @returns {Promise<{accessToken: string, role: string}>}
     */
    async signInOrSignUpWithEmail(email, password, mode) {
        let userCredential;
        if (mode === 'signup') {
            userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        } else {
            userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        }
        const idToken = await userCredential.user.getIdToken();
        return await this.verifyWithBackend(idToken);
    },

    /**
     * Verifies the Firebase ID Token with our FastAPI backend.
     * @param {string} idToken 
     * @returns {Promise<{accessToken: string, role: string}>}
     */
    async verifyWithBackend(idToken) {
        const res = await fetch(`${API_BASE}/api/orders/admin-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: idToken })
        });

        if (!res.ok) {
            if (res.status === 403) {
                throw new Error("هذا الحساب غير مصرح له بالدخول.");
            }
            throw new Error("فشلت عملية التحقق من الحساب مع خادم النظام.");
        }

        const data = await res.json();
        return {
            accessToken: data.access_token,
            role: data.role
        };
    },

    /**
     * Retrieves stored access token from localStorage.
     * @returns {string|null}
     */
    getStoredToken() {
        return localStorage.getItem('admin_token');
    },

    /**
     * Saves access token to localStorage.
     * @param {string} token 
     */
    saveToken(token) {
        localStorage.setItem('admin_token', token);
    },

    /**
     * Clears token and signs out of Firebase.
     */
    async logout() {
        localStorage.removeItem('admin_token');
        try {
            await firebase.auth().signOut();
        } catch (e) {
            console.error("Firebase signout error:", e);
        }
    },

    /**
     * Decodes the payload of a JWT token.
     * @param {string} token 
     * @returns {object|null}
     */
    decodeToken(token) {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
    }
};
