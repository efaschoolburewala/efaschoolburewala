'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// WebAuthn encoding helpers
function base64UrlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface BiometricItem {
    id: number;
    credential_type: string;
    device_name: string;
    created_at: string;
}

interface UserProfile {
    id: number;
    username: string;
    full_name: string;
    email: string | null;
    is_active: boolean;
    role_id: number;
    role_name: string;
    role_level: number;
    dashboard_access: string;
    created_at: string;
    employee_id?: number | null;
    employee_phone?: string | null;
    designation?: string | null;
    incharge_class?: { class_id: number; section_id: number } | null;
    permissions: Array<{
        module_name: string;
        can_read: boolean;
        can_write: boolean;
        can_delete: boolean;
    }>;
    student_details?: {
        student_id: number;
        admission_no: string;
        roll_no: string;
        first_name: string;
        last_name: string;
        class_name?: string;
        section_name?: string;
    } | null;
    biometrics: BiometricItem[];
}

export default function ProfilePage() {
    const { user: authUser } = useAuth();
    const token = authUser?.token;
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'info' | 'biometrics' | 'security'>('info');

    // Profile Edit State
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // Biometric Scanner State
    const [scanningFingerprint, setScanningFingerprint] = useState(false);
    const [scanningRetina, setScanningRetina] = useState(false);
    const [bioStatus, setBioStatus] = useState<{ type: 'success' | 'danger' | 'info'; message: string } | null>(null);
    const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);

    const loadProfile = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load profile');
            setProfile(data);
            setFullName(data.full_name || '');
            setEmail(data.email || '');
        } catch (err: any) {
            setAlertMsg({ type: 'danger', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();
    }, [token]);

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim()) {
            setAlertMsg({ type: 'danger', message: 'Full name is required.' });
            return;
        }
        setSavingProfile(true);
        setAlertMsg(null);
        try {
            const res = await fetch(`${API}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ full_name: fullName, email })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update profile');
            setAlertMsg({ type: 'success', message: 'Profile updated successfully!' });
            loadProfile();
        } catch (err: any) {
            setAlertMsg({ type: 'danger', message: err.message });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setAlertMsg({ type: 'danger', message: 'New passwords do not match.' });
            return;
        }
        if (newPassword.length < 6) {
            setAlertMsg({ type: 'danger', message: 'Password must be at least 6 characters long.' });
            return;
        }
        setChangingPassword(true);
        setAlertMsg(null);
        try {
            const res = await fetch(`${API}/auth/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to change password');
            setAlertMsg({ type: 'success', message: 'Password changed successfully!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setAlertMsg({ type: 'danger', message: err.message });
        } finally {
            setChangingPassword(false);
        }
    };

    // Register Fingerprint / WebAuthn Biometric
    const handleRegisterFingerprint = async () => {
        if (typeof window === 'undefined' || !window.PublicKeyCredential) {
            setBioStatus({ type: 'danger', message: 'WebAuthn / Biometrics is not supported on this device/browser.' });
            return;
        }
        setScanningFingerprint(true);
        setBioStatus({ type: 'info', message: 'Touch your fingerprint sensor or verify your device biometric...' });
        try {
            const res = await fetch(`${API}/auth/webauthn/register-options`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to get registration challenge');

            const { challengeId, options } = data;
            const creationOptions: PublicKeyCredentialCreationOptions = {
                challenge: base64UrlToBuffer(options.challenge),
                rp: options.rp,
                user: {
                    id: base64UrlToBuffer(options.user.id),
                    name: options.user.name,
                    displayName: options.user.displayName,
                },
                pubKeyCredParams: options.pubKeyCredParams,
                authenticatorSelection: options.authenticatorSelection,
                timeout: options.timeout,
                attestation: options.attestation
            };

            const credential = await navigator.credentials.create({ publicKey: creationOptions }) as any;
            if (!credential) throw new Error('Biometric registration was cancelled.');

            const verifyRes = await fetch(`${API}/auth/webauthn/register-verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    challengeId,
                    credential: {
                        id: credential.id,
                        rawId: bufferToBase64Url(credential.rawId),
                        response: {
                            clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
                            attestationObject: bufferToBase64Url(credential.response.attestationObject),
                            transports: credential.response.getTransports ? credential.response.getTransports() : ['internal']
                        }
                    },
                    credential_type: 'fingerprint',
                    device_name: 'Biometric Fingerprint Scanner'
                })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Failed to verify credential');

            setBioStatus({ type: 'success', message: '✓ Fingerprint biometric enrolled and saved successfully!' });
            loadProfile();
        } catch (err: any) {
            setBioStatus({ type: 'danger', message: err.message || 'Fingerprint registration failed' });
        } finally {
            setScanningFingerprint(false);
        }
    };

    // Register Eye Retina / Face ID Biometric
    const handleRegisterRetina = async () => {
        if (typeof window === 'undefined' || !window.PublicKeyCredential) {
            setBioStatus({ type: 'danger', message: 'WebAuthn / Camera Biometrics is not supported on this device/browser.' });
            return;
        }
        setScanningRetina(true);
        setBioStatus({ type: 'info', message: 'Scanning Eye Retina / Face... Please look directly at the sensor/camera.' });
        try {
            const res = await fetch(`${API}/auth/webauthn/register-options`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to get registration challenge');

            const { challengeId, options } = data;
            const creationOptions: PublicKeyCredentialCreationOptions = {
                challenge: base64UrlToBuffer(options.challenge),
                rp: options.rp,
                user: {
                    id: base64UrlToBuffer(options.user.id),
                    name: options.user.name,
                    displayName: options.user.displayName,
                },
                pubKeyCredParams: options.pubKeyCredParams,
                authenticatorSelection: {
                    ...options.authenticatorSelection,
                    userVerification: 'required' // Require Face/Retina high assurance
                },
                timeout: options.timeout,
                attestation: options.attestation
            };

            const credential = await navigator.credentials.create({ publicKey: creationOptions }) as any;
            if (!credential) throw new Error('Eye Retina / Face ID registration was cancelled.');

            const verifyRes = await fetch(`${API}/auth/webauthn/register-verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    challengeId,
                    credential: {
                        id: credential.id,
                        rawId: bufferToBase64Url(credential.rawId),
                        response: {
                            clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
                            attestationObject: bufferToBase64Url(credential.response.attestationObject),
                            transports: credential.response.getTransports ? credential.response.getTransports() : ['internal']
                        }
                    },
                    credential_type: 'retina_face',
                    device_name: 'Eye Retina / Face ID Scanner'
                })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Failed to verify credential');

            setBioStatus({ type: 'success', message: '✓ Eye Retina / Face ID biometric enrolled and saved successfully!' });
            loadProfile();
        } catch (err: any) {
            setBioStatus({ type: 'danger', message: err.message || 'Eye Retina registration failed' });
        } finally {
            setScanningRetina(false);
        }
    };

    const handleDeleteCredential = async (id: number) => {
        if (!confirm('Are you sure you want to remove this biometric passkey?')) return;
        try {
            const res = await fetch(`${API}/auth/webauthn/credentials/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete credential');
            setBioStatus({ type: 'success', message: 'Biometric credential removed.' });
            loadProfile();
        } catch (err: any) {
            setBioStatus({ type: 'danger', message: err.message });
        }
    };

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center">
                <div className="spinner-border text-teal" role="status" style={{ color: 'var(--primary-teal, #14b8a6)' }}>
                    <span className="visually-hidden">Loading Profile...</span>
                </div>
                <p className="mt-2 text-muted fw-semibold">Loading Personal Profile &amp; Biometrics...</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="container py-5 text-center">
                <div className="alert alert-danger">Could not load profile. Please log in again.</div>
                <Link href="/login" className="btn btn-primary">Go to Login</Link>
            </div>
        );
    }

    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.slice(0, 2).toUpperCase() || 'U';
    };

    return (
        <div className="container-fluid py-4 px-md-4" style={{ maxWidth: 1200 }}>
            {/* Top Navigation Breadcrumb */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h3 className="fw-bold mb-0 text-dark" style={{ letterSpacing: '-0.5px' }}>
                        <i className="bi bi-person-badge-fill me-2 text-teal" style={{ color: '#0d9488' }}></i>
                        User Profile &amp; Security
                    </h3>
                    <p className="text-muted small mb-0">Manage your personal information, roles, and WebAuthn biometric security</p>
                </div>
                <Link href="/" className="btn btn-sm btn-outline-secondary rounded-pill px-3">
                    <i className="bi bi-arrow-left me-1"></i> Dashboard
                </Link>
            </div>

            {alertMsg && (
                <div className={`alert alert-${alertMsg.type} alert-dismissible fade show rounded-3 shadow-sm`} role="alert">
                    <i className={`bi ${alertMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
                    {alertMsg.message}
                    <button type="button" className="btn-close" onClick={() => setAlertMsg(null)}></button>
                </div>
            )}

            {/* Profile Hero Card */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff' }}>
                <div className="card-body p-4 p-md-5">
                    <div className="d-flex flex-column flex-md-row align-items-center gap-4">
                        {/* Avatar */}
                        <div style={{
                            width: 90, height: 90, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                            color: '#fff', fontSize: '2.2rem', fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '4px solid rgba(255,255,255,0.2)',
                            boxShadow: '0 8px 24px rgba(13,148,136,0.35)', flexShrink: 0
                        }}>
                            {getInitials(profile.full_name)}
                        </div>

                        {/* User Details */}
                        <div className="flex-grow-1 text-center text-md-start">
                            <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-md-start gap-2 mb-1">
                                <h4 className="fw-bold mb-0 text-white">{profile.full_name}</h4>
                                <span className="badge bg-teal text-white fw-bold px-2.5 py-1 rounded-pill" style={{ backgroundColor: '#0d9488', fontSize: '0.75rem' }}>
                                    {profile.role_name} (Level {profile.role_level})
                                </span>
                                {profile.is_active ? (
                                    <span className="badge bg-success-subtle text-success border border-success-subtle fw-bold rounded-pill px-2.5 py-1" style={{ fontSize: '0.75rem' }}>
                                        Active Account
                                    </span>
                                ) : (
                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle fw-bold rounded-pill px-2.5 py-1" style={{ fontSize: '0.75rem' }}>
                                        Disabled
                                    </span>
                                )}
                            </div>
                            <p className="text-white-50 mb-2 small">
                                <i className="bi bi-person me-1"></i> @{profile.username}
                                {profile.email && <> &bull; <i className="bi bi-envelope me-1 ms-2"></i>{profile.email}</>}
                            </p>
                            <div className="d-flex flex-wrap gap-3 justify-content-center justify-content-md-start mt-3">
                                <div className="bg-white bg-opacity-10 px-3 py-1.5 rounded-3" style={{ fontSize: '0.8rem' }}>
                                    <span className="text-white-50 me-1">User ID:</span>
                                    <strong className="text-white">#{profile.id}</strong>
                                </div>
                                <div className="bg-white bg-opacity-10 px-3 py-1.5 rounded-3" style={{ fontSize: '0.8rem' }}>
                                    <span className="text-white-50 me-1">Dashboard:</span>
                                    <strong className="text-white text-capitalize">{profile.dashboard_access || 'Standard'}</strong>
                                </div>
                                <div className="bg-white bg-opacity-10 px-3 py-1.5 rounded-3" style={{ fontSize: '0.8rem' }}>
                                    <span className="text-white-50 me-1">Biometrics:</span>
                                    <strong className="text-white">{profile.biometrics?.length || 0} Registered</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white bg-opacity-10 px-4 pt-2 border-top border-white border-opacity-10">
                    <ul className="nav nav-pills gap-2" role="tablist">
                        <li className="nav-item">
                            <button
                                className={`nav-link text-white fw-bold px-4 py-2.5 rounded-top-3 border-0 ${activeTab === 'info' ? 'active bg-white text-dark shadow-sm' : 'bg-transparent text-white-50'}`}
                                onClick={() => setActiveTab('info')}
                                style={{ fontSize: '0.9rem' }}
                            >
                                <i className="bi bi-person-lines-fill me-2"></i>Profile &amp; Permissions
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link text-white fw-bold px-4 py-2.5 rounded-top-3 border-0 ${activeTab === 'biometrics' ? 'active bg-white text-dark shadow-sm' : 'bg-transparent text-white-50'}`}
                                onClick={() => setActiveTab('biometrics')}
                                style={{ fontSize: '0.9rem' }}
                            >
                                <i className="bi bi-fingerprint me-2 text-danger"></i>Biometric &amp; Eye Retina (WebAuthn)
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link text-white fw-bold px-4 py-2.5 rounded-top-3 border-0 ${activeTab === 'security' ? 'active bg-white text-dark shadow-sm' : 'bg-transparent text-white-50'}`}
                                onClick={() => setActiveTab('security')}
                                style={{ fontSize: '0.9rem' }}
                            >
                                <i className="bi bi-shield-lock-fill me-2 text-warning"></i>Security &amp; Password
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            {/* TAB 1: Profile & Permissions */}
            {activeTab === 'info' && (
                <div className="row g-4">
                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white p-4">
                            <h5 className="fw-bold text-dark mb-3">
                                <i className="bi bi-pencil-square me-2 text-teal" style={{ color: '#0d9488' }}></i>
                                Edit Personal Details
                            </h5>
                            <form onSubmit={handleSaveProfile}>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">Username</label>
                                    <input type="text" className="form-control bg-light fw-bold" value={profile.username} disabled />
                                    <div className="form-text" style={{ fontSize: '0.75rem' }}>Username is unique and cannot be changed.</div>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">Full Name</label>
                                    <input type="text" className="form-control fw-semibold" value={fullName} onChange={e => setFullName(e.target.value)} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">Email Address</label>
                                    <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@domain.com" />
                                </div>
                                {profile.employee_id && (
                                    <div className="mb-3 p-3 bg-light rounded-3 border">
                                        <span className="badge bg-secondary mb-1">Staff Member</span>
                                        <div className="small text-muted">Designation: <strong className="text-dark">{profile.designation || 'Staff'}</strong></div>
                                        <div className="small text-muted">Employee ID: <strong className="text-dark">EMP-{profile.employee_id}</strong></div>
                                    </div>
                                )}
                                {profile.student_details && (
                                    <div className="mb-3 p-3 bg-light rounded-3 border">
                                        <span className="badge bg-primary mb-1">Student Account</span>
                                        <div className="small text-muted">Admission No: <strong className="text-dark">{profile.student_details.admission_no}</strong></div>
                                        <div className="small text-muted">Class: <strong className="text-dark">{profile.student_details.class_name} ({profile.student_details.section_name})</strong></div>
                                    </div>
                                )}
                                <button type="submit" className="btn btn-teal fw-bold text-white px-4 rounded-3" style={{ backgroundColor: '#0d9488' }} disabled={savingProfile}>
                                    {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white p-4">
                            <h5 className="fw-bold text-dark mb-3">
                                <i className="bi bi-key-fill me-2 text-teal" style={{ color: '#0d9488' }}></i>
                                Role &amp; Module Permissions
                            </h5>
                            <p className="text-muted small mb-3">
                                The following module access rights are assigned to your role (<strong>{profile.role_name}</strong>):
                            </p>
                            <div className="table-responsive">
                                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                                    <thead className="table-light">
                                        <tr>
                                            <th>Module</th>
                                            <th className="text-center">View</th>
                                            <th className="text-center">Edit</th>
                                            <th className="text-center">Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {profile.permissions && profile.permissions.length > 0 ? (
                                            profile.permissions.map((perm, idx) => (
                                                <tr key={idx}>
                                                    <td className="fw-bold text-dark text-capitalize">{perm.module_name.replace('dash.', 'Dashboard ')}</td>
                                                    <td className="text-center">
                                                        {perm.can_read ? <i className="bi bi-check-circle-fill text-success"></i> : <i className="bi bi-x-circle text-muted"></i>}
                                                    </td>
                                                    <td className="text-center">
                                                        {perm.can_write ? <i className="bi bi-check-circle-fill text-success"></i> : <i className="bi bi-x-circle text-muted"></i>}
                                                    </td>
                                                    <td className="text-center">
                                                        {perm.can_delete ? <i className="bi bi-check-circle-fill text-success"></i> : <i className="bi bi-x-circle text-muted"></i>}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="text-center text-muted py-3">All permissions granted (Administrator)</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Biometric & Eye Retina (WebAuthn) */}
            {activeTab === 'biometrics' && (
                <div>
                    {bioStatus && (
                        <div className={`alert alert-${bioStatus.type} alert-dismissible fade show rounded-3 mb-4`} role="alert">
                            <i className={`bi ${bioStatus.type === 'success' ? 'bi-check-circle-fill' : bioStatus.type === 'info' ? 'bi-info-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
                            {bioStatus.message}
                            <button type="button" className="btn-close" onClick={() => setBioStatus(null)}></button>
                        </div>
                    )}

                    <div className="row g-4 mb-4">
                        {/* Scanner Card 1: Fingerprint Biometric */}
                        <div className="col-md-6">
                            <div className="card border-0 shadow-sm rounded-4 h-100 bg-white p-4 text-center d-flex flex-column align-items-center">
                                <div style={{
                                    width: 80, height: 80, borderRadius: '50%',
                                    backgroundColor: '#f0fdf4', color: '#16a34a',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '2.5rem', marginBottom: 16,
                                    border: '2px dashed #86efac'
                                }}>
                                    <i className={`bi bi-fingerprint ${scanningFingerprint ? 'animate__animated animate__pulse animate__infinite' : ''}`}></i>
                                </div>
                                <h5 className="fw-bold text-dark mb-1">Fingerprint Biometric</h5>
                                <p className="text-muted small mb-4" style={{ maxWidth: 360 }}>
                                    Enroll your device fingerprint sensor, Windows Hello, or Android Fingerprint to enable fast passwordless biometric login.
                                </p>
                                <button
                                    className="btn btn-success fw-bold px-4 py-2.5 rounded-pill mt-auto w-100"
                                    style={{ maxWidth: 280 }}
                                    onClick={handleRegisterFingerprint}
                                    disabled={scanningFingerprint || scanningRetina}
                                >
                                    {scanningFingerprint ? (
                                        <><span className="spinner-border spinner-border-sm me-2" />Scanning Fingerprint...</>
                                    ) : (
                                        <><i className="bi bi-fingerprint me-2"></i>Scan &amp; Enroll Fingerprint</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Scanner Card 2: Eye Retina / Face ID Scanner */}
                        <div className="col-md-6">
                            <div className="card border-0 shadow-sm rounded-4 h-100 bg-white p-4 text-center d-flex flex-column align-items-center">
                                <div style={{
                                    width: 80, height: 80, borderRadius: '50%',
                                    backgroundColor: '#eff6ff', color: '#2563eb',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '2.5rem', marginBottom: 16,
                                    border: '2px dashed #93c5fd'
                                }}>
                                    <i className={`bi bi-eye-fill ${scanningRetina ? 'animate__animated animate__pulse animate__infinite' : ''}`}></i>
                                </div>
                                <h5 className="fw-bold text-dark mb-1">Eye Retina / Face ID Scanner</h5>
                                <p className="text-muted small mb-4" style={{ maxWidth: 360 }}>
                                    Scan your eye retina / facial biometrics using your camera &amp; device hardware. Stores cryptographically verified FIDO2 credentials.
                                </p>
                                <button
                                    className="btn btn-primary fw-bold px-4 py-2.5 rounded-pill mt-auto w-100"
                                    style={{ maxWidth: 280, backgroundColor: '#2563eb' }}
                                    onClick={handleRegisterRetina}
                                    disabled={scanningFingerprint || scanningRetina}
                                >
                                    {scanningRetina ? (
                                        <><span className="spinner-border spinner-border-sm me-2" />Scanning Eye Retina...</>
                                    ) : (
                                        <><i className="bi bi-eye me-2"></i>Scan &amp; Enroll Eye Retina</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Enrolled Biometrics Table */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <h5 className="fw-bold text-dark mb-0">
                                <i className="bi bi-shield-check me-2 text-teal" style={{ color: '#0d9488' }}></i>
                                Active Enrolled Biometrics &amp; Passkeys
                            </h5>
                            <span className="badge bg-light text-dark fw-semibold border">
                                {profile.biometrics?.length || 0} Registered
                            </span>
                        </div>

                        {profile.biometrics && profile.biometrics.length > 0 ? (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                                    <thead className="table-light">
                                        <tr>
                                            <th>Type</th>
                                            <th>Device / Authenticator Name</th>
                                            <th>Enrolled Date</th>
                                            <th className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {profile.biometrics.map((bio) => (
                                            <tr key={bio.id}>
                                                <td>
                                                    {bio.credential_type === 'retina_face' ? (
                                                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle py-1.5 px-2.5 rounded-pill">
                                                            <i className="bi bi-eye-fill me-1"></i> Eye Retina / Face ID
                                                        </span>
                                                    ) : (
                                                        <span className="badge bg-success-subtle text-success border border-success-subtle py-1.5 px-2.5 rounded-pill">
                                                            <i className="bi bi-fingerprint me-1"></i> Fingerprint Biometric
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="fw-semibold text-dark">{bio.device_name}</td>
                                                <td className="text-muted small">
                                                    {new Date(bio.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="text-end">
                                                    <button
                                                        className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold"
                                                        onClick={() => handleDeleteCredential(bio.id)}
                                                    >
                                                        <i className="bi bi-trash3 me-1"></i> Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-muted">
                                <i className="bi bi-shield-x fs-1 d-block mb-2 text-muted opacity-50"></i>
                                <p className="mb-0 fw-semibold">No biometrics registered yet.</p>
                                <span className="small">Click above to enroll your Fingerprint or Eye Retina scan.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: Security & Password */}
            {activeTab === 'security' && (
                <div className="row g-4">
                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white p-4">
                            <h5 className="fw-bold text-dark mb-3">
                                <i className="bi bi-lock-fill me-2 text-warning"></i>
                                Change Account Password
                            </h5>
                            <form onSubmit={handleChangePassword}>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">Current Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">New Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="form-label small fw-bold text-muted">Confirm New Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter new password"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn btn-warning fw-bold text-dark px-4 py-2 rounded-3"
                                    disabled={changingPassword}
                                >
                                    {changingPassword ? 'Updating Password...' : 'Update Password'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white p-4">
                            <h5 className="fw-bold text-dark mb-3">
                                <i className="bi bi-shield-check me-2 text-success"></i>
                                Security Overview
                            </h5>
                            <ul className="list-group list-group-flush mb-0" style={{ fontSize: '0.9rem' }}>
                                <li className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
                                    <span className="text-muted">Account Status</span>
                                    <span className="badge bg-success">Active &amp; Verified</span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
                                    <span className="text-muted">WebAuthn / Passkey Authentication</span>
                                    <span className="badge bg-teal text-white" style={{ backgroundColor: '#0d9488' }}>
                                        {profile.biometrics?.length ? 'Enabled' : 'Disabled'}
                                    </span>
                                </li>
                                <li className="list-group-item d-flex justify-content-between align-items-center px-0 py-2.5">
                                    <span className="text-muted">Account Created On</span>
                                    <span className="fw-semibold text-dark">
                                        {new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
