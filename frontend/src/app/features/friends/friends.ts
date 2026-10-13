import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { map, forkJoin, switchMap } from 'rxjs';
import { ProfileResponseDto, type AcceptedFriendResponseDto } from '../../core/modules/openapi';
import { FriendshipService } from '../../core/services/friendship.service';
import { BasePaginationComponent } from '../../shared/pagination/pagination-base';
import { PaginationControlsComponent } from '../../shared/pagination/pagination-controls';
import { UserService } from '../../core/services/user.service';

@Component({
  imports: [MatButtonModule, MatCardModule, MatDividerModule, MatListModule, PaginationControlsComponent, RouterLink],
  selector: 'app-friends',
  styleUrl: './friends.css',
  templateUrl: './friends.html',
})
export class Friends extends BasePaginationComponent<AcceptedFriendResponseDto> {
    private readonly friendshipService = inject(FriendshipService);
    private readonly userService = inject(UserService);
    protected readonly requesters = signal<ProfileResponseDto[]>([]);

    ngOnInit(): void {
        this.loadPage(this.currentPage());
        this.loadRequests();
    }

    protected fetchData(page: number, size: number) {
        return this.friendshipService.listFriends().pipe(
            map((all) => ({ items: all.slice((page - 1) * size, page * size), total: all.length })),
        );
    }

    protected remove(row: AcceptedFriendResponseDto): void {
        this.friendshipService.removeFriend(row.friendshipId).subscribe({
            next: () => this.loadPage(this.currentPage()),
            error: () => this.loadPage(this.currentPage()),
        });
    }

    private loadRequests(): void {
        this.friendshipService
            .listIncoming()
            .pipe(switchMap((requests) => forkJoin(requests.map((r) => this.userService.getUserPorfile(r.requesterId)))))
            .subscribe((profiles) => this.requesters.set(profiles));
    }
}