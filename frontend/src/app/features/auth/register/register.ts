import { Component, signal, inject } from '@angular/core';
import { email, form, FormField, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../../../core/auth'
import { Router, RouterLink } from '@angular/router';
import { RegisterDto } from '../../../core/modules/openapi';
import { AUTH_VALID_RULES } from '../../../core/auth/auth-validation.constants';
import { getAuthErrorMessage } from '../../../core/auth/auth-error.util';
import { FieldErrors } from '../../../shared/field-errors/field-errors';

@Component({
  imports: [FormField, RouterLink, FieldErrors],
  selector: 'app-register',
  styleUrl: './register.css',
  templateUrl: './register.html',
})
export class Register {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  registerModel = signal<RegisterDto>({
    username: '',
    email: '',
    password: ''
  });

  registerForm = form(this.registerModel, (fieldPath) => {
    required(fieldPath.username, { message: 'Username is required' });
    minLength(fieldPath.username, AUTH_VALID_RULES.USERNAME.MIN, {
      message: `Username must be at least ${AUTH_VALID_RULES.USERNAME.MIN} characters long`,
    });
    maxLength(fieldPath.username, AUTH_VALID_RULES.USERNAME.MAX, {
      message: `Username cannot exceed ${AUTH_VALID_RULES.USERNAME.MAX} characters`,
    });

    required(fieldPath.email, { message: 'Email is required' });
    email(fieldPath.email, { message: 'Enter a valid email address' });

    required(fieldPath.password, { message: 'Password is required' });
    minLength(fieldPath.password, AUTH_VALID_RULES.PASSWORD.MIN, {
      message: `Password must be at least ${AUTH_VALID_RULES.PASSWORD.MIN} characters long`,
    });
    maxLength(fieldPath.password, AUTH_VALID_RULES.PASSWORD.MAX, {
      message: `Password cannot exceed ${AUTH_VALID_RULES.PASSWORD.MAX} characters`,
    });
  });

  onSubmit(event: Event) {
    event.preventDefault();
    submit(this.registerForm, async () => {
      this.errorMessage.set(null);
      this.submitting.set(true);
      try {
        const data = this.registerModel();
        await firstValueFrom(this.auth.register(data));
        this.router.navigate(['/login']);
      } catch (error) {
        this.errorMessage.set(getAuthErrorMessage(error));
      } finally {
        this.submitting.set(false);
      }
    });
  }
}
