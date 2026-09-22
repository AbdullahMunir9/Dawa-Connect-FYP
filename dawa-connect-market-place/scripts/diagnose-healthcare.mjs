import nextEnv from '@next/env';
import mongoose from 'mongoose';
import { healthcareOnlyStyle } from '../src/lib/healthcareMapStyle.mjs';
nextEnv.loadEnvConfig(process.cwd());

try {
  const url = new URL('https://maps.geoapify.com/v1/styles/positron/style.json');
  url.searchParams.set('apiKey', process.env.GEOAPIFY_API_KEY || '');
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  console.log('Style provider status:', response.status);
  if (response.ok) {
    const style = await response.json();
    const paths = [];
    function visit(value) {
      if (typeof value === 'string' && value.startsWith('https://maps.geoapify.com/')) paths.push(new URL(value).pathname);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    }
    visit(style);
    console.log('Provider resource paths (no keys):', JSON.stringify([...new Set(paths)]));
    try { console.log('Rewritten style layers:', healthcareOnlyStyle(style).layers.length); }
    catch (error) { console.log('Style rewriting:', error.message); }
  }
} catch (error) { console.log('Style network failure:', error.name, error.cause?.code || ''); }

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.getClient().db(process.env.PHARMACY_DB_NAME || 'Pharmacy');
  const approved = { approvalStatus: { $regex: /^approved$/i }, status: { $not: { $regex: /^suspended$/i } } };
  console.log('Database connected. Approved pharmacies:', await db.collection('users').countDocuments(approved));
} catch (error) {
  console.log('Database diagnosis:', JSON.stringify({ name: error.name, tls: /TLS|SSL/i.test(error.message), dns: /ENOTFOUND|querySrv/i.test(error.message), timeout: /timed out|timeout/i.test(error.message), authentication: /Authentication|bad auth/i.test(error.message), code: error.code }));
  console.log('Database connection details:', JSON.stringify([...error.reason?.servers?.values() || []].map((server) => ({ type: server.type, code: server.error?.code, cause: server.error?.cause?.code, tls: /TLS|SSL/i.test(server.error?.message || ''), message: (server.error?.message || '').replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[redacted connection string]') }))));
} finally { await mongoose.disconnect(); }
