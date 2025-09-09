import { PrismaClient } from "@prisma/client";

export class DatabaseService {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new PrismaClient({
        log:
          process.env.NODE_ENV === "development"
            ? ["query", "error"]
            : ["error"],
      });
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      const prisma = DatabaseService.getInstance();
      await prisma.$connect();
      console.log("✅ Database connected successfully");

      // Run migrations in production
      if (process.env.NODE_ENV === "production") {
        await prisma.$executeRaw`SELECT 1`; // Simple connection test
      }
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (DatabaseService.instance) {
      await DatabaseService.instance.$disconnect();
    }
  }
}

// Export singleton instance
export const prisma = DatabaseService.getInstance();
