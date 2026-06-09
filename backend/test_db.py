import os
import sys

# Add backend directory to sys.path to allow importing app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import get_mongodb_client, get_next_sequence_value
from app.config import settings

print("=========================================")
print("  MongoDB Atlas Connection Verification  ")
print("=========================================")

print(f"Target Connection URI: {settings.MONGODB_URI.split('@')[-1] if '@' in settings.MONGODB_URI else settings.MONGODB_URI} (Credentials masked)")

try:
    db = get_mongodb_client()
    
    # Perform a ping to verify connectivity
    db.command("ping")
    print("[OK] Ping successful! Connected to MongoDB Atlas cluster.")
    
    # Test Auto-increment counter sequence
    seq_val = get_next_sequence_value("test_seq")
    print(f"[OK] Auto-increment test passed. Sequence value: {seq_val}")
    
    # List collections
    collections = db.list_collection_names()
    print(f"[OK] Existing collections: {collections}")
    
    print("\nSUCCESS: Database config is fully functional.")
except Exception as e:
    print(f"[ERROR] Connection ERROR: {e}")
    sys.exit(1)

