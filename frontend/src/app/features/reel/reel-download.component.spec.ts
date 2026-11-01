import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Reel } from './reel-api.service';
import { ReelDownloadComponent } from './reel-download.component';

const URL = 'v1/events/e1/reel';
const reel = (over: Partial<Reel>): { data: Reel } => ({
  data: {
    available: true,
    status: null,
    progress: 0,
    downloadUrl: null,
    sizeBytes: null,
    isStale: false,
    ...over,
  },
});

describe('ReelDownloadComponent', () => {
  let fixture: ComponentFixture<ReelDownloadComponent>;
  let http: HttpTestingController;

  function start(autoStart = false): void {
    fixture = TestBed.createComponent(ReelDownloadComponent);
    fixture.componentRef.setInput('eventId', 'e1');
    fixture.componentRef.setInput('autoStart', autoStart);
    fixture.detectChanges();
  }

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  it('shows nothing when the template has no film', () => {
    start(true);
    http.expectOne(URL).flush(reel({ available: false }));
    fixture.detectChanges();
    expect(text().trim()).toBe('');
  });

  it('starts by itself right after publishing', () => {
    start(true);
    http.expectOne({ method: 'GET', url: URL }).flush(reel({}));
    http.expectOne({ method: 'POST', url: URL }).flush(reel({ status: 'QUEUED' }));
    fixture.detectChanges();
    expect(text()).toContain('Creating your video');
  });

  it('waits to be asked on the dashboard', () => {
    start();
    http.expectOne(URL).flush(reel({}));
    fixture.detectChanges();
    expect(text()).toContain('Create my video');
  });

  it('offers the download and a new video when the invitation changed', () => {
    start();
    http
      .expectOne(URL)
      .flush(reel({ status: 'READY', downloadUrl: 'https://x/v.mp4', sizeBytes: 3e7, isStale: true }));
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://x/v.mp4');
    expect(text()).toContain('30 MB');
    expect(text()).toContain('Create new video');
  });

  it("shows the server's reason when a request is refused", () => {
    start();
    http.expectOne(URL).flush(reel({}));
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    http
      .expectOne({ method: 'POST', url: URL })
      .flush(
        { error: { message: 'You can create up to 5 videos a day.' } },
        { status: 429, statusText: 'Too Many Requests' },
      );
    fixture.detectChanges();
    expect(text()).toContain('up to 5 videos');
  });
});
