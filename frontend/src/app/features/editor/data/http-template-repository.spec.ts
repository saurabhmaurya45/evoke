import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/services/auth.service';
import { HttpTemplateRepository } from './http-template-repository';

describe('HttpTemplateRepository — several websites on one template', () => {
  let repo: HttpTemplateRepository;
  let http: HttpTestingController;
  const SLOT = 'tpl-royal-gate';
  const doc = { templateId: SLOT, schemaVersion: 1, data: {} };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        HttpTemplateRepository,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAuthenticated: signal(true) } },
      ],
    });
    repo = TestBed.inject(HttpTemplateRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  async function flushMicrotasks(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('starting from the template after publishing creates a new website', async () => {
    repo.useEvent(SLOT, 'published-event');
    const started = repo.startFromTemplate(SLOT);
    http.expectOne('v1/events/published-event').flush({ data: { id: 'published-event', slug: 's', status: 'PUBLISHED' } });
    await started;

    const saved = repo.saveDraft(doc);
    await flushMicrotasks();
    const create = http.expectOne('v1/events');
    expect(create.request.method).toBe('POST');
    create.flush({ data: { id: 'new-event', slug: 's2', status: 'DRAFT' } });
    await flushMicrotasks();
    const put = http.expectOne('v1/events/new-event/draft');
    expect(put.request.body.revision).toBe(0);
    put.flush({ data: { eventId: 'new-event', data: {}, revision: 1, schemaVersion: 1 } });
    await saved;
  });

  it('starting from the template resumes an unpublished draft', async () => {
    repo.useEvent(SLOT, 'draft-event');
    const started = repo.startFromTemplate(SLOT);
    http.expectOne('v1/events/draft-event').flush({ data: { id: 'draft-event', slug: 's', status: 'DRAFT' } });
    await started;

    const saved = repo.saveDraft(doc);
    await flushMicrotasks();
    http.expectOne('v1/events/draft-event/draft').flush({ data: { eventId: 'draft-event', data: {}, revision: 1, schemaVersion: 1 } });
    await saved;
  });

  it('an explicit event link always wins over the cached one', async () => {
    repo.useEvent(SLOT, 'site-one');
    repo.useEvent(SLOT, 'site-two');

    const saved = repo.saveDraft(doc);
    await flushMicrotasks();
    http.expectOne('v1/events/site-two/draft').flush({ data: { eventId: 'site-two', data: {}, revision: 1, schemaVersion: 1 } });
    await saved;
  });
});
