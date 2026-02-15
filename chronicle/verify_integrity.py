
import json
import urllib.request
import urllib.error
import time

API_BASE = "http://localhost:8000/api/v1/version-control"
USER_ID = "00000000-0000-0000-0000-000000000000"

def test_request(data):
    url = f"{API_BASE}/versions"
    req = urllib.request.Request(url, method="POST")
    req.add_header('Content-Type', 'application/json')
    json_data = json.dumps(data).encode('utf-8')
    
    try:
        response = urllib.request.urlopen(req, json_data)
        print(f"Success (201): {response.status}")
        return True
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"Rejected ({e.code}): {err_body}")
        return False

def verify_integrity():
    print("Starting Verifying Data Integrity (Pillar 3)...\n")
    
    # 1. First create a prompt to attach versions to
    print("Creating temporary prompt...")
    pid_req = urllib.request.Request(f"{API_BASE}/prompts", method="POST")
    pid_req.add_header('Content-Type', 'application/json')
    pid_body = json.dumps({"key": f"integrity-{int(time.time())}", "title": "Integrity Test", "created_by": USER_ID}).encode()
    pid_res = urllib.request.urlopen(pid_req, pid_body)
    prompt_id = json.loads(pid_res.read().decode())['prompt_id']

    # 2. Test VALID Data
    print("\n1. Testing VALID Data...")
    valid_payload = {
        "prompt_id": prompt_id,
        "prompt_text": "Valid test",
        "created_by": USER_ID,
        "model_settings": {
            "temperature": 0.7,
            "max_tokens": 100,
            "top_p": 0.9
        }
    }
    if test_request(valid_payload):
        print("   -> Correctly accepted valid data.")

    # 3. Test TYPO (Extra fields which are forbidden or just ignored? Pydantic ignores extra by default usually, unless config forbid)
    # Actually, default Pydantic V2 ignores extra fields. But let's check TYPE enforcement first.
    
    print("\n2. Testing INVALID TYPE (Str instead of Float)...")
    invalid_type = {
        "prompt_id": prompt_id,
        "prompt_text": "Invalid Type",
        "created_by": USER_ID,
        "model_settings": {
            "temperature": "very hot", 
        }
    }
    if not test_request(invalid_type):
        print("   -> Correctly rejected string where float expected.")

    print("\n3. Testing OUT OF RANGE (Temp > 2.0)...")
    out_of_range = {
        "prompt_id": prompt_id,
        "prompt_text": "Out of Range",
        "created_by": USER_ID,
        "model_settings": {
            "temperature": 5.0 
        }
    }
    if not test_request(out_of_range):
        print("   -> Correctly rejected temperature > 2.0.")

    print("\nIntegrity Verification Complete!")

if __name__ == "__main__":
    verify_integrity()
