import { Injectable } from '@angular/core';
import type { TemplateData, TemplateDocument, TemplateSchema } from '../models/template-schema.model';
import { validateTemplateDefaults } from './template-contract';

/** Central migration boundary. Version-specific migrations can be registered without changing the editor. */
@Injectable({ providedIn: 'root' })
export class TemplateMigrationService {
  prepare(schema: TemplateSchema, data: TemplateData | null): TemplateData | null {
    if (!data) return null;
    try {
      return validateTemplateDefaults(schema, data);
    } catch (error) {
      console.error(`[TemplateMigrationService] Rejected draft for ${schema.id}`, error);
      return null;
    }
  }

  prepareDocument(schema: TemplateSchema, document: TemplateDocument | null): TemplateData | null {
    if (!document || document.templateId !== schema.id) return null;
    if (document.schemaVersion > schema.version) {
      console.error(`[TemplateMigrationService] Draft ${schema.id} is newer than the active schema`);
      return null;
    }
    return this.prepare(schema, document.data);
  }

  migrate(document: TemplateDocument, schema: TemplateSchema): TemplateDocument {
    const data = this.prepare(schema, document.data) ?? {};
    return { ...document, templateId: schema.id, schemaVersion: schema.version, data };
  }
}
