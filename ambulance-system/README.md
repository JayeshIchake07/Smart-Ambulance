# 🚑 RapidAid — Smart Ambulance Dispatch System

A full-stack real-time ambulance dispatch system with 3 apps and 1 shared backend.

---

## 📁 Project Structure

```
ambulance-system/
├── backend/          ← Node.js + Express + MongoDB + Socket.io
├── victim-app/       ← Expo React Native (dark theme)
├── driver-app/       ← Expo React Native (dark theme)
└── hospital-app/     ← React Web Dashboard (light theme)
```

---

## 🚀 Setup Order

### Step 1 — Backend

```bash
cd backend
npm install
# Start MongoDB first (make sure it's running on port 27017)
npm run seed        # Seeds 5 ambulances, 4 hospitals, 4 test users
npm run dev         # Starts server on port 5000
```

**Test accounts (all password: `123456`)**
| Role | Email |
|------|-------|
| Victim | victim@test.com |
| Driver 1 | driver1@test.com |
| Driver 2 | driver2@test.com |
| Hospital | hospital@test.com |

**Test APIs with Thunder Client:**
- `GET http://localhost:5000/` → health check
- `POST http://localhost:5000/api/auth/login` → `{ "email": "victim@test.com", "password": "123456" }`
- `GET http://localhost:5000/api/ambulance` → list all ambulances
- `GET http://localhost:5000/api/hospital` → list all hospitals

---

### Step 2 — Victim App

```bash
cd victim-app
npm install --legacy-peer-deps
```

**⚠️ IMPORTANT — Set your IP address:**
Edit `src/services/api.js` line 1:
```js
export const BASE_URL = 'http://YOUR_PC_IP:5000';
// Windows: run `ipconfig` to find IPv4 Address
// Mac/Linux: run `ifconfig`
// Android emulator: use 10.0.2.2
// Web browser: use localhost
```

```bash
npx expo start
# Press 'a' for Android, 'i' for iOS, 'w' for web
```

---

### Step 3 — Driver App

```bash
cd driver-app
npm install --legacy-peer-deps
```

Same IP address change in `src/services/api.js`

```bash
npx expo start
# Login with driver1@test.com or driver2@test.com / 123456
```

---

### Step 4 — Hospital App

```bash
cd hospital-app
npm install
npm start
# Opens at http://localhost:3000
# Auto-logs in with hospital@test.com / 123456
```

---

## 🔄 Full End-to-End Test Flow

1. **Start backend** → run seed → verify health check
2. **Open Hospital Dashboard** in browser (localhost:3000)
3. **Open Driver App** → login as driver1@test.com → go online
4. **Open Victim App** → press SOS → select emergency type → Send Help Now
5. Watch what happens:
   - Driver app gets full-screen alert with 30s countdown
   - Driver accepts → victim sees "Ambulance is coming" + ETA
   - Ambulance marker moves on victim's map every 3 seconds (simulated)
   - Hospital dashboard shows incoming emergency card
   - Driver taps "Patient Picked Up" → hospital card updates
   - Hospital taps "Mark Ready" → driver gets notified
   - Driver taps "Patient Delivered" → victim goes to Completed screen ✅

---

## 🏗️ Architecture Diagram

```
Victim App ──── POST /api/dispatch ────► Backend (Express)
                                              │
                                         MongoDB saves Emergency
                                              │
                                    ┌────────┴────────┐
                              Socket: new-emergency   hospital-alert
                                    │                      │
                              Driver App            Hospital Dashboard
                                    │
                         Driver accepts, moves
                                    │
                            Socket: driver-location (every 3s)
                                    │
                              Victim sees 🚑 move on map!
```

---

## ⚠️ Common Issues

| Problem | Fix |
|---------|-----|
| `Connection refused` on phone | Change `BASE_URL` to your PC's IPv4 address |
| `expo install --fix` breaks things | Never run this. Use exact versions in package.json |
| Map not loading | Check internet connection for CartoDB/OSM tiles |
| OSRM timeout | Falls back to straight-line route automatically |
| MongoDB not connecting | Make sure MongoDB service is running |
| Socket not connecting | Add `transports: ['websocket']` to socket options |

---

## 🌐 Deployment

| App | Platform | Command |
|-----|----------|---------|
| Backend | Render.com | Connect GitHub repo, set env vars |
| Hospital App | Vercel.com | `npm run build` → deploy `build/` folder |
| MongoDB | MongoDB Atlas | Create free M0 cluster, get connection string |

After deploying backend:
- Update `BASE_URL` in victim-app and driver-app to your Render URL
- Update `BASE_URL` in hospital-app to your Render URL

---

## 📱 AI Scoring Algorithm

Hospital selection uses weighted scoring:

| Factor | Weight | Logic |
|--------|--------|-------|
| Available Beds | 45 pts | beds/40 × 45 |
| Specialist Match | 35 pts | exact match: 35, general: 15, none: 0 |
| Distance (inverse) | 20 pts | (20-km)/20 × 20 |

Emergency → Specialist mapping:
- Cardiac/Stroke → `cardiac`/`neuro`
- Accident → `trauma`
- Injury → `ortho`
- Breathing/Unknown → `general`
