import sys
import json
import urllib.request
import urllib.error
import time

BASE_URL = "http://localhost:8000/api/v1/version-control"
API_KEY = "chronicle-dev-key"  # From config.py

def make_request(method, endpoint, data=None):
    url = f"{BASE_URL}{endpoint}"
    if data:
        data = json.dumps(data).encode('utf-8')
    
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    req.add_header('X-API-Key', API_KEY)
    
    try:
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            try:
                body = response.read().decode('utf-8')
                result = json.loads(body) if body else {}
            except:
                result = {}
            return status, result
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(error_body)
        except:
            return e.code, {"detail": error_body}
    except Exception as e:
        print(f"Error: {e}")
        return 500, {}

def run_verification():
    print("--- Verifying Soft Delete Implementation ---")
    
    # 1. Create Prompt
    print("\n1. Create Prompt...")
    status, prompt = make_request("POST", "/prompts", {
        "title": "Soft Delete Test",
        "created_by": "00000000-0000-0000-0000-000000000001"
    })
    if status != 201:
        print(f"FAILED: Could not create prompt. Status: {status}")
        print(prompt)
        return
    prompt_id = prompt["prompt_id"]
    print(f"SUCCESS: Created prompt {prompt_id} ({prompt['key']})")

    # 2. Soft Delete Prompt
    print("\n2. Soft Delete Prompt...")
    status, _ = make_request("DELETE", f"/prompts/{prompt_id}")
    if status != 204:
        print(f"FAILED: Soft delete failed. Status: {status}")
        return
    print("SUCCESS: Soft deleted prompt")

    # 3. Verify hidden from active list
    print("\n3. Verify Hidden from Active List...")
    status, prompts = make_request("GET", "/prompts")
    found = any(p["prompt_id"] == prompt_id for p in prompts)
    if found:
        print("FAILED: Prompt still visible in active list")
        return
    print("SUCCESS: Prompt hidden from active list")

    # 4. Verify present in Trash Bin
    print("\n4. Verify Present in Trash Bin...")
    status, trash = make_request("GET", "/prompts/trash/all")
    found = any(p["prompt_id"] == prompt_id for p in trash)
    if not found:
        print("FAILED: Prompt not found in trash bin")
        return
    print("SUCCESS: Prompt found in trash bin")

    # 5. Restore Prompt
    print("\n5. Restore Prompt...")
    status, restored = make_request("POST", f"/prompts/{prompt_id}/restore", None)
    if status != 200:
        print(f"FAILED: Restore failed. Status: {status}")
        print(restored)
        return
    print("SUCCESS: Restored prompt")

    # 6. Verify back in Active List
    print("\n6. Verify Back in Active List...")
    status, prompts = make_request("GET", "/prompts")
    found = any(p["prompt_id"] == prompt_id for p in prompts)
    if not found:
        print("FAILED: Prompt not visible after restore")
        return
    print("SUCCESS: Prompt back in active list")

    # 7. Create Version
    print("\n7. Create Version...")
    status, version = make_request("POST", "/versions", {
        "prompt_id": prompt_id,
        "prompt_text": "v1 text",
        "created_by": "00000000-0000-0000-0000-000000000001"
    })
    if status != 201:
        print(f"FAILED: Create version failed. Status: {status}")
        print(version)
        return
    version_id = version["version_id"]
    print(f"SUCCESS: Created version {version_id}")

    # 8. Soft Delete Version
    print("\n8. Soft Delete Version...")
    status, _ = make_request("DELETE", f"/versions/{version_id}")
    if status != 204:
        print(f"FAILED: Soft delete version failed. Status: {status}")
        return
    print("SUCCESS: Soft deleted version")
    
    # 9. Verify Version in Trash
    print("\n9. Verify Version in Trash...")
    status, trash_v = make_request("GET", "/versions/trash/all")
    found = any(v["version_id"] == version_id for v in trash_v)
    if not found:
        print("FAILED: Version not in trash bin")
        return
    print("SUCCESS: Version found in trash bin")

    # 10. Restore Version
    print("\n10. Restore Version...")
    status, _ = make_request("POST", f"/versions/{version_id}/restore", None)
    print("SUCCESS: Version restored")
    
    # Clean up (Permanent Delete)
    print("\n11. Cleanup (Permanent Delete)...")
    make_request("DELETE", f"/prompts/{prompt_id}?permanent=true")
    print("SUCCESS: Cleanup done")

    print("\n--- ALL TESTS PASSED ---")

if __name__ == "__main__":
    run_verification()
