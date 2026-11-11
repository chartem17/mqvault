import { msg } from "../i18n/core";

/** Every text an /api/auth/* route can return as `error`; the UI shows them through `t()`. */
export const AUTH_MESSAGES = [
  msg("Wrong email or password"),
  msg("Too many attempts. Try again later."),
  msg("Enter a valid email"),
  msg("Password must be at least 8 characters"),
  msg("Password is too long"),
  msg("Password is too weak"),
  msg("Could not sign up. Try again later."),
  msg("Invalid or expired code"),
  msg("Current password is incorrect"),
  msg("The new password must differ from the current one"),
  msg("Could not change the password"),
  msg("Could not sign out"),
  msg("Authentication required"),
  msg("Google sign-in did not complete. Try again."),
  msg("Could not send the code"),
] as const;
