import os
import shutil
from fastapi import UploadFile
from ..config import settings

def get_order_upload_dir(order_id: int) -> str:
    """Gets the unique upload directory for an order, creating it if it doesn't exist."""
    path = os.path.join(settings.UPLOAD_DIR, f"order_{order_id}")
    os.makedirs(path, exist_ok=True)
    return path

async def save_file(file: UploadFile, target_dir: str, filename_override: str = None) -> str:
    """Saves an UploadFile to target_dir and returns the relative path from the base uploads directory."""
    if not file or not file.filename:
        return None
    
    # Sanitize and get final filename
    filename = filename_override or file.filename
    filename = os.path.basename(filename)
    
    target_path = os.path.join(target_dir, filename)
    
    # Copy file content to target path
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return relative path from settings.UPLOAD_DIR
    return os.path.relpath(target_path, settings.UPLOAD_DIR).replace("\\", "/")
