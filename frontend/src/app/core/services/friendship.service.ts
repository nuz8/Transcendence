import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import {
  FriendsService,
  type AcceptedFriendResponseDto,
  type FriendActionResponseDto,
  type FriendshipResponseDto,
} from '../modules/openapi';

@Service()
export class FriendshipService {
  private readonly friendsApiClient = inject(FriendsService);

  sendRequest(userId: string): Observable<FriendshipResponseDto> {
    return this.friendsApiClient.friendControllerSendRequest({
      sendFriendRequestDto: { addresseeId: userId },
    });
  }

  acceptRequest(friendshipId: string): Observable<FriendshipResponseDto> {
    return this.friendsApiClient.friendControllerAccept({ id: friendshipId });
  }

  declineRequest(friendshipId: string): Observable<FriendshipResponseDto> {
    return this.friendsApiClient.friendControllerDecline({ id: friendshipId });
  }

  removeFriend(friendshipId: string): Observable<FriendActionResponseDto> {
    return this.friendsApiClient.friendControllerRemove({ id: friendshipId });
  }

  listFriends(): Observable<AcceptedFriendResponseDto[]> {
    return this.friendsApiClient.friendControllerListFriends();
  }

  listIncoming(): Observable<FriendshipResponseDto[]> {
    return this.friendsApiClient.friendControllerListPending();
  }
}
