# CGG PowerFlow Web — Deployment & Installation Guide

> **For:** Comfac Global Group IT, Field Engineers, Maintenance Teams  
> **Scope:** How to install, host, and distribute the PowerFlow Web application

---

## Overview

CGG PowerFlow Web is a **static single-page application** (SPA). It requires:
- A modern web browser (Chrome, Edge, Safari, Firefox)
- Internet connection **for the first load only** (to download Pyodide ~50MB)
- After first load, it works **fully offline**

No backend server, no database, no Docker container required.

---

## Method 1: Open Local File (Quick Test)

**Best for:** Developers, quick testing on a laptop

```bash
cd /path/to/comfac-pandapower/docs/pf-web
# On Linux/macOS
python3 -m http.server 8080

# On Windows
python -m http.server 8080
```

Then open: `http://localhost:8080`

> ⚠️ **Do NOT open `index.html` directly as a file** (`file://`) — Pyodide requires a proper HTTP origin for WebAssembly security.

---

## Method 2: nginx / Apache (Production LAN)

**Best for:** Office LAN, field laptop as local server

### nginx

```nginx
server {
    listen 80;
    server_name powerflow.local;
    root /var/www/cgg-powerflow;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    # Cache static assets aggressively
    location ~* \.(js|css|json|csv)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Copy files
sudo mkdir -p /var/www/cgg-powerflow
sudo cp -r docs/pf-web/* /var/www/cgg-powerflow/

# Reload nginx
sudo nginx -s reload
```

### Apache

```apache
<VirtualHost *:80>
    ServerName powerflow.local
    DocumentRoot /var/www/cgg-powerflow
    
    <Directory /var/www/cgg-powerflow>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    <FilesMatch "\.(js|css|json|csv)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>
</VirtualHost>
```

---

## Method 3: GitHub Pages (Public/Internal)

**Best for:** Easy updates, zero server maintenance

1. Enable GitHub Pages on the `Comfac-Global-Group/pandapower` repo
2. Set source to `/docs` folder on `develop` branch
3. App will be live at:
   ```
   https://comfac-global-group.github.io/pandapower/pf-web/
   ```

**Advantages:**
- Free hosting
- Auto-deploys on push
- HTTPS included
- CDN-backed (fast globally)

**Disadvantages:**
- Publicly accessible (unless repo is private + Pages from private is enabled on GitHub Enterprise)
- For truly private hosting, use Method 2 (internal nginx) or Method 4

---

## Method 4: Forgejo Pages (Private — RECOMMENDED)

**Best for:** Internal CGG use, private, citfj-integrated

If citfj (Forgejo at `git.comfac-it.net`) supports Pages:

1. Go to repo settings → Pages
2. Set source to `/docs/pf-web` on `develop` branch
3. URL: `https://git.comfac-it.net/cgg/comfac-pandapower/pages`

**If Forgejo Pages is NOT available:** Use Method 2 (nginx on PC03 or any internal server).

---

## Method 5: PWA Install on Phone/Tablet

**Best for:** Field engineers who need offline access

### Android (Chrome)
1. Open the app URL in Chrome
2. Tap **⋮ → "Add to Home screen"**
3. Confirm install
4. App icon appears on home screen — launches full-screen, no browser chrome

### iOS (Safari)
1. Open the app URL in Safari
2. Tap **Share → "Add to Home Screen"**
3. Confirm

### Offline Behavior
- **First launch:** Downloads Pyodide + packages (~50MB). Show progress bar.
- **Subsequent launches:** Loads from browser cache instantly.
- **No internet required** after first load.

---

## Method 6: Tauri Desktop App (Future)

**Best for:** No runtime download, full file system access

Planned for Phase 2. Will package Python + pandapower inside a native desktop wrapper.

See `CGG_PANDAPOWER_FIELD_MANUAL.md` §7.2 for architecture details.

---

## Network Requirements

| Resource | Size | Required For |
|----------|------|--------------|
| `pyodide.js` runtime | ~25 MB | First load only |
| `numpy` + `pandas` + `scipy` + `networkx` wheels | ~20 MB | First load only |
| `pandapower` wheel | ~5 MB | First load only |
| App files (HTML/JS/CSS) | ~150 KB | Every load (cached) |
| **Total first load** | **~50 MB** | **One time** |

**Bandwidth tip:** If field engineers have limited mobile data, pre-install on a shared office tablet/laptop using office Wi-Fi, then distribute the device.

---

## Distribution Strategy for Field Teams

### Option A: Shared Field Tablet
- 1 ruggedized tablet (Samsung Galaxy Tab Active or similar)
- Pre-loaded with CGG PowerFlow PWA
- Stored in substation/tool crib
- Engineers check out for site visits

### Option B: Personal Phone Install
- Engineer opens URL on office Wi-Fi
- Taps "Add to Home Screen"
- App now works offline on their personal phone
- **Risk:** Personal device, no corporate control

### Option C: Company-Issued Phones
- IT pushes PWA to managed devices via MDM
- URL pre-configured, home screen icon deployed centrally
- **Recommended** for scale

---

## Update Process

Since it's a static web app, updates are automatic:

1. Developer pushes new code to `develop` branch
2. If using GitHub/Forgejo Pages → live in ~1 minute
3. If using nginx → `git pull` + `cp -r` on server
4. Users see new version on next page load (Ctrl+Shift+R to force refresh)

**Version checking:** Add `?v=1.2.3` to asset URLs for cache-busting on major updates.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Python runtime not ready" | Pyodide still loading | Wait 30–60 seconds, reload |
| "Power flow failed" | Isolated bus or bad data | Run diagnostic, check all buses connected |
| Blank page | Opened as `file://` | Use `python -m http.server` or nginx |
| Slow on old phone | WebAssembly performance | Limit network to < 50 buses |
| App won't install as PWA | Missing HTTPS | Serve over HTTPS or localhost |

---

## Quick Reference

```bash
# Fastest way to run locally
cd docs/pf-web && python3 -m http.server 8080

# Open in browser
# http://localhost:8080
```

*Last updated: 2026-05-09 | For support, contact CGG IT via citfj*
