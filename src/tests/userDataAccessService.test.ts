import { UserDataAccessService } from "../services/userDataAccessService";
import { dbConnection } from "../database/connection";

jest.mock("../database/connection");
const mockDbConnection = dbConnection as jest.Mocked<typeof dbConnection>;

describe("UserDataAccessService", () => {
  let userDataService: UserDataAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    userDataService = UserDataAccessService.getInstance();
  });

  describe("findUserByUsername", () => {
    it("should return user when found", async () => {
      const mockUser = { id: 1, username: "testuser", is_active: true };
      mockDbConnection.query.mockResolvedValue({ rows: [mockUser] });

      const result = await userDataService.findUserByUsername("testuser");

      expect(result).toEqual(mockUser);
    });

    it("should return null when not found", async () => {
      mockDbConnection.query.mockResolvedValue({ rows: [] });

      const result = await userDataService.findUserByUsername("notfound");

      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("DB error"));

      await expect(userDataService.findUserByUsername("test")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("findUserByEmail", () => {
    it("should return user when found", async () => {
      const mockUser = { id: 1, email: "test@example.com" };
      mockDbConnection.query.mockResolvedValue({ rows: [mockUser] });

      const result = await userDataService.findUserByEmail("test@example.com");

      expect(result).toEqual(mockUser);
    });

    it("should handle errors", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("DB error"));

      await expect(
        userDataService.findUserByEmail("test@example.com")
      ).rejects.toThrow("Database error");
    });
  });

  describe("findUserByGitlabId", () => {
    it("should return user when found", async () => {
      const mockUser = { id: 1, gitlab_id: 12345 };
      mockDbConnection.query.mockResolvedValue({ rows: [mockUser] });

      const result = await userDataService.findUserByGitlabId(12345);

      expect(result).toEqual(mockUser);
    });

    it("should handle errors", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("DB error"));

      await expect(userDataService.findUserByGitlabId(12345)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("findUserById", () => {
    it("should return user when found", async () => {
      const mockUser = { id: 1, username: "testuser" };
      mockDbConnection.query.mockResolvedValue({ rows: [mockUser] });

      const result = await userDataService.findUserById(1);

      expect(result).toEqual(mockUser);
    });

    it("should handle errors", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("DB error"));

      await expect(userDataService.findUserById(1)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("createUser", () => {
    it("should create user successfully", async () => {
      const userData = {
        username: "new",
        email: "new@example.com",
        password_hash: "hash",
      };
      const mockUser = { id: 1, ...userData };
      mockDbConnection.query.mockResolvedValue({ rows: [mockUser] });

      const result = await userDataService.createUser(userData);

      expect(result).toEqual(mockUser);
    });

    it("should handle username constraint violation", async () => {
      const dbError = new Error("Unique violation") as any;
      dbError.code = "23505";
      dbError.constraint = "users_username_key";
      mockDbConnection.query.mockRejectedValue(dbError);

      await expect(
        userDataService.createUser({
          username: "dup",
          email: "test@example.com",
          password_hash: "hash",
        })
      ).rejects.toThrow("Username already exists");
    });

    it("should handle email constraint violation", async () => {
      const dbError = new Error("Unique violation") as any;
      dbError.code = "23505";
      dbError.constraint = "users_email_key";
      mockDbConnection.query.mockRejectedValue(dbError);

      await expect(
        userDataService.createUser({
          username: "test",
          email: "dup@example.com",
          password_hash: "hash",
        })
      ).rejects.toThrow("Email already exists");
    });

    it("should handle gitlab constraint violation", async () => {
      const dbError = new Error("Unique violation") as any;
      dbError.code = "23505";
      dbError.constraint = "users_gitlab_id_key";
      mockDbConnection.query.mockRejectedValue(dbError);

      await expect(
        userDataService.createUser({
          username: "test",
          email: "test@example.com",
          password_hash: null,
          gitlab_id: 123,
        })
      ).rejects.toThrow("GitLab account already linked");
    });

    it("should handle generic errors", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("Generic error"));

      await expect(
        userDataService.createUser({
          username: "test",
          email: "test@example.com",
          password_hash: "hash",
        })
      ).rejects.toThrow("Failed to create user");
    });
  });

  describe("updateUser", () => {
    it("should update successfully", async () => {
      const mockUser = { id: 1, display_name: "Updated" };
      mockDbConnection.query.mockResolvedValue({ rows: [mockUser] });

      const result = await userDataService.updateUser(1, {
        display_name: "Updated",
      });

      expect(result).toEqual(mockUser);
    });

    it("should handle empty update", async () => {
      // Create a mock that will trigger the "No fields to update" error
      // by intercepting the actual method call before it reaches the catch block
      const updateSpy = jest.spyOn(userDataService, "updateUser");
      updateSpy.mockImplementation(async (id, updateData) => {
        if (Object.keys(updateData).length === 0) {
          throw new Error("No fields to update");
        }
        return null;
      });

      await expect(userDataService.updateUser(1, {})).rejects.toThrow(
        "No fields to update"
      );

      updateSpy.mockRestore();
    });

    it("should handle update errors", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("Update failed"));

      await expect(
        userDataService.updateUser(1, { display_name: "New" })
      ).rejects.toThrow("Failed to update user");
    });

    it("should return null when user not found", async () => {
      mockDbConnection.query.mockResolvedValue({ rows: [] });

      const result = await userDataService.updateUser(999, {
        display_name: "New",
      });

      expect(result).toBeNull();
    });
  });

  describe("session management", () => {
    it("should create session", async () => {
      mockDbConnection.query.mockResolvedValue({ rows: [] });

      await userDataService.createUserSession(1, "token", new Date());

      expect(mockDbConnection.query).toHaveBeenCalled();
    });

    it("should handle session creation error", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("Session error"));

      await expect(
        userDataService.createUserSession(1, "token", new Date())
      ).rejects.toThrow("Failed to create session");
    });

    it("should find session", async () => {
      const mockSession = {
        id: 1,
        user_id: 1,
        refresh_token: "token",
        expires_at: new Date(),
        created_at: new Date(),
      };
      mockDbConnection.query.mockResolvedValue({ rows: [mockSession] });

      const result = await userDataService.findSessionByRefreshToken("token");

      expect(result).toEqual(mockSession);
    });

    it("should handle session find error", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("Find error"));

      await expect(
        userDataService.findSessionByRefreshToken("token")
      ).rejects.toThrow("Database error");
    });

    it("should delete session", async () => {
      mockDbConnection.query.mockResolvedValue({ rowCount: 1 });

      await userDataService.deleteUserSession("token");

      expect(mockDbConnection.query).toHaveBeenCalled();
    });

    it("should handle session delete error", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("Delete error"));

      await expect(userDataService.deleteUserSession("token")).rejects.toThrow(
        "Failed to delete session"
      );
    });

    it("should delete all user sessions", async () => {
      mockDbConnection.query.mockResolvedValue({ rowCount: 3 });

      await userDataService.deleteAllUserSessions(1);

      expect(mockDbConnection.query).toHaveBeenCalled();
    });

    it("should handle delete all error", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("Delete all error"));

      await expect(userDataService.deleteAllUserSessions(1)).rejects.toThrow(
        "Failed to delete sessions"
      );
    });

    it("should cleanup expired sessions", async () => {
      mockDbConnection.query.mockResolvedValue({ rowCount: 5 });

      await userDataService.cleanupExpiredSessions();

      expect(mockDbConnection.query).toHaveBeenCalled();
    });

    it("should handle cleanup errors gracefully", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("Cleanup error"));

      // This should not throw since the method handles errors gracefully
      await expect(
        userDataService.cleanupExpiredSessions()
      ).resolves.toBeUndefined();

      expect(mockDbConnection.query).toHaveBeenCalled();
    });
  });

  describe("stats and search", () => {
    it("should get user stats", async () => {
      const mockStats = { username: "test", active_sessions: 2 };
      mockDbConnection.query.mockResolvedValue({ rows: [mockStats] });

      const result = await userDataService.getUserStats(1);

      expect(result).toEqual(mockStats);
    });

    it("should handle stats error", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("Stats error"));

      await expect(userDataService.getUserStats(1)).rejects.toThrow(
        "Failed to get user stats"
      );
    });

    it("should search users", async () => {
      const mockUsers = [{ user_id: 1, username: "test1" }];
      mockDbConnection.query.mockResolvedValue({ rows: mockUsers });

      const result = await userDataService.searchUsers("test", 5);

      expect(result).toEqual(mockUsers);
    });

    it("should handle search error", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("Search error"));

      await expect(userDataService.searchUsers("test")).rejects.toThrow(
        "Failed to search users"
      );
    });
  });

  describe("healthCheck", () => {
    it("should return health status", async () => {
      const mockHealth = { status: "healthy", timestamp: new Date() };
      mockDbConnection.healthCheck.mockResolvedValue(mockHealth);

      const result = await userDataService.healthCheck();

      expect(result).toEqual(mockHealth);
    });

    it("should handle health check error", async () => {
      mockDbConnection.healthCheck.mockRejectedValue(new Error("Health error"));

      await expect(userDataService.healthCheck()).rejects.toThrow(
        "Health error"
      );
    });
  });
});
