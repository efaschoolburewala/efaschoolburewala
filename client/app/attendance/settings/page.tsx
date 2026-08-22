'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-toastify';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface AttendanceSettings {
    id: number;
    staff_in_time: string;
    staff_out_time: string;
    staff_grace_minutes: number;
    staff_biometric_mode: string;
    staff_auto_absent_enabled: boolean;
    staff_notify_in_out: boolean;
    staff_notify_holidays: boolean;
    student_notify_parents: boolean;
    student_notify_holidays: boolean;
    student_auto_absent_enabled: boolean;
    family_notify_each_child: boolean;
    consecutive_absent_alert_days: number;
    updated_at: string;
}

interface HolidayItem {
    id: number;
    title: string;
    holiday_type: string;
    start_date: string;
    end_date: string;
    is_recurring_weekly: boolean;
    recurring_day_of_week: number;
    description: string | null;
}

interface ClassItem {
    class_id: number;
    class_name: string;
}

interface SectionItem {
    section_id: number;
    section_name: string;
    class_id: number;
}

interface AssignedSection {
    assignment_id?: number;
    class_id: number;
    class_name: string;
    section_id: number;
    section_name: string;
}

interface CoordinatorStaff {
    employee_id: number;
    first_name: string;
    last_name: string;
    designation: string | null;
    email: string | null;
    phone: string | null;
    department_name: string | null;
    assigned_sections: AssignedSection[];
}

export default function AttendanceSettingsPage() {
    const { user } = useAuth();
    const token = user?.token;

    const [activeTab, setActiveTab] = useState<'staff' | 'students'>('staff');
    const [loading, setLoading] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);

    // Settings State
    const [settings, setSettings] = useState<AttendanceSettings>({
        id: 1,
        staff_in_time: '08:00',
        staff_out_time: '14:00',
        staff_grace_minutes: 15,
        staff_biometric_mode: 'both',
        staff_auto_absent_enabled: true,
        staff_notify_in_out: true,
        staff_notify_holidays: true,
        student_notify_parents: true,
        student_notify_holidays: true,
        student_auto_absent_enabled: true,
        family_notify_each_child: true,
        consecutive_absent_alert_days: 3,
        updated_at: new Date().toISOString()
    });

    const [holidays, setHolidays] = useState<HolidayItem[]>([]);
    const [coordinators, setCoordinators] = useState<CoordinatorStaff[]>([]);
    const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
    const [allSections, setAllSections] = useState<SectionItem[]>([]);

    // Holiday Modal State
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [holidayTitle, setHolidayTitle] = useState('');
    const [holidayType, setHolidayType] = useState('staff_and_students');
    const [holidayStartDate, setHolidayStartDate] = useState('');
    const [holidayEndDate, setHolidayEndDate] = useState('');
    const [holidayDesc, setHolidayDesc] = useState('');
    const [holidayRecurringSunday, setHolidayRecurringSunday] = useState(false);
    const [holidayBroadcast, setHolidayBroadcast] = useState(true);
    const [savingHoliday, setSavingHoliday] = useState(false);

    // Coordinator Assignment 3-Column Modal State
    const [selectedCoordinator, setSelectedCoordinator] = useState<CoordinatorStaff | null>(null);
    const [modalActiveTabClassId, setModalActiveTabClassId] = useState<number | null>(null);
    const [modalSelectedPairs, setModalSelectedPairs] = useState<{ class_id: number; section_id: number }[]>([]);
    const [savingAssignments, setSavingAssignments] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Load All Data
    const loadAllData = async () => {
        setLoading(true);
        try {
            const [setRes, holRes, coordRes, classRes, secRes] = await Promise.all([
                fetch(`${API}/attendance/settings`),
                fetch(`${API}/attendance/holidays`),
                fetch(`${API}/attendance/coordinators`),
                fetch(`${API}/academic/classes`),
                fetch(`${API}/academic/sections`)
            ]);

            if (setRes.ok) {
                const setData = await setRes.json();
                if (setData.settings) {
                    setSettings({
                        ...setData.settings,
                        staff_in_time: setData.settings.staff_in_time ? String(setData.settings.staff_in_time).slice(0, 5) : '08:00',
                        staff_out_time: setData.settings.staff_out_time ? String(setData.settings.staff_out_time).slice(0, 5) : '14:00'
                    });
                }
            }

            if (holRes.ok) {
                const holData = await holRes.json();
                setHolidays(Array.isArray(holData) ? holData : []);
            }

            if (coordRes.ok) {
                const coordData = await coordRes.json();
                setCoordinators(Array.isArray(coordData) ? coordData : []);
            }

            if (classRes.ok) {
                const classData = await classRes.json();
                setAllClasses(Array.isArray(classData) ? classData : []);
            }

            if (secRes.ok) {
                const secData = await secRes.json();
                setAllSections(Array.isArray(secData) ? secData : []);
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to load attendance settings data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllData();
    }, [token]);

    // Save Settings
    const handleSaveSettings = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSavingSettings(true);
        try {
            const res = await fetch(`${API}/attendance/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update settings');

            toast.success('✓ Attendance policies and timings saved successfully!');
            if (data.settings) {
                setSettings({
                    ...data.settings,
                    staff_in_time: data.settings.staff_in_time ? String(data.settings.staff_in_time).slice(0, 5) : '08:00',
                    staff_out_time: data.settings.staff_out_time ? String(data.settings.staff_out_time).slice(0, 5) : '14:00'
                });
            }
        } catch (err: any) {
            toast.error(err.message || 'Error saving settings');
        } finally {
            setSavingSettings(false);
        }
    };

    // Add Holiday
    const handleAddHoliday = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!holidayTitle.trim() || !holidayStartDate) {
            toast.warning('Title and Start Date are required');
            return;
        }

        setSavingHoliday(true);
        try {
            const res = await fetch(`${API}/attendance/holidays`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: holidayTitle.trim(),
                    holiday_type: holidayType,
                    start_date: holidayStartDate,
                    end_date: holidayEndDate || holidayStartDate,
                    is_recurring_weekly: holidayRecurringSunday,
                    recurring_day_of_week: 0,
                    description: holidayDesc.trim() || null,
                    notify_broadcast: holidayBroadcast
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create holiday');

            toast.success(`✓ Holiday "${holidayTitle}" created and broadcasted!`);
            setShowHolidayModal(false);
            setHolidayTitle('');
            setHolidayStartDate('');
            setHolidayEndDate('');
            setHolidayDesc('');
            setHolidayRecurringSunday(false);
            loadAllData();
        } catch (err: any) {
            toast.error(err.message || 'Error creating holiday');
        } finally {
            setSavingHoliday(false);
        }
    };

    // Delete Holiday
    const handleDeleteHoliday = async (id: number, title: string) => {
        if (!confirm(`Are you sure you want to delete holiday "${title}"?`)) return;
        try {
            const res = await fetch(`${API}/attendance/holidays/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to delete holiday');
            toast.success(`Holiday "${title}" removed`);
            setHolidays(prev => prev.filter(h => h.id !== id));
        } catch (err: any) {
            toast.error(err.message || 'Error deleting holiday');
        }
    };

    // Open Coordinator Assignment 3-Column Modal
    const handleOpenAssignmentModal = (staff: CoordinatorStaff) => {
        setSelectedCoordinator(staff);
        const pairs = (staff.assigned_sections || []).map(a => ({
            class_id: Number(a.class_id),
            section_id: Number(a.section_id)
        }));
        setModalSelectedPairs(pairs);

        if (allClasses.length > 0) {
            setModalActiveTabClassId(allClasses[0].class_id);
        } else {
            setModalActiveTabClassId(null);
        }
    };

    // Toggle single section in 3-Column modal
    const handleToggleSectionPair = (classId: number, sectionId: number) => {
        setModalSelectedPairs(prev => {
            const exists = prev.some(p => p.class_id === classId && p.section_id === sectionId);
            if (exists) {
                return prev.filter(p => !(p.class_id === classId && p.section_id === sectionId));
            } else {
                return [...prev, { class_id: classId, section_id: sectionId }];
            }
        });
    };

    // Quick Select/Deselect All Sections for current class in modal
    const handleToggleAllSectionsForClass = (classId: number) => {
        const classSections = allSections.filter(s => Number(s.class_id) === Number(classId));
        const allSelected = classSections.every(s => modalSelectedPairs.some(p => p.class_id === classId && p.section_id === s.section_id));

        if (allSelected) {
            // Remove all for this class
            setModalSelectedPairs(prev => prev.filter(p => p.class_id !== classId));
        } else {
            // Add all for this class
            const newPairs = classSections.map(s => ({ class_id: classId, section_id: s.section_id }));
            setModalSelectedPairs(prev => {
                const filtered = prev.filter(p => p.class_id !== classId);
                return [...filtered, ...newPairs];
            });
        }
    };

    // Save Coordinator Assignments
    const handleSaveCoordinatorAssignments = async () => {
        if (!selectedCoordinator) return;
        setSavingAssignments(true);
        try {
            const res = await fetch(`${API}/attendance/coordinators/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    employee_id: selectedCoordinator.employee_id,
                    assignments: modalSelectedPairs
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save assignments');

            toast.success(`✓ Assignments updated for ${selectedCoordinator.first_name} ${selectedCoordinator.last_name || ''}!`);
            setSelectedCoordinator(null);
            loadAllData();
        } catch (err: any) {
            toast.error(err.message || 'Error saving assignments');
        } finally {
            setSavingAssignments(false);
        }
    };

    // Count selected sections for a class in modal
    const getSelectedCountForClass = (classId: number) => {
        return modalSelectedPairs.filter(p => p.class_id === classId).length;
    };

    const filteredCoordinators = coordinators.filter(c => {
        const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
        const des = (c.designation || '').toLowerCase();
        const dep = (c.department_name || '').toLowerCase();
        const q = searchTerm.toLowerCase();
        return name.includes(q) || des.includes(q) || dep.includes(q);
    });

    return (
        <div className="container-fluid py-4 px-3 px-md-4 attendance-settings-page">
            {/* Top Breadcrumb & Page Header */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div>
                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb mb-1 small text-muted">
                            <li className="breadcrumb-item"><Link href="/" className="text-decoration-none">Dashboard</Link></li>
                            <li className="breadcrumb-item"><Link href="/attendance/students" className="text-decoration-none">Attendance</Link></li>
                            <li className="breadcrumb-item active" aria-current="page">Attendance Settings</li>
                        </ol>
                    </nav>
                    <h2 className="fw-black text-dark mb-0 d-flex align-items-center gap-2">
                        <i className="bi bi-gear-wide-connected text-teal" style={{ color: '#0d9488' }}></i>
                        Attendance Settings
                    </h2>
                    <p className="text-muted small mb-0">
                        Configure school-wide staff timings, biometric modes, holidays calendar &amp; coordinator class attendance delegations.
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2 fw-bold shadow-sm rounded-3"
                        onClick={() => setShowHolidayModal(true)}
                    >
                        <i className="bi bi-calendar-plus-fill"></i>
                        <span>Add Holiday</span>
                    </button>
                    <button
                        type="button"
                        className="btn btn-teal text-white d-flex align-items-center gap-2 px-3.5 py-2 fw-bold shadow-sm rounded-3"
                        style={{ backgroundColor: '#0d9488' }}
                        onClick={handleSaveSettings}
                        disabled={savingSettings}
                    >
                        {savingSettings ? (
                            <><span className="spinner-border spinner-border-sm" />Saving...</>
                        ) : (
                            <><i className="bi bi-check2-circle fs-5" /><span>Save All Settings</span></>
                        )}
                    </button>
                </div>
            </div>

            {/* Top 2 Core Cards Navigation */}
            <div className="row g-3 mb-4">
                {/* Staff Attendance Settings Card */}
                <div className="col-12 col-md-6">
                    <div
                        className={`card h-100 border-0 shadow-sm rounded-4 p-4 cursor-pointer transition-all position-relative overflow-hidden ${activeTab === 'staff' ? 'active-card-glow' : 'bg-white'}`}
                        style={{
                            background: activeTab === 'staff'
                                ? 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)'
                                : '#ffffff',
                            border: activeTab === 'staff' ? '2px solid #0d9488' : '1px solid #e2e8f0',
                            cursor: 'pointer'
                        }}
                        onClick={() => setActiveTab('staff')}
                    >
                        <div className="d-flex align-items-start justify-content-between mb-3">
                            <div className="d-flex align-items-center gap-3">
                                <div
                                    className="d-flex align-items-center justify-content-center rounded-3 shadow-sm"
                                    style={{ width: 50, height: 50, background: '#0d9488', color: '#fff', fontSize: '1.5rem' }}
                                >
                                    <i className="bi bi-person-badge-fill"></i>
                                </div>
                                <div>
                                    <span className="badge bg-teal-subtle text-teal fw-bold text-uppercase px-2.5 py-1 rounded-pill" style={{ color: '#0f766e', backgroundColor: '#e6fffa' }}>
                                        Staff Attendance Setting
                                    </span>
                                    <h4 className="fw-bold text-dark mb-0 mt-1">Staff Shifts &amp; Biometrics</h4>
                                </div>
                            </div>
                            {activeTab === 'staff' && (
                                <span className="badge bg-teal text-white rounded-pill px-3 py-1.5" style={{ backgroundColor: '#0d9488' }}>
                                    Active View ✓
                                </span>
                            )}
                        </div>

                        <p className="text-secondary small mb-3">
                            Configure staff working hours (In/Out Time), grace period, biometric verification rules, and staff non-working holidays.
                        </p>

                        <div className="d-flex flex-wrap gap-2 pt-2 border-top border-light-subtle">
                            <span className="badge bg-white text-dark border px-2.5 py-1.5 rounded-3 d-flex align-items-center gap-1.5">
                                <i className="bi bi-clock-fill text-teal" style={{ color: '#0d9488' }}></i>
                                Shift: <strong>{settings.staff_in_time} - {settings.staff_out_time}</strong>
                            </span>
                            <span className="badge bg-white text-dark border px-2.5 py-1.5 rounded-3 d-flex align-items-center gap-1.5">
                                <i className="bi bi-fingerprint text-primary"></i>
                                Mode: <strong>{settings.staff_biometric_mode.toUpperCase()}</strong>
                            </span>
                            <span className="badge bg-white text-dark border px-2.5 py-1.5 rounded-3 d-flex align-items-center gap-1.5">
                                <i className="bi bi-bell-fill text-warning"></i>
                                Push Alerts: <strong>{settings.staff_notify_in_out ? 'ON' : 'OFF'}</strong>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Student Attendance Settings Card */}
                <div className="col-12 col-md-6">
                    <div
                        className={`card h-100 border-0 shadow-sm rounded-4 p-4 cursor-pointer transition-all position-relative overflow-hidden ${activeTab === 'students' ? 'active-card-glow' : 'bg-white'}`}
                        style={{
                            background: activeTab === 'students'
                                ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
                                : '#ffffff',
                            border: activeTab === 'students' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                            cursor: 'pointer'
                        }}
                        onClick={() => setActiveTab('students')}
                    >
                        <div className="d-flex align-items-start justify-content-between mb-3">
                            <div className="d-flex align-items-center gap-3">
                                <div
                                    className="d-flex align-items-center justify-content-center rounded-3 shadow-sm"
                                    style={{ width: 50, height: 50, background: '#2563eb', color: '#fff', fontSize: '1.5rem' }}
                                >
                                    <i className="bi bi-mortarboard-fill"></i>
                                </div>
                                <div>
                                    <span className="badge bg-primary-subtle text-primary fw-bold text-uppercase px-2.5 py-1 rounded-pill">
                                        Student Attendance Setting
                                    </span>
                                    <h4 className="fw-bold text-dark mb-0 mt-1">Coordinators &amp; Class Delegation</h4>
                                </div>
                            </div>
                            {activeTab === 'students' && (
                                <span className="badge bg-primary text-white rounded-pill px-3 py-1.5">
                                    Active View ✓
                                </span>
                            )}
                        </div>

                        <p className="text-secondary small mb-3">
                            Assign classes &amp; sections to Coordinators/Staff for targeted attendance, manage student holidays &amp; individual family child alerts.
                        </p>

                        <div className="d-flex flex-wrap gap-2 pt-2 border-top border-light-subtle">
                            <span className="badge bg-white text-dark border px-2.5 py-1.5 rounded-3 d-flex align-items-center gap-1.5">
                                <i className="bi bi-people-fill text-primary"></i>
                                Coordinators: <strong>{coordinators.filter(c => c.assigned_sections?.length > 0).length} Assigned</strong>
                            </span>
                            <span className="badge bg-white text-dark border px-2.5 py-1.5 rounded-3 d-flex align-items-center gap-1.5">
                                <i className="bi bi-chat-dots-fill text-success"></i>
                                Family Per-Child: <strong>{settings.family_notify_each_child ? 'Enabled' : 'Disabled'}</strong>
                            </span>
                            <span className="badge bg-white text-dark border px-2.5 py-1.5 rounded-3 d-flex align-items-center gap-1.5">
                                <i className="bi bi-exclamation-triangle-fill text-danger"></i>
                                3-Day Absent Rule: <strong>Strict Alert</strong>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TAB CONTENT 1: STAFF ATTENDANCE SETTINGS */}
            {activeTab === 'staff' && (
                <div className="animate__animated animate__fadeIn">
                    <div className="row g-4">
                        {/* Section A: Shift Timing & Biometrics Form */}
                        <div className="col-12 col-lg-7">
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
                                <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-clock-history text-teal" style={{ color: '#0d9488' }}></i>
                                    Staff Shift Timings &amp; Verification Mode
                                </h5>

                                <form onSubmit={handleSaveSettings}>
                                    <div className="row g-3 mb-3">
                                        <div className="col-12 col-sm-6">
                                            <label className="form-label fw-bold small text-secondary">
                                                Staff In-Time (Start of Duty) <span className="text-danger">*</span>
                                            </label>
                                            <div className="input-group">
                                                <span className="input-group-text bg-light"><i className="bi bi-box-arrow-in-right text-success"></i></span>
                                                <input
                                                    type="time"
                                                    className="form-control fw-bold"
                                                    value={settings.staff_in_time}
                                                    onChange={e => setSettings({ ...settings, staff_in_time: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="col-12 col-sm-6">
                                            <label className="form-label fw-bold small text-secondary">
                                                Staff Out-Time (Shift End) <span className="text-danger">*</span>
                                            </label>
                                            <div className="input-group">
                                                <span className="input-group-text bg-light"><i className="bi bi-box-arrow-right text-danger"></i></span>
                                                <input
                                                    type="time"
                                                    className="form-control fw-bold"
                                                    value={settings.staff_out_time}
                                                    onChange={e => setSettings({ ...settings, staff_out_time: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="col-12 col-sm-6">
                                            <label className="form-label fw-bold small text-secondary">
                                                Late Grace Period (Minutes)
                                            </label>
                                            <div className="input-group">
                                                <span className="input-group-text bg-light"><i className="bi bi-hourglass-split text-warning"></i></span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={120}
                                                    className="form-control fw-bold"
                                                    value={settings.staff_grace_minutes}
                                                    onChange={e => setSettings({ ...settings, staff_grace_minutes: Number(e.target.value) })}
                                                />
                                                <span className="input-group-text bg-light small">Minutes</span>
                                            </div>
                                            <span className="text-muted" style={{ fontSize: '0.75rem' }}>Staff arriving after this will be flagged as Late.</span>
                                        </div>

                                        <div className="col-12 col-sm-6">
                                            <label className="form-label fw-bold small text-secondary">
                                                Biometric Verification Mode
                                            </label>
                                            <select
                                                className="form-select fw-bold"
                                                value={settings.staff_biometric_mode}
                                                onChange={e => setSettings({ ...settings, staff_biometric_mode: e.target.value })}
                                            >
                                                <option value="both">Both (Fingerprint &amp; Face / Eye Retina)</option>
                                                <option value="fingerprint">Fingerprint Sensor Only</option>
                                                <option value="face_retina">Face &amp; Eye Retina Scanner Only</option>
                                                <option value="manual">Manual Register Only</option>
                                            </select>
                                        </div>
                                    </div>

                                    <h6 className="fw-bold text-dark mt-4 mb-3 border-top pt-3">
                                        Staff Push Notifications &amp; Automation
                                    </h6>

                                    <div className="form-check form-switch mb-2.5">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="staffNotifyInOut"
                                            checked={settings.staff_notify_in_out}
                                            onChange={e => setSettings({ ...settings, staff_notify_in_out: e.target.checked })}
                                        />
                                        <label className="form-check-label fw-semibold text-dark" htmlFor="staffNotifyInOut">
                                            Send instant Mobile Push Notification on Staff In &amp; Out Check
                                        </label>
                                        <p className="text-muted mb-0" style={{ fontSize: '0.78rem' }}>
                                            Staff receives a real-time notification on mobile status bar and staff portal upon recording attendance.
                                        </p>
                                    </div>

                                    <div className="form-check form-switch mb-2.5">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="staffNotifyHolidays"
                                            checked={settings.staff_notify_holidays}
                                            onChange={e => setSettings({ ...settings, staff_notify_holidays: e.target.checked })}
                                        />
                                        <label className="form-check-label fw-semibold text-dark" htmlFor="staffNotifyHolidays">
                                            Broadcast Holiday &amp; Weekend Alerts to Staff Portals
                                        </label>
                                        <p className="text-muted mb-0" style={{ fontSize: '0.78rem' }}>
                                            Prevents automated absent triggers on scheduled holidays and informs staff in advance.
                                        </p>
                                    </div>

                                    <div className="mt-4 pt-2">
                                        <button
                                            type="submit"
                                            className="btn btn-teal text-white fw-bold px-4 py-2 rounded-3 shadow-sm"
                                            style={{ backgroundColor: '#0d9488' }}
                                            disabled={savingSettings}
                                        >
                                            {savingSettings ? 'Saving...' : 'Save Staff Settings'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Section B: Staff Holiday Calendar */}
                        <div className="col-12 col-lg-5">
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                        <i className="bi bi-calendar-event text-teal" style={{ color: '#0d9488' }}></i>
                                        Staff Holidays Calendar
                                    </h5>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold"
                                        onClick={() => {
                                            setHolidayType('staff_only');
                                            setShowHolidayModal(true);
                                        }}
                                    >
                                        + New Holiday
                                    </button>
                                </div>
                                <p className="text-muted small mb-3">
                                    Scheduled days when staff is officially off. The system will never mark staff absent on these dates.
                                </p>

                                <div className="holidays-list overflow-auto" style={{ maxHeight: 380 }}>
                                    {holidays.filter(h => h.holiday_type !== 'students_only').length === 0 ? (
                                        <div className="text-center py-4 text-muted">
                                            <i className="bi bi-calendar-x fs-2 d-block mb-2 text-secondary opacity-50"></i>
                                            <span className="small">No staff holidays scheduled yet.</span>
                                        </div>
                                    ) : (
                                        holidays
                                            .filter(h => h.holiday_type !== 'students_only')
                                            .map(h => (
                                                <div key={h.id} className="p-3 mb-2 rounded-3 border bg-light-subtle d-flex align-items-center justify-content-between">
                                                    <div>
                                                        <span className="badge bg-teal-subtle text-teal fw-bold mb-1" style={{ color: '#0f766e', backgroundColor: '#e6fffa' }}>
                                                            {h.start_date === h.end_date ? h.start_date : `${h.start_date} to ${h.end_date}`}
                                                        </span>
                                                        <h6 className="fw-bold text-dark mb-0">{h.title}</h6>
                                                        {h.description && <p className="text-muted mb-0 small">{h.description}</p>}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger border-0 rounded-circle"
                                                        onClick={() => handleDeleteHoliday(h.id, h.title)}
                                                        title="Delete Holiday"
                                                    >
                                                        <i className="bi bi-trash3-fill"></i>
                                                    </button>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT 2: STUDENT ATTENDANCE & COORDINATORS DELEGATION */}
            {activeTab === 'students' && (
                <div className="animate__animated animate__fadeIn">
                    <div className="row g-4">
                        {/* Section A: Coordinator & Staff Class Delegation Table */}
                        <div className="col-12 col-lg-8">
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                                    <div>
                                        <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                                            <i className="bi bi-person-lines-fill text-primary"></i>
                                            School Coordinators &amp; Class Delegations
                                        </h5>
                                        <p className="text-muted small mb-0">
                                            Assign classes &amp; sections to coordinators. When logged in, they only see and mark attendance for their assigned classes.
                                        </p>
                                    </div>
                                    <div style={{ maxWidth: 220 }}>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm rounded-pill"
                                            placeholder="Search staff..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="table-light">
                                            <tr className="small text-uppercase text-secondary">
                                                <th>Staff Member</th>
                                                <th>Designation</th>
                                                <th>Assigned Classes &amp; Sections</th>
                                                <th className="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCoordinators.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="text-center py-4 text-muted">
                                                        No staff found matching search.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredCoordinators.map(c => {
                                                    const assigned = c.assigned_sections || [];
                                                    return (
                                                        <tr key={c.employee_id}>
                                                            <td>
                                                                <div className="d-flex align-items-center gap-2.5">
                                                                    <div
                                                                        className="rounded-circle bg-primary-subtle text-primary fw-bold d-flex align-items-center justify-content-center"
                                                                        style={{ width: 38, height: 38, fontSize: '0.85rem' }}
                                                                    >
                                                                        {(c.first_name?.[0] || 'S') + (c.last_name?.[0] || '')}
                                                                    </div>
                                                                    <div>
                                                                        <div className="fw-bold text-dark">{c.first_name} {c.last_name || ''}</div>
                                                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{c.email || c.phone || 'No Contact Info'}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className="badge bg-light text-dark border">
                                                                    {c.designation || 'Staff'}
                                                                </span>
                                                                {c.department_name && (
                                                                    <div className="text-muted mt-0.5" style={{ fontSize: '0.72rem' }}>{c.department_name}</div>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {assigned.length === 0 ? (
                                                                    <span className="badge bg-secondary-subtle text-secondary small">
                                                                        No Classes Assigned
                                                                    </span>
                                                                ) : (
                                                                    <div className="d-flex flex-wrap gap-1" style={{ maxWidth: 300 }}>
                                                                        {assigned.slice(0, 4).map((a, i) => (
                                                                            <span key={i} className="badge bg-teal-subtle text-teal border border-teal-subtle small px-2 py-1" style={{ color: '#0f766e', backgroundColor: '#f0fdfa' }}>
                                                                                {a.class_name} ({a.section_name})
                                                                            </span>
                                                                        ))}
                                                                        {assigned.length > 4 && (
                                                                            <span className="badge bg-light text-dark border small px-2 py-1">
                                                                                +{assigned.length - 4} more
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="text-end">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold"
                                                                    onClick={() => handleOpenAssignmentModal(c)}
                                                                >
                                                                    <i className="bi bi-pencil-square me-1"></i>
                                                                    Manage Assignments
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Section B: Student Notifications & Holidays Policy */}
                        <div className="col-12 col-lg-4">
                            {/* Policy & Personalized Message Card */}
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
                                <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                                    <i className="bi bi-chat-heart-fill text-danger"></i>
                                    Family Individual Child Alerts
                                </h5>

                                <div className="form-check form-switch mb-3">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="familyPerChild"
                                        checked={settings.family_notify_each_child}
                                        onChange={e => setSettings({ ...settings, family_notify_each_child: e.target.checked })}
                                    />
                                    <label className="form-check-label fw-bold text-dark" htmlFor="familyPerChild">
                                        Personalized Guardian Notifications
                                    </label>
                                    <p className="text-muted mb-0" style={{ fontSize: '0.78rem' }}>
                                        Sends separate customized notifications for each child addressing the father/guardian by name.
                                    </p>
                                </div>

                                <div className="p-3 rounded-3 bg-light border">
                                    <div className="small fw-bold text-dark mb-1">
                                        <i className="bi bi-shield-exclamation text-danger me-1"></i>
                                        3 Consecutive Absents Strict Policy:
                                    </div>
                                    <p className="text-muted small mb-0" style={{ fontSize: '0.78rem' }}>
                                        When a student is absent for 3 consecutive days, the system automatically sends a high-priority warning message to parents requiring a medical/written note to avoid fines.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-primary w-100 fw-bold rounded-3 mt-3 shadow-sm py-2"
                                    onClick={handleSaveSettings}
                                    disabled={savingSettings}
                                >
                                    {savingSettings ? 'Saving...' : 'Save Notification Policy'}
                                </button>
                            </div>

                            {/* Student Holidays Calendar */}
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                        <i className="bi bi-sun-fill text-warning"></i>
                                        Student Holidays
                                    </h5>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold"
                                        onClick={() => {
                                            setHolidayType('students_only');
                                            setShowHolidayModal(true);
                                        }}
                                    >
                                        + Holiday
                                    </button>
                                </div>

                                <div className="holidays-list overflow-auto" style={{ maxHeight: 260 }}>
                                    {holidays.filter(h => h.holiday_type !== 'staff_only').length === 0 ? (
                                        <div className="text-center py-3 text-muted">
                                            <span className="small">No student holidays scheduled yet.</span>
                                        </div>
                                    ) : (
                                        holidays
                                            .filter(h => h.holiday_type !== 'staff_only')
                                            .map(h => (
                                                <div key={h.id} className="p-2.5 mb-2 rounded-3 border bg-light-subtle d-flex align-items-center justify-content-between">
                                                    <div>
                                                        <span className="badge bg-primary-subtle text-primary fw-bold mb-1" style={{ fontSize: '0.7rem' }}>
                                                            {h.start_date === h.end_date ? h.start_date : `${h.start_date} to ${h.end_date}`}
                                                        </span>
                                                        <div className="fw-bold text-dark small">{h.title}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger border-0 rounded-circle"
                                                        onClick={() => handleDeleteHoliday(h.id, h.title)}
                                                    >
                                                        <i className="bi bi-trash3-fill"></i>
                                                    </button>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* 3-COLUMN COORDINATOR ASSIGNMENT MODAL (MATCHING USER SCREENSHOT) */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {selectedCoordinator && (
                <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: 1050 }}>
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            {/* Modal Header */}
                            <div className="modal-header bg-dark text-white border-0 py-3 px-4" style={{ background: '#1e293b' }}>
                                <div>
                                    <h5 className="modal-title fw-bold text-white mb-0">
                                        Assignments: {selectedCoordinator.first_name} {selectedCoordinator.last_name || ''}
                                    </h5>
                                    <p className="text-white-50 small mb-0">
                                        Select classes and sections below. Changes are saved when you click Confirm.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setSelectedCoordinator(null)}
                                />
                            </div>

                            {/* 3-Columns Modal Body */}
                            <div className="modal-body p-0">
                                <div className="row g-0" style={{ minHeight: 440 }}>
                                    {/* COLUMN 1: 1. SELECT CLASS */}
                                    <div className="col-12 col-md-3 border-end bg-light-subtle">
                                        <div className="p-3 border-bottom bg-white fw-bold text-secondary text-uppercase small d-flex align-items-center gap-2">
                                            <i className="bi bi-building"></i>
                                            <span>1. Select Class</span>
                                        </div>
                                        <div className="class-list overflow-auto" style={{ maxHeight: 400 }}>
                                            {allClasses.map(c => {
                                                const selectedCount = getSelectedCountForClass(c.class_id);
                                                const isActive = modalActiveTabClassId === c.class_id;
                                                return (
                                                    <div
                                                        key={c.class_id}
                                                        className={`p-3 d-flex align-items-center justify-content-between cursor-pointer border-bottom transition-all ${isActive ? 'bg-white fw-bold shadow-sm' : 'text-dark'}`}
                                                        style={{
                                                            cursor: 'pointer',
                                                            borderLeft: isActive ? '4px solid #0d9488' : '4px solid transparent'
                                                        }}
                                                        onClick={() => setModalActiveTabClassId(c.class_id)}
                                                    >
                                                        <span className="small">{c.class_name}</span>
                                                        {selectedCount > 0 && (
                                                            <span
                                                                className="badge rounded-pill fw-bold"
                                                                style={{ backgroundColor: '#f59e0b', color: '#fff', fontSize: '0.75rem' }}
                                                            >
                                                                {selectedCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* COLUMN 2: 2. SELECT SECTION */}
                                    <div className="col-12 col-md-4 border-end bg-white">
                                        <div className="p-3 border-bottom bg-white fw-bold text-secondary text-uppercase small d-flex align-items-center justify-content-between">
                                            <div className="d-flex align-items-center gap-2">
                                                <i className="bi bi-grid-3x3-gap"></i>
                                                <span>2. Select Section</span>
                                            </div>
                                            {modalActiveTabClassId && (
                                                <button
                                                    type="button"
                                                    className="btn btn-link text-decoration-none p-0 small fw-bold"
                                                    style={{ color: '#0d9488', fontSize: '0.75rem' }}
                                                    onClick={() => handleToggleAllSectionsForClass(modalActiveTabClassId)}
                                                >
                                                    Toggle All
                                                </button>
                                            )}
                                        </div>

                                        <div className="section-list p-3 overflow-auto" style={{ maxHeight: 400 }}>
                                            {!modalActiveTabClassId ? (
                                                <div className="text-center py-5 text-muted">
                                                    <i className="bi bi-arrow-left fs-3 d-block mb-1 opacity-50"></i>
                                                    <span className="small">Select a class first</span>
                                                </div>
                                            ) : (
                                                allSections
                                                    .filter(s => Number(s.class_id) === Number(modalActiveTabClassId))
                                                    .map(s => {
                                                        const isChecked = modalSelectedPairs.some(
                                                            p => p.class_id === modalActiveTabClassId && p.section_id === s.section_id
                                                        );
                                                        return (
                                                            <div
                                                                key={s.section_id}
                                                                className={`p-3 mb-2 rounded-3 border d-flex align-items-center justify-content-between cursor-pointer transition-all ${isChecked ? 'border-teal bg-teal-subtle' : 'bg-light-subtle'}`}
                                                                style={{
                                                                    cursor: 'pointer',
                                                                    borderColor: isChecked ? '#0d9488' : '#e2e8f0',
                                                                    backgroundColor: isChecked ? '#f0fdfa' : '#f8fafc'
                                                                }}
                                                                onClick={() => handleToggleSectionPair(modalActiveTabClassId, s.section_id)}
                                                            >
                                                                <div className="d-flex align-items-center gap-2.5">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="form-check-input"
                                                                        checked={isChecked}
                                                                        onChange={() => {}}
                                                                    />
                                                                    <span className="fw-bold text-dark small">
                                                                        Section {s.section_name}
                                                                    </span>
                                                                </div>
                                                                {isChecked && (
                                                                    <span className="badge rounded-pill bg-teal text-white small" style={{ backgroundColor: '#0d9488' }}>
                                                                        Assigned
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                            )}
                                        </div>
                                    </div>

                                    {/* COLUMN 3: 3. ASSIGNMENT SUMMARY */}
                                    <div className="col-12 col-md-5 bg-light-subtle">
                                        <div className="p-3 border-bottom bg-white fw-bold text-secondary text-uppercase small d-flex align-items-center gap-2">
                                            <i className="bi bi-clipboard-check"></i>
                                            <span>3. Selected Summary</span>
                                        </div>

                                        <div className="p-3 overflow-auto" style={{ maxHeight: 400 }}>
                                            {modalSelectedPairs.length === 0 ? (
                                                <div className="text-center py-5 text-muted">
                                                    <i className="bi bi-card-checklist fs-2 d-block mb-2 opacity-50"></i>
                                                    <p className="small mb-0">Select classes &amp; sections to assign to this coordinator.</p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <h6 className="fw-bold text-dark small mb-2">Assigned Delegations:</h6>
                                                    <div className="d-flex flex-column gap-2">
                                                        {allClasses
                                                            .filter(c => getSelectedCountForClass(c.class_id) > 0)
                                                            .map(c => {
                                                                const classSelectedSections = allSections.filter(s =>
                                                                    Number(s.class_id) === Number(c.class_id) &&
                                                                    modalSelectedPairs.some(p => p.class_id === c.class_id && p.section_id === s.section_id)
                                                                );
                                                                return (
                                                                    <div key={c.class_id} className="p-3 bg-white border rounded-3 shadow-sm">
                                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                                            <span className="fw-bold text-dark">{c.class_name}</span>
                                                                            <span className="badge bg-teal-subtle text-teal fw-bold" style={{ color: '#0f766e', backgroundColor: '#e6fffa' }}>
                                                                                {classSelectedSections.length} Sections
                                                                            </span>
                                                                        </div>
                                                                        <div className="d-flex flex-wrap gap-1.5">
                                                                            {classSelectedSections.map(s => (
                                                                                <span key={s.section_id} className="badge bg-light text-dark border small px-2 py-1">
                                                                                    Section {s.section_name}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="modal-footer border-top bg-white py-3 px-4 d-flex align-items-center justify-content-between">
                                <div>
                                    <span
                                        className="badge rounded-pill px-3 py-2 fw-bold"
                                        style={{ backgroundColor: '#0284c7', color: '#fff', fontSize: '0.85rem' }}
                                    >
                                        <span className="me-1.5">{modalSelectedPairs.length}</span>
                                        Sections selected in total
                                    </span>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-light px-4 py-2 fw-bold rounded-3"
                                        onClick={() => setSelectedCoordinator(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-teal text-white px-4 py-2 fw-bold rounded-3 shadow-sm d-flex align-items-center gap-2"
                                        style={{ backgroundColor: '#134e4a' }}
                                        onClick={handleSaveCoordinatorAssignments}
                                        disabled={savingAssignments}
                                    >
                                        {savingAssignments ? (
                                            <><span className="spinner-border spinner-border-sm" />Saving...</>
                                        ) : (
                                            <><i className="bi bi-check2 fs-5" /><span>Confirm &amp; Save</span></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* ADD HOLIDAY MODAL */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {showHolidayModal && (
                <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 520 }}>
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <div className="modal-header bg-dark text-white border-0 py-3 px-4">
                                <h5 className="modal-title fw-bold text-white mb-0 d-flex align-items-center gap-2">
                                    <i className="bi bi-calendar-plus text-warning"></i>
                                    Schedule New Holiday / Vacation
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowHolidayModal(false)} />
                            </div>

                            <form onSubmit={handleAddHoliday}>
                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="form-label fw-bold small text-secondary">Holiday Title <span className="text-danger">*</span></label>
                                        <input
                                            type="text"
                                            className="form-control fw-bold"
                                            placeholder="e.g. Eid-ul-Fitr, Independence Day, Winter Vacation"
                                            value={holidayTitle}
                                            onChange={e => setHolidayTitle(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-bold small text-secondary">Applies To</label>
                                        <select
                                            className="form-select fw-bold"
                                            value={holidayType}
                                            onChange={e => setHolidayType(e.target.value)}
                                        >
                                            <option value="staff_and_students">Both Staff &amp; Students</option>
                                            <option value="staff_only">Staff Only</option>
                                            <option value="students_only">Students Only</option>
                                        </select>
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-6">
                                            <label className="form-label fw-bold small text-secondary">Start Date <span className="text-danger">*</span></label>
                                            <input
                                                type="date"
                                                className="form-control fw-bold"
                                                value={holidayStartDate}
                                                onChange={e => setHolidayStartDate(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label fw-bold small text-secondary">End Date (Optional)</label>
                                            <input
                                                type="date"
                                                className="form-control fw-bold"
                                                value={holidayEndDate}
                                                onChange={e => setHolidayEndDate(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-bold small text-secondary">Description / Notice Details</label>
                                        <textarea
                                            className="form-control"
                                            rows={2}
                                            placeholder="Optional holiday note for students/staff"
                                            value={holidayDesc}
                                            onChange={e => setHolidayDesc(e.target.value)}
                                        />
                                    </div>

                                    <div className="form-check form-switch mb-2">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="holidayBroadcastCheck"
                                            checked={holidayBroadcast}
                                            onChange={e => setHolidayBroadcast(e.target.checked)}
                                        />
                                        <label className="form-check-label fw-semibold text-dark small" htmlFor="holidayBroadcastCheck">
                                            Send broadcast push notification to portals &amp; mobile app
                                        </label>
                                    </div>
                                </div>

                                <div className="modal-footer border-top bg-light py-2.5 px-4">
                                    <button type="button" className="btn btn-secondary px-3 py-2 fw-bold rounded-3" onClick={() => setShowHolidayModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary px-4 py-2 fw-bold rounded-3 shadow-sm" disabled={savingHoliday}>
                                        {savingHoliday ? 'Saving...' : 'Create Holiday'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .active-card-glow {
                    box-shadow: 0 10px 25px -5px rgba(13, 148, 136, 0.25) !important;
                }
                .cursor-pointer {
                    cursor: pointer;
                }
                .transition-all {
                    transition: all 0.2s ease-in-out;
                }
                .class-list::-webkit-scrollbar,
                .section-list::-webkit-scrollbar {
                    width: 5px;
                }
                .class-list::-webkit-scrollbar-thumb,
                .section-list::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
}
