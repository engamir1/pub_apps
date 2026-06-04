import os
import sqlite3
import json

db_path = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads", "orders.db")
)

print(f"Checking database path: {db_path}")

if not os.path.exists(db_path):
    print("WARNING: database file does not exist yet. Launching main.py once is required to create it.")
    exit(1)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # List all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables found in database:", [t[0] for t in tables])
    
    if "orders" in [t[0] for t in tables]:
        # Get column info
        cursor.execute("PRAGMA table_info(orders);")
        columns = cursor.fetchall()
        print("\nColumns in 'orders' table:")
        for col in columns:
            print(f"  Column ID: {col[0]}, Name: {col[1]}, Type: {col[2]}, Nullable: {col[3] == 0}, Default: {col[4]}")
    else:
        print("ERROR: 'orders' table not found in database.")
        
    conn.close()
except Exception as e:
    print(f"Error checking database: {e}")
