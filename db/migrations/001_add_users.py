"""Add users collection and indexes."""
from db.client import get_database_name, mongo_client


def migrate():
    """Create users collection with indexes."""
    with mongo_client() as client:
        db = client[get_database_name()]
        
        # Create indexes
        db.users.create_index("id", unique=True)
        db.users.create_index("email", unique=True)
        
        print("✅ Created users collection indexes")


if __name__ == "__main__":
    migrate()

