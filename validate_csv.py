import csv
import json
import io

def validate_csv(filepath):
    print(f"Validating {filepath}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                print("Error: No fieldnames found")
                return
            
            print(f"Fieldnames: {reader.fieldnames}")
            
            required = ["input_vars", "expected_output"]
            for req in required:
                if req not in reader.fieldnames:
                    print(f"Error: Missing column '{req}'")
                    return

            imported = 0
            skipped = 0
            errors = []
            
            for row_idx, row in enumerate(reader, start=2):
                expected = row.get("expected_output", "").strip()
                if not expected:
                    skipped += 1
                    errors.append(f"Row {row_idx}: expected_output is empty")
                    continue
                
                input_vars_str = row.get("input_vars", "").strip()
                try:
                    if not input_vars_str:
                        raise ValueError("input_vars is empty")
                    input_vars = json.loads(input_vars_str)
                    if not isinstance(input_vars, dict):
                        raise ValueError("Must be a JSON object")
                except Exception as e:
                    skipped += 1
                    errors.append(f"Row {row_idx}: Invalid JSON in input_vars - {str(e)}")
                    continue
                
                imported += 1
            
            print(f"Summary: Imported: {imported}, Skipped: {skipped}")
            if errors:
                print("Errors:")
                for err in errors[:10]: # show first 10
                    print(f"  {err}")
                if len(errors) > 10:
                    print(f"  ... and {len(errors) - 10} more")
                    
    except UnicodeDecodeError as e:
        print(f"Error: Encoding issue - {e}")
    except Exception as e:
        print(f"Error: {e}")

validate_csv('Zomato_for_Chronicle.csv')
