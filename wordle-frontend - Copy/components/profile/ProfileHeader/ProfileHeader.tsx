import React from "react";
import { Button } from "../../ui/Button/Button";
import { UserProfile } from "../../../types/user";
import styles from "./ProfileHeader.module.css";

interface ProfileHeaderProps {
  profile: UserProfile;
  isOwnProfile: boolean;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  isOwnProfile,
  isFollowing,
  onFollow,
  onUnfollow,
}) => {
  return (
    <div className={styles.profileHeader}>
      <div className={styles.userInfo}>
        <div className={styles.avatar}>
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.username} />
          ) : (
            <span>{profile.username.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className={styles.details}>
          <h1 className={styles.displayName}>
            {profile.displayName || profile.username}
          </h1>
          <p className={styles.username}>@{profile.username}</p>

          <div className={styles.meta}>
            <span className={styles.joinDate}>
              Joined {new Date(profile.createdAt).toLocaleDateString()}
            </span>
            {profile.isVerified && (
              <span className={styles.verified}>✓ Verified</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{profile.following.length}</span>
          <span className={styles.statLabel}>Following</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{profile.followers.length}</span>
          <span className={styles.statLabel}>Followers</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{profile.posts.length}</span>
          <span className={styles.statLabel}>Posts</span>
        </div>
      </div>

      {!isOwnProfile && (
        <div className={styles.actions}>
          {isFollowing ? (
            <Button variant="outline" onClick={onUnfollow}>
              Unfollow
            </Button>
          ) : (
            <Button variant="primary" onClick={onFollow}>
              Follow
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
