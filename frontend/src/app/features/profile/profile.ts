import { ActivatedRoute } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map, startWith, Subject, switchMap, type Observable, finalize, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { ProfileResponseDto, SelfProfileResponseDto } from '../../core/modules/openapi';
import { FriendshipService } from '../../core/services/friendship.service';
import { UserService } from '../../core/services/user.service';
import { Auth } from '../../core/auth';

type ProfileView =
  | { profile: SelfProfileResponseDto; isSelf: true }
  | { profile: ProfileResponseDto; isSelf: false };

@Component({
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-profile',
  styleUrl: './profile.css',
  templateUrl: './profile.html',
})
export class Profile {
  private readonly userService = inject(UserService);
  private readonly friendshipService = inject(FriendshipService);
  private readonly route = inject(ActivatedRoute);
  private readonly reloadProfile$ = new Subject<void>();
  private readonly auth = inject(Auth);

  protected friendshipActionPending = false;

  protected readonly profile$: Observable<ProfileView> = this.route.paramMap.pipe(
    switchMap((params): Observable<ProfileView> => {
      const requestedId = params.get('id');
      const userId = requestedId === this.auth.userId() ? null : requestedId;
      return this.reloadProfile$.pipe(
        startWith(undefined),
        switchMap(() => userId === null
          ? this.userService.getSelfProfile().pipe(
              map((profile) => ({ profile, isSelf: true as const })),
            )
          : this.userService.getUserPorfile(userId).pipe(
              map((profile) => ({ profile, isSelf: false as const })),
            )),
      );
    }),
  );

  protected performFriendshipAction(
    profile: ProfileResponseDto,
    action: 'invite' | 'remove' | 'accept' | 'reject',
  ): void {
    if (this.friendshipActionPending) return;

    const friendshipId = profile.friendship.friendshipId;
    let request: Observable<unknown> | undefined;
    if (action === 'invite') {
      request = this.friendshipService.sendRequest(profile.id);
    } else if (friendshipId !== null) {
      request = action === 'remove'
        ? this.friendshipService.removeFriend(friendshipId)
        : action === 'accept'
          ? this.friendshipService.acceptRequest(friendshipId)
          : this.friendshipService.declineRequest(friendshipId);
    }

    if (request === undefined) return;

    this.friendshipActionPending = true;
    request.pipe(
      tap(() => this.reloadProfile$.next()),
      finalize(() => this.friendshipActionPending = false),
    ).subscribe();
  }
}
