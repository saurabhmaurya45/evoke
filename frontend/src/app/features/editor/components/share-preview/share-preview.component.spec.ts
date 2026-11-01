import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SHARE_SECTION } from '../../data/share-section';
import { TemplateEditorStore } from '../../data/template-editor.store';
import type { TemplateSchema } from '../../models/template-schema.model';
import { SharePreviewComponent } from './share-preview.component';

const SCHEMA: TemplateSchema = {
  id: 'tpl-lace-classic',
  name: 'Lace',
  category: 'Wedding',
  version: 1,
  previewUrl: '',
  defaultsUrl: '',
  sections: [SHARE_SECTION],
};

const SAVED = {
  couple: { brideName: 'Tanu', groomName: 'Varun' },
  countdown: { date: '2027-12-14' },
  venue: { name: 'Sultanpur palace' },
  gallery: {
    items: [{ image: 'https://cdn.example/invitation-templates/template 12/sample.jpg' }],
  },
};

describe('SharePreviewComponent', () => {
  let fixture: ComponentFixture<SharePreviewComponent>;
  let store: TemplateEditorStore;

  const text = (selector: string): string =>
    (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim() ?? '';
  const image = (): string =>
    (fixture.nativeElement as HTMLElement).querySelector('.share__image')?.getAttribute('src') ??
    '';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TemplateEditorStore] });
    store = TestBed.inject(TemplateEditorStore);
    store.load(SCHEMA);
    // The store keeps only the schema's sections, so the invitation's own details are set directly.
    for (const [section, values] of Object.entries(SAVED)) {
      for (const [key, value] of Object.entries(values)) {
        store.setField(section, key, value as string);
      }
    }
    fixture = TestBed.createComponent(SharePreviewComponent);
    fixture.detectChanges();
  });

  it('says what the invitation says until the user types', () => {
    expect(text('.share__title')).toBe("Tanu & Varun's Wedding Invitation");
    expect(text('.share__description')).toBe('14 December 2027 · Sultanpur palace');
    expect(text('.share__domain')).toBe('theinvitely.in');
    expect(text('.share__overlay')).toContain('Tanu & Varun');
  });

  it("shows the template's poster rather than a sample photo", () => {
    expect(image()).toContain('card-poster.jpg');
  });

  it('follows what the user types, and a chosen picture is shown without names on it', () => {
    store.setField('share', 'title', 'Please join us');
    store.setField('share', 'image', 'https://cdn.example/mine.jpg');
    fixture.detectChanges();
    expect(text('.share__title')).toBe('Please join us');
    expect(text('.share__description')).toBe('14 December 2027 · Sultanpur palace');
    expect(image()).toBe('https://cdn.example/mine.jpg');
    expect(text('.share__overlay')).toBe('');
  });

  it('goes back to the default', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('.share__reset')).toBeNull();
    store.setField('share', 'title', 'Please join us');
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.share__reset')!
      .click();
    fixture.detectChanges();
    expect(text('.share__title')).toBe("Tanu & Varun's Wedding Invitation");
    expect((fixture.nativeElement as HTMLElement).querySelector('.share__reset')).toBeNull();
  });
});
