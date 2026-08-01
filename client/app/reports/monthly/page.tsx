'use client';
import { useState, useEffect } from 'react';
import { notify } from '@/app/utils/notify';
import { useAuth } from '@/contexts/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || "https://shaheenschool.onrender.com";

const MONTHS = [
    { num: 1, name: 'January' }, { num: 2, name: 'February' }, { num: 3, name: 'March' },
    { num: 4, name: 'April' }, { num: 5, name: 'May' }, { num: 6, name: 'June' },
    { num: 7, name: 'July' }, { num: 8, name: 'August' }, { num: 9, name: 'September' },
    { num: 10, name: 'October' }, { num: 11, name: 'November' }, { num: 12, name: 'December' }
];

function fmtPKR(val: number) {
    return `PKR ${Number(val || 0).toLocaleString('en-PK')}`;
}

export default function MonthlyReportPage() {
    const { hasPermission } = useAuth();
    
    // Filters
    const now = new Date();
    const [month, setMonth] = useState<number>(now.getMonth() + 1);
    const [year, setYear] = useState<string>(now.getFullYear().toString());
    const [classId, setClassId] = useState<string>('');
    const [sectionId, setSectionId] = useState<string>('');
    const [statusTab, setStatusTab] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    // Data
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [reportData, setReportData] = useState<{ summary: any; families: any[] } | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [schoolInfo, setSchoolInfo] = useState<{ name: string; address: string; phone: string; logo: string }>({
        name: 'Shaheen Public School', address: '', phone: '', logo: ''
    });

    useEffect(() => {
        // Fetch classes
        fetch(`${API}/academic`).then(r => r.json()).then(setClasses).catch(() => {});
        // Fetch school info
        fetch(`${API}/settings`).then(r => r.json()).then((data: any) => {
            if (data && typeof data === 'object') {
                setSchoolInfo({
                    name: data.school_name || 'Shaheen Public School',
                    address: data.address || '',
                    phone: data.contact_number || '',
                    logo: data.logo_url ? `${API}${data.logo_url}` : ''
                });
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (classId) {
            fetch(`${API}/academic/sections`).then(r => r.json()).then((allSecs: any[]) => {
                setSections(allSecs.filter((s: any) => s.class_id === Number(classId)));
            }).catch(() => setSections([]));
        } else {
            setSections([]);
            setSectionId('');
        }
    }, [classId]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                month: month.toString(),
                year: year
            });
            if (classId) params.append('class_id', classId);
            if (sectionId) params.append('section_id', sectionId);

            const res = await fetch(`${API}/reports/monthly-tuition?${params.toString()}`);
            const data = await res.json();

            if (res.ok) {
                setReportData(data);
            } else {
                notify.error(data.error || 'Failed to load report data');
            }
        } catch (e: any) {
            console.error(e);
            notify.error('Network error loading monthly report');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [month, year, classId, sectionId]);

    // Filter families based on tab and keyword
    const filteredFamilies = (reportData?.families || []).filter(f => {
        if (statusTab !== 'all' && f.payment_status !== statusTab) return false;
        if (searchKeyword.trim()) {
            const q = searchKeyword.toLowerCase().trim();
            const name = (f.student_name || '').toLowerCase();
            const father = (f.father_name || '').toLowerCase();
            const fam = (f.family_id || '').toLowerCase();
            const adm = (f.admission_no || '').toLowerCase();
            return name.includes(q) || father.includes(q) || fam.includes(q) || adm.includes(q);
        }
        return true;
    });

    const monthName = MONTHS.find(m => m.num === Number(month))?.name || 'Selected Month';
    const summary = reportData?.summary || {
        total_billed: 0, total_collected: 0, total_remaining: 0, total_expenses: 0,
        expected_surplus: 0, net_cash_balance: 0, collection_rate: 0,
        total_families_count: 0, paid_count: 0, partial_count: 0, unpaid_count: 0
    };

    // Export PDF
    const doExportPDF = () => {
        const win = window.open('', '_blank');
        if (!win) { notify.error('Popup blocked — please allow popups to print.'); return; }

        const rowsHtml = filteredFamilies.map((f, idx) => `
            <tr>
                <td style="text-align:center;padding:6px;">${idx + 1}</td>
                <td style="padding:6px;font-weight:600;">${f.family_id || '—'}</td>
                <td style="padding:6px;">
                    <div style="font-weight:bold;">${f.student_name}</div>
                    <div style="font-size:9px;color:#666;">Father: ${f.father_name || '—'} (${f.father_phone || '—'})</div>
                </td>
                <td style="padding:6px;">${f.class_name || '—'} - ${f.section_name || '—'}</td>
                <td style="text-align:right;padding:6px;font-weight:600;">${fmtPKR(f.tuition_billed)}</td>
                <td style="text-align:right;padding:6px;color:#16a34a;font-weight:600;">${fmtPKR(f.tuition_paid)}</td>
                <td style="text-align:right;padding:6px;color:${f.tuition_remaining > 0 ? '#dc2626' : '#16a34a'};font-weight:700;">${fmtPKR(f.tuition_remaining)}</td>
                <td style="text-align:center;padding:6px;">
                    <span style="padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700;background:${
                        f.payment_status === 'paid' ? '#dcfce7;color:#15803d' :
                        f.payment_status === 'partial' ? '#ffedd5;color:#c2410c' : '#fee2e2;color:#b91c1c'
                    };">
                        ${f.payment_status.toUpperCase()}
                    </span>
                </td>
            </tr>
        `).join('');

        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8"/>
                <title>Monthly Fee & Financial Report - ${monthName} ${year}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; margin: 15px; color: #1e293b; }
                    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 15px; }
                    .title-box h1 { margin: 0; font-size: 20px; color: #0f766e; font-weight: 800; }
                    .title-box p { margin: 3px 0 0 0; color: #64748b; font-size: 11px; }
                    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
                    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
                    .stat-label { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 3px; }
                    .stat-val { font-size: 14px; font-weight: 800; color: #0f172a; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th { background: #0f766e; color: #fff; padding: 8px 6px; font-size: 10px; text-transform: uppercase; text-align: left; }
                    td { border-bottom: 1px solid #e2e8f0; font-size: 10px; }
                    tr:nth-child(even) td { background: #f8fafc; }
                    @media print { @page { margin: 8mm; size: A4 portrait; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        ${schoolInfo.logo ? `<img src="${schoolInfo.logo}" height="45" style="margin-bottom:5px;display:block;" />` : ''}
                        <div style="font-size:16px;font-weight:800;color:#0f766e;">${schoolInfo.name}</div>
                        <div style="font-size:10px;color:#64748b;">${schoolInfo.address} ${schoolInfo.phone ? ' | Ph: ' + schoolInfo.phone : ''}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:16px;font-weight:800;color:#0f172a;">MONTHLY TUITION & FINANCIAL REPORT</div>
                        <div style="font-size:12px;font-weight:700;color:#0f766e;">Period: ${monthName} ${year}</div>
                        <div style="font-size:9px;color:#94a3b8;margin-top:4px;">Generated on: ${new Date().toLocaleDateString()}</div>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card" style="border-left:4px solid #0f766e;">
                        <div class="stat-label">Total Tuition Billed</div>
                        <div class="stat-val">${fmtPKR(summary.total_billed)}</div>
                    </div>
                    <div class="stat-card" style="border-left:4px solid #16a34a;">
                        <div class="stat-label">Tuition Collected</div>
                        <div class="stat-val" style="color:#16a34a;">${fmtPKR(summary.total_collected)}</div>
                        <div style="font-size:9px;color:#15803d;">Rate: ${summary.collection_rate}%</div>
                    </div>
                    <div class="stat-card" style="border-left:4px solid #dc2626;">
                        <div class="stat-label">Remaining Dues</div>
                        <div class="stat-val" style="color:#dc2626;">${fmtPKR(summary.total_remaining)}</div>
                    </div>
                    <div class="stat-card" style="border-left:4px solid #ea580c;">
                        <div class="stat-label">Monthly Expenses</div>
                        <div class="stat-val" style="color:#ea580c;">${fmtPKR(summary.total_expenses)}</div>
                    </div>
                </div>

                <div style="display:flex;gap:15px;margin-bottom:15px;background:#f1f5f9;padding:10px;border-radius:8px;">
                    <div style="flex:1;">
                        <span style="font-size:10px;font-weight:700;color:#475569;">EXPECTED OPERATING SURPLUS (Billed - Expenses):</span>
                        <span style="font-size:13px;font-weight:800;color:${summary.expected_surplus >= 0 ? '#0f766e' : '#dc2626'};margin-left:8px;">
                            ${fmtPKR(summary.expected_surplus)}
                        </span>
                    </div>
                    <div style="flex:1;">
                        <span style="font-size:10px;font-weight:700;color:#475569;">NET CASH BALANCE (Collected - Expenses):</span>
                        <span style="font-size:13px;font-weight:800;color:${summary.net_cash_balance >= 0 ? '#16a34a' : '#dc2626'};margin-left:8px;">
                            ${fmtPKR(summary.net_cash_balance)}
                        </span>
                    </div>
                </div>

                <h3 style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:6px;text-transform:uppercase;">
                    Family Tuition Fee Status Breakdown (${filteredFamilies.length} Records)
                </h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width:30px;text-align:center;">#</th>
                            <th>Family ID</th>
                            <th>Student & Father Details</th>
                            <th>Class & Sec</th>
                            <th style="text-align:right;">Tuition Billed</th>
                            <th style="text-align:right;">Tuition Paid</th>
                            <th style="text-align:right;">Remaining Dues</th>
                            <th style="text-align:center;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8;">No records found for selected filters</td></tr>'}
                    </tbody>
                </table>
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 500);
    };

    // Export Excel
    const doExportExcel = () => {
        const ths = ['#', 'Family ID', 'Student Name', 'Father Name', 'Father Phone', 'Class', 'Section', 'Tuition Billed', 'Tuition Paid', 'Remaining Dues', 'Status']
            .map(h => `<th style="background:#0f766e;color:#fff;padding:6px;font-size:11px">${h}</th>`).join('');
        
        const trs = filteredFamilies.map((f, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${f.family_id || ''}</td>
                <td>${f.student_name || ''}</td>
                <td>${f.father_name || ''}</td>
                <td>${f.father_phone || ''}</td>
                <td>${f.class_name || ''}</td>
                <td>${f.section_name || ''}</td>
                <td>${f.tuition_billed}</td>
                <td>${f.tuition_paid}</td>
                <td>${f.tuition_remaining}</td>
                <td>${f.payment_status.toUpperCase()}</td>
            </tr>
        `).join('');

        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/></head><body><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `Monthly-Tuition-Report-${monthName}-${year}.xls` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Export CSV
    const doExportCSV = () => {
        const headers = ['#', 'Family ID', 'Student Name', 'Father Name', 'Father Phone', 'Class', 'Section', 'Tuition Billed', 'Tuition Paid', 'Remaining Dues', 'Status'];
        const rows = filteredFamilies.map((f, i) => [
            i + 1, f.family_id || '', f.student_name || '', f.father_name || '', f.father_phone || '',
            f.class_name || '', f.section_name || '', f.tuition_billed, f.tuition_paid, f.tuition_remaining, f.payment_status.toUpperCase()
        ]);
        const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
        const lines = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))];
        const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: `Monthly-Tuition-Report-${monthName}-${year}.csv` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="container-fluid p-4 bg-light min-vh-100">
            {/* Header Banner */}
            <div className="d-flex justify-content-between align-items-center mb-4 p-4 rounded-4 shadow-sm"
                style={{ background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-teal) 100%)', color: 'white' }}>
                <div>
                    <h2 className="mb-1 fw-bold text-white" style={{ letterSpacing: '-0.5px' }}>
                        <i className="bi bi-pie-chart-fill me-2"></i>Monthly Tuition &amp; Expense Report
                    </h2>
                    <p className="text-white-50 mb-0">Senior Accounting &amp; Cash Flow Analysis for {monthName} {year}</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-light" onClick={doExportPDF} title="Export PDF Report">
                        <i className="bi bi-file-earmark-pdf me-1"></i>PDF
                    </button>
                    <button className="btn btn-sm btn-outline-light" onClick={doExportExcel} title="Export Excel">
                        <i className="bi bi-file-earmark-spreadsheet me-1"></i>Excel
                    </button>
                    <button className="btn btn-sm btn-outline-light" onClick={doExportCSV} title="Export CSV">
                        <i className="bi bi-filetype-csv me-1"></i>CSV
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="card shadow-sm border-0 rounded-4 mb-4">
                <div className="card-body p-3 bg-white rounded-4">
                    <div className="row g-3 align-items-center">
                        <div className="col-md-2">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1">Month</label>
                            <select className="form-select form-select-sm fw-semibold" value={month} onChange={e => setMonth(Number(e.target.value))}>
                                {MONTHS.map(m => <option key={m.num} value={m.num}>{m.name}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1">Year</label>
                            <select className="form-select form-select-sm fw-semibold" value={year} onChange={e => setYear(e.target.value)}>
                                {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1">Class</label>
                            <select className="form-select form-select-sm" value={classId} onChange={e => setClassId(e.target.value)}>
                                <option value="">All Classes</option>
                                {classes.map((c: any) => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1">Section</label>
                            <select className="form-select form-select-sm" value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId}>
                                <option value="">All Sections</option>
                                {sections.map((s: any) => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                            </select>
                        </div>
                        <div className="col-md-3 ms-auto text-end">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1 d-block">Search</label>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text bg-white"><i className="bi bi-search text-muted"></i></span>
                                <input type="text" className="form-control" placeholder="Search student / father..."
                                    value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
                                {searchKeyword && (
                                    <button className="btn btn-outline-secondary" onClick={() => setSearchKeyword('')}><i className="bi bi-x"></i></button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="row g-3 mb-4">
                {/* 1. Billed Tuition */}
                <div className="col-md-3">
                    <div className="card shadow-sm border-0 rounded-4 h-100 p-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted small text-uppercase fw-bold">Tuition Fee Billed</span>
                            <div className="rounded-circle p-2" style={{ backgroundColor: 'rgba(15,118,110,0.1)', color: 'var(--primary-teal)' }}>
                                <i className="bi bi-file-text-fill"></i>
                            </div>
                        </div>
                        <h4 className="fw-bold mb-0 text-dark">{fmtPKR(summary.total_billed)}</h4>
                        <span className="text-muted small">Expected Tuition Revenue</span>
                    </div>
                </div>

                {/* 2. Collected Tuition */}
                <div className="col-md-3">
                    <div className="card shadow-sm border-0 rounded-4 h-100 p-3" style={{ borderLeft: '4px solid #16a34a' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted small text-uppercase fw-bold">Tuition Collected</span>
                            <div className="rounded-circle p-2" style={{ backgroundColor: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                                <i className="bi bi-check-circle-fill"></i>
                            </div>
                        </div>
                        <h4 className="fw-bold mb-0 text-success">{fmtPKR(summary.total_collected)}</h4>
                        <span className="badge bg-success bg-opacity-10 text-success mt-1" style={{ width: 'fit-content' }}>
                            {summary.collection_rate}% Collected
                        </span>
                    </div>
                </div>

                {/* 3. Remaining Dues */}
                <div className="col-md-3">
                    <div className="card shadow-sm border-0 rounded-4 h-100 p-3" style={{ borderLeft: '4px solid #dc2626' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted small text-uppercase fw-bold">Remaining Dues</span>
                            <div className="rounded-circle p-2" style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
                                <i className="bi bi-exclamation-triangle-fill"></i>
                            </div>
                        </div>
                        <h4 className="fw-bold mb-0 text-danger">{fmtPKR(summary.total_remaining)}</h4>
                        <span className="text-muted small">Uncollected Tuition</span>
                    </div>
                </div>

                {/* 4. Monthly Expenses */}
                <div className="col-md-3">
                    <div className="card shadow-sm border-0 rounded-4 h-100 p-3" style={{ borderLeft: '4px solid #ea580c' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted small text-uppercase fw-bold">Monthly Expenses</span>
                            <div className="rounded-circle p-2" style={{ backgroundColor: 'rgba(234,88,12,0.1)', color: '#ea580c' }}>
                                <i className="bi bi-receipt me-1"></i>
                            </div>
                        </div>
                        <h4 className="fw-bold mb-0" style={{ color: '#ea580c' }}>{fmtPKR(summary.total_expenses)}</h4>
                        <span className="text-muted small">Total Month Expenses</span>
                    </div>
                </div>
            </div>

            {/* Net Surplus & Realized Cash Row */}
            <div className="row g-3 mb-4">
                <div className="col-md-6">
                    <div className="card shadow-sm border-0 rounded-4 p-3 bg-white" style={{ borderLeft: '5px solid #0284c7' }}>
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="text-uppercase fw-bold small text-muted d-block">Expected Operating Surplus (Billed - Expenses)</span>
                                <h3 className="fw-bold mb-0" style={{ color: summary.expected_surplus >= 0 ? '#0284c7' : '#dc2626' }}>
                                    {fmtPKR(summary.expected_surplus)}
                                </h3>
                            </div>
                            <i className="bi bi-calculator fs-1 text-primary opacity-25"></i>
                        </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="card shadow-sm border-0 rounded-4 p-3 bg-white" style={{ borderLeft: '5px solid #16a34a' }}>
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="text-uppercase fw-bold small text-muted d-block">Net Cash Balance (Collected - Expenses)</span>
                                <h3 className="fw-bold mb-0" style={{ color: summary.net_cash_balance >= 0 ? '#16a34a' : '#dc2626' }}>
                                    {fmtPKR(summary.net_cash_balance)}
                                </h3>
                            </div>
                            <i className="bi bi-cash-stack fs-1 text-success opacity-25"></i>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Family Table Card */}
            <div className="card shadow-lg border-0 rounded-4 overflow-hidden">
                <div className="card-header bg-white p-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
                    {/* Status Tabs */}
                    <div className="btn-group btn-group-sm" role="group">
                        <button type="button" className={`btn ${statusTab === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setStatusTab('all')}>
                            All ({summary.total_families_count})
                        </button>
                        <button type="button" className={`btn ${statusTab === 'paid' ? 'btn-success' : 'btn-outline-success'}`}
                            onClick={() => setStatusTab('paid')}>
                            Fully Paid ({summary.paid_count})
                        </button>
                        <button type="button" className={`btn ${statusTab === 'partial' ? 'btn-warning' : 'btn-outline-warning'}`}
                            onClick={() => setStatusTab('partial')}>
                            Partial ({summary.partial_count})
                        </button>
                        <button type="button" className={`btn ${statusTab === 'unpaid' ? 'btn-danger' : 'btn-outline-danger'}`}
                            onClick={() => setStatusTab('unpaid')}>
                            Unpaid Dues ({summary.unpaid_count})
                        </button>
                    </div>

                    <span className="text-muted small fw-semibold">
                        Showing {filteredFamilies.length} Records
                    </span>
                </div>

                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center p-5">
                            <div className="spinner-border text-primary" role="status"></div>
                            <p className="text-muted mt-2 small">Computing financial calculations...</p>
                        </div>
                    ) : filteredFamilies.length === 0 ? (
                        <div className="text-center p-5 text-muted">
                            <i className="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i>
                            No tuition fee records found for {monthName} {year} with the selected filters.
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                                <thead className="text-uppercase small text-muted" style={{ backgroundColor: 'var(--primary-dark)', color: 'white' }}>
                                    <tr>
                                        <th className="ps-3" style={{ width: 40 }}>#</th>
                                        <th>Family ID</th>
                                        <th>Student &amp; Father Details</th>
                                        <th>Class &amp; Section</th>
                                        <th className="text-end">Tuition Billed</th>
                                        <th className="text-end">Tuition Paid</th>
                                        <th className="text-end">Remaining Dues</th>
                                        <th className="text-center pe-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFamilies.map((f, i) => (
                                        <tr key={f.slip_id || i}>
                                            <td className="ps-3 text-muted small">{i + 1}</td>
                                            <td>
                                                <span className="badge bg-light text-dark border fw-normal">{f.family_id || '—'}</span>
                                            </td>
                                            <td>
                                                <div className="fw-bold text-dark">{f.student_name}</div>
                                                <div className="small text-muted">
                                                    Father: {f.father_name || '—'} {f.father_phone ? `(${f.father_phone})` : ''}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="fw-semibold">{f.class_name || '—'}</span>
                                                <span className="text-muted ms-1">({f.section_name || '—'})</span>
                                            </td>
                                            <td className="text-end fw-semibold text-dark">
                                                {fmtPKR(f.tuition_billed)}
                                            </td>
                                            <td className="text-end fw-semibold text-success">
                                                {fmtPKR(f.tuition_paid)}
                                            </td>
                                            <td className={`text-end fw-bold ${f.tuition_remaining > 0 ? 'text-danger' : 'text-success'}`}>
                                                {fmtPKR(f.tuition_remaining)}
                                            </td>
                                            <td className="text-center pe-3">
                                                <span className={`badge rounded-pill ${
                                                    f.payment_status === 'paid' ? 'bg-success' :
                                                    f.payment_status === 'partial' ? 'bg-warning text-dark' : 'bg-danger'
                                                }`}>
                                                    {f.payment_status === 'paid' ? 'Fully Paid' :
                                                     f.payment_status === 'partial' ? 'Partial' : 'Unpaid'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="card-footer bg-white p-3 text-center border-top">
                    <span className="text-muted small">
                        Monthly Tuition Financial Report • {monthName} {year} • {schoolInfo.name}
                    </span>
                </div>
            </div>
        </div>
    );
}
