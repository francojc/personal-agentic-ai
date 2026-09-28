#!/usr/bin/env python3
"""Build the whitepaper with Pandoc and Typst; preserve the Markdown source."""
from pathlib import Path
import html
import json
import math
import re
import subprocess
import textwrap

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BUILD = HERE / 'build'
BUILD.mkdir(exist_ok=True)
source = ROOT / 'Agentic_Work_Control_Planes_Whitepaper_Draft.md'
ast = json.loads(subprocess.check_output(['pandoc', str(source), '-f', 'markdown', '-t', 'json']))


def diagram(code, number):
    labels = dict(re.findall(r'(\w+)\["([^"]+)"\]', code))
    edges = re.findall(r'(\w+)(?:\["[^"]+"\])?\s*-->\s*(\w+)', code)
    keys = list(labels)
    if number == 1:
        width, height = 1000, 760
        positions = {'H': (500, 65), 'W': (500, 205), 'D': (500, 345), 'R': (500, 485), 'G': (250, 675), 'T': (750, 675)}
        box_w, box_h = 420, 94
    else:
        width, height = 1000, 740
        positions = {key: (500 + 340 * math.sin(2 * math.pi * i / len(keys)), 370 - 270 * math.cos(2 * math.pi * i / len(keys))) for i, key in enumerate(keys)}
        box_w, box_h = 280, 92
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">', '<defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="8" refY="5" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="#527181" stroke-width="1.6"/></marker></defs>']
    def boundary(a, b):
        dx, dy = b[0]-a[0], b[1]-a[1]
        scale = min((box_w/2+7)/abs(dx) if dx else float('inf'), (box_h/2+7)/abs(dy) if dy else float('inf'))
        return a[0]+dx*scale, a[1]+dy*scale
    for a, b in edges:
        if (b, a) in edges and keys.index(a) > keys.index(b):
            continue
        start = ' marker-start="url(#arrow)"' if (b, a) in edges else ''
        if number == 1 and (a, b) == ('R', 'W'):
            path = 'M 720 485 H 965 V 205 H 720'
        else:
            x1, y1 = boundary(positions[a], positions[b])
            x2, y2 = boundary(positions[b], positions[a])
            path = f'M {x1} {y1} L {x2} {y2}'
        parts.append(f'<path d="{path}" fill="none" stroke="#527181" stroke-width="3" marker-end="url(#arrow)"{start}/>')
    colors = ['#fff0e6', '#eaf5ee', '#f1edff', '#e8f6f7', '#eaf1ff', '#fff6df', '#edf2f6']
    for i, (key, label) in enumerate(labels.items()):
        x, y = positions[key]
        lines = textwrap.wrap(label, width=34 if number == 1 else 24)
        parts.append(f'<rect x="{x-box_w/2}" y="{y-box_h/2}" width="{box_w}" height="{box_h}" rx="14" fill="{colors[i]}" stroke="#a8bcc6" stroke-width="1.5"/>')
        for j, line in enumerate(lines):
            yy = y - (len(lines)-1)*14 + j*28 + 8
            parts.append(f'<text x="{x}" y="{yy}" text-anchor="middle" font-family="Arial" font-size="24" fill="#172b3a">{html.escape(line)}</text>')
    parts.append('</svg>')
    (BUILD / f'diagram-{number}.svg').write_text('\n'.join(parts))


# Move the original title, subtitle, and publication metadata to the cover.
assert ast['blocks'][0]['t'] == 'Header'
assert ast['blocks'][1]['t'] == 'Header'
assert ast['blocks'][2]['t'] == 'Para'
ast['blocks'] = ast['blocks'][3:]
count = 0
captions = ['Conceptual architecture and feedback paths', 'Research as a human learning loop', 'A horizon scan with an evidence trail']
for block in ast['blocks']:
    if block['t'] == 'Header':
        block['c'][0] -= 1
    if block['t'] == 'CodeBlock' and 'mermaid' in block['c'][0][1]:
        count += 1
        diagram(block['c'][1], count)
        block.update(t='RawBlock', c=['typst', f'#figure(image("diagram-{count}.svg", width: 85%), caption: [{captions[count-1]}])'])
assert count == 3
body = subprocess.check_output(['pandoc', '-f', 'json', '-t', 'typst', '--wrap=none'], input=json.dumps(ast).encode()).decode()
# Pandoc wraps tables in centered figures; left-align text for readable prose cells.
body = re.sub(r'align: \((?:auto,)+\)', lambda match: match.group().replace('auto', 'left'), body)
template = (HERE / 'template.typ').read_text()
(BUILD / 'paos.typ').write_text(template + '\n' + body)
subprocess.run(['typst', 'compile', str(BUILD / 'paos.typ'), str(ROOT / 'paos.pdf')], check=True)
print(f'Built {ROOT / "paos.pdf"}')
