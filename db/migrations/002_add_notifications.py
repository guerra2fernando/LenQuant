"""Add notifications collection and indexes."""
from db.client import get_database_name, mongo_client


def migrate():
    """Create notifications, notification_preferences, and notification_analytics collections with indexes."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # ===== NOTIFICATIONS COLLECTION =====
        collection = db["notifications"]
        
        # Create indexes for notifications
        # Query user notifications by recency
        collection.create_index([("user_id", 1), ("created_at", -1)])
        
        # Filter unread notifications
        collection.create_index([("user_id", 1), ("read", 1), ("created_at", -1)])
        
        # TTL index for automatic cleanup (expires documents after expires_at)
        collection.create_index([("expires_at", 1)], expireAfterSeconds=0)
        
        # Query by notification type
        collection.create_index([("type", 1), ("created_at", -1)])
        
        print("✅ Created notifications collection indexes")
        
        # ===== NOTIFICATION_PREFERENCES COLLECTION =====
        prefs_collection = db["notification_preferences"]
        
        # Create index for user preferences lookup
        prefs_collection.create_index([("user_id", 1)], unique=True)
        
        print("✅ Created notification_preferences collection indexes")
        
        # ===== NOTIFICATION_ANALYTICS COLLECTION =====
        analytics_collection = db["notification_analytics"]
        
        # Create indexes for analytics queries
        analytics_collection.create_index([("user_id", 1), ("opened_at", -1)])
        analytics_collection.create_index([("notification_id", 1)])
        analytics_collection.create_index([("user_id", 1), ("clicked_at", -1)])
        
        print("✅ Created notification_analytics collection indexes")
        
        print("\n✅ Migration completed successfully!")


if __name__ == "__main__":
    migrate()

