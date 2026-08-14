/**
 * Flat ESLint config for Ride The Bus.
 *
 * WHY THIS FILE EXISTS
 *
 * The vendored SDK pins ESLint 9, which reads `eslint.config.js` and ignores
 * `.eslintrc.cjs` entirely - and every app in web-sdk/apps still ships only the
 * latter. So `npm run lint` errored out with "couldn't find a configuration
 * file" and had simply stopped being a gate. Stake's approval checks the
 * network tab for errors and logged game information, so a dead linter is a
 * hole in the release scan, not just untidiness.
 *
 * WHY THE PLUGINS ARE RESOLVED BY HAND
 *
 * @typescript-eslint is a dependency of the workspace package
 * `eslint-config-custom`, not of this app, so it lives in that package's
 * node_modules and a plain `import` from here cannot see it. Resolving through
 * that package keeps this change inside the game's own directory: the shared
 * package is vendored SDK code, and every patch to it has to be re-applied by
 * hand whenever the SDK is updated from upstream (see README, "LOCAL ADDITION").
 * One self-contained file here costs less than one more patch there.
 *
 * WHY .svelte FILES ARE NOT LINTED
 *
 * `svelte-eslint-parser` is not installed anywhere in the workspace, and adding
 * it would mean a dependency change and a reinstall. Svelte files are already
 * gated harder than ESLint would gate them: `npm run check:svelte` must report
 * zero errors AND zero CSS warnings before anything ships.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const requireShared = createRequire(require.resolve('eslint-config-custom'));

const tsParser = requireShared('@typescript-eslint/parser');
const tsPlugin = requireShared('@typescript-eslint/eslint-plugin');

export default [
  {
    ignores: [
      'build/**',
      '.svelte-kit/**',
      'node_modules/**',
      'storybook-static/**',
      'scripts/**',
      '*.cjs',
      // Generated ambient types for the CSS modules.
      'src/**/*.css.d.ts',
    ],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        // Deliberately no `project`: type-aware linting would need the full
        // program, which drags in the ~258 pre-existing vendored-SDK type
        // errors that `npm run check` already tells us to ignore.
        extraFileExtensions: ['.svelte'],
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,
      // The RGS hands back round state as untyped JSON and the SDK's own
      // stateBet fields are loosely typed, so the replay and resume paths cast
      // through `any` on purpose. typesBookEvent.ts is where that gets a shape.
      '@typescript-eslint/no-explicit-any': 'off',
      // Leading underscore is the intentional-discard convention. Several stubs
      // exist only to satisfy an SDK interface and must keep the parameter to
      // match its shape while never reading it - see stateGame.svelte.ts.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Tests assert on deliberately malformed input, so unused bindings and
    // non-null assertions are part of the exercise rather than mistakes.
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
