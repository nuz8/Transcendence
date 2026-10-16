import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  imports: [MatCardModule],
  selector: 'app-ttt',
  styleUrl: './ttt.css',
  templateUrl: './ttt.html',
})
export class Ttt {
  readonly gameId = input.required<string>();
}