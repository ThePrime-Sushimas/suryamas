import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'build', 'coverage']),
  
  // ===== KONFIGURASI DASAR UNTUK SEMUA FILE =====
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      // Aturan umum JavaScript
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'eqeqeq': ['error', 'always'],
    },
  },

  // ===== KONFIGURASI KHUSUS TYPESCRIPT =====
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // TypeScript strict rules
      ...tseslint.configs.strict.rules,
      ...tseslint.configs.stylistic.rules,
      
      // React Hooks rules
      ...reactHooks.configs.recommended.rules,
      
      // React Refresh
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // ===== ATURAN DETEKSI ANY =====
      
      // 1. ERROR: Explicit any - Tolak penggunaan any secara eksplisit
      '@typescript-eslint/no-explicit-any': ['error', {
        fixToUnknown: true,
        ignoreRestArgs: false
      }],

      // 2. ERROR: No unsafe assignment - Cegah assignment dari any
      '@typescript-eslint/no-unsafe-assignment': 'error',

      // 3. ERROR: No unsafe member access - Cegah akses property di any
      '@typescript-eslint/no-unsafe-member-access': 'error',

      // 4. ERROR: No unsafe call - Cegah pemanggilan fungsi dengan any
      '@typescript-eslint/no-unsafe-call': 'error',

      // 5. ERROR: No unsafe return - Cegah return type any
      '@typescript-eslint/no-unsafe-return': 'error',

      // 6. ERROR: No unsafe argument - Cegah parameter any
      '@typescript-eslint/no-unsafe-argument': 'error',

      // 7. WARNING: Explicit return type - Wajibkan return type
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
        allowConciseArrowFunctionExpressionsStartingWithVoid: true,
      }],

      // 8. ERROR: Strict boolean expressions - Hindari implicit any di kondisi
      '@typescript-eslint/strict-boolean-expressions': ['error', {
        allowString: false,
        allowNumber: false,
        allowNullableObject: false,
        allowNullableBoolean: false,
        allowNullableString: false,
        allowNullableNumber: false,
        allowAny: false,
      }],

      // 9. WARNING: No implicit any - Deteksi implicit any
      '@typescript-eslint/no-implicit-any': 'warn',

      // 10. ERROR: Ban types - Larang tipe tertentu yang berbahaya
      '@typescript-eslint/ban-types': ['error', {
        types: {
          '{}': false,
          'Function': {
            message: 'The `Function` type accepts any function-like value. Use a specific function type like `() => void` instead.',
            fixWith: '() => void',
          },
          'Object': {
            message: 'Avoid using the `Object` type. Did you mean `object` or `Record<string, unknown>`?',
          },
        },
        extendDefaults: true,
      }],

      // 11. ERROR: Array type - Standarisasi penulisan array
      '@typescript-eslint/array-type': ['error', {
        default: 'array-simple',
        readonly: 'array-simple',
      }],

      // 12. ERROR: Consistent type assertions
      '@typescript-eslint/consistent-type-assertions': ['error', {
        assertionStyle: 'as',
        objectLiteralTypeAssertions: 'never',
      }],

      // 13. WARNING: No non-null assertion - Cegah penggunaan !
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // 14. ERROR: Parameter properties harus explicit
      '@typescript-eslint/parameter-properties': ['error', {
        prefer: 'class-property',
      }],

      // 15. ERROR: No extra non-null assertion
      '@typescript-eslint/no-extra-non-null-assertion': 'error',

      // 16. ERROR: No misused promises - Cegah promise yang salah
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: true,
        checksConditionals: true,
      }],

      // 17. WARNING: Prefer readonly - Gunakan readonly untuk immutability
      '@typescript-eslint/prefer-readonly': 'warn',

      // 18. ERROR: Consistent type imports
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        disallowTypeAnnotations: true,
        fixStyle: 'inline-type-imports',
      }],

      // 19. WARNING: Method signature style
      '@typescript-eslint/method-signature-style': ['warn', 'property'],

      // 20. ERROR: No unnecessary conditions
      '@typescript-eslint/no-unnecessary-condition': ['error', {
        allowConstantLoopConditions: true,
      }],

      // 21. ERROR: No unnecessary type arguments
      '@typescript-eslint/no-unnecessary-type-arguments': 'error',

      // 22. ERROR: No unnecessary type assertions
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // 23. ERROR: No unnecessary type constraints
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',

      // 24. ERROR: No useless template literals
      '@typescript-eslint/no-useless-template-literals': 'error',

      // 25. ERROR: Prefer as const
      '@typescript-eslint/prefer-as-const': 'error',

      // 26. ERROR: Prefer for of
      '@typescript-eslint/prefer-for-of': 'error',

      // 27. WARNING: Prefer function type
      '@typescript-eslint/prefer-function-type': 'warn',

      // 28. WARNING: Prefer includes
      '@typescript-eslint/prefer-includes': 'warn',

      // 29. WARNING: Prefer nullish coalescing
      '@typescript-eslint/prefer-nullish-coalescing': ['warn', {
        ignoreConditionalTests: false,
        ignoreMixedLogicalExpressions: false,
      }],

      // 30. ERROR: No array any - Gunakan aturan yang sudah ada
      // (no-unsafe-argument sudah mencakup ini)
    },
  },

  // ===== KONFIGURASI UNTUK TEST FILES =====
  {
    files: [
      '**/*.test.{ts,tsx}', 
      '**/*.spec.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}'
    ],
    rules: {
      // Relax rules untuk test files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },

  // ===== KONFIGURASI UNTUK FILE KONFIGURASI =====
  {
    files: [
      '*.config.{js,ts}', 
      '.*rc.{js,ts}',
      'vite.config.ts',
      'vitest.config.ts',
      'playwright.config.ts',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      // Relax rules untuk config files
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // ===== KONFIGURASI UNTUK FILE UTILITIES =====
  {
    files: [
      'src/utils/**/*.{ts,tsx}',
      'src/lib/**/*.{ts,tsx}',
      'src/types/**/*.{ts,tsx}'
    ],
    rules: {
      // Utility files harus strict
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: false,
      }],
    },
  },

  // ===== KONFIGURASI UNTUK FILE YANG BOLEH PAKAI ANY =====
  {
    files: [
      'src/types/global.d.ts',
      'src/vite-env.d.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-types': 'off',
    },
  },
])