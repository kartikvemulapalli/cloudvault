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
```

---

## 🌐 Deploying to Render (render.com)

You can easily host CloudVault on [Render](https://render.com) as a **Web Service**.

### Option 1: Standard Web Service Setup

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```
   *(Note: `.gitignore` automatically prevents uploading local databases and `node_modules`)*.

2. **Create a New Web Service on Render**:
   - Go to your [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Web Service**.
   - Connect your GitHub repository.
   - Configure the following settings:
     - **Name**: `cloudvault` (or your preferred name)
     - **Region**: Select the region nearest to you (e.g., Singapore, Frankfurt, Oregon)
     - **Branch**: `main`
     - **Runtime**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Instance Type**: `Free`

3. **Deploy**:
   - Click **Create Web Service**. Render will install dependencies, build SQLite for Linux, and start the server!
   - Your live URL will be: `https://cloudvault-xxxx.onrender.com`

---

### ⚠️ Important: Storage Persistence on Render

- **Render Free Tier (Ephemeral Storage)**:
  On the Free plan, Render Web Services spin down after 15 minutes of inactivity and restart when visited. Because the free tier file system is **ephemeral**, files uploaded to `./uploads` and SQLite data in `./data` will be reset whenever the service restarts or redeploys.
- **Render Persistent Disks (Permanent Storage)**:
  If you want all uploaded files and SQLite records to be permanently saved across restarts and deploys on Render:
  1. In your Render Web Service settings, go to the **Disks** section.
  2. Click **Add Disk**:
     - **Name**: `cloudvault-disk`
     - **Mount Path**: `/var/data`
     - **Size**: 1 GB (or more)
  3. Under **Environment Variables**, add:
     - `DATA_DIR` = `/var/data/data`
     - `UPLOADS_DIR` = `/var/data/uploads`
  The application is pre-configured to automatically use these paths!

