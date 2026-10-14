import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';
import { Chat } from './features/chat/chat';
import { Auth } from './core/auth';

@Component({
  imports: [RouterOutlet, Header, Chat, Footer],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly authService = inject(Auth);
}
