import Joi from "joi";

// Registration validation schema
export const registrationSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required().messages({
    "string.alphanum": "Username must contain only alphanumeric characters",
    "string.min": "Username must be at least 3 characters long",
    "string.max": "Username cannot exceed 30 characters",
    "any.required": "Username is required",
  }),

  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),

  // password requirements
  password: Joi.string().min(6).max(128).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "string.max": "Password cannot exceed 128 characters",
    "any.required": "Password is required",
  }),
});

// Login validation schema
export const loginSchema = Joi.object({
  username: Joi.string().min(3).max(30).required().messages({
    "string.min": "Username must be at least 3 characters long",
    "string.max": "Username cannot exceed 30 characters",
    "any.required": "Username is required",
  }),

  password: Joi.string().min(1).required().messages({
    "string.min": "Password is required",
    "any.required": "Password is required",
  }),
});

// Token refresh validation schema
export const tokenRefreshSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "any.required": "Refresh token is required",
  }),
});

// OAuth callback validation schema
export const oauthCallbackSchema = Joi.object({
  code: Joi.string().required().messages({
    "any.required": "Authorization code is required",
  }),

  redirect_uri: Joi.string().uri().optional().messages({
    "string.uri": "Redirect URI must be a valid URL",
  }),

  state: Joi.string().optional(),
});

// Validation helper functions
export const validateRegistration = (data: any) => {
  return registrationSchema.validate(data, { abortEarly: false });
};

export const validateLogin = (data: any) => {
  return loginSchema.validate(data, { abortEarly: false });
};

export const validateTokenRefresh = (data: any) => {
  return tokenRefreshSchema.validate(data, { abortEarly: false });
};

export const validateOAuthCallback = (data: any) => {
  return oauthCallbackSchema.validate(data, { abortEarly: false });
};

// User update validation schema
export const userUpdateSchema = Joi.object({
  display_name: Joi.string().min(1).max(100).optional().messages({
    "string.min": "Display name cannot be empty",
    "string.max": "Display name cannot exceed 100 characters",
  }),

  avatar_url: Joi.string().uri().optional().messages({
    "string.uri": "Avatar URL must be a valid URL",
  }),
});

export const validateUserUpdate = (data: any) => {
  return userUpdateSchema.validate(data, { abortEarly: false });
};
