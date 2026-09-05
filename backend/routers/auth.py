from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from firebase_admin import auth as firebase_auth
from firebase_admin_setup import get_db
import uuid
import os

router = APIRouter()


# --- Auth helpers ------------------------------------------------------------

def verify_token(authorization: str = Header(...)) -> dict:
    """Extract and verify Firebase ID token from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split("Bearer ")[1]
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


# --- Schemas ------------------------------------------------------------------

class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, min_length=2, max_length=80)
    phone: Optional[str] = None
    nic: Optional[str] = Field(None, max_length=12)
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    payment_card: Optional[dict] = None
    emergency_contact: Optional[dict] = None  # {name: str, phone: str, uid: str | None}


class VerifyTokenResponse(BaseModel):
    uid: str
    email: str
    display_name: Optional[str] = None
    email_verified: bool


class RatingRequest(BaseModel):
    booking_id: str
    rating: int  # 1-5


# --- Routes -------------------------------------------------------------------

@router.post("/verify-token", response_model=VerifyTokenResponse)
async def verify_user_token(user: dict = Depends(verify_token)):
    """Verify a Firebase ID token and return the decoded user info."""
    return VerifyTokenResponse(
        uid=user["uid"],
        email=user.get("email", ""),
        display_name=user.get("name"),
        email_verified=user.get("email_verified", False),
    )


@router.put("/profile")
async def update_profile(
    body: ProfileUpdateRequest,
    user: dict = Depends(verify_token),
):
    """Update the user's profile in Firestore."""
    db = get_db()
    user_ref = db.collection("users").document(user["uid"])

    update_data = {}
    if body.display_name:
        update_data["display_name"] = body.display_name
    if body.phone is not None:
        update_data["phone"] = body.phone
    if body.payment_card is not None:
        update_data["payment_card"] = body.payment_card
    if body.nic is not None:
        update_data["nic"] = body.nic
    if body.gender is not None:
        update_data["gender"] = body.gender
    if body.emergency_contact is not None:
        update_data["emergency_contact"] = body.emergency_contact

    # Set joined_at on first profile creation
    doc = user_ref.get()
    if not doc.exists or not (doc.to_dict() or {}).get("joined_at"):
        update_data["joined_at"] = datetime.utcnow().isoformat()

    if update_data:
        user_ref.set(update_data, merge=True)

    return {"message": "Profile updated successfully"}


@router.get("/profile")
async def get_profile(user: dict = Depends(verify_token)):
    """Get the authenticated user's Firestore profile."""
    db = get_db()
    doc = db.collection("users").document(user["uid"]).get()
    profile = doc.to_dict() or {}

    # Ensure joined_at is set
    if not profile.get("joined_at"):
        joined_at = datetime.utcnow().isoformat()
        db.collection("users").document(user["uid"]).set(
            {"joined_at": joined_at}, merge=True
        )
        profile["joined_at"] = joined_at

    return {
        "uid": user["uid"],
        "email": user.get("email", ""),
        "display_name": profile.get("display_name", user.get("name", "")),
        "phone": profile.get("phone", ""),
        "payment_card": profile.get("payment_card", None),
        "joined_at": profile.get("joined_at", ""),
        "average_rating": profile.get("average_rating", None),
        "total_ratings": profile.get("total_ratings", 0),
        "emergency_contact": profile.get("emergency_contact", None),
    }


@router.get("/profile/{uid}")
async def get_public_profile(uid: str):
    """
    Get a user's public read-only profile — name, join date, average rating.
    No authentication required.
    """
    db = get_db()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    profile = doc.to_dict() or {}
    return {
        "uid": uid,
        "display_name": profile.get("display_name", "ShareWays User"),
        "joined_at": profile.get("joined_at", ""),
        "average_rating": profile.get("average_rating", None),
        "total_ratings": profile.get("total_ratings", 0),
    }


@router.post("/rate/{target_uid}")
async def rate_user(
    target_uid: str,
    body: RatingRequest,
    user: dict = Depends(verify_token),
):
    """
    Rate another user (driver or passenger) after a completed ride.
    Updates the target's aggregate average_rating on their profile.
    """
    if not (1 <= body.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    db = get_db()

    # Verify the booking exists
    booking_ref = db.collection("bookings").document(body.booking_id)
    booking_snap = booking_ref.get()
    if not booking_snap.exists:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_snap.to_dict()
    is_passenger = booking.get("passenger_uid") == user["uid"]
    is_driver = booking.get("driver_uid") == user["uid"]

    if not is_passenger and not is_driver:
        raise HTTPException(status_code=403, detail="You can only rate rides you participated in")

    if is_passenger and booking.get("driver_uid") != target_uid:
        raise HTTPException(status_code=400, detail="Target UID does not match driver")
    
    if is_driver and booking.get("passenger_uid") != target_uid:
        raise HTTPException(status_code=400, detail="Target UID does not match passenger")

    # Check if already rated
    existing = list(
        db.collection("ratings")
        .where("booking_id", "==", body.booking_id)
        .where("rater_uid", "==", user["uid"])
        .limit(1)
        .stream()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You have already rated this ride")

    # Write rating document
    rating_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db.collection("ratings").document(rating_id).set({
        "id": rating_id,
        "booking_id": body.booking_id,
        "rater_uid": user["uid"],
        "target_uid": target_uid,
        "rating": body.rating,
        "created_at": now,
    })

    # Mark the booking as rated
    if is_passenger:
        booking_ref.update({"rated": True})
    else:
        booking_ref.update({"driver_rated": True})

    # Update target's aggregate rating
    target_ref = db.collection("users").document(target_uid)
    target_doc = target_ref.get()
    target_profile = (target_doc.to_dict() or {}) if target_doc.exists else {}

    current_total = target_profile.get("total_ratings", 0)
    current_avg = target_profile.get("average_rating") or 0.0

    new_total = current_total + 1
    new_avg = round(((current_avg * current_total) + body.rating) / new_total, 2)

    target_ref.set(
        {"average_rating": new_avg, "total_ratings": new_total},
        merge=True,
    )

    return {
        "status": "ok",
        "new_average": new_avg,
        "total_ratings": new_total,
    }


# ---------------------------------------------------------------------------
# FCM Token — store so backend can send push notifications
# ---------------------------------------------------------------------------

class FcmTokenRequest(BaseModel):
    token: str


@router.post("/profile/fcm-token")
async def store_fcm_token(body: FcmTokenRequest, user: dict = Depends(verify_token)):
    """Store the user's FCM registration token for push notifications."""
    db = get_db()
    db.collection("users").document(user["uid"]).set(
        {"fcm_token": body.token},
        merge=True,
    )
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# SOS Alert — notify emergency contact via FCM push notification
# ---------------------------------------------------------------------------

class SosAlertRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    message: Optional[str] = None


@router.post("/sos/alert")
async def trigger_sos(body: SosAlertRequest, user: dict = Depends(verify_token)):
    """
    Trigger an SOS alert.
    Sends a Firebase Cloud Messaging push notification to the user's emergency contact
    if they are a registered ShareWays user with an FCM token on file.
    """
    try:
        from firebase_admin import messaging as fcm_messaging
    except ImportError:
        raise HTTPException(status_code=500, detail="FCM messaging not available")

    db = get_db()

    # Load sender profile to get emergency contact
    sender_doc = db.collection("users").document(user["uid"]).get()
    sender = sender_doc.to_dict() or {}
    sender_name = sender.get("display_name") or user.get("name") or "A ShareWays User"

    emergency_contact = sender.get("emergency_contact")
    if not emergency_contact:
        raise HTTPException(
            status_code=400,
            detail="No emergency contact configured. Please add one in your Profile."
        )

    contact_uid = emergency_contact.get("uid")
    contact_name = emergency_contact.get("name", "Emergency Contact")

    # Build location URL if coordinates provided
    location_url = None
    if body.lat and body.lng:
        location_url = f"https://maps.google.com/?q={body.lat},{body.lng}"

    sos_message = body.message or f"{sender_name} has triggered an SOS alert!"
    if location_url:
        sos_message += f" Live location: {location_url}"

    # Log SOS in Firestore for audit trail
    sos_id = str(uuid.uuid4())
    db.collection("sos_alerts").document(sos_id).set({
        "id": sos_id,
        "sender_uid": user["uid"],
        "sender_name": sender_name,
        "contact_uid": contact_uid,
        "contact_info": emergency_contact,
        "lat": body.lat,
        "lng": body.lng,
        "message": sos_message,
        "location_url": location_url,
        "created_at": datetime.utcnow().isoformat(),
    })

    # If emergency contact is a ShareWays user with an FCM token, send push
    if contact_uid:
        contact_doc = db.collection("users").document(contact_uid).get()
        contact_profile = contact_doc.to_dict() or {} if contact_doc.exists else {}
        fcm_token = contact_profile.get("fcm_token")

        if fcm_token:
            try:
                message = fcm_messaging.Message(
                    notification=fcm_messaging.Notification(
                        title=f"🆘 SOS Alert from {sender_name}",
                        body=sos_message,
                    ),
                    data={
                        "type": "sos_alert",
                        "sender_uid": user["uid"],
                        "sender_name": sender_name,
                        "lat": str(body.lat or ""),
                        "lng": str(body.lng or ""),
                        "location_url": location_url or "",
                    },
                    token=fcm_token,
                )
                fcm_messaging.send(message)
            except Exception as fcm_err:
                # Don't fail the SOS if FCM send fails — still log it
                print(f"FCM send failed for SOS: {fcm_err}")

    # Also create an in-app notification for the contact
    if contact_uid:
        notif_id = str(uuid.uuid4())
        db.collection("notifications").document(notif_id).set({
            "id": notif_id,
            "recipient_uid": contact_uid,
            "type": "sos_alert",
            "title": f"🆘 SOS from {sender_name}",
            "message": sos_message,
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        })

    return {
        "status": "ok",
        "message": "SOS alert sent",
        "contact_notified": bool(contact_uid),
        "location_url": location_url,
    }


# ---------------------------------------------------------------------------
# Admin endpoints — role-gated
# ---------------------------------------------------------------------------

def _require_admin(user: dict):
    db = get_db()
    user_doc = db.collection("users").document(user["uid"]).get()
    profile = user_doc.to_dict() or {}
    if profile.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/admin/users")
async def admin_list_users(user: dict = Depends(verify_token)):
    """List all users (admin only)."""
    _require_admin(user)
    db = get_db()
    users = []
    for doc in db.collection("users").stream():
        u = doc.to_dict() or {}
        u["uid"] = doc.id
        u.pop("payment_card", None)  # strip sensitive fields
        users.append(u)
    return users


@router.put("/admin/users/{target_uid}/disable")
async def admin_disable_user(target_uid: str, user: dict = Depends(verify_token)):
    """Disable or re-enable a user account (admin only)."""
    _require_admin(user)
    db = get_db()
    target_doc = db.collection("users").document(target_uid).get()
    if not target_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    current = (target_doc.to_dict() or {}).get("disabled", False)
    db.collection("users").document(target_uid).update({"disabled": not current})
    return {"status": "ok", "disabled": not current}

class VerifyUserRequest(BaseModel):
    status: str  # 'verified' or 'rejected'

@router.put("/admin/users/{target_uid}/verify")
async def admin_verify_user(target_uid: str, body: VerifyUserRequest, user: dict = Depends(verify_token)):
    """Approve or reject a user's ID verification (admin only)."""
    _require_admin(user)
    if body.status not in ["verified", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    db = get_db()
    target_ref = db.collection("users").document(target_uid)
    target_doc = target_ref.get()
    if not target_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
        
    target_ref.update({"verification_status": body.status})
    return {"status": "ok", "verification_status": body.status}
