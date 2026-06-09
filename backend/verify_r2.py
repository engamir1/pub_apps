import os
import boto3
from botocore.config import Config

# Custom lightweight .env loader
def load_env():
    paths = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    ]
    for env_path in paths:
        env_path = os.path.abspath(env_path)
        if os.path.exists(env_path):
            print(f"Loading env from: {env_path}")
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key:
                        os.environ[key] = val
            break

load_env()

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")

print("Credentials:")
print(f"  Account ID: {R2_ACCOUNT_ID}")
print(f"  Access Key ID: {R2_ACCESS_KEY_ID}")
print(f"  Bucket: {R2_BUCKET_NAME}")
print(f"  Secret Access Key is set: {bool(R2_SECRET_ACCESS_KEY)}")

if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME]):
    print("Error: Some R2 credentials are missing from env!")
    exit(1)

try:
    print("Initializing boto3 client...")
    r2 = boto3.client(
        service_name='s3',
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4')
    )
    
    print("Listing buckets to verify access...")
    response = r2.list_buckets()
    print("Buckets found:")
    for bucket in response.get('Buckets', []):
        print(f"  - {bucket['Name']}")
        
    print(f"\nListing objects in '{R2_BUCKET_NAME}'...")
    objects_resp = r2.list_objects_v2(Bucket=R2_BUCKET_NAME)
    print("Objects found:")
    for obj in objects_resp.get('Contents', []):
        print(f"  - {obj['Key']} ({obj['Size']} bytes)")
        
    print("\nUploading test file...")
    test_key = "test_verification.txt"
    test_data = b"This is a verification file to test Cloudflare R2 bucket integration."
    r2.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=test_key,
        Body=test_data,
        ContentType="text/plain"
    )
    print(f"Uploaded test file under key: {test_key}")
    
    print("\nGenerating presigned URL...")
    url = r2.generate_presigned_url(
        ClientMethod='get_object',
        Params={
            'Bucket': R2_BUCKET_NAME,
            'Key': test_key
        },
        ExpiresIn=3600
    )
    print(f"Presigned URL (valid for 1h): {url}")
    
    print("\nVerification completed successfully!")
    
except Exception as e:
    print(f"\nError occurred during R2 verification: {e}")
