import urllib.request, json
req = urllib.request.Request('http://localhost:8000/api/v1/eval/compare/dataset/fffe2cc9-8aa3-4172-b709-f83fb456ffaa', headers={'X-API-Key': 'chronicle-dev-key'})
res = urllib.request.urlopen(req).read().decode('utf-8')
data = json.loads(res)
print('COMPARED_JOBS:', data['compared_jobs'])
print('PARETO_COUNT:', data['pareto_optimal_count'])
print('KNEE_POINT:', data['knee_point_job_id'])
print('RECOMMENDATION:', data['recommendation'])
print('--- JOBS ---')
for j in data['jobs']:
    print(f"Job {j['job_id']} (v{j['version_id']} {j['model']}) Acc={j['accuracy']} Cost={j['cost_per_correct']} Optimal={j['is_pareto_optimal']}")
