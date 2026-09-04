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
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Deuda preexistente (ver auditoría técnica, hallazgo #8): 479 usos de "any" y
      // 21 archivos con @ts-nocheck. Reescribirlos todos de golpe es alto riesgo sin
      // tests que respalden cada cambio de tipo. Quedan como "warn" (visibles, no
      // bloquean el build) para adoptar tipado estricto gradualmente en vez de una
      // reescritura masiva; código nuevo debería evitarlos.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },
);
