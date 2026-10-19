import mongoose from 'mongoose';
import pharmacyDb from '../db/pharmacyConnection.js';
import PharmacyUser from '../models/PharmacyUser.js';

export function pharmacyView(user) {
  return {
    id: String(user._id),
    name: user.ownerName || '',
    role: 'Admin',
    email: user.email || '',
    pharmacyName: user.pharmacyName || '',
    status: user.status || 'unapproved',
    approvalStatus: user.approvalStatus || user.status || 'unapproved',
    accountStatus: String(user.status || '').toLowerCase(),
    rejectionReason: user.rejectionReason || '',
    suspensionReason: user.suspensionReason || '',
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

export async function requirePharmacyAuth(req, res, next) {
  try {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (token.length < 64 || token.length > 256) {
      return res.status(401).json({ message: 'Pharmacy authentication is required.' });
    }
    if (pharmacyDb.readyState !== 1) await pharmacyDb.asPromise();
    const session = await pharmacyDb.collection('sessions').findOne({
      token,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!session || !mongoose.isValidObjectId(session.userId)) {
      return res.status(401).json({ message: 'Your pharmacy session is invalid or expired.' });
    }
    const pharmacy = await PharmacyUser.findById(session.userId).lean();
    if (!pharmacy) return res.status(401).json({ message: 'This pharmacy account no longer exists.' });
    req.pharmacyAuth = {
      token,
      sessionId: session._id,
      ownerId: String(pharmacy._id),
      pharmacy,
    };
    await pharmacyDb.collection('sessions').updateOne(
      { _id: session._id },
      { $set: { updatedAt: new Date() } },
    );
    return next();
  } catch (error) {
    console.error('Pharmacy authentication error:', error?.message || error);
    return res.status(503).json({ message: 'Pharmacy authentication is temporarily unavailable.' });
  }
}

