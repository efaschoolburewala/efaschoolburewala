'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastHelper';

const API = process.env.NEXT_PUBLIC_API_URL || "https://shaheenschool.onrender.com";

type Term = { id: number; term_name: string };
type ClassItem = { class_id: number; class_name: string };
type SectionItem = { section_id: number; section_name: string; class_id: number };

type SubjectCol = { subject_id: number; subject_name: string; subject_code?: string | null };

type StudentRow = {
    student_id: number;
    first_name: string;
    last_name: string;
    admission_no?: string | null;
    roll_no?: string | null;
    subject_marks: { subject_id: number; obtained_marks: number | null; total_marks: number | null }[];
    grand_obtained: number;
    grand_total: number;
    position: number | null;
    ordinal_position: string | null;
    percentage: number | null;
    grade: string | null;
};

type SheetMeta = {
    term_id: number;
    term_name: string;
    year_name: string;
    class_id: number;
    class_name: string;
    section_id: number;
    section_name: string;
};

type SchoolInfo = {
    school_name?: string;
    school_address?: string;
    phone_number?: string;
    school_phone2?: string;
    school_phone3?: string;
    school_logo_url?: string;
};

type SheetPayload = {
    meta: SheetMeta;
    school: SchoolInfo;
    subjects: SubjectCol[];
    students: StudentRow[];
};

async function fetchJson(url: string, options?: RequestInit) {
    const r = await fetch(url, options);
    const contentType = r.headers.get('content-type') || '';
    let data: any = {};
    if (contentType.includes('application/json')) {
        try {
            data = await r.json();
        } catch {
            data = {};
        }
    } else {
        throw new Error(r.status === 404 ? 'API endpoint not found (404)' : `Server response error (${r.status})`);
    }

    if (!r.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${r.status}`);
    }
    return data;
}

function esc(text: unknown) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function fmtN(v: number | null | undefined): string {
    if (v === null || v === undefined) return '';
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, '');
}

function getLogoUrl(rawLogo?: string): string {
    const API = (process.env.NEXT_PUBLIC_API_URL || "https://shaheenschool.onrender.com").replace(/\/+$/, '');
    if (!rawLogo || !rawLogo.trim()) return `${API}/icon.png`;
    const logoStr = rawLogo.trim();
    if (logoStr.startsWith('data:') || logoStr.startsWith('http://') || logoStr.startsWith('https://')) {
        return logoStr;
    }
    const cleanPath = logoStr.replace(/^\/+/, '');
    return `${API}/${cleanPath}`;
}

function buildPrintHtml(payload: SheetPayload): string {
    const { meta, school, subjects, students } = payload;
    const schoolName = school.school_name || 'Shaheen Public School';
    const address = school.school_address || '';
    const phones = [school.phone_number, school.school_phone2, school.school_phone3].filter(Boolean).join(' | ');
    const logo = getLogoUrl(school.school_logo_url);

    const theadCols = subjects.map(s => `<th>${esc(s.subject_name)}</th>`).join('');
    const tbodyRows = students.map((student, idx) => {
        const markCols = subjects.map(s => {
            const sm = student.subject_marks.find(m => m.subject_id === s.subject_id);
            return `<td class="center">${sm && sm.obtained_marks !== null ? esc(fmtN(sm.obtained_marks)) : ''}</td>`;
        }).join('');
        return `
            <tr>
                <td class="center">${esc(student.roll_no || String(idx + 1))}</td>
                <td class="name-col">${esc(`${student.first_name} ${student.last_name}`)}</td>
                ${markCols}
                <td class="center bold">${student.grand_total > 0 ? esc(fmtN(student.grand_obtained)) : ''}</td>
                <td class="center bold">${esc(student.ordinal_position || '')}</td>
            </tr>
        `;
    }).join('');

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Marks Sheet – ${esc(meta.class_name)} ${esc(meta.section_name)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Times New Roman", serif; color: #000; background: #fff; font-size: 11pt; }
  .toolbar {
    position: fixed; top: 0; left: 0; right: 0;
    background: #215E61; color: #fff;
    padding: 8px 16px; display: flex; align-items: center; gap: 12px;
    font-family: Arial, sans-serif; font-size: 13px; z-index: 9999;
  }
  .toolbar button {
    background: #FE7F2D; color: #fff; border: none;
    padding: 6px 20px; border-radius: 4px;
    font-size: 13px; font-weight: bold; cursor: pointer;
  }
  @media print {
    .toolbar { display: none !important; }
    .page-wrap { padding-top: 0 !important; }
  }
  .page-wrap { padding-top: 46px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .logo { width: 70px; height: 70px; object-fit: contain; }
  .school-title { font-size: 22pt; font-weight: bold; text-align: center; flex: 1; }
  .school-sub { font-size: 10pt; text-align: center; color: #333; }
  .meta-row { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 10px; font-size: 11pt; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
  table.sheet { width: 100%; border-collapse: collapse; font-size: 10pt; }
  table.sheet th, table.sheet td { border: 1px solid #000; padding: 4px 6px; }
  table.sheet th { background: #f0f0f0; text-align: center; font-size: 9.5pt; text-transform: uppercase; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .name-col { white-space: nowrap; }
</style>
</head>
<body>
<div class="toolbar">
  <span>📄 Marks Sheet: ${esc(meta.class_name)} – ${esc(meta.section_name)} (${esc(meta.term_name)})</span>
  <button onclick="window.print()">🖨️ Print Sheet</button>
</div>
<div class="page-wrap">
  <div class="header">
    ${logo ? `<img class="logo" src="${esc(logo)}" alt="Logo"/>` : '<div style="width:70px"></div>'}
    <div>
      <div class="school-title">${esc(schoolName)}</div>
      ${address ? `<div class="school-sub">${esc(address)}</div>` : ''}
      ${phones ? `<div class="school-sub">${esc(phones)}</div>` : ''}
    </div>
    <div style="width:70px"></div>
  </div>
  <div class="meta-row">
    <span>Term: ${esc(meta.term_name)} (${esc(meta.year_name)})</span>
    <span>Class: ${esc(meta.class_name)} - ${esc(meta.section_name)}</span>
    <span>Generated: ${new Date().toLocaleDateString()}</span>
  </div>
  <table class="sheet">
    <thead>
      <tr>
        <th style="width:40px">Roll</th>
        <th>Student Name</th>
        ${theadCols}
        <th style="width:60px">Total</th>
        <th style="width:50px">Pos</th>
      </tr>
    </thead>
    <tbody>
      ${tbodyRows || '<tr><td colspan="100" class="center">No data found</td></tr>'}
    </tbody>
  </table>
</div>
</body>
</html>`;
}

export default function ClassMarksSheetPage() {
    const { user } = useAuth();

    const [loadingCtx, setLoadingCtx] = useState(true);
    const [loading, setLoading] = useState(false);
    const [printing, setPrinting] = useState(false);

    const [activeYearName, setActiveYearName] = useState('');
    const [terms, setTerms] = useState<Term[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [sections, setSections] = useState<SectionItem[]>([]);

    const [selectedTerm, setSelectedTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');

    const [sheet, setSheet] = useState<SheetPayload | null>(null);
    const [msg, setMsg] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(null);

    const canUsePage = !!user;

    const filteredSections = useMemo(() => {
        if (!selectedClass) return [];
        return sections.filter(s => s.class_id === Number(selectedClass));
    }, [sections, selectedClass]);

    const ready = !!(selectedTerm && selectedClass && selectedSection && user?.id);

    const loadContext = async () => {
        if (!user?.id) { setLoadingCtx(false); return; }
        setLoadingCtx(true);
        setMsg(null);
        try {
            const d = await fetchJson(`${API}/exams/context?user_id=${user.id}`);

            setActiveYearName(d.active_year?.year_name || '');
            setTerms(d.terms || []);
            setClasses(d.classes || []);
            setSections(d.sections || []);

            const termList = d.terms || [];
            const classList = d.classes || [];

            setSelectedTerm(prev => prev || (termList.length > 0 ? String(termList[0].id) : ''));
            setSelectedClass(prev => prev || (classList.length > 0 ? String(classList[0].class_id) : ''));
        } catch (e: any) {
            const errText = e.message || 'Failed to load context';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setLoadingCtx(false);
        }
    };

    const loadSheet = async () => {
        if (!ready || !user?.id) return;
        setLoading(true);
        setMsg(null);
        try {
            const params = new URLSearchParams({
                user_id: String(user.id),
                term_id: selectedTerm,
                class_id: selectedClass,
                section_id: selectedSection
            });
            const d = await fetchJson(`${API}/exams/class-marks-sheet?${params.toString()}`);
            setSheet(d as SheetPayload);
        } catch (e: any) {
            const errText = e.message || 'Failed to load marks sheet';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = async () => {
        if (!ready || !user?.id) return;
        setPrinting(true);
        setMsg(null);
        try {
            const params = new URLSearchParams({
                user_id: String(user.id),
                term_id: selectedTerm,
                class_id: selectedClass,
                section_id: selectedSection
            });
            const d = await fetchJson(`${API}/exams/class-marks-sheet?${params.toString()}`);

            const html = buildPrintHtml(d as SheetPayload);
            const win = window.open('', '_blank', 'width=1200,height=850');
            if (!win) {
                const txt = 'Popup blocked. Please allow popups and try again.';
                setMsg({ type: 'danger', text: txt });
                showToast.warning(txt);
                return;
            }
            win.document.open();
            win.document.write(html);
            win.document.close();
            win.focus();
            showToast.success('Marks sheet opened for printing');
        } catch (e: any) {
            const errText = e.message || 'Print failed';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setPrinting(false);
        }
    };

    useEffect(() => { loadContext(); }, [user?.id]);

    useEffect(() => {
        setSelectedSection('');
        setSheet(null);
    }, [selectedClass]);

    useEffect(() => {
        setSheet(null);
    }, [selectedTerm, selectedSection]);

    useEffect(() => {
        if (filteredSections.length === 1 && !selectedSection) {
            setSelectedSection(String(filteredSections[0].section_id));
        }
    }, [filteredSections, selectedSection]);

    // Seamless auto loading
    useEffect(() => {
        if (ready) loadSheet();
    }, [ready, selectedTerm, selectedClass, selectedSection]);

    const filteredStudents = useMemo(() => {
        if (!sheet?.students) return [];
        if (!searchKeyword.trim()) return sheet.students;
        const q = searchKeyword.toLowerCase().trim();
        return sheet.students.filter(s =>
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
            (s.roll_no || '').toLowerCase().includes(q)
        );
    }, [sheet, searchKeyword]);

    if (!canUsePage) {
        return (
            <div className="container py-4">
                <div className="alert alert-danger">You do not have permission to access Class Marks Sheet.</div>
            </div>
        );
    }

    return (
        <div className="page-wrap" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh', padding: '1.5rem' }}>
            {/* Standard Theme Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-table me-2" style={{ color: 'var(--accent-orange)' }} />
                        Class Marks Sheet
                    </h4>
                    <div className="text-muted small">Detailed marks sheet for selected term, class and section</div>
                </div>
                <span className="badge rounded-pill bg-light text-dark border">
                    Academic Year: {activeYearName || '—'}
                </span>
            </div>

            {msg && (
                <div className={`alert alert-${msg.type} alert-dismissible`} role="alert">
                    {msg.text}
                    <button type="button" className="btn-close" onClick={() => setMsg(null)} />
                </div>
            )}

            {/* Filters (Original Theme Structure) */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                    <h6 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-funnel-fill me-2" style={{ color: 'var(--primary-teal)' }} />
                        Filter Marks Sheet
                    </h6>
                </div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Term</label>
                            <select className="form-select rounded-3" value={selectedTerm}
                                onChange={e => setSelectedTerm(e.target.value)} disabled={loadingCtx}>
                                <option value="">Select Term</option>
                                {terms.map(t => <option key={t.id} value={t.id}>{t.term_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Class</label>
                            <select className="form-select rounded-3" value={selectedClass}
                                onChange={e => setSelectedClass(e.target.value)} disabled={loadingCtx}>
                                <option value="">Select Class</option>
                                {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Section</label>
                            <select className="form-select rounded-3" value={selectedSection}
                                onChange={e => setSelectedSection(e.target.value)}
                                disabled={!selectedClass || loadingCtx}>
                                <option value="">Select Section</option>
                                {filteredSections.map(s => (
                                    <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                            <button className="btn btn-outline-success fw-bold w-100 py-2 rounded-3" onClick={handlePrint}
                                disabled={!ready || printing || loadingCtx}>
                                {printing
                                    ? <><span className="spinner-border spinner-border-sm me-2" />Opening...</>
                                    : <><i className="bi bi-printer me-1" />Print Sheet</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Marks Sheet Table View */}
            {ready && (
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2 py-3" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                        <div className="fw-semibold" style={{ color: 'var(--primary-dark)' }}>
                            Class Matrix ({sheet?.students?.length || 0} Students)
                        </div>
                        <div className="input-group input-group-sm" style={{ width: 200 }}>
                            <span className="input-group-text bg-light border-0"><i className="bi bi-search text-muted"></i></span>
                            <input type="text" className="form-control border-0 bg-light" placeholder="Search name/roll..."
                                value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
                        </div>
                    </div>

                    <div className="card-body p-0">
                        {loading ? (
                            <div className="text-center p-5">
                                <div className="spinner-border text-teal" role="status" style={{ color: 'var(--primary-teal)' }}></div>
                                <p className="text-muted mt-2 small fw-semibold">Loading class marks sheet matrix...</p>
                            </div>
                        ) : !sheet || sheet.students.length === 0 ? (
                            <div className="text-center p-5 text-muted">
                                No student marks recorded for selected term &amp; section.
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead style={{ background: 'var(--primary-dark)', color: '#fff' }}>
                                        <tr>
                                            <th className="ps-3" style={{ width: 50 }}>Roll</th>
                                            <th style={{ minWidth: 160 }}>Student Name</th>
                                            {sheet.subjects.map(s => (
                                                <th key={s.subject_id} className="text-center">{s.subject_name}</th>
                                            ))}
                                            <th className="text-center" style={{ width: 90 }}>Obtained</th>
                                            <th className="text-center" style={{ width: 80 }}>Rank</th>
                                            <th className="text-center pe-3" style={{ width: 70 }}>Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map((st, idx) => (
                                            <tr key={st.student_id}>
                                                <td className="ps-3 fw-semibold">{st.roll_no || idx + 1}</td>
                                                <td className="fw-semibold">{st.first_name} {st.last_name}</td>
                                                {sheet.subjects.map(sub => {
                                                    const sm = st.subject_marks.find(m => m.subject_id === sub.subject_id);
                                                    return (
                                                        <td key={sub.subject_id} className="text-center">
                                                            {sm && sm.obtained_marks !== null ? (
                                                                <span className="fw-bold">{fmtN(sm.obtained_marks)}</span>
                                                            ) : (
                                                                <span className="text-muted small">—</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="text-center fw-bold text-success">
                                                    {fmtN(st.grand_obtained)}
                                                </td>
                                                <td className="text-center">
                                                    {st.ordinal_position ? (
                                                        <span className="badge bg-light text-primary border fw-bold">{st.ordinal_position}</span>
                                                    ) : <span className="text-muted">—</span>}
                                                </td>
                                                <td className="text-center pe-3">
                                                    <span className={`badge ${st.grade === 'F' ? 'bg-danger' : st.grade === 'A+' ? 'bg-success' : 'bg-primary'}`}>
                                                        {st.grade || '—'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
