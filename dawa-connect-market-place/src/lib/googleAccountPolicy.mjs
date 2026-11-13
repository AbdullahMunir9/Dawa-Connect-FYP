export function decideGoogleAccountAction({
  hasGoogleMatch = false,
  hasEmailMatch = false,
  linkedGoogleSub = "",
  identitySub = "",
  authoritativeEmail = false,
} = {}) {
  if (hasGoogleMatch) return { action: "sign_in" };

  if (hasEmailMatch) {
    if (linkedGoogleSub && linkedGoogleSub !== identitySub) {
      return {
        action: "reject",
        status: 409,
        message: "This email is already connected to another Google account.",
      };
    }
    if (!authoritativeEmail) {
      return {
        action: "reject",
        status: 409,
        message: "Sign in with your password for this email. Google linking is not available for this address.",
      };
    }
    return { action: "link_and_sign_in" };
  }

  if (!authoritativeEmail) {
    return {
      action: "reject",
      status: 400,
      message: "Use a Gmail or Google Workspace address, or register with email and verify it using the OTP sent to your inbox.",
    };
  }

  // Google Identity Services uses one account-selection flow for both entry
  // points. A verified new Google identity creates the Marketplace account;
  // an existing identity signs in. The page used to start the flow must not
  // change this decision.
  return { action: "create_and_sign_in" };
}
