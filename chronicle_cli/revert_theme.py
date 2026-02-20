import os

files = [
    'chronicle_cli/main.py',
    'chronicle_cli/commands/init.py',
    'chronicle_cli/commands/use.py',
    'chronicle_cli/commands/list.py',
    'chronicle_cli/commands/versions.py',
    'chronicle_cli/commands/execute.py',
    'chronicle_cli/client.py'
]

gradient = [
    '#0ea5e9',
    '#0EA5E9',
    '#1f98eb',
    '#308bee',
    '#417df0',
    '#5270f2',
    '#6366f1',
    '#6366F1'
]

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Revert gradient colors
    for color in gradient:
        content = content.replace(color, '#ff7849')
        content = content.replace(color.upper(), '#ff7849')

    # Revert green to original #4ade80
    content = content.replace('#22c55e', '#4ade80')
    content = content.replace('#22C55E', '#4ade80')

    # Special handling for main.py border style
    if 'main.py' in filepath:
        content = content.replace('border_style="white"', 'border_style="#ff7849"')
        
        # Command menu colors
        for cmd in ['init', 'use', 'list', 'versions', 'execute']:
            content = content.replace(f'[bold white]{cmd}[/bold white]', f'[bold #ff7849]{cmd}[/bold #ff7849]')
            
    else:
        # For other files, replace [bold white] back to [bold #ff7849]
        content = content.replace('[bold white]', '[bold #ff7849]')
        content = content.replace('[/bold white]', '[/bold #ff7849]')
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Theme reverted to orange successfully.")
