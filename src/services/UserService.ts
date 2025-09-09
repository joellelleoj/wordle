import { prisma } from "./DatabaseService";
import { UpdateUserDto, SearchUsersDto, PublicUserDto } from "../dto/UserDto";
import { AppError } from "../utils/AppError";

export class UserService {
  public async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        provider: true,
        isActive: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }

  public async updateUser(id: string, updateDto: UpdateUserDto) {
    const { username, displayName, avatarUrl } = updateDto;

    // Check if username is already taken
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id },
        },
      });

      if (existingUser) {
        throw new AppError("Username is already taken", 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(username && { username }),
        ...(displayName && { displayName }),
        ...(avatarUrl && { avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        provider: true,
        isActive: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  public async deleteUser(id: string): Promise<void> {
    // Soft delete - mark as inactive
    await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        email: `deleted_${Date.now()}_${Math.random()}@deleted.com`, // Avoid email conflicts
      },
    });
  }

  public async searchUsers(
    searchDto: SearchUsersDto
  ): Promise<PublicUserDto[]> {
    const { query, limit = 20, offset = 0 } = searchDto;

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(query && {
          OR: [
            { username: { contains: query, mode: "insensitive" } },
            { displayName: { contains: query, mode: "insensitive" } },
          ],
        }),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 50), // Max 50 results
      skip: offset,
    });

    return users;
  }
}
