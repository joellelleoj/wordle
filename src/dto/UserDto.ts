export interface UpdateUserDto {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface SearchUsersDto {
  query?: string;
  limit?: number;
  offset?: number;
}

export interface PublicUserDto {
  id: string;
  username?: string | null; // Allow null from Prisma
  displayName: string | null; // Allow null from Prisma
  avatarUrl?: string | null; // Allow null from Prisma
  createdAt: Date;
}
