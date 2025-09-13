import React from "react";
import { User } from "../../types";
import "./UserInfo.css";

interface UserInfoProps {
  user: User;
}

export const UserInfo: React.FC<UserInfoProps> = ({ user }) => {
  return (
    <div className="user-info">
      <div className="user-avatar">
        <div className="avatar-placeholder">
          {user.username.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="user-details">
        <h2 className="username">{user.username}</h2>
        <p className="email">{user.email}</p>
      </div>
    </div>
  );
};
