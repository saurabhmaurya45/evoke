import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FieldControlComponent } from '../field-control/field-control.component';
import { TemplateEditorStore } from '../../data/template-editor.store';
import type { FieldSchema, FieldValue } from '../../models/template-schema.model';

/**
 * Generic, schema-driven form. Iterates the active template's sections and
 * fields and renders a control for each — including add/remove/reorder for
 * `list` fields — writing every change straight into the shared
 * {@link TemplateEditorStore}. One engine serves every template; there are no
 * per-template forms.
 */
@Component({
  selector: 'app-form-engine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldControlComponent],
  template: `
    @if (store.schema(); as schema) {
      <form class="form" (submit)="$event.preventDefault()">
        @for (section of schema.sections; track section.key) {
          <fieldset class="form__section">
            <legend class="form__legend">{{ section.label }}</legend>

            @for (field of section.fields; track field.key) {
              @if (field.type === 'list') {
                <div class="list">
                  <span class="list__title">{{ field.label }}</span>
                  @for (item of store.listItems(section.key, field.key); track $index) {
                    <div class="list__item">
                      @for (child of field.itemSchema ?? []; track child.key) {
                        <app-field-control
                          [field]="child"
                          [value]="itemValue(item, child.key)"
                          (valueChange)="
                            store.setListItemField(section.key, field.key, $index, child.key, $event)
                          "
                        />
                      }
                      <button
                        type="button"
                        class="list__remove"
                        (click)="store.removeListItem(section.key, field.key, $index)"
                      >
                        Remove
                      </button>
                    </div>
                  }
                  <button
                    type="button"
                    class="list__add"
                    (click)="store.addListItem(section.key, field)"
                  >
                    + Add {{ field.label }}
                  </button>
                </div>
              } @else {
                <app-field-control
                  [field]="field"
                  [value]="scalar(section.key, field)"
                  (valueChange)="store.setField(section.key, field.key, $event)"
                />
              }
            }
          </fieldset>
        }
      </form>
    }
  `,
  styleUrl: './form-engine.component.scss',
})
export class FormEngineComponent {
  protected readonly store = inject(TemplateEditorStore);

  /** Current scalar value for a field (empty when unset). */
  protected scalar(sectionKey: string, field: FieldSchema): FieldValue {
    const value = this.store.data()[sectionKey]?.[field.key];
    return typeof value === 'string' || typeof value === 'boolean' ? value : '';
  }

  protected itemValue(item: Record<string, FieldValue>, key: string): FieldValue {
    return item[key] ?? '';
  }
}
