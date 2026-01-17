/**
 * EBC Hub - Media Center Application
 * Full-featured media gallery with Firebase Cloud Storage
 * Syncs media across all team members' devices in real-time
 */

// ===========================
// Firebase Imports
// ===========================
import {
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
} from './firebase-config.js';

// ===========================
// Gemini AI Import
// ===========================
import { generateAICaptions } from './gemini-service.js';
import { fetchLiveScores, getMatchStatus, LEAGUES } from './sports-service.js';

// ===========================
// Configuration & State
// ===========================
const DB_NAME = 'EBCHubDB';
const DB_VERSION = 1;
const STORE_NAME = 'media';

const state = {
    db: null,
    mediaItems: [],
    selectedItems: new Set(),
    uploadingIds: new Set(), // Track IDs currently being uploaded to prevent duplicates
    currentFilter: 'all',
    currentSort: 'newest',
    searchQuery: '',
    lightboxIndex: -1,
    filteredItems: [],
    isOnline: navigator.onLine,
    unsubscribeSync: null,
    selectedImageForCaption: null // Track image selected for AI caption generation
};

// ===========================
// DOM Elements
// ===========================
const elements = {
    // Screens
    homeScreen: document.getElementById('home-screen'),
    mainApp: document.getElementById('main-app'),
    enterBtn: document.getElementById('enter-btn'),

    // Gallery
    mediaGrid: document.getElementById('media-grid'),
    emptyState: document.getElementById('empty-state'),
    mediaCount: document.getElementById('media-count'),

    // Sidebar
    toolsSidebar: document.getElementById('tools-sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    mobileSidebarToggle: document.getElementById('mobile-sidebar-toggle'),

    // Upload
    uploadBtn: document.getElementById('upload-btn'),
    fileInput: document.getElementById('file-input'),
    dropZone: document.getElementById('drop-zone'),

    // Download & Delete
    downloadSelectedBtn: document.getElementById('download-selected-btn'),
    deleteSelectedBtn: document.getElementById('delete-selected-btn'),
    selectAllBtn: document.getElementById('select-all-btn'),
    selectedCount: document.getElementById('selected-count'),

    // Filter & Sort
    filterBtns: document.querySelectorAll('.filter-btn'),
    sortSelect: document.getElementById('sort-select'),
    searchInput: document.getElementById('search-input'),

    // Lightbox
    lightbox: document.getElementById('lightbox'),
    lightboxImage: document.getElementById('lightbox-image'),
    lightboxVideo: document.getElementById('lightbox-video'),
    lightboxFilename: document.getElementById('lightbox-filename'),
    lightboxClose: document.getElementById('lightbox-close'),
    lightboxPrev: document.getElementById('lightbox-prev'),
    lightboxNext: document.getElementById('lightbox-next'),
    lightboxDownload: document.getElementById('lightbox-download'),

    // Captions
    captionTabs: document.querySelectorAll('.caption-tab'),
    captionList: document.getElementById('caption-list'),
    hashtagBundle: document.getElementById('hashtag-bundle'),
    copyHashtagsBtn: document.getElementById('copy-hashtags-btn'),

    // AI Captions
    selectedImagePreview: document.getElementById('selected-image-preview'),
    aiPreviewImage: document.getElementById('ai-preview-image'),
    generateAiBtn: document.getElementById('generate-ai-caption-btn'),
    aiCaptionsContainer: document.getElementById('ai-captions-container'),
    aiLoading: document.getElementById('ai-loading'),
    aiCaptionsList: document.getElementById('ai-captions-list'),

    // Toast
    uploadToast: document.getElementById('upload-toast'),
    toastText: document.getElementById('toast-text'),
    toastProgress: document.getElementById('toast-progress'),

    // Utilities
    videoProcessor: document.getElementById('video-processor'),
    thumbnailCanvas: document.getElementById('thumbnail-canvas')
};

// ===========================
// IndexedDB Functions
// ===========================
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            state.db = request.result;
            resolve(state.db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('name', 'name', { unique: false });
                store.createIndex('type', 'type', { unique: false });
                store.createIndex('date', 'date', { unique: false });
            }
        };
    });
}

async function saveMediaToDB(mediaItem) {
    return new Promise((resolve, reject) => {
        const transaction = state.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(mediaItem);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function loadMediaFromDB() {
    return new Promise((resolve, reject) => {
        const transaction = state.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function deleteMediaFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = state.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

// ===========================
// Firebase Cloud Storage Functions
// ===========================

/**
 * Upload a file to Firebase Storage and return the download URL
 */
async function uploadToCloud(file, mediaId) {
    const storageRef = ref(storage, `media/${mediaId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
}

/**
 * Save media item to Firebase (Storage + Firestore)
 * - Uploads file blob to Storage
 * - Saves metadata (with downloadURL) to Firestore
 */
async function saveMediaToCloud(mediaItem) {
    // Upload the file blob to Firebase Storage
    const downloadURL = await uploadToCloud(mediaItem.blob, mediaItem.id);

    // Prepare metadata for Firestore (without blob - just URL)
    const metadata = {
        id: mediaItem.id,
        name: mediaItem.name,
        type: mediaItem.type,
        mimeType: mediaItem.mimeType,
        size: mediaItem.size,
        thumbnail: mediaItem.thumbnail,
        downloadURL: downloadURL,
        date: mediaItem.date,
        uploadedAt: Date.now()
    };

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'media'), metadata);

    return { ...metadata, docId: docRef.id };
}

/**
 * Load all media items from Firestore
 */
async function loadMediaFromCloud() {
    const q = query(collection(db, 'media'), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        docId: docSnap.id
    }));
}

/**
 * Delete media from Firebase (Storage + Firestore)
 */
async function deleteMediaFromCloud(item) {
    // Delete from Storage
    const storageRef = ref(storage, `media/${item.id}/${item.name}`);
    try {
        await deleteObject(storageRef);
    } catch (e) {
        console.warn('Storage delete failed (file may not exist):', e);
    }

    // Delete from Firestore
    if (item.docId) {
        await deleteDoc(doc(db, 'media', item.docId));
    }
}

/**
 * Set up real-time sync listener for new uploads from other users
 * When someone uploads/deletes media, all connected clients update automatically
 */
function setupRealtimeSync() {
    const q = query(collection(db, 'media'), orderBy('date', 'desc'));

    state.unsubscribeSync = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();
            const docId = change.doc.id;

            if (change.type === 'added') {
                // Only add if not already in local state AND not currently being uploaded (avoid duplicates)
                const alreadyExists = state.mediaItems.find(item => item.id === data.id);
                const isUploading = state.uploadingIds.has(data.id);
                if (!alreadyExists && !isUploading) {
                    state.mediaItems.unshift({ ...data, docId });
                    console.log('📥 New media synced:', data.name);
                }
            } else if (change.type === 'removed') {
                // Remove from local state
                state.mediaItems = state.mediaItems.filter(item => item.id !== data.id);
                console.log('🗑️ Media removed:', data.name);
            } else if (change.type === 'modified') {
                // Update existing item
                const index = state.mediaItems.findIndex(item => item.id === data.id);
                if (index !== -1) {
                    state.mediaItems[index] = { ...data, docId };
                }
            }
        });

        // Re-render gallery with updated data
        updateGallery();
        updateMediaCount();
    }, (error) => {
        console.error('Real-time sync error:', error);
    });
}

// ===========================
// File Processing
// ===========================
function generateId() {
    return `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function generateImageThumbnail(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = elements.thumbnailCanvas;
                const ctx = canvas.getContext('2d');

                // Set thumbnail size
                const maxSize = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function generateVideoThumbnail(file) {
    return new Promise((resolve) => {
        const video = elements.videoProcessor;
        const canvas = elements.thumbnailCanvas;
        const ctx = canvas.getContext('2d');

        video.onloadeddata = () => {
            video.currentTime = Math.min(1, video.duration / 2);
        };

        video.onseeked = () => {
            const maxSize = 400;
            let width = video.videoWidth;
            let height = video.videoHeight;

            if (width > height) {
                if (width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(video, 0, 0, width, height);

            URL.revokeObjectURL(video.src);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };

        video.onerror = () => {
            // Fallback if video can't be processed
            resolve(null);
        };

        video.src = URL.createObjectURL(file);
    });
}

async function processFiles(files) {
    const validFiles = Array.from(files).filter(file => {
        return file.type.startsWith('image/') || file.type.startsWith('video/');
    });

    if (validFiles.length === 0) return;

    showToast('Uploading to cloud...', true);
    let processed = 0;

    for (const file of validFiles) {
        const mediaId = generateId();

        // Mark this ID as uploading to prevent duplicate from sync listener
        state.uploadingIds.add(mediaId);

        try {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');

            let thumbnail = null;
            if (isImage) {
                thumbnail = await generateImageThumbnail(file);
            } else if (isVideo) {
                thumbnail = await generateVideoThumbnail(file);
            }

            const mediaItem = {
                id: mediaId,
                name: file.name,
                type: isImage ? 'image' : 'video',
                mimeType: file.type,
                size: file.size,
                blob: file,
                thumbnail: thumbnail,
                date: Date.now()
            };

            // Upload to Firebase cloud storage
            const cloudItem = await saveMediaToCloud(mediaItem);

            // Add to local state directly (sync listener will skip due to uploadingIds)
            state.mediaItems.unshift({
                ...cloudItem,
                blob: null // Don't keep blob in memory after upload
            });

            // Also save to local IndexedDB for offline access
            await saveMediaToDB({
                ...mediaItem,
                downloadURL: cloudItem.downloadURL,
                docId: cloudItem.docId
            });

            processed++;
            updateToastProgress((processed / validFiles.length) * 100);
            console.log(`☁️ Uploaded: ${file.name}`);
        } catch (error) {
            console.error('Error uploading file:', file.name, error);
            showToast(`Failed to upload ${file.name}`, false);
        } finally {
            // Remove from uploading set regardless of success/failure
            state.uploadingIds.delete(mediaId);
        }
    }

    hideToast(true);
    updateGallery();
    updateMediaCount();
}

// ===========================
// Gallery Rendering
// ===========================
function getFilteredAndSortedMedia() {
    let items = [...state.mediaItems];

    // Apply filter
    if (state.currentFilter !== 'all') {
        items = items.filter(item => item.type === state.currentFilter);
    }

    // Apply search
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        items = items.filter(item => item.name.toLowerCase().includes(query));
    }

    // Apply sort
    switch (state.currentSort) {
        case 'newest':
            items.sort((a, b) => b.date - a.date);
            break;
        case 'oldest':
            items.sort((a, b) => a.date - b.date);
            break;
        case 'name-asc':
            items.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            items.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }

    return items;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function createMediaCard(item, index) {
    const card = document.createElement('div');
    card.className = `media-card${state.selectedItems.has(item.id) ? ' selected' : ''}`;
    card.dataset.id = item.id;
    card.dataset.index = index;
    card.style.animationDelay = `${index * 0.05}s`;

    const isVideo = item.type === 'video';

    card.innerHTML = `
        <img class="media-thumbnail" src="${item.thumbnail || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23222" width="100" height="100"/%3E%3C/svg%3E'}" alt="${item.name}" loading="lazy">
        ${isVideo ? `
            <div class="video-play-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 5.14v14l11-7l-11-7Z"/>
                </svg>
            </div>
        ` : ''}
        <div class="media-type-badge">
            ${isVideo ? `
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M10 9L15 12L10 15V9Z" fill="currentColor"/>
                </svg>
                <span>Video</span>
            ` : `
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
                    <circle cx="8" cy="10" r="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M3 16L8 12L12 15L18 9L21 12" stroke="currentColor" stroke-width="2"/>
                </svg>
                <span>Photo</span>
            `}
        </div>
        
        <!-- AI Caption Button (Top Left) -->
        ${!isVideo ? `
        <button class="media-action-btn ai-caption-btn" aria-label="Use for AI Caption" title="Generate AI Caption">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9 10h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 10h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M15 10h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </button>
        ` : ''}

        <div class="media-checkbox" role="checkbox" aria-checked="${state.selectedItems.has(item.id)}">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <div class="media-info">
            <span class="media-filename">${item.name}</span>
            <span class="media-meta">${formatFileSize(item.size)}</span>
        </div>
    `;

    // Double click to open lightbox
    card.addEventListener('dblclick', () => {
        openLightbox(index);
    });

    // Single click to select and update AI focus
    card.addEventListener('click', (e) => {
        if (e.target.closest('.media-checkbox')) {
            e.stopPropagation();
            toggleSelection(item.id);
            // Also select for AI caption if it's an image
            if (item.type === 'image') {
                selectImageForCaption(item);
            }
        } else if (e.target.closest('.ai-caption-btn')) {
            e.stopPropagation();
            // Explicit AI button click - pass full item
            selectImageForCaption(item);
        } else {
            // Card body click - toggle selection AND select for AI caption (if image)
            toggleSelection(item.id);
            if (item.type === 'image') {
                selectImageForCaption(item);
            }
        }
    });

    return card;
}

// Helper to get source for different item types
function getItemSrc(item) {
    if (item.downloadURL) return item.downloadURL;
    if (item.blob) {
        const blob = item.blob instanceof Blob ? item.blob : new Blob([item.blob], { type: item.mimeType });
        return URL.createObjectURL(blob);
    }
    if (item.thumbnail) return item.thumbnail;
    return null;
}

function updateGallery() {
    state.filteredItems = getFilteredAndSortedMedia();

    elements.mediaGrid.innerHTML = '';

    if (state.filteredItems.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.mediaGrid.classList.add('hidden');
    } else {
        elements.emptyState.classList.add('hidden');
        elements.mediaGrid.classList.remove('hidden');

        state.filteredItems.forEach((item, index) => {
            elements.mediaGrid.appendChild(createMediaCard(item, index));
        });
    }
}

function updateMediaCount() {
    elements.mediaCount.textContent = state.mediaItems.length;
}

// ===========================
// Selection Management
// ===========================
function toggleSelection(id) {
    if (state.selectedItems.has(id)) {
        state.selectedItems.delete(id);
    } else {
        state.selectedItems.add(id);
    }
    updateSelectionUI();
}

function selectAll() {
    if (state.selectedItems.size === state.filteredItems.length) {
        // Deselect all
        state.selectedItems.clear();
    } else {
        // Select all filtered items
        state.filteredItems.forEach(item => state.selectedItems.add(item.id));
    }
    updateSelectionUI();
}

function updateSelectionUI() {
    // Update badges
    elements.selectedCount.textContent = state.selectedItems.size;
    elements.downloadSelectedBtn.disabled = state.selectedItems.size === 0;
    elements.deleteSelectedBtn.disabled = state.selectedItems.size === 0;

    // Update button text
    elements.selectAllBtn.textContent =
        state.selectedItems.size === state.filteredItems.length && state.filteredItems.length > 0
            ? 'Deselect All'
            : 'Select All';

    // Update card states
    document.querySelectorAll('.media-card').forEach(card => {
        const id = card.dataset.id;
        const checkbox = card.querySelector('.media-checkbox');
        if (state.selectedItems.has(id)) {
            card.classList.add('selected');
            checkbox.setAttribute('aria-checked', 'true');
        } else {
            card.classList.remove('selected');
            checkbox.setAttribute('aria-checked', 'false');
        }
    });
}

// ===========================
// Download Functions
// ===========================
async function downloadMedia(item) {
    try {
        let url;

        if (item.downloadURL) {
            // Cloud item - fetch from Firebase Storage
            const response = await fetch(item.downloadURL);
            const blob = await response.blob();
            url = URL.createObjectURL(blob);
        } else if (item.blob) {
            // Local item fallback
            const blob = item.blob instanceof Blob ? item.blob : new Blob([item.blob], { type: item.mimeType });
            url = URL.createObjectURL(blob);
        } else {
            console.error('No download source available for:', item.name);
            return;
        }

        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error('Download failed:', error);
    }
}

function downloadSelected() {
    const selectedItems = state.mediaItems.filter(item => state.selectedItems.has(item.id));

    selectedItems.forEach((item, index) => {
        // Stagger downloads to avoid browser blocking
        setTimeout(() => downloadMedia(item), index * 200);
    });
}

async function deleteSelected() {
    const selectedItems = state.mediaItems.filter(item => state.selectedItems.has(item.id));

    if (selectedItems.length === 0) return;

    // Confirm deletion
    const confirmMsg = `Are you sure you want to delete ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}? This cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    showToast(`Deleting ${selectedItems.length} items...`, true);
    let deleted = 0;

    for (const item of selectedItems) {
        try {
            // Delete from Firebase (Storage + Firestore)
            await deleteMediaFromCloud(item);

            // Delete from local IndexedDB
            await deleteMediaFromDB(item.id);

            // Remove from state
            state.mediaItems = state.mediaItems.filter(m => m.id !== item.id);
            state.selectedItems.delete(item.id);

            deleted++;
            updateToastProgress((deleted / selectedItems.length) * 100);
            console.log(`🗑️ Deleted: ${item.name}`);
        } catch (error) {
            console.error('Error deleting file:', item.name, error);
        }
    }

    hideToast(true);
    updateGallery();
    updateMediaCount();
    updateSelectionUI();
}

// ===========================
// Lightbox Functions
// ===========================
function openLightbox(index) {
    state.lightboxIndex = index;
    const item = state.filteredItems[index];

    if (!item) return;

    // Show lightbox
    elements.lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Update content
    updateLightboxContent(item);

    // Update navigation visibility
    updateLightboxNav();
}

function updateLightboxContent(item) {
    const isVideo = item.type === 'video';

    // Hide both first
    elements.lightboxImage.classList.add('hidden');
    elements.lightboxVideo.classList.add('hidden');

    // Prefer downloadURL (cloud) over local blob
    let src;
    if (item.downloadURL) {
        src = item.downloadURL;
    } else if (item.blob) {
        const blob = item.blob instanceof Blob ? item.blob : new Blob([item.blob], { type: item.mimeType });
        src = URL.createObjectURL(blob);
    } else if (item.thumbnail) {
        // Fallback to thumbnail if no other source
        src = item.thumbnail;
    }

    if (isVideo) {
        elements.lightboxVideo.src = src;
        elements.lightboxVideo.classList.remove('hidden');
    } else {
        elements.lightboxImage.src = src;
        elements.lightboxImage.classList.remove('hidden');
    }

    elements.lightboxFilename.textContent = item.name;

    // Auto-selection for AI Caption removed to prevent blocking UX
    // User must explicitly click "Use for AI Caption" on the card
}

function updateLightboxNav() {
    elements.lightboxPrev.style.visibility = state.lightboxIndex > 0 ? 'visible' : 'hidden';
    elements.lightboxNext.style.visibility =
        state.lightboxIndex < state.filteredItems.length - 1 ? 'visible' : 'hidden';
}

function navigateLightbox(direction) {
    const newIndex = state.lightboxIndex + direction;

    if (newIndex >= 0 && newIndex < state.filteredItems.length) {
        // Clean up previous video
        if (elements.lightboxVideo.src) {
            URL.revokeObjectURL(elements.lightboxVideo.src);
            elements.lightboxVideo.pause();
        }

        state.lightboxIndex = newIndex;
        updateLightboxContent(state.filteredItems[newIndex]);
        updateLightboxNav();
    }
}

function closeLightbox() {
    elements.lightbox.classList.add('hidden');
    document.body.style.overflow = '';

    // Clean up media sources
    if (elements.lightboxVideo.src) {
        URL.revokeObjectURL(elements.lightboxVideo.src);
        elements.lightboxVideo.pause();
        elements.lightboxVideo.src = '';
    }
    if (elements.lightboxImage.src) {
        URL.revokeObjectURL(elements.lightboxImage.src);
        elements.lightboxImage.src = '';
    }

    state.lightboxIndex = -1;
}

// ===========================
// Toast Functions
// ===========================
function showToast(message, showProgress = false) {
    elements.toastText.textContent = message;
    elements.toastProgress.style.width = '0%';
    elements.uploadToast.classList.remove('hidden', 'toast-success', 'toast-error');

    if (!showProgress) {
        elements.toastProgress.style.display = 'none';
    } else {
        elements.toastProgress.style.display = 'block';
    }
}

function updateToastProgress(percent) {
    elements.toastProgress.style.width = `${percent}%`;
}

function hideToast(success = true) {
    elements.toastText.textContent = success ? 'Upload complete!' : 'Upload failed';
    elements.uploadToast.classList.add(success ? 'toast-success' : 'toast-error');
    elements.toastProgress.style.width = '100%';

    setTimeout(() => {
        elements.uploadToast.classList.add('hidden');
    }, 2000);
}

// ===========================
// Caption Generator
// ===========================
const captionData = {
    vibes: [
        "Another day in paradise 🌴☀️",
        "Living our best life poolside 💦",
        "This is what dreams are made of ✨",
        "Sun's out, fun's out 🌞",
        "Making memories that last forever 🌅",
        "The only place we want to be 🏝️"
    ],
    team: [
        "The crew that makes it happen 💪",
        "Behind every great day is a great team 🙌",
        "Working hard, playing harder 🔥",
        "This is the energy we bring every day ⚡",
        "Squad goals achieved 🎯",
        "The dream team in action 🌟"
    ],
    event: [
        "You had to be there 🎉",
        "Last night was legendary 🔥",
        "When the vibes hit different ✨",
        "This is what we do 🎶",
        "Unforgettable moments 📸",
        "The party never stops 🎊"
    ]
};

const hashtagBundles = {
    vibes: "#EncoreBeach #LasVegas #PoolParty #VegasPool #SummerVibes #PoolLife",
    team: "#EncoreBeach #TeamWork #VegasLife #BehindTheScenes #PoolCrew #LasVegas",
    event: "#EncoreBeach #LasVegas #VegasNights #PoolParty #NightLife #VegasEvents"
};

let currentCaptionCategory = 'vibes';

function renderCaptions(category) {
    currentCaptionCategory = category;
    const captions = captionData[category] || [];

    elements.captionList.innerHTML = captions.map(caption => `
        <div class="caption-item">
            <span class="caption-text">${caption}</span>
            <button class="copy-caption-btn" data-caption="${caption.replace(/"/g, '&quot;')}" title="Copy caption">
                <svg viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
                </svg>
            </button>
        </div>
    `).join('');

    // Update hashtags
    elements.hashtagBundle.textContent = hashtagBundles[category] || hashtagBundles.vibes;

    // Add click listeners to copy buttons
    elements.captionList.querySelectorAll('.copy-caption-btn').forEach(btn => {
        btn.addEventListener('click', () => copyCaption(btn));
    });
}

function copyCaption(btn) {
    const caption = btn.dataset.caption;
    navigator.clipboard.writeText(caption).then(() => {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1500);
    });
}

function copyHashtags() {
    const hashtags = elements.hashtagBundle.textContent;
    navigator.clipboard.writeText(hashtags).then(() => {
        elements.copyHashtagsBtn.classList.add('copied');
        elements.copyHashtagsBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Copied!
        `;
        setTimeout(() => {
            elements.copyHashtagsBtn.classList.remove('copied');
            elements.copyHashtagsBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
                </svg>
                Copy
            `;
        }, 1500);
    });
}

// ===========================
// AI Caption Functions
// ===========================

/**
 * Handle image selection for AI caption generation
 * Called when user selects an image in the gallery
 * @param {Object} item - The media item object with thumbnail and downloadURL
 */
function selectImageForCaption(item) {
    // Use thumbnail for AI (already base64, no CORS issues)
    // Use downloadURL or thumbnail for preview
    const previewSrc = item.downloadURL || item.thumbnail;
    const aiSrc = item.thumbnail; // Thumbnail is already base64!

    state.selectedImageForCaption = aiSrc;

    // Update UI preview
    elements.aiPreviewImage.src = previewSrc;
    elements.aiPreviewImage.classList.remove('hidden');
    elements.selectedImagePreview.classList.add('has-image');
    elements.selectedImagePreview.querySelector('.no-image-selected').classList.add('hidden');

    // Enable generate button
    elements.generateAiBtn.disabled = false;

    // Reset previous results
    elements.aiCaptionsContainer.classList.add('hidden');
    elements.aiCaptionsList.innerHTML = '';
}

/**
 * Handle Generate AI Caption button click
 */
async function handleGenerateAICaption() {
    if (!state.selectedImageForCaption) return;

    // Show loading state
    elements.generateAiBtn.disabled = true;
    elements.generateAiBtn.classList.add('loading');
    elements.generateAiBtn.querySelector('span').textContent = 'Generating...';

    elements.aiCaptionsContainer.classList.remove('hidden');
    elements.aiLoading.classList.remove('hidden');
    elements.aiCaptionsList.innerHTML = '';

    try {
        console.log('🤖 Asking Gemini to generate catchy captions...');
        const captions = await generateAICaptions(state.selectedImageForCaption);

        renderAICaptions(captions);

    } catch (error) {
        console.error('Failed to generate AI captions:', error);

        // Show error UI
        elements.aiCaptionsList.innerHTML = `
            <div class="ai-error">
                <p>Failed to generate captions. Please try again.</p>
                <div class="ai-error-detail">${error.message || 'Unknown error'}</div>
                <button class="ai-error-retry" onclick="document.getElementById('generate-ai-caption-btn').click()">
                    Retry
                </button>
            </div>
        `;
    } finally {
        // Reset loading state
        elements.generateAiBtn.disabled = false;
        elements.generateAiBtn.classList.remove('loading');
        elements.generateAiBtn.querySelector('span').textContent = 'Generate AI Caption';
        elements.aiLoading.classList.add('hidden');
    }
}

/**
 * Render generated captions to the UI
 */
function renderAICaptions(captions) {
    if (!captions || captions.length === 0) {
        elements.aiCaptionsList.innerHTML = '<div class="ai-error">No captions generated. Try a different image.</div>';
        return;
    }

    elements.aiCaptionsList.innerHTML = captions.map((item, index) => `
        <div class="ai-caption-item">
            <p class="ai-caption-text">${item.text}</p>
            <p class="ai-caption-hashtags">${item.hashtags}</p>
            
            <div class="ai-caption-actions">
                <button class="ai-copy-btn" onclick="copyAICaption(this, '${item.text.replace(/'/g, "\\'")}', 'text')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy Text
                </button>
                <button class="ai-copy-btn" onclick="copyAICaption(this, '${item.hashtags.replace(/'/g, "\\'")}', 'tags')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"></path>
                    </svg>
                    Copy Tags
                </button>
            </div>
        </div>
    `).join('');
}

// Make copy function globally available for onclick handlers
window.copyAICaption = function (btn, text, type) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.innerHTML;

        btn.classList.add('copied');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <path d="M20 6L9 17L4 12" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Copied!
        `;

        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = originalText;
        }, 1500);
    });
};

// ===========================
// Sidebar Functions
// ===========================
function toggleSidebar() {
    elements.toolsSidebar.classList.toggle('collapsed');

    // Adjust gallery padding
    if (elements.toolsSidebar.classList.contains('collapsed')) {
        document.querySelector('.gallery-section').style.paddingRight = 'var(--space-6)';
    } else {
        document.querySelector('.gallery-section').style.paddingRight = '';
    }
}

function toggleMobileSidebar() {
    elements.toolsSidebar.classList.toggle('open');
}

// ===========================
// Screen Transitions
// ===========================
function enterApp() {
    elements.homeScreen.classList.add('exiting');

    setTimeout(() => {
        elements.homeScreen.classList.add('hidden');
        elements.mainApp.classList.remove('hidden');
    }, 500);
}

// ===========================
// Event Listeners
// ===========================
function setupEventListeners() {
    // Enter app / screen transition
    elements.enterBtn.addEventListener('click', enterApp);

    // Sidebar toggles
    elements.sidebarToggle.addEventListener('click', toggleSidebar);
    elements.mobileSidebarToggle.addEventListener('click', toggleMobileSidebar);

    // Upload triggers
    elements.uploadBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => {
        processFiles(e.target.files);
        e.target.value = ''; // Reset for same file re-upload
    });

    // Drag and drop
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('dragover');
    });

    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('dragover');
    });

    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('dragover');
        processFiles(e.dataTransfer.files);
    });

    // Also allow drop on entire gallery area
    elements.mediaGrid.parentElement.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    elements.mediaGrid.parentElement.addEventListener('drop', (e) => {
        e.preventDefault();
        processFiles(e.dataTransfer.files);
    });

    // Selection
    elements.selectAllBtn.addEventListener('click', selectAll);
    elements.downloadSelectedBtn.addEventListener('click', downloadSelected);
    elements.deleteSelectedBtn.addEventListener('click', deleteSelected);

    // Filters
    elements.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentFilter = btn.dataset.filter;
            state.selectedItems.clear();
            updateGallery();
            updateSelectionUI();
        });
    });

    // Sort
    elements.sortSelect.addEventListener('change', (e) => {
        state.currentSort = e.target.value;
        updateGallery();
    });

    // Search
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.searchQuery = e.target.value;
            updateGallery();
        }, 300);
    });

    // Lightbox
    elements.lightboxClose.addEventListener('click', closeLightbox);
    elements.lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
    elements.lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
    elements.lightboxNext.addEventListener('click', () => navigateLightbox(1));
    elements.lightboxDownload.addEventListener('click', () => {
        if (state.lightboxIndex >= 0) {
            downloadMedia(state.filteredItems[state.lightboxIndex]);
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!elements.lightbox.classList.contains('hidden')) {
            switch (e.key) {
                case 'Escape':
                    closeLightbox();
                    break;
                case 'ArrowLeft':
                    navigateLightbox(-1);
                    break;
                case 'ArrowRight':
                    navigateLightbox(1);
                    break;
            }
        }
    });

    // Caption tab switching
    elements.captionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.captionTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderCaptions(tab.dataset.category);
        });
    });

    // Copy hashtags button
    elements.copyHashtagsBtn.addEventListener('click', copyHashtags);

    // AI Caption Generator
    if (elements.generateAiBtn) {
        elements.generateAiBtn.addEventListener('click', handleGenerateAICaption);
    }

    // Close mobile sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 &&
            elements.toolsSidebar.classList.contains('open') &&
            !elements.toolsSidebar.contains(e.target) &&
            !elements.mobileSidebarToggle.contains(e.target)) {
            elements.toolsSidebar.classList.remove('open');
        }
    });
}

// ===========================
// Sports Widget Logic
// ===========================
function initSportsWidget() {
    const toggleBtn = document.getElementById('toggle-sports-btn');
    const closeBtn = document.getElementById('close-sports-btn');
    const panel = document.getElementById('sports-panel');
    const content = document.getElementById('sports-content');
    const tabs = document.querySelectorAll('.league-tab');
    let currentLeague = 'eng.1';
    let autoRefreshInterval;

    if (!toggleBtn || !panel) {
        console.warn('Sports widget elements not found');
        return;
    }

    // Toggle Panel
    toggleBtn.addEventListener('click', () => {
        panel.classList.add('active');
        loadMatches(currentLeague);
        startAutoRefresh();
    });

    closeBtn.addEventListener('click', () => {
        panel.classList.remove('active');
        stopAutoRefresh();
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (panel.classList.contains('active') &&
            !panel.contains(e.target) &&
            !toggleBtn.contains(e.target)) {
            panel.classList.remove('active');
            stopAutoRefresh();
        }
    });

    // Validated League Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentLeague = tab.dataset.league;
            loadMatches(currentLeague);
        });
    });

    async function loadMatches(league) {
        content.innerHTML = `
            <div class="sports-loading">
                <div class="spinner"></div>
                <p>Loading live matches...</p>
            </div>
        `;

        const matches = await fetchLiveScores(league);
        renderMatches(matches);
    }

    function renderMatches(matches) {
        if (!matches || matches.length === 0) {
            content.innerHTML = `
                <div class="sports-loading">
                    <p>No matches scheduled today.</p>
                </div>
            `;
            return;
        }

        content.innerHTML = matches.map(match => `
            <div class="match-card">
                <div class="match-header">
                    <span class="match-league">${match.league}</span>
                    <div class="match-status ${match.isLive ? 'live' : ''}">
                        ${getMatchStatus(match)}
                    </div>
                </div>
                <div class="match-teams">
                    <div class="team-row">
                        <div class="team-info">
                            <img src="${match.homeTeam.logo}" class="team-logo" alt="${match.homeTeam.name}" onerror="this.src='placeholder.png'">
                            <span class="team-name">${match.homeTeam.name}</span>
                        </div>
                        <span class="team-score">${match.homeTeam.score}</span>
                    </div>
                    <div class="team-row">
                        <div class="team-info">
                            <img src="${match.awayTeam.logo}" class="team-logo" alt="${match.awayTeam.name}" onerror="this.src='placeholder.png'">
                            <span class="team-name">${match.awayTeam.name}</span>
                        </div>
                        <span class="team-score">${match.awayTeam.score}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function startAutoRefresh() {
        stopAutoRefresh();
        autoRefreshInterval = setInterval(() => {
            fetchLiveScores(currentLeague).then(renderMatches);
        }, 30000); // 30s refresh
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    }
}


// ===========================
// Initialization
// ===========================
async function init() {
    try {
        // Initialize local IndexedDB first (for offline fallback)
        await initDB();

        // Try to load from cloud first
        try {
            console.log('☁️ Loading media from cloud...');
            state.mediaItems = await loadMediaFromCloud();
            console.log(`☁️ Loaded ${state.mediaItems.length} items from cloud`);

            // Set up real-time sync for updates from other users
            setupRealtimeSync();
        } catch (cloudError) {
            console.warn('Cloud load failed, falling back to local storage:', cloudError);
            state.mediaItems = await loadMediaFromDB();
        }

        updateGallery();
        updateMediaCount();
        setupEventListeners();

        // Initialize captions
        renderCaptions('vibes');

        // Initialize Sports Widget
        initSportsWidget();

        console.log('🏖️ EBC Hub initialized with cloud sync!');
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Start the app
init();
