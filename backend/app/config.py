import os

class Settings:
    PROJECT_NAME: str = "انشر تطبيقك - Backend"
    
    # Storage settings
    # This resolves to the root folder uploads/ directory
    UPLOAD_DIR: str = os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")
    )
    DATABASE_URL: str = f"sqlite:///{os.path.join(UPLOAD_DIR, 'orders.db')}"
    
    # SMTP Settings for Order email notifications
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    NOTIFICATION_EMAIL: str = os.getenv("NOTIFICATION_EMAIL", "cedratech1@gmail.com")

settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
