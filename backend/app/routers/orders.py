from fastapi import APIRouter, Depends, Form, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime, timedelta
import jwt
import requests
import json
import os
import secrets
from typing import List, Optional
from ..database import get_db, get_next_sequence_value
from ..schemas import OrderResponse

from ..services.file_service import save_file, get_file_response
from ..services.email_service import (
    send_order_notification_email,
    send_published_notification_email,
    send_payment_reminder_email
)
from ..config import settings

router = APIRouter(prefix="/api/orders", tags=["orders"])
security = HTTPBearer()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("user_id")
        email = payload.get("email")
        role = payload.get("role")
        if not user_id or not email or not role:
            raise HTTPException(status_code=401, detail="Invalid session payload")
        return {"id": user_id, "email": email, "role": role}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid session token")

def clean_doc(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc

def clean_docs(docs):
    for doc in docs:
        clean_doc(doc)
    return docs

@router.post("", response_model=OrderResponse)
async def create_order(
    background_tasks: BackgroundTasks,
    db: any = Depends(get_db),
    current_user: dict = Depends(verify_jwt),
    dev_name: str = Form(...),
    dev_phone: str = Form(...),
    dev_email: str = Form(...),
    plan_selection: str = Form(...),
    app_title: str = Form(...),
    app_category: Optional[str] = Form(None),
    app_short_desc: Optional[str] = Form(None),
    app_long_desc: Optional[str] = Form(None),
    has_aso_addon: bool = Form(False),
    has_transfer_addon: bool = Form(False),
    privacy_link: Optional[str] = Form(None),
    total_price: int = Form(...),
    app_version: str = Form("1.0.0"),
    changelog: Optional[str] = Form(None),
    file_icon: Optional[UploadFile] = File(None),
    file_feature: Optional[UploadFile] = File(None),
    file_screenshots: Optional[List[UploadFile]] = File(None),
    file_aab: Optional[UploadFile] = File(None),
):
    """Creates a new order, saves uploaded files, and schedules an email notification."""
    # Find latest order of this app for the user to inherit descriptions/images if this is an update
    latest_app_order = None
    if plan_selection == "update":
        if not file_aab or not file_aab.filename:
            raise HTTPException(status_code=400, detail="يجب رفع حزمة التطبيق (AAB) الجديدة للترقية")
            
        latest_app_order = db.orders.find_one(
            {"user_id": current_user["id"], "app_title": app_title},
            sort=[("id", -1)]
        )
        
        if latest_app_order:
            app_category = latest_app_order.get("app_category")
            app_short_desc = latest_app_order.get("app_short_desc")
            app_long_desc = latest_app_order.get("app_long_desc")
    else:
        if not app_category or not app_short_desc or not app_long_desc:
            raise HTTPException(status_code=400, detail="جميع حقول الوصف والتصنيف مطلوبة للتطبيقات الجديدة")

    # 1. Create a database record first to obtain a unique order ID
    order_id = get_next_sequence_value("order_id")
    db_order = {
        "id": order_id,
        "user_id": current_user["id"],
        "dev_name": dev_name,
        "dev_phone": dev_phone,
        "dev_email": dev_email,
        "plan_selection": plan_selection,
        "app_title": app_title,
        "app_category": app_category or "",
        "app_short_desc": app_short_desc or "",
        "app_long_desc": app_long_desc or "",
        "has_aso_addon": has_aso_addon,
        "has_transfer_addon": has_transfer_addon,
        "privacy_link": privacy_link,
        "total_price": total_price,
        "app_version": app_version,
        "changelog": changelog,
        "icon_path": None,
        "feature_path": None,
        "screenshots_paths": [],
        "aab_path": None,
        "status": "pending",
        "published_at": None,
        "payment_deadline": None,
        "reminder_sent": False,
        "admin_notes": None,
        "created_at": datetime.utcnow()
    }
    db.orders.insert_one(db_order)

    # 3. Save uploaded files (or inherit if this is an update)
    icon_path = None
    if file_icon:
        icon_path = await save_file(file_icon, db_order["id"], "icon.png")
    elif plan_selection == "update" and latest_app_order:
        icon_path = latest_app_order.get("icon_path")
        
    feature_path = None
    if file_feature:
        feature_path = await save_file(file_feature, db_order["id"], "feature.png")
    elif plan_selection == "update" and latest_app_order:
        feature_path = latest_app_order.get("feature_path")
    
    screenshots_paths = []
    # Save multiple screenshots sequentially
    if file_screenshots:
        valid_shots = [s for s in file_screenshots if s.filename]
        for idx, file_shot in enumerate(valid_shots):
            path = await save_file(file_shot, db_order["id"], f"screenshot_{idx + 1}.png")
            if path:
                screenshots_paths.append(path)
                
    if plan_selection == "update" and len(screenshots_paths) == 0 and latest_app_order:
        try:
            shots = latest_app_order.get("screenshots_paths", [])
            if isinstance(shots, str):
                screenshots_paths = json.loads(shots)
            elif isinstance(shots, list):
                screenshots_paths = shots
        except Exception:
            screenshots_paths = []
            
    aab_path = await save_file(file_aab, db_order["id"], "app_bundle.aab" if file_aab else None)

    # 4. Update order with resolved storage paths
    db.orders.update_one(
        {"id": db_order["id"]},
        {"$set": {
            "icon_path": icon_path,
            "feature_path": feature_path,
            "screenshots_paths": screenshots_paths,
            "aab_path": aab_path
        }}
    )
    
    # Retrieve updated document
    db_order = db.orders.find_one({"id": db_order["id"]})

    # 5. Queue administrative email notification as background task
    order_dict = {
        "id": db_order["id"],
        "dev_name": db_order["dev_name"],
        "dev_phone": db_order["dev_phone"],
        "dev_email": db_order["dev_email"],
        "plan_selection": db_order["plan_selection"],
        "app_title": db_order["app_title"],
        "app_category": db_order["app_category"],
        "app_short_desc": db_order["app_short_desc"],
        "app_long_desc": db_order["app_long_desc"],
        "has_aso_addon": db_order["has_aso_addon"],
        "has_transfer_addon": db_order["has_transfer_addon"],
        "privacy_link": db_order["privacy_link"],
        "total_price": db_order["total_price"],
        "app_version": db_order["app_version"],
        "changelog": db_order["changelog"],
    }
    background_tasks.add_task(send_order_notification_email, order_dict)

    return clean_doc(db_order)

@router.get("", response_model=List[OrderResponse])
def list_orders(db: any = Depends(get_db), current_user: dict = Depends(verify_jwt)):
    """Returns a list of all publishing orders. Admin sees all, User sees only their own."""
    if current_user["role"] == "admin":
        orders_list = list(db.orders.find().sort("id", -1))
    else:
        orders_list = list(db.orders.find({"user_id": current_user["id"]}).sort("id", -1))
    return clean_docs(orders_list)

@router.get("/{order_id}", response_model=OrderResponse)
def get_order_details(order_id: int, db: any = Depends(get_db), current_user: dict = Depends(verify_jwt)):
    """Retrieves full details of a specific order by ID."""
    db_order = db.orders.find_one({"id": order_id})
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # User can only view their own order, admin can view all
    if current_user["role"] != "admin" and db_order.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this order")
        
    return clean_doc(db_order)

@router.get("/{order_id}/download/{file_key}")
def download_order_file(order_id: int, file_key: str, db: any = Depends(get_db), current_user: dict = Depends(verify_jwt)):
    """Downloads a specific file belonging to an order (file_key: 'icon', 'feature', 'aab', 'screenshot_X')."""
    db_order = db.orders.find_one({"id": order_id})
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # User can only access files for their own order, admin can view all
    if current_user["role"] != "admin" and db_order.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access files for this order")
        
    rel_path = None
    if file_key == "icon":
        rel_path = db_order.get("icon_path")
    elif file_key == "feature":
        rel_path = db_order.get("feature_path")
    elif file_key == "aab":
        rel_path = db_order.get("aab_path")
    elif file_key.startswith("screenshot_"):
        try:
            idx = int(file_key.split("_")[1]) - 1
            shots = db_order.get("screenshots_paths", [])
            if isinstance(shots, str):
                shots = json.loads(shots)
            if 0 <= idx < len(shots):
                rel_path = shots[idx]
        except Exception:
            pass
            
    if not rel_path:
        raise HTTPException(status_code=404, detail="الملف غير مسجل بقاعدة البيانات")
        
    return get_file_response(rel_path)


class GoogleLoginRequest(BaseModel):
    id_token: str

@router.post("/admin-login")
def admin_login(payload: GoogleLoginRequest, db: any = Depends(get_db)):
    """Authenticates or registers a user/admin with Firebase ID token."""
    id_token = payload.id_token
    try:
        # Call Google Identity Toolkit API to verify Firebase ID Token
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={settings.FIREBASE_API_KEY}"
        res = requests.post(url, json={"idToken": id_token}, timeout=10)
        if res.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Firebase ID Token")
            
        res_json = res.json()
        users = res_json.get("users", [])
        if not users:
            raise HTTPException(status_code=401, detail="User not found in token payload")
            
        user_info = users[0]
        email = user_info.get("email")
        name = user_info.get("displayName")
        
        if not email:
            raise HTTPException(status_code=401, detail="Email not provided in token payload")
            
        # Get or create user
        user = db.users.find_one({"email": email})
        if not user:
            role = "admin" if email == settings.NOTIFICATION_EMAIL else "user"
            user_id = get_next_sequence_value("user_id")
            user = {
                "id": user_id,
                "email": email,
                "name": name,
                "role": role,
                "created_at": datetime.utcnow()
            }
            db.users.insert_one(user)
            
        token = create_access_token({"user_id": user["id"], "email": user["email"], "role": user["role"]})
        return {"access_token": token, "token_type": "bearer", "role": user["role"]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Firebase auth verification failed: {str(e)}")


class StatusUpdateRequest(BaseModel):
    status: str

@router.put("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    payload: StatusUpdateRequest,
    background_tasks: BackgroundTasks,
    db: any = Depends(get_db),
    current_user: dict = Depends(verify_jwt)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can update order status")

    db_order = db.orders.find_one({"id": order_id})
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    new_status = payload.status
    if new_status not in ["pending", "published", "paid", "deleted"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    update_fields = {"status": new_status}
    if new_status == "published":
        published_at = datetime.utcnow()
        payment_deadline = published_at + timedelta(days=3)
        update_fields.update({
            "published_at": published_at,
            "payment_deadline": payment_deadline,
            "reminder_sent": False
        })
        
        # Trigger publish email in background
        order_dict = {
            "id": db_order["id"],
            "dev_name": db_order["dev_name"],
            "dev_phone": db_order["dev_phone"],
            "dev_email": db_order["dev_email"],
            "plan_selection": db_order["plan_selection"],
            "app_title": db_order["app_title"],
            "total_price": db_order["total_price"],
        }
        background_tasks.add_task(send_published_notification_email, order_dict)
        
    db.orders.update_one({"id": order_id}, {"$set": update_fields})
    db_order = db.orders.find_one({"id": order_id})
    return clean_doc(db_order)


class NotesUpdateRequest(BaseModel):
    notes: str

@router.put("/{order_id}/notes", response_model=OrderResponse)
def update_order_notes(
    order_id: int,
    payload: NotesUpdateRequest,
    db: any = Depends(get_db),
    current_user: dict = Depends(verify_jwt)
):
    """Updates the admin notes/feedback for a specific order."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can update notes")
        
    db_order = db.orders.find_one({"id": order_id})
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    db.orders.update_one({"id": order_id}, {"$set": {"admin_notes": payload.notes}})
    db_order = db.orders.find_one({"id": order_id})
    return clean_doc(db_order)

@router.delete("/{order_id}")
def delete_order(
    order_id: int,
    db: any = Depends(get_db),
    current_user: dict = Depends(verify_jwt)
):
    """Deletes an order permanently and cleans up its non-shared files."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can delete orders permanently")
        
    db_order = db.orders.find_one({"id": order_id})
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # Check if files are shared before deleting
    icon_shared = False
    icon_path = db_order.get("icon_path")
    if icon_path:
        icon_shared = db.orders.find_one({"id": {"$ne": order_id}, "icon_path": icon_path}) is not None
        
    feature_shared = False
    feature_path = db_order.get("feature_path")
    if feature_path:
        feature_shared = db.orders.find_one({"id": {"$ne": order_id}, "feature_path": feature_path}) is not None
        
    aab_shared = False
    aab_path = db_order.get("aab_path")
    if aab_path:
        aab_shared = db.orders.find_one({"id": {"$ne": order_id}, "aab_path": aab_path}) is not None
        
    screenshots_to_delete = []
    screenshots_paths = db_order.get("screenshots_paths", [])
    if screenshots_paths:
        try:
            shots = screenshots_paths
            if isinstance(shots, str):
                shots = json.loads(shots)
            if isinstance(shots, list):
                for shot in shots:
                    # check if any other order has this screenshot path in its screenshots_paths list
                    other_shot = db.orders.find_one({"id": {"$ne": order_id}, "screenshots_paths": shot}) is not None
                    if not other_shot:
                        screenshots_to_delete.append(shot)
        except Exception as e:
            print(f"[STORAGE ERROR] Failed to parse screenshots JSON for reference check: {e}")

    # Delete associated files from storage & R2 if not shared
    from ..services.file_service import delete_file
    if icon_path and not icon_shared:
        delete_file(icon_path)
    if feature_path and not feature_shared:
        delete_file(feature_path)
    if aab_path and not aab_shared:
        delete_file(aab_path)
        
    for shot in screenshots_to_delete:
        delete_file(shot)
        
    # Remove local order folder
    import shutil
    local_dir = os.path.join(settings.UPLOAD_DIR, f"order_{order_id}")
    if os.path.exists(local_dir) and os.path.isdir(local_dir):
        try:
            shutil.rmtree(local_dir)
            print(f"[STORAGE] Removed local order directory: {local_dir}")
        except Exception as e:
            print(f"[STORAGE ERROR] Failed to remove local directory {local_dir}: {e}")
            
    # Delete record from database
    db.orders.delete_one({"id": order_id})
    return {"detail": "تم حذف الطلب وكافة مرفقاته غير المشتركة نهائياً بنجاح"}
