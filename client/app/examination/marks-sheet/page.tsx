'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
    if (!rawLogo || !rawLogo.trim()) return '';
    const logoStr = rawLogo.trim();
    if (logoStr.startsWith('http://') || logoStr.startsWith('https://') || logoStr.startsWith('data:')) {
        return logoStr;
    }
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "https://shaheenschool.onrender.com").replace(/\/+$/, '');
    const cleanPath = logoStr.replace(/^\/+/, '');
    return `${baseUrl}/${cleanPath}`;
}

function buildPrintHtml(payload: SheetPayload): string {
    const { meta, school, subjects, students } = payload;
    const schoolName = school.school_name || 'Shaheen Public School';
    const address = school.school_address || '';
    const phones = [school.phone_number, school.school_phone2, school.school_phone3].filter(Boolean).join(' | ');
    const logo = getLogoUrl(school.school_logo_url);

    const subjectTotalMap = new Map<number, number>();
    for (const student of students) {
        for (const sm of student.subject_marks) {
            if (sm.total_marks !== null && !subjectTotalMap.has(sm.subject_id)) {
                subjectTotalMap.set(sm.subject_id, sm.total_marks);
            }
        }
    }

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
    background: #0f766e; color: #fff;
    padding: 8px 16px; display: flex; align-items: center; gap: 12px;
    font-family: Arial, sans-serif; font-size: 13px; z-index: 9999;
  }
  .toolbar button {
    background: #16a34a; color: #fff; border: none;
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
            const r = await fetch(`${API}/exams/context?user_id=${user.id}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Failed to load context');

            setActiveYearName(d.active_year?.year_name || '');
            setTerms(d.terms || []);
            setClasses(d.classes || []);
            setSections(d.sections || []);

            const termList = d.terms || [];
            const classList = d.classes || [];

            setSelectedTerm(prev => prev || (termList.length > 0 ? String(termList[0].id) : ''));
            setSelectedClass(prev => prev || (classList.length > 0 ? String(classList[0].class_id) : ''));
        } catch (e: any) {
            setMsg({ type: 'danger', text: e.message || 'Failed to load context' });
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
            const r = await fetch(`${API}/exams/class-marks-sheet?${params.toString()}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Failed to load marks sheet');
            setSheet(d as SheetPayload);
        } catch (e: any) {
            setMsg({ type: 'danger', text: e.message || 'Failed to load marks sheet' });
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
            const r = await fetch(`${API}/exams/class-marks-sheet?${params.toString()}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Failed to load marks sheet');

            const html = buildPrintHtml(d as SheetPayload);
            const win = window.open('', '_blank', 'width=1200,height=850');
            if (!win) {
                setMsg({ type: 'danger', text: 'Popup blocked. Please allow popups and try again.' });
                return;
            }
            win.document.open();
            win.document.write(html);
            win.document.close();
            win.focus();
        } catch (e: any) {
            setMsg({ type: 'danger', text: e.message || 'Print failed' });
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
        <div className="container-fluid p-2 p-md-4 bg-light min-vh-100">
            {/* Header Banner - Executive Gradient */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3 mb-4 p-3 p-md-4 rounded-4 shadow-lg position-relative overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 60%, #047857 100%)',
                    color: 'white',
                    borderLeft: '5px solid #14b8a6'
                }}>
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge px-2.5 py-1 rounded-pill" style={{ background: 'rgba(255,255,255,0.15)', color: '#5eead4', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>
                            <i className="bi bi-file-earmark-spreadsheet me-1"></i>CLASS MARKS MATRIX
                        </span>
                        {activeYearName && (
                            <span className="badge px-2.5 py-1 rounded-pill" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, fontWeight: 600 }}>
                                Year: {activeYearName}
                            </span>
                        )}
                    </div>
                    <h2 className="mb-1 fw-black text-white" style={{ letterSpacing: '-0.8px', fontSize: 'clamp(1.2rem, 2.5vw, 1.75rem)' }}>
                        Class-wide Examination Marks Sheet
                    </h2>
                    <p className="text-white-50 mb-0 small" style={{ fontSize: 'clamp(11px, 1.8vw, 13px)' }}>
                        Consolidated subject-wise marks, grand totals and student class ranks
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button className="btn btn-sm text-white border-0 d-flex align-items-center gap-1 shadow-sm px-3 py-2 flex-grow-1 flex-md-grow-0 justify-content-center"
                        onClick={handlePrint} disabled={!ready || printing || loadingCtx}
                        style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', borderRadius: 10 }}>
                        {printing ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-printer-fill text-info fs-6"></i>}
                        <span className="fw-semibold">Print Marks Sheet</span>
                    </button>
                </div>
            </div>

            {msg && (
                <div className={`alert alert-${msg.type} alert-dismissible shadow-sm rounded-3 mb-4`} role="alert">
                    <i className={`bi ${msg.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
                    {msg.text}
                    <button type="button" className="btn-close" onClick={() => setMsg(null)} />
                </div>
            )}

            {/* Seamless Filter Bar */}
            <div className="card shadow-sm border-0 rounded-4 mb-4" style={{ background: '#ffffff', border: '1px solid #f1f5f9' }}>
                <div className="card-body p-3">
                    <div className="row g-2 g-md-3 align-items-center">
                        <div className="col-12 col-sm-4 col-md-3">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-calendar-event me-1 text-primary"></i>Exam Term
                            </label>
                            <select className="form-select form-select-sm fw-semibold border-0 bg-light rounded-3" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} disabled={loadingCtx}>
                                <option value="">Select Term</option>
                                {terms.map(t => <option key={t.id} value={t.id}>{t.term_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-4 col-md-3">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-building me-1 text-primary"></i>Class
                            </label>
                            <select className="form-select form-select-sm fw-semibold border-0 bg-light rounded-3" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={loadingCtx}>
                                <option value="">Select Class</option>
                                {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-4 col-md-3">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-diagram-2 me-1 text-primary"></i>Section
                            </label>
                            <select className="form-select form-select-sm fw-semibold border-0 bg-light rounded-3" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedClass || loadingCtx}>
                                <option value="">Select Section</option>
                                {filteredSections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-md-3 ms-auto">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1 d-block" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                Search Student
                            </label>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text bg-light border-0"><i className="bi bi-search text-muted"></i></span>
                                <input type="text" className="form-control border-0 bg-light" placeholder="Search name / roll..."
                                    value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Marks Sheet Table View */}
            {ready && (
                <div className="card shadow-lg border-0 rounded-4 overflow-hidden bg-white mb-4">
                    <div className="card-header bg-white p-3 border-bottom d-flex justify-content-between align-items-center">
                        <div className="fw-bold text-dark d-flex align-items-center gap-2">
                            <i className="bi bi-table text-teal" style={{ color: '#0f766e' }}></i>
                            <span>Class Matrix ({sheet?.students?.length || 0} Students)</span>
                        </div>
                    </div>

                    <div className="card-body p-0">
                        {loading ? (
                            <div className="text-center p-5">
                                <div className="spinner-border text-teal" role="status" style={{ color: '#0f766e' }}></div>
                                <p className="text-muted mt-2 small fw-semibold">Loading class marks sheet matrix...</p>
                            </div>
                        ) : !sheet || sheet.students.length === 0 ? (
                            <div className="text-center p-5 text-muted">
                                <i className="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i>
                                No student marks recorded for selected term &amp; section.
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0" style={{ fontSize: 12.5, minWidth: 750 }}>
                                    <thead className="text-uppercase small" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                                        <tr>
                                            <th className="ps-3" style={{ width: 50, padding: '10px 12px' }}>Roll</th>
                                            <th style={{ minWidth: 160, padding: '10px 12px' }}>Student Name</th>
                                            {sheet.subjects.map(s => (
                                                <th key={s.subject_id} className="text-center" style={{ padding: '10px 12px' }}>{s.subject_name}</th>
                                            ))}
                                            <th className="text-center" style={{ width: 90, padding: '10px 12px' }}>Obtained</th>
                                            <th className="text-center" style={{ width: 80, padding: '10px 12px' }}>Rank</th>
                                            <th className="text-center pe-3" style={{ width: 70, padding: '10px 12px' }}>Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map((st, idx) => (
                                            <tr key={st.student_id}>
                                                <td className="ps-3">
                                                    <span className="badge bg-light text-dark border fw-bold" style={{ fontSize: 10.5 }}>
                                                        {st.roll_no || idx + 1}
                                                    </span>
                                                </td>
                                                <td className="fw-bold text-dark">{st.first_name} {st.last_name}</td>
                                                {sheet.subjects.map(sub => {
                                                    const sm = st.subject_marks.find(m => m.subject_id === sub.subject_id);
                                                    return (
                                                        <td key={sub.subject_id} className="text-center font-monospace">
                                                            {sm && sm.obtained_marks !== null ? (
                                                                <span className="fw-bold text-dark">{fmtN(sm.obtained_marks)}</span>
                                                            ) : (
                                                                <span className="text-muted small">—</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="text-center fw-black text-success" style={{ fontSize: 13 }}>
                                                    {fmtN(st.grand_obtained)}
                                                </td>
                                                <td className="text-center">
                                                    {st.ordinal_position ? (
                                                        <span className="badge bg-teal text-white fw-bold px-2 py-1" style={{ background: '#0f766e', fontSize: 10 }}>
                                                            {st.ordinal_position}
                                                        </span>
                                                    ) : <span className="text-muted">—</span>}
                                                </td>
                                                <td className="text-center pe-3">
                                                    <span className={`badge ${st.grade === 'F' ? 'bg-danger' : st.grade === 'A+' ? 'bg-success' : 'bg-primary'}`} style={{ fontSize: 10 }}>
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
