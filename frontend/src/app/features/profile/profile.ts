import { ActivatedRoute } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormField, form, submit, validate } from '@angular/forms/signals';
import { catchError, EMPTY, firstValueFrom, map, startWith, Subject, switchMap, type Observable, finalize, tap, filter, merge } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import type { ProfileResponseDto, SelfProfileResponseDto } from '../../core/modules/openapi';
import { FriendshipService } from '../../core/services/friendship.service';
import { UserService } from '../../core/services/user.service';
import { Auth } from '../../core/auth';
import { AUTH_VALID_RULES } from '../../core/auth/auth-validation.constants';
import { AVATAR_VALID_RULES } from '../../core/services/avatar-validation.constants';
import { ChatSocket } from '../../core/chat-socket';
import { MatProgressBarModule } from '@angular/material/progress-bar';

type ProfileView =
  | { profile: SelfProfileResponseDto; isSelf: true }
  | { profile: ProfileResponseDto; isSelf: false };

function xpForLevel(level: number): number {
  return level <= 0 ? 0 : Math.ceil(5 * Math.pow(1.42, level - 1));
}

@Component({
  imports: [
    MatProgressBarModule,
    DatePipe,
    AsyncPipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    FormField,
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
  private readonly chatSocket = inject(ChatSocket);

  protected friendshipActionPending = false;
  protected readonly isEditMode = signal(false);
  protected readonly usernameUpdatePending = signal(false);
  protected readonly usernameError = signal<string | null>(null);
  protected readonly usernameModel = signal({ username: '' });
  protected readonly avatarUploadPending = signal(false);
  protected readonly avatarError = signal<string | null>(null);
  protected readonly usernameForm = form(this.usernameModel, (fieldPath) => {
    validate(fieldPath.username, ({ value }) => {
      const length = value().trim().length;
      if (length === 0) return { kind: 'required', message: 'Username is required' };
      if (length < AUTH_VALID_RULES.USERNAME.MIN) {
        return { kind: 'minLength', message: `Username must be at least ${AUTH_VALID_RULES.USERNAME.MIN} characters long` };
      }
      if (length > AUTH_VALID_RULES.USERNAME.MAX) {
        return { kind: 'maxLength', message: `Username cannot exceed ${AUTH_VALID_RULES.USERNAME.MAX} characters` };
      }
      return null;
    });
  });

  protected readonly profile$: Observable<ProfileView> = this.route.paramMap.pipe(
    switchMap((params): Observable<ProfileView> => {
      const requestedId = params.get('id');
      const userId = requestedId === this.auth.userId() ? null : requestedId;
      const reload$: Observable<void> = userId === null ? this.reloadProfile$ : merge(
        this.reloadProfile$,
        this.chatSocket.friendshipChanges$.pipe(filter((change) => change.peerId === userId)),
        this.chatSocket.resync$,
      ).pipe(map((): void => undefined));
      return reload$.pipe(
        startWith(undefined),
        switchMap(() => {
          const request$: Observable<ProfileView> = userId === null
            ? this.userService.getSelfProfile().pipe(
                map((profile) => ({ profile, isSelf: true as const })),
              )
            : this.userService.getUserPorfile(userId).pipe(
                map((profile) => ({ profile, isSelf: false as const })),
              );
          return request$.pipe(catchError(() => EMPTY));
        }),
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

  protected async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.avatarError.set(null);
    if (!(AVATAR_VALID_RULES.ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      this.avatarError.set('Only JPEG, PNG or WEBP images are allowed.');
      return;
    }
    if (file.size > AVATAR_VALID_RULES.MAX_FILE_SIZE_BYTES) {
      this.avatarError.set('Image must be smaller than 5 MB.');
      return;
    }

    this.avatarUploadPending.set(true);
    try {
      await firstValueFrom(this.userService.uploadAvatar(file));
      this.reloadProfile$.next();
    } catch (error) {
      this.avatarError.set(this.avatarErrorMessage(error));
    } finally {
      this.avatarUploadPending.set(false);
    }
  }

  // This condition can still be reached in case of renamed or corrupted files.
  private avatarErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return 'The file is not a valid JPEG, PNG or WEBP image.';
    }
    return 'Unable to upload avatar. Please try again.';
  }

  protected toggleEdit(username: string): void {
    this.usernameError.set(null);
    if (this.isEditMode()) {
      this.isEditMode.set(false);
      return;
    }

    this.usernameModel.set({ username });
    this.isEditMode.set(true);
  }

  protected submitUsername(event: Event): void {
    event.preventDefault();
    submit(this.usernameForm, async () => {
      this.usernameError.set(null);
      this.usernameUpdatePending.set(true);
      try {
        await firstValueFrom(this.userService.updateUsername(this.usernameModel().username.trim()));
        this.isEditMode.set(false);
        this.reloadProfile$.next();
      } catch (error) {
        const reason = error instanceof HttpErrorResponse ? error.error?.message : undefined;
        this.usernameError.set(reason === 'USERNAME_ALREADY_EXISTS'
          ? 'That username is already taken.'
          : 'Unable to update username. Please try again.');
      } finally {
        this.usernameUpdatePending.set(false);
      }
    });
  }

  protected levelProgress(level: number, xp: number): { left: number, percent: number} {
    const start = xpForLevel(level);
    const end = xpForLevel(level + 1);
    return { left: end - xp, percent: ((xp - start) / (end - start)) * 100 };
  }
}
