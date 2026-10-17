import { Component, ElementRef, afterRenderEffect, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../../core/auth';
import { ChatSocket } from '../../core/chat-socket';
import type { AcceptedFriendResponseDto, MessageResponseDto } from '../../core/modules/openapi';
import { ChatService } from '../../core/services/chat.service';
import { FriendshipService } from '../../core/services/friendship.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, catchError, merge, startWith, switchMap } from 'rxjs';

// Backend reason codes (chat.service.ts / chat.gateway.ts) mapped to user-facing text.
const CHAT_ERRORS: Record<string, string> = {
  NOT_FRIENDS: 'You can only message friends.',
  TARGET_USER_NOT_FOUND: 'That user no longer exists.',
  CANNOT_MESSAGE_YOURSELF: 'You cannot message yourself.',
  'invalid payload': 'Message must be 1 to 2000 characters.',
};

@Component({
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-chat',
  styleUrl: './chat.css',
  templateUrl: './chat.html',
})
export class Chat {
  private readonly auth = inject(Auth);
  private readonly chatService = inject(ChatService);
  private readonly chatSocket = inject(ChatSocket);
  private readonly friendshipService = inject(FriendshipService);

  private readonly messagesEnd = viewChild<ElementRef<HTMLElement>>('messagesEnd');

  protected readonly expanded = signal(false);

  protected readonly loadingFriends = signal(true);
  protected readonly friends = signal<AcceptedFriendResponseDto[]>([]);

  protected readonly selectedPeerId = signal<string | null>(null);
  protected readonly selectedFriend = computed(() =>
    this.friends().find((f) => f.friend.id === this.selectedPeerId()) ?? null,
  );

  protected readonly loadingMessages = signal(false);
  protected readonly messages = signal<MessageResponseDto[]>([]);
  protected readonly draft = signal('');

  private readonly snackBar = inject(MatSnackBar);
  protected readonly connected = this.chatSocket.ready; // Bound to the Send button so that it gets disabled while reconnecting

  constructor() {
    this.chatSocket.errors$
      .pipe(takeUntilDestroyed())
      .subscribe((reason) =>
        this.snackBar.open(CHAT_ERRORS[reason] ?? 'Could not send message', 'OK', { duration: 4000 }),
      );

    // After a reconnect, fetch what was missed while the socket was down
    effect(() => {
      if (!this.chatSocket.ready())
        return;
      const peerId = untracked(() => this.selectedPeerId());
      if (peerId)
        this.loadConversation(peerId);
    });

    merge(this.chatSocket.friendshipChanges$, this.chatSocket.resync$)
      .pipe(
        startWith(undefined),
        switchMap(() =>
          this.friendshipService.listFriends().pipe(
            catchError(() => {
              this.loadingFriends.set(false);
              this.snackBar.open('Could not load friends.', 'OK', { duration: 4000 });
              return EMPTY;   
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((friends) => {
        this.friends.set(friends);
        this.loadingFriends.set(false);
        const peerId = this.selectedPeerId();
        if ( peerId && !friends.some((f) => f.friend.id === peerId))
          this.selectedPeerId.set(null);
      });

    this.chatSocket.messages$.pipe(takeUntilDestroyed()).subscribe((message) => this.onMessage(message));

    // Keep the conversation scrolled to the latest message.
    afterRenderEffect({
      write: () => {
        this.messages();
        this.messagesEnd()?.nativeElement.scrollIntoView({ block: 'end' });
      },
    });
  }

  protected isOwnMessage(message: MessageResponseDto): boolean {
    return message.senderId === this.auth.userId();
  }

  protected selectFriend(friend: AcceptedFriendResponseDto): void {
    if (this.selectedPeerId() === friend.friend.id) return;

    this.selectedPeerId.set(friend.friend.id);
    this.messages.set([]);
    this.loadingMessages.set(true);
    this.loadConversation(friend.friend.id);
  }

  private loadConversation(peerId: string): void {
    this.chatService.getConversation(peerId).subscribe({
      next: (messages) => {
        if (this.selectedPeerId() !== peerId) return; // Ignore a slow response if the user has since opened another conversation
        this.messages.set(messages);
        this.loadingMessages.set(false);
      },
      error: () => {
        if (this.selectedPeerId() !== peerId) return; // A failure related to a conversation that is no longer open is irrelevant
        this.loadingMessages.set(false); // Without this the spinner never stops (eg. 403)
        this.snackBar.open('Could not load messages', 'OK', { duration: 4000 });
      },
    });
  }

  protected backToList(): void {
    this.selectedPeerId.set(null);
  }

  protected send(): void {
    const peerId = this.selectedPeerId();
    const content = this.draft().trim();
    if (!peerId || !content) return;

    // Keep the draft when sending fails, so that user's text is not lost
    if (!this.chatSocket.send(peerId, content)) {
      this.snackBar.open('Reconnecting to chat, try again in a moment.', 'OK', { duration: 3000 });
      return;
    }
    this.draft.set('');
  }

  private onMessage(message: MessageResponseDto): void {
    const peerId = this.selectedPeerId();
    if (!peerId) return;

    const belongsToConversation = message.senderId === peerId || message.receiverId === peerId;
    if (belongsToConversation) {
      this.messages.update((messages) => [...messages, message]);
    }
  }
}
