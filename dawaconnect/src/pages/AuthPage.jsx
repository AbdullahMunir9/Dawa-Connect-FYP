import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import LocationPickerMap from '../components/LocationPickerMap';

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function formatCnicInput(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 13);
  let formatted = digits.slice(0, 5);
  if (digits.length > 5) formatted += '-' + digits.slice(5, 12);
  if (digits.length > 12) formatted += '-' + digits.slice(12, 13);
  return formatted;
}

function validateRegistrationPassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must include at least one uppercase letter.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must include at least one special character.';
  return null;
}

export default function AuthPage({ onRegister }) {
  const { login, authLoading, requestPasswordReset, resetPasswordWithOtp } = useApp();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotInfo, setForgotInfo] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Please fill all fields.'); return; }
    setLoading(true);
    const result = await login(form.email, form.password);
    if (!result.ok) setError(result.error || 'Invalid credentials.');
    setLoading(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotInfo('');
    if (!forgotEmail) {
      setForgotError('Please enter your email.');
      return;
    }
    const result = await requestPasswordReset(forgotEmail);
    if (!result.ok) {
      setForgotError(result.error || 'Unable to send OTP.');
      return;
    }
    setForgotInfo('OTP has been sent to your email.');
    setOtpSent(true);
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotInfo('');
    if (!otp || !newPassword || !confirmPassword) {
      setForgotError('Please complete all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    const result = await resetPasswordWithOtp({ email: forgotEmail, otp, newPassword });
    if (!result.ok) {
      setForgotError(result.error || 'Could not reset password.');
      return;
    }
    setForgotInfo('Password reset successful. Please sign in.');
    setShowForgot(false);
    setOtpSent(false);
    setForgotEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (showForgot) return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className="auth-logo-big">
            <div className="icon">💊</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'Sora,sans-serif' }}>DawaConnect</div>
              <div style={{ fontSize: 13, opacity: .7 }}>Pharmacy Management System</div>
            </div>
          </div>
          <p className="auth-tagline" style={{ maxWidth: 340 }}>Secure OTP-based password recovery to keep your account safe.</p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-box">
          <h2>{otpSent ? 'Enter OTP' : 'Forgot Password'}</h2>
          <p>{otpSent ? `OTP sent to ${forgotEmail}` : 'Enter your email to receive a verification code.'}</p>
          {forgotError && <div className="alert alert-danger">⚠️ {forgotError}</div>}
          {forgotInfo && <div className="alert alert-success">✅ {forgotInfo}</div>}
          {!otpSent ? (
            <form onSubmit={handleForgot}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-control" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="your@email.com" />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Send OTP</button>
            </form>
          ) : (
            <form onSubmit={handleOtpVerify}>
              <div className="form-group">
                <label className="form-label">Enter OTP Code</label>
                <input className="form-control" type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="6-digit OTP" maxLength={6} style={{ fontSize: 20, letterSpacing: 8, textAlign: 'center' }} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-control" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-control" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Verify OTP</button>
            </form>
          )}
          <button onClick={() => { setShowForgot(false); setOtpSent(false); setForgotError(''); setForgotInfo(''); }} style={{ background: 'none', border: 'none', color: '#0d9488', marginTop: 16, fontSize: 13, cursor: 'pointer' }}>← Back to Login</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="auth-logo-big">
            <div className="icon">💊</div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Sora,sans-serif' }}>DawaConnect</div>
              <div style={{ fontSize: 13, opacity: .7 }}>Pharmacy Management System</div>
            </div>
          </div>
          <p className="auth-tagline" style={{ maxWidth: 380 }}>
            Pakistan's most comprehensive pharmacy management platform. Manage inventory, orders, analytics and more from one dashboard.
          </p>
          <div className="auth-features">
            {[
              ['📦','Real-time Inventory Management'],
              ['🛒','Multi-vendor Order Processing'],
              ['📊','AI-powered Sales Analytics'],
              ['🔔','Smart Alerts & Notifications'],
              ['🚚','Integrated Delivery Tracking'],
            ].map(([icon, label]) => (
              <div className="auth-feature" key={label}>
                <div className="auth-feature-icon">{icon}</div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-box">
          <h2>Welcome back 👋</h2>
          <p>Sign in to your pharmacy dashboard</p>

          {error && <div className="alert alert-danger">⚠️ {error}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-control" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="pharmacist@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-control" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
              <div style={{ textAlign: 'right', marginTop: 6 }}>
                <button type="button" onClick={() => setShowForgot(true)} style={{ background: 'none', border: 'none', color: '#0d9488', fontSize: 12, cursor: 'pointer' }}>Forgot password?</button>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15, marginTop: 8 }} disabled={loading || authLoading}>
              {loading || authLoading ? 'Signing in...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#64748b' }}>
            New pharmacy? <button onClick={onRegister} style={{ background: 'none', border: 'none', color: '#0d9488', fontWeight: 600, cursor: 'pointer' }}>Register here</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage({ onBack }) {
  const { register, checkRegistrationAvailability, authLoading } = useApp();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    pharmacyName: '', ownerName: '', email: '', phone: '', password: '', confirmPassword: '',
    addressLine1: '', area: '', city: '', province: '', latitude: null, longitude: null, locationConfirmation: '',
    openingTime: '08:00', closingTime: '22:00', deliveryCharge: 50, serviceRadiusKm: 10,
    licenseNumber: '', cnic: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (step === 1) {
      const emailTrim = form.email.trim();
      if (!form.pharmacyName.trim() || !form.ownerName.trim()) {
        setError('Please fill in pharmacy and owner name.');
        return;
      }
      if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
        setError('Please enter a valid email address.');
        return;
      }
      const phoneDigits = normalizePhoneDigits(form.phone);
      if (phoneDigits.length !== 11) {
        setError('Phone number must be exactly 11 digits (numbers only).');
        return;
      }
      const pwErr = validateRegistrationPassword(form.password);
      if (pwErr) {
        setError(pwErr);
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('Password and confirm password do not match.');
        return;
      }
      setLoading(true);
      const availability = await checkRegistrationAvailability({ email: emailTrim, phone: phoneDigits });
      setLoading(false);
      if (!availability.ok) {
        setError(availability.error || 'Could not verify email or phone.');
        return;
      }
      if (availability.emailTaken) {
        setError('This email is already registered.');
        return;
      }
      if (availability.phoneTaken) {
        setError('This phone number is already registered.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!form.locationConfirmation) {
        setError('Search for the pharmacy, adjust the pin, and press Confirm exact location before continuing.');
        return;
      }
      const latitude = Number(form.latitude);
      const longitude = Number(form.longitude);
      if (
        form.latitude === null ||
        form.latitude === '' ||
        form.latitude === undefined ||
        form.longitude === null ||
        form.longitude === '' ||
        form.longitude === undefined ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        setError('Please select the pharmacy\'s exact location on the map.');
        return;
      }
      setStep(3);
      return;
    }

    const cnicDigits = form.cnic.replace(/\D/g, '');
    if (cnicDigits.length !== 13) {
      setError('Owner CNIC must contain exactly 13 digits.');
      return;
    }
    if (!form.licenseNumber.trim()) {
      setError('Please enter the drug license number.');
      return;
    }

    setLoading(true);
    const { confirmPassword: _c, ...rest } = form;
    const result = await register({
      ...rest,
      email: form.email.trim(),
      phone: normalizePhoneDigits(form.phone)
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error || 'Registration failed');
      return;
    }
    setStep(4);
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  if (step === 4) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdfa' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontFamily: 'Sora,sans-serif', marginBottom: 12, color: '#0f172a' }}>Registration Submitted!</h2>
        <p style={{ color: '#64748b', marginBottom: 24 }}>Registration completed successfully. You can now login with your account.</p>
        <button className="btn btn-primary" onClick={onBack}>Go to Login</button>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>💊</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', fontFamily: 'Sora,sans-serif', marginBottom: 8 }}>DawaConnect</div>
          <p className="auth-tagline">Join Pakistan's leading pharmacy network. Register your pharmacy in 3 simple steps.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 40 }}>
            {['Basic Information', 'Pharmacy Details', 'Document Upload'].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: step > i + 1 ? '#10b981' : step === i + 1 ? '#14b8a6' : 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>{step > i + 1 ? '✓' : i + 1}</div>
                <span style={{ color: step === i + 1 ? '#fff' : 'rgba(255,255,255,.5)', fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-box registration-form-box">
          <h2>Register Pharmacy</h2>
          <p>Step {step} of 3 — {['Basic Info', 'Location & Hours', 'Documents'][step - 1]}</p>
          {error && <div className="alert alert-danger">⚠️ {error}</div>}
          <form onSubmit={handleSubmit}>
            {step === 1 && (<>
              <div className="form-group"><label className="form-label">Pharmacy Name *</label><input className="form-control" required value={form.pharmacyName} onChange={e => set('pharmacyName', e.target.value)} placeholder="Al-Shifa Pharmacy" /></div>
              <div className="form-group"><label className="form-label">Owner Name *</label><input className="form-control" required value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="Dr. Muhammad Ali" /></div>
              <div className="form-group"><label className="form-label">Email Address *</label><input className="form-control" type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="owner@pharmacy.com" autoComplete="email" /></div>
              <div className="form-group"><label className="form-label">Phone Number *</label><input className="form-control" required inputMode="numeric" autoComplete="tel" maxLength={11} value={form.phone} onChange={e => set('phone', normalizePhoneDigits(e.target.value))} placeholder="03001234567" /><p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>11 digits only (no spaces or dashes).</p></div>
              <div className="form-group"><label className="form-label">Password *</label><div className="password-input-wrap"><input className="form-control" type={showPassword ? 'text' : 'password'} required value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 8 chars, 1 uppercase, 1 special" autoComplete="new-password" /><button type="button" className="password-toggle-btn" tabIndex={-1} onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>At least 8 characters, one capital letter, and one special character.</p></div>
              <div className="form-group"><label className="form-label">Confirm Password *</label><input className="form-control" type={showPassword ? 'text' : 'password'} required value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="Re-enter your password" autoComplete="new-password" /></div>
            </>)}
            {step === 2 && (<>
              <LocationPickerMap
                latitude={form.latitude}
                longitude={form.longitude}
                confirmed={Boolean(form.locationConfirmation)}
                onChange={(location) => setForm((current) => ({
                  ...current,
                  ...(location || { latitude: null, longitude: null, addressLine1: '', area: '', city: '', province: '', locationConfirmation: '' }),
                }))}
              />
              <p className="location-picker-help">These fields come from the confirmed map point and cannot be typed manually. Some areas have incomplete map address data; the confirmed coordinates are always saved.</p>
              <div className="form-group"><label className="form-label" htmlFor="pharmacy-map-address">Address Line (from map)</label><textarea id="pharmacy-map-address" className="form-control" rows={3} readOnly value={form.addressLine1} placeholder="Confirm the map pin to fill this address" /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label" htmlFor="pharmacy-map-area">Area (from map)</label><input id="pharmacy-map-area" className="form-control" readOnly value={form.area} placeholder={form.locationConfirmation ? 'Not available from map' : 'Filled after confirmation'} /></div>
                <div className="form-group"><label className="form-label" htmlFor="pharmacy-map-city">City (from map)</label><input id="pharmacy-map-city" className="form-control" readOnly value={form.city} placeholder={form.locationConfirmation ? 'Not available from map' : 'Filled after confirmation'} /></div>
              </div>
              <div className="form-group"><label className="form-label" htmlFor="pharmacy-map-province">Province / Territory (from map)</label><input id="pharmacy-map-province" className="form-control" readOnly value={form.province} placeholder={form.locationConfirmation ? 'Not available from map' : 'Filled after confirmation'} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Opening Time</label><input className="form-control" type="time" value={form.openingTime} onChange={e => set('openingTime', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Closing Time</label><input className="form-control" type="time" value={form.closingTime} onChange={e => set('closingTime', e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Delivery Charge (PKR)</label><input className="form-control" type="number" value={form.deliveryCharge} onChange={e => set('deliveryCharge', Number(e.target.value))} /></div>
                <div className="form-group"><label className="form-label">Service Radius (km)</label><input className="form-control" type="number" value={form.serviceRadiusKm} onChange={e => set('serviceRadiusKm', Number(e.target.value))} /></div>
              </div>
            </>)}
            {step === 3 && (<>
              <div className="form-group"><label className="form-label">Drug License Number *</label><input className="form-control" required value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} placeholder="DL-PB-2024-XXXXX" /></div>
              <div className="form-group"><label className="form-label">Owner CNIC *</label><input className="form-control" required value={form.cnic} onChange={e => set('cnic', formatCnicInput(e.target.value))} placeholder="35202-1234567-1" maxLength={15} inputMode="numeric" autoComplete="off" /><p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>13 digits; hyphens are added automatically.</p></div>
              <div className="alert alert-info">Your pharmacy profile and account will be created instantly on submit.</div>
            </>)}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {step > 1 && <button type="button" className="btn btn-secondary" onClick={() => setStep(s => s - 1)} style={{ flex: 1, justifyContent: 'center' }}>Back</button>}
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading || authLoading}>{loading || authLoading ? (step === 3 ? 'Submitting...' : 'Checking...') : step === 3 ? 'Create Account' : 'Next Step →'}</button>
            </div>
          </form>
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
            Already registered? <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#0d9488', fontWeight: 600, cursor: 'pointer' }}>Sign In</button>
          </div>
        </div>
      </div>
    </div>
  );
}
