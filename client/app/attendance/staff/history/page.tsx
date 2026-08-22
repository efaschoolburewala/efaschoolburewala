'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Department { 
    department_id: number; 
    department_name: string; 
}

interface DailyAttendanceDetail {
    status: string;
    check_in_time: string | null;
    check_out_time: string | null;
    in_verified?: boolean;
    out_verified?: boolean;
    is_in_late?: boolean;
    is_out_early?: boolean;
    remarks?: string | null;
    holiday_name?: string;
}

interface StaffHistory {
    employee_id: number; 
    first_name: string; 
    last_name: string;
    designation: string; 
    department_name: string;
    present: number; 
    absent: number; 
    late_in: number;
    early_out: number;
    leave: number; 
    holiday?: number;
    total_days: number; 
    daily: Record<string, DailyAttendanceDetail | string>;
}

const S_COLOR: Record<string, string> = { 
    Present: '#0d9e6e', 
    Absent: '#e13232', 
    Late: '#e6860a', 
    Leave: '#1a6fd4', 
    Holiday: '#7c3aed' 
};

const S_ABBR: Record<string, string> = { 
    Present: 'P', 
    Absent: 'A', 
    Late: 'L', 
    Leave: 'V', 
    Holiday: 'H' 
};

const S_BG: Record<string, string> = { 
    Present: '#e6f9f3', 
    Absent: '#fde8e8', 
    Late: '#fef6e4', 
    Leave: '#e8f0fd', 
    Holiday: '#f3e8ff' 
};

function formatTime(timeStr: string | null | undefined): string | null {
    if (!timeStr) return null;
    try {
        const parts = timeStr.split(':');
        const h = parseInt(parts[0], 10);
        const m = parts[1];
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        return `${displayH}:${m} ${ampm}`;
    } catch {
        return timeStr;
    }
}

function AttBadge({ detail, dateStr }: { detail: DailyAttendanceDetail | string; dateStr: string }) {
    const status = typeof detail === 'string' ? detail : (detail?.status || 'Present');
    const inTime = typeof detail === 'object' ? formatTime(detail?.check_in_time) : null;
    const outTime = typeof detail === 'object' ? formatTime(detail?.check_out_time) : null;
    const isLate = typeof detail === 'object' ? detail?.is_in_late : status === 'Late';
    const isEarly = typeof detail === 'object' ? detail?.is_out_early : false;

    let tooltipText = `${dateStr} · Status: ${status}`;
    if (inTime) tooltipText += ` | IN: ${inTime}${isLate ? ' (Late)' : ''}`;
    if (outTime) tooltipText += ` | OUT: ${outTime}${isEarly ? ' (Early Exit)' : ''}`;

    return (
        <div className="d-flex flex-column align-items-center justify-content-center py-1" title={tooltipText}>
            <span 
                style={{
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: 26, 
                    height: 26, 
                    borderRadius: '50%', 
                    fontSize: '0.68rem', 
                    fontWeight: 700,
                    background: S_BG[status] ?? '#f1f3f5', 
                    color: S_COLOR[status] ?? '#6c757d',
                    border: `1.5px solid ${(S_COLOR[status] ?? '#6c757d')}44`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
            >
                {S_ABBR[status] ?? '—'}
            </span>

            {/* Micro Time Indicators below badge */}
            {inTime && (
                <span className="font-monospace text-muted mt-0.5" style={{ fontSize: '0.58rem', lineHeight: 1 }}>
                    <span className={isLate ? 'text-warning fw-bold' : 'text-success'}>↓{inTime.split(' ')[0]}</span>
                </span>
            )}
            {outTime && (
                <span className="font-monospace text-muted" style={{ fontSize: '0.58rem', lineHeight: 1 }}>
                    <span className={isEarly ? 'text-danger fw-bold' : 'text-primary'}>↑{outTime.split(' ')[0]}</span>
                </span>
            )}
        </div>
    );
}

export default function StaffAttendanceHistoryPage() {
    const now = new Date();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [deptId, setDeptId] = useState('');
    const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
    const [year, setYear] = useState(String(now.getFullYear()));
    const [data, setData] = useState<{ 
        staff: StaffHistory[]; 
        working_dates: string[]; 
        holidays?: Record<string, string>;
        settings?: any;
    } | null>(null);

    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<StaffHistory | null>(null);

    const API = (process.env.NEXT_PUBLIC_API_URL || "https://demo-private-school.onrender.com").replace(/\/+$/, '').replace(/\/api$/, '');

    const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    useEffect(() => {
        fetch(`${API}/attendance/departments`)
            .then(r => r.json())
            .then(d => Array.isArray(d) && setDepartments(d))
            .catch(() => {});
    }, [API]);

    const loadHistory = useCallback(async () => {
        if (!month || !year) return;
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                month,
                year
            });
            if (deptId) queryParams.append('department_id', deptId);

            const res = await fetch(`${API}/attendance/staff/history?${queryParams.toString()}`);
            const d = await res.json();
            if (d.staff) {
                setData(d);
            }
        } catch (err) {
            console.error('History load error:', err);
        } finally {
            setLoading(false);
        }
    }, [API, deptId, month, year]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const allStaff = data?.staff ?? [];
    const dates = data?.working_dates ?? [];
    const visibleDates = filterDate ? dates.filter(d => d === filterDate) : dates;

    const totals = allStaff.reduce((a, s) => ({
        present: a.present + s.present,
        absent: a.absent + s.absent,
        late_in: a.late_in + (s.late_in || 0),
        early_out: a.early_out + (s.early_out || 0),
        leave: a.leave + s.leave
    }), { present: 0, absent: 0, late_in: 0, early_out: 0, leave: 0 });

    const filtered = allStaff.filter(s =>
        `${s.first_name} ${s.last_name} ${s.designation} ${s.department_name}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    const avgPct = allStaff.length 
        ? Math.round(allStaff.reduce((a, s) => a + (s.total_days ? ((s.present + (s.late_in || 0)) / s.total_days) * 100 : 0), 0) / allStaff.length) 
        : 0;

    const fmtDate = (d: string) => { 
        const dt = new Date(d + 'T00:00:00'); 
        return { 
            day: dt.getDate(), 
            dow: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dt.getDay()] 
        }; 
    };

    const dept = departments.find(d => String(d.department_id) === deptId);

    return (
        <div className="container-fluid px-3 px-md-4 py-3 animate__animated animate__fadeIn">

            {/* HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-clock-history me-2" style={{ color: 'var(--accent-orange)' }} />
                        Staff Attendance History &amp; Timesheets
                    </h2>
                    <p className="text-muted mb-0 small">
                        Monthly records with dual IN &amp; OUT timestamps, Late Arrival &amp; Early Exit detection
                    </p>
                </div>

                {data && (
                    <span className="badge rounded-pill px-3 py-2" style={{ background: 'rgba(33,94,97,0.1)', color: 'var(--primary-teal)', fontWeight: 600, fontSize: '0.85rem' }}>
                        <i className="bi bi-building me-1" />
                        {dept?.department_name || 'All Departments'} · {monthNames[+month - 1]} {year}
                    </span>
                )}
            </div>

            {/* FILTER BAR */}
            <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body p-3 p-md-4">
                    <div className="row g-3 align-items-end">
                        
                        {/* Department */}
                        <div className="col-12 col-md-3">
                            <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                <i className="bi bi-building me-1" style={{ color: 'var(--primary-teal)' }} />Department
                            </label>
                            <select className="form-select rounded-3" value={deptId} onChange={e => setDeptId(e.target.value)} style={{ border: '1.5px solid #dee2e6', height: 42 }}>
                                <option value="">All Departments</option>
                                {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                            </select>
                        </div>

                        {/* Month */}
                        <div className="col-6 col-md-2">
                            <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                <i className="bi bi-calendar3 me-1" style={{ color: 'var(--primary-teal)' }} />Month
                            </label>
                            <select className="form-select rounded-3" value={month} onChange={e => setMonth(e.target.value)} style={{ border: '1.5px solid #dee2e6', height: 42 }}>
                                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m, i) => (
                                    <option key={m} value={m}>{monthNames[i]}</option>
                                ))}
                            </select>
                        </div>

                        {/* Year */}
                        <div className="col-6 col-md-2">
                            <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                <i className="bi bi-calendar-event me-1" style={{ color: 'var(--primary-teal)' }} />Year
                            </label>
                            <select className="form-select rounded-3" value={year} onChange={e => setYear(e.target.value)} style={{ border: '1.5px solid #dee2e6', height: 42 }}>
                                {years.map(y => <option key={y}>{y}</option>)}
                            </select>
                        </div>

                        {/* Specific Date Filter */}
                        <div className="col-12 col-md-3">
                            <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--primary-dark)', letterSpacing: '0.05em' }}>
                                <i className="bi bi-calendar-day me-1" style={{ color: 'var(--primary-teal)' }} />Filter Day
                            </label>
                            <div className="input-group">
                                <input 
                                    type="date" 
                                    className="form-control rounded-start-3" 
                                    value={filterDate}
                                    onChange={e => { 
                                        setFilterDate(e.target.value); 
                                        if (e.target.value) { 
                                            const d = new Date(e.target.value); 
                                            setMonth(String(d.getMonth() + 1).padStart(2, '0')); 
                                            setYear(String(d.getFullYear())); 
                                        } 
                                    }}
                                    style={{ border: '1.5px solid #dee2e6', height: 42 }} 
                                />
                                {filterDate && (
                                    <button className="btn btn-outline-secondary" style={{ height: 42 }} onClick={() => setFilterDate('')}>
                                        <i className="bi bi-x-lg" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Reload Button */}
                        <div className="col-12 col-md-2">
                            <button className="btn btn-primary-custom w-100 fw-bold rounded-3" style={{ height: 42 }} onClick={loadHistory} disabled={loading}>
                                {loading ? <><span className="spinner-border spinner-border-sm me-2" />Loading...</> : <><i className="bi bi-arrow-repeat me-2" />Refresh</>}
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            {data && (
                <>
                    {/* STAT COUNTERS */}
                    <div className="row g-3 mb-4">
                        <div className="col-6 col-lg-2">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ borderBottom: '3px solid #0d9e6e' }}>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="rounded-3 p-2 text-success" style={{ background: '#e6f9f3' }}>
                                        <i className="bi bi-check-circle-fill fs-5" />
                                    </div>
                                    <div>
                                        <div className="fs-4 fw-bold text-success">{totals.present}</div>
                                        <div className="text-muted small text-uppercase" style={{ fontSize: '0.68rem' }}>Present</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-lg-2">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ borderBottom: '3px solid #e6860a' }}>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="rounded-3 p-2 text-warning" style={{ background: '#fef6e4' }}>
                                        <i className="bi bi-clock-history fs-5" />
                                    </div>
                                    <div>
                                        <div className="fs-4 fw-bold text-warning">{totals.late_in}</div>
                                        <div className="text-muted small text-uppercase" style={{ fontSize: '0.68rem' }}>Late Entries</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-lg-2">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ borderBottom: '3px solid #f97316' }}>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="rounded-3 p-2" style={{ background: '#fff7ed', color: '#f97316' }}>
                                        <i className="bi bi-box-arrow-right fs-5" />
                                    </div>
                                    <div>
                                        <div className="fs-4 fw-bold" style={{ color: '#f97316' }}>{totals.early_out}</div>
                                        <div className="text-muted small text-uppercase" style={{ fontSize: '0.68rem' }}>Early Exits</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-lg-2">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ borderBottom: '3px solid #e13232' }}>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="rounded-3 p-2 text-danger" style={{ background: '#fde8e8' }}>
                                        <i className="bi bi-x-circle-fill fs-5" />
                                    </div>
                                    <div>
                                        <div className="fs-4 fw-bold text-danger">{totals.absent}</div>
                                        <div className="text-muted small text-uppercase" style={{ fontSize: '0.68rem' }}>Absent</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-lg-2">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ borderBottom: '3px solid #1a6fd4' }}>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="rounded-3 p-2 text-primary" style={{ background: '#e8f0fd' }}>
                                        <i className="bi bi-calendar2-check fs-5" />
                                    </div>
                                    <div>
                                        <div className="fs-4 fw-bold text-primary">{totals.leave}</div>
                                        <div className="text-muted small text-uppercase" style={{ fontSize: '0.68rem' }}>Leaves</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-lg-2">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3" style={{ borderBottom: '3px solid var(--primary-teal)' }}>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="rounded-3 p-2" style={{ background: 'rgba(33,94,97,0.1)', color: 'var(--primary-teal)' }}>
                                        <i className="bi bi-bar-chart-fill fs-5" />
                                    </div>
                                    <div>
                                        <div className="fs-4 fw-bold" style={{ color: 'var(--primary-teal)' }}>{avgPct}%</div>
                                        <div className="text-muted small text-uppercase" style={{ fontSize: '0.68rem' }}>Punctuality</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SEARCH + LEGEND */}
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 gap-2">
                        <div className="d-flex align-items-center gap-3 flex-wrap">
                            <span className="fw-semibold small" style={{ color: 'var(--primary-dark)' }}>
                                <i className="bi bi-people-fill me-1 text-primary" />
                                {allStaff.length} Staff Members · {visibleDates.length} Recorded Days
                            </span>
                            <div className="d-flex gap-2 flex-wrap">
                                {Object.entries(S_ABBR).map(([s, a]) => (
                                    <span key={s} style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: S_BG[s], color: S_COLOR[s], fontSize: '0.62rem', fontWeight: 700 }}>{a}</span>
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="input-group" style={{ maxWidth: 260 }}>
                            <span className="input-group-text bg-white border-end-0"><i className="bi bi-search text-muted" style={{ fontSize: '0.8rem' }} /></span>
                            <input 
                                type="text" 
                                className="form-control border-start-0" 
                                placeholder="Search staff name or role…"
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                                style={{ fontSize: '0.85rem' }} 
                            />
                        </div>
                    </div>

                    {/* MAIN TIMESHEET TABLE */}
                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                        <div className="table-responsive" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                            <table className="table table-hover align-middle mb-0" style={{ minWidth: 780 }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--primary-dark)' }}>
                                    <tr>
                                        <th className="border-0 fw-semibold text-white ps-3 py-3" style={{ fontSize: '0.72rem', textTransform: 'uppercase', minWidth: 220 }}>Staff Member</th>
                                        <th className="border-0 fw-semibold text-white d-none d-md-table-cell py-3" style={{ fontSize: '0.72rem', textTransform: 'uppercase', minWidth: 120 }}>Department</th>
                                        <th className="border-0 fw-semibold text-white text-center py-3" style={{ fontSize: '0.72rem', textTransform: 'uppercase', minWidth: 60 }}>Att%</th>
                                        
                                        {/* Date Headers */}
                                        {visibleDates.map(d => {
                                            const { day, dow } = fmtDate(d);
                                            const holidayTitle = data?.holidays?.[d];
                                            return (
                                                <th 
                                                    key={d} 
                                                    className="border-0 text-center py-2"
                                                    title={holidayTitle ? `Holiday: ${holidayTitle}` : d}
                                                    style={{
                                                        color: holidayTitle ? '#c4b5fd' : filterDate ? '#ffd700' : 'rgba(255,255,255,0.85)',
                                                        fontSize: '0.64rem', 
                                                        minWidth: 42, 
                                                        lineHeight: 1.1,
                                                        background: holidayTitle ? 'rgba(124,58,237,0.35)' : undefined
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 400 }}>{holidayTitle ? '🏖️' : dow}</div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.74rem' }}>{day}</div>
                                                </th>
                                            );
                                        })}

                                        {/* Aggregate Columns */}
                                        {['P', 'Late', 'Exit', 'A', 'V'].map(h => (
                                            <th key={h} className="border-0 text-center text-white-50 py-3" style={{ fontSize: '0.70rem', minWidth: 38 }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((s, idx) => {
                                        const pct = s.total_days ? Math.round(((s.present + (s.late_in || 0)) / s.total_days) * 100) : 0;
                                        return (
                                            <tr 
                                                key={s.employee_id} 
                                                onClick={() => setSelectedEmployee(s)}
                                                style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', cursor: 'pointer' }}
                                                title="Click to view detailed employee monthly timesheet"
                                            >
                                                {/* Staff Name & ID */}
                                                <td className="ps-3 py-2.5">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-xs"
                                                            style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--primary-dark), var(--primary-teal))', fontSize: '0.72rem', flexShrink: 0 }}>
                                                            {s.first_name[0]}{s.last_name[0]}
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-dark" style={{ fontSize: '0.86rem' }}>
                                                                {s.first_name} {s.last_name}
                                                            </div>
                                                            <div className="text-muted small" style={{ fontSize: '0.70rem' }}>
                                                                {s.designation || 'Staff'} · #{s.employee_id}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Department */}
                                                <td className="d-none d-md-table-cell">
                                                    <span className="badge text-bg-light border" style={{ fontSize: '0.74rem' }}>
                                                        {s.department_name || '—'}
                                                    </span>
                                                </td>

                                                {/* Percentage */}
                                                <td className="text-center">
                                                    <span className="badge rounded-pill fw-bold" style={{
                                                        fontSize: '0.72rem',
                                                        background: pct >= 75 ? '#e6f9f3' : pct >= 50 ? '#fef6e4' : '#fde8e8',
                                                        color: pct >= 75 ? '#0d9e6e' : pct >= 50 ? '#e6860a' : '#e13232'
                                                    }}>
                                                        {pct}%
                                                    </span>
                                                </td>

                                                {/* Daily Cells with IN/OUT Details */}
                                                {visibleDates.map(d => (
                                                    <td key={d} className="text-center px-0.5">
                                                        {s.daily[d] ? (
                                                            <AttBadge detail={s.daily[d]} dateStr={d} />
                                                        ) : (
                                                            <span style={{ color: '#cbd5e1', fontSize: '0.65rem' }}>—</span>
                                                        )}
                                                    </td>
                                                ))}

                                                {/* Totals */}
                                                <td className="text-center fw-bold text-success" style={{ fontSize: '0.80rem' }}>{s.present}</td>
                                                <td className="text-center fw-bold text-warning" style={{ fontSize: '0.80rem' }}>{s.late_in || 0}</td>
                                                <td className="text-center fw-bold" style={{ fontSize: '0.80rem', color: '#f97316' }}>{s.early_out || 0}</td>
                                                <td className="text-center fw-bold text-danger" style={{ fontSize: '0.80rem' }}>{s.absent}</td>
                                                <td className="text-center fw-bold text-primary" style={{ fontSize: '0.80rem' }}>{s.leave}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* DETAILED EMPLOYEE TIMESHEET MODAL */}
            {selectedEmployee && (
                <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            
                            {/* Modal Header */}
                            <div className="modal-header border-0 text-white px-4 py-3" style={{ background: 'linear-gradient(135deg, var(--primary-dark), var(--primary-teal))' }}>
                                <div className="d-flex align-items-center gap-3">
                                    <div className="rounded-circle d-flex align-items-center justify-content-center bg-white text-dark fw-bold" style={{ width: 44, height: 44, fontSize: '1rem' }}>
                                        {selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}
                                    </div>
                                    <div>
                                        <h5 className="modal-title fw-bold mb-0">
                                            {selectedEmployee.first_name} {selectedEmployee.last_name}
                                        </h5>
                                        <small className="text-white-50">
                                            {selectedEmployee.designation} · {selectedEmployee.department_name} · #{selectedEmployee.employee_id}
                                        </small>
                                    </div>
                                </div>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedEmployee(null)} />
                            </div>

                            {/* Modal Body */}
                            <div className="modal-body p-4">
                                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 border-bottom pb-3">
                                    <h6 className="fw-bold mb-0" style={{ color: 'var(--primary-dark)' }}>
                                        Daily IN / OUT Attendance Log ({monthNames[+month - 1]} {year})
                                    </h6>
                                    <div className="d-flex gap-2">
                                        <span className="badge bg-success-subtle text-success">Present: {selectedEmployee.present}</span>
                                        <span className="badge bg-warning-subtle text-warning-emphasis">Late: {selectedEmployee.late_in || 0}</span>
                                        <span className="badge bg-danger-subtle text-danger">Absent: {selectedEmployee.absent}</span>
                                        <span className="badge bg-primary-subtle text-primary">Leaves: {selectedEmployee.leave}</span>
                                    </div>
                                </div>

                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th className="small fw-bold">Date</th>
                                                <th className="small fw-bold">Status</th>
                                                <th className="small fw-bold">IN Time (Arrival)</th>
                                                <th className="small fw-bold">OUT Time (Departure)</th>
                                                <th className="small fw-bold">Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dates.map(d => {
                                                const raw = selectedEmployee.daily[d];
                                                const detail: DailyAttendanceDetail = typeof raw === 'object' 
                                                    ? raw 
                                                    : { status: raw || 'Present', check_in_time: null, check_out_time: null };
                                                
                                                const inFmt = formatTime(detail.check_in_time);
                                                const outFmt = formatTime(detail.check_out_time);
                                                const dt = new Date(d + 'T00:00:00');
                                                const dayName = dt.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' });

                                                return (
                                                    <tr key={d}>
                                                        <td className="fw-semibold small">{dayName}</td>
                                                        <td>
                                                            <span className="badge rounded-pill" style={{
                                                                background: S_BG[detail.status] || '#f1f5f9',
                                                                color: S_COLOR[detail.status] || '#475569',
                                                                border: `1px solid ${S_COLOR[detail.status] || '#cbd5e1'}44`
                                                            }}>
                                                                {detail.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {inFmt ? (
                                                                <span className="fw-bold font-monospace small">
                                                                    <i className="bi bi-box-arrow-in-right text-success me-1" />
                                                                    {inFmt}
                                                                    {detail.is_in_late && (
                                                                        <span className="badge bg-warning-subtle text-warning-emphasis ms-1.5" style={{ fontSize: '0.65rem' }}>Late</span>
                                                                    )}
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted small">—</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {outFmt ? (
                                                                <span className="fw-bold font-monospace small">
                                                                    <i className="bi bi-box-arrow-right text-primary me-1" />
                                                                    {outFmt}
                                                                    {detail.is_out_early && (
                                                                        <span className="badge bg-warning-subtle text-warning-emphasis ms-1.5" style={{ fontSize: '0.65rem' }}>Early</span>
                                                                    )}
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted small">—</span>
                                                            )}
                                                        </td>
                                                        <td className="small text-muted">
                                                            {detail.holiday_name || detail.remarks || '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="modal-footer border-0 p-3 bg-light">
                                <button type="button" className="btn btn-secondary rounded-3" onClick={() => setSelectedEmployee(null)}>
                                    Close
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
