'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function AttendanceSettingsHubPage() {
    const { user } = useAuth();
    const token = user?.token;

    const [stats, setStats] = useState({
        staff_in_time: '08:00',
        staff_out_time: '14:00',
        staff_grace_minutes: 15,
        staff_biometric_mode: 'both',
        staff_notify_in_out: true,
        holidays_count: 0,
        coordinators_count: 0,
        total_staff_count: 0,
        family_notify_each_child: true
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            setLoading(true);
            try {
                const [setRes, coordRes, holRes] = await Promise.all([
                    fetch(`${API}/attendance/settings`),
                    fetch(`${API}/attendance/coordinators`),
                    fetch(`${API}/attendance/holidays`)
                ]);

                let setData: any = {};
                let coordList: any[] = [];
                let holList: any[] = [];

                if (setRes.ok) {
                    const d = await setRes.json();
                    setData = d.settings || {};
                }
                if (coordRes.ok) {
                    coordList = await coordRes.json();
                }
                if (holRes.ok) {
                    holList = await holRes.json();
                }

                const assignedCoords = Array.isArray(coordList) 
                    ? coordList.filter(c => c.assigned_sections && c.assigned_sections.length > 0).length 
                    : 0;

                setStats({
                    staff_in_time: setData.staff_in_time ? String(setData.staff_in_time).slice(0, 5) : '08:00',
                    staff_out_time: setData.staff_out_time ? String(setData.staff_out_time).slice(0, 5) : '14:00',
                    staff_grace_minutes: setData.staff_grace_minutes || 15,
                    staff_biometric_mode: setData.staff_biometric_mode || 'both',
                    staff_notify_in_out: setData.staff_notify_in_out !== false,
                    holidays_count: Array.isArray(holList) ? holList.length : 0,
                    coordinators_count: assignedCoords,
                    total_staff_count: Array.isArray(coordList) ? coordList.length : 0,
                    family_notify_each_child: setData.family_notify_each_child !== false
                });
            } catch (e) {
                console.error('Failed to load settings hub summary:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, [token]);

    return (
        <div className="attendance-hub-container py-3 py-md-4 px-2 px-sm-3 px-md-4 animate__animated animate__fadeIn">
            {/* Top Navigation & Breadcrumb */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div>
                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb mb-1 small text-muted">
                            <li className="breadcrumb-item"><Link href="/" className="text-decoration-none text-muted">Dashboard</Link></li>
                            <li className="breadcrumb-item"><Link href="/attendance/students" className="text-decoration-none text-muted">Attendance</Link></li>
                            <li className="breadcrumb-item active text-dark fw-bold" aria-current="page">Attendance Settings</li>
                        </ol>
                    </nav>
                    <h2 className="fw-black text-dark mb-1 d-flex align-items-center gap-2.5 fs-3 fs-md-2">
                        <span className="hub-header-icon-wrapper">
                            <i className="bi bi-sliders2-vertical"></i>
                        </span>
                        Attendance Settings Hub
                    </h2>
                    <p className="text-secondary small mb-0">
                        Choose a module below to configure shift timings, biometric modes, holidays, and coordinator class delegations.
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-white text-dark border px-3 py-2 rounded-pill shadow-xs d-flex align-items-center gap-2 small">
                        <span className="status-dot-pulse"></span>
                        <strong>System Active</strong> &bull; Version 2.5
                    </span>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="row g-3 mb-4">
                <div className="col-6 col-lg-3">
                    <div className="stat-pill-card p-3 rounded-4 bg-white border shadow-xs d-flex align-items-center gap-3">
                        <div className="stat-icon-circle bg-teal-subtle text-teal">
                            <i className="bi bi-clock-history"></i>
                        </div>
                        <div>
                            <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>Staff Shift</div>
                            <div className="fw-bold text-dark fs-6">{stats.staff_in_time} - {stats.staff_out_time}</div>
                        </div>
                    </div>
                </div>

                <div className="col-6 col-lg-3">
                    <div className="stat-pill-card p-3 rounded-4 bg-white border shadow-xs d-flex align-items-center gap-3">
                        <div className="stat-icon-circle bg-primary-subtle text-primary">
                            <i className="bi bi-fingerprint"></i>
                        </div>
                        <div>
                            <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>Biometric Mode</div>
                            <div className="fw-bold text-dark fs-6 text-capitalize">{stats.staff_biometric_mode}</div>
                        </div>
                    </div>
                </div>

                <div className="col-6 col-lg-3">
                    <div className="stat-pill-card p-3 rounded-4 bg-white border shadow-xs d-flex align-items-center gap-3">
                        <div className="stat-icon-circle bg-indigo-subtle text-indigo" style={{ color: '#4f46e5', backgroundColor: '#e0e7ff' }}>
                            <i className="bi bi-people-fill"></i>
                        </div>
                        <div>
                            <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>Coordinators</div>
                            <div className="fw-bold text-dark fs-6">{stats.coordinators_count} Assigned</div>
                        </div>
                    </div>
                </div>

                <div className="col-6 col-lg-3">
                    <div className="stat-pill-card p-3 rounded-4 bg-white border shadow-xs d-flex align-items-center gap-3">
                        <div className="stat-icon-circle bg-warning-subtle text-warning">
                            <i className="bi bi-calendar2-week-fill"></i>
                        </div>
                        <div>
                            <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>Holidays</div>
                            <div className="fw-bold text-dark fs-6">{stats.holidays_count} Days Scheduled</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2 Main Interactive Navigation Cards (Click to Navigate to Full Dedicated Page) */}
            <div className="row g-4 mb-4">
                {/* 1. Staff Attendance Setting Card */}
                <div className="col-12 col-lg-6">
                    <Link href="/attendance/settings/staff" className="text-decoration-none">
                        <div className="hub-action-card staff-hub-card h-100 p-4 p-md-5 rounded-4 shadow-sm border position-relative overflow-hidden transition-all">
                            <div className="card-top-glow staff-glow"></div>
                            
                            <div className="d-flex align-items-start justify-content-between mb-4 position-relative">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="hub-card-icon-box staff-icon-box">
                                        <i className="bi bi-person-badge-fill"></i>
                                    </div>
                                    <div>
                                        <span className="badge staff-tag rounded-pill px-3 py-1 text-uppercase fw-bold mb-1">
                                            Configuration Area 01
                                        </span>
                                        <h3 className="fw-bold text-dark mb-0 fs-4 fs-md-3">Staff Attendance Setting</h3>
                                    </div>
                                </div>
                                <div className="arrow-btn staff-arrow-btn">
                                    <i className="bi bi-arrow-right-short"></i>
                                </div>
                            </div>

                            <p className="text-secondary mb-4 position-relative" style={{ lineHeight: '1.6' }}>
                                Manage staff working duty shifts, In-Time and Out-Time limits, grace periods, biometric modes (Fingerprint, Eye Retina / Face ID), staff holidays, and instant mobile push notifications.
                            </p>

                            <div className="features-pill-grid d-flex flex-wrap gap-2 mb-4 position-relative">
                                <span className="feature-pill">
                                    <i className="bi bi-clock-fill text-teal"></i> In: {stats.staff_in_time} | Out: {stats.staff_out_time}
                                </span>
                                <span className="feature-pill">
                                    <i className="bi bi-hourglass-split text-warning"></i> {stats.staff_grace_minutes} Mins Grace
                                </span>
                                <span className="feature-pill">
                                    <i className="bi bi-shield-check text-primary"></i> Biometrics &amp; Retina
                                </span>
                                <span className="feature-pill">
                                    <i className="bi bi-bell-fill text-danger"></i> Mobile Notifications
                                </span>
                            </div>

                            <div className="d-flex align-items-center justify-content-between pt-3 border-top position-relative">
                                <span className="text-muted small fw-semibold">Click to open full staff settings page</span>
                                <span className="btn-open-link staff-open-link fw-bold">
                                    <span>Configure Staff Settings</span>
                                    <i className="bi bi-chevron-right ms-1"></i>
                                </span>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* 2. Student Attendance Setting Card */}
                <div className="col-12 col-lg-6">
                    <Link href="/attendance/settings/students" className="text-decoration-none">
                        <div className="hub-action-card student-hub-card h-100 p-4 p-md-5 rounded-4 shadow-sm border position-relative overflow-hidden transition-all">
                            <div className="card-top-glow student-glow"></div>

                            <div className="d-flex align-items-start justify-content-between mb-4 position-relative">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="hub-card-icon-box student-icon-box">
                                        <i className="bi bi-mortarboard-fill"></i>
                                    </div>
                                    <div>
                                        <span className="badge student-tag rounded-pill px-3 py-1 text-uppercase fw-bold mb-1">
                                            Configuration Area 02
                                        </span>
                                        <h3 className="fw-bold text-dark mb-0 fs-4 fs-md-3">Student Attendance Setting</h3>
                                    </div>
                                </div>
                                <div className="arrow-btn student-arrow-btn">
                                    <i className="bi bi-arrow-right-short"></i>
                                </div>
                            </div>

                            <p className="text-secondary mb-4 position-relative" style={{ lineHeight: '1.6' }}>
                                Delegate class and section attendance to School Coordinators via our 3-column assignment tool, configure student vacation calendars, and setup personalized family multi-child attendance notifications with 3-day absent policies.
                            </p>

                            <div className="features-pill-grid d-flex flex-wrap gap-2 mb-4 position-relative">
                                <span className="feature-pill">
                                    <i className="bi bi-person-lines-fill text-primary"></i> Coordinators Assignment
                                </span>
                                <span className="feature-pill">
                                    <i className="bi bi-chat-heart-fill text-danger"></i> Family Per-Child Alerts
                                </span>
                                <span className="feature-pill">
                                    <i className="bi bi-exclamation-octagon-fill text-warning"></i> 3-Day Absent Rule
                                </span>
                                <span className="feature-pill">
                                    <i className="bi bi-sun-fill text-warning"></i> Vacations &amp; Holidays
                                </span>
                            </div>

                            <div className="d-flex align-items-center justify-content-between pt-3 border-top position-relative">
                                <span className="text-muted small fw-semibold">Click to open full student settings page</span>
                                <span className="btn-open-link student-open-link fw-bold">
                                    <span>Configure Student Settings</span>
                                    <i className="bi bi-chevron-right ms-1"></i>
                                </span>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Bottom Support Banner */}
            <div className="p-3.5 p-md-4 rounded-4 bg-white border shadow-xs d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-3">
                    <div className="rounded-3 p-2.5 bg-light text-secondary fs-4">
                        <i className="bi bi-info-circle-fill text-primary"></i>
                    </div>
                    <div>
                        <h6 className="fw-bold text-dark mb-0.5">Role Permission Access Notice</h6>
                        <p className="text-muted small mb-0">
                            Attendance settings and coordinator assignments are managed by Administrators and Principals. Settings take effect in real-time across Web &amp; Mobile apps.
                        </p>
                    </div>
                </div>
                <Link href="/settings/roles" className="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1.5 fw-bold text-nowrap">
                    <i className="bi bi-shield-lock me-1"></i> Manage User Roles
                </Link>
            </div>

            <style jsx>{`
                .attendance-hub-container {
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .hub-header-icon-wrapper {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 44px;
                    height: 44px;
                    background: linear-gradient(135deg, #0d9488, #115e59);
                    color: #fff;
                    border-radius: 12px;
                    font-size: 1.3rem;
                    box-shadow: 0 4px 12px rgba(13, 148, 136, 0.25);
                }
                .status-dot-pulse {
                    width: 8px;
                    height: 8px;
                    background-color: #10b981;
                    border-radius: 50%;
                    display: inline-block;
                    animation: pulseDot 2s infinite;
                }
                @keyframes pulseDot {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                .stat-icon-circle {
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                }
                .text-teal { color: #0d9488 !important; }
                .bg-teal-subtle { background-color: #ccfbf1 !important; }

                /* Action Cards */
                .hub-action-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .hub-action-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.08) !important;
                }
                .staff-hub-card:hover {
                    border-color: #0d9488;
                }
                .student-hub-card:hover {
                    border-color: #2563eb;
                }

                .card-top-glow {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                }
                .staff-glow {
                    background: linear-gradient(90deg, #0d9488, #14b8a6, #2dd4bf);
                }
                .student-glow {
                    background: linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa);
                }

                .hub-card-icon-box {
                    width: 54px;
                    height: 54px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.6rem;
                    color: #ffffff;
                }
                .staff-icon-box {
                    background: linear-gradient(135deg, #0d9488, #0f766e);
                    box-shadow: 0 8px 16px rgba(13, 148, 136, 0.25);
                }
                .student-icon-box {
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    box-shadow: 0 8px 16px rgba(37, 99, 235, 0.25);
                }

                .staff-tag {
                    background-color: #f0fdfa;
                    color: #0f766e;
                    border: 1px solid #ccfbf1;
                    font-size: 0.72rem;
                }
                .student-tag {
                    background-color: #eff6ff;
                    color: #1d4ed8;
                    border: 1px solid #dbeafe;
                    font-size: 0.72rem;
                }

                .arrow-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                    transition: all 0.2s ease;
                }
                .hub-action-card:hover .staff-arrow-btn {
                    background: #0d9488;
                    color: #ffffff;
                    border-color: #0d9488;
                    transform: translateX(4px);
                }
                .hub-action-card:hover .student-arrow-btn {
                    background: #2563eb;
                    color: #ffffff;
                    border-color: #2563eb;
                    transform: translateX(4px);
                }

                .feature-pill {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    color: #334155;
                    font-size: 0.8rem;
                    font-weight: 600;
                    padding: 6px 12px;
                    border-radius: 20px;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .staff-open-link {
                    color: #0d9488;
                    display: inline-flex;
                    align-items: center;
                    font-size: 0.9rem;
                    transition: all 0.2s ease;
                }
                .student-open-link {
                    color: #2563eb;
                    display: inline-flex;
                    align-items: center;
                    font-size: 0.9rem;
                    transition: all 0.2s ease;
                }
                .hub-action-card:hover .btn-open-link {
                    gap: 4px;
                }
            `}</style>
        </div>
    );
}
