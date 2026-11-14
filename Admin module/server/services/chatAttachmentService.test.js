import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  CHAT_IMAGE_MAX_BYTES,
  chatUploadIdentity,
  normalizeChatAttachmentPayload,
} from './chatAttachmentService.js';

const conversationId = '507f1f77bcf86cd799439011';
const cloudName = 'dawaconnect-test';
const apiSecret = 'test-secret';

function responseSignature(publicId, version) {
  return createHash('sha1')
    .update(`public_id=${publicId}&version=${version}${apiSecret}`)
    .digest('hex');
}

function validAttachment(suffix = 'one') {
  const publicId = `dawaconnect/live-chat/${conversationId}/${suffix}`;
  const version = 1700000000;
  return {
    publicId,
    version,
    uploadSignature: responseSignature(publicId, version),
    format: 'jpg',
    bytes: 120_000,
    width: 1200,
    height: 800,
  };
}

test('normalizes a verified Cloudinary chat image into server-owned URLs', () => {
  const [image] = normalizeChatAttachmentPayload([validAttachment()], {
    conversationId, cloudName, apiSecret,
  });
  assert.equal(image.type, 'image');
  assert.match(image.url, /^https:\/\/res\.cloudinary\.com\/dawaconnect-test\/image\/upload\/v1700000000\//);
  assert.match(image.thumbnailUrl, /c_fill,w_480,h_360,q_auto,f_auto/);
});

test('rejects more than two images', () => {
  assert.throws(() => normalizeChatAttachmentPayload([
    validAttachment('one'), validAttachment('two'), validAttachment('three'),
  ], { conversationId, cloudName, apiSecret }), /at most 2 images/);
});

test('rejects an image belonging to another conversation', () => {
  const attachment = validAttachment();
  attachment.publicId = 'dawaconnect/live-chat/other-conversation/image';
  assert.throws(() => normalizeChatAttachmentPayload([attachment], {
    conversationId, cloudName, apiSecret,
  }), /does not belong/);
});

test('rejects an invalid Cloudinary response signature', () => {
  const attachment = { ...validAttachment(), uploadSignature: '0'.repeat(40) };
  assert.throws(() => normalizeChatAttachmentPayload([attachment], {
    conversationId, cloudName, apiSecret,
  }), /could not be verified/);
});

test('rejects an image larger than five megabytes', () => {
  const attachment = { ...validAttachment(), bytes: CHAT_IMAGE_MAX_BYTES + 1 };
  assert.throws(() => normalizeChatAttachmentPayload([attachment], {
    conversationId, cloudName, apiSecret,
  }), /5 MB or smaller/);
});

test('uses the signed order scope as the stable guest upload identity', () => {
  assert.equal(
    chatUploadIdentity({ role: 'guest', sub: 'guest:legacy-object-id', orderId: 'DC-GUEST-1' }),
    'guest-order:DC-GUEST-1',
  );
  assert.equal(
    chatUploadIdentity({ role: 'customer', sub: 'customer-1', orderId: 'DC-CUSTOMER-1' }),
    'customer-order:DC-CUSTOMER-1',
  );
  assert.equal(chatUploadIdentity({ role: 'pharmacy', sub: 'pharmacy-1' }), 'pharmacy:pharmacy-1');
});
