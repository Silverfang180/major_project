import urllib.request, json, time

prompt_id = '6374dafd-2a75-47b2-b6ea-fcd2a0821b7d'
dataset_id = 'fffe2cc9-8aa3-4172-b709-f83fb456ffaa'
headers = {'X-API-Key': 'chronicle-dev-key', 'Content-Type': 'application/json'}
user_id = '00000000-0000-0000-0000-000000000099'

versions_data = [
    {
        'prompt_id': prompt_id,
        'prompt_text': 'Classify sentiment as positive, negative, or neutral.\nText: {{input_text}}\nReply with one word only.',
        'model_settings': {'model': 'llama-3.1-8b-instant', 'temperature': 0.0, 'max_tokens': 10},
        'change_note': 'Minimal one-shot, lowest cost target',
        'created_by': user_id
    },
    {
        'prompt_id': prompt_id,
        'prompt_text': 'You are a world-class sentiment analysis expert with deep expertise in computational linguistics and consumer psychology. Your task requires careful methodical analysis of the following customer review. Consider implicit emotional signals, rhetorical devices, negation patterns, and cultural context before reaching your determination. The three valid classifications are: positive, negative, or neutral.\n\nCustomer review to analyze: {{input_text}}\n\nProvide only your final classification label. No explanation needed.',
        'model_settings': {'model': 'llama-3.3-70b-versatile', 'temperature': 0.7, 'max_tokens': 50},
        'change_note': 'Verbose expert prompt, high cost target',
        'created_by': user_id
    },
    {
        'prompt_id': prompt_id,
        'prompt_text': 'Task: Sentiment classification\nInput: {{input_text}}\nLabels: positive | negative | neutral\nOutput format: single label lowercase',
        'model_settings': {'model': 'llama-3.3-70b-versatile', 'temperature': 0.0, 'max_tokens': 10},
        'change_note': 'Structured format, medium cost target',
        'created_by': user_id
    }
]

for idx, ver_payload in enumerate(versions_data):
    try:
        req = urllib.request.Request('http://localhost:8000/api/v1/version-control/versions', data=json.dumps(ver_payload).encode('utf-8'), headers=headers)
        res = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
        version_id = res['version_id']
        print(f'Created Version {version_id}')
        
        job_payload = {
            'prompt_id': prompt_id,
            'version_id': version_id,
            'dataset_id': dataset_id,
            'evaluators': ['exact_match', 'llm_judge'],
            'created_by': user_id
        }
        
        req_job = urllib.request.Request('http://localhost:8000/api/v1/eval/jobs', data=json.dumps(job_payload).encode('utf-8'), headers=headers)
        job_res = json.loads(urllib.request.urlopen(req_job).read().decode('utf-8'))
        job_id = job_res['job_id']
        print(f'Created Job {job_id} for Version {version_id}')
        
        while True:
            req_poll = urllib.request.Request(f'http://localhost:8000/api/v1/eval/jobs/{job_id}', headers=headers)
            poll_res = json.loads(urllib.request.urlopen(req_poll).read().decode('utf-8'))
            status = poll_res['status']
            print(f'  Job {job_id} status: {status}')
            if status in ['completed', 'failed']:
                break
            time.sleep(5)
    except Exception as e:
        print('HTTP ERROR:', e.read().decode('utf-8') if hasattr(e, 'read') else str(e))
