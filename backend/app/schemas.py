import json
from datetime import datetime
from pydantic import BaseModel, field_validator
from typing import List, Optional

class OrderBase(BaseModel):
    dev_name: str
    dev_phone: str
    dev_email: str
    plan_selection: str
    app_title: str
    app_category: str
    app_short_desc: str
    app_long_desc: str
    has_aso_addon: bool = False
    has_transfer_addon: bool = False
    privacy_link: Optional[str] = None
    total_price: int

class OrderResponse(OrderBase):
    id: int
    icon_path: Optional[str] = None
    feature_path: Optional[str] = None
    screenshots_paths: List[str] = []
    aab_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

    @field_validator('screenshots_paths', mode='before')
    @classmethod
    def decode_screenshots(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []
