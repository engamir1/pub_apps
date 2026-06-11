import os
import sys
from datetime import datetime

# Add the current directory to sys.path to allow importing app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import get_mongodb_client, get_next_sequence_value

def run_migration():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    print("=========================================")
    print("  Starting Database Migration Script...  ")
    print("=========================================")

    db = get_mongodb_client()

    # 1. Fetch all existing orders
    all_orders = list(db.orders.find())
    print(f"Found {len(all_orders)} total orders in 'orders' collection.")

    if len(all_orders) == 0:
        print("No orders found to migrate. Migration completed successfully.")
        return

    # 2. Group orders by (user_id, app_title)
    grouped_orders = {}
    for order in all_orders:
        user_id = order.get("user_id")
        app_title = order.get("app_title")
        if not user_id or not app_title:
            print(f"Skipping order #{order.get('id')} due to missing user_id or app_title.")
            continue
        
        key = (user_id, app_title)
        if key not in grouped_orders:
            grouped_orders[key] = []
        grouped_orders[key].append(order)

    print(f"Grouped orders into {len(grouped_orders)} unique applications.")

    # Reset/ensure counters for app_id starts if not exists
    if db.counters.find_one({"_id": "app_id"}) is None:
        db.counters.insert_one({"_id": "app_id", "sequence_value": 0})

    apps_inserted = 0
    orders_updated = 0

    # 3. For each group, create an App record and update corresponding orders
    for (user_id, app_title), orders in grouped_orders.items():
        # Sort orders by ID ascending to determine the chronological order of versions
        orders.sort(key=lambda o: o.get("id", 0))
        
        # Chronologically earliest order represents the initial app creation order
        earliest_order = orders[0]
        # Chronologically latest order represents the most up-to-date metadata
        latest_order = orders[-1]

        # Determine the plan_selection for the application
        # If the earliest order was an "update", look for a non-update plan or fallback to "basic"
        app_plan = earliest_order.get("plan_selection")
        if app_plan == "update":
            app_plan = "basic"  # Fallback default
            for o in orders:
                plan = o.get("plan_selection")
                if plan and plan != "update":
                    app_plan = plan
                    break

        # Check if the app already exists in the database to prevent duplicate migrations
        existing_app = db.apps.find_one({"user_id": user_id, "title": app_title})
        
        if existing_app:
            app_id = existing_app["id"]
            print(f"App '{app_title}' for User #{user_id} already exists (ID: {app_id}). Skipping creation.")
        else:
            app_id = get_next_sequence_value("app_id")
            
            # Prepare the new app record
            app_doc = {
                "id": app_id,
                "user_id": user_id,
                "title": app_title,
                "category": latest_order.get("app_category", ""),
                "short_desc": latest_order.get("app_short_desc", ""),
                "long_desc": latest_order.get("app_long_desc", ""),
                "privacy_link": latest_order.get("privacy_link"),
                "icon_path": latest_order.get("icon_path"),
                "feature_path": latest_order.get("feature_path"),
                "screenshots_paths": latest_order.get("screenshots_paths", []),
                "plan_selection": app_plan,
                "created_at": earliest_order.get("created_at", datetime.utcnow()),
                "updated_at": latest_order.get("created_at", datetime.utcnow())
            }
            
            db.apps.insert_one(app_doc)
            apps_inserted += 1
            print(f"Created App '{app_title}' for User #{user_id} with ID: {app_id} (Plan: {app_plan})")

        # Update all orders in this group to link to the app_id
        for order in orders:
            order_id = order.get("id")
            db.orders.update_one(
                {"id": order_id},
                {"$set": {"app_id": app_id}}
            )
            orders_updated += 1
            
        print(f"Linked {len(orders)} orders to App ID: {app_id}")

    print("=========================================")
    print("  Migration Summary:")
    print(f"  - Apps Created: {apps_inserted}")
    print(f"  - Orders Linked: {orders_updated}")
    print("  Migration completed successfully.")
    print("=========================================")

if __name__ == "__main__":
    run_migration()
