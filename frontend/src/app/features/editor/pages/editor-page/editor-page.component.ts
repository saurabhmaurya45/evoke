import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormEngineComponent } from '../../components/form-engine/form-engine.component';
import { TemplateRendererComponent } from '../../components/template-renderer/template-renderer.component';
import { TemplateEditorStore } from '../../data/template-editor.store';
import { TemplateSchemaLoader } from '../../data/template-schema.loader';
import { TemplateContentService } from '../../data/template-content.service';
import { TEMPLATE_REPOSITORY } from '../../data/template-repository';
import { SeoService } from '../../../../core/services/seo.service';
import { WINDOW } from '../../../../core/tokens/window.token';
import { TemplateMigrationService } from '../../data/template-migration.service';
import { HttpTemplateRepository } from '../../data/http-template-repository';
import { AuthService } from '../../../../core/services/auth.service';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';

type EditorPane = 'edit' | 'preview';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY = 800;

/**
 * Split-pane template editor: the schema-driven form on one side, the live
 * preview on the other — both bound to the same {@link TemplateEditorStore},
 * so edits reflect instantly. Collapses to Edit/Preview tabs on small screens.
 * The store is provided at this route so each editing session is isolated.
 *
 * Persistence goes through {@link TEMPLATE_REPOSITORY} — a localStorage
 * implementation today, swappable for an HTTP API later with no changes here.
 */
@Component({
  selector: 'app-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TemplateEditorStore],
  imports: [FormEngineComponent, TemplateRendererComponent, LoaderComponent],
  templateUrl: './editor-page.component.html',
  styleUrl: './editor-page.component.scss',
})
export class EditorPageComponent {
  private readonly loader = inject(TemplateSchemaLoader);
  private readonly content = inject(TemplateContentService);
  private readonly repository = inject(TEMPLATE_REPOSITORY);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly window = inject(WINDOW);
  private readonly migrations = inject(TemplateMigrationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  protected readonly store = inject(TemplateEditorStore);

  /** Route param `:templateId`. */
  readonly templateId = input('');

  /** Active pane on mobile (both show side-by-side on desktop). */
  protected readonly pane = signal<EditorPane>('edit');

  /** Draft autosave indicator. */
  protected readonly saveState = signal<SaveState>('idle');

  /** True once a schema load has finished with no match. */
  protected readonly notFound = signal(false);

  private saveTimer = 0;
  /** Serialised snapshot of the last-persisted document — dedupes no-op saves. */
  private lastSaved = '';

  constructor() {
    // Resolve the template's own field schema, then seed the store. The form is
    // built dynamically from whatever fields the template declares.
    effect(() => {
      const id = this.templateId();
      if (!id) {
        return;
      }
      this.notFound.set(false);
      void this.loader.load(id).then((schema) => {
        if (!schema) {
          this.notFound.set(true);
          return;
        }
        this.seo.apply({
          title: `Edit ${schema.name} • Evoke`,
          description: `Personalise the ${schema.name} invitation and publish your wedding website.`,
          robots: 'noindex, nofollow',
        });
        // When arriving from the dashboard "Edit" link, the event UUID is passed
        // as ?eventId= so the draft can be loaded even if the localStorage cache
        // was cleared (different device, fresh browser, etc.).
        const eventId = this.route.snapshot.queryParamMap.get('eventId');
        if (eventId && this.repository instanceof HttpTemplateRepository) {
          this.repository.primeEventId(schema.id, eventId);
        }
        // Seed from a saved draft when present, otherwise the template's default
        // sample content (JSON) — never values baked into the markup/schema.
        void Promise.all([
          this.repository.loadDraft(schema.id),
          this.content.loadDefaults(schema.defaultsUrl, schema),
        ]).then(([draft, defaults]) => {
          const safeDraft = this.migrations.prepareDocument(schema, draft);
          this.store.load(schema, safeDraft ?? defaults);
          // Baseline the snapshot so seeding doesn't trigger a save.
          this.lastSaved = JSON.stringify(this.store.toDocument());
        });
      });
    });

    // Debounced draft autosave: re-runs whenever the edited data changes.
    effect(() => {
      this.store.data(); // track edits
      untracked(() => this.scheduleAutosave());
    });

    this.destroyRef.onDestroy(() => this.window?.clearTimeout(this.saveTimer));
  }

  protected setPane(pane: EditorPane): void {
    this.pane.set(pane);
  }

  /** Return to this template's preview. */
  protected goBack(): void {
    void this.router.navigate(['/preview', this.templateId()]);
  }

  /**
   * Persist the current document, then advance to checkout. The published id
   * carries through so payment can be tied to the specific saved website.
   */
  protected async publish(): Promise<void> {
    const doc = this.store.toDocument();
    if (!doc || !this.store.canPublish()) {
      return;
    }
    // Checkout needs a backend event owned by the user, which only exists once signed in.
    if (!this.auth.isAuthenticated()) {
      await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    let id: string;
    try {
      ({ id } = await this.repository.publish(doc));
    } catch {
      // Don't advance to payment with a draft that never reached the server.
      this.saveState.set('error');
      return;
    }
    this.lastSaved = JSON.stringify(doc);
    await this.router.navigate(['/payment'], {
      queryParams: { template: doc.templateId, site: id },
    });
  }

  private scheduleAutosave(): void {
    const doc = this.store.toDocument();
    if (!doc) {
      return;
    }
    // Skip when nothing actually changed (e.g. the initial hydrate).
    const snapshot = JSON.stringify(doc);
    if (snapshot === this.lastSaved) {
      return;
    }
    this.saveState.set('saving');
    this.window?.clearTimeout(this.saveTimer);
    this.saveTimer =
      this.window?.setTimeout(() => {
        this.repository.saveDraft(doc).then(
          () => {
            this.lastSaved = snapshot;
            this.saveState.set('saved');
          },
          // lastSaved is left stale on purpose, so the next edit retries the save.
          () => this.saveState.set('error'),
        );
      }, AUTOSAVE_DELAY) ?? 0;
  }
}
