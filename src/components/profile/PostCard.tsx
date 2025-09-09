import React from "react";
import { authService } from "../../services/auth";

interface Post {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
}

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const currentUser = authService.getCurrentUser();

  // Fix: Convert both to strings for comparison
  const isOwner = currentUser?.id.toString() === post.userId.toString();

  const handleEdit = () => {
    console.log("Edit post:", post.id);
    // Implement edit functionality
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      console.log("Delete post:", post.id);
      // Implement delete functionality
    }
  };

  return (
    <div className="post-card">
      <div className="post-header">
        <h4 className="post-title">{post.title}</h4>
        <small className="post-date">
          {new Date(post.createdAt).toLocaleDateString()}
        </small>
      </div>

      <div className="post-content">
        <p>{post.content}</p>
      </div>

      {isOwner && (
        <div className="post-actions">
          <button onClick={handleEdit} className="edit-btn">
            Edit
          </button>
          <button onClick={handleDelete} className="delete-btn">
            Delete
          </button>
        </div>
      )}
    </div>
  );
};
