/*import Joi from "joi";

export const validateRegistration = (data: any) => {
  const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required().messages({
      "string.alphanum": "Username must only contain letters and numbers",
      "string.min": "Username must be at least 3 characters long",
      "string.max": "Username cannot be longer than 30 characters",
    }),
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
    }),
    password: Joi.string().min(6).required().messages({
      "string.min": "Password must be at least 6 characters long",
    }),
  });

  return schema.validate(data);
};

export const validateLogin = (data: any) => {
  const schema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
  });

  return schema.validate(data);
};

export const validateTokenRefresh = (data: any) => {
  const schema = Joi.object({
    refreshToken: Joi.string().required(),
  });

  return schema.validate(data);
};
*/
// user-service/src/utils/validation.ts
import Joi from "joi";

export const validateRegistration = (data: any) => {
  const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  return schema.validate(data);
};

export const validateLogin = (data: any) => {
  const schema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
  });

  return schema.validate(data);
};

export const validateTokenRefresh = (data: any) => {
  const schema = Joi.object({
    refreshToken: Joi.string().required(),
  });

  return schema.validate(data);
};
