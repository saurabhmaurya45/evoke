import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'production',
  apiBaseUrl: 'https://api.evoke.app/api',
  appUrl: 'https://evoke.app',
  features: {
    analytics: true,
    themeToggle: true,
  },
};
