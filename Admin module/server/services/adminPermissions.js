export function adminPermissions(admin = {}) {
  return {
    // Super admins always retain catalogue management access. The stored flag is
    // intentionally ignored for them so they cannot be locked out accidentally.
    manageMedicineCatalog: admin.role === 'superadmin'
      || admin.permissions?.manageMedicineCatalog === true,
  };
}

export function canManageMedicineCatalog(admin = {}) {
  return adminPermissions(admin).manageMedicineCatalog;
}
