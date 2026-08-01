'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type ClassItem = { class_id: number; class_name: string };
type SectionItem = { section_id: number; section_name: string; class_id: number };
type SubjectItem = {
    subject_id: number; subject_name: string; subject_code?: string | null;
    section_id: number; class_id: number;
};

type TestPaper = {
    test_id: number; test_name: string; description?: string | null;
    total_marks: number; created_at: string; created_by_name: string;
    marks_entered: number;
};

type StudentMarkRow = {
    student_id: number; first_name: string; last_name: string;
    admission_no?: string | null; roll_no?: string | null;
    test_mark_id?: number | null; obtained_marks?: number | null; remarks?: string | null;
};

type SheetData = {
    test: TestPaper & { class_name: string; section_name: string; subject_name: string };
    readonly: boolean;
    students: StudentMarkRow[];
};

const API = process.env.NEXT_PUBLIC_API_URL || "https://shaheenschool.onrender.com";

export default function TestMarkingPage() {
    const { user, hasPermission } = useAuth();

    // ── context state ────────────────────────────────────────────────────────
    const [loadingCtx, setLoadingCtx] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [sections, setSections] = useState<SectionItem[]>([]);
    const [subjects, setSubjects] = useState<SubjectItem[]>([]);

    // ── filter selectors ─────────────────────────────────────────────────────
    const [selClass, setSelClass] = useState('');
    const [selSection, setSelSection] = useState('');
    const [selSubject, setSelSubject] = useState('');
    const [searchKeyword, setSearchKeyword] = useState('');

    // ── tests list ───────────────────────────────────────────────────────────
    const [loadingTests, setLoadingTests] = useState(false);
    const [tests, setTests] = useState<TestPaper[]>([]);

    // ── create-test form ─────────────────────────────────────────────────────
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formTotal, setFormTotal] = useState('');
    const [creating, setCreating] = useState(false);

    // ── marking sheet ────────────────────────────────────────────────────────
    const [selectedTest, setSelectedTest] = useState<number | null>(null);
    const [loadingSheet, setLoadingSheet] = useState(false);
    const [sheet, setSheet] = useState<SheetData | null>(null);
    const [obtainedMap, setObtainedMap] = useState<Record<number, string>>({});
    const [remarksMap, setRemarksMap] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // ── messages ─────────────────────────────────────────────────────────────
    const [msg, setMsg] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(null);

    // ── derived lists ─────────────────────────────────────────────────────────
    const filteredSections = useMemo(() =>
        selClass ? sections.filter(s => s.class_id === Number(selClass)) : [],
        [sections, selClass]
    );

    const filteredSubjects = useMemo(() =>
        (selClass && selSection)
            ? subjects.filter(s => s.class_id === Number(selClass) && s.section_id === Number(selSection))
            : [],
        [subjects, selClass, selSection]
    );

    const readyToList = !!(selClass && selSection && selSubject && user?.id);

    // ── load context ──────────────────────────────────────────────────────────
    const loadContext = async () => {
        if (!user?.id) { setLoadingCtx(false); return; }
        setLoadingCtx(true);
        setMsg(null);
        try {
            const r = await fetch(`${API}/exams/tests/context?user_id=${user.id}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Failed to load context');
            setIsAdmin(!!d.is_admin);
            setClasses(d.classes || []);
            setSections(d.sections || []);
            setSubjects(d.subjects || []);
        } catch (e: any) {
            setMsg({ type: 'danger', text: e.message || 'Failed to load context' });
        } finally {
            setLoadingCtx(false);
        }
    };

    useEffect(() => { loadContext(); }, [user?.id]);

    // cascade resets
    useEffect(() => { setSelSection(''); setSelSubject(''); setTests([]); setSelectedTest(null); setSheet(null); }, [selClass]);
    useEffect(() => { setSelSubject(''); setTests([]); setSelectedTest(null); setSheet(null); }, [selSection]);
    useEffect(() => { setTests([]); setSelectedTest(null); setSheet(null); }, [selSubject]);

    useEffect(() => {
        if (filteredSections.length === 1 && !selSection)
            setSelSection(String(filteredSections[0].section_id));
    }, [filteredSections]);

    useEffect(() => {
        if (filteredSubjects.length === 1 && !selSubject)
            setSelSubject(String(filteredSubjects[0].subject_id));
    }, [filteredSubjects]);

    // ── load tests list (Seamless Auto-Load) ──────────────────────────────────
    const loadTests = async () => {
        if (!readyToList || !user?.id) return;
        setLoadingTests(true);
        setMsg(null);
        try {
            const p = new URLSearchParams({ user_id: String(user.id), class_id: selClass, section_id: selSection, subject_id: selSubject });
            const r = await fetch(`${API}/exams/tests?${p}`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Failed to load tests');
            setTests(d.tests || []);
        } catch (e: any) {
            setMsg({ type: 'danger', text: e.message || 'Failed to load tests' });
        } finally {
            setLoadingTests(false);
        }
    };

    useEffect(() => {
        if (readyToList) loadTests();
    }, [selClass, selSection, selSubject, user?.id]);

    // ── create test ───────────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!user?.id || !readyToList) return;
        if (!formName.trim()) { setMsg({ type: 'warning', text: 'Test name is required.' }); return; }
        const tm = Number(formTotal);
        if (!Number.isFinite(tm) || tm <= 0) { setMsg({ type: 'warning', text: 'Total marks must be > 0.' }); return; }

        setCreating(true);
        setMsg(null);
        try {
            const r = await fetch(`${API}/exams/tests/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    class_id: Number(selClass),
                    section_id: Number(selSection),
                    subject_id: Number(selSubject),
                    test_name: formName.trim(),
                    description: formDesc.trim() || null,
                    total_marks: tm,
                })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Failed to create test');
            setMsg({ type: 'success', text: d.message || 'Test created successfully.' });
            setFormName(''); setFormDesc(''); setFormTotal('');
            setShowCreateForm(false);
            await loadTests();
        } catch (e: any) {
            setMsg({ type: 'danger', text: e.message || 'Create failed' });
        } finally {
            setCreating(false);
        }
    };

    // ── load sheet for selected test ──────────────────────────────────────────
    const openSheet = async (testId: number) => {
        if (!user?.id) return;
        setSelectedTest(testId);
        setLoadingSheet(true);
        setMsg(null);
        try {
            const p = new URLSearchParams({ user_id: String(user.id), test_id: String(testId) });
            const r = await fetch(`${API}/exams/tests/sheet?${p}`);
            const d: SheetData = await r.json();
            if (!r.ok) throw new Error((d as any).error || 'Failed to load test sheet');
            setSheet(d);

            const oMap: Record<number, string> = {};
            const rMap: Record<number, string> = {};
            (d.students || []).forEach(s => {
                oMap[s.student_id] = s.obtained_marks !== null && s.obtained_marks !== undefined ? String(s.obtained_marks) : '';
                rMap[s.student_id] = s.remarks || '';
            });
            setObtainedMap(oMap);
            setRemarksMap(rMap);
        } catch (e: any) {
            setSheet(null);
            setMsg({ type: 'danger', text: e.message || 'Failed to open sheet' });
        } finally {
            setLoadingSheet(false);
        }
    };

    // ── save marks for selected test ──────────────────────────────────────────
    const handleSaveMarks = async () => {
        if (!user?.id || !sheet) return;
        const tm = sheet.test.total_marks;

        const payload = sheet.students.map(s => {
            const val = obtainedMap[s.student_id];
            const obt = (val === '' || val === undefined || val === null) ? NaN : Number(val);
            return {
                student_id: s.student_id,
                obtained_marks: obt,
                remarks: remarksMap[s.student_id] || null,
            };
        });

        for (const row of payload) {
            if (!Number.isFinite(row.obtained_marks) || row.obtained_marks < 0 || row.obtained_marks > tm) {
                setMsg({ type: 'danger', text: `Marks for each student must be between 0 and ${tm}.` });
                return;
            }
        }

        setSaving(true);
        setMsg(null);
        try {
            const r = await fetch(`${API}/exams/tests/marks/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    test_id: sheet.test.test_id,
                    marks: payload,
                })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Failed to save marks');
            setMsg({ type: 'success', text: d.message || 'Test marks saved successfully.' });
            await loadTests();
            await openSheet(sheet.test.test_id);
        } catch (e: any) {
            setMsg({ type: 'danger', text: e.message || 'Save failed' });
        } finally {
            setSaving(false);
        }
    };

    // ── delete test ───────────────────────────────────────────────────────────
    const handleDeleteTest = async (testId: number, testName: string) => {
        if (!user?.id) return;
        if (!window.confirm(`Delete test "${testName}"? All entered marks for this test will be removed.`)) return;

        setDeleting(true);
        setMsg(null);
        try {
            const p = new URLSearchParams({ user_id: String(user.id), test_id: String(testId) });
            const r = await fetch(`${API}/exams/tests?${p}`, { method: 'DELETE' });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Delete failed');
            setMsg({ type: 'success', text: d.message || 'Test deleted successfully.' });
            if (selectedTest === testId) { setSelectedTest(null); setSheet(null); }
            await loadTests();
        } catch (e: any) {
            setMsg({ type: 'danger', text: e.message || 'Delete failed' });
        } finally {
            setDeleting(false);
        }
    };

    const filteredSheetStudents = useMemo(() => {
        if (!sheet?.students) return [];
        if (!searchKeyword.trim()) return sheet.students;
        const q = searchKeyword.toLowerCase().trim();
        return sheet.students.filter(s =>
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
            (s.roll_no || '').toLowerCase().includes(q) ||
            (s.admission_no || '').toLowerCase().includes(q)
        );
    }, [sheet, searchKeyword]);

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
                            <i className="bi bi-journal-check me-1"></i>CLASS TEST EVALUATION
                        </span>
                    </div>
                    <h2 className="mb-1 fw-black text-white" style={{ letterSpacing: '-0.8px', fontSize: 'clamp(1.2rem, 2.5vw, 1.75rem)' }}>
                        Class Test Marking &amp; Assessment
                    </h2>
                    <p className="text-white-50 mb-0 small" style={{ fontSize: 'clamp(11px, 1.8vw, 13px)' }}>
                        Create class tests, enter student marks and track ongoing test performance
                    </p>
                </div>

                {readyToList && hasPermission('academic', 'write') && (
                    <div className="d-flex align-items-center gap-2">
                        <button className="btn btn-sm text-white border-0 d-flex align-items-center gap-1 shadow-sm px-3 py-2 flex-grow-1 flex-md-grow-0 justify-content-center"
                            onClick={() => setShowCreateForm(p => !p)}
                            style={{ background: showCreateForm ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', borderRadius: 10 }}>
                            <i className={`bi ${showCreateForm ? 'bi-x-lg' : 'bi-plus-circle-fill'} fs-6`}></i>
                            <span className="fw-semibold">{showCreateForm ? 'Cancel Form' : 'New Class Test'}</span>
                        </button>
                    </div>
                )}
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
                        <div className="col-12 col-sm-4 col-md-4">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-building me-1 text-primary"></i>Class
                            </label>
                            <select className="form-select form-select-sm fw-semibold border-0 bg-light rounded-3" value={selClass} onChange={e => setSelClass(e.target.value)} disabled={loadingCtx}>
                                <option value="">Select Class</option>
                                {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-4 col-md-4">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-diagram-2 me-1 text-primary"></i>Section
                            </label>
                            <select className="form-select form-select-sm fw-semibold border-0 bg-light rounded-3" value={selSection} onChange={e => setSelSection(e.target.value)} disabled={!selClass || loadingCtx}>
                                <option value="">Select Section</option>
                                {filteredSections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-4 col-md-4">
                            <label className="form-label small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
                                <i className="bi bi-book me-1 text-primary"></i>Subject
                            </label>
                            <select className="form-select form-select-sm fw-semibold border-0 bg-light rounded-3" value={selSubject} onChange={e => setSelSubject(e.target.value)} disabled={!selSection || loadingCtx}>
                                <option value="">Select Subject</option>
                                {filteredSubjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}{s.subject_code ? ` (${s.subject_code})` : ''}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create New Test Collapse Form */}
            {showCreateForm && readyToList && (
                <div className="card shadow-md border-0 rounded-4 mb-4 bg-white" style={{ borderLeft: '4px solid #0f766e' }}>
                    <div className="card-body p-3 p-md-4">
                        <h6 className="fw-bold text-dark mb-3">Create New Class Test</h6>
                        <div className="row g-3">
                            <div className="col-12 col-md-6">
                                <label className="form-label small fw-bold text-muted text-uppercase">Test Name / Title *</label>
                                <input type="text" className="form-control rounded-3" placeholder="e.g. Weekly Quiz #1" value={formName} onChange={e => setFormName(e.target.value)} />
                            </div>
                            <div className="col-12 col-md-3">
                                <label className="form-label small fw-bold text-muted text-uppercase">Total Marks *</label>
                                <input type="number" className="form-control rounded-3 text-center fw-bold" placeholder="25" min={1} value={formTotal} onChange={e => setFormTotal(e.target.value)} />
                            </div>
                            <div className="col-12 col-md-3 d-flex align-items-end">
                                <button className="btn btn-teal text-white fw-bold w-100 rounded-3 py-2" onClick={handleCreate} disabled={creating} style={{ background: '#0f766e' }}>
                                    {creating ? 'Creating...' : 'Create Test Paper'}
                                </button>
                            </div>
                            <div className="col-12">
                                <input type="text" className="form-control rounded-3" placeholder="Description / topics covered (optional)..." value={formDesc} onChange={e => setFormDesc(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tests List & Marking Sheet */}
            {readyToList && (
                <div className="row g-3">
                    {/* Left Column: Test Papers List */}
                    <div className={sheet ? "col-12 col-lg-4" : "col-12"}>
                        <div className="card shadow-lg border-0 rounded-4 bg-white overflow-hidden">
                            <div className="card-header bg-white p-3 border-bottom d-flex justify-content-between align-items-center">
                                <span className="fw-bold text-dark">Class Tests ({tests.length})</span>
                            </div>
                            <div className="card-body p-0">
                                {loadingTests ? (
                                    <div className="text-center p-4 text-muted">Loading class tests...</div>
                                ) : tests.length === 0 ? (
                                    <div className="text-center p-4 text-muted">No tests created for this subject yet.</div>
                                ) : (
                                    <div className="list-group list-group-flush">
                                        {tests.map(t => {
                                            const isActive = selectedTest === t.test_id;
                                            return (
                                                <button key={t.test_id}
                                                    className={`list-group-item list-group-item-action p-3 text-start border-bottom ${isActive ? 'bg-light border-start border-4 border-teal' : ''}`}
                                                    style={{ borderLeftColor: isActive ? '#0f766e' : 'transparent' }}
                                                    onClick={() => openSheet(t.test_id)}>
                                                    <div className="d-flex justify-content-between align-items-start mb-1">
                                                        <span className="fw-bold text-dark" style={{ fontSize: 13.5 }}>{t.test_name}</span>
                                                        <span className="badge bg-light text-dark border fw-bold">{t.total_marks} Marks</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between align-items-center mt-2" style={{ fontSize: 11 }}>
                                                        <span className="text-muted"><i className="bi bi-person me-1"></i>{t.created_by_name || 'Teacher'}</span>
                                                        <span className={`badge rounded-pill ${t.marks_entered > 0 ? 'bg-success bg-opacity-15 text-success' : 'bg-warning bg-opacity-15 text-warning-emphasis'}`}>
                                                            {t.marks_entered > 0 ? `${t.marks_entered} Entered` : 'Pending'}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Marking Sheet */}
                    {sheet && (
                        <div className="col-12 col-lg-8">
                            <div className="card shadow-lg border-0 rounded-4 bg-white overflow-hidden">
                                <div className="card-header bg-white p-3 border-bottom d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-2">
                                    <div>
                                        <h5 className="fw-bold text-dark mb-0">{sheet.test.test_name}</h5>
                                        <span className="text-muted small">Max Marks: {sheet.test.total_marks}</span>
                                    </div>

                                    <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                                        <div className="input-group input-group-sm" style={{ maxWidth: 180 }}>
                                            <span className="input-group-text bg-light border-0"><i className="bi bi-search text-muted"></i></span>
                                            <input type="text" className="form-control border-0 bg-light" placeholder="Search..."
                                                value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} />
                                        </div>

                                        {!sheet.readonly && hasPermission('academic', 'write') && (
                                            <button className="btn btn-teal text-white btn-sm fw-bold px-3 py-1.5 rounded-3 shadow-sm"
                                                onClick={handleSaveMarks} disabled={saving || loadingSheet} style={{ background: '#0f766e' }}>
                                                {saving ? 'Saving...' : <><i className="bi bi-floppy-fill me-1"></i>Save Marks</>}
                                            </button>
                                        )}

                                        {(isAdmin || hasPermission('academic', 'delete')) && (
                                            <button className="btn btn-outline-danger btn-sm rounded-3 px-2.5 py-1.5"
                                                onClick={() => handleDeleteTest(sheet.test.test_id, sheet.test.test_name)} disabled={deleting}>
                                                <i className="bi bi-trash3"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="card-body p-0">
                                    {loadingSheet ? (
                                        <div className="text-center p-5">
                                            <div className="spinner-border text-teal" role="status" style={{ color: '#0f766e' }}></div>
                                            <p className="text-muted mt-2 small fw-semibold">Loading student test marks...</p>
                                        </div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                                                <thead className="text-uppercase small" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                                                    <tr>
                                                        <th className="ps-3" style={{ width: 40 }}>#</th>
                                                        <th>Student Name</th>
                                                        <th style={{ width: 90 }}>Roll No</th>
                                                        <th className="text-end" style={{ width: 140 }}>Obtained</th>
                                                        <th style={{ width: 180 }}>Remarks</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredSheetStudents.map((s, idx) => (
                                                        <tr key={s.student_id}>
                                                            <td className="ps-3 text-muted small fw-semibold">{idx + 1}</td>
                                                            <td className="fw-bold text-dark">{s.first_name} {s.last_name}</td>
                                                            <td>
                                                                <span className="badge bg-light text-dark border fw-semibold" style={{ fontSize: 10.5 }}>
                                                                    {s.roll_no || '—'}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="input-group input-group-sm ms-auto" style={{ maxWidth: 130 }}>
                                                                    <input
                                                                        type="number"
                                                                        className="form-control form-control-sm text-end fw-bold"
                                                                        onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                                                                        min={0}
                                                                        max={sheet.test.total_marks}
                                                                        step="0.01"
                                                                        placeholder="0"
                                                                        value={obtainedMap[s.student_id] ?? ''}
                                                                        disabled={sheet.readonly || saving}
                                                                        onChange={(e) => setObtainedMap(p => ({ ...p, [s.student_id]: e.target.value }))}
                                                                    />
                                                                    <span className="input-group-text bg-light text-muted" style={{ fontSize: 10 }}>/ {sheet.test.total_marks}</span>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    className="form-control form-control-sm border-light"
                                                                    placeholder="Remarks..."
                                                                    value={remarksMap[s.student_id] ?? ''}
                                                                    disabled={sheet.readonly || saving}
                                                                    onChange={(e) => setRemarksMap(p => ({ ...p, [s.student_id]: e.target.value }))}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
