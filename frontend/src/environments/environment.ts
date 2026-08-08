import type { AppEnvironment } from './environment.model';

// Default (development) environment. Swapped at build time via
// angular.json `fileReplacements` for staging/production.
export const environment: AppEnvironment = {
  production: false,
  name: 'development',
  apiBaseUrl: 'http://localhost:3000/api',
  appUrl: 'http://localhost:4200',
  features: {
    analytics: false,
    themeToggle: true,
  },
};
