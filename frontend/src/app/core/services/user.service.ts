import { Service, inject } from '@angular/core';
import { SelfProfileResponseDto, UsersService } from '../modules/openapi';
import type { Observable } from 'rxjs';

@Service()
export class UserService {
  private readonly userApiClient = inject(UsersService);

  getSelfProfile(): Observable<SelfProfileResponseDto> {
    return this.userApiClient.profileControllerGetSelfProfile();
  }
}
