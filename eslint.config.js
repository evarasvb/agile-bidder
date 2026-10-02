import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // supabase/functions/** son Deno Edge Functions: runtime y convenciones distintas
  // a las del frontend (Vite/React). Lintearlas con esta config solo generaba ruido
  // (cientos de "any" fuera de alcance de este proyecto); su propio linter es `deno lint`.
  { ignores: ["dist", "supabase/functions"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // react-hooks 7 agregó las reglas del React Compiler al preset recommended
      // (antes solo traía rules-of-hooks + exhaustive-deps). Son hallazgos reales,
      // pero arreglar los ~15 sitios que tocan de golpe queda fuera del alcance de
      // esta actualización de dependencia; mismo criterio de abajo: visibles como
      // "warn" para adopción gradual, sin bloquear el build.
      "react-hooks/static-components": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/config": "warn",
      "react-hooks/gating": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Deuda preexistente (ver auditoría técnica, hallazgo #8): 479 usos de "any" y
      // 21 archivos con @ts-nocheck. Reescribirlos todos de golpe es alto riesgo sin
      // tests que respalden cada cambio de tipo. Quedan como "warn" (visibles, no
      // bloquean el build) para adoptar tipado estricto gradualmente en vez de una
      // reescritura masiva; código nuevo debería evitarlos.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      // Reglas nuevas en el recommended de ESLint 10 (no existían en 9): mismo
      // criterio, visibles sin bloquear mientras se limpian los sitios existentes.
      "no-useless-assignment": "warn",
      "preserve-caught-error": "warn",
    },
  },
);
