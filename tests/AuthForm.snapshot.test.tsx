import renderer from "react-test-renderer";
import { AuthForm } from "../src/components/auth/AuthForm";

describe("AuthForm Component Snapshots", () => {
  const mockOnLogin = jest.fn();
  const mockOnRegister = jest.fn();

  test("login form matches snapshot", () => {
    const tree = renderer
      .create(<AuthForm mode="login" onLogin={mockOnLogin} loading={false} />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  test("register form matches snapshot", () => {
    const tree = renderer
      .create(
        <AuthForm
          mode="register"
          onLogin={mockOnLogin}
          onRegister={mockOnRegister}
          loading={false}
        />
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  test("loading state matches snapshot", () => {
    const tree = renderer
      .create(<AuthForm mode="login" onLogin={mockOnLogin} loading={true} />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
