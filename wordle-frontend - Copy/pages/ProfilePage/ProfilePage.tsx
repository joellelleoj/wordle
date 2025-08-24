import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProfileHeader } from "../../components/profile/ProfileHeader/ProfileHeader";
import { ProfileStats } from "../../components/profile/ProfileStats/ProfileStats";
import { GameHistory } from "../../components/profile/GameHistory/GameHistory";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner/LoadingSpinner";
import { useAuth } from "../../contexts/AuthContext";
import { userService } from "../../services/api/userService";
import { UserProfile } from "../../types/user";
import styles from "./ProfilePage.module.css";

/**
 * Profile Page Component
 *
 * User profile page displaying:
 * - User information and avatar
 * - Game statistics and charts
 * - Game history and posts
 * - Social features (follow/unfollow)
 */
export const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const { user: currentUser, token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = !userId || userId === currentUser?.id;
  const targetUserId = userId || currentUser?.id;

  useEffect(() => {
    if (targetUserId) {
      loadUserProfile();
    }
  }, [targetUserId]);

  const loadUserProfile = async () => {
    if (!targetUserId) return;

    setIsLoading(true);
    setError(null);

    try {
      const userProfile = await userService.getUserProfile(
        targetUserId,
        token || undefined
      );
      setProfile(userProfile);
    } catch (err: any) {
      setError(err.message || "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!profile || !token || !targetUserId) return;

    try {
      await userService.followUser(targetUserId, token);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              followers: [...prev.followers, currentUser!.id],
            }
          : null
      );
    } catch (err) {
      console.error("Failed to follow user:", err);
    }
  };

  const handleUnfollow = async () => {
    if (!profile || !token || !targetUserId) return;

    try {
      await userService.unfollowUser(targetUserId, token);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              followers: prev.followers.filter((id) => id !== currentUser!.id),
            }
          : null
      );
    } catch (err) {
      console.error("Failed to unfollow user:", err);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.error}>
          <h2>Profile Not Found</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.error}>
          <h2>Profile Not Found</h2>
          <p>The requested user profile could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.profilePage}>
      <div className={styles.container}>
        <ProfileHeader
          profile={profile}
          isOwnProfile={isOwnProfile}
          isFollowing={profile.followers.includes(currentUser?.id || "")}
          onFollow={handleFollow}
          onUnfollow={handleUnfollow}
        />

        <div className={styles.content}>
          <div className={styles.statsSection}>
            <ProfileStats stats={profile.stats} />
          </div>

          <div className={styles.historySection}>
            <GameHistory
              gameHistory={profile.gameHistory}
              posts={profile.posts}
              isOwnProfile={isOwnProfile}
              onRefresh={loadUserProfile}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
