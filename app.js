/**
 * EBC Hub - Media Center Application
 * Full-featured media gallery with IndexedDB storage
 */

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
    currentFilter: 'all',
    currentSort: 'newest',
    searchQuery: '',
    lightboxIndex: -1,
    filteredItems: []
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

    // Download
    downloadSelectedBtn: document.getElementById('download-selected-btn'),
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
    lightboxEnhance: document.getElementById('lightbox-enhance'),

    // Enhance
    enhanceSelectedBtn: document.getElementById('enhance-selected-btn'),
    presetBtns: document.querySelectorAll('.preset-btn'),

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

    showToast('Uploading...', true);
    let processed = 0;

    for (const file of validFiles) {
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
                id: generateId(),
                name: file.name,
                type: isImage ? 'image' : 'video',
                mimeType: file.type,
                size: file.size,
                blob: file,
                thumbnail: thumbnail,
                date: Date.now()
            };

            await saveMediaToDB(mediaItem);
            state.mediaItems.push(mediaItem);

            processed++;
            updateToastProgress((processed / validFiles.length) * 100);
        } catch (error) {
            console.error('Error processing file:', file.name, error);
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
        <div class="media-checkbox" role="checkbox" aria-checked="${state.selectedItems.has(item.id)}">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <div class="media-overlay">
            <span class="media-filename">${item.name}</span>
            <span class="media-meta">${formatFileSize(item.size)}</span>
        </div>
    `;

    // Open lightbox on click
    card.addEventListener('click', (e) => {
        if (e.target.closest('.media-checkbox')) {
            e.stopPropagation();
            toggleSelection(item.id);
        } else {
            openLightbox(index);
        }
    });

    return card;
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

    // Update enhance button - only works on images
    const selectedImages = state.mediaItems.filter(item =>
        state.selectedItems.has(item.id) && item.type === 'image'
    );
    elements.enhanceSelectedBtn.disabled = selectedImages.length === 0;

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
function downloadMedia(item) {
    const blob = item.blob instanceof Blob ? item.blob : new Blob([item.blob], { type: item.mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadSelected() {
    const selectedItems = state.mediaItems.filter(item => state.selectedItems.has(item.id));

    selectedItems.forEach((item, index) => {
        // Stagger downloads to avoid browser blocking
        setTimeout(() => downloadMedia(item), index * 200);
    });
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

    if (isVideo) {
        const blob = item.blob instanceof Blob ? item.blob : new Blob([item.blob], { type: item.mimeType });
        elements.lightboxVideo.src = URL.createObjectURL(blob);
        elements.lightboxVideo.classList.remove('hidden');
    } else {
        const blob = item.blob instanceof Blob ? item.blob : new Blob([item.blob], { type: item.mimeType });
        elements.lightboxImage.src = URL.createObjectURL(blob);
        elements.lightboxImage.classList.remove('hidden');
    }

    elements.lightboxFilename.textContent = item.name;
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
// Enhancement Functions
// ===========================
async function enhanceImage(item, presetName = 'encore-vibes') {
    if (item.type !== 'image') return null;

    try {
        // Get the blob as data URL
        const blob = item.blob instanceof Blob ? item.blob : new Blob([item.blob], { type: item.mimeType });
        const dataUrl = await blobToDataUrl(blob);

        // Apply enhancement
        const enhancedDataUrl = await ImageEnhancer.applyPreset(dataUrl, presetName);

        // Convert back to blob
        const enhancedBlob = await dataUrlToBlob(enhancedDataUrl);

        return enhancedBlob;
    } catch (error) {
        console.error('Enhancement failed:', error);
        return null;
    }
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function dataUrlToBlob(dataUrl) {
    return new Promise((resolve) => {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        resolve(new Blob([u8arr], { type: mime }));
    });
}

async function enhanceSelectedImages(presetName = 'encore-vibes') {
    const selectedImages = state.mediaItems.filter(item =>
        state.selectedItems.has(item.id) && item.type === 'image'
    );

    if (selectedImages.length === 0) return;

    showToast(`Enhancing ${selectedImages.length} photo(s)...`, true);
    let processed = 0;

    for (const item of selectedImages) {
        const enhancedBlob = await enhanceImage(item, presetName);

        if (enhancedBlob) {
            // Update the item with enhanced version
            item.blob = enhancedBlob;
            item.enhanced = true;

            // Regenerate thumbnail
            item.thumbnail = await generateImageThumbnailFromBlob(enhancedBlob);

            // Update in database
            await saveMediaToDB(item);
        }

        processed++;
        updateToastProgress((processed / selectedImages.length) * 100);
    }

    hideToast(true);
    elements.toastText.textContent = 'Enhancement complete!';

    // Refresh gallery
    updateGallery();
}

async function generateImageThumbnailFromBlob(blob) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = elements.thumbnailCanvas;
            const ctx = canvas.getContext('2d');

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

            URL.revokeObjectURL(img.src);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = URL.createObjectURL(blob);
    });
}

async function enhanceLightboxImage(presetName = 'encore-vibes') {
    if (state.lightboxIndex < 0) return;

    const item = state.filteredItems[state.lightboxIndex];
    if (!item || item.type !== 'image') return;

    // Show processing state
    const enhanceBtn = elements.lightboxEnhance;
    const originalText = enhanceBtn.querySelector('span').textContent;
    enhanceBtn.classList.add('processing');
    enhanceBtn.querySelector('span').textContent = 'Processing...';

    try {
        const enhancedBlob = await enhanceImage(item, presetName);

        if (enhancedBlob) {
            // Update item
            item.blob = enhancedBlob;
            item.enhanced = true;
            item.thumbnail = await generateImageThumbnailFromBlob(enhancedBlob);
            await saveMediaToDB(item);

            // Update lightbox display
            elements.lightboxImage.src = URL.createObjectURL(enhancedBlob);

            // Refresh gallery in background
            updateGallery();

            enhanceBtn.querySelector('span').textContent = 'Enhanced! ✨';
            setTimeout(() => {
                enhanceBtn.querySelector('span').textContent = originalText;
            }, 2000);
        }
    } catch (error) {
        console.error('Lightbox enhancement failed:', error);
        enhanceBtn.querySelector('span').textContent = 'Failed';
        setTimeout(() => {
            enhanceBtn.querySelector('span').textContent = originalText;
        }, 2000);
    } finally {
        enhanceBtn.classList.remove('processing');
    }
}

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

    // Enhancement features
    elements.enhanceSelectedBtn.addEventListener('click', () => enhanceSelectedImages('encore-vibes'));

    // Preset buttons
    elements.presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (state.selectedItems.size > 0) {
                enhanceSelectedImages(preset);
            }
        });
    });

    // Lightbox enhance button
    elements.lightboxEnhance.addEventListener('click', () => enhanceLightboxImage('encore-vibes'));

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
// Initialization
// ===========================
async function init() {
    try {
        await initDB();
        state.mediaItems = await loadMediaFromDB();

        updateGallery();
        updateMediaCount();
        setupEventListeners();

        console.log('EBC Hub initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Start the app
init();
