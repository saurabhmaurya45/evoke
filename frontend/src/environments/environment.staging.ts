import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'staging',
  apiBaseUrl: 'https://staging-api.evoke.app/api',
  appUrl: 'https://staging.evoke.app',
  features: {
    analytics: true,
    themeToggle: true,
  },
};
