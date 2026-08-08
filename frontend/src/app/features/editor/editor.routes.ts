import { type Routes } from '@angular/router';

/**
 * Template editor feature. Rendered full-screen (outside the marketing shell)
 * like the preview, so the split-pane editor fills the viewport. Lazy-loaded.
 * `:templateId` selects which per-template schema to edit.
 */
export const EDITOR_ROUTES: Routes = [
  {
    path: ':templateId',
    loadComponent: () =>
      import('./pages/editor-page/editor-page.component').then((m) => m.EditorPageComponent),
    title: 'Edit Template • Evoke',
  },
  { path: '', pathMatch: 'full', redirectTo: 'tpl-samarpan-royal' },
];
