# CloudVault ☁️

A private, self-hosted web application for storing text notes, images, and documents/files.

---

## ✨ Features

- **📝 Text & Notes Storage**:
  - Create, view, edit, search, and copy text snippets with word/character counters.
  - Download any text note directly as a `.txt` file.
  - One-click copy-to-clipboard button.

- **🖼️ Image Gallery & Lightbox**:
  - Drag-and-drop or file picker upload for all image formats (PNG, JPG, SVG, WebP, GIF, etc.).
  - Thumbnail gallery cards with file dimensions and formatted file sizes.
  - Full-resolution interactive Lightbox viewer with instant download.

- **📁 Documents & Files**:
  - Store PDFs, Office documents (Word, Excel, PPT), ZIP/RAR archives, code, audio, and video files up to 50MB.
  - Distinct file-type badges and original filename preservation.
  - Instant direct file downloads.

- **🔍 Search & Filter**:
  - Real-time search across note titles, text contents, and file names.
  - Filter tabs for All, Text/Notes, Images, and Files.
  - Switch between **Grid View** and **List View**.

- **🌓 Dark & Light Mode**:
  - Modern glassmorphic design system.
  - Automatic system preference detection and one-click toggle with saved state.

- **🔒 Private & Self-Contained**:
  - Uses embedded SQLite database (`data/cloudvault.db`) with zero external database setup required.
  - All files and uploads are stored locally on your machine in `uploads/`.

---

## 🚀 How to Run

1. Open your terminal in this directory:
   ```bash
   npm start
   ```

2. Open your web browser and visit:
   ```
   http://localhost:5000
   ```

### Production environment variables

Configure these variables in Render before deploying:

```text
NODE_ENV=production
JWT_SECRET=<a random secret at least 32 characters long>
DATA_DIR=/var/data
UPLOADS_DIR=/var/data/uploads
```

Mount a Render persistent disk at `/var/data`. Without a persistent disk, the
SQLite database and uploaded files can be lost when the service restarts.

---

## 📂 Project Structure

```
cloud project/
├── data/
│   └── cloudvault.db       # Embedded SQLite database
├── uploads/                # Local storage directory for uploaded files and photos
├── server/
│   ├── database.js         # SQLite database models & query helpers
│   └── server.js           # Express.js REST API and file server
├── public/
│   ├── index.html          # Web application user interface
│   ├── style.css           # Styling, themes, and animations
│   └── app.js              # Client-side reactivity, upload handlers, and modals
└── package.json            # Dependencies and scripts


