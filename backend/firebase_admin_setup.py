import firebase_admin
from firebase_admin import credentials, firestore, auth
from pathlib import Path
import os
from dotenv import load_dotenv
from typing import Optional, Tuple, Any

load_dotenv()

_app: Optional[Any] = None
_db: Optional[Any] = None


def initialize_firebase() -> Tuple[Any, Any]:
    """
    Initialize Firebase Admin SDK cleanly, handling re-initialization
    gracefully during hot-reloads or repeated calls.
    """
    global _app, _db
    if _app is not None and firebase_admin._apps:
        return _app, _db

    default_key = "serviceAccountKey.json"
    key_path_env = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH", default_key)
    key_path = Path(key_path_env)

    if key_path.is_absolute():
        resolved = key_path
    else:
        resolved = Path(__file__).parent / key_path

    if not firebase_admin._apps:
        if resolved.exists():
            cred = credentials.Certificate(str(resolved))
            _app = firebase_admin.initialize_app(cred)
        else:
            # Fallback to Application Default Credentials (ADC) for Cloud Run
            _app = firebase_admin.initialize_app()
    else:
        _app = firebase_admin.get_app()

    if _db is None:
        _db = firestore.client()

    return _app, _db


def get_db():
    """Retrieve the Firestore client instance."""
    if _db is None:
        initialize_firebase()
    return _db


def get_auth():
    """Retrieve the Firebase Auth module."""
    if not firebase_admin._apps:
        initialize_firebase()
    return auth
