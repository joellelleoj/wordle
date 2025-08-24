export const GAME_CONFIG = {
  MAX_ATTEMPTS: 6,
  WORD_LENGTH: 5,
  KEYBOARD_LAYOUTS: {
    QWERTY: [
      ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
      ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
    ],
  },
  ANIMATIONS: {
    TILE_FLIP_DURATION: 600,
    TILE_REVEAL_DELAY: 100,
    SHAKE_DURATION: 600,
    BOUNCE_DURATION: 400,
  },
  VIBRATION: {
    SUCCESS: [100],
    ERROR: [100, 50, 100],
    SUBMIT: [50],
  },
} as const;

export const API_ENDPOINTS = {
  // All requests go through API Gateway (port 8082 -> /dev11/api)
  GAME: {
    BASE: "/api/game",
    NEW_GAME: "/api/game/new",
    GUESS: "/api/game/guess",
    CURRENT: "/api/game/current",
    VALIDATE: "/api/game/validate",
    DICTIONARY: "/api/game/dictionary",
  },
  USER: {
    BASE: "/api/users",
    PROFILE: "/api/users/profile",
    STATS: "/api/users/stats",
    SEARCH: "/api/users/search",
    HISTORY: "/api/users/history",
    POSTS: "/api/users/posts",
  },
  AUTH: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    LOGOUT: "/api/auth/logout",
    REFRESH: "/api/auth/refresh",
    OAUTH2: "/api/auth/oauth2",
  },
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: "wordle_auth_token",
  REFRESH_TOKEN: "wordle_refresh_token",
  USER_PREFERENCES: "wordle_preferences",
  GAME_STATE: "wordle_game_state",
  STATS: "wordle_stats",
} as const;

export const VALIDATION_RULES = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 20,
    PATTERN: /^[a-zA-Z0-9_]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  WORD: {
    LENGTH: 5,
    PATTERN: /^[A-Z]+$/,
  },
} as const;

export const UI_CONFIG = {
  TOAST_DURATION: 3000,
  MODAL_ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 300,
  PAGINATION_LIMIT: 20,
  BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1200,
  },
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error. Please check your connection.",
  UNAUTHORIZED: "You need to log in to access this feature.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  VALIDATION_ERROR: "Please check your input and try again.",
  GAME_ERROR: "An error occurred during the game. Please try again.",
  WORD_NOT_FOUND: "Word not found in dictionary.",
  INVALID_WORD_LENGTH: "Word must be exactly 5 letters long.",
  GAME_ALREADY_FINISHED: "This game has already been completed.",
  NO_ACTIVE_GAME: "No active game found. Please start a new game.",
  SERVER_ERROR: "Server error. Please try again later.",
} as const;
