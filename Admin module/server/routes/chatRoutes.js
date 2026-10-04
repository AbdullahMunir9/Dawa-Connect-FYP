import express from 'express';
import mongoose from 'mongoose';
import pharmacyDb from '../db/pharmacyConnection.js';
import PharmacyUser from '../models/PharmacyUser.js';
import { requireChatAuth, signPharmacyChatToken } from '../middleware/chatAuth.js';
import {
  ChatError,
  listConversations,
  listMessages,
  markConversationRead,
  openOrderConversation,
} from '../services/chatService.js';

function errorResponse(res, error) {
  const status = error instanceof ChatError ? error.status : Number(error?.status) || 500;
  return res.status(status).json({
    message: status >= 500 ? 'The chat service is temporarily unavailable.' : error.message,
    code: error.code || 'CHAT_REQUEST_FAILED',
  });
}

export default function createChatRouter() {
  const router = express.Router();

  router.post('/auth/pharmacy', async (req, res) => {
    try {
      const sessionToken = String(req.body?.sessionToken || '').trim();
      if (sessionToken.length < 32 || sessionToken.length > 256) {
        return res.status(401).json({ message: 'A valid pharmacy session is required.' });
      }
      if (pharmacyDb.readyState !== 1) await pharmacyDb.asPromise();
      const session = await pharmacyDb.collection('sessions').findOne({
        token: sessionToken,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      });
      if (!session || !mongoose.isValidObjectId(session.userId)) {
        return res.status(401).json({ message: 'The pharmacy session is invalid or expired.' });
      }
      const pharmacy = await PharmacyUser.findById(session.userId).select('status approvalStatus');
      const status = String(pharmacy?.status || '').toLowerCase();
      const approval = String(pharmacy?.approvalStatus || pharmacy?.status || '').toLowerCase();
      if (!pharmacy || approval !== 'approved' || ['suspended', 'rejected'].includes(status)) {
        return res.status(403).json({ message: 'This pharmacy account cannot use customer chat.' });
      }
      return res.json({ token: signPharmacyChatToken(session.userId), expiresInSeconds: 900 });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.use(requireChatAuth);

  router.get('/conversations', async (req, res) => {
    try {
      return res.json({ conversations: await listConversations(req.chatIdentity) });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/conversations', async (req, res) => {
    try {
      const conversation = await openOrderConversation(req.chatIdentity, req.body?.orderId);
      return res.status(201).json({ conversation });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/conversations/:id/messages', async (req, res) => {
    try {
      return res.json(await listMessages(req.chatIdentity, req.params.id, {
        before: req.query.before,
        limit: req.query.limit,
      }));
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/conversations/:id/read', async (req, res) => {
    try {
      return res.json({ conversation: await markConversationRead(req.chatIdentity, req.params.id) });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}
