import { Injectable, inject } from '@angular/core';
import { WINDOW } from '../../../core/tokens/window.token';
import type { TemplateSchema } from '../models/template-schema.model';
import { validateTemplateSchema } from './template-contract';

/** A registered template: where its rendered HTML and field manifest live. */
export interface TemplateEntry {
  readonly id: string;
  /** Rendered invitation HTML (embedded in the editor preview iframe). */
  readonly previewUrl: string;
  /**
   * Optional dedicated field manifest. When omitted, the manifest is read from
   * an inline `<script type="application/evoke-schema+json">` in `previewUrl`.
   * Used for heavy/black-box templates (e.g. bundles) to avoid refetching them.
   */
  readonly schemaUrl?: string;
  readonly bindingMode: 'explicit' | 'legacy';
}

/**
 * Resolves a template's field schema from the template itself, so the editor
 * form is generated dynamically per template — never hardcoded. Hand-authored
 * templates declare their fields inline in the HTML; bundled templates ship a
 * co-located `*.schema.json`. Adding a template is a data change: one index
 * entry plus the manifest that travels with the template.
 */
@Injectable({ providedIn: 'root' })
export class TemplateSchemaLoader {
  private readonly window = inject(WINDOW);
  private readonly cache = new Map<string, TemplateSchema>();

  private index: readonly TemplateEntry[] | null = null;

  /** Known template ids (e.g. for a picker). */
  async ids(): Promise<readonly string[]> {
    return (await this.loadIndex()).map((entry) => entry.id);
  }

  /** Load and cache a template's schema, or `null` if unknown / unavailable. */
  async load(id: string): Promise<TemplateSchema | null> {
    const cached = this.cache.get(id);
    if (cached) {
      return cached;
    }
    const entries = await this.loadIndex();
    const entry = entries.find((e) => e.id === id);
    if (!entry || !this.window || typeof this.window.fetch !== 'function') {
      return null;
    }
    try {
      const manifest = entry.schemaUrl
        ? await this.fetchJson(entry.schemaUrl)
        : await this.extractInline(entry.previewUrl);
      if (!manifest) {
        return null;
      }
      // The template owns its fields; the loader binds the rendered HTML url.
      const schema = validateTemplateSchema({ ...manifest, previewUrl: entry.previewUrl, bindingMode: entry.bindingMode }, id);
      this.cache.set(id, schema);
      return schema;
    } catch (error) {
      console.error(`[TemplateSchemaLoader] Failed to load ${id}`, error);
      return null;
    }
  }

  private async fetchJson(url: string): Promise<TemplateSchema | null> {
    const response = await this.window!.fetch(url, { cache: 'no-store' });
    return response.ok ? (await response.json()) : null;
  }

  /** Pull the manifest out of an inline `evoke-schema+json` script block. */
  private async extractInline(url: string): Promise<TemplateSchema | null> {
    const response = await this.window!.fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    const html = await response.text();
    const match = html.match(
      /<script[^>]*type="application\/evoke-schema\+json"[^>]*>([\s\S]*?)<\/script>/i,
    );
    return match ? JSON.parse(match[1]) : null;
  }

  private async loadIndex(): Promise<readonly TemplateEntry[]> {
    if (this.index) return this.index;
    if (!this.window || typeof this.window.fetch !== 'function') return [];
    const response = await this.window.fetch('/invitation-templates/templates.index.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const value = await response.json();
    if (!Array.isArray(value)) throw new Error('templates.index.json must be an array');
    const entries = value as Partial<TemplateEntry>[];
    const issues: string[] = [];
    const ids = new Set<string>();
    for (const entry of entries) {
      if (!entry.id || ids.has(entry.id)) issues.push(`duplicate or missing template id: ${entry.id ?? '(empty)'}`);
      if (!entry.previewUrl) issues.push(`missing previewUrl for ${entry.id ?? '(unknown)'}`);
      if (entry.bindingMode !== 'explicit' && entry.bindingMode !== 'legacy') issues.push(`invalid bindingMode for ${entry.id ?? '(unknown)'}`);
      ids.add(entry.id ?? '');
    }
    if (issues.length) throw new Error(`Invalid template index: ${issues.join('; ')}`);
    this.index = entries as TemplateEntry[];
    return this.index;
  }
}
