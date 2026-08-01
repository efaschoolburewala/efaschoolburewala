'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type Term = { id: number; term_name: string; start_date?: string | null; end_date?: string | null };
type ClassItem = { class_id: number; class_name: string };
type SectionItem = { section_id: number; section_name: string; class_id: number };
type SubjectItem = {
    subject_id: number;
    subject_name: string;
    subject_code?: string | null;
    section_id: number;
    section_name: string;
    class_id: number;
    class_name: string;
};
type StudentMarkRow = {
    student_id: number;
    first_name: string;
    last_name: string;
    admission_no?: string | null;
    roll_no?: string | null;
    mark_id?: number | null;
    total_marks?: number | null;
    obtained_marks?: number | null;
};

type SheetResponse = {
    readonly: boolean;
    has_any_marks: boolean;
    total_marks: number | null;
    students: StudentMarkRow[];
};

const API = process.env.NEXT_PUBLIC_API_URL || "https://shaheenschool.onrender.com";

export default function ExaminationMarksPage() {
    const { user, hasPermission } = useAuth();

    const [loadingContext, setLoadingContext] = useState(true);
    const [loadingSheet, setLoadingSheet] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [isAdmin, setIsAdmin] = useState(false);
    const [activeYearName, setActiveYearName] = useState('');
    const [terms, setTerms] = useState<Term[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [sections, setSections] = useState<SectionItem[]>([]);
    const [subjects, setSubjects] = useState<SubjectItem[]>([]);

    const [selectedTerm, setSelectedTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');

    const [sheetReadonly, setSheetReadonly] = useState(false);
    const [sheetHasAnyMarks, setSheetHasAnyMarks] = useState(false);
    const [totalMarks, setTotalMarks] = useState('100');
    const [students, setStudents] = useState<StudentMarkRow[]>([]);
    const [obtainedMap, setObtainedMap] = useState<Record<number, string>>({});

    const [msg, setMsg] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(null);

    const canUsePage = !!user;

    const filteredSections = useMemo(() => {
        if (!selectedClass) return [];
        return sections.filter(s => s.class_id === Number(selectedClass));
    }, [sections, selectedClass]);

    const filteredSubjects = useMemo(() => {
        if (!selectedClass || !selectedSection) return [];
        return subjects.filter(s => s.class_id === Number(selectedClass) && s.section_id === Number(selectedSection));
    }, [subjects, selectedClass, selectedSection]);

    const readyToLoadSheet = !!(selectedTerm && selectedClass && selectedSection && selectedSubject && user?.id);

    const loadContext = async () => {
        if (!user?.id) {
            setLoadingContext(false);
            return;
        }
        setLoadingContext(true);
        setMsg(null);
        try {
            const r = await fetch(`${API}/exams/context?user_id=${user.id}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Failed to load examination context');

            setIsAdmin(!!d.is_admin);
            setActiveYearName(d.active_year?.year_name || '');
            setTerms(d.terms || []);
            setClasses(d.classes || []);
            setSections(d.sections || []);
            setSubjects(d.subjects || []);

            const termList = d.terms || [];
            const classList = d.classes || [];

            setSelectedTerm(prev => {
                if (prev && termList.some((t: Term) => String(t.id) === prev)) return prev;
                return termList.length > 0 ? String(termList[0].id) : '';
            });

            setSelectedClass(prev => {
                if (prev && classList.some((c: ClassItem) => String(c.class_id) === prev)) return prev;
                return classList.length > 0 ? String(classList[0].class_id) : '';
            });
        } catch (e: any) {
            setMsg({ type: 'danger', text: e.message || 'Failed to load context' });
        } finally {
            setLoadingContext(false);
        }
    };

    const loadSheet = async () => {
        if (!readyToLoadSheet || !user?.id) return;
        setLoadingSheet(true);
        setMsg(null);
        try {
            const params = new URLSearchParams({
                user_id: String(user.id),
                term_id: selectedTerm,
                class_id: selectedClass,
                section_id: selectedSection,
                subject_id: selectedSubject
            });
            const r = await fetch(`${API}/exams/marking-sheet?${params.toString()}`);
            const d: SheetResponse | any = await r.json();
            if (!r.ok) throw new Error(d.error || 'Failed to load marking sheet');

            setSheetReadonly(!!d.readonly);
            setSheetHasAnyMarks(!!d.has_any_marks);
            setTotalMarks(d.total_marks !== null && d.total_marks !== undefined ? String(d.total_marks) : '100');
            setStudents(d.students || []);

            const nextMap: Record<number, string> = {};
            (d.students || []).forEach((s: StudentMarkRow) => {
                nextMap[s.student_id] = s.obtained_marks !== null && s.obtained_marks !== undefined ? String(s.obtained_marks) : '';
            });
            setObtainedMap(nextMap);
        } catch (e: any) {
            setStudents([]);
            setObtainedMap({});
            setSheetHasAnyMarks(false);
            setSheetReadonly(false);
            setMsg({ type: 'danger', text: e.message || 'Failed to load sheet' });
        } finally {
            setLoadingSheet(false);
        }
    };

    useEffect(() => {
        loadContext();
    }, [user?.id]);

    useEffect(() => {
        setSelectedSection('');
        setSelectedSubject('');
        setStudents([]);
        setObtainedMap({});
        setSheetHasAnyMarks(false);
        setSheetReadonly(false);
    }, [selectedClass]);

    useEffect(() => {
        setSelectedSubject('');
        setStudents([]);
        setObtainedMap({});
        setSheetHasAnyMarks(false);
        setSheetReadonly(false);
    }, [selectedSection]);

    useEffect(() => {
        setStudents([]);
        setObtainedMap({});
        setSheetHasAnyMarks(false);
        setSheetReadonly(false);
    }, [selectedTerm, selectedSubject]);

    useEffect(() => {
        if (filteredSections.length === 1 && !selectedSection) {
            setSelectedSection(String(filteredSections[0].section_id));
        }
    }, [filteredSections, selectedSection]);

    useEffect(() => {
        if (filteredSubjects.length === 1 && !selectedSubject) {
            setSelectedSubject(String(filteredSubjects[0].subject_id));
        }
    }, [filteredSubjects, selectedSubject]);

    // Seamless Auto-Load on Filter Selection
    useEffect(() => {
        if (readyToLoadSheet) {
            loadSheet();
        }
    }, [readyToLoadSheet, selectedTerm, selectedClass, selectedSection, selectedSubject]);

    const handleObtainedChange = (studentId: number, value: string) => {
        setObtainedMap(prev => ({ ...prev, [studentId]: value }));
    };

    const handleSave = async () => {
        if (!user?.id || !readyToLoadSheet) return;
        if (!Number.isFinite(Number(totalMarks)) || Number(totalMarks) <= 0) {
            setMsg({ type: 'danger', text: 'Total marks must be greater than 0.' });
            return;
        }

        const tm = Number(totalMarks);
        const payloadMarks = students.map(s => {
            const val = obtainedMap[s.student_id];
            if (val === '' || val === undefined || val === null) {
                return { student_id: s.student_id, obtained_marks: NaN };
            }
            const n = Number(val);
            return { student_id: s.student_id, obtained_marks: n };
        });

        for (const row of payloadMarks) {
            if (!Number.isFinite(row.obtained_marks) || row.obtained_marks < 0 || row.obtained_marks > tm) {
                setMsg({ type: 'danger', text: `Invalid marks for one or more students. Must be between 0 and ${tm}.` });
                return;
            }
        }

        setSaving(true);
        setMsg(null);
        try {
            const r = await fetch(`${API}/exams/marks/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    term_id: Number(selectedTerm),
                    class_id: Number(selectedClass),
                    section_id: Number(selectedSection),
                    subject_id: Number(selectedSubject),
                    total_marks: tm,
                    marks: payloadMarks
                })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Failed to save marks');

            setMsg({ type: 'success', text: d.message || 'Marks saved successfully.' });
            await loadSheet();
        } catch (e: any) {
            setMsg({ type: 'danger', text: e.message || 'Save failed' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSheet = async () => {
        if (!user?.id || !readyToLoadSheet) return;
        if (!window.confirm('Delete this complete marks sheet? This will remove all student marks for selected term/class/section/subject.')) return;

        setDeleting(true);
        setMsg(null);
        try {
            const params = new URLSearchParams({
                user_id: String(user.id),
                term_id: selectedTerm,
                class_id: selectedClass,
                section_id: selectedSection,
                subject_id: selectedSubject
            });
            const r = await fetch(`${API}/exams/marks/sheet?${params.toString()}`, { method: 'DELETE' });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Delete failed');

            setMsg({ type: 'success', text: d.message || 'Marks deleted successfully.' });
            await loadSheet();
        } catch (e: any) {
            setMsg({ type: 'danger', text: e.message || 'Delete failed' });
        } finally {
            setDeleting(false);
        }
    };

    const filteredStudents = useMemo(() => {
        if (!searchKeyword.trim()) return students;
        const q = searchKeyword.toLowerCase().trim();
        return students.filter(s =>
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
            (s.roll_no || '').toLowerCase().includes(q) ||
            (s.admission_no || '').toLowerCase().includes(q)
        );
    }, [students, searchKeyword]);

    if (!canUsePage) {
        return (
            <div className="container py-4">
                <div className="alert alert-danger mb-0">You do not have permission to access Examination Marks.</div>
            </div>
        );
    }

    const enteredCount = students.filter(s => obtainedMap[s.student_id] !== '' && obtainedMap[s.student_id] !== undefined).length;
    const presentCount = students.filter(s => {
        const n = Number(obtainedMap[s.student_id]);
        return Number.isFinite(n) && n > 0;
    }).length;

    const avgMarks = students.length ? (() => {
        const nums = students.map(s => Number(obtainedMap[s.student_id])).filter(n => Number.isFinite(n));
        if (!nums.length) return 0;
        return +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
    })() : 0;

    return (
        <div className="container-fluid p-2 p-md-4 bg-light min-vh-100">
            {/* Header Banner - Modern Executive Gradient */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3 mb-4 p-3 p-md-4 rounded-4 shadow-lg position-relative overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f766e 60%, #047857 100%)',
                    color: 'white',
                    borderLeft: '5px solid #14b8a6'
                }}>
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge px-2.5 py-1 rounded-pill" style={{ background: 'rgba(255,255,255,0.15)', color: '#5eead4', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>
                            <i className="bi bi-mortarboard me-1"></i>EXAMINATION MANAGEMENT
                        </span>
                        {activeYearName && (
                            <span className="badge px-2.5 py-1 rounded-pill" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, fontWeight: 600 }}>
                                Year: {activeYearName}
                            </span>
                        )}
                    </div>
                    <h2 className="mb-1 fw-black text-white" style={{ letterSpacing: '-0.8px', fontSize: 'clamp(1.2rem, 2.5vw, 1.75rem)' }}>
                        Subject Examination Marks Entry
                    </h2>
                    <p className="text-white-50 mb-0 small" style={{ fontSize: 'clamp(11px, 1.8vw, 13px)' }}>
                        Seamless, real-time subject marks recording and exam evaluation for class sections
                    </p>
                </div>
            </div>

            {msg && (
                <div className={`alert alert-${msg.type} alert-dismissible shadow-sm rounded-3 mb-4`} role="alert">
                    <i className={`bi ${msg.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
                    {msg.text}
                    <button type="button" className="btn-close" onClick={() => setMsg(null)} />
                </div>
            )}

            {/* Seamless Smart Filter Bar */}
            <div className="card shadow-sm border-0 rounded-4 mb-4" style={{ background: '#ffffff', border: '1px solid #f1f5f9' }}>
                <div className="card-body p-3">
                    <div className="row g-2 g-md-3 align-items-center">
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-calendar-event me-1 text-primary"></i>Exam Term
                            </label>
                            <select className="form-select form-select-sm fw-semibold border-0 bg-light rounded-3" value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} disabled={loadingContext}>
                                <option value="">Select Term</option>
                                {terms.map(t => <option key={t.id} value={t.id}>{t.term_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-building me-1 text-primary"></i>Class
                            </label>
                            <select className="form-select form-select-sm fw-semibold border-0 bg-light rounded-3" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} disabled={loadingContext}>
                                <option value="">Select Class</option>
                                {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-diagram-2 me-1 text-primary"></i>Section
                            </label>
                            <select className="form-select form-select-sm fw-semibold border-0 bg-light rounded-3" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedClass || loadingContext}>
                                <option value="">Select Section</option>
                                {filteredSections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-book me-1 text-primary"></i>Subject
                            </label>
                            <select className="form-select form-select-sm fw-semibold border-0 bg-light rounded-3" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={!selectedSection || loadingContext}>
                                <option value="">Select Subject</option>
                                {filteredSubjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}{s.subject_code ? ` (${s.subject_code})` : ''}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Marking Sheet Card */}
            {readyToLoadSheet && (
                <div className="card shadow-lg border-0 rounded-4 overflow-hidden bg-white mb-4">
                    {/* Toolbar Header */}
                    <div className="card-header bg-white p-3 border-bottom d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3">
                        <div className="d-flex align-items-center gap-3">
                            <div className="rounded-3 p-2 text-white" style={{ background: 'linear-gradient(135deg, #0f766e, #047857)' }}>
                                <i className="bi bi-journal-check fs-5"></i>
                            </div>
                            <div>
                                <h5 className="fw-bold mb-0 text-dark">Marking Sheet</h5>
                                <span className="text-muted small">
                                    Total {students.length} Student{students.length !== 1 ? 's' : ''} Enrolled
                                </span>
                            </div>
                        </div>

                        <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                            <div className="input-group input-group-sm" style={{ width: 170 }}>
                                <span className="input-group-text bg-light border-0 fw-semibold text-muted" style={{ fontSize: 11 }}>Total Marks</span>
                                <input
                                    type="number"
                                    className="form-control border-0 bg-light fw-bold text-center"
                                    onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                    value={totalMarks}
                                    min={1}
                                    onChange={(e) => setTotalMarks(e.target.value)}
                                    disabled={sheetReadonly || saving || loadingSheet}
                                    style={{ fontSize: 13 }}
                                />
                            </div>

                            <div className="input-group input-group-sm ms-md-2" style={{ maxWidth: 200 }}>
                                <span className="input-group-text bg-light border-0"><i className="bi bi-search text-muted"></i></span>
                                <input
                                    type="text"
                                    className="form-control border-0 bg-light"
                                    placeholder="Search student..."
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                />
                            </div>

                            {!sheetReadonly && hasPermission('academic', 'write') && (
                                <button className="btn btn-teal text-white btn-sm fw-bold px-3 py-1.5 rounded-3 shadow-sm d-flex align-items-center gap-1"
                                    onClick={handleSave} disabled={saving || loadingSheet || students.length === 0}
                                    style={{ background: '#0f766e' }}>
                                    {saving ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-floppy-fill me-1" />}
                                    Save Marks
                                </button>
                            )}

                            {isAdmin && sheetHasAnyMarks && hasPermission('academic', 'delete') && (
                                <button className="btn btn-outline-danger btn-sm rounded-3 px-3 py-1.5 fw-semibold" onClick={handleDeleteSheet} disabled={deleting || loadingSheet}>
                                    {deleting ? 'Deleting...' : <><i className="bi bi-trash3 me-1"></i>Delete</>}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="card-body p-0">
                        {sheetReadonly && (
                            <div className="alert alert-warning m-3 mb-0 rounded-3">
                                <i className="bi bi-lock-fill me-2"></i>
                                This sheet is locked for your account. You can only view marks.
                            </div>
                        )}

                        {students.length > 0 && (
                            <div className="p-3 bg-light border-bottom">
                                <div className="row g-2 text-center text-md-start">
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted small d-block text-uppercase fw-bold" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Enrolled Students</span>
                                        <span className="fw-black text-dark fs-6">{students.length}</span>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted small d-block text-uppercase fw-bold" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Marks Entered</span>
                                        <span className="fw-black text-success fs-6">{enteredCount} / {students.length}</span>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted small d-block text-uppercase fw-bold" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Class Average</span>
                                        <span className="fw-black text-primary fs-6">{avgMarks} / {totalMarks}</span>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <span className="text-muted small d-block text-uppercase fw-bold" style={{ fontSize: 9, letterSpacing: '0.05em' }}>Passed Students (&gt;0)</span>
                                        <span className="fw-black text-teal fs-6" style={{ color: '#0f766e' }}>{presentCount}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {loadingSheet ? (
                            <div className="text-center p-5">
                                <div className="spinner-border text-teal" role="status" style={{ color: '#0f766e' }}></div>
                                <p className="text-muted mt-2 small fw-semibold">Loading class marking sheet...</p>
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center p-5 text-muted">
                                <i className="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i>
                                {students.length === 0 ? 'No students enrolled in this section' : 'No student matching search query'}
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                                    <thead className="text-uppercase small" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                                        <tr>
                                            <th className="ps-3" style={{ width: 40, padding: '11px 12px' }}>#</th>
                                            <th style={{ width: 100, padding: '11px 12px' }}>Roll No</th>
                                            <th style={{ width: 120, padding: '11px 12px' }}>Admission No</th>
                                            <th style={{ padding: '11px 12px' }}>Student Name</th>
                                            <th className="text-end pe-4" style={{ width: 220, padding: '11px 12px' }}>Obtained Marks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map((s, idx) => (
                                            <tr key={s.student_id}>
                                                <td className="ps-3 text-muted small fw-semibold">{idx + 1}</td>
                                                <td>
                                                    <span className="badge bg-light text-dark border fw-bold" style={{ fontSize: 11 }}>
                                                        {s.roll_no || '—'}
                                                    </span>
                                                </td>
                                                <td className="text-muted small">{s.admission_no || '—'}</td>
                                                <td>
                                                    <div className="fw-bold text-dark">{s.first_name} {s.last_name}</div>
                                                </td>
                                                <td className="text-end pe-4">
                                                    <div className="input-group input-group-sm ms-auto" style={{ maxWidth: 160 }}>
                                                        <input
                                                            type="number"
                                                            className="form-control form-control-sm text-end fw-bold border-1"
                                                            onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                            min={0}
                                                            max={Number(totalMarks) || undefined}
                                                            step="0.01"
                                                            placeholder="0"
                                                            value={obtainedMap[s.student_id] ?? ''}
                                                            disabled={sheetReadonly || saving || loadingSheet}
                                                            onChange={(e) => handleObtainedChange(s.student_id, e.target.value)}
                                                            style={{ border: '1px solid #cbd5e1', borderRadius: '6px 0 0 6px' }}
                                                        />
                                                        <span className="input-group-text bg-light text-muted fw-semibold" style={{ fontSize: 11 }}>/ {totalMarks}</span>
                                                    </div>
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
