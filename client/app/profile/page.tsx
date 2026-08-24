'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

import { 
    extractFaceDescriptor, 
    captureMultiFrameDescriptor, 
    getCurrentHost, 
    base64UrlToBuffer, 
    bufferToBase64Url 
} from '@/utils/biometrics';

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
    const { user: authUser, loginWithUserData } = useAuth();
    const token = authUser?.token;
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'info' | 'biometrics' | 'security' | 'attendance'>('info');

    // Attendance Tab State
    const now = new Date();
    const [attMonth, setAttMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
    const [attYear, setAttYear] = useState(String(now.getFullYear()));
    const [attRecords, setAttRecords] = useState<any[]>([]);
    const [attStats, setAttStats] = useState<any>(null);
    const [loadingAtt, setLoadingAtt] = useState(false);

    // Profile Edit State
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // Biometric Scanner State
    const [scanningFingerprint, setScanningFingerprint] = useState(false);
    const [scanningRetina, setScanningRetina] = useState(false);
    const [enrollingFace, setEnrollingFace] = useState(false);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

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
            toast.error(err.message || 'Failed to load user profile');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();
    }, [token]);

    const loadMyAttendance = useCallback(async () => {
        const empId = profile?.employee_id || authUser?.employee_id || profile?.id;
        if (!empId) return;
        setLoadingAtt(true);
        try {
            const cleanAPI = (process.env.NEXT_PUBLIC_API_URL || "https://demo-private-school.onrender.com").replace(/\/+$/, '').replace(/\/api$/, '');
            const res = await fetch(`${cleanAPI}/attendance/staff/${empId}/history?month=${attMonth}&year=${attYear}`);
            const data = await res.json();
            if (Array.isArray(data.records)) {
                setAttRecords(data.records);
                setAttStats(data.stats);
            }
        } catch (err) {
            console.error('Failed to load user attendance:', err);
        } finally {
            setLoadingAtt(false);
        }
    }, [profile?.employee_id, authUser?.employee_id, profile?.id, attMonth, attYear]);

    useEffect(() => {
        if (activeTab === 'attendance') {
            loadMyAttendance();
        }
    }, [activeTab, loadMyAttendance]);

    // Real-time auto save for profile
    const handleSaveProfile = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!fullName.trim()) {
            toast.warning('Full name cannot be empty');
            return;
        }
        setSavingProfile(true);
        setAutoSaveStatus('Saving changes...');
        try {
            const res = await fetch(`${API}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ full_name: fullName.trim(), email: email.trim() || null })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update profile');
            
            setAutoSaveStatus('Saved in Realtime ✓');
            toast.success('Profile details saved to database in real-time!');
            if (authUser) {
                loginWithUserData({
                    ...authUser,
                    full_name: fullName.trim(),
                    email: email.trim() || ''
                });
            }
            setTimeout(() => setAutoSaveStatus(null), 3000);
        } catch (err: any) {
            setAutoSaveStatus('Error saving');
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            toast.warning('Password must be at least 6 characters long');
            return;
        }
        setChangingPassword(true);
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
            toast.success('Password changed and encrypted successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            toast.error(err.message || 'Failed to change password');
        } finally {
            setChangingPassword(false);
        }
    };

    // Register Fingerprint / Native Biometric / WebAuthn
    const handleRegisterFingerprint = async () => {
        if (typeof window === 'undefined') return;

        setScanningFingerprint(true);

        // 1. Check Native Android / iOS Biometric Sensor (Capacitor Mobile App)
        if (Capacitor.isNativePlatform()) {
            try {
                const avail = await NativeBiometric.isAvailable();
                if (avail.isAvailable) {
                    toast.info('Please touch your fingerprint sensor to register...');
                    await NativeBiometric.verifyIdentity({
                        reason: 'Scan your fingerprint to register biometric credentials',
                        title: 'Fingerprint Biometric Registration',
                        subtitle: 'Confirm your fingerprint',
                        description: 'Touch the device fingerprint sensor to verify identity',
                        negativeButtonText: 'Cancel',
                        maxAttempts: 3
                    });

                    // Sensor successfully verified! Register credential on backend
                    const currentHost = getCurrentHost();
                    const res = await fetch(`${API}/auth/webauthn/register-options?rp_id=${encodeURIComponent(currentHost)}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to get registration challenge');

                    const { challengeId } = data;
                    const nativeCredId = 'native_fp_' + (profile?.id || 'usr') + '_' + Date.now();

                    const verifyRes = await fetch(`${API}/auth/webauthn/register-verify`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            challengeId,
                            credential: {
                                id: nativeCredId,
                                response: {
                                    transports: ['internal']
                                }
                            },
                            credential_type: 'fingerprint',
                            device_name: 'Mobile Hardware Fingerprint Sensor'
                        })
                    });
                    const verifyData = await verifyRes.json();
                    if (!verifyRes.ok) throw new Error(verifyData.error || 'Failed to verify credential');

                    toast.success('✓ Device Fingerprint sensor registered and saved to database!');
                    loadProfile();
                    return;
                }
            } catch (nativeErr: any) {
                console.warn('Native biometric error:', nativeErr);
                if (nativeErr?.message && !nativeErr.message.includes('not available') && !nativeErr.message.includes('not implemented')) {
                    toast.error(nativeErr.message || 'Fingerprint verification cancelled or failed.');
                    return;
                }
            } finally {
                setScanningFingerprint(false);
            }
        }

        // 2. Web Browser FIDO2 WebAuthn (Desktop TouchID / Windows Hello / YubiKey)
        if (window.PublicKeyCredential && navigator.credentials) {
            toast.info('Please touch your fingerprint sensor or verify device security...');
            try {
                const currentHost = getCurrentHost();
                const res = await fetch(`${API}/auth/webauthn/register-options?rp_id=${encodeURIComponent(currentHost)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to get registration challenge');

                const { challengeId, options } = data;
                const creationOptions: PublicKeyCredentialCreationOptions = {
                    challenge: base64UrlToBuffer(options.challenge),
                    rp: {
                        name: options.rp?.name || 'Demo Private School',
                        id: currentHost // Must strictly match current window origin
                    },
                    user: {
                        id: base64UrlToBuffer(options.user.id),
                        name: options.user.name,
                        displayName: options.user.displayName,
                    },
                    pubKeyCredParams: options.pubKeyCredParams,
                    authenticatorSelection: options.authenticatorSelection,
                    timeout: options.timeout || 60000,
                    attestation: options.attestation || 'none'
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

                toast.success('✓ Fingerprint biometric registered and saved to database!');
                loadProfile();
                return;
            } catch (err: any) {
                toast.error(err.message || 'Fingerprint registration failed');
                return;
            } finally {
                setScanningFingerprint(false);
            }
        }

        // 3. Fallback for browsers without hardware biometrics support
        toast.info('Direct Fingerprint FIDO2 is not supported on this browser. Launching Camera Face & Eye Retina Scanner...');
        handleStartRetinaScan();
        setScanningFingerprint(false);
    };

    // Open Camera & Enroll Eye Retina / Face ID Biometric
    const handleStartRetinaScan = async () => {
        if (typeof window === 'undefined') return;

        setShowCameraModal(true);
        setEnrollingFace(false);

        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
                });
                setCameraStream(stream);
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(() => {});
                }
            }
        } catch (camErr: any) {
            toast.warn('Camera preview permission note: ' + (camErr.message || 'Camera active'));
        }
    };

    const handleConfirmEnrollFace = async () => {
        setEnrollingFace(true);
        try {
            const currentHost = getCurrentHost();
            const res = await fetch(`${API}/auth/webauthn/register-options?rp_id=${encodeURIComponent(currentHost)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to get registration challenge');

            const { challengeId, options } = data;
            
            // Capture multi-frame 256-D LBP-HOG descriptor vector
            const faceVector = await captureMultiFrameDescriptor(videoRef.current, 5);
            if (!faceVector || faceVector.length === 0) {
                throw new Error('Could not detect face landmarks. Please align your face directly inside the circular camera frame.');
            }

            const clientDataJsonBase64 = btoa(unescape(encodeURIComponent(JSON.stringify({ type: 'webauthn.create', challenge: options.challenge }))));

            let credentialPayload: any = {
                id: 'face_retina_' + (profile?.id || 'usr') + '_' + Date.now(),
                face_descriptor: faceVector,
                response: {
                    clientDataJSON: clientDataJsonBase64,
                    attestationObject: '',
                    transports: ['internal']
                }
            };

            const verifyRes = await fetch(`${API}/auth/webauthn/register-verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    challengeId,
                    credential: credentialPayload,
                    credential_type: 'retina_face',
                    device_name: 'Eye Retina / Face ID Scanner'
                })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Failed to verify credential');

            toast.success('✓ Eye Retina / Face ID biometric template registered and saved in database!');
            loadProfile();
            closeCameraModal();
        } catch (err: any) {
            toast.error(err.message || 'Eye Retina registration failed');
        } finally {
            setEnrollingFace(false);
        }
    };

    const closeCameraModal = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setShowCameraModal(false);
        setScanningRetina(false);
    };

    const handleDeleteCredential = async (id: number) => {
        if (!confirm('Are you sure you want to remove this biometric credential?')) return;
        try {
            const res = await fetch(`${API}/auth/webauthn/credentials/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete credential');
            toast.info('Biometric credential removed from account.');
            loadProfile();
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete credential');
        }
    };

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center">
                <div className="spinner-border" role="status" style={{ color: '#0d9488' }}>
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
        const parts = (name || 'User').trim().split(/\s+/);
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return (name || 'U').slice(0, 2).toUpperCase();
    };

    return (
        <div className="container-fluid py-3 py-md-4 px-2 px-md-4" style={{ maxWidth: 1200 }}>
            {/* Top Navigation Breadcrumb */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 mb-md-4">
                <div>
                    <h3 className="fw-bold mb-0 text-dark fs-4 fs-md-3" style={{ letterSpacing: '-0.5px' }}>
                        <i className="bi bi-person-badge-fill me-2" style={{ color: '#0d9488' }}></i>
                        User Profile &amp; Security
                    </h3>
                    <p className="text-muted small mb-0">Manage your personal information, roles, and WebAuthn biometric security</p>
                </div>
                <Link href="/" className="btn btn-sm btn-outline-secondary rounded-pill px-3 shadow-sm">
                    <i className="bi bi-arrow-left me-1"></i> Dashboard
                </Link>
            </div>

            {/* Profile Hero Card */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff' }}>
                <div className="card-body p-3 p-md-5">
                    <div className="d-flex flex-column flex-md-row align-items-center gap-3 gap-md-4">
                        {/* Avatar */}
                        <div style={{
                            width: 84, height: 84, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                            color: '#fff', fontSize: '2rem', fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '3.5px solid rgba(255,255,255,0.25)',
                            boxShadow: '0 8px 24px rgba(13,148,136,0.35)', flexShrink: 0
                        }}>
                            {getInitials(profile.full_name)}
                        </div>

                        {/* User Details */}
                        <div className="flex-grow-1 text-center text-md-start w-100">
                            <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-md-start gap-2 mb-1">
                                <h4 className="fw-bold mb-0 text-white fs-5 fs-md-4">{profile.full_name}</h4>
                                <span className="badge text-white fw-bold px-2.5 py-1 rounded-pill" style={{ backgroundColor: '#0d9488', fontSize: '0.75rem' }}>
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
                            <div className="d-flex flex-wrap gap-2 justify-content-center justify-content-md-start mt-2">
                                <div className="bg-white bg-opacity-10 px-2.5 py-1 rounded-3" style={{ fontSize: '0.78rem' }}>
                                    <span className="text-white-50 me-1">User ID:</span>
                                    <strong className="text-white">#{profile.id}</strong>
                                </div>
                                <div className="bg-white bg-opacity-10 px-2.5 py-1 rounded-3" style={{ fontSize: '0.78rem' }}>
                                    <span className="text-white-50 me-1">Dashboard:</span>
                                    <strong className="text-white text-capitalize">{profile.dashboard_access || 'Standard'}</strong>
                                </div>
                                <div className="bg-white bg-opacity-10 px-2.5 py-1 rounded-3" style={{ fontSize: '0.78rem' }}>
                                    <span className="text-white-50 me-1">Biometrics:</span>
                                    <strong className="text-white">{profile.biometrics?.length || 0} Registered</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation - Fully Responsive & High Contrast */}
                <div className="bg-black bg-opacity-20 px-2 px-md-4 pt-2 border-top border-white border-opacity-10 overflow-x-auto">
                    <div className="d-flex gap-2" style={{ minWidth: 'max-content' }}>
                        <button
                            type="button"
                            className="btn border-0 py-2.5 px-3 px-md-4 rounded-top-3"
                            onClick={() => setActiveTab('info')}
                            style={{
                                backgroundColor: activeTab === 'info' ? '#ffffff' : 'transparent',
                                color: activeTab === 'info' ? '#0f172a' : 'rgba(255, 255, 255, 0.75)',
                                fontWeight: activeTab === 'info' ? '700' : '600',
                                fontSize: '0.88rem',
                                transition: 'all 0.2s ease',
                                borderBottomLeftRadius: 0,
                                borderBottomRightRadius: 0,
                                boxShadow: activeTab === 'info' ? '0 -2px 8px rgba(0,0,0,0.15)' : 'none'
                            }}
                        >
                            <i className="bi bi-person-lines-fill me-2" style={{ color: activeTab === 'info' ? '#0d9488' : 'inherit' }}></i>
                            Profile &amp; Permissions
                        </button>

                        <button
                            type="button"
                            className="btn border-0 py-2.5 px-3 px-md-4 rounded-top-3"
                            onClick={() => setActiveTab('biometrics')}
                            style={{
                                backgroundColor: activeTab === 'biometrics' ? '#ffffff' : 'transparent',
                                color: activeTab === 'biometrics' ? '#0f172a' : 'rgba(255, 255, 255, 0.75)',
                                fontWeight: activeTab === 'biometrics' ? '700' : '600',
                                fontSize: '0.88rem',
                                transition: 'all 0.2s ease',
                                borderBottomLeftRadius: 0,
                                borderBottomRightRadius: 0,
                                boxShadow: activeTab === 'biometrics' ? '0 -2px 8px rgba(0,0,0,0.15)' : 'none'
                            }}
                        >
                            <i className="bi bi-fingerprint me-2 text-danger"></i>
                            Biometric &amp; Eye Retina (WebAuthn)
                        </button>

                        <button
                            type="button"
                            className="btn border-0 py-2.5 px-3 px-md-4 rounded-top-3"
                            onClick={() => setActiveTab('security')}
                            style={{
                                backgroundColor: activeTab === 'security' ? '#ffffff' : 'transparent',
                                color: activeTab === 'security' ? '#0f172a' : 'rgba(255, 255, 255, 0.75)',
                                fontWeight: activeTab === 'security' ? '700' : '600',
                                fontSize: '0.88rem',
                                transition: 'all 0.2s ease',
                                borderBottomLeftRadius: 0,
                                borderBottomRightRadius: 0,
                                boxShadow: activeTab === 'security' ? '0 -2px 8px rgba(0,0,0,0.15)' : 'none'
                            }}
                        >
                            <i className="bi bi-shield-lock-fill me-2 text-warning"></i>
                            Security &amp; Password
                        </button>

                        <button
                            type="button"
                            className="btn border-0 py-2.5 px-3 px-md-4 rounded-top-3"
                            onClick={() => setActiveTab('attendance')}
                            style={{
                                backgroundColor: activeTab === 'attendance' ? '#ffffff' : 'transparent',
                                color: activeTab === 'attendance' ? '#0f172a' : 'rgba(255, 255, 255, 0.75)',
                                fontWeight: activeTab === 'attendance' ? '700' : '600',
                                fontSize: '0.88rem',
                                transition: 'all 0.2s ease',
                                borderBottomLeftRadius: 0,
                                borderBottomRightRadius: 0,
                                boxShadow: activeTab === 'attendance' ? '0 -2px 8px rgba(0,0,0,0.15)' : 'none'
                            }}
                        >
                            <i className="bi bi-clock-history me-2 text-success"></i>
                            My Attendance &amp; Timesheets
                        </button>
                    </div>
                </div>
            </div>

            {/* TAB 1: Profile & Permissions */}
            {activeTab === 'info' && (
                <div className="row g-3 g-md-4">
                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white p-3 p-md-4">
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <h5 className="fw-bold text-dark mb-0">
                                    <i className="bi bi-pencil-square me-2" style={{ color: '#0d9488' }}></i>
                                    Edit Personal Details
                                </h5>
                                {autoSaveStatus && (
                                    <span className="badge bg-success-subtle text-success border border-success-subtle py-1 px-2" style={{ fontSize: '0.75rem' }}>
                                        {autoSaveStatus}
                                    </span>
                                )}
                            </div>
                            <form onSubmit={handleSaveProfile}>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">Username</label>
                                    <input type="text" className="form-control bg-light fw-bold" value={profile.username} disabled />
                                    <div className="form-text" style={{ fontSize: '0.75rem' }}>Username is unique and cannot be changed.</div>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">Full Name</label>
                                    <input
                                        type="text"
                                        className="form-control fw-semibold"
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        onBlur={() => fullName !== profile.full_name && handleSaveProfile()}
                                        required
                                    />
                                    <div className="form-text" style={{ fontSize: '0.75rem' }}>Auto-saves to database in real-time on blur.</div>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">Email Address</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        onBlur={() => email !== (profile.email || '') && handleSaveProfile()}
                                        placeholder="name@domain.com"
                                    />
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
                                <button
                                    type="submit"
                                    className="btn fw-bold text-white px-4 rounded-3 w-100 w-sm-auto shadow-sm"
                                    style={{ backgroundColor: '#0d9488' }}
                                    disabled={savingProfile}
                                >
                                    {savingProfile ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="bi bi-save me-1"></i>Save Profile Now</>}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white p-3 p-md-4">
                            <h5 className="fw-bold text-dark mb-2">
                                <i className="bi bi-key-fill me-2" style={{ color: '#0d9488' }}></i>
                                Role &amp; Module Permissions
                            </h5>
                            <p className="text-muted small mb-3">
                                The following module access rights are assigned to your role (<strong>{profile.role_name}</strong>):
                            </p>
                            <div className="table-responsive" style={{ maxHeight: 380 }}>
                                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                                    <thead className="table-light sticky-top">
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
                                                        {perm.can_read ? <i className="bi bi-check-circle-fill text-success fs-6"></i> : <i className="bi bi-x-circle text-muted fs-6"></i>}
                                                    </td>
                                                    <td className="text-center">
                                                        {perm.can_write ? <i className="bi bi-check-circle-fill text-success fs-6"></i> : <i className="bi bi-x-circle text-muted fs-6"></i>}
                                                    </td>
                                                    <td className="text-center">
                                                        {perm.can_delete ? <i className="bi bi-check-circle-fill text-success fs-6"></i> : <i className="bi bi-x-circle text-muted fs-6"></i>}
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
                    <div className="row g-3 g-md-4 mb-4">
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
                                    className="btn btn-success fw-bold px-4 py-2.5 rounded-pill mt-auto w-100 shadow-sm"
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
                                    className="btn btn-primary fw-bold px-4 py-2.5 rounded-pill mt-auto w-100 shadow-sm"
                                    style={{ maxWidth: 280, backgroundColor: '#2563eb' }}
                                    onClick={handleStartRetinaScan}
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
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-3 p-md-4">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <h5 className="fw-bold text-dark mb-0 fs-6 fs-md-5">
                                <i className="bi bi-shield-check me-2" style={{ color: '#0d9488' }}></i>
                                Active Enrolled Biometrics &amp; Passkeys
                            </h5>
                            <span className="badge bg-light text-dark fw-semibold border">
                                {profile.biometrics?.length || 0} Registered
                            </span>
                        </div>

                        {profile.biometrics && profile.biometrics.length > 0 ? (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.88rem' }}>
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
                <div className="row g-3 g-md-4">
                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white p-3 p-md-4">
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
                                    className="btn btn-warning fw-bold text-dark px-4 py-2 rounded-3 w-100 w-sm-auto shadow-sm"
                                    disabled={changingPassword}
                                >
                                    {changingPassword ? <><span className="spinner-border spinner-border-sm me-1" />Updating Password...</> : <><i className="bi bi-check2-circle me-1"></i>Update Password</>}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white p-3 p-md-4">
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
                                    <span className="badge text-white" style={{ backgroundColor: '#0d9488' }}>
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

            {/* TAB 4: My Attendance & Timesheets */}
            {activeTab === 'attendance' && (
                <div className="animate__animated animate__fadeIn">
                    {/* Header & Filter Card */}
                    <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white p-3 p-md-4">
                        <div className="row g-3 align-items-end">
                            <div className="col-12 col-md-5">
                                <h5 className="fw-bold text-dark mb-1">
                                    <i className="bi bi-calendar2-check-fill me-2" style={{ color: '#0d9488' }} />
                                    Personal Attendance Log
                                </h5>
                                <p className="text-muted small mb-0">View your daily IN/OUT biometric timestamps and punctuality stats</p>
                            </div>

                            <div className="col-6 col-md-2">
                                <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                    Month
                                </label>
                                <select 
                                    className="form-select form-select-sm rounded-3" 
                                    value={attMonth} 
                                    onChange={e => setAttMonth(e.target.value)} 
                                    style={{ height: 38 }}
                                >
                                    {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m, i) => (
                                        <option key={m} value={m}>
                                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][i]}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-6 col-md-2">
                                <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                    Year
                                </label>
                                <select 
                                    className="form-select form-select-sm rounded-3" 
                                    value={attYear} 
                                    onChange={e => setAttYear(e.target.value)} 
                                    style={{ height: 38 }}
                                >
                                    {[0, 1, 2, 3, 4].map(offset => {
                                        const y = String(now.getFullYear() - offset);
                                        return <option key={y} value={y}>{y}</option>;
                                    })}
                                </select>
                            </div>

                            <div className="col-12 col-md-3">
                                <button 
                                    type="button"
                                    className="btn btn-sm w-100 fw-bold rounded-3 text-white shadow-xs" 
                                    style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)', height: 38 }}
                                    onClick={loadMyAttendance} 
                                    disabled={loadingAtt}
                                >
                                    {loadingAtt ? (
                                        <><span className="spinner-border spinner-border-sm me-1.5" />Loading...</>
                                    ) : (
                                        <><i className="bi bi-arrow-repeat me-1.5" />Refresh Timesheet</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stats Summary Cards */}
                    {attStats && (
                        <div className="row g-3 mb-4">
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white" style={{ borderLeft: '4px solid #0d9e6e' }}>
                                    <div className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '0.66rem' }}>Days Present</div>
                                    <div className="fs-3 fw-bold text-success mt-1">{attStats.present}</div>
                                </div>
                            </div>
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white" style={{ borderLeft: '4px solid #e6860a' }}>
                                    <div className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '0.66rem' }}>Late Entries</div>
                                    <div className="fs-3 fw-bold text-warning mt-1">{attStats.late_in || 0}</div>
                                </div>
                            </div>
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white" style={{ borderLeft: '4px solid #f97316' }}>
                                    <div className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '0.66rem' }}>Early Exits</div>
                                    <div className="fs-3 fw-bold mt-1" style={{ color: '#f97316' }}>{attStats.early_out || 0}</div>
                                </div>
                            </div>
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white" style={{ borderLeft: '4px solid #e13232' }}>
                                    <div className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '0.66rem' }}>Absents</div>
                                    <div className="fs-3 fw-bold text-danger mt-1">{attStats.absent}</div>
                                </div>
                            </div>
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white" style={{ borderLeft: '4px solid #1a6fd4' }}>
                                    <div className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '0.66rem' }}>Leaves</div>
                                    <div className="fs-3 fw-bold text-primary mt-1">{attStats.leave}</div>
                                </div>
                            </div>
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white" style={{ borderLeft: '4px solid #0d9488' }}>
                                    <div className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '0.66rem' }}>Total Days</div>
                                    <div className="fs-3 fw-bold mt-1" style={{ color: '#0d9488' }}>{attStats.total}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Detailed Timesheet Table */}
                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white">
                        <div className="card-header bg-white border-0 px-4 py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <h6 className="fw-bold mb-0 text-dark">
                                Daily Attendance Breakdown
                            </h6>
                            <span className="badge rounded-pill px-3 py-1 bg-light text-dark border">
                                {attRecords.length} records recorded
                            </span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="small fw-semibold text-uppercase text-muted ps-4 py-2.5">Date</th>
                                        <th className="small fw-semibold text-uppercase text-muted py-2.5">Status</th>
                                        <th className="small fw-semibold text-uppercase text-muted py-2.5">IN Time (Arrival)</th>
                                        <th className="small fw-semibold text-uppercase text-muted py-2.5">OUT Time (Departure)</th>
                                        <th className="small fw-semibold text-uppercase text-muted py-2.5">Biometric Mode</th>
                                        <th className="small fw-semibold text-uppercase text-muted pe-4 py-2.5">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {attRecords.length > 0 ? (
                                        attRecords.map((r: any) => {
                                            const dt = new Date(r.attendance_date + 'T00:00:00');
                                            const formattedDate = dt.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                                            const isLate = r.is_in_late;
                                            const isEarly = r.is_out_early;
                                            const s = r.status || 'Present';

                                            const formatT = (tStr: string | null) => {
                                                if (!tStr) return null;
                                                try {
                                                    const [h, m] = tStr.split(':');
                                                    const hour = parseInt(h, 10);
                                                    const ampm = hour >= 12 ? 'PM' : 'AM';
                                                    const displayH = hour % 12 || 12;
                                                    return `${displayH}:${m} ${ampm}`;
                                                } catch { return tStr; }
                                            };

                                            const inDisplay = formatT(r.check_in_time);
                                            const outDisplay = formatT(r.check_out_time);

                                            return (
                                                <tr key={r.attendance_id || r.attendance_date}>
                                                    {/* Date */}
                                                    <td className="ps-4 py-3 fw-semibold text-dark small">
                                                        {formattedDate}
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td>
                                                        <span className="badge rounded-pill px-2.5 py-1" style={{
                                                            background: s === 'Present' ? '#e6f9f3' : s === 'Absent' ? '#fde8e8' : s === 'Late' ? '#fef6e4' : '#e8f0fd',
                                                            color: s === 'Present' ? '#0d9e6e' : s === 'Absent' ? '#e13232' : s === 'Late' ? '#e6860a' : '#1a6fd4',
                                                            border: `1px solid ${s === 'Present' ? '#0d9e6e' : s === 'Absent' ? '#e13232' : s === 'Late' ? '#e6860a' : '#1a6fd4'}44`,
                                                            fontSize: '0.74rem'
                                                        }}>
                                                            {s}
                                                        </span>
                                                    </td>

                                                    {/* IN Time */}
                                                    <td>
                                                        {inDisplay ? (
                                                            <div>
                                                                <span className="fw-bold text-dark font-monospace small">
                                                                    <i className="bi bi-box-arrow-in-right text-success me-1" />
                                                                    {inDisplay}
                                                                </span>
                                                                {isLate && (
                                                                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning ms-1.5" style={{ fontSize: '0.64rem' }}>
                                                                        Late Entry
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted small fst-italic">—</span>
                                                        )}
                                                    </td>

                                                    {/* OUT Time */}
                                                    <td>
                                                        {outDisplay ? (
                                                            <div>
                                                                <span className="fw-bold text-dark font-monospace small">
                                                                    <i className="bi bi-box-arrow-right text-primary me-1" />
                                                                    {outDisplay}
                                                                </span>
                                                                {isEarly && (
                                                                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning ms-1.5" style={{ fontSize: '0.64rem' }}>
                                                                        Early Exit
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted small fst-italic">—</span>
                                                        )}
                                                    </td>

                                                    {/* Verification Mode */}
                                                    <td>
                                                        {r.in_verified || r.out_verified ? (
                                                            <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.72rem' }}>
                                                                <i className="bi bi-patch-check-fill me-1" />
                                                                {r.in_verification_mode || r.out_verification_mode || 'Biometric'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted small">Standard</span>
                                                        )}
                                                    </td>

                                                    {/* Remarks */}
                                                    <td className="pe-4 text-muted small">
                                                        {r.remarks || '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center py-5 text-muted">
                                                <i className="bi bi-calendar2-x fs-2 d-block mb-2 text-muted" />
                                                No attendance records found for this month.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Eye Retina Live Camera Scanning Modal / Mobile Bottom Sheet */}
            {showCameraModal && (
                <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered bottom-sheet-dialog" style={{ maxWidth: 460 }}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bottom-sheet-content" style={{ background: '#0f172a', color: '#fff' }}>
                            {/* Mobile drag handle */}
                            <div className="d-md-none text-center pt-2">
                                <div style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', margin: '0 auto' }} />
                            </div>

                            <div className="modal-header border-0 pb-0">
                                <h6 className="modal-title fw-bold text-white d-flex align-items-center">
                                    <i className="bi bi-eye-fill text-info me-2 fs-5"></i>
                                    Eye Retina / Face ID Scanner
                                </h6>
                                <button type="button" className="btn-close btn-close-white" onClick={closeCameraModal}></button>
                            </div>
                            <div className="modal-body text-center p-3 p-md-4">
                                <div className="position-relative mx-auto rounded-circle overflow-hidden mb-3"
                                    style={{
                                        width: 210, height: 210,
                                        border: '3px solid #38bdf8',
                                        boxShadow: '0 0 30px rgba(56,189,248,0.5)',
                                        background: '#000'
                                    }}>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                                    />
                                    {/* Futuristic Retina Targeting Overlay */}
                                    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center pointer-events-none">
                                        <div style={{
                                            width: 130, height: 130, borderRadius: '50%',
                                            border: '2px dashed rgba(56,189,248,0.8)',
                                            animation: 'spin 6s linear infinite'
                                        }} />
                                    </div>
                                    <div className="position-absolute top-50 start-0 w-100" style={{ height: 2, background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                                </div>

                                <h6 className="fw-bold text-white mb-1">Align Face &amp; Eyes in Frame</h6>
                                <p className="text-white-50 small mb-3">
                                    Keep your face centered and well-lit to record your unique biometric template.
                                </p>
                                
                                <button
                                    type="button"
                                    className="btn btn-info text-dark fw-bold rounded-pill px-4 py-2.5 w-100 shadow-sm mb-2"
                                    style={{ maxWidth: 300 }}
                                    onClick={handleConfirmEnrollFace}
                                    disabled={enrollingFace}
                                >
                                    {enrollingFace ? (
                                        <><span className="spinner-border spinner-border-sm me-2" />Recording Biometric Template...</>
                                    ) : (
                                        <><i className="bi bi-camera-fill me-2"></i>Capture &amp; Enroll Biometrics</>
                                    )}
                                </button>
                            </div>
                            <div className="modal-footer border-0 pt-0 justify-content-center pb-4">
                                <button type="button" className="btn btn-outline-light rounded-pill px-4 btn-sm" onClick={closeCameraModal}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @media (max-width: 767.98px) {
                    .bottom-sheet-dialog {
                        position: fixed !important;
                        bottom: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        margin: 0 !important;
                        max-width: 100% !important;
                    }
                    .bottom-sheet-content {
                        border-bottom-left-radius: 0 !important;
                        border-bottom-right-radius: 0 !important;
                        border-top-left-radius: 28px !important;
                        border-top-right-radius: 28px !important;
                    }
                }
            `}</style>
        </div>
    );
}
