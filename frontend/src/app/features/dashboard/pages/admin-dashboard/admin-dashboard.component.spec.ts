import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/services/auth.service';
import { MediaUploadService } from '../../../../core/services/media-upload.service';
import { SeoService } from '../../../../core/services/seo.service';
import { TemplateCatalogService } from '../../../templates/data/template-catalog.service';
import { DashboardContentService } from '../../data/dashboard-content.service';
import { AdminDashboardComponent } from './admin-dashboard.component';

function template(slotId: string) {
  return { slotId, name: slotId, category: 'Wedding', photo: '', pricing: 'free', price: 0, published: true };
}

describe('AdminDashboardComponent template order', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let saveOrder: jasmine.Spy;
  const all = signal([template('a'), template('b'), template('c')]);

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const rows = (): string[] =>
    Array.from(root().querySelectorAll('tbody tr')).map(
      (row) => row.querySelector('.mono')?.textContent?.trim() ?? '',
    );
  const button = (label: string): HTMLButtonElement | null =>
    root().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const byText = (text: string): HTMLButtonElement | undefined =>
    Array.from(root().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text,
    );
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    saveOrder = jasmine.createSpy('saveOrder').and.resolveTo();
    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        { provide: TemplateCatalogService, useValue: { all, saveOrder, backendId: () => null, thumbnail: () => null, reset: () => undefined } },
        {
          provide: DashboardContentService,
          useValue: {
            loadAdminData: () => undefined,
            loadError: signal(null),
            loading: signal(false),
            adminMetrics: signal([]),
            adminCustomers: signal([]),
            adminSites: signal([]),
            adminPayments: signal([]),
          },
        },
        { provide: AuthService, useValue: { user: signal({ email: 'admin@example.test' }) } },
        { provide: SeoService, useValue: { apply: () => undefined } },
        { provide: MediaUploadService, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(AdminDashboardComponent);
    fixture.detectChanges();
  });

  it('shows the catalogue order, with no save button until something moves', () => {
    expect(rows()).toEqual(['a', 'b', 'c']);
    expect(byText('Save order')).toBeUndefined();
    expect(button('Move a up')?.disabled).toBeTrue();
    expect(button('Move c down')?.disabled).toBeTrue();
  });

  it('arrows move a row, and saving sends the new order', async () => {
    button('Move c up')?.click();
    await settle();
    expect(rows()).toEqual(['a', 'c', 'b']);

    byText('Save order')?.click();
    await settle();
    expect(saveOrder).toHaveBeenCalledOnceWith(['a', 'c', 'b']);
    expect(byText('Save order')).toBeUndefined();
    expect(root().textContent).toContain('Order saved');
  });

  it('dragging a row over another takes its place', async () => {
    const tr = () => root().querySelectorAll('tbody tr');
    tr()[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
    tr()[2].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
    tr()[2].dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    await settle();
    expect(rows()).toEqual(['b', 'c', 'a']);
  });

  it('discard returns to the saved order without saving', async () => {
    button('Move b up')?.click();
    await settle();
    byText('Discard')?.click();
    await settle();
    expect(rows()).toEqual(['a', 'b', 'c']);
    expect(saveOrder).not.toHaveBeenCalled();
  });

  it('a failed save shows the reason and keeps the arranged order', async () => {
    saveOrder.and.rejectWith({ error: { error: { message: 'templateIds must list every template exactly once.' } } });
    button('Move b up')?.click();
    await settle();
    byText('Save order')?.click();
    await settle();
    expect(root().textContent).toContain('templateIds must list every template');
    expect(rows()).toEqual(['b', 'a', 'c']);
    expect(byText('Save order')).toBeDefined();
  });
});
