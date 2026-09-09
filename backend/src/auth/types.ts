import { PublicUserData } from '../users';

export type AuthResult = 
| { success: true; user: PublicUserData;  access_token: string; refresh_token: string }
| { success: false; reason: 'INVALID_CREDENTIALS' };

export type RefreshResult =
| { success: true; access_token: string; refresh_token: string }
| { success: false; reason: 'INVALID_REFRESH_TOKEN' };

export type RegisterResult = 
| { success: true; user: PublicUserData }
| { success: false; reason: 'USERNAME_ALREADY_EXISTS' | 'EMAIL_ALREADY_EXISTS' };