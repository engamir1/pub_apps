import os
import jwt
from datetime import datetime, timedelta
import requests
from app.config import settings
from app.database import get_mongodb_client, get_next_sequence_value

# 1. Ensure test user exists in the database and generate a token
def get_or_create_test_user_token():
    db = get_mongodb_client()
    email = "test.developer@example.com"
    user = db.users.find_one({"email": email})
    if not user:
        user_id = get_next_sequence_value("user_id")
        user = {"id": user_id, "email": email, "name": "احمد المطور التجريبي", "role": "user"}
        db.users.insert_one(user)
        print(f"Created test user: {user['email']} (ID: {user['id']})")
    else:
        print(f"Using existing test user: {user['email']} (ID: {user['id']})")
        
    # Generate token
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": expire
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token


token = get_or_create_test_user_token()

# 2. Build form data & files
url = "http://127.0.0.1:8001/api/orders"
headers = {
    "Authorization": f"Bearer {token}"
}

data = {
    "dev_name": "احمد المطور",
    "dev_phone": "+201234567890",
    "dev_email": "ahmed.dev@example.com",
    "plan_selection": "pro",
    "app_title": "تطبيق تجربة الرفع",
    "app_category": "تطبيقات خدمية / إنتاجية",
    "app_short_desc": "تطبيق رائع لتجربة R2.",
    "app_long_desc": "هذا التطبيق مخصص للتحقق من تكامل خادم FastAPI مع مساحة التخزين Cloudflare R2 بشكل تلقائي وآمن.",
    "has_aso_addon": "true",
    "has_transfer_addon": "false",
    "privacy_link": "https://example.com/privacy",
    "total_price": "1500"
}

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
icon_file = os.path.join(root_dir, "assets", "images", "app_prep.png")
feature_file = os.path.join(root_dir, "assets", "images", "rocket_launch.png")
aab_file = os.path.join(root_dir, "test_app.aab")

files = {}
opened_files = []

try:
    if os.path.exists(icon_file):
        f1 = open(icon_file, "rb")
        opened_files.append(f1)
        files["file_icon"] = ("app_prep.png", f1, "image/png")
    
    if os.path.exists(feature_file):
        f2 = open(feature_file, "rb")
        opened_files.append(f2)
        files["file_feature"] = ("rocket_launch.png", f2, "image/png")
        
    if os.path.exists(icon_file):
        f3 = open(icon_file, "rb")
        opened_files.append(f3)
        files["file_screenshots"] = ("screenshot_1.png", f3, "image/png")
        
    if os.path.exists(aab_file):
        f4 = open(aab_file, "rb")
        opened_files.append(f4)
        files["file_aab"] = ("test_app.aab", f4, "application/octet-stream")

    print("\nSending POST request to:", url)
    response = requests.post(url, data=data, files=files, headers=headers)
    
    print("Status Code:", response.status_code)
    import json
    try:
        res_json = response.json()
        print("Response JSON:")
        print(json.dumps(res_json, indent=2, ensure_ascii=False))
    except Exception:
        print("Response Text:", response.text)
        
except Exception as e:
    print(f"Error during order submission: {e}")
finally:
    for f in opened_files:
        f.close()
