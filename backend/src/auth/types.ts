export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export interface PublicUser {
  id: string;
  email: string;
  passwordHash?: never;
}


export type AuthResult = 
| { success: true; user: PublicUser;  access_token: string; refresh_token: string }
| { success: false; reason: 'INVALID_CREDENTIALS' };

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email };
}

export type RefreshResult =
| { success: true; access_token: string }
| { success: false; reason: 'INVALID_REFRESH_TOKEN' };
