import os

files = [
    'chronicle_cli/main.py',
    'chronicle_cli/commands/init.py',
    'chronicle_cli/commands/use.py',
    'chronicle_cli/commands/list.py',
    'chronicle_cli/commands/versions.py',
    'chronicle_cli/commands/execute.py'
]

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'main.py' in filepath:
        # welcome panel border
        content = content.replace('border_style="#ff7849"', 'border_style="#6366f1"')
        # replace logo colors
        content = content.replace('[#ff7849]██', '[#0ea5e9]██')
        content = content.replace('[/#ff7849]', '[/#0ea5e9]')
        content = content.replace('[#ff7849] ╚', '[#0ea5e9] ╚')
        # command list colors
        content = content.replace('[bold #ff7849]', '[bold #0ea5e9]')
        content = content.replace('[/bold #ff7849]', '[/bold #0ea5e9]')
    else:
        # For commands directory
        content = content.replace('#ff7849', '#0ea5e9')
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Blue theme applied successfully.")
