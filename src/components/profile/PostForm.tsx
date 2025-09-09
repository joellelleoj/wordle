import React, { useState } from "react";
import { profileService, CreatePostData } from "../../services/profile";

export const PostForm: React.FC = () => {
  const [formData, setFormData] = useState<CreatePostData>({
    title: "",
    content: "",
    gameId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      setError("Title and content are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await profileService.createPost(formData);

      // Reset form after successful creation
      setFormData({ title: "", content: "", gameId: "" });

      // You might want to trigger a refresh of posts list here
      console.log("Post created successfully");
    } catch (error) {
      console.error("Failed to create post:", error);
      setError("Failed to create post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  return (
    <div className="post-form">
      <h3>Create New Post</h3>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title:</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter post title"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="content">Content:</label>
          <textarea
            id="content"
            name="content"
            value={formData.content}
            onChange={handleChange}
            placeholder="Write your post content here..."
            rows={4}
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="gameId">Game ID (optional):</label>
          <input
            type="text"
            id="gameId"
            name="gameId"
            value={formData.gameId}
            onChange={handleChange}
            placeholder="Associated game ID"
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Post"}
        </button>
      </form>
    </div>
  );
};
