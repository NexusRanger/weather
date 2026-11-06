# Nailsworth & Stroud Ambient Weather & Stargazing Dashboard

A custom "10-foot UI" weather dashboard tailored for **GL5 5HH** (Nailsworth & Stroud, Cotswolds, UK), designed specifically for living room viewing on TVs, Nvidia Shield, or tablets.

---

## Features

- **Hyper-Local Forecast:** Live data for Nailsworth & Stroud from Open-Meteo UK Met model.
- **TV-Optimized Dark Mode ("10-Foot UI"):** High-contrast, large readable typography, deep space background with dynamic day/night ambient glow.
- **Astronomy & Stargazing:**
  - Real-time lunar phase calculation (illumination % and countdown to next lunar event).
  - Tonight's Cotswolds Stargazing Rating (evaluates cloud deck & moonlight interference).
  - Sun path: Sunrise, Sunset, countdown timer to dusk.
- **18-Hour Timeline:** Next 18 hours forecast with hourly temperatures, icons, and rain probability bars.
- **7-Day Outlook:** High/low temperature ranges with precipitation probabilities.
- **Auto-Sync:** Auto-refreshes data every 15 minutes silently without reloading the page.
- **Fullscreen Mode:** Press **`F`** on your keyboard or click the fullscreen icon.

---

## How to View on Your TV / Nvidia Shield

### Method 1: Using the Python Server (Easiest Local Setup)

1. Open a terminal or command prompt in this folder:
   ```powershell
   python serve.py
   ```
2. The server will output your local network address:
   ```text
   http://10.0.0.30:8080
   ```
3. On your **Nvidia Shield**:
   - Open **TV Bro** (free browser on the Shield Google Play Store) or any TV browser.
   - Type in `http://10.0.0.30:8080`.
   - Press the fullscreen button on your TV remote.
4. On your **Samsung TV**:
   - Open the built-in **Internet** app.
   - Type in `http://10.0.0.30:8080` and bookmark it!

---

### Method 2: Chromecast from Laptop to Nvidia Shield

1. Open `index.html` in Google Chrome or Microsoft Edge on your laptop.
2. Click the three dots menu (top right of browser) -> **Cast...**.
3. Select your **Nvidia Shield**.
4. The dashboard will instantly appear full-screen on your television!

---

### Method 3: 24/7 Always-On (Zero Laptop Required)

Because this dashboard is pure HTML/CSS/JavaScript and Open-Meteo requires no server backend, you can upload `index.html` to **GitHub Pages** (free).
* You get a permanent link (e.g. `https://yourname.github.io/weather`) that your Nvidia Shield or Samsung TV can load anytime, even when your laptop is turned off!
