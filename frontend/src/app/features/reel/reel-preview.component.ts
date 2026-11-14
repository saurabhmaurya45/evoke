import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type Observable, type Subscription, switchMap, takeWhile, timer } from 'rxjs';
import { type Reel, ReelApiService } from './reel-api.service';

const POLL_INTERVAL_MS = 4000;
const isActive = (reel: Reel | null): boolean =>
  reel?.previewStatus === 'QUEUED' || reel?.previewStatus === 'RENDERING';

/**
 * The watermarked preview of an invitation's video, shown before it is bought. The
 * watermark and low resolution are burned into the file on the server, so the file
 * itself is no use without paying, whatever is done in the browser; hiding the
 * download control here only keeps the page honest about that.
 */
@Component({
  selector: 'app-reel-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reel-preview.component.html',
  styleUrl: './reel-download.component.scss',
})
export class ReelPreviewComponent {
  private readonly api = inject(ReelApiService);
  private readonly destroyRef = inject(DestroyRef);
  private subscription: Subscription | null = null;

  readonly eventId = input.required<string>();
  /** Make the preview straight away when there is none, or it shows old details. */
  readonly autoStart = input(false);
  /** A small player beside other content: the caption about the watermark is left to the host. */
  readonly compact = input(false);
  /** Reports the video's state, e.g. so checkout knows whether it can be offered. */
  readonly loaded = output<Reel>();

  protected readonly reel = signal<Reel | null>(null);
  protected readonly error = signal('');
  protected readonly isWorking = computed(() => isActive(this.reel()));

  constructor() {
    effect(() => {
      const eventId = this.eventId();
      untracked(() => this.follow(this.api.get(eventId), this.autoStart()));
    });
  }

  protected create(): void {
    this.follow(this.api.requestPreview(this.eventId()));
  }

  protected blockMenu(event: Event): void {
    event.preventDefault();
  }

  private follow(first: Observable<Reel>, startIfNeeded = false): void {
    this.subscription?.unsubscribe();
    this.error.set('');
    this.subscription = first.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (reel) => this.show(reel, startIfNeeded),
      error: (err: unknown) => this.showError(err),
    });
  }

  private show(reel: Reel, startIfNeeded: boolean): void {
    this.reel.set(reel);
    this.loaded.emit(reel);
    const outdated = !reel.previewUrl || reel.previewIsStale || reel.previewStatus === 'FAILED';
    if (startIfNeeded && reel.available && !isActive(reel) && outdated) {
      this.create();
    } else if (isActive(reel)) {
      this.poll();
    }
  }

  private poll(): void {
    this.subscription = timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.api.get(this.eventId())),
        takeWhile((reel) => isActive(reel), true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (reel) => {
          this.reel.set(reel);
          this.loaded.emit(reel);
        },
        error: (err: unknown) => this.showError(err),
      });
  }

  private showError(err: unknown): void {
    const message =
      err instanceof HttpErrorResponse
        ? (err.error as { error?: { message?: string } } | null)?.error?.message
        : null;
    this.error.set(message || "We couldn't reach the server. Please try again.");
  }
}
