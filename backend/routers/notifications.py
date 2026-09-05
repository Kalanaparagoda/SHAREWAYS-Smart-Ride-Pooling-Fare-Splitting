from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from firebase_admin_setup import get_db
from routers.auth import verify_token

router = APIRouter()

class NotificationResponse(BaseModel):
    id: str
    recipient_uid: str
    type: str
    title: str
    message: str
    read: bool
    created_at: str

@router.get("", response_model=List[NotificationResponse])
async def get_notifications(user: dict = Depends(verify_token)):
    """Fetch notifications for the current user."""
    db = get_db()
    docs = (
        db.collection("notifications")
        .where("recipient_uid", "==", user["uid"])
        .stream()
    )
    
    notifications = []
    for doc in docs:
        notifications.append(NotificationResponse(**doc.to_dict()))
        
    notifications.sort(key=lambda n: n.created_at, reverse=True)
    return notifications

@router.put("/{notif_id}/read", response_model=NotificationResponse)
async def mark_notification_read(notif_id: str, user: dict = Depends(verify_token)):
    """Mark a notification as read."""
    db = get_db()
    notif_ref = db.collection("notifications").document(notif_id)
    notif_snap = notif_ref.get()

    if not notif_snap.exists:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif = notif_snap.to_dict()
    if notif.get("recipient_uid") != user["uid"]:
        raise HTTPException(status_code=403, detail="Not your notification")

    notif_ref.update({"read": True})
    notif["read"] = True
    return NotificationResponse(**notif)
