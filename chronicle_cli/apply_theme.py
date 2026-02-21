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
    '#0EA5E9',
    '#1F98EB',
    '#308BEE',
    '#417DF0',
    '#5270F2',
    '#6366F1',
]

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Gradient in main.py
    if 'main.py' in filepath:
        # replace block logo lines
        logo_lines = []
        grad_idx = 0
        for line in content.split('\n'):
            if '██' in line and '#ff7849' in line:
                color = gradient[grad_idx % len(gradient)]
                line = line.replace('#ff7849', color.lower())
                logo_lines.append(line)
                grad_idx += 1
            else:
                logo_lines.append(line)
        content = '\n'.join(logo_lines)
        
        # remove bold #ff7849 for command menu
        content = content.replace('[bold #ff7849]', '[bold white]')
        content = content.replace('[/bold #ff7849]', '[/bold white]')
        
        # welcome panel border style
        content = content.replace('border_style="#ff7849"', 'border_style="white"')
        
    else:
        # other files monochrome overrides
        content = content.replace('[bold #ff7849]', '[bold white]')
        content = content.replace('[/bold #ff7849]', '[/bold white]')
        
    # success/error states everywhere
    content = content.replace('#4ade80', '#22c55e')
    content = content.replace('#ef4444', '#ef4444')
    
    # rich standard tags
    content = content.replace('[green]', '[#22c55e]')
    content = content.replace('[/green]', '[/#22c55e]')
    content = content.replace('[red]', '[#ef4444]')
    content = content.replace('[/red]', '[/#ef4444]')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Theme applied successfully.")
