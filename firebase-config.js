/**
 * Firebase Configuration for EBC Hub
 * Uses modular CDN imports (no build tools required)
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyDTaFLVxc2edjPNL73gjB3mi_NCVWqSM4Q",
    authDomain: "ebc-26de1.firebaseapp.com",
    projectId: "ebc-26de1",
    storageBucket: "ebc-26de1.firebasestorage.app",
    messagingSenderId: "360266021698",
    appId: "1:360266021698:web:d21b77e8b9d823acc6a6db",
    measurementId: "G-947GLBMFPT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);

// Export everything needed by app.js
export {
    storage,
    db,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy
};
