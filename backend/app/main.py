from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from .database import engine, Base
from .routers import orders
from .config import settings

# Initialize SQLite database schema automatically on startup
Base.metadata.create_all(bind=engine)

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

# Mount CSS, JS, and image asset directories
app.mount("/css", StaticFiles(directory=os.path.join(ROOT_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(ROOT_DIR, "js")), name="js")
app.mount("/assets", StaticFiles(directory=os.path.join(ROOT_DIR, "assets")), name="assets")
