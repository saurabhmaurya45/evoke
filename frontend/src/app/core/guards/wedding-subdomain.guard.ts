import { type CanMatchFn } from '@angular/router';
import { weddingHostLabel } from '../utils/invitation-public-url';

/** Only match the empty path on a couple's wedding subdomain (not the marketing apex). */
export const weddingSubdomainCanMatch: CanMatchFn = () => weddingHostLabel() !== null;