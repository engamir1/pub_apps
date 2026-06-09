from pymongo import MongoClient, ReturnDocument
from .config import settings

client = None
db = None

def get_mongodb_client():
    global client, db
    if client is None:
        uri = settings.MONGODB_URI
        client = MongoClient(uri)
        
        # Extract database name from connection string if present, fallback to "pub_apps"
        db_name = "pub_apps"
        parsed_uri = uri.split("/")
        if len(parsed_uri) > 3:
            path_part = parsed_uri[3].split("?")[0]
            if path_part:
                db_name = path_part
                
        db = client[db_name]
    return db

def get_db():
    """Dependency injection yield for DB requests, compatible with FastAPI Depends"""
    yield get_mongodb_client()

def get_next_sequence_value(sequence_name: str) -> int:
    """Generates an auto-incrementing integer ID using a counters collection in MongoDB"""
    mongodb = get_mongodb_client()
    counter = mongodb.counters.find_one_and_update(
        {"_id": sequence_name},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return counter["sequence_value"]
