import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TemplateSchemaLoader } from '../../../editor/data/template-schema.loader';
import { InvitationPageComponent } from './invitation-page.component';

const INVITATION = {
  eventId: 'e1',
  slug: 'tanu-and-varun',
  title: 'tpl-lace-classic',
  status: 'PUBLISHED',
  ownerId: 'u1',
  templateSlotId: 'tpl-lace-classic',
  draftData: { couple: { brideName: 'Tanu', groomName: 'Varun' } },
  schemaVersion: 1,
};

describe('InvitationPageComponent', () => {
  let fixture: ComponentFixture<InvitationPageComponent>;
  let http: HttpTestingController;
  let component: InvitationPageComponent;

  const state = (): string => (component as unknown as { state: () => string }).state();
  const pending = (): unknown => (component as unknown as { pendingData: unknown }).pendingData;
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TemplateSchemaLoader,
          useValue: { load: () => Promise.resolve({ previewUrl: '/invitation-templates/x.html' }) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InvitationPageComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('slug', 'tanu-and-varun');
  });

  afterEach(() => {
    delete window.__TI_INVITATION__;
  });

  it('shows the invitation from the page without waiting for the API', async () => {
    window.__TI_INVITATION__ = structuredClone(INVITATION);
    const init = component.ngOnInit();
    await init;
    expect(state()).toBe('ready');
    expect(pending()).toEqual(INVITATION.draftData);
    // Read once, so a later in-app navigation can't reuse it.
    expect(window.__TI_INVITATION__).toBeUndefined();
    // Checked against the API afterwards, without holding anything up.
    http.expectOne((req) => req.url.endsWith('v1/i/tanu-and-varun')).flush(INVITATION);
    await settle();
    expect(pending()).toEqual(INVITATION.draftData);
  });

  it('picks up edits made since the page was cached', async () => {
    window.__TI_INVITATION__ = structuredClone(INVITATION);
    await component.ngOnInit();
    const edited = {
      ...INVITATION,
      draftData: { couple: { brideName: 'Tanvi', groomName: 'Varun' } },
    };
    http.expectOne((req) => req.url.endsWith('v1/i/tanu-and-varun')).flush(edited);
    await settle();
    expect(pending()).toEqual(edited.draftData);
  });

  it('keeps what it shows when the API check fails', async () => {
    window.__TI_INVITATION__ = structuredClone(INVITATION);
    await component.ngOnInit();
    http
      .expectOne((req) => req.url.endsWith('v1/i/tanu-and-varun'))
      .flush('down', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(state()).toBe('ready');
    expect(pending()).toEqual(INVITATION.draftData);
  });

  it('ignores data for a different invitation and loads from the API as before', async () => {
    window.__TI_INVITATION__ = { ...structuredClone(INVITATION), slug: 'someone-else' };
    const init = component.ngOnInit();
    await settle();
    expect(state()).toBe('loading');
    http.expectOne((req) => req.url.endsWith('v1/i/tanu-and-varun')).flush(INVITATION);
    await init;
    expect(state()).toBe('ready');
    expect(pending()).toEqual(INVITATION.draftData);
  });
});
