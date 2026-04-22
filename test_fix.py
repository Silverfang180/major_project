import csv
import json
import io

def simulate_upload_fixed(csv_text):
    print("Simulating upload WITH FIX...")
    reader = csv.DictReader(io.StringIO(csv_text))
    
    if not reader.fieldnames or "input_vars" not in reader.fieldnames or "expected_output" not in reader.fieldnames:
        print("Error: Required columns missing")
        return

    imported = 0
    skipped = 0
    errors = []
    
    for row_idx, row in enumerate(reader, start=2):
        print(f"Processing Row {row_idx}: {row}")
        try:
            # FIXED LOGIC: (row.get(key) or "").strip()
            expected = (row.get("expected_output") or "").strip()
            if not expected:
                skipped += 1
                errors.append(f"Row {row_idx}: expected_output is empty")
                continue
                
            input_vars_str = (row.get("input_vars") or "").strip()
            if not input_vars_str:
                skipped += 1
                errors.append(f"Row {row_idx}: input_vars is empty")
                continue

            input_vars = json.loads(input_vars_str)
            
            imported += 1
            print(f"  Row {row_idx} Success")
        except Exception as e:
            skipped += 1
            errors.append(f"Row {row_idx}: {str(e)}")
            print(f"  Row {row_idx} Properly Handled/Skipped: {e}")

    print(f"\nResult: Imported {imported}, Skipped {skipped}, Total Errors: {len(errors)}")
    return imported, skipped

# Case 1: Row with missing column (e.g. trailing space row)
malformed_csv = "input_vars,expected_output\n{\"name\": \"test\"},output1\n \n"
print("-" * 30)
imported, skipped = simulate_upload_fixed(malformed_csv)
if imported == 1 and skipped == 1:
    print("\nVERIFIED: Fix handles malformed rows without crashing!")
else:
    print("\nFAILED: Fix did not behave as expected.")

# Case 2: Zomato subset validation
zomato_head = """input_vars,expected_output
"{\"name\": \"Jalsa\", \"online_order\": \"Yes\"}",Buffet
"{\"name\": \"Spice Elephant\", \"online_order\": \"Yes\"}",Buffet
"""
print("-" * 30)
imported, skipped = simulate_upload_fixed(zomato_head)
if imported == 2 and skipped == 0:
    print("\nVERIFIED: Fix still works for correct Zomato formatting!")
