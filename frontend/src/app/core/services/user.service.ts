import { Service, inject } from '@angular/core';
import { ProfileResponseDto, SelfProfileResponseDto, UsersService } from '../modules/openapi';
import type { Observable } from 'rxjs';

@Service()
export class UserService {
  private readonly userApiClient = inject(UsersService);

  getSelfProfile(): Observable<SelfProfileResponseDto> {
    return this.userApiClient.profileControllerGetSelfProfile();
  }

  getUserPorfile(userId: string): Observable<ProfileResponseDto> {
    return this.userApiClient.profileControllerGetProfile({ id: userId })
  }

  updateUsername(username: string) {
    return this.userApiClient.userControllerUpdateSelf({ updateProfileDto: { username } });
  }

  uploadAvatar(avatar: Blob) {
    return this.userApiClient.userControllerUploadAvatar({ avatar });
  }
}
