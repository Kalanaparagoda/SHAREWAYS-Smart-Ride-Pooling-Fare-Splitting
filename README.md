# CommuteShare SL 🚗🇱🇰

**Sri Lanka's smart carpooling platform** — inspired by BlaBlaCar and QuickRide.  
Share rides, split fuel costs, and travel smarter across Sri Lanka.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Firebase Admin SDK |
| Database | Firebase Firestore |
| Auth | Firebase Authentication (Email/Password) |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 |

---

## Project Structure

```
commuteshare-sl/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── firebase_admin_setup.py  # Firebase Admin SDK init
│   ├── requirements.txt
│   ├── .env.example
│   ├── serviceAccountKey.json   # ← Place your key here (not committed)
│   └── routers/
│       ├── auth.py              # Token verification, profile CRUD
│       ├── rides.py             # Ride offer CRUD + search
│       └── bookings.py          # Seat booking with transactions
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── .env.example             # ← Copy to .env and fill Firebase config
    └── src/
        ├── App.jsx              # Router (/, /offer, /login, /register, /forgot-password)
        ├── firebase.js          # Firebase client SDK (auth only)
        ├── api.js               # Axios client
        ├── contexts/
        │   └── AuthContext.jsx  # Auth state + helpers
        ├── pages/
        │   ├── SearchRide.jsx   # / — Find a ride
        │   ├── OfferRide.jsx    # /offer — Offer a ride (protected)
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   └── ForgotPassword.jsx
        └── components/
            ├── Navbar.jsx
            ├── RideCard.jsx
            ├── FuelCalculator.jsx
            └── ProtectedRoute.jsx
```

---

## Setup Guide

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Enable **Authentication → Email/Password** sign-in method.
3. Enable **Firestore Database** (start in test mode for development).
4. Download the **Service Account Key**:
   - Project Settings → Service Accounts → Generate new private key
   - Save as `backend/serviceAccountKey.json`
5. Get your **Web App Config**:
   - Project Settings → Your Apps → Add Web App
   - Copy the config object values

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Copy env file
copy .env.example .env
# Edit .env if needed (defaults work for local dev)

# Start the server
uvicorn main:app --reload
```

Backend runs at: **http://localhost:8000**  
API docs at: **http://localhost:8000/docs**

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy and fill in Firebase config
copy .env.example .env
# Edit .env with your Firebase web app config values

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## Features

### 🔍 Find a Ride (`/`)
- Select origin & destination from 30 Sri Lankan cities
- Date picker + passenger count filter
- Live search results with real-time seat availability
- One-click booking with seat selector
- Shows cost per seat and total cost before booking

### 🚗 Offer a Ride (`/offer`) — *Requires login*
- Pick departure & destination cities
- Set date, time, vehicle description
- Available seat stepper (1–8)
- **Fuel Cost Calculator** — two modes:
  - **Direct entry**: total fuel cost ÷ seats
  - **By distance**: km × consumption × LKR/L ÷ seats
- Optional notes for passengers

### 🔐 Authentication
- Email & password registration with display name
- Secure login with show/hide password
- **Forgot Password** — sends Firebase reset email
- Password strength indicator on registration
- Protected routes redirect to login

---

## Firestore Collections

| Collection | Purpose |
|---|---|
| `users` | User profile (display_name, phone) |
| `rides` | Ride offers with seat tracking |
| `bookings` | Booking records with status |

### Recommended Firestore Indexes

Create a composite index for ride search performance:
- Collection: `rides` — Fields: `date ASC`, `departure_time ASC`

---

## Environment Variables

### Backend (`backend/.env`)
```env
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=serviceAccountKey.json
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=http://localhost:8000
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | — | Health check |
| `POST` | `/api/auth/verify-token` | ✅ | Verify Firebase token |
| `GET` | `/api/auth/profile` | ✅ | Get user profile |
| `PUT` | `/api/auth/profile` | ✅ | Update user profile |
| `POST` | `/api/rides` | ✅ | Create ride offer |
| `GET` | `/api/rides/search` | — | Search rides |
| `GET` | `/api/rides/my` | ✅ | Get own rides |
| `GET` | `/api/rides/{id}` | — | Get ride details |
| `DELETE` | `/api/rides/{id}` | ✅ | Delete own ride |
| `POST` | `/api/bookings` | ✅ | Book a seat |
| `GET` | `/api/bookings/my` | ✅ | Get own bookings |
| `DELETE` | `/api/bookings/{id}` | ✅ | Cancel booking |

---

## Notes

- **No ID verification** — registration only requires name, email, and password.
- **Transactional bookings** — Firestore transactions prevent overbooking when multiple users book simultaneously.
- **Fuel calculator** defaults to LKR 317/L (Octane 92, Sri Lanka 2024). Editable in the Advanced mode.
- `serviceAccountKey.json` is gitignored — never commit it to source control.
