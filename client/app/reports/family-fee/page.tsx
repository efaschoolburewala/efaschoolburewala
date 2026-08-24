'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip as RechartsTooltip,
    Legend,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ReferenceLine
} from 'recharts';

type AcademicYear = { id: number; year_name: string; is_active: boolean; status: string; start_date?: string; end_date?: string };
type Class = { class_id: number; class_name: string };
type Section = { section_id: number; section_name: string; class_id: number };
type FeeHead = { head_id: number; head_name: string };
type LineItem = { slip_id: number; head_id: number; head_name: string; amount: number; paid_amount: number };
type FeeSlip = {
    slip_id: number;
    student_id: number;
    family_id: number;
    month: number;
    year: number;
    total_amount: number;
    paid_amount: number;
    balance?: number;
    status: string;
    due_date: string;
    issue_date?: string;
    student_name: string;
    admission_no: string;
    roll_no?: string;
    father_name?: string;
    father_phone?: string;
    family_name: string;
    class_name: string;
    section_name: string;
    line_items: LineItem[];
};

type HeadSummary = {
    head_id?: number;
    head_name: string;
    total: number;
    collected: number;
    pending: number;
    collection_rate: number;
    percentage: number;
    students_count?: number;
};

type Collective = {
    total_billed: number;
    total_collected: number;
    total_pending: number;
    total_students: number;
    paid_count: number;
    partial_count: number;
    unpaid_count: number;
    collection_rate?: number;
};

type TimelinePoint = {
    date: string;
    day: string;
    day_num: number;
    daily_collected: number;
    cumulative_collected: number;
    target_billed: number;
    remaining_dues: number;
    collection_rate: number;
};

type WeeklySummary = {
    week: string;
    days: number[];
    collected: number;
    percentage: number;
};

interface AvailableMonth {
    value: string;
    label: string;
    months: number[];
}

const PALETTE = [
    '#0f766e', '#f59e0b', '#6366f1', '#10b981', '#f43f5e',
    '#06b6d4', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6',
    '#84cc16', '#e11d48'
];

export default function FamilyFeeReportPage() {
    const now = new Date();
    const [years, setYears] = useState<AcademicYear[]>([]);
    const [academicYearId, setAcademicYearId] = useState<string>('');
    const [classes, setClasses] = useState<Class[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [filteredSections, setFilteredSections] = useState<Section[]>([]);
    const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);

    const [month, setMonth] = useState<string>('');
    const [year, setYear] = useState<string>(String(now.getFullYear()));
    const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
    const [loadingMonths, setLoadingMonths] = useState<boolean>(true);
    const [classId, setClassId] = useState('');
    const [sectionId, setSectionId] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [headId, setHeadId] = useState('');
    const [asOfDate, setAsOfDate] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');

    const [timelineView, setTimelineView] = useState<'daily' | 'weekly'>('daily');

    const [slips, setSlips] = useState<FeeSlip[]>([]);
    const [headSummary, setHeadSummary] = useState<HeadSummary[]>([]);
    const [collective, setCollective] = useState<Collective | null>(null);
    const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
    const [weeklySummary, setWeeklySummary] = useState<WeeklySummary[]>([]);
    const [selectedHeadInfo, setSelectedHeadInfo] = useState<HeadSummary | null>(null);
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [uniqueHeads, setUniqueHeads] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://demo-private-school.onrender.com"}/academic/years`)
            .then(r => r.json())
            .then((data: AcademicYear[]) => {
                if (Array.isArray(data) && data.length > 0) {
                    setYears(data);
                    const active = data.find(y => y.is_active || y.status === 'active') || data[0];
                    if (active) setAcademicYearId(String(active.id));
                }
            })
            .catch(console.error);

        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://demo-private-school.onrender.com"}/academic/classes`).then(r => r.json()).then(setClasses).catch(console.error);
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://demo-private-school.onrender.com"}/academic/sections`).then(r => r.json()).then(setSections).catch(console.error);
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://demo-private-school.onrender.com"}/reports/fee-heads`).then(r => r.json()).then(setFeeHeads).catch(console.error);
    }, []);

    useEffect(() => {
        if (!academicYearId) return;
        setLoadingMonths(true);
        const selYear = years.find(y => String(y.id) === academicYearId);
        const yParam = selYear?.start_date ? new Date(selYear.start_date).getFullYear().toString() : year;
        if (yParam) setYear(yParam);

        fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://demo-private-school.onrender.com"}/fee-slips/available-months?academic_year_id=${academicYearId}`)
            .then(r => r.json())
            .then(data => {
                if (data.months) {
                    setAvailableMonths(data.months);
                    if (data.months.length > 0) {
                        const currentM = (new Date().getMonth() + 1);
                        const exact = data.months.find((m: AvailableMonth) => m.months.includes(currentM));
                        setMonth(exact ? exact.value : data.months[data.months.length - 1].value);
                    } else {
                        setMonth('');
                        setSlips([]);
                        setHeadSummary([]);
                        setCollective(null);
                        setTimeline([]);
                        setWeeklySummary([]);
                    }
                }
            })
            .catch(() => {
                setAvailableMonths([]);
                setMonth('');
            })
            .finally(() => setLoadingMonths(false));
    }, [academicYearId, years]);

    useEffect(() => {
        if (month && year) {
            const mNum = parseInt(month.split(',')[0], 10);
            const yNum = parseInt(year, 10);
            if (!isNaN(mNum) && !isNaN(yNum)) {
                const daysInM = new Date(yNum, mNum, 0).getDate();
                const start = `${yNum}-${String(mNum).padStart(2, '0')}-01`;
                const end = `${yNum}-${String(mNum).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
                setDateRange({ start, end });
                if (asOfDate && (asOfDate < start || asOfDate > end)) {
                    setAsOfDate('');
                }
            }
        }
    }, [month, year]);

    useEffect(() => {
        setSectionId('');
        setFilteredSections(classId ? sections.filter(s => s.class_id === Number(classId)) : sections);
    }, [classId, sections]);

    const loadReport = async () => {
        if (!month || !year) {
            setSlips([]); setHeadSummary([]); setCollective(null); setError(''); setLoading(false);
            return;
        }
        setLoading(true); setError('');
        try {
            const params = new URLSearchParams({ month, year });
            if (academicYearId) params.append('academic_year_id', academicYearId);
            if (classId) params.append('class_id', classId);
            if (sectionId) params.append('section_id', sectionId);
            if (statusFilter) params.append('status', statusFilter);
            if (headId) params.append('head_id', headId);
            if (asOfDate) params.append('as_of_date', asOfDate);

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://demo-private-school.onrender.com"}/reports/family-fee?${params}`);
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to load report');
            const data = await res.json();

            const parsedSlips: FeeSlip[] = (data.slips || []).map((s: FeeSlip) => ({
                ...s,
                total_amount: Number(s.total_amount),
                paid_amount: Number(s.paid_amount),
                balance: Number(s.balance !== undefined ? s.balance : s.total_amount - s.paid_amount),
                line_items: (s.line_items || []).map((li: LineItem) => ({
                    ...li,
                    amount: Number(li.amount),
                    paid_amount: Number(li.paid_amount || 0)
                })),
            }));

            const headSet = new Set<string>();
            parsedSlips.forEach(s => s.line_items.forEach(li => headSet.add(li.head_name)));
            setUniqueHeads(Array.from(headSet).sort());

            setSlips(parsedSlips);
            setHeadSummary(data.headSummary || []);
            setCollective(data.collective || null);
            setTimeline(data.timeline || []);
            setWeeklySummary(data.weeklySummary || []);
            setSelectedHeadInfo(data.selectedHeadInfo || null);
            if (data.dateRange) setDateRange(data.dateRange);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const filteredSlips = useMemo(() => {
        if (!searchKeyword.trim()) return slips;
        const q = searchKeyword.toLowerCase().trim();
        return slips.filter(s =>
            (s.student_name || '').toLowerCase().includes(q) ||
            (s.father_name || '').toLowerCase().includes(q) ||
            (s.admission_no || '').toLowerCase().includes(q) ||
            (s.family_name || '').toLowerCase().includes(q) ||
            (s.class_name || '').toLowerCase().includes(q)
        );
    }, [slips, searchKeyword]);

    const currentSelMonth = availableMonths.find(m => m.value === month);
    const monthLabel = currentSelMonth ? currentSelMonth.label : (month ? `Month ${month}` : 'No Fee Slips');
    const classLabel = classId ? classes.find(c => String(c.class_id) === classId)?.class_name || '' : '';
    const secLabel = sectionId ? filteredSections.find(s => String(s.section_id) === sectionId)?.section_name || '' : '';
    const activeYearName = years.find(y => String(y.id) === academicYearId)?.year_name || years.find(y => y.is_active)?.year_name || '';

    const statusBadge = (s: string) => {
        if (s === 'paid') return { bg: '#198754', label: 'Paid' };
        if (s === 'partial') return { bg: '#fd7e14', label: 'Partial' };
        return { bg: '#dc3545', label: 'Unpaid' };
    };

    const headTotals: Record<string, number> = {};
    uniqueHeads.forEach(h => {
        headTotals[h] = filteredSlips.reduce((sum, slip) => {
            const li = slip.line_items.find(l => l.head_name === h);
            return sum + (li ? li.amount : 0);
        }, 0);
    });

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
            <html><head><title>Family Fee Report - ${monthLabel} ${year}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; margin: 15px; color: #1e293b; }
                h2, h3, h4 { margin: 0 0 6px 0; color: #233D4D; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { background: #233D4D; color: white; padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
                td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10.5px; }
                tr:nth-child(even) { background: #f8fafc; }
                .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
                .summary-card { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 6px; }
                @media print { @page { margin: 8mm; size: landscape; } body { -webkit-print-color-adjust: exact; } }
            </style></head><body>${content.innerHTML}</body></html>
        `);
        win.document.close(); win.focus();
        setTimeout(() => { win.print(); win.close(); }, 400);
    };

    const CustomPieTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data: HeadSummary = payload[0].payload;
            return (
                <div className="card shadow-lg border-0 p-2.5 rounded-3" style={{ background: '#1e293b', color: '#fff', fontSize: '11.5px', minWidth: 190 }}>
                    <div className="fw-bold mb-1 border-bottom pb-1 text-info d-flex justify-content-between align-items-center">
                        <span>{data.head_name}</span>
                        <span className="badge bg-secondary" style={{ fontSize: 9 }}>{data.percentage}%</span>
                    </div>
                    <div className="d-flex justify-content-between py-0.5">
                        <span className="text-white-50">Total Billed:</span>
                        <strong className="text-white">Rs. {data.total.toLocaleString()}</strong>
                    </div>
                    <div className="d-flex justify-content-between py-0.5">
                        <span className="text-success-emphasis">Collected:</span>
                        <strong className="text-success">Rs. {data.collected.toLocaleString()}</strong>
                    </div>
                    <div className="d-flex justify-content-between py-0.5">
                        <span className="text-danger-emphasis">Pending Dues:</span>
                        <strong className="text-danger">Rs. {data.pending.toLocaleString()}</strong>
                    </div>
                    <div className="d-flex justify-content-between pt-1 mt-1 border-top border-secondary text-warning" style={{ fontSize: '10.5px' }}>
                        <span>Recovery Rate:</span>
                        <strong>{data.collection_rate}%</strong>
                    </div>
                </div>
            );
        }
        return null;
    };

    const CustomTimelineTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data: TimelinePoint = payload[0].payload;
            return (
                <div className="card shadow-lg border-0 p-2.5 rounded-3" style={{ background: '#0f172a', color: '#fff', fontSize: '11.5px', minWidth: 210 }}>
                    <div className="fw-bold mb-1 border-bottom pb-1 text-teal d-flex justify-content-between" style={{ color: '#2dd4bf' }}>
                        <span><i className="bi bi-calendar-event me-1"></i>{data.date}</span>
                        <span className="badge bg-dark-subtle text-light" style={{ fontSize: 9 }}>Day {data.day_num}</span>
                    </div>
                    <div className="d-flex justify-content-between py-0.5">
                        <span className="text-white-50">Day Collected:</span>
                        <strong style={{ color: '#38bdf8' }}>Rs. {data.daily_collected.toLocaleString()}</strong>
                    </div>
                    <div className="d-flex justify-content-between py-0.5">
                        <span className="text-white-50">Cumulative To-Date:</span>
                        <strong style={{ color: '#4ade80' }}>Rs. {data.cumulative_collected.toLocaleString()}</strong>
                    </div>
                    <div className="d-flex justify-content-between py-0.5">
                        <span className="text-white-50">Remaining Unpaid:</span>
                        <strong style={{ color: '#f87171' }}>Rs. {data.remaining_dues.toLocaleString()}</strong>
                    </div>
                    <div className="d-flex justify-content-between pt-1 mt-1 border-top border-secondary" style={{ fontSize: '10.5px', color: '#facc15' }}>
                        <span>Month Recovery Pace:</span>
                        <strong>{data.collection_rate}%</strong>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-3 p-md-4" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
            <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-4">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-wallet2 me-2" style={{ color: 'var(--accent-orange)' }} />
                        Family Fee &amp; Head Analytics Report
                    </h4>
                    <div className="text-muted small">
                        Fee collection head-wise per student, interactive recovery charts &amp; daily revenue velocity
                    </div>
                </div>
                <div>
                    <span className="badge rounded-pill bg-light text-dark border px-3 py-2 shadow-sm d-inline-flex align-items-center gap-1.5" style={{ fontSize: '13px', fontWeight: 600 }}>
                        <i className="bi bi-mortarboard-fill text-primary"></i>
                        Academic Year: {activeYearName || '—'}
                    </span>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4 rounded-3" style={{ background: '#ffffff', borderLeft: '4px solid var(--primary-teal)' }}>
                <div className="card-header bg-white border-bottom py-2.5 d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-funnel me-2 text-primary" />Analytics Filters</h6>
                    {headId && (
                        <span className="badge bg-warning text-dark px-2.5 py-1 rounded-pill" style={{ fontSize: '11px' }}>
                            <i className="bi bi-filter-circle-fill me-1"></i>
                            Filtered by: {feeHeads.find(h => String(h.head_id) === headId)?.head_name}
                            <button className="btn-close ms-2" style={{ fontSize: '8px' }} onClick={() => setHeadId('')}></button>
                        </span>
                    )}
                </div>
                <div className="card-body p-3">
                    <div className="row g-2 g-md-3 align-items-end">
                        <div className="col-12 col-sm-6 col-md-2">
                            <label className="form-label fw-semibold small mb-1" style={{ fontSize: '11px' }}>
                                <i className="bi bi-mortarboard me-1 text-primary"></i>Academic Year
                            </label>
                            <select
                                className="form-select form-select-sm fw-bold border-1"
                                value={academicYearId}
                                onChange={e => setAcademicYearId(e.target.value)}
                            >
                                {years.map(y => (
                                    <option key={y.id} value={y.id}>
                                        {y.year_name} {y.is_active || y.status === 'active' ? '(Active)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-6 col-sm-4 col-md-2">
                            <label className="form-label fw-semibold small mb-1" style={{ fontSize: '11px' }}>
                                <i className="bi bi-calendar3 me-1 text-primary"></i>Month <span className="text-danger">*</span>
                            </label>
                            <select className="form-select form-select-sm"
                                value={month}
                                onChange={e => setMonth(e.target.value)}
                                disabled={availableMonths.length === 0 || loadingMonths}>
                                {availableMonths.length > 0 ? (
                                    availableMonths.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))
                                ) : (
                                    <option value="">{loadingMonths ? 'Loading...' : 'No Fee Slips Created'}</option>
                                )}
                            </select>
                        </div>
                        <div className="col-6 col-sm-4 col-md-2">
                            <label className="form-label fw-semibold small mb-1 d-flex justify-content-between align-items-center" style={{ fontSize: '11px' }}>
                                <span><i className="bi bi-clock-history me-1 text-primary"></i>As of Date</span>
                                {asOfDate && <span className="badge bg-light text-danger p-0" style={{ cursor: 'pointer', fontSize: 9 }} onClick={() => setAsOfDate('')}>Clear</span>}
                            </label>
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={asOfDate}
                                min={dateRange.start}
                                max={dateRange.end}
                                onChange={e => setAsOfDate(e.target.value)}
                                title={dateRange.start ? `Must be between ${dateRange.start} and ${dateRange.end}` : ''}
                            />
                        </div>
                        <div className="col-6 col-sm-4 col-md-2">
                            <label className="form-label fw-semibold small mb-1" style={{ fontSize: '11px' }}>
                                <i className="bi bi-tags me-1 text-primary"></i>Fee Head
                            </label>
                            <select className="form-select form-select-sm fw-semibold" value={headId} onChange={e => setHeadId(e.target.value)}>
                                <option value="">All Fee Heads</option>
                                {feeHeads.map(h => <option key={h.head_id} value={h.head_id}>{h.head_name}</option>)}
                            </select>
                        </div>
                        <div className="col-6 col-sm-4 col-md-1.5" style={{ flex: '1 1 120px' }}>
                            <label className="form-label fw-semibold small mb-1" style={{ fontSize: '11px' }}>Class</label>
                            <select className="form-select form-select-sm" value={classId} onChange={e => setClassId(e.target.value)}>
                                <option value="">All</option>
                                {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-6 col-sm-4 col-md-1.5" style={{ flex: '1 1 110px' }}>
                            <label className="form-label fw-semibold small mb-1" style={{ fontSize: '11px' }}>Section</label>
                            <select className="form-select form-select-sm" value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId}>
                                <option value="">All</option>
                                {filteredSections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                            </select>
                        </div>
                        <div className="col-6 col-sm-4 col-md-1.5" style={{ flex: '1 1 100px' }}>
                            <label className="form-label fw-semibold small mb-1" style={{ fontSize: '11px' }}>Status</label>
                            <select className="form-select form-select-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                <option value="">All</option>
                                <option value="paid">Paid</option>
                                <option value="partial">Partial</option>
                                <option value="unpaid">Unpaid</option>
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-2 d-flex gap-2">
                            <button
                                className="btn btn-sm fw-bold px-3 w-100 shadow-sm"
                                style={{ background: 'var(--primary-teal)', color: '#fff', height: 34 }}
                                onClick={loadReport}
                                disabled={loading}
                            >
                                {loading
                                    ? <span className="spinner-border spinner-border-sm me-1" />
                                    : <i className="bi bi-search me-1" />}
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger py-2"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}

            {!loading && !collective && (
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5 text-muted">
                        <i className="bi bi-wallet2 fs-1 d-block mb-3 opacity-25" />
                        <div className="fw-semibold">Select filters and click <strong>Generate</strong> to load reports</div>
                        <div className="small mt-1 text-muted">Supports head-wise segmentation, recovery velocity curves &amp; daily tracking</div>
                    </div>
                </div>
            )}

            {!loading && collective && slips.length === 0 && (
                <div className="alert alert-info shadow-sm">
                    <i className="bi bi-info-circle me-2" />
                    No fee slips found for <strong>{monthLabel} {year}</strong> with selected filters.
                </div>
            )}

            {collective && slips.length > 0 && (
                <div ref={printRef}>
                    <div className="card border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, #1b2e3b 0%, #0f766e 100%)', borderRadius: 12 }}>
                        <div className="card-body d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 py-3 px-3 px-md-4 text-white">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <span className="badge px-2.5 py-1 rounded-pill" style={{ background: 'rgba(255,255,255,0.15)', color: '#5eead4', fontSize: 10, fontWeight: 700 }}>
                                        {selectedHeadInfo ? `FEE HEAD: ${selectedHeadInfo.head_name.toUpperCase()}` : 'ALL FEE HEADS'}
                                    </span>
                                    {asOfDate && (
                                        <span className="badge bg-warning text-dark px-2.5 py-1 rounded-pill" style={{ fontSize: 10, fontWeight: 700 }}>
                                            <i className="bi bi-pin-angle-fill me-1"></i>POSITION AS OF: {asOfDate}
                                        </span>
                                    )}
                                </div>
                                <div className="fw-bold fs-5 text-white">
                                    Fee Collection Report — {monthLabel} {year}
                                    {classLabel && <span className="ms-2 opacity-75 fs-6">| {classLabel}{secLabel && ` › ${secLabel}`}</span>}
                                </div>
                                <div className="text-white-50 small mt-0.5">
                                    {slips.length} student slips tracked • Recovery Rate: <strong>{collective.collection_rate}%</strong>
                                </div>
                            </div>
                            <div className="d-flex gap-2">
                                <button className="btn btn-light btn-sm fw-bold px-3 shadow-sm d-flex align-items-center gap-1.5" onClick={handlePrint}>
                                    <i className="bi bi-printer me-1" /> Print Report
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="row g-2 g-md-3 mb-4">
                        {[
                            { label: headId ? `${selectedHeadInfo?.head_name || 'Head'} Billed` : 'Total Billed', val: `Rs. ${collective.total_billed.toLocaleString()}`, color: '#233D4D', bg: '#eaf0f6', icon: 'bi-receipt', sub: `${slips.length} Students` },
                            { label: 'Collected', val: `Rs. ${collective.total_collected.toLocaleString()}`, color: '#198754', bg: '#e8f5ee', icon: 'bi-check-circle-fill', sub: `${collective.collection_rate}% recovered` },
                            { label: 'Pending', val: `Rs. ${collective.total_pending.toLocaleString()}`, color: '#dc3545', bg: '#fdecea', icon: 'bi-exclamation-circle-fill', sub: 'Outstanding' },
                            { label: 'Total Students', val: slips.length, color: '#0d6efd', bg: '#e8eefb', icon: 'bi-people-fill', sub: 'In Filter' },
                            { label: 'Fully Paid', val: collective.paid_count, color: '#198754', bg: '#e8f5ee', icon: 'bi-check2-all', sub: `${slips.length > 0 ? Math.round((collective.paid_count / slips.length) * 100) : 0}% of slips` },
                            { label: 'Partial', val: collective.partial_count, color: '#fd7e14', bg: '#fff3e0', icon: 'bi-clock-history', sub: 'Partially settled' },
                            { label: 'Unpaid', val: collective.unpaid_count, color: '#dc3545', bg: '#fdecea', icon: 'bi-x-circle-fill', sub: 'Zero payment' },
                        ].map(item => (
                            <div key={item.label} className="col-6 col-sm-4 col-md">
                                <div className="card border-0 shadow-sm text-center py-2.5 px-2 h-100 rounded-3"
                                    style={{ background: item.bg, borderTop: `3.5px solid ${item.color}` }}>
                                    <i className={`bi ${item.icon} mb-1`} style={{ color: item.color, fontSize: 20 }} />
                                    <div style={{ fontSize: typeof item.val === 'number' ? 24 : 16, fontWeight: 800, color: item.color, lineHeight: 1.2 }}>
                                        {item.val}
                                    </div>
                                    <div className="fw-semibold text-truncate" style={{ fontSize: 11, marginTop: 2, color: '#475569' }}>{item.label}</div>
                                    <div className="text-muted" style={{ fontSize: 9.5 }}>{item.sub}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="row g-3 mb-4">
                        <div className="col-12 col-lg-5">
                            <div className="card border-0 shadow-sm h-100 rounded-3">
                                <div className="card-header bg-white border-bottom py-2.5 d-flex justify-content-between align-items-center"
                                    style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                                    <h6 className="mb-0 fw-bold">
                                        <i className="bi bi-pie-chart-fill me-2 text-teal" style={{ color: '#0f766e' }} />
                                        Fee Heads Revenue Composition
                                    </h6>
                                    <span className="badge bg-light text-muted border" style={{ fontSize: 10 }}>Interactive Chart</span>
                                </div>
                                <div className="card-body p-2 d-flex flex-column justify-content-center align-items-center">
                                    {headSummary.length > 0 ? (
                                        <div style={{ width: '100%', height: 260 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={headSummary}
                                                        dataKey="total"
                                                        nameKey="head_name"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={55}
                                                        outerRadius={95}
                                                        paddingAngle={3}
                                                        animationDuration={900}
                                                    >
                                                        {headSummary.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} stroke="#ffffff" strokeWidth={2} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip content={<CustomPieTooltip />} />
                                                    <Legend
                                                        verticalAlign="bottom"
                                                        height={36}
                                                        iconType="circle"
                                                        formatter={(val, entry: any) => (
                                                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                                                                {val} ({entry.payload.percentage}%)
                                                            </span>
                                                        )}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="text-muted p-4 text-center">No fee heads data</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-lg-7">
                            <div className="card border-0 shadow-sm h-100 rounded-3">
                                <div className="card-header bg-white border-bottom py-2.5 d-flex justify-content-between align-items-center"
                                    style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                                    <h6 className="mb-0 fw-bold">
                                        <i className="bi bi-bar-chart-steps me-2 text-primary" />
                                        Head-wise Collection Recovery Matrix
                                    </h6>
                                    <span className="badge bg-light text-muted border" style={{ fontSize: 10 }}>
                                        {headSummary.length} Active Head{headSummary.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive" style={{ maxHeight: 275, overflowY: 'auto' }}>
                                        <table className="table table-hover align-middle mb-0" style={{ fontSize: 12 }}>
                                            <thead className="sticky-top bg-light">
                                                <tr>
                                                    <th style={{ background: '#f1f5f9', color: '#475569', padding: '8px 12px' }}>Fee Head</th>
                                                    <th style={{ background: '#f1f5f9', color: '#475569', padding: '8px 12px', textAlign: 'right' }}>Billed</th>
                                                    <th style={{ background: '#f1f5f9', color: '#475569', padding: '8px 12px', textAlign: 'right' }}>Collected</th>
                                                    <th style={{ background: '#f1f5f9', color: '#475569', padding: '8px 12px', textAlign: 'right' }}>Pending</th>
                                                    <th style={{ background: '#f1f5f9', color: '#475569', padding: '8px 12px', width: 140 }}>Recovery %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {headSummary.map((h, idx) => (
                                                    <tr key={h.head_name} style={{ cursor: 'pointer' }} onClick={() => setHeadId(String(h.head_id || ''))} title="Click to filter by this head">
                                                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                                                            <span className="badge rounded-circle p-1 me-1.5 d-inline-block" style={{ background: PALETTE[idx % PALETTE.length], width: 9, height: 9 }}></span>
                                                            {h.head_name}
                                                        </td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Rs. {h.total.toLocaleString()}</td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>Rs. {h.collected.toLocaleString()}</td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: h.pending > 0 ? '#dc2626' : '#16a34a' }}>
                                                            Rs. {h.pending.toLocaleString()}
                                                        </td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div className="progress flex-grow-1" style={{ height: 6 }}>
                                                                    <div
                                                                        className="progress-bar bg-success"
                                                                        role="progressbar"
                                                                        style={{ width: `${Math.min(100, h.collection_rate)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="fw-bold" style={{ fontSize: 10, minWidth: 28 }}>{h.collection_rate}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {timeline.length > 0 && (
                        <div className="card border-0 shadow-sm mb-4 rounded-3">
                            <div className="card-header bg-white border-bottom py-2.5 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2"
                                style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                                <div>
                                    <h6 className="mb-0 fw-bold">
                                        <i className="bi bi-graph-up-arrow me-2 text-success" />
                                        Collection Velocity &amp; Daily Financial Position Curve ({monthLabel} {year})
                                    </h6>
                                    <div className="text-muted small" style={{ fontSize: 11 }}>
                                        Track exactly how much cash was recovered day-by-day vs remaining target dues
                                    </div>
                                </div>
                                <div className="btn-group btn-group-sm">
                                    <button
                                        className={`btn btn-sm ${timelineView === 'daily' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                        onClick={() => setTimelineView('daily')}
                                    >
                                        Daily Velocity
                                    </button>
                                    <button
                                        className={`btn btn-sm ${timelineView === 'weekly' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                        onClick={() => setTimelineView('weekly')}
                                    >
                                        Weekly Trend
                                    </button>
                                </div>
                            </div>
                            <div className="card-body p-3">
                                {timelineView === 'daily' ? (
                                    <div style={{ width: '100%', height: 260 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={timeline} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="gradDaily" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#0f766e" stopOpacity={0.0} />
                                                    </linearGradient>
                                                    <linearGradient id="gradCum" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} interval={2} />
                                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
                                                <RechartsTooltip content={<CustomTimelineTooltip />} />
                                                <ReferenceLine y={collective.total_billed} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Target Billed', fill: '#ef4444', fontSize: 10, position: 'top' }} />
                                                <Area type="monotone" dataKey="daily_collected" stroke="#0f766e" fillOpacity={1} fill="url(#gradDaily)" strokeWidth={2} name="Daily Collected" />
                                                <Area type="monotone" dataKey="cumulative_collected" stroke="#16a34a" fillOpacity={1} fill="url(#gradCum)" strokeWidth={2.5} name="Cumulative Collected" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div style={{ width: '100%', height: 260 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={weeklySummary} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} />
                                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `Rs.${(v / 1000).toFixed(0)}k`} />
                                                <RechartsTooltip
                                                    formatter={(val: any) => [`Rs. ${Number(val).toLocaleString()}`, 'Weekly Collected']}
                                                    contentStyle={{ background: '#1e293b', color: '#fff', borderRadius: 8, fontSize: 12 }}
                                                />
                                                <Bar dataKey="collected" fill="#0f766e" radius={[6, 6, 0, 0]} name="Weekly Cash Flow" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="card border-0 shadow-sm mb-4 rounded-3">
                        <div className="card-header bg-white border-bottom py-3 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2"
                            style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                            <div className="d-flex align-items-center gap-2">
                                <h6 className="mb-0 fw-bold">
                                    <i className="bi bi-table me-2 text-primary" />
                                    Student-wise Fee Ledger Breakdown
                                </h6>
                                <span className="badge bg-light text-dark border">
                                    {filteredSlips.length} student slips
                                </span>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <div className="input-group input-group-sm" style={{ width: 240 }}>
                                    <span className="input-group-text bg-light border-end-0"><i className="bi bi-search text-muted"></i></span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0 bg-light"
                                        placeholder="Search student / father / adm#..."
                                        value={searchKeyword}
                                        onChange={e => setSearchKeyword(e.target.value)}
                                    />
                                    {searchKeyword && (
                                        <button className="btn btn-light border" onClick={() => setSearchKeyword('')}><i className="bi bi-x text-danger"></i></button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0" style={{ fontSize: 12.5, minWidth: 950 }}>
                                    <thead>
                                        <tr>
                                            {['#', 'Adm#', 'Student Name', 'Father', 'Class', 'Section'].map(h => (
                                                <th key={h} style={{ background: '#233D4D', color: '#fff', padding: '10px 10px', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                            {!headId && uniqueHeads.map(h => (
                                                <th key={h} style={{ background: '#1a4a5e', color: '#fff', padding: '10px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>{h}</th>
                                            ))}
                                            <th style={{ background: '#233D4D', color: '#fff', padding: '10px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                {headId ? `${selectedHeadInfo?.head_name || 'Head'} Bill` : 'Total Bill'}
                                            </th>
                                            <th style={{ background: '#233D4D', color: '#fff', padding: '10px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                {headId ? `${selectedHeadInfo?.head_name || 'Head'} Paid` : 'Paid'}
                                            </th>
                                            <th style={{ background: '#233D4D', color: '#fff', padding: '10px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>Balance</th>
                                            <th style={{ background: '#233D4D', color: '#fff', padding: '10px 10px', textAlign: 'center' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSlips.map((s, i) => {
                                            const balance = s.balance !== undefined ? s.balance : s.total_amount - s.paid_amount;
                                            const badge = statusBadge(s.status);
                                            return (
                                                <tr key={s.slip_id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                    <td style={{ padding: '8px 10px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{s.admission_no}</td>
                                                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1e293b' }}>{s.student_name}</td>
                                                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{s.father_name || '—'}</td>
                                                    <td style={{ padding: '8px 10px' }}>{s.class_name}</td>
                                                    <td style={{ padding: '8px 10px' }}>{s.section_name}</td>
                                                    {!headId && uniqueHeads.map(h => {
                                                        const li = s.line_items.find(l => l.head_name === h);
                                                        return (
                                                            <td key={h} style={{ padding: '8px 10px', textAlign: 'right', color: li ? '#233D4D' : '#cbd5e1' }}>
                                                                {li ? `Rs. ${li.amount.toLocaleString()}` : '—'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Rs. {s.total_amount.toLocaleString()}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>Rs. {s.paid_amount.toLocaleString()}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: balance > 0 ? '#dc2626' : '#16a34a' }}>
                                                        Rs. {balance.toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                        <span className="badge" style={{ background: badge.bg, color: '#fff', padding: '4px 10px', borderRadius: 12, fontSize: 10.5 }}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: '#eef2f7' }}>
                                            <td colSpan={6} style={{ padding: '10px 10px', fontWeight: 800, fontSize: 13 }}>
                                                TOTAL ({filteredSlips.length} students)
                                            </td>
                                            {!headId && uniqueHeads.map(h => (
                                                <td key={h} style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#233D4D' }}>
                                                    Rs. {(headTotals[h] || 0).toLocaleString()}
                                                </td>
                                            ))}
                                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#233D4D' }}>
                                                Rs. {filteredSlips.reduce((sum, s) => sum + s.total_amount, 0).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                                                Rs. {filteredSlips.reduce((sum, s) => sum + s.paid_amount, 0).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#dc3545' }}>
                                                Rs. {filteredSlips.reduce((sum, s) => sum + (s.balance !== undefined ? s.balance : s.total_amount - s.paid_amount), 0).toLocaleString()}
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
