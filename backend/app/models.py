from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from .database import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    dev_name = Column(String, nullable=False)
    dev_phone = Column(String, nullable=False)
    dev_email = Column(String, nullable=False)
    plan_selection = Column(String, nullable=False)
    app_title = Column(String, nullable=False)
    app_category = Column(String, nullable=False)
    app_short_desc = Column(String, nullable=False)
    app_long_desc = Column(Text, nullable=False)
    has_aso_addon = Column(Boolean, default=False, nullable=False)
    has_transfer_addon = Column(Boolean, default=False, nullable=False)
    privacy_link = Column(String, nullable=True)
    total_price = Column(Integer, nullable=False)
    
    # Storage file paths (relative to root uploads directory)
    icon_path = Column(String, nullable=True)
    feature_path = Column(String, nullable=True)
    screenshots_paths = Column(Text, nullable=True)  # JSON-encoded array of paths
    aab_path = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
