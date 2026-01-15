# 📋 EBC Hub - Project Documentation

> Detailed development documentation for the Encore Beach Collective Media Hub

**Last Updated:** January 15, 2026  
**Status:** ✅ Live & Functional  
**Live URL:** https://lov3rboy.github.io/ebc-hub/

---

## 📖 Table of Contents

1. [Project Overview](#project-overview)
2. [Development Timeline](#development-timeline)
3. [Architecture](#architecture)
4. [Component Breakdown](#component-breakdown)
5. [Styling System](#styling-system)
6. [State Management](#state-management)
7. [Deployment](#deployment)
8. [Known Issues & Limitations](#known-issues--limitations)
9. [Next Steps](#next-steps)

---

## 🎯 Project Overview

### Purpose
EBC Hub is a private media sharing platform designed for the Encore Beach Collective team to upload, organize, and share photos and videos from events and productions.

### Core Requirements
- ✅ Branded entry experience with "Encore Beach" identity
- ✅ Dark-themed, modern UI aesthetic
- ✅ Photo and video upload capability
- ✅ Gallery view with filtering
- ✅ Download functionality (individual & batch)
- ✅ Responsive design (desktop + mobile)
- ✅ No backend required (localStorage-based)

### Design Philosophy
- **Aesthetic First**: Premium look and feel with attention to visual details
- **Simplicity**: Vanilla HTML/CSS/JS - no frameworks, no build step
- **Performance**: Instant load times, smooth animations
- **Accessibility**: Clear visual hierarchy, intuitive interactions

---

## 📅 Development Timeline

### Session 1 - Initial Build
**Date:** January 15, 2026

#### What Was Built:
1. **Core Gallery Application**
   - Dark-themed media gallery interface
   - Tools sidebar with Upload/Download/Filter sections
   - Drag-and-drop file upload
   - localStorage-based media persistence
   - Filter tabs (All/Photos/Videos)
   - Selection system for batch downloads

2. **Entry Screen with Branding**
   - "Encore Beach" retro typography splash screen
   - Responsive images (desktop 1200x800 / mobile 600x800)
   - Clickable "ENTER" overlay button
   - Smooth fade transition to gallery

3. **Responsive Design**
   - Desktop: Full sidebar always visible
   - Tablet: Collapsible sidebar
   - Mobile: Overlay sidebar, touch-friendly

#### Commits:
```
65edb74 - Update entry screen with Encore Beach branding - responsive desktop/mobile images
3bfc761 - Initial implementation with dark theme gallery
```

---

## 🏗️ Architecture

### File Structure
```
ebc-hub/
├── index.html              # Single-page application
│   ├── Entry Screen        # Splash with branded image
│   └── Gallery App         # Main media center interface
├── styles.css              # All CSS (600+ lines)
│   ├── CSS Variables       # Design tokens
│   ├── Entry Screen        # Splash screen styles
│   ├── Layout              # Header, sidebar, gallery grid
│   ├── Components          # Cards, buttons, forms
│   └── Responsive          # Media queries
├── app.js                  # JavaScript logic
│   ├── State Management    # Media items, selections
│   ├── File Handling       # Upload, storage, retrieval
│   ├── UI Interactions     # Sidebar, filters, modals
│   └── Transitions         # Entry → Gallery animation
└── assets/
    ├── splash-desktop.jpg  # Entry image for wide screens
    └── splash-mobile.jpg   # Entry image for narrow screens
```

### Data Flow
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   File Input    │────▶│   localStorage  │────▶│   Gallery UI    │
│   (Upload)      │     │   (Persistence) │     │   (Display)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    Drag & Drop           Base64 Encoded          Grid Layout
    Click Browse          JSON Storage            Hover Effects
    File Validation       Auto-load on Init       Selection State
```

---

## 🧩 Component Breakdown

### 1. Entry Screen (`#entry-screen`)
```html
<div id="entry-screen">
  <picture>
    <source media="(max-width: 768px)" srcset="assets/splash-mobile.jpg">
    <img src="assets/splash-desktop.jpg" alt="Encore Beach">
  </picture>
  <button id="enter-btn">ENTER</button>
</div>
```
- Responsive `<picture>` element for device-appropriate images
- Absolutely positioned "ENTER" button overlay
- CSS transition on hide (opacity + pointer-events)

### 2. Header
- Logo/title on left
- Media counter badge on right ("Media X")
- Fixed position, blurred background

### 3. Sidebar (`#sidebar`)
- **Upload Section**: File input + drag zone
- **Download Section**: Download selected + Select All
- **Filter Section**: Tab buttons (All/Photos/Videos)
- Collapsible on tablet/mobile

### 4. Gallery Grid
- CSS Grid with auto-fill columns
- Minimum column width: 200px
- `object-fit: cover` for consistent thumbnails
- Hover state with scale + blue border glow

### 5. Media Cards
- Thumbnail image/video preview
- Checkbox for selection (top-right)
- Delete button (bottom-right, hover revealed)
- Type indicator badge (photo/video)

---

## 🎨 Styling System

### CSS Variables (Design Tokens)
```css
:root {
  /* Colors */
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-tertiary: #1a1a24;
  --accent-blue: #3b82f6;
  --accent-blue-glow: rgba(59, 130, 246, 0.3);
  --text-primary: #ffffff;
  --text-secondary: #a1a1aa;
  --border-color: #27272a;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}
```

### Key Visual Effects
- **Glassmorphism**: `backdrop-filter: blur(20px)` on header/sidebar
- **Glow effects**: Box-shadow with accent color on hover
- **Smooth transitions**: All interactive elements have transitions
- **Blue accent**: Electric blue (#3b82f6) as primary action color

### Responsive Breakpoints
```css
/* Tablet */
@media (max-width: 1024px) {
  /* Sidebar becomes collapsible */
}

/* Mobile */
@media (max-width: 768px) {
  /* Single column gallery, overlay sidebar */
}
```

---

## 💾 State Management

### localStorage Schema
```javascript
// Key: 'ebcMediaItems'
// Value: JSON array of media objects

[
  {
    "id": "1705334772123",      // Timestamp-based unique ID
    "name": "event-photo.jpg",  // Original filename
    "type": "image",            // "image" or "video"
    "data": "data:image/jpeg;base64,..." // Base64 encoded file
  },
  // ... more items
]
```

### Application State
```javascript
// In-memory state managed by app.js
let mediaItems = [];        // Array of media objects
let selectedItems = [];     // Array of selected item IDs
let currentFilter = 'all';  // 'all' | 'photos' | 'videos'
let sidebarOpen = false;    // Mobile sidebar state
```

### State Sync
- **Load**: `loadFromStorage()` on DOMContentLoaded
- **Save**: `saveToStorage()` after every add/delete operation
- **Render**: `renderGallery()` called after any state change

---

## 🚀 Deployment

### Hosting: GitHub Pages
- Repository: `LOV3RBOY/ebc-hub`
- Branch: `main`
- Auto-deploys on push to main

### Deployment Commands
```bash
# Stage all changes
git add -A

# Commit with descriptive message
git commit -m "Description of changes"

# Push to trigger deployment
git push origin main

# Deployment completes in ~1-2 minutes
```

### Verify Deployment
```bash
# Check build status
gh api repos/LOV3RBOY/ebc-hub/pages/builds --jq '.[-1].status'
# Should return: "built"
```

---

## ⚠️ Known Issues & Limitations

### Current Limitations
1. **localStorage Limits**: ~5-10MB limit depending on browser
   - Large files may fail to store
   - Workaround: Compress images before upload

2. **No Persistence Across Devices**: Data is browser-specific
   - Different browsers = different data
   - Clearing browser data = lost media

3. **No Authentication**: Anyone with the URL can access
   - Currently fine for team use
   - Would need backend for proper auth

4. **Base64 Storage**: Inefficient for large files
   - Increases storage size by ~33%
   - Affects load time with many files

### Browser Compatibility
- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ⚠️ IE11 (not supported)

---

## 🔮 Next Steps

### Phase 2 - Enhanced Storage (Priority: High)
- [ ] Integrate Firebase Storage or Supabase
- [ ] Real file uploads (not base64)
- [ ] Persistent across devices
- [ ] Larger file support

### Phase 3 - Organization (Priority: Medium)
- [ ] Albums/folders system
- [ ] Tags and search
- [ ] Date-based sorting
- [ ] Metadata display

### Phase 4 - User Experience (Priority: Medium)
- [ ] Lightbox viewer for images
- [ ] Video player with controls
- [ ] Image zoom and pan
- [ ] Slideshow mode

### Phase 5 - Collaboration (Priority: Low)
- [ ] User accounts
- [ ] Upload permissions
- [ ] Comment system
- [ ] Activity feed

---

## 🛠️ Development Commands

```bash
# Local development
npx serve . -p 3000

# Watch for changes (simple reload)
# Just refresh browser after file edits

# Check current branch
git branch

# View recent commits
git log -n 5 --oneline

# Create new feature branch
git checkout -b feature/new-feature

# Merge feature to main
git checkout main
git merge feature/new-feature
git push origin main
```

---

## 📞 Quick Reference

| Need | Command/Location |
|------|------------------|
| Live site | https://lov3rboy.github.io/ebc-hub/ |
| Repo | https://github.com/LOV3RBOY/ebc-hub |
| Entry screen | `index.html` → `#entry-screen` |
| Gallery styles | `styles.css` lines 1-300 |
| Entry styles | `styles.css` lines 300-450 |
| Upload logic | `app.js` → `handleFileUpload()` |
| Storage logic | `app.js` → `saveToStorage()` / `loadFromStorage()` |
| Entry images | `assets/splash-desktop.jpg`, `assets/splash-mobile.jpg` |

---

*Documentation created: January 15, 2026*
