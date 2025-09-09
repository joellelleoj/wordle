import passport from "passport";
import { Strategy as GitLabStrategy } from "passport-gitlab2";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { prisma } from "../services/DatabaseService";

export async function configurePassport(): Promise<void> {
  // GitLab OAuth Strategy
  if (process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET) {
    passport.use(
      new GitLabStrategy(
        {
          clientID: process.env.GITLAB_CLIENT_ID,
          clientSecret: process.env.GITLAB_CLIENT_SECRET,
          callbackURL:
            process.env.GITLAB_CALLBACK_URL ||
            "http://localhost:3003/auth/gitlab/callback",
          baseURL: "https://git.imn.htwk-leipzig.de",
          scope: ["read_user"],
        },
        async (
          accessToken: string,
          refreshToken: string,
          profile: any,
          done: any
        ) => {
          try {
            // Transform GitLab profile to our format
            const userData = {
              id: profile.id,
              emails: [{ value: profile.emails?.[0]?.value || profile.email }],
              displayName:
                profile.displayName || profile.name || profile.username,
              photos: [{ value: profile.avatarUrl || profile.avatar_url }],
              provider: "gitlab",
            };

            return done(null, userData);
          } catch (error) {
            return done(error, null);
          }
        }
      )
    );
  }

  // JWT Strategy for API authentication
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET || "wordle-jwt-secret",
        issuer: "wordle-user-service",
        audience: "wordle-app",
      },
      async (payload: any, done: any) => {
        try {
          const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
              id: true,
              email: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              provider: true,
              isActive: true,
            },
          });

          if (user && user.isActive) {
            return done(null, user);
          } else {
            return done(null, false);
          }
        } catch (error) {
          return done(error, false);
        }
      }
    )
  );

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  // Deserialize user from session
  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });

  console.log("✅ Passport strategies configured");
}
