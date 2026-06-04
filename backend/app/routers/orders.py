from fastapi import APIRouter, Depends, Form, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import json
import os
from typing import List, Optional
from ..database import get_db
from ..models import Order
from ..schemas import OrderResponse
from ..services.file_service import get_order_upload_dir, save_file
from ..services.email_service import send_order_notification_email
from ..config import settings

router = APIRouter(prefix="/api/orders", tags=["orders"])

@router.post("", response_model=OrderResponse)
async def create_order(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
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
    file_icon: Optional[UploadFile] = File(None),
    file_feature: Optional[UploadFile] = File(None),
    file_screenshots: Optional[List[UploadFile]] = File(None),
    file_aab: Optional[UploadFile] = File(None),
):
    """Creates a new order, saves uploaded files, and schedules an email notification."""
    # 1. Create a database record first to obtain a unique order ID
    db_order = Order(
        dev_name=dev_name,
        dev_phone=dev_phone,
        dev_email=dev_email,
        plan_selection=plan_selection,
        app_title=app_title,
        app_category=app_category,
        app_short_desc=app_short_desc,
        app_long_desc=app_long_desc,
        has_aso_addon=has_aso_addon,
        has_transfer_addon=has_transfer_addon,
        privacy_link=privacy_link,
        total_price=total_price,
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    # 2. Resolve upload directory for this unique order ID
    order_dir = get_order_upload_dir(db_order.id)

    # 3. Save uploaded files to the folder
    icon_path = await save_file(file_icon, order_dir, "icon.png" if file_icon else None)
    feature_path = await save_file(file_feature, order_dir, "feature.png" if file_feature else None)
    
    screenshots_paths = []
    # Save multiple screenshots sequentially
    if file_screenshots:
        # FastAPI handles multiple files, occasionally creating empty list objects for empty fields
        valid_shots = [s for s in file_screenshots if s.filename]
        for idx, file_shot in enumerate(valid_shots):
            path = await save_file(file_shot, order_dir, f"screenshot_{idx + 1}.png")
            if path:
                screenshots_paths.append(path)
                
    aab_path = await save_file(file_aab, order_dir, "app_bundle.aab" if file_aab else None)

    # 4. Update order with resolved storage paths
    db_order.icon_path = icon_path
    db_order.feature_path = feature_path
    db_order.screenshots_paths = json.dumps(screenshots_paths)
    db_order.aab_path = aab_path
    db.commit()
    db.refresh(db_order)

    # 5. Queue administrative email notification as background task
    order_dict = {
        "id": db_order.id,
        "dev_name": db_order.dev_name,
        "dev_phone": db_order.dev_phone,
        "dev_email": db_order.dev_email,
        "plan_selection": db_order.plan_selection,
        "app_title": db_order.app_title,
        "app_category": db_order.app_category,
        "app_short_desc": db_order.app_short_desc,
        "app_long_desc": db_order.app_long_desc,
        "has_aso_addon": db_order.has_aso_addon,
        "has_transfer_addon": db_order.has_transfer_addon,
        "privacy_link": db_order.privacy_link,
        "total_price": db_order.total_price,
    }
    background_tasks.add_task(send_order_notification_email, order_dict)

    return db_order

@router.get("", response_model=List[OrderResponse])
def list_orders(db: Session = Depends(get_db)):
    """Returns a list of all publishing orders."""
    return db.query(Order).order_by(Order.id.desc()).all()

@router.get("/{order_id}", response_model=OrderResponse)
def get_order_details(order_id: int, db: Session = Depends(get_db)):
    """Retrieves full details of a specific order by ID."""
    db_order = db.query(Order).filter(Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    return db_order

@router.get("/{order_id}/download/{file_key}")
def download_order_file(order_id: int, file_key: str, db: Session = Depends(get_db)):
    """Downloads a specific file belonging to an order (file_key: 'icon', 'feature', 'aab', 'screenshot_X')."""
    db_order = db.query(Order).filter(Order.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    rel_path = None
    if file_key == "icon":
        rel_path = db_order.icon_path
    elif file_key == "feature":
        rel_path = db_order.feature_path
    elif file_key == "aab":
        rel_path = db_order.aab_path
    elif file_key.startswith("screenshot_"):
        try:
            shot_idx = int(file_key.split("_")[1]) - 1
            shots = json.loads(db_order.screenshots_paths or "[]")
            if 0 <= shot_idx < len(shots):
                rel_path = shots[shot_idx]
        except Exception:
            pass
            
    if not rel_path:
        raise HTTPException(status_code=400, detail="Invalid file key or file not uploaded")
        
    abs_path = os.path.join(settings.UPLOAD_DIR, rel_path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="File is missing on disk storage")
        
    return FileResponse(abs_path, filename=os.path.basename(abs_path))
