from fastapi import APIRouter, Depends, Form, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime
import os
import json
from typing import List, Optional
from ..database import get_db, get_next_sequence_value
from ..schemas import AppResponse, OrderResponse, MessageResponse
from ..services.file_service import save_file
from ..services.email_service import send_order_notification_email
from .orders import verify_jwt, clean_doc, clean_docs

router = APIRouter(prefix="/api/apps", tags=["apps"])

@router.post("", response_model=AppResponse)
async def create_app(
    background_tasks: BackgroundTasks,
    db: any = Depends(get_db),
    current_user: dict = Depends(verify_jwt),
    dev_name: str = Form(...),
    dev_phone: str = Form(...),
    dev_email: str = Form(...),
    plan_selection: str = Form(...),
    app_title: str = Form(...),
    app_category: str = Form(...),
    app_short_desc: str = Form(...),
    app_long_desc: str = Form(...),
    has_aso_addon: bool = Form(False),
    has_transfer_addon: bool = Form(False),
    privacy_link: Optional[str] = Form(None),
    total_price: int = Form(...),
    app_version: str = Form("1.0.0"),
    file_icon: Optional[UploadFile] = File(None),
    file_feature: Optional[UploadFile] = File(None),
    file_screenshots: Optional[List[UploadFile]] = File(None),
    file_aab: Optional[UploadFile] = File(None),
):
    title = app_title
    category = app_category
    short_desc = app_short_desc
    long_desc = app_long_desc

    app_id = get_next_sequence_value("app_id")
    order_id = get_next_sequence_value("order_id")

    # Save application files using the generated order_id folder to be consistent with file_service
    icon_path = None
    if file_icon:
        icon_path = await save_file(file_icon, order_id, "icon.png")
        
    feature_path = None
    if file_feature:
        feature_path = await save_file(file_feature, order_id, "feature.png")
    
    screenshots_paths = []
    if file_screenshots:
        valid_shots = [s for s in file_screenshots if s.filename]
        for idx, file_shot in enumerate(valid_shots):
            path = await save_file(file_shot, order_id, f"screenshot_{idx + 1}.png")
            if path:
                screenshots_paths.append(path)
                
    aab_path = await save_file(file_aab, order_id, "app_bundle.aab" if file_aab else None)

    # 1. Create App document
    app_doc = {
        "id": app_id,
        "user_id": current_user["id"],
        "title": title,
        "category": category,
        "short_desc": short_desc,
        "long_desc": long_desc,
        "privacy_link": privacy_link,
        "icon_path": icon_path,
        "feature_path": feature_path,
        "screenshots_paths": screenshots_paths,
        "plan_selection": plan_selection,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    db.apps.insert_one(app_doc)

    # 2. Create initial order document (First Version)
    order_doc = {
        "id": order_id,
        "app_id": app_id,
        "user_id": current_user["id"],
        "dev_name": dev_name,
        "dev_phone": dev_phone,
        "dev_email": dev_email,
        "plan_selection": plan_selection,
        "app_title": title,
        "app_category": category,
        "app_short_desc": short_desc,
        "app_long_desc": long_desc,
        "has_aso_addon": has_aso_addon,
        "has_transfer_addon": has_transfer_addon,
        "privacy_link": privacy_link,
        "total_price": total_price,
        "app_version": app_version,
        "changelog": "الإصدار الأول للتطبيق 🎉",
        "icon_path": icon_path,
        "feature_path": feature_path,
        "screenshots_paths": screenshots_paths,
        "aab_path": aab_path,
        "status": "pending",
        "published_at": None,
        "payment_deadline": None,
        "reminder_sent": False,
        "admin_notes": None,
        "created_at": datetime.utcnow()
    }
    db.orders.insert_one(order_doc)

    # Queue administrative email notification
    background_tasks.add_task(send_order_notification_email, order_doc)

    return clean_doc(app_doc)

@router.get("", response_model=List[AppResponse])
def list_apps(db: any = Depends(get_db), current_user: dict = Depends(verify_jwt)):
    if current_user["role"] == "admin":
        apps = list(db.apps.find().sort("id", -1))
    else:
        apps = list(db.apps.find({"user_id": current_user["id"]}).sort("id", -1))
    return clean_docs(apps)

@router.get("/{app_id}")
def get_app_details(app_id: int, db: any = Depends(get_db), current_user: dict = Depends(verify_jwt)):
    app_doc = db.apps.find_one({"id": app_id})
    if not app_doc:
        raise HTTPException(status_code=404, detail="App not found")
    
    if current_user["role"] != "admin" and app_doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this app")
    
    # Fetch all versions/orders linked to this app_id
    versions = list(db.orders.find({"app_id": app_id}).sort("id", -1))
    
    return {
        "app": clean_doc(app_doc),
        "versions": clean_docs(versions)
    }

@router.get("/{app_id}/download/{file_key}")
def download_app_file(app_id: int, file_key: str, db: any = Depends(get_db), current_user: dict = Depends(verify_jwt)):
    app_doc = db.apps.find_one({"id": app_id})
    if not app_doc:
        raise HTTPException(status_code=404, detail="App not found")
        
    if current_user["role"] != "admin" and app_doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this file")
        
    rel_path = None
    if file_key == "icon":
        rel_path = app_doc.get("icon_path")
    elif file_key == "feature":
        rel_path = app_doc.get("feature_path")
    elif file_key.startswith("screenshot_"):
        try:
            idx = int(file_key.split("_")[1]) - 1
            shots = app_doc.get("screenshots_paths", [])
            if isinstance(shots, str):
                shots = json.loads(shots)
            if 0 <= idx < len(shots):
                rel_path = shots[idx]
        except Exception:
            pass
            
    if not rel_path:
        raise HTTPException(status_code=404, detail="المرفق غير مسجل بقاعدة البيانات")
        
    from ..services.file_service import get_file_response
    return get_file_response(rel_path)

@router.put("/{app_id}", response_model=AppResponse)
async def update_app(
    app_id: int,
    db: any = Depends(get_db),
    current_user: dict = Depends(verify_jwt),
    title: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    short_desc: Optional[str] = Form(None),
    long_desc: Optional[str] = Form(None),
    privacy_link: Optional[str] = Form(None),
    file_icon: Optional[UploadFile] = File(None),
    file_feature: Optional[UploadFile] = File(None),
    file_screenshots: Optional[List[UploadFile]] = File(None),
):
    app_doc = db.apps.find_one({"id": app_id})
    if not app_doc:
        raise HTTPException(status_code=404, detail="App not found")
    
    if current_user["role"] != "admin" and app_doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this app")
        
    update_fields = {}
    if title is not None:
        update_fields["title"] = title
    if category is not None:
        update_fields["category"] = category
    if short_desc is not None:
        update_fields["short_desc"] = short_desc
    if long_desc is not None:
        update_fields["long_desc"] = long_desc
    if privacy_link is not None:
        update_fields["privacy_link"] = privacy_link
        
    if file_icon:
        icon_path = await save_file(file_icon, app_id, "icon.png")
        if icon_path:
            update_fields["icon_path"] = icon_path
    if file_feature:
        feature_path = await save_file(file_feature, app_id, "feature.png")
        if feature_path:
            update_fields["feature_path"] = feature_path
            
    if file_screenshots:
        valid_shots = [s for s in file_screenshots if s.filename]
        if valid_shots:
            screenshots_paths = []
            for idx, file_shot in enumerate(valid_shots):
                path = await save_file(file_shot, app_id, f"screenshot_{idx + 1}.png")
                if path:
                    screenshots_paths.append(path)
            update_fields["screenshots_paths"] = screenshots_paths
            
    if update_fields:
        update_fields["updated_at"] = datetime.utcnow()
        db.apps.update_one({"id": app_id}, {"$set": update_fields})
        
    return clean_doc(db.apps.find_one({"id": app_id}))

@router.post("/{app_id}/versions", response_model=OrderResponse)
async def upload_version(
    app_id: int,
    background_tasks: BackgroundTasks,
    db: any = Depends(get_db),
    current_user: dict = Depends(verify_jwt),
    app_version: str = Form(...),
    changelog: str = Form(...),
    file_aab: UploadFile = File(...),
):
    app_doc = db.apps.find_one({"id": app_id})
    if not app_doc:
        raise HTTPException(status_code=404, detail="App not found")
        
    if current_user["role"] != "admin" and app_doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized for this app")
        
    # Cost calculation based on main app plan:
    # lifetime -> 0, pro -> 100, basic -> 150
    main_plan = app_doc.get("plan_selection", "basic")
    if main_plan == "lifetime":
        price = 0
    elif main_plan == "pro":
        price = 100
    else:
        price = 150
        
    # Get developer info from the earliest order of this app
    earliest_order = db.orders.find_one({"app_id": app_id}, sort=[("id", 1)])
    if earliest_order:
        dev_name = earliest_order.get("dev_name", "")
        dev_phone = earliest_order.get("dev_phone", "")
        dev_email = earliest_order.get("dev_email", "")
    else:
        dev_name = current_user.get("name", "Developer")
        dev_phone = "01000000000"
        dev_email = current_user.get("email", "")
        
    order_id = get_next_sequence_value("order_id")
    aab_path = await save_file(file_aab, order_id, "app_bundle.aab")
    
    order_doc = {
        "id": order_id,
        "app_id": app_id,
        "user_id": current_user["id"],
        "dev_name": dev_name,
        "dev_phone": dev_phone,
        "dev_email": dev_email,
        "plan_selection": "update",
        "app_title": app_doc.get("title", ""),
        "app_category": app_doc.get("category", ""),
        "app_short_desc": app_doc.get("short_desc", ""),
        "app_long_desc": app_doc.get("long_desc", ""),
        "has_aso_addon": False,
        "has_transfer_addon": False,
        "privacy_link": app_doc.get("privacy_link"),
        "total_price": price,
        "app_version": app_version,
        "changelog": changelog,
        "icon_path": app_doc.get("icon_path"),
        "feature_path": app_doc.get("feature_path"),
        "screenshots_paths": app_doc.get("screenshots_paths", []),
        "aab_path": aab_path,
        "status": "pending",
        "published_at": None,
        "payment_deadline": None,
        "reminder_sent": False,
        "admin_notes": None,
        "created_at": datetime.utcnow()
    }
    db.orders.insert_one(order_doc)
    
    # Send email notification
    background_tasks.add_task(send_order_notification_email, order_doc)
    
    return clean_doc(order_doc)


# ------------------ CHAT MESSAGES ENDPOINTS ------------------

class MessageCreate(BaseModel):
    content: str

@router.get("/{app_id}/messages", response_model=List[MessageResponse])
def get_messages(app_id: int, db: any = Depends(get_db), current_user: dict = Depends(verify_jwt)):
    app_doc = db.apps.find_one({"id": app_id})
    if not app_doc:
        raise HTTPException(status_code=404, detail="App not found")
        
    if current_user["role"] != "admin" and app_doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access messages")
        
    # Mark recipient unread messages as read
    recipient_role = "user" if current_user["role"] == "admin" else "admin"
    db.messages.update_many(
        {"app_id": app_id, "sender_role": recipient_role, "read_by_recipient": False},
        {"$set": {"read_by_recipient": True}}
    )
    
    messages = list(db.messages.find({"app_id": app_id}).sort("id", 1))
    return clean_docs(messages)

@router.post("/{app_id}/messages", response_model=MessageResponse)
def send_message(
    app_id: int,
    payload: MessageCreate,
    db: any = Depends(get_db),
    current_user: dict = Depends(verify_jwt),
):
    app_doc = db.apps.find_one({"id": app_id})
    if not app_doc:
        raise HTTPException(status_code=404, detail="App not found")
        
    if current_user["role"] != "admin" and app_doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to send messages")
        
    message_id = get_next_sequence_value("message_id")
    
    # Determine display name
    sender_name = current_user.get("name") or current_user.get("email").split("@")[0]
    if current_user["role"] == "admin":
        sender_name = "الدعم الفني (المشرف)"
        
    msg_doc = {
        "id": message_id,
        "app_id": app_id,
        "sender_id": current_user["id"],
        "sender_name": sender_name,
        "sender_role": current_user["role"],
        "content": payload.content,
        "created_at": datetime.utcnow(),
        "read_by_recipient": False
    }
    
    db.messages.insert_one(msg_doc)
    return clean_doc(msg_doc)
