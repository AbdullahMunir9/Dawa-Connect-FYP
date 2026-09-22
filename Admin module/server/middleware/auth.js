import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set in .env and be at least 32 characters long.');
  process.exit(1);
}

export function signAdminToken(admin) {
  return jwt.sign({ id: String(admin._id), role: admin.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function adminView(admin) {
  return {
    id: String(admin._id),
    name: admin.name,
    email: admin.email,
    role: admin.role,
    status: admin.status,
    createdAt: admin.createdAt,
  };
}

// Every admin route requires a valid, still-existing, approved admin account.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ message: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findById(payload.id).select('-password').lean();
    if (!admin) return res.status(401).json({ message: 'This admin account no longer exists.' });
    if (admin.status !== 'approved') return res.status(403).json({ message: 'Your account is pending approval.' });
    req.admin = { ...adminView(admin), _id: admin._id };
    next();
  } catch (error) {
    const expired = error?.name === 'TokenExpiredError';
    return res.status(401).json({ message: expired ? 'Your session has expired. Please sign in again.' : 'Invalid session.' });
  }
}

export function requireSuperadmin(req, res, next) {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Only a super admin can perform this action.' });
  }
  next();
}
