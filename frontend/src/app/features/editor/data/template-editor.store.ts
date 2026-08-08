import { Injectable, computed, signal } from '@angular/core';
import type {
  FieldSchema,
  ListItem,
  SectionValue,
  TemplateData,
  TemplateDocument,
  TemplateSchema,
} from '../models/template-schema.model';

/**
 * The single source of truth for the editor. Holds the active schema and the
 * user's {@link TemplateData}; the form engine writes into it and the live
 * preview reads from it, so both stay in sync with zero glue code.
 *
 * UI-only concern — persistence (draft autosave, publish) is delegated to the
 * caller via {@link toDocument}, keeping this store transport-agnostic.
 */
@Injectable()
export class TemplateEditorStore {
  private readonly _schema = signal<TemplateSchema | null>(null);
  private readonly _data = signal<TemplateData>({});

  /** Active template schema (null until loaded). */
  readonly schema = this._schema.asReadonly();
  /** Current, live-editable content. */
  readonly data = this._data.asReadonly();

  /** Fields still missing a required value — drives publish gating. */
  readonly missingRequired = computed(() => this.collectMissingRequired());

  readonly canPublish = computed(() => this.missingRequired().length === 0);

  /** Seed the store from a schema, applying field defaults + any saved data. */
  load(schema: TemplateSchema, saved?: TemplateData): void {
    this._schema.set(schema);
    this._data.set(this.hydrate(schema, saved));
  }

  /** Update a scalar field. */
  setField(sectionKey: string, fieldKey: string, value: SectionValue): void {
    this._data.update((data) => ({
      ...data,
      [sectionKey]: { ...data[sectionKey], [fieldKey]: value },
    }));
  }

  /** Read a list field's items (empty when unset). */
  listItems(sectionKey: string, fieldKey: string): ListItem[] {
    const value = this._data()[sectionKey]?.[fieldKey];
    return Array.isArray(value) ? value : [];
  }

  addListItem(sectionKey: string, field: FieldSchema): void {
    const item = this.blankItem(field);
    this.setField(sectionKey, field.key, [...this.listItems(sectionKey, field.key), item]);
  }

  removeListItem(sectionKey: string, fieldKey: string, index: number): void {
    this.setField(
      sectionKey,
      fieldKey,
      this.listItems(sectionKey, fieldKey).filter((_, i) => i !== index),
    );
  }

  setListItemField(
    sectionKey: string,
    fieldKey: string,
    index: number,
    childKey: string,
    value: string | boolean,
  ): void {
    const items = this.listItems(sectionKey, fieldKey).map((item, i) =>
      i === index ? { ...item, [childKey]: value } : item,
    );
    this.setField(sectionKey, fieldKey, items);
  }

  /** Serialise to the persisted / published payload. */
  toDocument(): TemplateDocument | null {
    const schema = this._schema();
    if (!schema) {
      return null;
    }
    return { templateId: schema.id, schemaVersion: schema.version, data: this._data() };
  }

  private hydrate(schema: TemplateSchema, saved?: TemplateData): TemplateData {
    const data: TemplateData = {};
    for (const section of schema.sections) {
      const savedSection = saved?.[section.key] ?? {};
      const values: Record<string, SectionValue> = {};
      for (const field of section.fields) {
        if (field.key in savedSection) {
          values[field.key] = savedSection[field.key];
        } else if (field.type === 'list') {
          values[field.key] = [];
        } else {
          values[field.key] = field.default ?? (field.type === 'toggle' ? false : '');
        }
      }
      data[section.key] = values;
    }
    return data;
  }

  private blankItem(field: FieldSchema): ListItem {
    const item: ListItem = {};
    for (const child of field.itemSchema ?? []) {
      item[child.key] = child.default ?? (child.type === 'toggle' ? false : '');
    }
    return item;
  }

  private collectMissingRequired(): string[] {
    const schema = this._schema();
    const data = this._data();
    if (!schema) {
      return [];
    }
    const missing: string[] = [];
    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (field.required && !data[section.key]?.[field.key]) {
          missing.push(`${section.label} · ${field.label}`);
        }
      }
    }
    return missing;
  }
}
