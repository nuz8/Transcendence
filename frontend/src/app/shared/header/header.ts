import { Component, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth'

@Component({
  imports: [RouterLink],
  selector: 'app-header',
  styleUrl: './header.css',
  templateUrl: './header.html',
})
export class Header {
  private readonly router = inject(Router);
  private readonly authService = inject(Auth);

  readonly isUserLoggedIn = computed(() => this.authService.isLoggedIn());

  onLogout(): void {
    this.authService.logout().subscribe({
      error: (error) => {
        console.error('Logout request failed', error);
      },
    });

    void this.router.navigate(['/login']);
  }
}
