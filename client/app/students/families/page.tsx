'use client';
import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

const API = process.env.NEXT_PUBLIC_API_URL || "https://shaheenschool.onrender.com";

interface StudentMember {
    student_id: number;
    admission_no: string;
    first_name: string;
    last_name: string;
    full_name: string;
    father_name: string;
    father_phone: string;
    father_cnic: string;
    mother_name: string;
    mother_phone: string;
    mother_cnic: string;
    guardian_name: string;
    guardian_phone: string;
    current_address: string;
    class_id: number;
    class_name: string;
    section_id: number;
    section_name: string;
    status: string;
}

interface FamilyData {
    family_id: string;
    family_name: string; // Majority father name
    father_name: string;
    mother_name: string;
    father_phone: string;
    mother_phone: string;
    guardian_phone: string;
    primary_phone: string;
    total_children: number;
    children_names: string[];
    classes_list: string[];
    sections_list: string[];
    family_fee: number;
    opening_balance: number;
    members: StudentMember[];
}

interface SchoolInfo {
    school_name: string;
    school_address: string;
    phone_number: string;
    school_phone2: string;
    school_phone3: string;
    school_logo_url: string;
}

export default function FamilyListPage() {
    const [families, setFamilies] = useState<FamilyData[]>([]);
    const [classes, setClasses] = useState<{ class_id: number; class_name: string }[]>([]);
    const [stats, setStats] = useState<{ total_families: number; total_students: number; average_family_size: number | string } | null>(null);
    const [school, setSchool] = useState<SchoolInfo>({
        school_name: '', school_address: '', phone_number: '', school_phone2: '', school_phone3: '', school_logo_url: ''
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedFamilyModal, setSelectedFamilyModal] = useState<FamilyData | null>(null);

    // Fetch families, classes, and school settings
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch classes for filter
                fetch(`${API}/academic`).then(r => r.json()).then(setClasses).catch(() => { });

                // Fetch school settings
                fetch(`${API}/settings`).then(r => r.json()).then((data: any) => {
                    if (data && typeof data === 'object' && !Array.isArray(data)) {
                        setSchool({
                            school_name: data.school_name || 'Shaheen Model High School',
                            school_address: data.address || 'Main Campus, Vehari',
                            phone_number: data.contact_number || '',
                            school_phone2: '',
                            school_phone3: '',
                            school_logo_url: data.logo_url ? `${API}${data.logo_url}` : ''
                        });
                    }
                }).catch(() => { });

                // Fetch families directory
                const res = await fetch(`${API}/students/families-directory`);
                const data = await res.json();
                if (res.ok) {
                    setFamilies(data.families || []);
                    setStats(data.stats || null);
                } else {
                    console.error("Failed to load families:", data.error);
                }
            } catch (err) {
                console.error("Error loading families directory:", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Filter families based on search term & class filter
    const filteredFamilies = useMemo(() => {
        return families.filter(fam => {
            // Search matching
            const s = searchTerm.toLowerCase().trim();
            const matchesSearch = !s || (
                fam.family_id.toLowerCase().includes(s) ||
                fam.family_name.toLowerCase().includes(s) ||
                fam.father_name.toLowerCase().includes(s) ||
                fam.mother_name.toLowerCase().includes(s) ||
                fam.father_phone.includes(s) ||
                fam.mother_phone.includes(s) ||
                fam.children_names.some(c => c.toLowerCase().includes(s)) ||
                fam.members.some(m => m.admission_no.toLowerCase().includes(s))
            );

            // Class matching
            const matchesClass = !selectedClass || fam.members.some(m => m.class_id?.toString() === selectedClass || m.class_name.toLowerCase() === selectedClass.toLowerCase());

            return matchesSearch && matchesClass;
        });
    }, [families, searchTerm, selectedClass]);

    // Format phone for WhatsApp URL (e.g. 03001234567 -> 923001234567)
    const formatWhatsAppNumber = (phone: string) => {
        if (!phone) return '';
        const cleaned = phone.replace(/[^0-9]/g, '');
        if (cleaned.startsWith('0')) {
            return '92' + cleaned.substring(1);
        }
        if (cleaned.startsWith('92')) {
            return cleaned;
        }
        return '92' + cleaned;
    };

    // ── Export Functions ──────────────────────────────────────────────

    // 1. Export Excel
    const exportExcel = () => {
        if (filteredFamilies.length === 0) return;

        const excelData = filteredFamilies.map((f, idx) => ({
            "Sr.#": idx + 1,
            "Family Name": f.family_name,
            "Family ID": f.family_id,
            "Children / Students": f.children_names.join(", "),
            "Classes": f.classes_list.join(", "),
            "Sections": f.sections_list.join(", "),
            "Father Name": f.father_name || "N/A",
            "Mother Name": f.mother_name || "N/A",
            "Father Phone": f.father_phone || "N/A",
            "Mother Phone": f.mother_phone || "N/A",
            "Primary Phone": f.primary_phone || "N/A"
        }));

        const ws = XLSX.utils.json_to_sheet(excelData);
        // Auto-width columns
        const colWidths = [
            { wch: 6 },  // Sr
            { wch: 22 }, // Family Name
            { wch: 16 }, // Family ID
            { wch: 35 }, // Children
            { wch: 20 }, // Classes
            { wch: 15 }, // Sections
            { wch: 22 }, // Father Name
            { wch: 22 }, // Mother Name
            { wch: 16 }, // Father Phone
            { wch: 16 }, // Mother Phone
            { wch: 16 }, // Primary Phone
        ];
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Family Directory");
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Shaheen_School_Family_Directory_${dateStr}.xlsx`);
    };

    // 2. Export CSV
    const exportCSV = () => {
        if (filteredFamilies.length === 0) return;

        const headers = ["Sr.#", "Family Name", "Family ID", "Students", "Classes", "Sections", "Father Name", "Mother Name", "Father Phone", "Mother Phone"];
        const rows = filteredFamilies.map((f, idx) => [
            idx + 1,
            `"${(f.family_name || '').replace(/"/g, '""')}"`,
            `"${(f.family_id || '').replace(/"/g, '""')}"`,
            `"${(f.children_names.join(', ') || '').replace(/"/g, '""')}"`,
            `"${(f.classes_list.join(', ') || '').replace(/"/g, '""')}"`,
            `"${(f.sections_list.join(', ') || '').replace(/"/g, '""')}"`,
            `"${(f.father_name || '').replace(/"/g, '""')}"`,
            `"${(f.mother_name || '').replace(/"/g, '""')}"`,
            `"${(f.father_phone || '').replace(/"/g, '""')}"`,
            `"${(f.mother_phone || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute("download", `Shaheen_School_Family_Directory_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 3. Print / PDF Export
    const exportPDF = () => {
        if (filteredFamilies.length === 0) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        const tableRowsHtml = filteredFamilies.map((f, idx) => `
            <tr>
                <td style="text-align: center; border: 1px solid #333; padding: 6px;">${idx + 1}</td>
                <td style="border: 1px solid #333; padding: 6px; font-weight: bold;">${f.family_name}</td>
                <td style="text-align: center; border: 1px solid #333; padding: 6px; font-weight: bold;">${f.family_id}</td>
                <td style="border: 1px solid #333; padding: 6px;">
                    ${f.members.map(m => `<div>• <strong>${m.full_name}</strong> <small>(${m.admission_no})</small></div>`).join('')}
                </td>
                <td style="text-align: center; border: 1px solid #333; padding: 6px;">${f.classes_list.join(', ')}</td>
                <td style="text-align: center; border: 1px solid #333; padding: 6px;">${f.sections_list.join(', ')}</td>
                <td style="border: 1px solid #333; padding: 6px;">
                    <div><strong>Father:</strong> ${f.father_name || 'N/A'}</div>
                    ${f.mother_name ? `<div style="font-size: 8pt; color: #555;"><strong>Mother:</strong> ${f.mother_name}</div>` : ''}
                </td>
                <td style="border: 1px solid #333; padding: 6px; white-space: nowrap;">
                    <div>${f.father_phone ? `Father: ${f.father_phone}` : ''}</div>
                    <div>${f.mother_phone ? `Mother: ${f.mother_phone}` : ''}</div>
                </td>
            </tr>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Family Directory Report - ${school.school_name || 'Shaheen School'}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 15mm 10mm; color: #000; background: #fff; }
                    .header { display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
                    .logo { width: 70px; height: 70px; object-fit: contain; margin-right: 15px; }
                    .school-name { font-size: 18pt; font-weight: bold; text-transform: uppercase; color: #233D4D; text-align: center; }
                    .school-sub { font-size: 10pt; text-align: center; margin-top: 3px; color: #444; }
                    .title-bar { background-color: #215E61; color: #fff; text-align: center; padding: 6px; font-size: 12pt; font-weight: bold; text-transform: uppercase; margin: 10px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .meta-info { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
                    th { background-color: #f0f4f5; border: 1px solid #333; padding: 6px; font-weight: bold; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @page { size: A4 landscape; margin: 10mm; }
                </style>
            </head>
            <body>
                <div class="header">
                    ${school.school_logo_url ? `<img src="${school.school_logo_url}" class="logo" alt="Logo" />` : ''}
                    <div>
                        <div class="school-name">${school.school_name || 'SHAHEEN MODEL HIGH SCHOOL'}</div>
                        <div class="school-sub">${school.school_address} ${school.phone_number ? `| Ph: ${school.phone_number}` : ''}</div>
                    </div>
                </div>
                <div class="title-bar">FAMILY DIRECTORY & STUDENT LIST</div>
                <div class="meta-info">
                    <div><strong>Total Families Listed:</strong> ${filteredFamilies.length}</div>
                    <div><strong>Date Generated:</strong> ${dateStr}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 4%;">Sr.#</th>
                            <th style="width: 18%;">Family Name</th>
                            <th style="width: 12%;">Family ID</th>
                            <th style="width: 24%;">Students / Children</th>
                            <th style="width: 12%;">Classes</th>
                            <th style="width: 8%;">Sections</th>
                            <th style="width: 12%;">Parents Name</th>
                            <th style="width: 10%;">Phone Numbers</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="container-fluid p-4 animate__animated animate__fadeIn">
            {/* Header Title */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-people-fill me-2" style={{ color: 'var(--primary-teal)' }}></i>
                        Family Directory
                    </h2>
                    <p className="text-muted small mb-0">
                        Complete family units list with primary father names, children, classes, sections, and parent contact options.
                    </p>
                </div>

                {/* Export Options Bar */}
                <div className="d-flex flex-wrap gap-2 align-items-center">
                    <button className="btn btn-outline-danger shadow-sm btn-sm px-3 fw-semibold" onClick={exportPDF} title="Export or Print as PDF">
                        <i className="bi bi-file-earmark-pdf-fill me-1"></i> PDF
                    </button>
                    <button className="btn btn-outline-success shadow-sm btn-sm px-3 fw-semibold" onClick={exportExcel} title="Export to Excel Spreadsheet">
                        <i className="bi bi-file-earmark-excel-fill me-1"></i> Excel
                    </button>
                    <button className="btn btn-outline-primary shadow-sm btn-sm px-3 fw-semibold" onClick={exportCSV} title="Export to CSV File">
                        <i className="bi bi-file-earmark-text-fill me-1"></i> CSV
                    </button>
                    <button className="btn btn-outline-secondary shadow-sm btn-sm px-3 fw-semibold" onClick={exportPDF} title="Print Family Directory">
                        <i className="bi bi-printer-fill me-1"></i> Print
                    </button>
                </div>
            </div>

            {/* Summary Stat Cards */}
            {stats && (
                <div className="row g-3 mb-4">
                    <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3" style={{ borderLeft: '4px solid var(--primary-teal)' }}>
                            <div className="card-body py-2 px-3">
                                <div className="text-muted small fw-bold text-uppercase">Total Families</div>
                                <div className="fw-bold fs-4" style={{ color: 'var(--primary-dark)' }}>{stats.total_families}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                            <div className="card-body py-2 px-3">
                                <div className="text-muted small fw-bold text-uppercase">Total Students</div>
                                <div className="fw-bold fs-4" style={{ color: 'var(--accent-orange)' }}>{stats.total_students}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3" style={{ borderLeft: '4px solid #0d6efd' }}>
                            <div className="card-body py-2 px-3">
                                <div className="text-muted small fw-bold text-uppercase">Avg. Family Size</div>
                                <div className="fw-bold fs-4 text-primary">{stats.average_family_size} <span className="fs-6 text-muted font-normal">kids</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card border-0 shadow-sm rounded-3" style={{ borderLeft: '4px solid #198754' }}>
                            <div className="card-body py-2 px-3">
                                <div className="text-muted small fw-bold text-uppercase">Filtered Results</div>
                                <div className="fw-bold fs-4 text-success">{filteredFamilies.length}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search & Filter Controls */}
            <div className="card border-0 shadow-sm mb-4 rounded-3">
                <div className="card-body p-3">
                    <div className="row g-3 align-items-center">
                        <div className="col-md-7 col-lg-8">
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0">
                                    <i className="bi bi-search text-muted"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 ps-0"
                                    placeholder="Search by Family Name, Family ID, Father/Mother Name, Child Name, Phone..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button className="btn btn-outline-secondary" type="button" onClick={() => setSearchTerm('')}>
                                        <i className="bi bi-x"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="col-md-5 col-lg-4">
                            <select
                                className="form-select"
                                value={selectedClass}
                                onChange={e => setSelectedClass(e.target.value)}
                            >
                                <option value="">Filter by Class (All Classes)</option>
                                {classes.map(c => (
                                    <option key={c.class_id} value={c.class_id.toString()}>
                                        {c.class_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Families Main Table */}
            <div className="card border-0 shadow-sm rounded-3">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-bold" style={{ color: 'var(--primary-dark)' }}>
                        <i className="bi bi-journal-text me-2" style={{ color: 'var(--primary-teal)' }}></i>
                        Family Directory Records ({filteredFamilies.length})
                    </h6>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-teal mb-2" role="status" style={{ color: 'var(--primary-teal)' }}></div>
                            <div className="text-muted small">Loading Family Directory...</div>
                        </div>
                    ) : filteredFamilies.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <i className="bi bi-people fs-1 d-block mb-2 opacity-50"></i>
                            <p className="mb-0">No family records found matching your search query.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                                <thead style={{ backgroundColor: 'var(--primary-dark)', color: '#fff' }}>
                                    <tr>
                                        <th className="text-center" style={{ width: '4%' }}>Sr.#</th>
                                        <th style={{ width: '18%' }}>Family Name</th>
                                        <th style={{ width: '12%' }}>Family ID</th>
                                        <th style={{ width: '22%' }}>Children / Students</th>
                                        <th style={{ width: '12%' }}>Classes</th>
                                        <th style={{ width: '8%' }}>Sections</th>
                                        <th style={{ width: '14%' }}>Father / Mother Name</th>
                                        <th style={{ width: '10%' }}>Contact Numbers</th>
                                        <th className="text-center" style={{ width: '6%' }}>WhatsApp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFamilies.map((fam, idx) => {
                                        const waNumber = formatWhatsAppNumber(fam.primary_phone);
                                        return (
                                            <tr key={fam.family_id}>
                                                <td className="text-center text-muted fw-semibold">{idx + 1}</td>
                                                
                                                {/* 1. Family Name (Majority Father Name) */}
                                                <td>
                                                    <div className="fw-bold text-dark d-flex align-items-center gap-1">
                                                        <i className="bi bi-house-door-fill text-teal me-1" style={{ color: 'var(--primary-teal)' }}></i>
                                                        {fam.family_name}
                                                    </div>
                                                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                        {fam.total_children} child{fam.total_children > 1 ? 'ren' : ''} in family
                                                    </small>
                                                </td>

                                                {/* 2. Family ID */}
                                                <td>
                                                    <span className="badge rounded-pill text-dark border px-2 py-1" style={{ backgroundColor: '#f8f9fa', fontSize: '0.8rem' }}>
                                                        <i className="bi bi-tag-fill me-1 text-secondary"></i>
                                                        {fam.family_id}
                                                    </span>
                                                </td>

                                                {/* 3. Children / Students in Family */}
                                                <td>
                                                    <div className="d-flex flex-column gap-1">
                                                        {fam.members.map(m => (
                                                            <div key={m.student_id} className="d-flex align-items-center gap-1">
                                                                <i className="bi bi-person-fill text-muted" style={{ fontSize: '0.8rem' }}></i>
                                                                <span className="fw-semibold text-dark" style={{ fontSize: '0.85rem' }}>
                                                                    {m.full_name}
                                                                </span>
                                                                <small className="text-muted" style={{ fontSize: '0.72rem' }}>({m.admission_no})</small>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* 4. Classes */}
                                                <td>
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {fam.members.map((m, i) => (
                                                            <span key={i} className="badge bg-light text-dark border" style={{ fontSize: '0.75rem' }}>
                                                                {m.class_name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* 5. Sections */}
                                                <td>
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {fam.members.map((m, i) => (
                                                            <span key={i} className="badge bg-secondary bg-opacity-10 text-dark border" style={{ fontSize: '0.75rem' }}>
                                                                {m.section_name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* 6. Father Name / Mother Name */}
                                                <td>
                                                    <div className="small">
                                                        <div className="fw-semibold text-dark">
                                                            <i className="bi bi-person-badge me-1 text-primary"></i>
                                                            {fam.father_name || 'N/A'}
                                                        </div>
                                                        {fam.mother_name && (
                                                            <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                                                                <i className="bi bi-person me-1 text-secondary"></i>
                                                                Mother: {fam.mother_name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 7. Father / Mother Phone Number */}
                                                <td>
                                                    <div className="small" style={{ whiteSpace: 'nowrap' }}>
                                                        {fam.father_phone ? (
                                                            <div>
                                                                <a href={`tel:${fam.father_phone}`} className="text-decoration-none text-dark fw-semibold">
                                                                    <i className="bi bi-telephone-fill me-1 text-success" style={{ fontSize: '0.75rem' }}></i>
                                                                    {fam.father_phone}
                                                                </a>
                                                            </div>
                                                        ) : fam.mother_phone ? (
                                                            <div>
                                                                <a href={`tel:${fam.mother_phone}`} className="text-decoration-none text-dark fw-semibold">
                                                                    <i className="bi bi-telephone-fill me-1 text-success" style={{ fontSize: '0.75rem' }}></i>
                                                                    {fam.mother_phone}
                                                                </a>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted">—</span>
                                                        )}
                                                        {fam.mother_phone && fam.father_phone && (
                                                            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                                M: {fam.mother_phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 8. WhatsApp Icon Action */}
                                                <td className="text-center">
                                                    {waNumber ? (
                                                        <a
                                                            href={`https://wa.me/${waNumber}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-success btn-sm rounded-circle d-inline-flex align-items-center justify-content-center"
                                                            style={{ width: '34px', height: '34px', backgroundColor: '#25D366', borderColor: '#25D366' }}
                                                            title={`Send WhatsApp message to ${fam.primary_phone}`}
                                                        >
                                                            <i className="bi bi-whatsapp fs-6 text-white"></i>
                                                        </a>
                                                    ) : (
                                                        <button className="btn btn-sm btn-light text-muted rounded-circle" disabled style={{ width: '34px', height: '34px' }}>
                                                            <i className="bi bi-whatsapp fs-6 opacity-50"></i>
                                                        </button>
                                                    )}
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
        </div>
    );
}
