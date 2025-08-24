import React from "react";
import { GameStats } from "../GameStats/GameStats";

interface ProfileStatsProps {
  userId?: string;
  showDetailed?: boolean;
}

export const ProfileStats: React.FC<ProfileStatsProps> = ({
  userId,
  showDetailed,
}) => {
  return <GameStats userId={userId} showDetailed={showDetailed} />;
};
