import os
import jwt
from datetime import datetime, timedelta
import requests
from app.config import settings
from app.database import get_mongodb_client, get_next_sequence_value

# 1. Get token for Admin user
def get_admin_user_token():
    db = get_mongodb_client()
    email = settings.NOTIFICATION_EMAIL
    admin = db.users.find_one({"email": email})
    if not admin:
        admin_id = get_next_sequence_value("user_id")
        admin = {"id": admin_id, "email": email, "name": "مدير النظام", "role": "admin"}
        db.users.insert_one(admin)
        print(f"Created admin user: {admin['email']} (ID: {admin['id']})")
    else:
        print(f"Using existing admin user: {admin['email']} (ID: {admin['id']})")
        
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "user_id": admin["id"],
        "email": admin["email"],
        "role": admin["role"],
        "exp": expire
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token


token = get_admin_user_token()

# 2. Call DELETE endpoint
url = "http://127.0.0.1:8001/api/orders/2"
headers = {
    "Authorization": f"Bearer {token}"
}

print(f"\nSending DELETE request to: {url}")
response = requests.delete(url, headers=headers)
print("Status Code:", response.status_code)
print("Response:", response.json())

# Check database
db = get_mongodb_client()
deleted_order = db.orders.find_one({"id": 2})
if not deleted_order:
    print("SUCCESS: Order 2 deleted from database.")
else:
    print("FAILURE: Order 2 still exists in database!")

