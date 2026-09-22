import express from 'express';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import { requireAuth, requireSuperadmin, signAdminToken, adminView } from '../middleware/auth.js';
import { recordAudit } from '../models/AuditLog.js';

const router = express.Router();
const strongPasswordRegex = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

// Signup: the very first admin becomes an approved superadmin; later admins wait for approval.
router.post('/signup', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Enter your full name (2–80 characters).' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (!strongPasswordRegex.test(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters and include at least 1 uppercase letter and 1 special character.' });
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) return res.status(400).json({ message: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const adminCount = await Admin.countDocuments();
    const isFirst = adminCount === 0;

    await new Admin({ name, email, password: hashedPassword, role: isFirst ? 'superadmin' : 'admin', status: isFirst ? 'approved' : 'pending' }).save();
    res.status(201).json({
      message: isFirst
        ? 'Super admin account created. You can sign in now.'
        : 'Admin registered successfully. Waiting for Super Admin approval.',
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.email) return res.status(400).json({ message: 'Email already in use' });
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const admin = await Admin.findOne({ email });
    // Same message for unknown email and wrong password.
    if (!admin) return res.status(400).json({ message: 'Invalid email or password' });
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });
    if (admin.status === 'pending') return res.status(403).json({ message: 'Your account is pending approval from the Super Admin.' });

    res.json({ token: signAdminToken(admin), admin: adminView(admin) });
  } catch (error) {
    res.status(500).json({ message: 'Sign in failed. Please try again.' });
  }
});

// Validates a stored token on app load.
router.get('/me', requireAuth, (req, res) => {
  const admin = { ...req.admin };
  delete admin._id;
  res.json({ admin });
});

router.get('/all-admins', requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 }).lean();
    res.json(admins.map((admin) => ({ ...admin, id: String(admin._id) })));
  } catch (error) {
    res.status(500).json({ message: 'Could not load admins.' });
  }
});

router.put('/approve/:id', requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const admin = await Admin.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true }).select('-password');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    await recordAudit(req, { action: 'admin.approve', targetType: 'admin', targetId: admin._id, targetLabel: admin.email, summary: `Approved admin ${admin.name}` });
    res.json(admin);
  } catch (error) {
    res.status(500).json({ message: 'Could not approve admin.' });
  }
});

router.delete('/delete/:id', requireAuth, requireSuperadmin, async (req, res) => {
  try {
    if (String(req.params.id) === req.admin.id) return res.status(400).json({ message: 'You cannot delete your own account.' });
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (admin.role === 'superadmin') return res.status(400).json({ message: 'Super admin accounts cannot be deleted.' });
    await admin.deleteOne();
    await recordAudit(req, { action: 'admin.delete', targetType: 'admin', targetId: admin._id, targetLabel: admin.email, summary: `Removed admin ${admin.name}` });
    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete admin.' });
  }
});

export default router;
