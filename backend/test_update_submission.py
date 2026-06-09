import os
import jwt
from datetime import datetime, timedelta
import requests
from app.config import settings
from app.database import get_mongodb_client

# 1. Get token for existing developer user
def get_test_user_token():
    db = get_mongodb_client()
    email = "test.developer@example.com"
    user = db.users.find_one({"email": email})
    if not user:
        raise Exception("Test user not found. Run test_order_submission.py first!")
        
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": expire
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token


token = get_test_user_token()

# 2. Build form data for Update order
url = "http://127.0.0.1:8001/api/orders"
headers = {
    "Authorization": f"Bearer {token}"
}

data = {
    "dev_name": "احمد المطور",
    "dev_phone": "+201234567890",
    "dev_email": "ahmed.dev@example.com",
    "plan_selection": "update",  # Mark this as update!
    "app_title": "تطبيق تجربة الرفع",  # Same title to trigger inheritance
    "total_price": "150",
    "app_version": "1.1.0",
    "changelog": "اصلاح بعض المشاكل البرمجية وتحسين سرعة الرفع"
}

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
aab_file = os.path.join(root_dir, "test_app.aab")

files = {}
opened_files = []

try:
    if os.path.exists(aab_file):
        f = open(aab_file, "rb")
        opened_files.append(f)
        files["file_aab"] = ("test_app_v1.1.0.aab", f, "application/octet-stream")
    else:
        raise Exception(f"test_app.aab not found at {aab_file}")

    print("\nSending POST update request to:", url)
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
    print(f"Error during order update submission: {e}")
finally:
    for f in opened_files:
        f.close()
