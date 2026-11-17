export function normalizeAdminProfileName(value) {
  const name = String(value || '').trim();
  if (name.length < 2 || name.length > 80) {
    throw Object.assign(new Error('Enter your full name (2-80 characters).'), { status: 400 });
  }
  return name;
}
