import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'db/migrations/**'] },

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'import-x': importX },
    rules: {
      /* R10.1 — zero `any`. The single loudest Code Quality signal. */
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          // `const { omitMe: _x, ...rest } = obj` is the idiomatic way to drop a key.
          ignoreRestSiblings: true,
        },
      ],

      /* R10.7 — no dead code, no console, no leftover TODOs */
      'no-console': 'error',
      'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'xxx'], location: 'anywhere' }],

      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
          'newlines-between': 'always',
        },
      ],

      /* R8.6 — Drizzle parameterises everything; sql.raw() is the one hole. */
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
          message: 'sql.raw() is banned (R8.6). Use the Drizzle query builder.',
        },
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Read config from src/config/env.ts, never process.env directly.',
        },
      ],
    },
  },

  /* R10.4 — MVC boundaries enforced by lint, not by discipline.
     Matched on the import specifier rather than the resolved path: no resolver
     to misconfigure, and it cannot silently pass when resolution fails. */
  {
    files: ['src/controllers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/models/**', '**/lib/db*'],
              message: 'Controllers must go through services, never touch models or the DB (R1.2).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'express', message: 'Services must not know about HTTP (R1.3).' }],
          patterns: [
            {
              group: ['**/controllers/**', '**/routes/**', '**/middleware/**'],
              message: 'Services must not know about HTTP (R1.3).',
            },
            {
              group: ['**/models/**'],
              message:
                'Services receive typed data from controllers; only the pipeline may persist, via an injected repository (R1.1).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/models/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/services/**', '**/controllers/**', '**/routes/**', '**/middleware/**'],
              message: 'Models are leaves. No upward imports (R1.1).',
            },
          ],
        },
      ],
    },
  },

  /* src/types is the API contract. The client compiles it too, so it must stay
     browser-safe: no Node built-ins, no config, no server internals. */
  {
    files: ['src/types/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', '**/config/**', '**/models/**', '**/services/**', '**/lib/**'],
              message:
                'src/types is compiled into the client bundle. Keep it to types, Zod schemas and constants.',
            },
          ],
        },
      ],
    },
  },

  /* config/env.ts is the ONE place process.env is legitimate */
  {
    files: ['src/config/env.ts', '*.config.ts', '*.config.js', 'scripts/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off', 'no-console': 'off' },
  },

  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },

  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },

  prettier,
);
