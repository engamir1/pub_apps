import os
import shutil
import boto3
from botocore.config import Config
from fastapi import UploadFile, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from ..config import settings

def get_order_upload_dir(order_id: int) -> str:
    """Gets the unique upload directory for an order, creating it if it doesn't exist."""
    path = os.path.join(settings.UPLOAD_DIR, f"order_{order_id}")
    os.makedirs(path, exist_ok=True)
    return path

def get_r2_client():
    """Initializes and returns a Cloudflare R2 S3 client."""
    return boto3.client(
        service_name='s3',
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4')
    )

async def save_file(file: UploadFile, order_id: int, filename_override: str = None) -> str:
    """Saves an UploadFile either to Cloudflare R2 (if configured) or local storage."""
    if not file or not file.filename:
        return None
    
    # Sanitize and get final filename
    filename = filename_override or file.filename
    filename = os.path.basename(filename)
    
    # Define uniform object key (relative path schema)
    relative_path = f"order_{order_id}/{filename}"
    
    if settings.is_r2_configured:
        try:
            r2 = get_r2_client()
            # Ensure file read head is at start
            file.file.seek(0)
            content = file.file.read()
            content_type = file.content_type or 'application/octet-stream'
            
            # Upload to Cloudflare R2
            r2.put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=relative_path,
                Body=content,
                ContentType=content_type
            )
            return relative_path
        except Exception as e:
            print(f"[R2 STORAGE WARNING] Failed to upload to Cloudflare R2: {e}. Falling back to local storage.")
            # Fall through to local storage
            
    # Local Storage Fallback
    target_dir = get_order_upload_dir(order_id)
    target_path = os.path.join(target_dir, filename)
    
    file.file.seek(0)
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return relative_path

def get_file_response(rel_path: str):
    """Returns either a local FileResponse or a RedirectResponse to a presigned R2 download URL."""
    if not rel_path:
        raise HTTPException(status_code=404, detail="File path is empty")
        
    # Check local storage first (handles legacy files and R2 upload fallbacks)
    abs_path = os.path.join(settings.UPLOAD_DIR, rel_path)
    if os.path.exists(abs_path):
        return FileResponse(abs_path, filename=os.path.basename(abs_path))
        
    # Redirect to presigned Cloudflare R2 URL
    if settings.is_r2_configured:
        try:
            r2 = get_r2_client()
            url = r2.generate_presigned_url(
                ClientMethod='get_object',
                Params={
                    'Bucket': settings.R2_BUCKET_NAME,
                    'Key': rel_path,
                    'ResponseContentDisposition': f'attachment; filename="{os.path.basename(rel_path)}"'
                },
                ExpiresIn=3600  # Link valid for 1 hour
            )
            return RedirectResponse(url)
        except Exception as e:
            print(f"[R2 DOWNLOAD ERROR] Failed to generate presigned URL for {rel_path}: {e}")
            
    raise HTTPException(status_code=404, detail="المرفق غير موجود على القرص المحلي أو سحابة Cloudflare R2")

def delete_file(rel_path: str):
    """Deletes a file from local disk and Cloudflare R2 if configured."""
    if not rel_path:
        return
        
    # Delete local file if it exists
    abs_path = os.path.join(settings.UPLOAD_DIR, rel_path)
    if os.path.exists(abs_path):
        try:
            os.remove(abs_path)
            print(f"[STORAGE] Deleted local file: {abs_path}")
        except Exception as e:
            print(f"[STORAGE ERROR] Failed to delete local file {abs_path}: {e}")
            
    # Delete from Cloudflare R2
    if settings.is_r2_configured:
        try:
            r2 = get_r2_client()
            r2.delete_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=rel_path
            )
            print(f"[R2 STORAGE] Deleted object from R2: {rel_path}")
        except Exception as e:
            print(f"[R2 STORAGE ERROR] Failed to delete object {rel_path} from R2: {e}")

def delete_order_directory(order_id: int, icon_path: str, feature_path: str, screenshots_json: str, aab_path: str):
    """Deletes all files belonging to an order and removes the local order folder."""
    delete_file(icon_path)
    delete_file(feature_path)
    delete_file(aab_path)
    
    if screenshots_json:
        try:
            import json
            shots = json.loads(screenshots_json)
            if isinstance(shots, list):
                for shot in shots:
                    delete_file(shot)
        except Exception as e:
            print(f"[STORAGE ERROR] Failed to parse screenshots JSON for deletion: {e}")
            
    # Remove local order folder
    local_dir = os.path.join(settings.UPLOAD_DIR, f"order_{order_id}")
    if os.path.exists(local_dir) and os.path.isdir(local_dir):
        try:
            shutil.rmtree(local_dir)
            print(f"[STORAGE] Removed local order directory: {local_dir}")
        except Exception as e:
            print(f"[STORAGE ERROR] Failed to remove local directory {local_dir}: {e}")

