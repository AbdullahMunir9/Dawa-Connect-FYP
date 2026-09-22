const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function googleIdentityFromPayload(payload) {
  const sub = clean(payload?.sub, 255);
  const email = clean(payload?.email, 320).toLowerCase();
  const name = clean(payload?.name, 60);
  const picture = clean(payload?.picture, 2048);
  const hostedDomain = clean(payload?.hd, 255).toLowerCase();
  const emailVerified = payload?.email_verified === true;

  if (!sub || !emailVerified || !EMAIL_PATTERN.test(email)) return null;

  // Google is authoritative for Gmail and verified Google Workspace addresses.
  // Consumer Google accounts backed by third-party email need the later email-OTP flow.
  const authoritativeEmail = email.endsWith("@gmail.com") || Boolean(hostedDomain);
  return {
    sub,
    email,
    name: name || email.split("@")[0].slice(0, 60),
    picture,
    hostedDomain,
    authoritativeEmail,
  };
}
