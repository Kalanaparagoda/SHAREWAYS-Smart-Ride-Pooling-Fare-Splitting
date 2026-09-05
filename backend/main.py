import sys
from pathlib import Path

# Python Path එකට backend folder එක එකතු කිරීම (Import Errors විසඳීමට)
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402
import os  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

from firebase_admin_setup import initialize_firebase  # noqa: E402
from routers import auth, rides, bookings, notifications  # noqa: E402

# Rate limiting
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    limiter = Limiter(key_func=get_remote_address)
    RATE_LIMITING_ENABLED = True
except ImportError:
    limiter = None
    RATE_LIMITING_ENABLED = False
    print("[WARN] slowapi not installed — rate limiting disabled. Run: pip install slowapi")

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Firebase on startup
    initialize_firebase()
    print("[OK] Firebase Admin SDK initialized successfully")
    yield
    print("[INFO] Shutting down CommuteShare SL backend")


app = FastAPI(
    title="CommuteShare SL API",
    description="Carpooling platform API for Sri Lanka - powered by Firebase",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach rate limiter
if RATE_LIMITING_ENABLED:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    print("[OK] slowapi rate limiting enabled")

# CORS - allow frontend dev server and production URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000"
    ],
    allow_origin_regex=r"^https://.*\.web\.app$|^https://.*\.firebaseapp\.com$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(rides.router, prefix="/api/rides", tags=["Rides"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["Bookings"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])


@app.get("/", tags=["Health"])
async def health_check():
    return {
        "message": "SHAREWAYS Backend is Running Successfully!",
        "status": "ok",
        "service": "CommuteShare SL API",
        "version": "1.0.0",
    }


@app.get("/api/health", tags=["Health"])
async def api_health():
    return {"status": "ok", "firebase": "connected"}
