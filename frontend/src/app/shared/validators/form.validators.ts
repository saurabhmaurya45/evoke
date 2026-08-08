import { type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';

/**
 * Reusable, framework-standard validators for the future reactive/typed
 * forms (auth, RSVP, checkout). Kept pure and tree-shakeable.
 */
export class EvokeValidators {
  /** Rejects values that are only whitespace. */
  static readonly notBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    return value && value.trim().length > 0 ? null : { notBlank: true };
  };

  /** Stricter email check than Angular's built-in. */
  static readonly email: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) {
      return null;
    }
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    return ok ? null : { email: true };
  };

  /** Factory: value must match another control (e.g. confirm password). */
  static matches(otherKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const other = control.parent?.get(otherKey);
      if (!other) {
        return null;
      }
      return control.value === other.value ? null : { mismatch: true };
    };
  }
}
