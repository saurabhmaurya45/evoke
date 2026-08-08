import { Injectable, inject } from '@angular/core';
import { WINDOW } from '../../../core/tokens/window.token';
import type { TemplateData } from '../models/template-schema.model';
import type { TemplateSchema } from '../models/template-schema.model';
import { validateTemplateDefaults } from './template-contract';

/**
 * Loads a template's default content — its genuine sample data, held in a JSON
 * file rather than baked into the markup or the schema, so the editor seeds a
 * fresh edit with it and the user replaces it with their real data.
 *
 * `Promise`-based and SSR-safe: returns `{}` when there is no browser or the
 * fetch fails, letting the store fall back to empty fields.
 */
@Injectable({ providedIn: 'root' })
export class TemplateContentService {
  private readonly window = inject(WINDOW);

  async loadDefaults(url: string, schema?: TemplateSchema): Promise<TemplateData> {
    if (!this.window || typeof this.window.fetch !== 'function') {
      return {};
    }
    try {
      const response = await this.window.fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        return {};
      }
      const data = await response.json();
      return schema ? validateTemplateDefaults(schema, data) : (data as TemplateData);
    } catch (error) {
      console.error(`[TemplateContentService] Invalid defaults at ${url}`, error);
      return {};
    }
  }
}
