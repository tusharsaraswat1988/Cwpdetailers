/** Shared admin credential reader for seed / verify scripts. */
export function readAdminCredentials(): { phone: string; password: string; name: string; email: string } {
  const phone = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!phone || !password) {
    throw new Error(
      "ADMIN_PHONE and ADMIN_PASSWORD must be set in .env (copy from .env.example and fill values)",
    );
  }
  return {
    phone,
    password,
    name: process.env.ADMIN_NAME?.trim() || "Super Admin",
    email: process.env.ADMIN_EMAIL?.trim() || "admin@cwpdetailers.com",
  };
}
