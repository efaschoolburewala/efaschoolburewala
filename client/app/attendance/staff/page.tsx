'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notify } from '@/app/utils/notify';
import { captureMultiFrameDescriptor } from '@/utils/biometrics';

interface Department {
    department_id: number;
    department_name: string;
}

interface StaffRow {
    employee_id: number;
    first_name: string;
    last_name: string;
    designation: string;
    department_name: string;
    department_id: number;
    app_user_id?: number | null;
    attendance_id: number | null;
    status: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    in_verified: boolean;
    out_verified: boolean;
    in_verification_mode?: string | null;
    out_verification_mode?: string | null;
    is_in_late: boolean;
    is_out_early: boolean;
    enrolled_biometrics_count?: number;
}

interface HolidayInfo {
    is_holiday: boolean;
    id: number;
    title: string;
    holiday_type: string;
    description: string | null;
}

interface AttendanceSettings {
    staff_in_time: string;
    staff_out_time: string;
    staff_grace_minutes: number;
    staff_biometric_mode: 'fingerprint' | 'facial_retina' | 'both';
}

const STATUS_OPTS = ['Present', 'Absent', 'Late', 'Leave'] as const;
type StatusType = typeof STATUS_OPTS[number];

const S_COLOR: Record<StatusType | 'Holiday', string> = {
    Present: '#0d9e6e',
    Absent: '#e13232',
    Late: '#e6860a',
    Leave: '#1a6fd4',
    Holiday: '#7c3aed'
};

const S_BG: Record<StatusType | 'Holiday', string> = {
    Present: '#e6f9f3',
    Absent: '#fde8e8',
    Late: '#fef6e4',
    Leave: '#e8f0fd',
    Holiday: '#f3e8ff'
};

const S_ICON: Record<StatusType | 'Holiday', string> = {
    Present: 'bi-check-circle-fill',
    Absent: 'bi-x-circle-fill',
    Late: 'bi-clock-fill',
    Leave: 'bi-calendar2-x-fill',
    Holiday: 'bi-calendar-heart-fill'
};

export default function StaffAttendancePage() {
    const today = new Date().toISOString().split('T')[0];
    const [departments, setDepartments] = useState<Department[]>([]);
    const [deptId, setDeptId] = useState('');
    const [date, setDate] = useState(today);
    const [sessionType, setSessionType] = useState<'in' | 'out'>('in');

    const [staff, setStaff] = useState<StaffRow[]>([]);
    const [statuses, setStatuses] = useState<Record<number, StatusType>>({});
    const [lockedIds, setLockedIds] = useState<Set<number>>(new Set());
    const [holidayInfo, setHolidayInfo] = useState<HolidayInfo | null>(null);
    const [settings, setSettings] = useState<AttendanceSettings>({
        staff_in_time: '08:00',
        staff_out_time: '14:00',
        staff_grace_minutes: 15,
        staff_biometric_mode: 'both'
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Biometric Modal State
    const [verifyingMember, setVerifyingMember] = useState<StaffRow | null>(null);
    const [scanMode, setScanMode] = useState<'fingerprint' | 'retina_face'>('fingerprint');
    const [scanningInProgress, setScanningInProgress] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const { hasPermission, user } = useAuth();
    const isAdmin = (user?.role_level || 0) >= 90;
    const canEditLocked = isAdmin || hasPermission('attendance.edit_locked', 'write') || (user?.role_level || 0) >= 70;
    const canMarkAdvance = isAdmin || hasPermission('attendance.mark_advance', 'write');

    const API = (process.env.NEXT_PUBLIC_API_URL || "https://demo-private-school.onrender.com").replace(/\/+$/, '').replace(/\/api$/, '');

    // 1. Initial Load of Departments & Settings
    useEffect(() => {
        fetch(`${API}/attendance/departments`)
            .then(r => r.json())
            .then(d => Array.isArray(d) && setDepartments(d))
            .catch(() => { });

        fetch(`${API}/attendance/settings`)
            .then(r => r.json())
            .then(d => {
                if (d.settings) {
                    setSettings({
                        staff_in_time: d.settings.staff_in_time || '08:00',
                        staff_out_time: d.settings.staff_out_time || '14:00',
                        staff_grace_minutes: Number(d.settings.staff_grace_minutes) || 15,
                        staff_biometric_mode: d.settings.staff_biometric_mode || 'both'
                    });
                }
            })
            .catch(() => { });
    }, [API]);

    // 2. Load Attendance Records
    const loadAttendance = useCallback(async () => {
        if (!date) return;
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                date,
                session_type: sessionType
            });
            if (deptId) queryParams.append('department_id', deptId);

            const res = await fetch(`${API}/attendance/staff/daily?${queryParams.toString()}`);
            const data = await res.json();
            const records: StaffRow[] = Array.isArray(data.records) ? data.records : (Array.isArray(data) ? data : []);
            const hol: HolidayInfo | null = data.holiday || null;

            if (data.settings) {
                setSettings({
                    staff_in_time: data.settings.staff_in_time || '08:00',
                    staff_out_time: data.settings.staff_out_time || '14:00',
                    staff_grace_minutes: Number(data.settings.staff_grace_minutes) || 15,
                    staff_biometric_mode: data.settings.staff_biometric_mode || 'both'
                });
            }

            setHolidayInfo(hol);
            setStaff(records);

            const st: Record<number, StatusType> = {};
            const locked = new Set<number>();

            records.forEach((e: StaffRow) => {
                st[e.employee_id] = (e.status as StatusType) || 'Present';

                // If this session is already verified or locked
                const isSessionVerified = sessionType === 'in'
                    ? (e.in_verified || (e.attendance_id !== null && e.status === 'Absent'))
                    : (e.out_verified || (e.attendance_id !== null && e.status === 'Absent'));

                if (isSessionVerified || hol?.is_holiday) {
                    locked.add(e.employee_id);
                }
            });

            setStatuses(st);
            setLockedIds(locked);

            // Cache to localStorage for session safety
            try {
                localStorage.setItem(`staff_att_${date}_${sessionType}`, JSON.stringify({
                    records,
                    timestamp: new Date().toISOString()
                }));
            } catch { }

        } catch (err) {
            console.error('Failed to load attendance:', err);
            notify.error('Server error loading attendance');
        } finally {
            setLoading(false);
        }
    }, [API, date, deptId, sessionType]);

    // Auto-load on filter change
    useEffect(() => {
        loadAttendance();
    }, [loadAttendance]);

    // Toggle Lock for a single row (Admin Override)
    const toggleLock = (id: number) => {
        if (!canEditLocked && lockedIds.has(id)) {
            notify.warning('Only administrators & supervisors can unlock verified records.');
            return;
        }
        setLockedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                notify.warning('Row unlocked for editing.');
            } else {
                next.add(id);
                notify.success('Row locked.');
            }
            return next;
        });
    };

    // Mark all UNLOCKED rows with a status
    const markAll = (status: StatusType) => {
        setStatuses(prev => {
            const next = { ...prev };
            staff.forEach(e => {
                if (!lockedIds.has(e.employee_id)) {
                    next[e.employee_id] = status;
                }
            });
            return next;
        });
    };

    // Stop camera stream cleanly
    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
    };

    // Open Biometric Verification Modal
    const handleOpenVerification = (member: StaffRow) => {
        if (holidayInfo?.is_holiday) {
            notify.warning('Today is marked as an official holiday.');
            return;
        }
        setVerifyingMember(member);
        const preferredMode = settings.staff_biometric_mode === 'facial_retina' ? 'retina_face' : 'fingerprint';
        setScanMode(preferredMode);
        setScanningInProgress(false);
        setScanProgress(0);
        // Always start camera both fingerprint & retina_face use camera-based descriptor
        startCamera();
    };

    const startCamera = async () => {
        try {
            stopCamera();
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
            });
            setCameraStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error('Camera access error:', err);
            // Don't switch mode just notify. Both modes need camera.
            notify.error('Camera access denied. Please grant camera permission in your browser settings and try again.');
        }
    };

    useEffect(() => {
        // Always start camera for biometric verification (both modes use camera-based descriptors)
        if (verifyingMember) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [verifyingMember]);

    // Perform Live Real-Time Biometric Verification & Save to Database
    const executeBiometricVerification = async () => {
        if (!verifyingMember) return;
        setScanningInProgress(true);
        setScanProgress(10);

        try {
            let biometricDescriptor: number[] | null = null;

            // Always capture a camera-based LBP+HOG descriptor for all biometric modes.
            // For 'fingerprint' mode: uses the same visual descriptor but matched against
            // user_webauthn_credentials WHERE credential_type = 'fingerprint' in the DB.
            // For 'retina_face' mode: matched against credential_type = 'retina_face'.
            setScanProgress(30);
            if (videoRef.current) {
                biometricDescriptor = await captureMultiFrameDescriptor(videoRef.current, 2);
            }

            if (!biometricDescriptor || biometricDescriptor.length === 0) {
                throw new Error('Could not capture biometric data. Ensure your face is clearly visible in the camera and try again.');
            }

            setScanProgress(60);

            // Call Backend Real-Time Verification Endpoint with timeout guard
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            let res: Response;
            try {
                res = await fetch(`${API}/attendance/staff/verify-biometric`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        employee_id: verifyingMember.employee_id,
                        date,
                        session_type: sessionType,
                        verification_mode: scanMode,
                        biometric_data: biometricDescriptor,
                        user_id: user?.id,
                        manual_override: false
                    })
                });
            } catch (fetchErr: any) {
                if (fetchErr.name === 'AbortError') {
                    throw new Error('Verification request timed out. Please check your network and try again.');
                }
                throw fetchErr;
            } finally {
                clearTimeout(timeoutId);
            }

            setScanProgress(85);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Biometric verification failed.');
            }

            setScanProgress(100);

            // Update row in state
            const updatedRec: StaffRow = {
                ...verifyingMember,
                status: data.record.status || 'Present',
                check_in_time: data.record.check_in_time || verifyingMember.check_in_time,
                check_out_time: data.record.check_out_time || verifyingMember.check_out_time,
                in_verified: data.record.in_verified || (sessionType === 'in'),
                out_verified: data.record.out_verified || (sessionType === 'out'),
                is_in_late: data.record.is_in_late ?? data.is_in_late,
                is_out_early: data.record.is_out_early ?? data.is_out_early,
                attendance_id: data.record.attendance_id
            };

            setStaff(prev => prev.map(m => m.employee_id === verifyingMember.employee_id ? updatedRec : m));
            setStatuses(prev => ({ ...prev, [verifyingMember.employee_id]: (data.record.status as StatusType) || 'Present' }));

            // Auto Lock Row on Successful Verification
            setLockedIds(prev => new Set(prev).add(verifyingMember.employee_id));

            notify.success(
                `✓ ${verifyingMember.first_name} verified for ${sessionType.toUpperCase()} at ${data.time || 'now'}!`
            );

            stopCamera();
            setVerifyingMember(null);

        } catch (err: any) {
            console.error('Verification error:', err);
            notify.error(err.message || 'Verification failed. Please scan again.');
        } finally {
            setScanningInProgress(false);
        }
    };

    // Fast Admin Override Verification (Instant Verified Mark)
    const handleInstantAdminVerify = async (member: StaffRow) => {
        if (!canEditLocked) {
            notify.warning('Administrative permission required for direct override.');
            return;
        }

        try {
            const res = await fetch(`${API}/attendance/staff/verify-biometric`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: member.employee_id,
                    date,
                    session_type: sessionType,
                    verification_mode: 'manual',
                    manual_override: true,
                    status_override: 'Present',
                    user_id: user?.id
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to verify');

            setStaff(prev => prev.map(m => m.employee_id === member.employee_id ? {
                ...m,
                status: 'Present',
                check_in_time: data.record.check_in_time || m.check_in_time,
                check_out_time: data.record.check_out_time || m.check_out_time,
                in_verified: sessionType === 'in' ? true : m.in_verified,
                out_verified: sessionType === 'out' ? true : m.out_verified,
                is_in_late: data.record.is_in_late,
                is_out_early: data.record.is_out_early,
                attendance_id: data.record.attendance_id
            } : m));

            setStatuses(prev => ({ ...prev, [member.employee_id]: 'Present' }));
            setLockedIds(prev => new Set(prev).add(member.employee_id));
            notify.success(`✓ Marked & locked as Verified Present for ${member.first_name}`);
        } catch (err: any) {
            notify.error(err.message || 'Verification override failed');
        }
    };

    // Bulk Save Attendance for remaining unverified staff (Mark Absent / Leave / Save)
    const saveAttendance = async () => {
        if (!date || !staff.length) return;
        setSaving(true);
        try {
            const records = staff.map(e => ({
                employee_id: e.employee_id,
                status: statuses[e.employee_id] || 'Present',
                check_in_time: e.check_in_time || (statuses[e.employee_id] === 'Present' ? settings.staff_in_time : null),
                check_out_time: e.check_out_time || (statuses[e.employee_id] === 'Present' ? settings.staff_out_time : null),
                in_verified: e.in_verified || (sessionType === 'in' && statuses[e.employee_id] === 'Present'),
                out_verified: e.out_verified || (sessionType === 'out' && statuses[e.employee_id] === 'Present')
            }));

            const res = await fetch(`${API}/attendance/staff/daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    records,
                    session_type: sessionType,
                    user_id: user?.id
                })
            });

            const d = await res.json();
            if (res.ok) {
                // Lock all saved rows
                setLockedIds(new Set(staff.map(e => e.employee_id)));
                notify.success(`Attendance saved successfully for ${records.length} staff members!`);
            } else {
                notify.error(d.error || 'Save failed');
            }
        } catch {
            notify.error('Server error saving attendance');
        } finally {
            setSaving(false);
        }
    };

    // Filter by search query
    const filteredStaff = staff.filter(e =>
        `${e.first_name} ${e.last_name} ${e.designation} ${e.department_name}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
    );

    // Grouping by department
    const groups = filteredStaff.reduce((acc, e) => {
        const key = e.department_name || 'General Staff';
        if (!acc[key]) acc[key] = [];
        acc[key].push(e);
        return acc;
    }, {} as Record<string, StaffRow[]>);

    const counts = STATUS_OPTS.reduce((a, s) => {
        a[s] = staff.filter(e => (statuses[e.employee_id] || 'Present') === s).length;
        return a;
    }, {} as Record<string, number>);

    const total = staff.length;
    const verifiedCount = staff.filter(e => sessionType === 'in' ? e.in_verified : e.out_verified).length;
    const pct = total ? Math.round((verifiedCount / total) * 100) : 0;
    const unlockedCount = staff.filter(e => !lockedIds.has(e.employee_id)).length;

    const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-PK', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const formatTimeDisplay = (timeStr: string | null) => {
        if (!timeStr) return null;
        try {
            const [h, m] = timeStr.split(':');
            const hour = parseInt(h, 10);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayH = hour % 12 || 12;
            return `${displayH}:${m} ${ampm}`;
        } catch {
            return timeStr;
        }
    };

    return (
        <div className="container-fluid px-3 px-md-4 py-3 animate__animated animate__fadeIn">

            {/* HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-fingerprint me-2" style={{ color: 'var(--accent-orange)' }} />
                        Staff Biometric Attendance
                    </h2>
                    <p className="text-muted mb-0 small">
                        Real-time IN/OUT biometrics verification, automated locking, and admin controls
                    </p>
                </div>

                {/* Bulk Status Action Buttons for Unlocked */}
                {unlockedCount > 0 && !holidayInfo?.is_holiday && (
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                        <span className="text-muted small fw-semibold me-1 d-none d-md-inline">Quick Mark:</span>
                        {STATUS_OPTS.map(s => (
                            <button
                                key={s}
                                onClick={() => markAll(s)}
                                className="btn btn-sm fw-semibold shadow-xs"
                                style={{
                                    background: S_BG[s],
                                    border: `1.5px solid ${S_COLOR[s]}`,
                                    color: S_COLOR[s],
                                    borderRadius: 8,
                                    fontSize: '0.78rem'
                                }}
                            >
                                <i className={`bi ${S_ICON[s]} me-1`} />
                                All {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* FILTER CONTROLS */}
            <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body p-3 p-md-4">
                    <div className="row g-3 align-items-end">

                        {/* 1. IN / OUT Attendance Session Dropdown */}
                        <div className="col-12 col-md-3">
                            <label className="form-label fw-bold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                <i className="bi bi-arrow-left-right me-1" style={{ color: 'var(--accent-orange)' }} />
                                Attendance Session
                            </label>
                            <select
                                className="form-select rounded-3 fw-bold"
                                value={sessionType}
                                onChange={e => setSessionType(e.target.value as 'in' | 'out')}
                                style={{
                                    border: '2px solid var(--accent-orange)',
                                    background: sessionType === 'in' ? '#f0fdf4' : '#fff7ed',
                                    color: 'var(--primary-dark)',
                                    height: 44
                                }}
                            >
                                <option value="in">🟢 IN Attendance (Arrival - Morning)</option>
                                <option value="out">🔴 OUT Attendance (Departure - Afternoon)</option>
                            </select>
                        </div>

                        {/* 2. Department Filter */}
                        <div className="col-12 col-md-3">
                            <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                <i className="bi bi-building me-1" style={{ color: 'var(--primary-teal)' }} />
                                Department
                            </label>
                            <select
                                className="form-select rounded-3"
                                value={deptId}
                                onChange={e => setDeptId(e.target.value)}
                                style={{ border: '1.5px solid #dee2e6', height: 44 }}
                            >
                                <option value="">All Departments</option>
                                {departments.map(d => (
                                    <option key={d.department_id} value={d.department_id}>
                                        {d.department_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 3. Date Picker */}
                        <div className="col-12 col-md-3">
                            <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                <i className="bi bi-calendar3 me-1" style={{ color: 'var(--primary-teal)' }} />
                                Date
                            </label>
                            <input
                                type="date"
                                className="form-control rounded-3"
                                value={date}
                                max={canMarkAdvance ? undefined : today}
                                onChange={e => setDate(e.target.value)}
                                style={{ border: '1.5px solid #dee2e6', height: 44 }}
                            />
                        </div>

                        {/* 4. Search & Reload */}
                        <div className="col-12 col-md-3 d-flex gap-2">
                            <button
                                className="btn btn-primary-custom w-100 fw-bold rounded-3"
                                style={{ height: 44 }}
                                onClick={loadAttendance}
                                disabled={loading}
                            >
                                {loading ? (
                                    <><span className="spinner-border spinner-border-sm me-2" />Loading...</>
                                ) : (
                                    <><i className="bi bi-arrow-repeat me-2" />Load</>
                                )}
                            </button>
                        </div>

                    </div>

                    {/* Policy Alert Badge */}
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3 pt-3 border-top">
                        <div className="small text-muted d-flex align-items-center gap-3 flex-wrap">
                            <span>
                                <i className="bi bi-clock-history text-primary me-1" />
                                Shift: <strong>{formatTimeDisplay(settings.staff_in_time)}</strong> to <strong>{formatTimeDisplay(settings.staff_out_time)}</strong>
                            </span>
                            <span>
                                <i className="bi bi-shield-check text-success me-1" />
                                Grace Period: <strong>{settings.staff_grace_minutes} mins</strong>
                            </span>
                            <span>
                                <i className="bi bi-cpu text-info me-1" />
                                Biometric Mode: <strong className="text-uppercase">{settings.staff_biometric_mode}</strong>
                            </span>
                        </div>
                        <div style={{ maxWidth: 260, width: '100%' }}>
                            <input
                                type="text"
                                placeholder="Search staff name or role..."
                                className="form-control form-control-sm rounded-pill px-3"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* HOLIDAY ALERT */}
            {holidayInfo?.is_holiday && (
                <div className="card border-0 shadow-sm rounded-4 mb-4 p-3.5"
                    style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1.5px solid #c4b5fd' }}>
                    <div className="d-flex align-items-center gap-3">
                        <div className="rounded-3 text-white fs-3 d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ background: '#7c3aed', width: 48, height: 48 }}>
                            <i className="bi bi-calendar-heart-fill" />
                        </div>
                        <div>
                            <span className="badge rounded-pill text-white px-2.5 py-1 fw-bold text-uppercase" style={{ backgroundColor: '#7c3aed', fontSize: '0.72rem' }}>
                                Official Staff Holiday
                            </span>
                            <h5 className="fw-bold text-dark mb-0 mt-1">{holidayInfo.title}</h5>
                            {holidayInfo.description && <p className="text-secondary small mb-0 mt-0.5">{holidayInfo.description}</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* SUMMARY STATS & PROGRESS */}
            {staff.length > 0 && (
                <>
                    <div className="row g-3 mb-4">
                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ borderLeft: '4px solid #0d9e6e' }}>
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <div className="text-muted small fw-semibold text-uppercase">Verified {sessionType.toUpperCase()}</div>
                                        <div className="fs-3 fw-bold text-success">{verifiedCount} / {total}</div>
                                    </div>
                                    <div className="rounded-circle p-2" style={{ background: '#e6f9f3', color: '#0d9e6e' }}>
                                        <i className="bi bi-shield-fill-check fs-4" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ borderLeft: '4px solid #e6860a' }}>
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <div className="text-muted small fw-semibold text-uppercase">Late Arrivals</div>
                                        <div className="fs-3 fw-bold text-warning">{staff.filter(e => e.is_in_late || e.status === 'Late').length}</div>
                                    </div>
                                    <div className="rounded-circle p-2" style={{ background: '#fef6e4', color: '#e6860a' }}>
                                        <i className="bi bi-clock-history fs-4" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ borderLeft: '4px solid #e13232' }}>
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <div className="text-muted small fw-semibold text-uppercase">Marked Absent</div>
                                        <div className="fs-3 fw-bold text-danger">{counts.Absent}</div>
                                    </div>
                                    <div className="rounded-circle p-2" style={{ background: '#fde8e8', color: '#e13232' }}>
                                        <i className="bi bi-person-x-fill fs-4" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ borderLeft: '4px solid #1a6fd4' }}>
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <div className="text-muted small fw-semibold text-uppercase">On Leave</div>
                                        <div className="fs-3 fw-bold text-primary">{counts.Leave}</div>
                                    </div>
                                    <div className="rounded-circle p-2" style={{ background: '#e8f0fd', color: '#1a6fd4' }}>
                                        <i className="bi bi-calendar2-check fs-4" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PROGRESS BAR */}
                    <div className="card border-0 shadow-sm rounded-4 mb-4">
                        <div className="card-body p-3 px-md-4">
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                                <div className="fw-semibold small" style={{ color: 'var(--primary-dark)' }}>
                                    <i className="bi bi-fingerprint me-2 text-success" />
                                    {sessionType.toUpperCase()} Session Progress: <strong>{verifiedCount}</strong> of <strong>{total}</strong> verified ({pct}%)
                                </div>
                                <span className="badge rounded-pill px-3 py-1 fw-bold" style={{ background: pct >= 80 ? '#0d9e6e' : pct >= 50 ? '#e6860a' : '#e13232' }}>
                                    {pct}% Verified
                                </span>
                            </div>
                            <div className="progress rounded-pill" style={{ height: 8 }}>
                                <div className="progress-bar bg-success" style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
                            </div>
                        </div>
                    </div>

                    {/* DEPARTMENT GROUPED TABLES */}
                    {Object.entries(groups).map(([deptName, members], gi) => (
                        <div key={deptName} className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 animate__animated animate__fadeInUp" style={{ animationDelay: `${gi * 0.05}s` }}>

                            {/* Card Header */}
                            <div className="card-header border-0 d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 px-md-4 py-3"
                                style={{ background: 'linear-gradient(135deg, var(--primary-dark), var(--primary-teal))' }}>
                                <div className="d-flex align-items-center gap-2">
                                    <i className="bi bi-building text-white-50" />
                                    <span className="fw-bold text-white">{deptName}</span>
                                    <span className="badge rounded-pill bg-white text-dark ms-1" style={{ fontSize: '0.75rem' }}>
                                        {members.length} staff
                                    </span>
                                </div>
                                <div className="d-flex gap-1">
                                    {STATUS_OPTS.map(s => {
                                        const c = members.filter(e => (statuses[e.employee_id] || 'Present') === s).length;
                                        return c > 0 ? (
                                            <span key={s} className="badge rounded-pill" style={{ background: S_BG[s], color: S_COLOR[s], fontSize: '0.72rem' }}>
                                                {c} {s}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            </div>

                            {/* Table */}
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead style={{ background: '#f8f9fa' }}>
                                        <tr>
                                            <th className="border-0 fw-semibold text-uppercase text-muted ps-3" style={{ fontSize: '0.72rem', width: 50 }}>#</th>
                                            <th className="border-0 fw-semibold text-uppercase text-muted" style={{ fontSize: '0.72rem' }}>Staff Member</th>
                                            <th className="border-0 fw-semibold text-uppercase text-muted" style={{ fontSize: '0.72rem' }}>Designation</th>
                                            <th className="border-0 fw-semibold text-uppercase text-muted" style={{ fontSize: '0.72rem' }}>Status</th>
                                            <th className="border-0 fw-semibold text-uppercase text-muted" style={{ fontSize: '0.72rem' }}>
                                                {sessionType === 'in' ? 'IN Time (Recorded)' : 'OUT Time (Recorded)'}
                                            </th>
                                            <th className="border-0 fw-semibold text-uppercase text-muted text-center" style={{ fontSize: '0.72rem' }}>
                                                Biometric Action
                                            </th>
                                            <th className="border-0 fw-semibold text-uppercase text-muted text-center pe-3" style={{ fontSize: '0.72rem', width: 70 }}>
                                                Lock
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {members.map((e, idx) => {
                                            const curStatus = (statuses[e.employee_id] || 'Present') as StatusType;
                                            const isLocked = lockedIds.has(e.employee_id);
                                            const isSessionVerified = sessionType === 'in' ? e.in_verified : e.out_verified;
                                            const timeRecorded = sessionType === 'in' ? e.check_in_time : e.check_out_time;

                                            // Row Styling: Verified & Locked rows turn elegant grey
                                            const rowBg = holidayInfo?.is_holiday
                                                ? '#fbf8ff'
                                                : isSessionVerified || isLocked
                                                    ? '#f8fafc'
                                                    : curStatus === 'Absent'
                                                        ? '#fff8f8'
                                                        : curStatus === 'Late'
                                                            ? '#fffdfa'
                                                            : '#ffffff';

                                            return (
                                                <tr
                                                    key={e.employee_id}
                                                    style={{
                                                        background: rowBg,
                                                        borderLeft: `4px solid ${holidayInfo?.is_holiday
                                                                ? '#7c3aed'
                                                                : isSessionVerified
                                                                    ? '#0d9e6e'
                                                                    : S_COLOR[curStatus]
                                                            }`,
                                                        transition: 'all 0.2s ease',
                                                        opacity: (isSessionVerified && isLocked) ? 0.92 : 1
                                                    }}
                                                >
                                                    {/* # */}
                                                    <td className="ps-3 text-muted" style={{ fontSize: '0.8rem' }}>
                                                        {idx + 1}
                                                    </td>

                                                    {/* Staff Member Details */}
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2.5">
                                                            <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-xs"
                                                                style={{
                                                                    width: 36,
                                                                    height: 36,
                                                                    background: isSessionVerified
                                                                        ? 'linear-gradient(135deg, #0d9e6e, #059669)'
                                                                        : 'linear-gradient(135deg, var(--primary-dark), var(--primary-teal))',
                                                                    fontSize: '0.76rem',
                                                                    flexShrink: 0
                                                                }}
                                                            >
                                                                {e.first_name?.[0] || 'S'}{e.last_name?.[0] || ''}
                                                            </div>
                                                            <div>
                                                                <div className="fw-bold text-dark d-flex align-items-center gap-1.5" style={{ fontSize: '0.88rem' }}>
                                                                    {e.first_name} {e.last_name}
                                                                    {isSessionVerified && (
                                                                        <span className="badge bg-success-subtle text-success rounded-pill px-1.5 py-0.5 fw-bold" style={{ fontSize: '0.65rem' }}>
                                                                            <i className="bi bi-patch-check-fill me-0.5" />Verified
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                                                    ID: #{e.employee_id} {e.app_user_id ? `· App User #${e.app_user_id}` : ''}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Designation */}
                                                    <td>
                                                        <span className="badge text-bg-light border fw-semibold" style={{ fontSize: '0.74rem' }}>
                                                            {e.designation || 'Staff'}
                                                        </span>
                                                    </td>

                                                    {/* Status Selector */}
                                                    <td>
                                                        {holidayInfo?.is_holiday ? (
                                                            <span className="badge rounded-pill px-3 py-1.5 fw-semibold" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
                                                                <i className="bi bi-calendar-heart-fill me-1" />Holiday
                                                            </span>
                                                        ) : isLocked ? (
                                                            <span className="badge rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-1"
                                                                style={{ background: S_BG[curStatus], color: S_COLOR[curStatus], border: `1px solid ${S_COLOR[curStatus]}44` }}>
                                                                <i className={`bi ${S_ICON[curStatus]}`} />
                                                                {curStatus}
                                                            </span>
                                                        ) : (
                                                            <div className="btn-group btn-group-sm">
                                                                {STATUS_OPTS.map(opt => (
                                                                    <button
                                                                        key={opt}
                                                                        type="button"
                                                                        onClick={() => setStatuses(p => ({ ...p, [e.employee_id]: opt }))}
                                                                        className="btn fw-semibold"
                                                                        style={{
                                                                            fontSize: '0.72rem',
                                                                            background: curStatus === opt ? S_COLOR[opt] : S_BG[opt],
                                                                            color: curStatus === opt ? '#fff' : S_COLOR[opt],
                                                                            borderColor: curStatus === opt ? S_COLOR[opt] : '#e2e8f0',
                                                                            padding: '2px 8px'
                                                                        }}
                                                                    >
                                                                        {opt}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Time Recorded & Late/Early Tag */}
                                                    <td>
                                                        {timeRecorded ? (
                                                            <div>
                                                                <span className="fw-bold text-dark font-monospace" style={{ fontSize: '0.84rem' }}>
                                                                    <i className="bi bi-clock me-1 text-muted" />
                                                                    {formatTimeDisplay(timeRecorded)}
                                                                </span>
                                                                {sessionType === 'in' && e.is_in_late && (
                                                                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning ms-1.5" style={{ fontSize: '0.66rem' }}>
                                                                        Late Entry
                                                                    </span>
                                                                )}
                                                                {sessionType === 'out' && e.is_out_early && (
                                                                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning ms-1.5" style={{ fontSize: '0.66rem' }}>
                                                                        Early Exit
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted small fst-italic">Not recorded yet</span>
                                                        )}
                                                    </td>

                                                    {/* Biometric Verification Trigger Column */}
                                                    <td className="text-center">
                                                        {isSessionVerified ? (
                                                            <div className="d-inline-flex align-items-center gap-1 text-success fw-bold small px-2 py-1 rounded-pill bg-success-subtle border border-success">
                                                                <i className="bi bi-check-circle-fill" />
                                                                <span>{sessionType.toUpperCase()} Done</span>
                                                            </div>
                                                        ) : (
                                                            <div className="d-flex align-items-center justify-content-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenVerification(e)}
                                                                    disabled={holidayInfo?.is_holiday}
                                                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 fw-bold rounded-pill px-3 py-1 shadow-xs"
                                                                    style={{ fontSize: '0.78rem' }}
                                                                >
                                                                    {settings.staff_biometric_mode === 'facial_retina' ? (
                                                                        <><i className="bi bi-eye-fill text-primary" />Scan Retina</>
                                                                    ) : settings.staff_biometric_mode === 'fingerprint' ? (
                                                                        <><i className="bi bi-fingerprint text-primary" />Scan Finger</>
                                                                    ) : (
                                                                        <><i className="bi bi-fingerprint" />Verify</>
                                                                    )}
                                                                </button>

                                                                {/* Admin Instant Override Option */}
                                                                {canEditLocked && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleInstantAdminVerify(e)}
                                                                        title="Admin Instant Verified Mark"
                                                                        className="btn btn-sm btn-light border text-muted px-2 py-1 rounded-pill"
                                                                        style={{ fontSize: '0.72rem' }}
                                                                    >
                                                                        <i className="bi bi-lightning-charge-fill text-warning" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Lock / Unlock Row Button */}
                                                    <td className="text-center pe-3">
                                                        <button
                                                            onClick={() => !holidayInfo?.is_holiday && toggleLock(e.employee_id)}
                                                            disabled={holidayInfo?.is_holiday}
                                                            title={holidayInfo?.is_holiday ? 'Holiday Locked' : isLocked ? 'Locked (Click to unlock)' : 'Unlocked'}
                                                            className={`btn btn-sm d-inline-flex align-items-center justify-content-center rounded-3 ${isLocked ? 'btn-success text-white' : 'btn-light border text-muted'
                                                                }`}
                                                            style={{ width: 32, height: 32, padding: 0 }}
                                                        >
                                                            <i className={`bi ${isLocked ? 'bi-lock-fill' : 'bi-unlock'}`} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}

                    {/* SAVE & CLOSE FOOTER */}
                    <div className="card border-0 shadow-sm rounded-4 mb-4">
                        <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3 p-3 p-md-4">
                            <div className="d-flex gap-3 flex-wrap align-items-center">
                                {STATUS_OPTS.map(s => (
                                    <span key={s} style={{ fontSize: '0.82rem', color: S_COLOR[s], fontWeight: 700 }}>
                                        <i className={`bi ${S_ICON[s]} me-1`} />
                                        {counts[s]} {s}
                                    </span>
                                ))}
                                {unlockedCount > 0 && !holidayInfo?.is_holiday && (
                                    <span className="badge rounded-pill px-2.5 py-1 bg-warning-subtle text-warning-emphasis border border-warning">
                                        <i className="bi bi-unlock me-1" />
                                        {unlockedCount} pending save
                                    </span>
                                )}
                            </div>

                            {hasPermission('attendance', 'write') && (
                                <button
                                    className="btn fw-bold px-4 rounded-3 shadow-sm"
                                    onClick={saveAttendance}
                                    disabled={saving || holidayInfo?.is_holiday}
                                    style={{
                                        background: 'var(--accent-orange)',
                                        color: '#fff',
                                        border: 'none',
                                        height: 42
                                    }}
                                >
                                    {saving ? (
                                        <><span className="spinner-border spinner-border-sm me-2" />Saving...</>
                                    ) : (
                                        <><i className="bi bi-save2-fill me-2" />Save {sessionType.toUpperCase()} Attendance</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* LIVE BIOMETRIC VERIFICATION MODAL */}
            {verifyingMember && (
                <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 480, margin: '1rem auto', padding: '0 0.75rem' }}>
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">

                            {/* Modal Header */}
                            <div className="modal-header border-0 text-white px-4 py-3" style={{ background: 'linear-gradient(135deg, var(--primary-dark), var(--primary-teal))' }}>
                                <div>
                                    <h5 className="modal-title fw-bold mb-0">
                                        <i className="bi bi-fingerprint me-2 text-warning" />
                                        Biometric {sessionType.toUpperCase()} Verification
                                    </h5>
                                    <small className="text-white-50">
                                        Matching {verifyingMember.first_name} {verifyingMember.last_name} (ID: #{verifyingMember.employee_id})
                                    </small>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => { stopCamera(); setVerifyingMember(null); }}
                                />
                            </div>

                            {/* Modal Body */}
                            <div className="modal-body p-4 text-center">

                                {/* Mode Switcher shown only when both modes allowed */}
                                {settings.staff_biometric_mode === 'both' && (
                                    <div className="btn-group w-100 mb-4 p-1 bg-light rounded-3 border">
                                        <button
                                            type="button"
                                            className={`btn btn-sm fw-bold rounded-2 ${scanMode === 'fingerprint' ? 'btn-primary shadow-xs' : 'btn-light text-muted'}`}
                                            onClick={() => { setScanMode('fingerprint'); startCamera(); }}
                                        >
                                            <i className="bi bi-fingerprint me-1" />Fingerprint Scan
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-sm fw-bold rounded-2 ${scanMode === 'retina_face' ? 'btn-primary shadow-xs' : 'btn-light text-muted'}`}
                                            onClick={() => { setScanMode('retina_face'); startCamera(); }}
                                        >
                                            <i className="bi bi-eye-fill me-1" />Eye Retina / Facial ID
                                        </button>
                                    </div>
                                )}

                                {/* SCANNER INTERFACE */}
                                {/* 
                                    IMPORTANT: The <video> element is ALWAYS rendered (never conditionally removed)
                                    so that videoRef.current is always available for captureMultiFrameDescriptor.
                                    In 'fingerprint' mode it is hidden via CSS the camera still runs and captures.
                                */}
                                <div
                                    className="position-relative mx-auto rounded-4 overflow-hidden mb-3 shadow-sm border"
                                    style={{
                                        maxWidth: 360,
                                        width: '100%',
                                        height: scanMode === 'retina_face' ? 260 : 0,
                                        background: '#000',
                                        overflow: 'hidden',
                                        transition: 'height 0.3s ease',
                                        border: scanMode === 'retina_face' ? undefined : 'none'
                                    }}
                                >
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-100 h-100"
                                        style={{ objectFit: 'cover' }}
                                    />
                                    {/* Scanner HUD Overlay only visible in retina_face mode */}
                                    {scanMode === 'retina_face' && (
                                        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
                                            style={{ border: '3px solid #22c55e', pointerEvents: 'none' }}>
                                            <div className="rounded-circle" style={{ width: 140, height: 140, border: '2px dashed rgba(34, 197, 94, 0.8)' }} />
                                            <div className="badge bg-dark bg-opacity-75 text-success mt-2 fw-semibold px-2 py-1 font-monospace" style={{ fontSize: '0.72rem' }}>
                                                Looking for Face / Retina Landmarks
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Fingerprint mode UI shown on top when in fingerprint mode */}
                                {scanMode === 'fingerprint' && (
                                    <div className="py-4 my-2">
                                        <div
                                            className="rounded-circle mx-auto d-flex align-items-center justify-content-center shadow-sm mb-3"
                                            style={{
                                                width: 120,
                                                height: 120,
                                                background: scanningInProgress ? '#e6f9f3' : '#f8f9fa',
                                                border: `3px solid ${scanningInProgress ? '#0d9e6e' : '#dee2e6'}`,
                                                transition: 'all 0.3s'
                                            }}
                                        >
                                            <i
                                                className={`bi bi-fingerprint ${scanningInProgress ? 'text-success animate__animated animate__pulse animate__infinite' : 'text-primary'}`}
                                                style={{ fontSize: '3.5rem' }}
                                            />
                                        </div>
                                        <h6 className="fw-bold text-dark mb-1">Biometric Scan</h6>
                                        <p className="text-muted small mb-0">Camera is capturing your biometric data.<br />Please look directly at the camera.</p>
                                        {!cameraStream && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary mt-2 rounded-pill px-3"
                                                onClick={startCamera}
                                            >
                                                <i className="bi bi-camera-video me-1" />Enable Camera
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Progress Bar during scan */}
                                {scanningInProgress && (
                                    <div className="my-3">
                                        <div className="progress rounded-pill" style={{ height: 6 }}>
                                            <div className="progress-bar bg-success progress-bar-striped progress-bar-animated" style={{ width: `${scanProgress}%` }} />
                                        </div>
                                        <small className="text-muted mt-1 d-block font-monospace">Verifying template against database ({scanProgress}%)...</small>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="modal-footer border-0 p-3 bg-light d-flex justify-content-between">
                                <button
                                    type="button"
                                    className="btn btn-light border px-3 rounded-3"
                                    onClick={() => { stopCamera(); setVerifyingMember(null); }}
                                >
                                    Cancel
                                </button>

                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-success fw-bold px-4 rounded-3 shadow-sm"
                                        onClick={executeBiometricVerification}
                                        disabled={scanningInProgress}
                                    >
                                        {scanningInProgress ? (
                                            <><span className="spinner-border spinner-border-sm me-2" />Matching...</>
                                        ) : (
                                            <><i className="bi bi-shield-check me-1.5" />Match &amp; Verify Now</>
                                        )}
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}