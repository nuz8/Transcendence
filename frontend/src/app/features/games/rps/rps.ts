import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  imports: [MatCardModule],
  selector: 'app-rps',
  styleUrl: './rps.css',
  templateUrl: './rps.html',
})
export class Rps {
  readonly gameId = input.required<string>();
}
