export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
}

export interface LoginResponse {
  user: User;
  access_token: string;
}

export interface RefreshResponse {
  access_token: string;
}

export interface LogoutResponse {
  success: boolean;
  refresh_token_revoked?: boolean;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export type RegisterResponse = User;
