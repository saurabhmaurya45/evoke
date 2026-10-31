import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/services/auth.service';
import { TemplateCatalogService } from './template-catalog.service';

describe('TemplateCatalogService admin edits', () => {
  let service: TemplateCatalogService;
  let http: HttpTestingController;
  const SLOT = 'tpl-eternal-bond';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAdmin: signal(true), isAuthenticated: signal(true) } },
      ],
    });
    service = TestBed.inject(TemplateCatalogService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick(); // run the sync effect
    http.expectOne((r) => r.url.startsWith('v1/templates?')).flush({
      data: [{ id: 'uuid-eb', slug: SLOT, storefrontStatus: 'LISTED', pricingModel: 'FREE', priceAmountMinor: null, thumbnailUrl: null }],
    });
    http.expectOne('v1/templates/currencies').flush({ data: [{ id: 'inr-id', code: 'INR', isActive: true }] });
    http.expectOne('v1/templates/categories').flush({
      data: [{ id: 'cat-wed', slug: 'wedding', name: 'Wedding' }, { id: 'cat-eng', slug: 'engagement', name: 'Engagement' }],
    });
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('free → paid sends the currency the backend requires', () => {
    service.edit(SLOT, { pricing: 'paid', price: 100 });
    const req = http.expectOne('v1/templates/uuid-eb');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ pricingModel: 'PAID', priceAmountMinor: 100, currencyId: 'inr-id' });
    req.flush({});
  });

  it('paid → free clears both price and currency', () => {
    service.edit(SLOT, { pricing: 'free' });
    const req = http.expectOne('v1/templates/uuid-eb');
    expect(req.request.body).toEqual({ pricingModel: 'FREE', priceAmountMinor: null, currencyId: null });
    req.flush({});
  });

  it('a category change is sent as categoryId, not the display name', () => {
    service.edit(SLOT, { name: 'Eternal Bond', category: 'Engagement' });
    const req = http.expectOne('v1/templates/uuid-eb');
    expect(req.request.body).toEqual({ name: 'Eternal Bond', categoryId: 'cat-eng' });
    req.flush({});
  });
});

describe('TemplateCatalogService order', () => {
  let service: TemplateCatalogService;
  let http: HttpTestingController;
  const A = 'tpl-eternal-bond';
  const B = 'tpl-royal-gate';

  function row(slug: string, id: string, displayOrder: number) {
    return { id, slug, storefrontStatus: 'LISTED', pricingModel: 'FREE', priceAmountMinor: null, thumbnailUrl: null, displayOrder };
  }

  function start(rows: ReturnType<typeof row>[]) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAdmin: signal(true), isAuthenticated: signal(true) } },
      ],
    });
    service = TestBed.inject(TemplateCatalogService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http.expectOne((r) => r.url.startsWith('v1/templates?')).flush({ data: rows });
    http.expectOne('v1/templates/currencies').flush({ data: [] });
    http.expectOne('v1/templates/categories').flush({ data: [] });
  }

  const position = (slotId: string) => service.all().findIndex((t) => t.slotId === slotId);

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('keeps the defined order until an admin has placed templates', () => {
    start([row(A, 'id-a', 0), row(B, 'id-b', 0)]);
    expect(position(A)).toBeLessThan(position(B));
  });

  it('follows the order from the backend, for the public list too', () => {
    start([row(A, 'id-a', 2), row(B, 'id-b', 1)]);
    expect(position(B)).toBeLessThan(position(A));
    const published = service.published().map((t) => t.slotId);
    expect(published.indexOf(B)).toBeLessThan(published.indexOf(A));
  });

  it('saves the whole catalogue, and templates only the backend has go last', async () => {
    start([row(A, 'id-a', 0), row(B, 'id-b', 0), row('tpl-backend-only', 'id-x', 0)]);
    const saving = service.saveOrder([B, A, 'tpl-not-in-backend']);
    const req = http.expectOne('v1/templates/order');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ templateIds: ['id-b', 'id-a', 'id-x'] });
    req.flush({ data: [] });
    await saving;
    expect(position(B)).toBeLessThan(position(A));
  });

  it('leaves the order alone when the save fails', async () => {
    start([row(A, 'id-a', 1), row(B, 'id-b', 2)]);
    const saving = service.saveOrder([B, A]);
    http.expectOne('v1/templates/order').flush({}, { status: 422, statusText: 'Unprocessable' });
    await expectAsync(saving).toBeRejected();
    expect(position(A)).toBeLessThan(position(B));
  });
});
