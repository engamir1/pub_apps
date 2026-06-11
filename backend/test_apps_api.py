import os
import sys
import jwt
import requests
from datetime import datetime, timedelta

# Add parent directory to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.database import get_mongodb_client, get_next_sequence_value

def get_or_create_test_user_token():
    db = get_mongodb_client()
    email = "integration.tester@example.com"
    user = db.users.find_one({"email": email})
    if not user:
        user_id = get_next_sequence_value("user_id")
        user = {"id": user_id, "email": email, "name": "مطور تكامل تجريبي", "role": "user"}
        db.users.insert_one(user)
    
    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.utcnow() + timedelta(days=1)
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token

def run_tests():
    print("=========================================")
    print("  Starting Integration API Tests...      ")
    print("=========================================")

    token = get_or_create_test_user_token()
    headers = {"Authorization": f"Bearer {token}"}
    base_url = "http://127.0.0.1:8001/api"

    # Create dummy app files if they don't exist
    aab_file_path = "test_app.aab"
    if not os.path.exists(aab_file_path):
        with open(aab_file_path, "wb") as f:
            f.write(b"mock aab file content")

    # TEST 1: Create a new app (POST /api/apps)
    print("\n[TEST 1] Creating new App...")
    data = {
        "dev_name": "مطور تكامل",
        "dev_phone": "+201234567890",
        "dev_email": "integration.tester@example.com",
        "plan_selection": "pro",
        "app_title": "تطبيق تكامل فني تجريبي",
        "app_category": "ألعاب وتسلية",
        "app_short_desc": "وصف قصير للتطبيق تجربة تكامل.",
        "app_long_desc": "هذا الوصف الطويل مخصص لاختبار التكامل التلقائي والتحقق من عمل الخوادم والملفات وقواعد البيانات.",
        "has_aso_addon": "true",
        "has_transfer_addon": "false",
        "privacy_link": "https://example.com/privacy-test",
        "total_price": "1500",
        "app_version": "1.0.0"
    }

    files = {
        "file_aab": ("test_app.aab", open(aab_file_path, "rb"), "application/octet-stream")
    }

    res = requests.post(f"{base_url}/apps", data=data, files=files, headers=headers)
    print("Status:", res.status_code)
    assert res.status_code == 200, f"App creation failed: {res.text}"
    app_json = res.json()
    app_id = app_json["id"]
    print(f"Success! Created App ID: {app_id}, Title: {app_json['title']}")

    # TEST 2: List Apps (GET /api/apps)
    print("\n[TEST 2] Listing Apps...")
    res = requests.get(f"{base_url}/apps", headers=headers)
    print("Status:", res.status_code)
    assert res.status_code == 200
    apps_list = res.json()
    print(f"Success! Found {len(apps_list)} apps in user account.")

    # TEST 3: Upload a new version (POST /api/apps/{id}/versions)
    print(f"\n[TEST 3] Uploading new version for App ID {app_id}...")
    version_data = {
        "app_version": "1.1.0",
        "changelog": "إصلاح الأخطاء الطفيفة وإضافة محادثة الدعم الفني."
    }
    version_files = {
        "file_aab": ("test_app_v1.1.0.aab", open(aab_file_path, "rb"), "application/octet-stream")
    }
    res = requests.post(f"{base_url}/apps/{app_id}/versions", data=version_data, files=version_files, headers=headers)
    print("Status:", res.status_code)
    assert res.status_code == 200, f"Version upload failed: {res.text}"
    version_json = res.json()
    print(f"Success! New version '{version_json['app_version']}' uploaded (Price: {version_json['total_price']} EGP).")

    # TEST 4: Send chat message (POST /api/apps/{id}/messages)
    print(f"\n[TEST 4] Sending chat message for App ID {app_id}...")
    msg_data = {
        "content": "مرحباً، أود مراجعة ملف الـ AAB المرفوع للتو وشكراً."
    }
    res = requests.post(f"{base_url}/apps/{app_id}/messages", json=msg_data, headers=headers)
    print("Status:", res.status_code)
    assert res.status_code == 200
    msg_json = res.json()
    print(f"Success! Message sent ID: {msg_json['id']} by '{msg_json['sender_name']}'.")

    # TEST 5: Get chat messages (GET /api/apps/{id}/messages)
    print(f"\n[TEST 5] Fetching chat messages for App ID {app_id}...")
    res = requests.get(f"{base_url}/apps/{app_id}/messages", headers=headers)
    print("Status:", res.status_code)
    assert res.status_code == 200
    messages = res.json()
    print(f"Success! Retrieved {len(messages)} messages from chat room.")
    for m in messages:
        print(f"  [{m['sender_name']}]: {m['content']}")

    # CLEANUP TEST DATA (To stop polluting the admin dashboard)
    print("\n[CLEANUP] Cleaning up test data from database and local storage...")
    try:
        cleanup_db = get_mongodb_client()
        
        # Delete app document
        cleanup_db.apps.delete_one({"id": app_id})
        print(f"Deleted test App ID {app_id} from database.")

        # Delete all messages for this app
        cleanup_db.messages.delete_many({"app_id": app_id})
        print("Deleted support chat messages.")

        # Find and delete all orders (versions) for this app and their uploads
        test_orders = list(cleanup_db.orders.find({"app_id": app_id}))
        for o in test_orders:
            o_id = o.get("id")
            cleanup_db.orders.delete_one({"id": o_id})
            
            # Remove local directory uploads/order_{o_id}
            local_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", f"order_{o_id}")
            if os.path.exists(local_dir):
                import shutil
                shutil.rmtree(local_dir)
                print(f"Removed local upload directory: {local_dir}")
        print(f"Deleted {len(test_orders)} associated orders.")

        # Delete all notifications linked to this app
        cleanup_db.notifications.delete_many({"link": {"$regex": f"id={app_id}"}})
        print("Deleted associated notifications.")

        print("Cleanup completed successfully! ✨")
    except Exception as cleanup_err:
        print(f"Cleanup failed: {cleanup_err}")

    print("\n=========================================")
    print("  ALL API TESTS PASSED SUCCESSFULLY! 🎉 ")
    print("=========================================")

if __name__ == "__main__":
    run_tests()
