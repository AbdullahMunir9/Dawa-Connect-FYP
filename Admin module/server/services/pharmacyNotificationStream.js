import pharmacyDb from '../db/pharmacyConnection.js';

function notificationView(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    type: String(doc.type || 'system'),
    orderId: String(doc.orderId || ''),
    message: String(doc.message || 'You have a new notification.'),
    color: String(doc.color || '#14b8a6'),
    read: Boolean(doc.read),
    createdAt: doc.createdAt || new Date(),
  };
}

export async function recentUnreadOrderNotifications(pharmacyId, limit = 20) {
  if (pharmacyDb.readyState !== 1) await pharmacyDb.asPromise();
  const rows = await pharmacyDb.collection('notifications')
    .find({ ownerId: String(pharmacyId), type: 'order', read: false })
    .sort({ createdAt: -1 })
    .limit(Math.min(50, Math.max(1, Number(limit) || 20)))
    .toArray();
  return rows.reverse().map(notificationView);
}

export function startPharmacyNotificationStream(io) {
  let stream = null;
  let retryTimer = null;
  let stopped = false;
  let retryDelay = 1_000;

  const scheduleRestart = () => {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void openStream();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30_000);
  };

  const openStream = async () => {
    if (stopped) return;
    try {
      if (pharmacyDb.readyState !== 1) await pharmacyDb.asPromise();
      stream = pharmacyDb.collection('notifications').watch([
        { $match: { operationType: 'insert', 'fullDocument.type': 'order' } },
      ]);
      retryDelay = 1_000;
      stream.on('change', (change) => {
        const ownerId = String(change.fullDocument?.ownerId || '');
        const notification = notificationView(change.fullDocument);
        if (ownerId && notification) io.to(`pharmacy:${ownerId}`).emit('notification:new', notification);
      });
      stream.on('error', (error) => {
        console.error('Pharmacy notification stream error:', error.message);
        stream = null;
        scheduleRestart();
      });
      stream.on('close', () => {
        stream = null;
        scheduleRestart();
      });
      console.log('Watching Pharmacy notifications for realtime order events');
      for (const socket of io.sockets.sockets.values()) {
        const identity = socket.data?.identity;
        if (identity?.role !== 'pharmacy') continue;
        recentUnreadOrderNotifications(identity.sub)
          .then((notifications) => socket.emit('notification:sync', notifications))
          .catch((error) => console.error('Could not recover pharmacy notifications:', error.message));
      }
    } catch (error) {
      console.error('Could not start pharmacy notification stream:', error.message);
      scheduleRestart();
    }
  };

  void openStream();

  return async () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    const activeStream = stream;
    stream = null;
    await activeStream?.close().catch(() => {});
  };
}
