import React, { useEffect, useState } from 'react';
import { ArrowLeft, Camera, Check, CheckCircle2, Clock3, Eye, EyeOff, FileCheck2, ImagePlus, MailCheck, MapPin, ShieldCheck, Store, Trash2 } from 'lucide-react';
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
  if (!/\d/.test(pw)) return 'Password must include at least one number.';
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

function LegacyRegisterPage({ onBack }) {
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

export function RegisterPage({ onBack }) {
  const {
    register, verifyRegistrationEmail, resendRegistrationEmail,
    checkRegistrationAvailability, authLoading,
  } = useApp();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verification, setVerification] = useState(null);
  const [registrationOtp, setRegistrationOtp] = useState('');
  const [registrationPhotos, setRegistrationPhotos] = useState({ inside: null, outside: null });
  const [completionWarning, setCompletionWarning] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [form, setForm] = useState({
    pharmacyName: '', ownerName: '', email: '', phone: '', password: '', confirmPassword: '',
    addressLine1: '', area: '', city: '', province: '', latitude: null, longitude: null, locationConfirmation: '',
    openingTime: '08:00', closingTime: '22:00', deliveryCharge: 50, serviceRadiusKm: 10,
    licenseNumber: '', cnic: ''
  });

  useEffect(() => {
    if (step !== 3) return undefined;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const secondsUntil = (value) => Math.max(0, Math.ceil((new Date(value || 0).getTime() - clock) / 1000));
  const expiresIn = secondsUntil(verification?.expiresAt);
  const resendIn = secondsUntil(verification?.resendAvailableAt);
  const timerLabel = `${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')}`;

  const validateAccount = async () => {
    const email = form.email.trim();
    if (!form.pharmacyName.trim() || !form.ownerName.trim()) throw new Error('Please enter the pharmacy and owner name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
    const phone = normalizePhoneDigits(form.phone);
    if (phone.length !== 11) throw new Error('Phone number must contain exactly 11 digits.');
    const passwordError = validateRegistrationPassword(form.password);
    if (passwordError) throw new Error(passwordError);
    if (form.password !== form.confirmPassword) throw new Error('Password and confirm password do not match.');
    const availability = await checkRegistrationAvailability({ email, phone });
    if (!availability.ok) throw new Error(availability.error || 'Could not check the registration details.');
    if (availability.emailTaken) throw new Error('This email is already registered.');
    if (availability.phoneTaken) throw new Error('This phone number is already registered.');
  };

  const validatePharmacyDetails = () => {
    if (!form.locationConfirmation) throw new Error('Search for the pharmacy, adjust the pin, and confirm the exact location.');
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error('Please select the pharmacy\'s exact location on the map.');
    }
    if (form.cnic.replace(/\D/g, '').length !== 13) throw new Error('Owner CNIC must contain exactly 13 digits.');
    if (!form.licenseNumber.trim()) throw new Error('Please enter the drug license number.');
  };

  const pickRegistrationPhoto = async (slot) => {
    setError('');
    const result = await window.electronAPI.registrationPhotos.pick({ slot });
    if (!result.ok) {
      setError(result.error || 'The photo could not be selected.');
      return;
    }
    if (!result.canceled) setRegistrationPhotos((current) => ({ ...current, [slot]: result.data }));
  };

  const clearRegistrationPhoto = async (slot) => {
    const result = await window.electronAPI.registrationPhotos.clear({ slot });
    if (!result.ok) {
      setError(result.error || 'The selected photo could not be removed.');
      return;
    }
    setRegistrationPhotos((current) => ({ ...current, [slot]: null }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (step === 1) {
        await validateAccount();
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (step === 2) {
        validatePharmacyDetails();
        const { confirmPassword: _confirmPassword, ...payload } = form;
        const result = await register({
          ...payload,
          email: form.email.trim(),
          phone: normalizePhoneDigits(form.phone),
        });
        if (!result.ok) throw new Error(result.error || 'Registration could not be started.');
        setVerification(result.data);
        setRegistrationOtp('');
        setNotice('We sent a six-digit verification code to your email.');
        setStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (!/^\d{6}$/.test(registrationOtp)) throw new Error('Enter the six-digit verification code.');
      if (expiresIn === 0) throw new Error('This code has expired. Request a new code.');
      const result = await verifyRegistrationEmail({ challengeId: verification?.challengeId, otp: registrationOtp });
      if (!result.ok) throw new Error(result.error || 'Email verification failed.');
      setCompletionWarning(result.data?.photoUploadWarning || '');
      setStep(4);
    } catch (submissionError) {
      setError(submissionError?.message || 'Registration could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!verification?.challengeId || resendIn > 0 || loading) return;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const result = await resendRegistrationEmail(verification.challengeId);
      if (!result.ok) throw new Error(result.error || 'Could not send another code.');
      setVerification((current) => ({ ...current, ...result.data }));
      setRegistrationOtp('');
      setClock(Date.now());
      setNotice('A new verification code has been sent.');
    } catch (resendError) {
      setError(resendError?.message || 'Could not send another code.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 4) return (
    <div className="registration-page registration-complete-page">
      <div className="registration-success-card">
        <div className="registration-success-icon"><CheckCircle2 size={42} /></div>
        <span className="registration-eyebrow">EMAIL VERIFIED</span>
        <h2>Registration submitted</h2>
        <p>Your pharmacy account has been created and sent for administrator review. You can sign in while approval is pending.</p>
        {completionWarning && <div className="alert alert-info">{completionWarning}</div>}
        <button className="btn btn-primary registration-primary-action" onClick={onBack}>Continue to sign in</button>
      </div>
    </div>
  );

  const progress = [['Account', Store], ['Pharmacy details', MapPin], ['Email verification', MailCheck]];
  return (
    <div className="registration-page">
      <header className="registration-topbar">
        <button type="button" className="registration-back-link" onClick={onBack}><ArrowLeft size={18} /> Back to sign in</button>
        <div className="registration-brand"><span className="registration-brand-mark">D</span><span>DawaConnect</span></div>
        <span className="registration-secure"><ShieldCheck size={17} /> Secure pharmacy onboarding</span>
      </header>

      <main className="registration-shell">
        <section className="registration-heading">
          <div>
            <span className="registration-eyebrow">PHARMACY PARTNER REGISTRATION</span>
            <h1>{step === 1 ? 'Create your pharmacy account' : step === 2 ? 'Tell us about your pharmacy' : 'Verify your email'}</h1>
            <p>{step === 1 ? 'Start with the owner and account information.' : step === 2 ? 'Confirm the exact location, operating setup and licence details in one place.' : 'One final security step before your application is submitted.'}</p>
          </div>
          <div className="registration-progress" aria-label={`Registration step ${step} of 3`}>
            {progress.map(([label, Icon], index) => {
              const number = index + 1;
              const state = step > number ? 'complete' : step === number ? 'active' : '';
              return <React.Fragment key={label}>
                {index > 0 && <span className={`registration-progress-line ${step > index ? 'complete' : ''}`} />}
                <div className={`registration-progress-step ${state}`}>
                  <span>{step > number ? <Check size={16} /> : <Icon size={16} />}</span>
                  <small>{label}</small>
                </div>
              </React.Fragment>;
            })}
          </div>
        </section>

        <div className={`registration-card ${step === 3 ? 'registration-card-otp' : ''}`}>
          {error && <div className="alert alert-danger">{error}</div>}
          {notice && <div className="alert alert-success"><CheckCircle2 size={18} /> {notice}</div>}
          <form onSubmit={handleSubmit}>
            {step === 1 && <>
              <RegistrationSectionHeading icon={Store} title="Account information" description="Information used to identify the pharmacy owner and sign in securely." />
              <div className="registration-form-grid">
                <div className="form-group"><label className="form-label">Pharmacy Name *</label><input className="form-control" required value={form.pharmacyName} onChange={(event) => set('pharmacyName', event.target.value)} placeholder="Al-Shifa Pharmacy" /></div>
                <div className="form-group"><label className="form-label">Owner Name *</label><input className="form-control" required value={form.ownerName} onChange={(event) => set('ownerName', event.target.value)} placeholder="Muhammad Ali" /></div>
                <div className="form-group"><label className="form-label">Email Address *</label><input className="form-control" type="email" required value={form.email} onChange={(event) => set('email', event.target.value)} placeholder="owner@pharmacy.com" autoComplete="email" /><span className="registration-field-note">We will verify this address before creating the account.</span></div>
                <div className="form-group"><label className="form-label">Phone Number *</label><input className="form-control" required inputMode="numeric" autoComplete="tel" maxLength={11} value={form.phone} onChange={(event) => set('phone', normalizePhoneDigits(event.target.value))} placeholder="03001234567" /><span className="registration-field-note">Enter 11 digits without spaces or dashes.</span></div>
                <div className="form-group"><label className="form-label">Password *</label><div className="password-input-wrap"><input className="form-control" type={showPassword ? 'text' : 'password'} required value={form.password} onChange={(event) => set('password', event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" /><button type="button" className="password-toggle-btn" tabIndex={-1} onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><span className="registration-field-note">Include one uppercase letter, one number and one special character.</span></div>
                <div className="form-group"><label className="form-label">Confirm Password *</label><input className="form-control" type={showPassword ? 'text' : 'password'} required value={form.confirmPassword} onChange={(event) => set('confirmPassword', event.target.value)} placeholder="Re-enter your password" autoComplete="new-password" /></div>
              </div>
            </>}

            {step === 2 && <>
              <section className="registration-detail-section">
                <RegistrationSectionHeading icon={MapPin} title="Exact pharmacy location" description="Search for a nearby address, place the marker at the entrance, then confirm it." />
                <LocationPickerMap
                  latitude={form.latitude}
                  longitude={form.longitude}
                  confirmed={Boolean(form.locationConfirmation)}
                  onChange={(location) => setForm((current) => ({
                    ...current,
                    ...(location || { latitude: null, longitude: null, addressLine1: '', area: '', city: '', province: '', locationConfirmation: '' }),
                  }))}
                />
                <p className="location-picker-help">Address fields are filled from the confirmed map pin and cannot be typed manually. The exact coordinates are always saved.</p>
                <div className="form-group"><label className="form-label" htmlFor="pharmacy-map-address">Confirmed address</label><textarea id="pharmacy-map-address" className="form-control" rows={2} readOnly value={form.addressLine1} placeholder="Confirm the map pin to fill this address" /></div>
                <div className="registration-form-grid registration-form-grid-3">
                  <div className="form-group"><label className="form-label" htmlFor="pharmacy-map-area">Area</label><input id="pharmacy-map-area" className="form-control" readOnly value={form.area} placeholder={form.locationConfirmation ? 'Not available from map' : 'Filled after confirmation'} /></div>
                  <div className="form-group"><label className="form-label" htmlFor="pharmacy-map-city">City</label><input id="pharmacy-map-city" className="form-control" readOnly value={form.city} placeholder={form.locationConfirmation ? 'Not available from map' : 'Filled after confirmation'} /></div>
                  <div className="form-group"><label className="form-label" htmlFor="pharmacy-map-province">Province / Territory</label><input id="pharmacy-map-province" className="form-control" readOnly value={form.province} placeholder={form.locationConfirmation ? 'Not available from map' : 'Filled after confirmation'} /></div>
                </div>
              </section>

              <section className="registration-detail-section">
                <RegistrationSectionHeading icon={Clock3} title="Hours and delivery" description="Set the usual operating hours and local delivery coverage." />
                <div className="registration-form-grid registration-form-grid-4">
                  <div className="form-group"><label className="form-label">Opening Time</label><input className="form-control" type="time" value={form.openingTime} onChange={(event) => set('openingTime', event.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Closing Time</label><input className="form-control" type="time" value={form.closingTime} onChange={(event) => set('closingTime', event.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Delivery Charge (PKR)</label><input className="form-control" type="number" min="0" value={form.deliveryCharge} onChange={(event) => set('deliveryCharge', Number(event.target.value))} /></div>
                  <div className="form-group"><label className="form-label">Service Radius (km)</label><input className="form-control" type="number" min="1" max="100" value={form.serviceRadiusKm} onChange={(event) => set('serviceRadiusKm', Number(event.target.value))} /></div>
                </div>
              </section>

              <section className="registration-detail-section">
                <RegistrationSectionHeading icon={FileCheck2} title="Licence and owner verification" description="These details will be checked by the DawaConnect administrator during approval." />
                <div className="registration-form-grid">
                  <div className="form-group"><label className="form-label">Drug License Number *</label><input className="form-control" required value={form.licenseNumber} onChange={(event) => set('licenseNumber', event.target.value)} placeholder="DL-PB-2024-XXXXX" /></div>
                  <div className="form-group"><label className="form-label">Owner CNIC *</label><input className="form-control" required value={form.cnic} onChange={(event) => set('cnic', formatCnicInput(event.target.value))} placeholder="35202-1234567-1" maxLength={15} inputMode="numeric" autoComplete="off" /><span className="registration-field-note">13 digits; hyphens are added automatically.</span></div>
                </div>
                <div className="registration-review-note"><ShieldCheck size={20} /><div><strong>Administrator review required</strong><span>Your email will be verified now. Pharmacy approval happens after the licence and business details are reviewed.</span></div></div>
              </section>

              <section className="registration-detail-section">
                <RegistrationSectionHeading icon={Camera} title="Pharmacy photos" description="Optionally show customers what the pharmacy looks like inside and from the street. You can also add or replace these later from Pharmacy Profile." />
                <div className="pharmacy-photo-grid">
                  {[
                    ['outside', 'Outside photo', 'Show the storefront or entrance so customers can recognize it.'],
                    ['inside', 'Inside photo', 'Show the counter, shelves, or customer area.'],
                  ].map(([slot, label, description]) => {
                    const photo = registrationPhotos[slot];
                    return <div className="pharmacy-photo-card" key={slot}>
                      <div className="pharmacy-photo-preview">
                        {photo?.previewUrl ? <img src={photo.previewUrl} alt={`${label} preview`} /> : <><ImagePlus size={30} /><span>No photo selected</span></>}
                      </div>
                      <div className="pharmacy-photo-copy"><strong>{label}</strong><span>{description}</span><small>Optional · JPEG, PNG or WebP · max 5 MB</small></div>
                      <div className="pharmacy-photo-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => pickRegistrationPhoto(slot)}><ImagePlus size={16} /> {photo ? 'Replace' : 'Choose photo'}</button>
                        {photo && <button type="button" className="pharmacy-photo-remove" onClick={() => clearRegistrationPhoto(slot)} aria-label={`Remove ${label}`}><Trash2 size={16} /> Remove</button>}
                      </div>
                    </div>;
                  })}
                </div>
              </section>
            </>}

            {step === 3 && <div className="registration-otp-panel">
              <div className="registration-otp-icon"><MailCheck size={34} /></div>
              <h2>Check your inbox</h2>
              <p>Enter the six-digit code sent to <strong>{verification?.maskedEmail || form.email}</strong>.</p>
              <label className="form-label" htmlFor="registration-otp">Verification code</label>
              <input id="registration-otp" className="form-control registration-otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={registrationOtp} onChange={(event) => setRegistrationOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoFocus />
              <div className={`registration-otp-timer ${expiresIn === 0 ? 'expired' : ''}`}><Clock3 size={16} /> {expiresIn ? `Code expires in ${timerLabel}` : 'Code expired'}</div>
              <button className="btn btn-primary registration-primary-action" disabled={loading || authLoading || registrationOtp.length !== 6 || expiresIn === 0}>{loading || authLoading ? 'Verifying...' : 'Verify email and submit'}</button>
              <button type="button" className="registration-resend" onClick={handleResend} disabled={loading || resendIn > 0}>{resendIn > 0 ? `Resend available in ${resendIn}s` : 'Send a new code'}</button>
              <span className="registration-otp-help">The account is not created until this code is verified.</span>
            </div>}

            {step < 3 && <div className="registration-actions">
              {step === 2 && <button type="button" className="btn btn-secondary" onClick={() => { setError(''); setStep(1); }}><ArrowLeft size={17} /> Back</button>}
              <button className="btn btn-primary" disabled={loading || authLoading}>{loading || authLoading ? (step === 2 ? 'Sending verification code...' : 'Checking details...') : step === 2 ? 'Continue to email verification' : 'Continue to pharmacy details'}</button>
            </div>}
          </form>
        </div>
      </main>
    </div>
  );
}

function RegistrationSectionHeading({ icon: Icon, title, description }) {
  return <div className="registration-section-heading">
    <div className="registration-section-icon"><Icon size={21} /></div>
    <div><h2>{title}</h2><p>{description}</p></div>
  </div>;
}
