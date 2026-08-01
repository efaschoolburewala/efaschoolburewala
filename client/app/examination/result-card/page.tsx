'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastHelper';

type Term = { id: number; term_name: string };
type ClassItem = { class_id: number; class_name: string };
type SectionItem = { section_id: number; section_name: string; class_id: number };

type StudentListRow = {
    student_id: number;
    first_name: string;
    last_name: string;
    admission_no?: string | null;
    roll_no?: string | null;
    marked_subjects: number;
    total_marks: number;
    obtained_marks: number;
    position: number | null;
    ordinal_position: string | null;
    percentage: number | null;
    grade: string | null;
};

type ResultMeta = {
    term_id: number;
    term_name: string;
    academic_year_id: number;
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

type CardSubjectRow = {
    subject_id: number;
    subject_name: string;
    subject_code?: string | null;
    total_marks: number | null;
    obtained_marks: number | null;
};

type CardStudent = {
    student_id: number;
    first_name: string;
    last_name: string;
    admission_no?: string | null;
    roll_no?: string | null;
    position: number | null;
    ordinal_position: string | null;
    percentage: number | null;
    grade: string | null;
    subject_rows: CardSubjectRow[];
    grand_total_marks: number;
    grand_obtained_marks: number;
};

type CardPayload = {
    meta: ResultMeta;
    school: SchoolInfo;
    students: CardStudent[];
};

const API = process.env.NEXT_PUBLIC_API_URL || "https://shaheenschool.onrender.com";

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

function fmtNum(value: number | string | null | undefined) {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, '');
}

function esc(text: unknown) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function buildPrintHtml(payload: CardPayload, autoPrint = false): string {
    const { meta, school, students } = payload;
    const schoolName = school.school_name || 'Shaheen Public School';
    const address = school.school_address || '';
    const phones = [school.phone_number, school.school_phone2, school.school_phone3].filter(Boolean).join(' | ');
    const logo = getLogoUrl(school.school_logo_url);

    const cardsHtml = payload.students
        .map((student) => {
            const rowsHtml = student.subject_rows
                .map(
                    (row, idx) => `
                        <tr>
                            <td class="center">${idx + 1}</td>
                            <td>${esc(row.subject_name)}</td>
                            <td class="center">${esc(fmtNum(row.total_marks))}</td>
                            <td class="center">${esc(fmtNum(row.obtained_marks))}</td>
                        </tr>
                    `
                )
                .join('');

            return `
                <section class="result-card">
                    <div class="header-row">
                        <div class="logo-wrap">
                            ${logo ? `<img src="${esc(logo)}" alt="School Logo" />` : ''}
                        </div>
                        <div class="title-wrap">
                            <h2>${esc(schoolName)}</h2>
                            ${address ? `<div class="sub">${esc(address)}</div>` : ''}
                            ${phones ? `<div class="sub">${esc(phones)}</div>` : ''}
                            <h3>Result Card</h3>
                        </div>
                    </div>

                    <div class="student-line">
                        <span>Student Name: <b>${esc(`${student.first_name} ${student.last_name}`)}</b></span>
                        <span>Class: <b>${esc(payload.meta.class_name)}</b></span>
                        <span>Section: <b>${esc(payload.meta.section_name)}</b></span>
                    </div>
                    <div class="student-line">
                        <span>Roll No: <b>${esc(student.roll_no || '')}</b></span>
                        <span>Exam Term: <b>${esc(payload.meta.term_name)}</b></span>
                        <span>Year: <b>${esc(payload.meta.year_name)}</b></span>
                    </div>

                    <table class="marks-table">
                        <thead>
                            <tr>
                                <th class="center">S.no</th>
                                <th>Subjects</th>
                                <th class="center">Total Marks</th>
                                <th class="center">Obtained Marks</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                            <tr class="grand-row">
                                <td colspan="2" class="center"><b>Grand Total</b></td>
                                <td class="center"><b>${esc(fmtNum(student.grand_total_marks))}</b></td>
                                <td class="center"><b>${esc(fmtNum(student.grand_obtained_marks))}</b></td>
                            </tr>
                            <tr>
                                <td class="center"><b>Position</b></td>
                                <td class="center"><b>${esc(student.ordinal_position || '--')}</b></td>
                                <td class="center"><b>Percentage</b></td>
                                <td class="center"><b>${student.percentage !== null && student.percentage !== undefined ? esc(String(student.percentage)) + '%' : '--'}</b></td>
                            </tr>
                            <tr>
                                <td colspan="4" class="center" style="font-size:30px;"><b>Grade: ${esc(student.grade || '--')}</b></td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="remarks">Teacher Remarks: ________________________________</div>
                    <div class="sign-row">
                        <span>Teacher sign: _______________</span>
                        <span>Principal Sign: _______________</span>
                    </div>
                </section>
            `;
        })
        .join('');

    return `
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Result Cards</title>
            <style>
                @page { size: A4 portrait; margin: 8mm; }
                * { box-sizing: border-box; }
                body {
                    margin: 0;
                    font-family: "Times New Roman", serif;
                    color: #000;
                    background: #fff;
                }
                .print-toolbar {
                    position: fixed;
                    top: 0; left: 0; right: 0;
                    background: #215E61;
                    color: #fff;
                    padding: 10px 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    z-index: 9999;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                }
                .print-toolbar button {
                    background: #FE7F2D;
                    color: #fff;
                    border: none;
                    padding: 7px 22px;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                }
                .cards-wrapper { padding-top: 52px; }
                @media print {
                    .print-toolbar { display: none !important; }
                    .cards-wrapper { padding-top: 0; }
                }
                .result-card {
                    border: 1px dashed #000;
                    width: 100%;
                    min-height: 270mm;
                    padding: 7mm;
                    page-break-after: always;
                }
                .result-card:last-child { page-break-after: auto; }
                .header-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 8px;
                }
                .logo-wrap {
                    width: 90px;
                    height: 90px;
                    flex: 0 0 90px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .logo-wrap img { width: 90px; height: 90px; object-fit: contain; }
                .title-wrap { flex: 1; text-align: center; }
                .title-wrap h2 { margin: 0; font-size: 34px; font-weight: 700; line-height: 1.1; }
                .title-wrap h3 { margin: 8px 0 0; font-size: 32px; }
                .sub { font-size: 15px; }
                .student-line {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    font-size: 26px;
                    margin: 8px 0;
                    font-weight: 700;
                    flex-wrap: wrap;
                }
                .student-line span { white-space: nowrap; }
                .marks-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                    font-size: 28px;
                }
                .marks-table th,
                .marks-table td {
                    border: 1px solid #000;
                    padding: 8px 10px;
                }
                .center { text-align: center; }
                .grand-row td { font-weight: 700; }
                .remarks {
                    margin-top: 46px;
                    font-size: 30px;
                    font-weight: 700;
                }
                .sign-row {
                    margin-top: 24px;
                    font-size: 30px;
                    font-weight: 700;
                    display: flex;
                    justify-content: space-between;
                    gap: 20px;
                }
            </style>
        </head>
        <body>
            <div class="print-toolbar">
                <span>📄 Result Card ${esc(payload.meta.class_name)} / ${esc(payload.meta.section_name)} / ${esc(payload.meta.term_name)} (${esc(payload.meta.year_name)})</span>
                <button onclick="window.print()">🖨️ Print</button>
            </div>
            <div class="cards-wrapper">
                ${cardsHtml}
            </div>
            ${autoPrint ? '<script>window.onload=function(){window.print();}<\/script>' : ''}
        </body>
        </html>
    `;
}

export default function ResultCardPage() {
    const { user } = useAuth();

    const [loadingContext, setLoadingContext] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [openingStudentId, setOpeningStudentId] = useState<number | null>(null);
    const [printing, setPrinting] = useState(false);

    const [terms, setTerms] = useState<Term[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [sections, setSections] = useState<SectionItem[]>([]);

    const [activeYearName, setActiveYearName] = useState('');
    const [selectedTerm, setSelectedTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');

    const [students, setStudents] = useState<StudentListRow[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const [msg, setMsg] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(null);

    const canUsePage = !!user;

    const filteredSections = useMemo(() => {
        if (!selectedClass) return [];
        return sections.filter((s) => s.class_id === Number(selectedClass));
    }, [sections, selectedClass]);

    const ready = !!(selectedTerm && selectedClass && selectedSection && user?.id);

    const loadContext = async () => {
        if (!user?.id) {
            setLoadingContext(false);
            return;
        }
        setLoadingContext(true);
        setMsg(null);
        try {
            const d = await fetchJson(`${API}/exams/context?user_id=${user.id}`);
            setActiveYearName(d.active_year?.year_name || '');
            setTerms(d.terms || []);
            setClasses(d.classes || []);
            setSections(d.sections || []);

            const termList = d.terms || [];
            const classList = d.classes || [];

            setSelectedTerm((prev) => (prev && termList.some((t: Term) => String(t.id) === prev) ? prev : termList.length > 0 ? String(termList[0].id) : ''));
            setSelectedClass((prev) => (prev && classList.some((c: ClassItem) => String(c.class_id) === prev) ? prev : classList.length > 0 ? String(classList[0].class_id) : ''));
        } catch (e: any) {
            const errText = e.message || 'Failed to load context';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setLoadingContext(false);
        }
    };

    const loadStudents = async () => {
        if (!ready || !user?.id) return;
        setLoadingStudents(true);
        setMsg(null);
        try {
            const params = new URLSearchParams({
                user_id: String(user.id),
                term_id: selectedTerm,
                class_id: selectedClass,
                section_id: selectedSection
            });

            const d = await fetchJson(`${API}/exams/students-list?${params.toString()}`);
            setStudents(Array.isArray(d.students) ? d.students : []);
            setSelectedIds(new Set());
        } catch (e: any) {
            setStudents([]);
            setSelectedIds(new Set());
            const errText = e.message || 'Failed to load students';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setLoadingStudents(false);
        }
    };

    const fetchCards = async (studentIds: number[]): Promise<CardPayload> => {
        if (!user?.id || !ready) throw new Error('Please select term, class and section first');

        const d = await fetchJson(`${API}/exams/result-card/data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id,
                term_id: Number(selectedTerm),
                class_id: Number(selectedClass),
                section_id: Number(selectedSection),
                student_ids: studentIds
            })
        });

        return d as CardPayload;
    };

    const openInNewTab = (html: string) => {
        const win = window.open('', '_blank', 'width=1100,height=900');
        if (!win) {
            const txt = 'Popup blocked. Please allow popups for this site and try again.';
            setMsg({ type: 'danger', text: txt });
            showToast.warning(txt);
            return;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
    };

    const openStudentCard = async (studentId: number) => {
        if (openingStudentId !== null) return;
        setOpeningStudentId(studentId);
        setMsg(null);
        try {
            const payload = await fetchCards([studentId]);
            if (!payload.students || payload.students.length === 0) {
                throw new Error('No result data found for this student');
            }
            openInNewTab(buildPrintHtml(payload, false));
            showToast.info('Result card opened');
        } catch (e: any) {
            const errText = e.message || 'Failed to open result card';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setOpeningStudentId(null);
        }
    };

    const handlePrintSelected = async () => {
        if (selectedIds.size === 0) {
            const txt = 'Select one or more students to print.';
            setMsg({ type: 'warning', text: txt });
            showToast.warning(txt);
            return;
        }

        setPrinting(true);
        setMsg(null);
        try {
            const payload = await fetchCards(Array.from(selectedIds));
            if (!payload.students || payload.students.length === 0) {
                throw new Error('No cards found for selected students');
            }
            openInNewTab(buildPrintHtml(payload, true));
            showToast.success(`Printing ${payload.students.length} result cards`);
        } catch (e: any) {
            const errText = e.message || 'Bulk print failed';
            setMsg({ type: 'danger', text: errText });
            showToast.error(errText);
        } finally {
            setPrinting(false);
        }
    };

    useEffect(() => {
        loadContext();
    }, [user?.id]);

    useEffect(() => {
        setSelectedSection('');
        setStudents([]);
        setSelectedIds(new Set());
    }, [selectedClass]);

    useEffect(() => {
        setStudents([]);
        setSelectedIds(new Set());
    }, [selectedTerm, selectedSection]);

    useEffect(() => {
        if (filteredSections.length === 1 && !selectedSection) {
            setSelectedSection(String(filteredSections[0].section_id));
        }
    }, [filteredSections, selectedSection]);

    // Seamless auto loading
    useEffect(() => {
        if (ready) {
            loadStudents();
        }
    }, [ready, selectedTerm, selectedClass, selectedSection]);

    const filteredStudents = useMemo(() => {
        if (!searchKeyword.trim()) return students;
        const q = searchKeyword.toLowerCase().trim();
        return students.filter(s =>
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
            (s.roll_no || '').toLowerCase().includes(q) ||
            (s.admission_no || '').toLowerCase().includes(q)
        );
    }, [students, searchKeyword]);

    const allVisibleSelected = filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.student_id));

    if (!canUsePage) {
        return (
            <div className="container py-4">
                <div className="alert alert-danger mb-0">You do not have permission to access Result Card.</div>
            </div>
        );
    }

    return (
        <div className="page-wrap" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh', padding: '1.5rem' }}>
            {/* Standard Theme Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-file-earmark-text me-2" style={{ color: 'var(--accent-orange)' }} />
                        Result Card
                    </h4>
                    <div className="text-muted small">Select term, class and section to open student result cards</div>
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
                        Result Card Filters
                    </h6>
                </div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-sm-6 col-md-4">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Term</label>
                            <select className="form-select rounded-3" value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} disabled={loadingContext}>
                                <option value="">Select Term</option>
                                {terms.map((t) => (
                                    <option key={t.id} value={t.id}>{t.term_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-4">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Class</label>
                            <select className="form-select rounded-3" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} disabled={loadingContext}>
                                <option value="">Select Class</option>
                                {classes.map((c) => (
                                    <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-4">
                            <label className="form-label fw-semibold small text-muted text-uppercase">Section</label>
                            <select
                                className="form-select rounded-3"
                                value={selectedSection}
                                onChange={(e) => setSelectedSection(e.target.value)}
                                disabled={!selectedClass || loadingContext}
                            >
                                <option value="">Select Section</option>
                                {filteredSections.map((s) => (
                                    <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Students Table Card */}
            {ready && (
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2 py-3" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                        <div className="d-flex align-items-center gap-2">
                            <span className="fw-semibold" style={{ color: 'var(--primary-dark)' }}>
                                Students ({filteredStudents.length})
                            </span>
                            <span className="badge bg-light text-primary border" style={{ fontSize: 11 }}>
                                {selectedIds.size} Selected
                            </span>
                        </div>

                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <div className="input-group input-group-sm" style={{ width: 180 }}>
                                <span className="input-group-text bg-light border-0"><i className="bi bi-search text-muted"></i></span>
                                <input type="text" className="form-control border-0 bg-light" placeholder="Search..."
                                    value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
                            </div>

                            <button className="btn btn-outline-primary btn-sm fw-bold px-3" onClick={handlePrintSelected} disabled={printing || selectedIds.size === 0 || students.length === 0}>
                                {printing ? 'Printing...' : <><i className="bi bi-printer me-1"></i>Print Selected ({selectedIds.size})</>}
                            </button>

                            {filteredStudents.length > 0 && (
                                <div className="form-check mb-0 ms-2">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="selectAllStudents"
                                        checked={allVisibleSelected}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedIds(new Set(filteredStudents.map((s) => s.student_id)));
                                            } else {
                                                setSelectedIds(new Set());
                                            }
                                        }}
                                    />
                                    <label htmlFor="selectAllStudents" className="form-check-label small fw-semibold" style={{ cursor: 'pointer' }}>Select All</label>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card-body p-0">
                        {loadingStudents ? (
                            <div className="text-center p-5">
                                <div className="spinner-border text-teal" role="status" style={{ color: 'var(--primary-teal)' }}></div>
                                <p className="text-muted mt-2 small fw-semibold">Loading student list...</p>
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center p-5 text-muted">
                                {students.length === 0 ? 'No active students found for selected filters.' : 'No student matching search query.'}
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead style={{ background: 'var(--primary-dark)', color: '#fff' }}>
                                        <tr>
                                            <th style={{ width: 50 }} className="text-center">Select</th>
                                            <th>Student</th>
                                            <th style={{ width: 90 }}>Roll No</th>
                                            <th style={{ width: 80 }} className="text-center">Subjects</th>
                                            <th style={{ width: 90 }} className="text-center">Position</th>
                                            <th style={{ width: 80 }} className="text-center">%</th>
                                            <th style={{ width: 60 }} className="text-center">Grade</th>
                                            <th style={{ width: 90 }} className="text-end pe-4">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map((s) => {
                                            const checked = selectedIds.has(s.student_id);
                                            const isOpening = openingStudentId === s.student_id;
                                            return (
                                                <tr
                                                    key={s.student_id}
                                                    style={{ cursor: openingStudentId !== null ? 'wait' : 'pointer' }}
                                                    onClick={() => openStudentCard(s.student_id)}
                                                >
                                                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            className="form-check-input"
                                                            checked={checked}
                                                            disabled={openingStudentId !== null}
                                                            onChange={(e) => {
                                                                setSelectedIds((prev) => {
                                                                    const next = new Set(prev);
                                                                    if (e.target.checked) next.add(s.student_id);
                                                                    else next.delete(s.student_id);
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="fw-semibold d-flex align-items-center gap-2">
                                                            {s.first_name} {s.last_name}
                                                            {isOpening && <span className="spinner-border spinner-border-sm text-secondary" />}
                                                        </div>
                                                        <div className="small text-muted">Adm: {s.admission_no || '—'}</div>
                                                    </td>
                                                    <td>{s.roll_no || '—'}</td>
                                                    <td className="text-center">
                                                        <span className={`badge ${s.marked_subjects > 0 ? 'bg-success-subtle text-success-emphasis border border-success-subtle' : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'}`}>
                                                            {s.marked_subjects}
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        {s.ordinal_position
                                                            ? <span className="badge fw-bold" style={{ backgroundColor: 'var(--primary-teal)', color: '#fff', fontSize: '0.82rem' }}>{s.ordinal_position}</span>
                                                            : <span className="text-muted small">—</span>}
                                                    </td>
                                                    <td className="text-center">
                                                        {s.percentage !== null ? `${s.percentage}%` : '—'}
                                                    </td>
                                                    <td className="text-center">
                                                        {s.grade
                                                            ? <span className={`badge ${s.grade === 'F' ? 'bg-danger' : s.grade === 'A+' ? 'bg-success' : 'bg-primary'}`}>{s.grade}</span>
                                                            : <span className="text-muted small">—</span>}
                                                    </td>
                                                    <td className="text-end pe-4" onClick={(e) => e.stopPropagation()}>
                                                        <button className="btn btn-sm btn-light border text-primary fw-semibold" onClick={() => openStudentCard(s.student_id)}>
                                                            <i className="bi bi-printer me-1"></i>Card
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
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
