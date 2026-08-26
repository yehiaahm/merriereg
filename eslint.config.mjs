import nextPlugin from 'eslint-config-next';

const config = [
  ...nextPlugin,
  {
    ignores: ['node_modules/**', '.next/**', 'app_backup_static/**'],
  },
];

export default config;
