import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type Observable, type Subscription, switchMap, takeWhile, timer } from 'rxjs';
import { type Reel, ReelApiService } from './reel-api.service';

const POLL_INTERVAL_MS = 4000;

/**
 * "Download your video" section of a published invitation. Renders nothing when the
 * invitation can't have a video (its template has no film yet). The video is made on
 * the server, so the visitor can leave and find it on their dashboard later.
 */
@Component({
  selector: 'app-reel-download',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reel-download.component.html',
  styleUrl: './reel-download.component.scss',
})
export class ReelDownloadComponent {
  private readonly api = inject(ReelApiService);
  private readonly destroyRef = inject(DestroyRef);
  private subscription: Subscription | null = null;

  readonly eventId = input.required<string>();
  /** Start making the video straight away if there isn't one, as right after publishing. */
  readonly autoStart = input(false);
  /** Show the finished video above its download button. */
  readonly preview = input(false);

  protected readonly reel = signal<Reel | null>(null);
  protected readonly error = signal('');

  protected readonly isWorking = computed(() => {
    const status = this.reel()?.status;
    return status === 'QUEUED' || status === 'RENDERING';
  });
  protected readonly sizeLabel = computed(() => {
    const bytes = this.reel()?.sizeBytes;
    return bytes ? `${Math.max(1, Math.round(bytes / 1e6))} MB` : '';
  });

  constructor() {
    effect(() => {
      const eventId = this.eventId();
      untracked(() => this.load(eventId));
    });
  }

  protected create(): void {
    this.follow(this.api.request(this.eventId()));
  }

  private load(eventId: string): void {
    this.reel.set(null);
    this.follow(this.api.get(eventId), this.autoStart());
  }

  /** Shows the answer, then keeps polling for as long as a render is running. */
  private follow(first: Observable<Reel>, startIfNone = false): void {
    this.subscription?.unsubscribe();
    this.error.set('');
    this.subscription = first.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (reel) => {
        this.reel.set(reel);
        if (startIfNone && reel.available && reel.status === null) {
          this.create();
        } else if (this.isWorking()) {
          this.poll();
        }
      },
      error: (err: unknown) => this.showError(err),
    });
  }

  private poll(): void {
    this.subscription = timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.api.get(this.eventId())),
        takeWhile((reel) => reel.status === 'QUEUED' || reel.status === 'RENDERING', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (reel) => this.reel.set(reel),
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
