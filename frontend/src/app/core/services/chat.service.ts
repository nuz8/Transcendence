import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ChatService as ChatApiClient, type MessageResponseDto } from '../modules/openapi';

@Service()
export class ChatService {
  private readonly chatApiClient = inject(ChatApiClient);

  getConversation(peerId: string): Observable<MessageResponseDto[]> {
    return this.chatApiClient.chatControllerGetConversation({ peerId });
  }
}
