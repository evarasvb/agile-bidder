#!/usr/bin/env python3
"""Print only deployable slugs affected by two Git snapshots; never deploy anything.

Python 3.11+ and Git only. Static relative import/export, literal import()/require()
and transitive dependencies are supported. Dynamic module expressions fail closed.
--after WORKTREE is a read-only local review convenience, never used by CI.
"""
import argparse
import functools
import pathlib
import posixpath
import re
import subprocess
import sys
import tomllib

PREFIX = 'supabase/functions/'
CONFIG = 'supabase/config.toml'
SLUG = re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]*\Z')
CODE_SUFFIXES = {'.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'}
TOKEN = re.compile(r'''(?P<comment>//[^\n]*|/\*[\s\S]*?\*/)|(?P<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(?P<word>[A-Za-z_$][\w$]*)|(?P<other>[^\s])''')


class SelectionError(ValueError):
    pass


def git(repo, *args):
    result = subprocess.run(['git', '-C', str(repo), *args], capture_output=True)
    if result.returncode:
        raise SelectionError(f'Git failed ({args[0]}): {result.stderr.decode(errors="replace").strip()}')
    return result.stdout


class Snapshot:
    def __init__(self, repo, revision):
        self.repo = pathlib.Path(repo)
        self.worktree = revision == 'WORKTREE'
        if self.worktree:
            self.revision = revision
            paths = git(repo, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split(b'\0')
            self.paths = {p.decode() for p in paths if p and (self.repo / p.decode()).exists()}
        else:
            if not revision or revision.startswith('-'):
                raise SelectionError('A valid Git revision is required')
            self.revision = git(repo, 'rev-parse', '--verify', '--end-of-options', f'{revision}^{{commit}}').decode().strip()
            entries = [entry.split(b'\t', 1) for entry in git(repo, 'ls-tree', '-r', '-z', self.revision).split(b'\0') if entry]
            self.modes = {path.decode(): metadata.split()[0] for metadata, path in entries}
            self.paths = set(self.modes)
        self.functions = {p[len(PREFIX):].split('/')[0] for p in self.paths if p.startswith(PREFIX) and '/' in p[len(PREFIX):] and SLUG.fullmatch(p[len(PREFIX):].split('/')[0])}
        try:
            self.config = tomllib.loads(self.read(CONFIG).decode()) if CONFIG in self.paths else {}
        except (UnicodeError, tomllib.TOMLDecodeError) as error:
            raise SelectionError(f'Invalid {CONFIG}: {error}') from error
        configured = self.config.get('functions', {})
        if not isinstance(configured, dict):
            raise SelectionError('Invalid functions configuration')
        for name, settings in configured.items():
            if not SLUG.fullmatch(name) or not isinstance(settings, dict) or not isinstance(settings.get('verify_jwt', True), bool):
                raise SelectionError(f'Invalid function/verify_jwt configuration: {name}')

    @functools.cache
    def read(self, path):
        if path not in self.paths:
            raise SelectionError(f'Missing dependency in {self.revision}: {path}')
        if self.worktree:
            source = self.repo / path
            if source.is_symlink() or not source.is_file():
                raise SelectionError(f'Dependency must be a regular file: {path}')
            return source.read_bytes()
        # Reject links/submodules instead of silently missing their dependencies.
        if self.modes[path] not in {b'100644', b'100755'}:
            raise SelectionError(f'Dependency must be a regular file: {path}')
        return git(self.repo, 'show', f'{self.revision}:{path}')

    def root(self, function):
        entrypoint = self.config.get('functions', {}).get(function, {}).get('entrypoint')
        if entrypoint is None:
            entrypoint = f'./functions/{function}/index.ts'
        if not isinstance(entrypoint, str) or not entrypoint.startswith('./'):
            raise SelectionError(f'Unsupported entrypoint for {function}: {entrypoint!r}')
        path = posixpath.normpath(posixpath.join('supabase', entrypoint))
        if not path.startswith(PREFIX) or path not in self.paths:
            raise SelectionError(f'Missing/unsafe entrypoint for {function}: {path}')
        return path


def module_specifiers(source, filename):
    """Ignore comments and quoted text, then inspect import/export syntax tokens."""
    tokens = [(match.lastgroup, match.group()) for match in TOKEN.finditer(source) if match.lastgroup != 'comment']

    def literal(index):
        if index >= len(tokens) or tokens[index][0] != 'string':
            raise SelectionError(f'Nonliteral module dependency in {filename}; selection cannot be exact')
        value = tokens[index][1][1:-1]
        if '\\' in value or '${' in value:
            raise SelectionError(f'Escaped/interpolated module dependency in {filename}')
        return value

    for i, (kind, token) in enumerate(tokens):
        if kind != 'word' or token not in {'import', 'export', 'require'} or (i and tokens[i - 1][1] in {'.', '?.'}):
            continue
        next_value = tokens[i + 1][1] if i + 1 < len(tokens) else ''
        if token == 'require' or next_value == '(':
            if next_value == '(':
                specifier = literal(i + 2)
                if i + 3 >= len(tokens) or tokens[i + 3][1] not in {')', ','}:
                    raise SelectionError(f'Computed module dependency in {filename}')
                yield specifier
            continue
        if token == 'import' and i + 1 < len(tokens) and tokens[i + 1][0] == 'string':
            yield literal(i + 1)
            continue
        if next_value == '.':  # import.meta
            continue
        # export declarations without a from clause are not dependencies.
        if token == 'export' and next_value not in {'*', '{', 'type'}:
            continue
        depth = 0
        for j in range(i + 1, len(tokens)):
            item_kind, item = tokens[j]
            if item == ';' or (item_kind == 'word' and item in {'import', 'export', 'const', 'function', 'class'}):
                break
            if item == '{':
                depth += 1
            elif item == '}':
                depth -= 1
            if depth == 0 and item_kind == 'word' and item == 'from':
                yield literal(j + 1)
                break


def dependencies(snapshot, start):
    visited = set()
    pending = [start]
    while pending:
        path = pending.pop()
        if path in visited:
            continue
        visited.add(path)
        content = snapshot.read(path)
        if pathlib.PurePosixPath(path).suffix not in CODE_SUFFIXES:
            continue
        try:
            specifiers = module_specifiers(content.decode('utf-8'), path)
            for specifier in specifiers:
                if not specifier.startswith('.'):
                    continue
                target = posixpath.normpath(posixpath.join(posixpath.dirname(path), specifier))
                if not target.startswith(PREFIX):
                    raise SelectionError(f'Relative dependency outside functions is unsupported: {path}: {specifier}')
                if target not in snapshot.paths:
                    raise SelectionError(f'Unresolved relative dependency: {path}: {specifier}')
                pending.append(target)
        except UnicodeError as error:
            raise SelectionError(f'Invalid UTF-8 source: {path}') from error
    return visited


def select_functions(before, after, manual=None):
    if manual is not None:
        selected = set(manual.split())
        if not selected or any(not SLUG.fullmatch(name) or name not in after.functions for name in selected):
            raise SelectionError('Manual selection contains an invalid or missing function')
        for name in selected:
            after.root(name)
        return sorted(selected)
    if before is None:
        raise SelectionError('--before is required without --manual')
    candidates = {p for p in before.paths | after.paths if p.startswith(PREFIX) or p == CONFIG}
    changed = {p for p in candidates if p not in before.paths or p not in after.paths or before.read(p) != after.read(p)}
    selected = set()
    for name in after.functions:
        own_folder = f'{PREFIX}{name}/'
        own_change = any(path.startswith(own_folder) for path in changed)
        previous_jwt = before.config.get('functions', {}).get(name, {}).get('verify_jwt', True)
        current_jwt = after.config.get('functions', {}).get(name, {}).get('verify_jwt', True)
        current_dependencies = dependencies(after, after.root(name))
        previous_dependencies = dependencies(before, before.root(name)) if name in before.functions else set()
        if own_change or previous_jwt != current_jwt or changed & (current_dependencies | previous_dependencies):
            selected.add(name)
    return sorted(selected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default='.')
    parser.add_argument('--before')
    parser.add_argument('--after', required=True)
    parser.add_argument('--manual')
    args = parser.parse_args()
    try:
        after = Snapshot(args.repo, args.after)
        before = Snapshot(args.repo, args.before) if args.before and args.manual is None else None
        functions = select_functions(before, after, args.manual)
    except (SelectionError, OSError, UnicodeError) as error:
        print(f'Edge function selection failed: {error}', file=sys.stderr)
        return 2
    if functions:
        print('\n'.join(functions))
    return 0


if __name__ == '__main__':
    sys.exit(main())
