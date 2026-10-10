"""Offline selector fixtures. Every Git write is confined to a temporary repository."""
import importlib.util
import pathlib
import subprocess
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name('select-edge-functions.py')
SPEC = importlib.util.spec_from_file_location('edge_selection', SCRIPT)
selector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(selector)


class DeploySelectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='edge-selector-test-')
        self.addCleanup(self.temp.cleanup)
        self.repo = pathlib.Path(self.temp.name)
        self.git('init', '-q')
        self.write('supabase/config.toml', '[functions.alpha]\nverify_jwt = true\n[functions.beta]\nverify_jwt = false\n[functions.payments]\nverify_jwt = true\n')
        self.write('supabase/functions/alpha/index.ts', 'import { bridge } from "../_shared/bridge.ts";\n')
        self.write('supabase/functions/beta/index.ts', 'import "../_shared/unrelated.ts";\n')
        self.write('supabase/functions/payments/index.ts', 'import "../_shared/payment.ts";\n')
        self.write('supabase/functions/_shared/bridge.ts', 'export { leaf as bridge } from "./leaf.ts";\n')
        self.write('supabase/functions/_shared/leaf.ts', 'export const leaf = 1;\n')
        self.write('supabase/functions/_shared/unrelated.ts', 'export const unrelated = 1;\n')
        self.write('supabase/functions/_shared/payment.ts', 'export const payment = 1;\n')
        self.before = self.commit()

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), '-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Local selector fixture', '-c', 'user.email=fixture@example.invalid', *args], stderr=subprocess.DEVNULL).decode().strip()

    def write(self, path, source):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(source)

    def commit(self):
        self.git('add', '.')
        self.git('commit', '-qm', 'Local fixture')
        return self.git('rev-parse', 'HEAD')

    def selected(self, after='WORKTREE', manual=None):
        return selector.select_functions(selector.Snapshot(self.repo, self.before), selector.Snapshot(self.repo, after), manual)

    def test_transitive_shared_change_selects_only_its_consumer(self):
        self.write('supabase/functions/_shared/leaf.ts', 'export const leaf = 2;\n')
        self.assertEqual(self.selected(self.commit()), ['alpha'])

    def test_direct_shared_change_does_not_select_payments(self):
        self.write('supabase/functions/_shared/unrelated.ts', 'export const unrelated = 2;\n')
        self.assertEqual(self.selected(), ['beta'])

    def test_unreferenced_shared_file_selects_nothing(self):
        self.write('supabase/functions/_shared/unused.ts', 'export const unused = 2;\n')
        self.assertEqual(self.selected(), [])

    def test_own_folder_change_is_preserved_even_for_an_unimported_file(self):
        self.write('supabase/functions/beta/note.txt', 'Updated own-folder file')
        self.assertEqual(self.selected(), ['beta'])

    def test_removed_shared_import_uses_both_graphs(self):
        (self.repo / 'supabase/functions/_shared/leaf.ts').unlink()
        self.write('supabase/functions/_shared/bridge.ts', 'export const bridge = 3;\n')
        self.assertEqual(self.selected(self.commit()), ['alpha'])

    def test_renamed_transitive_module_is_resolved_exactly(self):
        (self.repo / 'supabase/functions/_shared/leaf.ts').rename(self.repo / 'supabase/functions/_shared/renamed.ts')
        self.write('supabase/functions/_shared/bridge.ts', 'export { leaf as bridge } from "./renamed.ts";\n')
        self.assertEqual(self.selected(self.commit()), ['alpha'])

    def test_deleted_import_still_referenced_fails_closed(self):
        (self.repo / 'supabase/functions/_shared/leaf.ts').unlink()
        with self.assertRaisesRegex(selector.SelectionError, 'Unresolved relative dependency'):
            self.selected()

    def test_deleted_function_is_not_deployed(self):
        (self.repo / 'supabase/functions/beta/index.ts').unlink()
        self.assertEqual(self.selected(self.commit()), [])

    def test_changed_verify_jwt_selects_only_exact_function(self):
        self.write('supabase/config.toml', '[functions.alpha]\nverify_jwt = false\n[functions.beta]\nverify_jwt = false\n[functions.payments]\nverify_jwt = true\n')
        self.assertEqual(self.selected(), ['alpha'])

    def test_removed_verify_jwt_restores_default_and_selects_function(self):
        self.write('supabase/config.toml', '[functions.alpha]\nverify_jwt = true\n[functions.beta]\n[functions.payments]\nverify_jwt = true\n')
        self.assertEqual(self.selected(), ['beta'])

    def test_unrelated_config_comment_does_not_deploy(self):
        self.write('supabase/config.toml', (self.repo / 'supabase/config.toml').read_text() + '\n# comment only\n')
        self.assertEqual(self.selected(), [])

    def test_manual_list_preserves_sorted_explicit_selection(self):
        self.assertEqual(self.selected(manual='beta alpha beta'), ['alpha', 'beta'])

    def test_invalid_manual_slugs_and_paths_fail_closed(self):
        for manual in ('missing', '../_shared', 'alpha;echo', '--project-ref', 'alpha payments/more', ''):
            with self.subTest(manual=manual), self.assertRaises(selector.SelectionError):
                self.selected(manual=manual)

    def test_invalid_revision_fails_clearly(self):
        with self.assertRaises(selector.SelectionError):
            selector.Snapshot(self.repo, 'not-a-real-revision')

    def test_invalid_toml_and_nonboolean_verify_jwt_fail(self):
        for config in ('[broken', '[functions.alpha]\nverify_jwt = "false"\n'):
            self.write('supabase/config.toml', config)
            with self.assertRaises(selector.SelectionError):
                self.selected()

    def test_comments_and_prompt_strings_are_not_dependencies(self):
        source = '''// import "./fake-a.ts";
/* export * from './fake-b.ts'; */
const prompt = `import './fake-c.ts';`;
const other = "export * from './fake-d.ts';";
import { from as alias } from './real.ts';
export { alias as from } from './other.ts';
'''
        self.assertEqual(list(selector.module_specifiers(source, 'fixture.ts')), ['./real.ts', './other.ts'])

    def test_literal_dynamic_import_require_and_side_effect_imports(self):
        source = "const a = import('./a.ts'); const b = require('./b.ts'); import './c.ts'; export * from './d.ts'; import.meta.url;"
        self.assertEqual(list(selector.module_specifiers(source, 'fixture.ts')), ['./a.ts', './b.ts', './c.ts', './d.ts'])

    def test_nonliteral_import_fails_instead_of_silently_omitting_dependencies(self):
        for source in ("import(name)", "import('./' + name)", "import(`./${name}.ts`)"):
            with self.subTest(source=source), self.assertRaises(selector.SelectionError):
                list(selector.module_specifiers(source, 'fixture.ts'))

    def test_circular_shared_dependencies_terminate(self):
        self.write('supabase/functions/_shared/leaf.ts', 'import "./bridge.ts"; export const leaf = 2;\n')
        self.assertEqual(self.selected(), ['alpha'])

    def test_nested_entrypoint_config_is_supported(self):
        self.write('supabase/functions/beta/entry/main.ts', 'import "../../_shared/leaf.ts";')
        (self.repo / 'supabase/functions/beta/index.ts').unlink()
        self.write('supabase/config.toml', '[functions.beta]\nverify_jwt=false\nentrypoint="./functions/beta/entry/main.ts"\n')
        self.assertEqual(self.selected(), ['beta'])

    def test_unused_function_module_does_not_create_false_shared_consumer(self):
        self.write('supabase/functions/beta/unused.ts', 'import "../_shared/leaf.ts";')
        self.before = self.commit()
        self.write('supabase/functions/_shared/leaf.ts', 'export const leaf = 2;')
        self.assertEqual(self.selected(), ['alpha'])

    def test_cross_function_module_change_includes_its_real_importer(self):
        self.write('supabase/functions/alpha/handler.ts', 'export const handle = 1;')
        self.write('supabase/functions/beta/index.ts', 'import "../alpha/handler.ts";')
        self.before = self.commit()
        self.write('supabase/functions/alpha/handler.ts', 'export const handle = 2;')
        self.assertEqual(self.selected(), ['alpha', 'beta'])

    def test_workflow_runs_tested_selector_and_shell_blocks_parse(self):
        workflow = SCRIPT.parent.parent / '.github/workflows/deploy-edge-functions.yml'
        source = workflow.read_text()
        self.assertNotIn('grep -rlE', source)
        self.assertIn('python3 scripts/select-edge-functions.py --before "$BEFORE" --after "$AFTER"', source)
        self.assertIn('python3 scripts/select-edge-functions.py --after "$EVENT_AFTER" --manual "$MANUAL"', source)
        self.assertEqual(source.count('supabase functions deploy "$fn" --project-ref "$PROJECT_REF"'), 1)
        lines = source.splitlines()
        for index, line in enumerate(lines):
            if line.strip() != 'run: |':
                continue
            indentation = len(line) - len(line.lstrip())
            block = []
            for following in lines[index + 1:]:
                if following.strip() and len(following) - len(following.lstrip()) <= indentation:
                    break
                block.append(following[indentation + 2:])
            result = subprocess.run(['bash', '-n'], input='\n'.join(block), text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_cli_emits_names_only_and_no_deploy_side_effect(self):
        self.write('supabase/functions/_shared/leaf.ts', 'export const leaf = 2;\n')
        result = subprocess.run(['python3', str(SCRIPT), '--repo', str(self.repo), '--before', self.before, '--after', 'WORKTREE'], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, 'alpha\n')
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.before)


if __name__ == '__main__':
    unittest.main()
