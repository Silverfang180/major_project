import csv
import json
import os

input_file = r"c:\Users\shaik\Desktop\major_project\Zomato data .csv"
output_file = r"c:\Users\shaik\Desktop\major_project\Zomato_for_Chronicle.csv"

if not os.path.exists(input_file):
    print(f"Error: {input_file} not found.")
    exit(1)

with open(input_file, 'r', encoding='utf-8') as f_in, \
     open(output_file, 'w', encoding='utf-8', newline='') as f_out:
    
    reader = csv.DictReader(f_in)
    writer = csv.DictWriter(f_out, fieldnames=["input_vars", "expected_output"])
    writer.writeheader()
    
    for row in reader:
        # Map everything except 'listed_in(type)' to input_vars
        input_vars = {k: v for k, v in row.items() if k != "listed_in(type)"}
        expected_output = row.get("listed_in(type)", "")
        
        writer.writerow({
            "input_vars": json.dumps(input_vars),
            "expected_output": expected_output
        })

print(f"Successfully transformed {input_file} to {output_file}")
