import csv
import json
import io

def simulate_upload(csv_text):
    print("Simulating upload...")
    reader = csv.DictReader(io.StringIO(csv_text))
    
    # Check fieldnames (this part is in routes.py 133-134)
    if not reader.fieldnames or "input_vars" not in reader.fieldnames or "expected_output" not in reader.fieldnames:
        print("Error: Required columns missing")
        return

    imported = 0
    skipped = 0
    errors = []
    
    # This is the loop in routes.py 142 onwards
    for row_idx, row in enumerate(reader, start=2):
        print(f"Processing Row {row_idx}: {row}")
        try:
            # BUG: row.get("column", "") returns None if key exists but value is empty in some CSV parses
            # or if the row is malformed.
            expected = row.get("expected_output", "").strip()
            if not expected:
                skipped += 1
                errors.append(f"Row {row_idx}: expected_output is empty")
                continue
                
            input_vars_str = row.get("input_vars", "").strip()
            input_vars = json.loads(input_vars_str)
            
            imported += 1
            print(f"  Row {row_idx} Success")
        except AttributeError as e:
            print(f"  CRITICAL BUG: AttributeError on row {row_idx}: {e}")
            raise
        except Exception as e:
            skipped += 1
            errors.append(f"Row {row_idx}: {str(e)}")
            print(f"  Row {row_idx} Skipped: {e}")

    print(f"Result: Imported {imported}, Skipped {skipped}, Total Errors: {len(errors)}")

# Case 1: Row with missing column (e.g. trailing space row)
# DictReader often returns {'input_vars': ' ', 'expected_output': None} for a row with just a space
malformed_csv = "input_vars,expected_output\n{'name': 'test'},output1\n \n"
try:
    simulate_upload(malformed_csv)
except Exception as e:
    print(f"\nFAILED as expected: {e}")
