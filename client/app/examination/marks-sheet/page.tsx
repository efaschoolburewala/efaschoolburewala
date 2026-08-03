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
    subject_marks?: { subject_id: number; obtained_marks: number | null; total_marks: number | null }[];
    subject_rows?: { subject_id: number; subject_name: string; obtained_marks: number | null; total_marks: number | null }[];
    grand_obtained?: number;
    grand_obtained_marks?: number;
    grand_total?: number;
    grand_total_marks?: number;
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
    class_teacher?: string;
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

function esc(text: unknown): string {
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
    const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://shaheenschool.onrender.com").replace(/\/+$/, '');
    if (!rawLogo || !rawLogo.trim()) return `${API_URL}/icon.png`;
    const logoStr = rawLogo.trim();
    if (logoStr.startsWith('data:') || logoStr.startsWith('http://') || logoStr.startsWith('https://')) {
        return logoStr;
    }
    const cleanPath = logoStr.replace(/^\/+/, '');
    return `${API_URL}/${cleanPath}`;
}

function getSubjectMaxMarksMap(subjects: SubjectCol[], students: StudentRow[]): Record<number, number | string> {
    const map: Record<number, number | string> = {};
    subjects.forEach(s => {
        let found: number | string = '';
        for (const st of students) {
            const smList = st.subject_marks || st.subject_rows || [];
            const sm = smList.find((m: any) => m.subject_id === s.subject_id);
            if (sm && sm.total_marks !== null && sm.total_marks !== undefined && Number(sm.total_marks) > 0) {
                found = fmtN(sm.total_marks);
                break;
            }
        }
        map[s.subject_id] = found;
    });
    return map;
}

function buildPrintHtml(payload: SheetPayload): string {
    const { meta, school, subjects, students } = payload;
    const schoolName = school.school_name || 'Shaheen English Model School';
    const address = school.school_address || '83/m Madina colony Vehari';
    const phones = [school.phone_number, school.school_phone2, school.school_phone3].filter(Boolean).join(', ');
    const fullAddressPhone = [address, phones ? `Ph: ${phones}` : ''].filter(Boolean).join(' | ');
    const logo = getLogoUrl(school.school_logo_url);

    const subjectMaxMap = getSubjectMaxMarksMap(subjects, students);
    const overallMaxMarks = subjects.reduce<number>((sum, s) => sum + (Number(subjectMaxMap[s.subject_id]) || 0), 0);

    const ROWS_PER_PAGE = 16;
    const numPages = Math.max(1, Math.ceil(students.length / ROWS_PER_PAGE));

    let pagesHtml = '';

    for (let p = 0; p < numPages; p++) {
        const startIdx = p * ROWS_PER_PAGE;
        const pageStudents = students.slice(startIdx, startIdx + ROWS_PER_PAGE);

        let rowsHtml = '';
        for (let i = 0; i < ROWS_PER_PAGE; i++) {
            const st = pageStudents[i];
            const rollNo = st ? (st.roll_no || String(startIdx + i + 1)) : String(startIdx + i + 1);
            const studentName = st ? `${st.first_name || ''} ${st.last_name || ''}`.trim() : '';
            const markCells = subjects.map(s => {
                if (!st) return '<td></td>';
                const smList = st.subject_marks || st.subject_rows || [];
                const sm = smList.find((m: any) => m.subject_id === s.subject_id);
                const val = sm && sm.obtained_marks !== null && sm.obtained_marks !== undefined ? esc(fmtN(sm.obtained_marks)) : '';
                return `<td>${val}</td>`;
            }).join('');

            const obtainedVal = st
                ? (st.grand_obtained !== undefined && st.grand_obtained !== null && st.grand_obtained > 0
                    ? esc(fmtN(st.grand_obtained))
                    : (st.grand_obtained_marks !== undefined && st.grand_obtained_marks !== null && st.grand_obtained_marks > 0
                        ? esc(fmtN(st.grand_obtained_marks))
                        : ''))
                : '';
            const posVal = st ? esc(st.ordinal_position || (st.position ? String(st.position) : '')) : '';

            rowsHtml += `
              <tr>
                <td class="roll-col">${esc(rollNo)}</td>
                <td class="name-col">${esc(studentName)}</td>
                ${markCells}
                <td>${obtainedVal}</td>
                <td>${posVal}</td>
              </tr>`;
        }

        const subjectThs = subjects.map(s => {
            const maxM = subjectMaxMap[s.subject_id];
            return `<th>${esc(s.subject_name)}<br><span class="max-marks">${esc(maxM)}</span></th>`;
        }).join('');

        const theadHtml = `
          <tr>
            <th class="roll-col">Roll<br>No</th>
            <th class="name-col">Student Name</th>
            ${subjectThs}
            <th>Total<br>Marks</th>
            <th>Position</th>
          </tr>`;

        const isFirstPage = p === 0;

        const pageHeaderHtml = isFirstPage ? `
          <div class="school-header">
            <img src="${esc(logo)}" alt="logo" class="logo-circle">
            <div class="titles">
              <h1>${esc(schoolName)}</h1>
              <span class="addr">${esc(fullAddressPhone)}</span>
            </div>
          </div>
          <div class="sheet-title">Detailed Marks Sheet of Obtained Marks in Exam.</div>
          <div class="meta-line">
            <span class="item">Class: <span class="val">${esc(meta.class_name)}</span></span>
            <span class="item">Section: <span class="val">${esc(meta.section_name)}</span></span>
            <span class="item">Exam Term: <span class="val">${esc(meta.term_name)}</span></span>
            <span class="item">Year: <span class="val">${esc(meta.year_name)}</span></span>
            <span class="item">Total Marks: <span class="val">${overallMaxMarks ? esc(overallMaxMarks) : ''}</span></span>
            <span class="item">Class Teacher: <span class="val">${esc(meta.class_teacher || '')}</span></span>
          </div>` : '';

        pagesHtml += `
          <div class="page-card">
            ${pageHeaderHtml}
            <table class="marks">
              <thead>${theadHtml}</thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>`;
    }

    return `<!DOCTYPE html>
<html lang="ur">
<head>
<meta charset="UTF-8">
<title>Marks Sheet - ${esc(meta.class_name)} ${esc(meta.section_name)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Georgia, serif; margin: 0; color: #000; background: #e9e9e9; }

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
    body { background: #fff; }
    .page-card { border-radius: 0; margin-bottom: 0; box-shadow: none; padding: 0; page-break-after: always; break-after: page; }
    .page-card:last-child { page-break-after: auto; break-after: auto; }
  }

  .page-wrap { padding-top: 46px; }

  .page-card {
    background: #fff;
    padding: 14px 18px 18px;
    border-radius: 10px;
    margin: 0 auto 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }

  .school-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    border-bottom: 3px double #000;
    padding-bottom: 8px;
    margin-bottom: 4px;
  }
  .school-header img { width: 90px; height: 90px; object-fit: cover; flex-shrink: 0; border: 3px solid #000; }
  .school-header img.logo-circle { border-radius: 50%; }
  .school-header img.logo-square { border-radius: 8px; }
  .school-header .titles { text-align: left; white-space: nowrap; }
  .school-header h1 { margin: 0; font-size: 46px; font-weight: 900; letter-spacing: 0.5px; display: inline-block; color: #000; }
  .school-header .addr { font-size: 16px; margin-left: 10px; color: #333; }

  .sheet-title {
    text-align: center; font-weight: bold; font-size: 21px; margin: 12px 0 10px 0;
    color: #000; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .meta-line {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px 30px;
    font-size: 17px;
    margin: 0 auto 14px;
    background: #f0f0f0;
    border: 1px solid #999;
    border-radius: 8px;
    padding: 8px 16px;
    max-width: 95%;
  }
  .meta-line .item { white-space: nowrap; }
  .meta-line .val { font-weight: bold; margin-left: 4px; color: #000; text-decoration: underline; }

  table.marks { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.marks th, table.marks td {
    border: 1.5px solid #000;
    text-align: center;
    padding: 7px 4px;
    font-size: 15px;
  }
  table.marks thead th {
    font-weight: bold;
    font-size: 13px;
    background: #e8e8e8;
    color: #000;
    text-transform: uppercase;
    letter-spacing: 0.2px;
    border: 1.5px solid #000;
    line-height: 1.2;
    white-space: normal;
    word-break: break-word;
    overflow-wrap: break-word;
    vertical-align: middle;
  }
  table.marks thead th .max-marks {
    display: inline-block;
    font-weight: normal;
    font-size: 12px;
    color: #333;
    margin-top: 2px;
    text-transform: none;
  }
  table.marks td.name-col { text-align: left; padding-left: 10px; }
  table.marks th.name-col { text-align: center; }
  table.marks th.roll-col, table.marks td.roll-col { width: 34px; }
  table.marks th.name-col, table.marks td.name-col { width: 190px; }
  table.marks tr { height: 30px; }
  table.marks tbody tr:nth-child(even) { background: #f2f2f2; }
  table.marks td.roll-col { font-weight: bold; color: #000; }
  table.marks thead tr { border-bottom: 3px solid #000; }
</style>
</head>
<body>
<div class="toolbar">
  <span>📄 Marks Sheet: ${esc(meta.class_name)} – ${esc(meta.section_name)} (${esc(meta.term_name)})</span>
  <button onclick="window.print()">🖨️ Print Sheet</button>
</div>
<div class="page-wrap">
  ${pagesHtml}
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

    const subjectMaxMap = useMemo(() => {
        if (!sheet?.subjects || !sheet?.students) return {};
        return getSubjectMaxMarksMap(sheet.subjects, sheet.students);
    }, [sheet]);

    const overallMaxMarks = useMemo(() => {
        if (!sheet?.subjects) return 0;
        return sheet.subjects.reduce<number>((sum, s) => sum + (Number(subjectMaxMap[s.subject_id]) || 0), 0);
    }, [sheet, subjectMaxMap]);

    if (!canUsePage) {
        return (
            <div className="container py-4">
                <div className="alert alert-danger">You do not have permission to access Class Marks Sheet.</div>
            </div>
        );
    }

    const schoolName = sheet?.school?.school_name || 'Shaheen English Model School';
    const address = sheet?.school?.school_address || '83/m Madina colony Vehari';
    const phones = sheet?.school ? [sheet.school.phone_number, sheet.school.school_phone2, sheet.school.school_phone3].filter(Boolean).join(', ') : '';
    const fullAddressPhone = [address, phones ? `Ph: ${phones}` : ''].filter(Boolean).join(' | ');
    const logoUrl = getLogoUrl(sheet?.school?.school_logo_url);

    return (
        <div className="page-wrap" style={{ backgroundColor: '#e9e9e9', minHeight: '100vh', padding: '1.5rem', fontFamily: '"Times New Roman", Georgia, serif' }}>
            {/* Embedded CSS for Page Card Styling */}
            <style jsx global>{`
                .marks-page-card {
                    background: #fff;
                    padding: 14px 18px 18px;
                    border-radius: 10px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                    color: #000;
                    margin-bottom: 20px;
                }
                .marks-school-header {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 14px;
                    border-bottom: 3px double #000;
                    padding-bottom: 8px;
                    margin-bottom: 4px;
                }
                .marks-school-header img {
                    width: 90px;
                    height: 90px;
                    object-fit: cover;
                    flex-shrink: 0;
                    border: 3px solid #000;
                    border-radius: 50%;
                }
                .marks-school-header .titles {
                    text-align: left;
                    white-space: nowrap;
                }
                .marks-school-header h1 {
                    margin: 0;
                    font-size: 46px;
                    font-weight: 900;
                    letter-spacing: 0.5px;
                    display: inline-block;
                    color: #000;
                    font-family: "Times New Roman", Georgia, serif;
                }
                .marks-school-header .addr {
                    font-size: 16px;
                    margin-left: 10px;
                    color: #333;
                }
                .marks-sheet-title {
                    text-align: center;
                    font-weight: bold;
                    font-size: 21px;
                    margin: 12px 0 10px 0;
                    color: #000;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .marks-meta-line {
                    display: flex;
                    justify-content: center;
                    flex-wrap: wrap;
                    gap: 10px 30px;
                    font-size: 17px;
                    margin: 0 auto 14px;
                    background: #f0f0f0;
                    border: 1px solid #999;
                    border-radius: 8px;
                    padding: 8px 16px;
                    max-width: 95%;
                }
                .marks-meta-line .item { white-space: nowrap; }
                .marks-meta-line .val { font-weight: bold; margin-left: 4px; color: #000; text-decoration: underline; }

                table.marks-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                table.marks-table th, table.marks-table td {
                    border: 1.5px solid #000;
                    text-align: center;
                    padding: 7px 4px;
                    font-size: 15px;
                }
                table.marks-table thead th {
                    font-weight: bold;
                    font-size: 13px;
                    background: #e8e8e8;
                    color: #000;
                    text-transform: uppercase;
                    letter-spacing: 0.2px;
                    border: 1.5px solid #000;
                    line-height: 1.2;
                    white-space: normal;
                    word-break: break-word;
                    overflow-wrap: break-word;
                    vertical-align: middle;
                }
                table.marks-table thead th .max-marks {
                    display: inline-block;
                    font-weight: normal;
                    font-size: 12px;
                    color: #333;
                    margin-top: 2px;
                    text-transform: none;
                }
                table.marks-table td.name-col { text-align: left; padding-left: 10px; }
                table.marks-table th.name-col { text-align: center; }
                table.marks-table th.roll-col, table.marks-table td.roll-col { width: 34px; font-weight: bold; color: #000; }
                table.marks-table th.name-col, table.marks-table td.name-col { width: 190px; }
                table.marks-table tr { height: 30px; }
                table.marks-table tbody tr:nth-child(even) { background: #f2f2f2; }
                table.marks-table thead tr { border-bottom: 3px solid #000; }
            `}</style>

            {/* Standard Theme Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4 bg-white p-3 rounded-3 shadow-sm">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: '#000', fontFamily: 'sans-serif' }}>
                        <i className="bi bi-table me-2" style={{ color: '#FE7F2D' }} />
                        Class Marks Sheet
                    </h4>
                    <div className="text-muted small" style={{ fontFamily: 'sans-serif' }}>Detailed marks sheet preview &amp; printing</div>
                </div>
                <span className="badge rounded-pill bg-light text-dark border px-3 py-2" style={{ fontFamily: 'sans-serif' }}>
                    Academic Year: {activeYearName || '—'}
                </span>
            </div>

            {msg && (
                <div className={`alert alert-${msg.type} alert-dismissible shadow-sm`} role="alert" style={{ fontFamily: 'sans-serif' }}>
                    {msg.text}
                    <button type="button" className="btn-close" onClick={() => setMsg(null)} />
                </div>
            )}

            {/* Filters */}
            <div className="card border-0 shadow-sm mb-4" style={{ fontFamily: 'sans-serif' }}>
                <div className="card-header bg-white border-bottom py-3" style={{ borderLeft: '4px solid #215E61' }}>
                    <h6 className="mb-0 fw-bold" style={{ color: '#215E61' }}>
                        <i className="bi bi-funnel-fill me-2" style={{ color: '#215E61' }} />
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
                            <button className="btn btn-success fw-bold w-100 py-2 rounded-3" style={{ backgroundColor: '#215E61', borderColor: '#215E61' }} onClick={handlePrint}
                                disabled={!ready || printing || loadingCtx}>
                                {printing
                                    ? <><span className="spinner-border spinner-border-sm me-2" />Opening...</>
                                    : <><i className="bi bi-printer me-1" />Print Sheet</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview View matching detail marks sheet HTML files */}
            {ready && (
                <div>
                    <div className="d-flex justify-content-between align-items-center mb-3 px-1" style={{ fontFamily: 'sans-serif' }}>
                        <h6 className="mb-0 fw-bold text-dark">
                            Marks Sheet Matrix Preview ({filteredStudents.length} Students)
                        </h6>
                        <div className="input-group input-group-sm" style={{ width: 220 }}>
                            <span className="input-group-text bg-white border-0 shadow-sm"><i className="bi bi-search text-muted"></i></span>
                            <input type="text" className="form-control border-0 shadow-sm bg-white" placeholder="Search name/roll..."
                                value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center p-5 bg-white rounded-3 shadow-sm" style={{ fontFamily: 'sans-serif' }}>
                            <div className="spinner-border text-teal" role="status" style={{ color: '#215E61' }}></div>
                            <p className="text-muted mt-2 small fw-semibold">Loading class marks sheet matrix...</p>
                        </div>
                    ) : !sheet || sheet.students.length === 0 ? (
                        <div className="text-center p-5 text-muted bg-white rounded-3 shadow-sm" style={{ fontFamily: 'sans-serif' }}>
                            No student marks recorded for selected term &amp; section.
                        </div>
                    ) : (
                        <div className="marks-page-card">
                            {/* Page 1 Header */}
                            <div className="marks-school-header">
                                <img src={logoUrl} alt="logo" className="logo-circle" />
                                <div className="titles">
                                    <h1>{schoolName}</h1>
                                    <span className="addr">{fullAddressPhone}</span>
                                </div>
                            </div>
                            <div className="marks-sheet-title">Detailed Marks Sheet of Obtained Marks in Exam.</div>
                            <div className="marks-meta-line">
                                <span className="item">Class: <span className="val">{sheet.meta.class_name}</span></span>
                                <span className="item">Section: <span className="val">{sheet.meta.section_name}</span></span>
                                <span className="item">Exam Term: <span className="val">{sheet.meta.term_name}</span></span>
                                <span className="item">Year: <span className="val">{sheet.meta.year_name}</span></span>
                                <span className="item">Total Marks: <span className="val">{overallMaxMarks || '—'}</span></span>
                                <span className="item">Class Teacher: <span className="val">{sheet.meta.class_teacher || '—'}</span></span>
                            </div>

                            {/* Table */}
                            <div className="table-responsive">
                                <table className="marks-table">
                                    <thead>
                                        <tr>
                                            <th className="roll-col">Roll<br />No</th>
                                            <th className="name-col">Student Name</th>
                                            {sheet.subjects.map(s => (
                                                <th key={s.subject_id}>
                                                    {s.subject_name}<br />
                                                    <span className="max-marks">{subjectMaxMap[s.subject_id] || ''}</span>
                                                </th>
                                            ))}
                                            <th>Total<br />Marks</th>
                                            <th>Position</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map((st, idx) => {
                                            const smList = st.subject_marks || st.subject_rows || [];
                                            const rollNo = st.roll_no || String(idx + 1);
                                            const name = `${st.first_name || ''} ${st.last_name || ''}`.trim();
                                            const grandObtained = st.grand_obtained !== undefined && st.grand_obtained !== null && st.grand_obtained > 0
                                                ? fmtN(st.grand_obtained)
                                                : (st.grand_obtained_marks !== undefined && st.grand_obtained_marks !== null && st.grand_obtained_marks > 0
                                                    ? fmtN(st.grand_obtained_marks)
                                                    : '');
                                            const position = st.ordinal_position || (st.position ? String(st.position) : '');

                                            return (
                                                <tr key={st.student_id}>
                                                    <td className="roll-col">{rollNo}</td>
                                                    <td className="name-col">{name}</td>
                                                    {sheet.subjects.map(sub => {
                                                        const sm = smList.find((m: any) => m.subject_id === sub.subject_id);
                                                        const obtained = sm && sm.obtained_marks !== null && sm.obtained_marks !== undefined
                                                            ? fmtN(sm.obtained_marks)
                                                            : '';
                                                        return <td key={sub.subject_id}>{obtained}</td>;
                                                    })}
                                                    <td>{grandObtained}</td>
                                                    <td>{position}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

