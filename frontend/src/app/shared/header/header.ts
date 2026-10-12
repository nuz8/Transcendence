import { Component, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  imports: [RouterLink, MatToolbarModule, MatButtonModule],
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
