import os

# Custom lightweight .env loader
def load_env():
    # Check in backend/ directory first, then root directory
    paths = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")
    ]
    for env_path in paths:
        env_path = os.path.abspath(env_path)
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key:
                        os.environ[key] = val
            break

load_env()

class Settings:
    PROJECT_NAME: str = "انشر تطبيقك - Backend"
    
    # Storage settings
    # This resolves to the root folder uploads/ directory
    UPLOAD_DIR: str = os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")
    )
    # MongoDB Connection URI
    MONGODB_URI: str = os.getenv(
        "MONGODB_URI",
        "mongodb+srv://ahmedamin1033_db_user:wsM0R8yUi2ol2WTG@apps-cluster.rc6lwh1.mongodb.net/pub_apps?retryWrites=true&w=majority"
    )


    
    # SMTP Settings for Order email notifications
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    NOTIFICATION_EMAIL: str = os.getenv("NOTIFICATION_EMAIL", "cedratech1@gmail.com")

    # Admin Dashboard Credentials
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")

    # Google Sign-In and session settings
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "9123456789-placeholder.apps.googleusercontent.com")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-admin-token-key-2026")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Firebase Settings
    FIREBASE_API_KEY: str = os.getenv("FIREBASE_API_KEY", "AIzaSyCZC5cJQhg7p_quhl-Cp30mnLfz2rD8E8I")
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "pub-apps-ef155")


    # Payment details (InstaPay)
    INSTAPAY_DETAILS: str = "InstaPay: cedratech@instapay | أو عبر الرقم: 201507890092"

    # Cloudflare R2 Settings
    R2_ACCOUNT_ID: str = os.getenv("R2_ACCOUNT_ID", "")
    R2_ACCESS_KEY_ID: str = os.getenv("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    R2_BUCKET_NAME: str = os.getenv("R2_BUCKET_NAME", "")

    @property
    def is_r2_configured(self) -> bool:
        return bool(self.R2_ACCOUNT_ID and self.R2_ACCESS_KEY_ID and self.R2_SECRET_ACCESS_KEY and self.R2_BUCKET_NAME)

settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

