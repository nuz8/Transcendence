import { Component, input } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';

@Component({
  selector: 'app-field-errors',
  template: `
    @if (show()) {
      <div class="error">
        @for (error of errors(); track error.kind) {
          <span>{{ error.message }}</span>
        }
      </div>
    }
  `,
  styles: `
    .error {
      color: #d32f2f;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
  `,
})
export class FieldErrors {
  errors = input<readonly ValidationError[]>([]);
  show = input(false);
}
