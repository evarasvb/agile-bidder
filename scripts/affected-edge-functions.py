"""Print Edge Functions importing changed files, including transitive imports."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
functions = root / 'supabase/functions'
changed = {root.joinpath(line.strip()).resolve() for line in sys.stdin if line.strip()}
imports = re.compile(r"(?:from\s+|import\s*\(\s*|import\s+)[\"']([^\"']+)[\"']")

def dependencies(file, seen):
    file = file.resolve()
    if file in seen or not file.is_file():
        return
    seen.add(file)
    for name in imports.findall(file.read_text()):
        if not name.startswith('.'):
            continue
        target = (file.parent / name).resolve()
        if target.is_relative_to(functions):
            dependencies(target, seen)

for folder in sorted(functions.iterdir()):
    if not folder.is_dir() or folder.name.startswith('_'):
        continue
    seen = set()
    for source in folder.rglob('*.ts'):
        dependencies(source, seen)
    if seen & changed:
        print(folder.name)
