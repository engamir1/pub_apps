from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import asyncio
from datetime import datetime
from .database import get_mongodb_client
from .services.email_service import send_payment_reminder_email
from .routers import orders
from .config import settings


app = FastAPI(title=settings.PROJECT_NAME)


# Enable CORS for local cross-origin testing/requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register orders API router
app.include_router(orders.router)

# Resolve parent root directory of static frontend assets
ROOT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
)

# Route endpoints to serve static HTML pages
@app.get("/")
def serve_root():
    return FileResponse(os.path.join(ROOT_DIR, "index.html"))

@app.get("/index.html")
def serve_index():
    return FileResponse(os.path.join(ROOT_DIR, "index.html"))

@app.get("/pricing.html")
def serve_pricing():
    return FileResponse(os.path.join(ROOT_DIR, "pricing.html"))

@app.get("/policies.html")
def serve_policies():
    return FileResponse(os.path.join(ROOT_DIR, "policies.html"))

@app.get("/order.html")
def serve_order():
    return FileResponse(os.path.join(ROOT_DIR, "order.html"))

@app.get("/admin")
def serve_admin():
    return FileResponse(os.path.join(ROOT_DIR, "admin.html"))

@app.get("/api/config/google-client-id")
def get_google_client_id():
    return {"client_id": settings.GOOGLE_CLIENT_ID}


# Mount CSS, JS, and image asset directories
app.mount("/css", StaticFiles(directory=os.path.join(ROOT_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(ROOT_DIR, "js")), name="js")
app.mount("/assets", StaticFiles(directory=os.path.join(ROOT_DIR, "assets")), name="assets")

async def check_payment_deadlines_periodically():
    """Background task to periodically check for overdue unpaid orders and send reminders."""
    print("[BACKGROUND] Starting payment deadline checker loop...")
    while True:
        try:
            db = get_mongodb_client()
            now = datetime.utcnow()
            overdue_orders = list(db.orders.find({
                "status": "published",
                "payment_deadline": {"$lte": now},
                "reminder_sent": False
            }))

            for order in overdue_orders:
                print(f"[BACKGROUND] Order #{order['id']} is overdue. Sending payment reminder.")
                order_dict = {
                    "id": order["id"],
                    "dev_name": order["dev_name"],
                    "dev_phone": order["dev_phone"],
                    "dev_email": order["dev_email"],
                    "plan_selection": order["plan_selection"],
                    "app_title": order["app_title"],
                    "total_price": order["total_price"],
                }
                try:
                    send_payment_reminder_email(order_dict)
                    db.orders.update_one(
                        {"id": order["id"]},
                        {"$set": {"reminder_sent": True}}
                    )
                    print(f"[BACKGROUND] Marked Order #{order['id']} as reminded.")
                except Exception as email_err:
                    print(f"[BACKGROUND] Failed to send email for Order #{order['id']}: {email_err}")
        except Exception as e:
            print(f"[BACKGROUND ERROR] Error in deadline check: {e}")
        
        # Check every hour
        await asyncio.sleep(3600)

@app.on_event("startup")
async def startup_event():
    # Run the deadline checker in the background
    asyncio.create_task(check_payment_deadlines_periodically())

