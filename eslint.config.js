const globals = require('globals');

module.exports = [
  {
    files: ['server.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-empty': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'warn',
      'curly': ['error', 'multi-line'],
      'no-redeclare': 'error',
      'no-self-compare': 'error',
    },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-empty': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'warn',
      'curly': ['error', 'multi-line'],
      'no-redeclare': 'error',
      'no-self-compare': 'error',
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
