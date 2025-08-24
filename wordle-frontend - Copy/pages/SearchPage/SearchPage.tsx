import React, { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { userService } from "../../services/api/userService";
import { useAuth } from "../../contexts/AuthContext";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner/LoadingSpinner";
import { Button } from "../../components/ui/Button/Button";
import { User } from "../../types/user";
import styles from "./SearchPage.module.css";

export const SearchPage: React.FC = () => {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchUsers = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || !token) return;

      setIsLoading(true);
      setError(null);
      setHasSearched(true);

      try {
        const result = await userService.searchUsers(
          searchQuery.trim(),
          1,
          token
        );
        setUsers(result.data);
      } catch (err: any) {
        setError(err.message || "Failed to search users");
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsers(query);
  };

  // Debounced search
  useEffect(() => {
    if (query.length >= 2) {
      const timeoutId = setTimeout(() => {
        searchUsers(query);
      }, 500);

      return () => clearTimeout(timeoutId);
    } else {
      setUsers([]);
      setHasSearched(false);
    }
  }, [query, searchUsers]);

  return (
    <div className={styles.searchPage}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Search Players</h1>
          <p className={styles.subtitle}>
            Find other Wordle players and view their profiles
          </p>
        </header>

        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.searchInput}>
            <input
              type="text"
              placeholder="Search by username or display name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={styles.input}
              autoFocus
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!query.trim() || isLoading}
              className={styles.searchButton}
            >
              {isLoading ? <LoadingSpinner size="small" /> : "Search"}
            </Button>
          </div>
        </form>

        <div className={styles.results}>
          {error && (
            <div className={styles.error}>
              <p>{error}</p>
            </div>
          )}

          {isLoading && (
            <div className={styles.loading}>
              <LoadingSpinner size="medium" />
              <p>Searching users...</p>
            </div>
          )}

          {!isLoading && hasSearched && users.length === 0 && !error && (
            <div className={styles.noResults}>
              <p>No users found matching "{query}"</p>
            </div>
          )}

          {users.length > 0 && (
            <div className={styles.userList}>
              {users.map((user) => (
                <Link
                  key={user.id}
                  to={`/profile/${user.id}`}
                  className={styles.userCard}
                >
                  <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.username} />
                      ) : (
                        <span>{user.username.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className={styles.userDetails}>
                      <h3 className={styles.userDisplayName}>
                        {user.displayName || user.username}
                      </h3>
                      <p className={styles.username}>@{user.username}</p>
                    </div>
                  </div>
                  <div className={styles.userMeta}>
                    <span className={styles.joinDate}>
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
