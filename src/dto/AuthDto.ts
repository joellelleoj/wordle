export interface RegisterDto {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

export interface UserDto {
  id: string;
  email: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  provider: string;
  isActive: boolean;
  createdAt: Date;
}
