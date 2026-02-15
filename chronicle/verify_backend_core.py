import json
import time
import urllib.request
import urllib.error
import sys

# Configuration
API_BASE = "http://localhost:8000/api/v1/version-control"
USER_ID = "00000000-0000-0000-0000-000000000000"

def make_request(method, endpoint, data=None):
    url = f"{API_BASE}{endpoint}"
    req = urllib.request.Request(url, method=method)
    req.add_header('Content-Type', 'application/json')
    
    if data:
        json_data = json.dumps(data).encode('utf-8')
        req.add_header('Content-Length', len(json_data))
    
    start_time = time.time()
    try:
        if data:
            response = urllib.request.urlopen(req, json_data)
        else:
            response = urllib.request.urlopen(req)
        
        duration = (time.time() - start_time) * 1000 # ms
        body = response.read().decode('utf-8')
        if not body or response.getcode() == 204:
            return {}, duration

        try:
            return json.loads(body), duration
        except json.JSONDecodeError:
            print(f"❌ JSON Decode Error on {method} {endpoint}")
            print(f"Response Body: {body}")
            sys.exit(1)
        
    except urllib.error.HTTPError as e:
        print(f"❌ API Error {e.code} on {method} {endpoint}: {e.read().decode('utf-8')}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"❌ Connection Error: {e.reason}. Is the backend running at {API_BASE}?")
        sys.exit(1)

def run_verification():
    print(f"Starting Backend Verification against {API_BASE}...\n")

    # 1. Create Prompt
    print("1. Creating a new Prompt...")
    unique_key = f"test-prompt-{int(time.time())}"
    prompt_payload = {
        "key": unique_key,
        "title": "Backend Verification Test",
        "created_by": USER_ID
    }
    prompt_data, t_create = make_request("POST", "/prompts", prompt_payload)
    prompt_id = prompt_data['prompt_id']
    print(f"   Created Prompt ID: {prompt_id} ({t_create:.2f}ms)")

    # 2. Add Versions (Stress Test)
    print("\n2. Adding 10 Versions...")
    versions = []
    total_version_time = 0
    
    for i in range(1, 11):
        v_payload = {
            "prompt_id": prompt_id,
            "prompt_text": f"This is version {i} of the prompt.",
            "created_by": USER_ID,
            "model_settings": {"usage": {"total_cost": 0.001 * i}}
        }
        v_data, t_v = make_request("POST", "/versions", v_payload)
        versions.append(v_data)
        total_version_time += t_v
        print(f"   - Created v{i} (ID: {v_data['version_id']}) in {t_v:.2f}ms")

    avg_v_time = total_version_time / 10
    print(f"   Added 10 versions. Avg time: {avg_v_time:.2f}ms/req")

    # 3. Verify Prompt List (Efficiency Check)
    print("\n3. Fetching Prompt List (Checking 'latest_version' pre-fetching)...")
    prompts_list, t_list = make_request("GET", "/prompts")
    
    # Find our prompt
    target_prompt = next((p for p in prompts_list if p['prompt_id'] == prompt_id), None)
    
    if not target_prompt:
        print("   Created prompt not found in list!")
        sys.exit(1)
        
    print(f"   Fetched {len(prompts_list)} prompts in {t_list:.2f}ms")
    
    # Verify latest_version is present and correct
    if 'latest_version' in target_prompt and target_prompt['latest_version']:
        lv = target_prompt['latest_version']
        print(f"   'latest_version' is present in response (Denormalization working!)")
        print(f"   - ID: {lv['version_id']}")
        print(f"   - Text: {lv['prompt_text']}")
        
        if lv['version_id'] == versions[-1]['version_id']:
             print("   Latest version matches the last created version.")
        else:
             print(f"   Mismatch! Expected {versions[-1]['version_id']}, got {lv['version_id']}")
    else:
        print("   'latest_version' field missing or null. N+1 optimization might not be active.")

    # 4. Fetch History
    print(f"\n4. Fetching History for {prompt_id}...")
    history, t_hist = make_request("GET", f"/versions/{prompt_id}/history")
    print(f"   Fetched {len(history)} history items in {t_hist:.2f}ms")
    
    if len(history) != 10:
        print(f"   Expected 10 items, got {len(history)}")
    else:
        print("   Count matches.")

    # 5. Cleanup (Optional, but good for repeatability)
    print(f"\n5. Cleaning up (Deleting Query)...")
    _, t_del = make_request("DELETE", f"/prompts/{prompt_id}?permanent=true")
    print(f"   Deleted prompt in {t_del:.2f}ms")

    print("\nVerification Complete!")

if __name__ == "__main__":
    run_verification()
