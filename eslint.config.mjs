import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';

// Physical-direction Tailwind utilities break RTL. Use ms/me/ps/pe/start/end/text-start/border-s/rounded-s instead.
const PHYSICAL_CLASS =
  '(^|[\\s:])-?(m[lr]|p[lr]|left|right|border-[lr]|rounded-[lr]|rounded-[tb][lr]|scroll-[mp][lr])-|(^|[\\s:])(text-left|text-right|float-left|float-right|border-[lr]|clear-left|clear-right)($|[\\s])';
const physicalMsg =
  'Physical-direction utility detected. Use logical classes (ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/border-e/rounded-s/rounded-e).';

export default tseslint.config(
  {
    ignores: ['.next/**', '.open-next/**', '.wrangler/**', 'node_modules/**', 'migrations/**', 'cloudflare-env.d.ts', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'crypto', message: 'Use Web Crypto (globalThis.crypto / crypto.subtle).' },
            { name: 'fs', message: 'No filesystem on Workers.' },
            { name: 'path', message: 'Not available on Workers.' },
            { name: 'child_process', message: 'Not available on Workers.' },
          ],
          patterns: [{ group: ['node:*'], message: 'No Node built-ins in src/. Use Web APIs (Workers runtime).' }],
        },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${PHYSICAL_CLASS}/]`, message: physicalMsg },
        { selector: `TemplateElement[value.raw=/${PHYSICAL_CLASS}/]`, message: physicalMsg },
        {
          selector: "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name='runtime'][init.value='edge']",
          message: "Do not export runtime = 'edge'; OpenNext runs every route on Workers.",
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
