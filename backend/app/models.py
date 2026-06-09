from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    role = Column(String, default="user", nullable=False)  # admin, user
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    orders = relationship("Order", back_populates="user")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Links order to registered user
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
    app_version = Column(String, default="1.0.0", nullable=True)
    changelog = Column(Text, nullable=True)
    
    # Order Status & Payment Deadline tracking
    status = Column(String, default="pending", nullable=False)  # pending, published, paid, deleted
    published_at = Column(DateTime, nullable=True)
    payment_deadline = Column(DateTime, nullable=True)
    reminder_sent = Column(Boolean, default=False, nullable=False)
    
    # Admin feedback / claims
    admin_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="orders")


