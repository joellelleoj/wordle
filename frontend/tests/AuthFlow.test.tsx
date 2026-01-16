import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthPage } from "../src/pages/AuthPage";

describe("Authentication Flow Integration Tests", () => {
  const mockOnSuccess = jest.fn();
  const mockOnLogin = jest.fn();
  const mockOnRegister = jest.fn();
  const mockOnModeChange = jest.fn();
  const mockOnOAuthLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnLogin.mockResolvedValue({ success: true });
    mockOnRegister.mockResolvedValue({ success: true });
  });

  test("complete login flow", async () => {
    const user = userEvent.setup();

    render(
      <AuthPage
        mode="login"
        onSuccess={mockOnSuccess}
        onLogin={mockOnLogin}
        onModeChange={mockOnModeChange}
        onOAuthLogin={mockOnOAuthLogin}
      />
    );

    // Fill in login form - use more flexible selectors
    await user.type(screen.getByLabelText(/username/i), "testuser");
    // Fix: Use a more flexible password selector that accounts for both "Password" and "Password *" formats
    const passwordField = screen.getByLabelText(/password/i);
    await user.type(passwordField, "password123");

    // Submit form
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith("testuser", "password123");
    });
  });

  test("complete registration flow", async () => {
    const user = userEvent.setup();

    render(
      <AuthPage
        mode="register"
        onSuccess={mockOnSuccess}
        onLogin={mockOnLogin}
        onRegister={mockOnRegister}
        onModeChange={mockOnModeChange}
        onOAuthLogin={mockOnOAuthLogin}
      />
    );

    // Fill in registration form
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/username/i), "testuser");

    const passwordFields = screen.getAllByLabelText(/password/i);
    const passwordField =
      passwordFields.find(
        (field) =>
          !field
            .getAttribute("aria-label")
            ?.toLowerCase()
            .includes("confirm") &&
          !field.getAttribute("id")?.toLowerCase().includes("confirm")
      ) || passwordFields[0];

    await user.type(passwordField, "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");

    // Submit form
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockOnRegister).toHaveBeenCalledWith(
        "test@example.com",
        "testuser",
        "password123"
      );
    });
  });

  test("mode switching works correctly", async () => {
    const user = userEvent.setup();

    render(
      <AuthPage
        mode="login"
        onSuccess={mockOnSuccess}
        onLogin={mockOnLogin}
        onRegister={mockOnRegister}
        onModeChange={mockOnModeChange}
        onOAuthLogin={mockOnOAuthLogin}
      />
    );

    // Click sign up link
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(mockOnModeChange).toHaveBeenCalledWith("register");
  });

  test("OAuth login initiation", async () => {
    const user = userEvent.setup();

    render(
      <AuthPage
        mode="login"
        onSuccess={mockOnSuccess}
        onLogin={mockOnLogin}
        onModeChange={mockOnModeChange}
        onOAuthLogin={mockOnOAuthLogin}
      />
    );

    // Click OAuth button
    await user.click(
      screen.getByRole("button", { name: /continue with gitlab/i })
    );

    expect(mockOnOAuthLogin).toHaveBeenCalled();
  });
});
