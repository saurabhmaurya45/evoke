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
