import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Reel } from './reel-api.service';
import { provideRouter } from '@angular/router';
import { ReelDownloadComponent } from './reel-download.component';

const URL = 'v1/events/e1/reel';
const reel = (over: Partial<Reel>): { data: Reel } => ({
  data: {
    available: true,
    purchased: true,
    priceMinor: 19900,
    currency: 'INR',
    previewStatus: null,
    previewProgress: 0,
    previewUrl: null,
    previewIsStale: false,
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
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
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

  it('shows the watermarked preview and a way to buy the video until it is bought', () => {
    start();
    // The section reads the video's state, then the preview it shows reads it too.
    const notBought = reel({ purchased: false, previewStatus: 'READY', previewUrl: 'https://x/p.mp4' });
    http.expectOne(URL).flush(notBought);
    fixture.detectChanges();
    http.expectOne(URL).flush(notBought);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const video = el.querySelector('video');
    expect(video?.getAttribute('src')).toBe('https://x/p.mp4');
    expect(video?.getAttribute('controlsList')).toContain('nodownload');
    expect(el.querySelector('a[download]')).toBeNull();
    const buy = el.querySelector('a.reel__btn');
    expect(buy?.textContent).toContain('Buy video');
    expect(buy?.getAttribute('href')).toBe('/payment?site=e1&video=1');
  });

  it('makes the preview by itself right after publishing when the video was not bought', () => {
    start(true);
    http.expectOne(URL).flush(reel({ purchased: false }));
    fixture.detectChanges();
    http.expectOne(URL).flush(reel({ purchased: false }));
    http
      .expectOne({ method: 'POST', url: `${URL}/preview` })
      .flush(reel({ purchased: false, previewStatus: 'QUEUED' }));
    fixture.detectChanges();
    expect(text()).toContain('Making a preview');
  });

  it('offers the download, and publishing again, when the invitation changed', () => {
    start();
    http
      .expectOne(URL)
      .flush(reel({ status: 'READY', downloadUrl: 'https://x/v.mp4', sizeBytes: 3e7, isStale: true }));
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://x/v.mp4');
    expect(text()).toContain('30 MB');
    expect(text()).toContain('Publish changes');
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
