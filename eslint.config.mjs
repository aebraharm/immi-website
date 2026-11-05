import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ESLint flat configuration.
 *
 * Next.js 15 ships its rules as eslintrc-style configs, so `FlatCompat` bridges
 * them into the flat config format required by ESLint 9.
 */

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: currentDirectory,
});

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'drizzle/**',
      '.data/**',
      'next-env.d.ts',
      'src/app/fonts.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // Application code must never log: an applicant's personal data must not
    // reach stdout, and console output leaks into browser devtools.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // CLI scripts and tests are command-line tools: console output IS their
    // interface, so the application logging rule does not apply to them.
    files: ['scripts/**/*.ts', 'tests/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];

export default config;
