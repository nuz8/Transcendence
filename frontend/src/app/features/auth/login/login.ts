import { Component, signal, inject } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../../../core/auth'
import { Router, RouterLink } from '@angular/router';
import { LoginData } from '../../../core/auth/auth.models'
import { getAuthErrorMessage } from '../../../core/auth/auth-error.util';
import { FieldErrors } from '../../../shared/field-errors/field-errors';

@Component({
  imports: [FormField, RouterLink, FieldErrors],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  loginModel = signal<LoginData>({
    email: '',
    password: '',
  });

  loginForm = form(this.loginModel, (fieldPath) => {
    required(fieldPath.email, {message: 'Email is required'});
    email(fieldPath.email, {message: 'Enter a valid email address'});
    required(fieldPath.password, {message: 'Password is required'});
  });

  onSubmit(event: Event) {
    event.preventDefault();
    submit(this.loginForm, async () => {
      this.errorMessage.set(null);
      this.submitting.set(true);
      try {
        const credentials = this.loginModel();
        await firstValueFrom(this.auth.login(credentials));
        this.router.navigate(['/']);
      } catch (error) {
        this.errorMessage.set(getAuthErrorMessage(error));
      } finally {
        this.submitting.set(false);
      }
    });
  }
}
