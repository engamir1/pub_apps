import os
import requests

# Base URL
url = "http://127.0.0.1:8001/api/orders"

# Data payload
data = {
    "dev_name": "احمد المطور",
    "dev_phone": "+201234567890",
    "dev_email": "ahmed.dev@example.com",
    "plan_selection": "pro",
    "app_title": "تطبيقي المميز",
    "app_category": "تطبيقات خدمية / إنتاجية",
    "app_short_desc": "تطبيق رائع للإنتاجية وتنظيم الوقت.",
    "app_long_desc": "هذا التطبيق هو الحل الأمثل لتنظيم المهام اليومية مع مميزات رائعة مثل التنبيهات الذكية وتصميم عصري يدعم اللغة العربية بشكل كامل.",
    "has_aso_addon": "true",
    "has_transfer_addon": "false",
    "privacy_link": "https://example.com/privacy",
    "total_price": "1500"
}

# Find some files to upload
# We can use the existing assets/images/app_prep.png for icon, feature, and screenshots
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
icon_file = os.path.join(root_dir, "assets", "images", "app_prep.png")
feature_file = os.path.join(root_dir, "assets", "images", "rocket_launch.png")
aab_file = os.path.join(root_dir, "test_app.aab")

# Check if files exist
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

    print("Sending POST request to:", url)
    response = requests.post(url, data=data, files=files)
    
    print("Status Code:", response.status_code)
    try:
        import json
        res_json = response.json()
        try:
            print("Response JSON:")
            print(json.dumps(res_json, indent=2, ensure_ascii=False))
        except UnicodeEncodeError:
            print("Response JSON (Safe representation):")
            print(json.dumps(res_json, indent=2, ensure_ascii=True))
    except Exception as e:
        try:
            print("Response Text:", response.text)
        except UnicodeEncodeError:
            print("Response Text (Safe):", repr(response.text))
        
finally:
    for f in opened_files:
        f.close()
