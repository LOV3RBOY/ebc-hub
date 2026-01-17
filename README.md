# 🏖️ EBC Hub - Encore Beach Collective Media Center

> A sleek, dark-themed media sharing hub for the Encore Beach Collective team.

[![Live Site](https://img.shields.io/badge/Live-lov3rboy.github.io%2Febc--hub-blue?style=for-the-badge)](https://lov3rboy.github.io/ebc-hub/)
[![GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-222?style=for-the-badge&logo=github)](https://github.com/LOV3RBOY/ebc-hub)

---

## 🎯 What Is This?

**EBC Hub** is a private media sharing platform built for the Encore Beach Collective team. It provides a beautiful, branded interface for uploading, organizing, and downloading photos and videos from team events and productions.

### Live URL
🌐 **[https://lov3rboy.github.io/ebc-hub/](https://lov3rboy.github.io/ebc-hub/)**

---

## ✨ Features

### 🎨 Entry Experience
- **Custom "Encore Beach" Branding** - Retro typography splash screen
- Responsive design (desktop/mobile splash images)
- Smooth fade transition into the main gallery

### 📸 Media Gallery
- **Dark-themed UI** with electric blue accents
- Grid-based media display with hover effects
- Filter by: All / Photos / Videos
- Media counter in header

### ⬆️ Upload System
- Drag & drop file upload
- Click to browse files
- Supports photos and videos
- **☁️ Cloud storage** - syncs across all team devices

### ⬇️ Download Options
- Download individual selected items
- "Select All" for batch downloads
- Counter shows selected item count
- **Real-time sync** - see uploads from teammates instantly

### 🛠️ Tools Sidebar
- Collapsible sidebar panel
- Upload, Download, and Filter sections
- Mobile-responsive overlay

---

## 🏗️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (ES Modules) |
| **Styling** | Custom CSS with CSS Variables |
| **Cloud Storage** | Firebase Storage (files) + Firestore (metadata) |
| **Local Fallback** | IndexedDB |
| **Hosting** | GitHub Pages |
| **Version Control** | Git/GitHub |

No frameworks, no build tools - uses Firebase CDN modules for cloud storage with vanilla web technologies.

---

## 📁 Project Structure

```
ebc-hub/
├── index.html          # Main application (entry screen + gallery)
├── styles.css          # All styling (entry, gallery, responsive)
├── app.js              # Application logic (upload, gallery, transitions)
├── README.md           # This file
├── PROJECT_DOCS.md     # Detailed development documentation
├── assets/
│   ├── splash-desktop.jpg   # Desktop entry image (1200x800)
│   └── splash-mobile.jpg    # Mobile entry image (600x800)
└── .gitignore          # Git ignore rules
```

---

## 🚀 Quick Start

### View Live
Just visit: **[https://lov3rboy.github.io/ebc-hub/](https://lov3rboy.github.io/ebc-hub/)**

### Run Locally
```bash
# Clone the repo
git clone https://github.com/LOV3RBOY/ebc-hub.git
cd ebc-hub

# Serve locally (any static server works)
npx serve . -p 3000

# Open in browser
open http://localhost:3000
```

---

## 🔮 Future Enhancements

Potential features for future development:
- [ ] Backend storage (Firebase/Supabase) for persistent media
- [ ] User authentication
- [ ] Album/folder organization
- [ ] Image compression on upload
- [ ] Lightbox/fullscreen media viewer
- [ ] Share links for specific albums
- [ ] Admin panel for managing content

---

## 👥 Team

Built for the **Encore Beach Collective** team.

---

## 📄 License

Private project - All rights reserved.
