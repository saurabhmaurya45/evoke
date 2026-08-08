/**
 * Schema-driven template editor model.
 *
 * A template is expressed as *data*: a {@link TemplateSchema} describes which
 * sections and fields exist, and the generic form engine + renderer are driven
 * entirely by it. Adding a new template means registering a schema (and, later,
 * its render styling) — never a bespoke, hand-built form.
 *
 * The user's answers live in a single {@link TemplateData} bag keyed by section
 * and field, which is the one source of truth for both the form and the live
 * preview, and the exact payload persisted on save / publish.
 */

/** Every control the form engine knows how to render and validate. */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'image'
  | 'audio'
  | 'toggle'
  | 'color'
  | 'list';

/** Primitive a single (non-list) field can hold. */
export type FieldValue = string | boolean;

/** One editable field within a section. */
export interface FieldSchema {
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
  readonly required?: boolean;
  /** Placeholder / helper hint shown in the control. */
  readonly placeholder?: string;
  /** Default applied when a template is first loaded. */
  readonly default?: FieldValue;
  /**
   * Shape of each item when `type: 'list'` (e.g. events, gallery). A list
   * value is stored as an array of records keyed by these child fields.
   */
  readonly itemSchema?: readonly FieldSchema[];
  /** Explicit preview binding. Required for new templates. */
  readonly binding?: string;
}

/** A logical group of fields (hero, story, events…). */
export interface SectionSchema {
  readonly key: string;
  readonly label: string;
  readonly fields: readonly FieldSchema[];
}

/** A complete, per-template definition. */
export interface TemplateSchema {
  readonly id: string;
  readonly name: string;
  readonly category: 'Wedding' | 'Engagement';
  /** Bump when a schema's fields change so published sites stay pinned. */
  readonly version: number;
  /**
   * The rendered invitation HTML this schema drives. Embedded in the editor's
   * live-preview iframe and fed the {@link TemplateData} via `postMessage`.
   */
  readonly previewUrl: string;
  /**
   * JSON of default {@link TemplateData} used to seed a fresh edit — the
   * template's genuine sample content, kept out of both the markup and the
   * schema so users replace it with their real data.
   */
  readonly defaultsUrl: string;
  readonly sections: readonly SectionSchema[];
  /** Legacy templates may use their own runtime binding code temporarily. */
  readonly bindingMode?: 'explicit' | 'legacy';
}

/** A single list item: a record of its child field values. */
export type ListItem = Record<string, FieldValue>;

/** Value a field resolves to at runtime (scalar or a list of items). */
export type SectionValue = FieldValue | ListItem[];

/**
 * The user's filled-in content, keyed `sectionKey → fieldKey → value`.
 * Validated against the active {@link TemplateSchema} on publish.
 */
export type TemplateData = Record<string, Record<string, SectionValue>>;

/** Persisted / published payload — pins the schema it was authored against. */
export interface TemplateDocument {
  readonly templateId: string;
  readonly schemaVersion: number;
  readonly data: TemplateData;
}
