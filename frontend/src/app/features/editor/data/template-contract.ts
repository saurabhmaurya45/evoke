import type { FieldSchema, TemplateData, TemplateSchema } from '../models/template-schema.model';

export class TemplateContractError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid template contract:\n${issues.map((issue) => `• ${issue}`).join('\n')}`);
    this.name = 'TemplateContractError';
  }
}

const FIELD_TYPES = new Set(['text', 'textarea', 'date', 'image', 'audio', 'toggle', 'color', 'list']);

export function validateTemplateSchema(value: unknown, expectedId?: string): TemplateSchema {
  const raw = value as Partial<TemplateSchema> | null;
  const issues: string[] = [];
  if (!raw || typeof raw !== 'object') issues.push('manifest must be an object');
  if (!raw?.id || typeof raw.id !== 'string') issues.push('id is required');
  if (expectedId && raw?.id !== expectedId) issues.push(`id must be "${expectedId}"`);
  if (!raw?.name || typeof raw.name !== 'string') issues.push('name is required');
  if (!Number.isInteger(raw?.version) || (raw?.version ?? 0) < 1) issues.push('version must be a positive integer');
  if (!raw?.defaultsUrl || typeof raw.defaultsUrl !== 'string') issues.push('defaultsUrl is required');
  if (!Array.isArray(raw?.sections) || raw.sections.length === 0) issues.push('sections must be a non-empty array');
  if (raw?.bindingMode !== 'explicit' && raw?.bindingMode !== 'legacy') issues.push('bindingMode must be explicit or legacy');
  const keys = new Set<string>();
  for (const section of raw?.sections ?? []) {
    if (!section?.key || keys.has(section.key)) issues.push(`duplicate or missing section key: ${section?.key ?? '(empty)'}`);
    keys.add(section?.key ?? '');
    const fieldKeys = new Set<string>();
    for (const field of section?.fields ?? []) {
      if (!field?.key || fieldKeys.has(field.key)) issues.push(`duplicate or missing field key in ${section.key}`);
      fieldKeys.add(field?.key ?? '');
      if (!FIELD_TYPES.has(field?.type ?? '')) issues.push(`invalid field type for ${section.key}.${field?.key}`);
      if (field?.type === 'list' && (!Array.isArray(field.itemSchema) || field.itemSchema.length === 0)) {
        issues.push(`list field ${section.key}.${field.key} needs itemSchema`);
      }
      if (raw?.bindingMode === 'explicit' && (!field?.binding || typeof field.binding !== 'string')) {
        issues.push(`missing binding for ${section.key}.${field.key}`);
      }
      validateNestedField(field, `${section.key}.${field?.key ?? '(empty)'}`, issues);
    }
  }
  if (issues.length) throw new TemplateContractError(issues);
  return raw as TemplateSchema;
}

export function validateTemplateDefaults(schema: TemplateSchema, data: unknown): TemplateData {
  const source = (data && typeof data === 'object' ? data : {}) as TemplateData;
  const issues: string[] = [];
  for (const section of schema.sections) {
    const values = source[section.key];
    if (values !== undefined && (!values || typeof values !== 'object' || Array.isArray(values))) {
      issues.push(`defaults.${section.key} must be an object`);
      continue;
    }
    for (const key of Object.keys(values ?? {})) {
      if (!section.fields.some((field) => field.key === key)) issues.push(`unknown defaults key: ${section.key}.${key}`);
    }
    for (const field of section.fields) {
      const value = values?.[field.key];
      validateValue(field, value, `${section.key}.${field.key}`, issues);
    }
  }
  if (issues.length) throw new TemplateContractError(issues);
  return source;
}

function validateNestedField(field: Partial<FieldSchema> | undefined, path: string, issues: string[]): void {
  for (const child of field?.itemSchema ?? []) {
    if (!child?.key || !FIELD_TYPES.has(child.type ?? '')) issues.push(`invalid list child field: ${path}`);
    validateNestedField(child, `${path}.${child?.key ?? '(empty)'}`, issues);
  }
}

function validateValue(field: FieldSchema, value: unknown, path: string, issues: string[]): void {
  if (value === undefined) return;
  if (field.type === 'list') {
    if (!Array.isArray(value)) { issues.push(`invalid list default type: ${path}`); return; }
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) { issues.push(`invalid list item: ${path}`); continue; }
      for (const key of Object.keys(item)) if (!(field.itemSchema ?? []).some((child) => child.key === key)) issues.push(`unknown list key: ${path}.${key}`);
      for (const child of field.itemSchema ?? []) validateValue(child, item[child.key], `${path}.${child.key}`, issues);
    }
    return;
  }
  const valid = field.type === 'toggle' ? typeof value === 'boolean' : typeof value === 'string';
  if (!valid) issues.push(`invalid default type: ${path}`);
}

export function fieldKeys(schema: TemplateSchema): readonly string[] {
  return schema.sections.flatMap((section) => section.fields.map((field: FieldSchema) => `${section.key}.${field.key}`));
}
