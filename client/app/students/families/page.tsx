'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const API = process.env.NEXT_PUBLIC_API_URL || "https://demo-private-school.onrender.com";

interface StudentMember {
    student_id: number;
    admission_no: string;
    first_name: string;
    last_name: string;
    full_name: string;
    category?: string;
    is_trusted?: boolean;
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

interface FatherInfo {
    name: string;
    phone: string;
    cnic: string;
    count: number;
}

interface FamilyData {
    family_id: string;
    family_name: string;
    father_name: string;
    mother_name: string;
    father_phone: string;
    mother_phone: string;
    guardian_phone: string;
    primary_phone: string;
    is_cousin_family?: boolean;
    is_trusted_family?: boolean;
    has_trusted_members?: boolean;
    fathers_list?: FatherInfo[];
    combined_father_names?: string;
    combined_phones?: string;
    total_children: number;
    children_names: string[];
    classes_list: string[];
    sections_list: string[];
    family_fee: number;
    opening_balance: number;
    total_billed?: number;
    total_paid?: number;
    total_balance?: number;
    fee_status?: 'unpaid' | 'partial' | 'paid' | 'settled' | 'satteled' | string;
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

interface ClassItem {
    class_id: number;
    class_name: string;
}

interface SectionItem {
    section_id: number;
    section_name: string;
    class_id: number;
}

interface ActiveAcademicYear {
    id: number;
    year_name: string;
    is_active?: boolean;
}

export default function FamilyListPage() {
    const router = useRouter();
    const [families, setFamilies] = useState<FamilyData[]>([]);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [sections, setSections] = useState<SectionItem[]>([]);
    const [activeYear, setActiveYear] = useState<ActiveAcademicYear | null>(null);
    const [stats, setStats] = useState<{ total_families: number; total_students: number; average_family_size: number | string } | null>(null);
    const [school, setSchool] = useState<SchoolInfo>({
        school_name: '', school_address: '', phone_number: '', school_phone2: '', school_phone3: '', school_logo_url: ''
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [showFeeColumns, setShowFeeColumns] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

    // Fetch initial datasets
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Active Academic Year
                fetch(`${API}/academic/active-year`)
                    .then(r => r.json())
                    .then(data => {
                        if (data && data.id) setActiveYear(data);
                    })
                    .catch(() => { });

                // 2. Fetch Classes
                fetch(`${API}/academic`)
                    .then(r => r.json())
                    .then(data => setClasses(Array.isArray(data) ? data : []))
                    .catch(() => { });

                // 3. Fetch Sections
                fetch(`${API}/academic/sections`)
                    .then(r => r.json())
                    .then(data => setSections(Array.isArray(data) ? data : []))
                    .catch(() => { });

                // 4. Fetch School Settings
                fetch(`${API}/settings`)
                    .then(r => r.json())
                    .then((data: any) => {
                        if (data && typeof data === 'object' && !Array.isArray(data)) {
                            const getLogo = (raw?: string) => {
                                if (!raw || !raw.trim()) return `${API}/icon.png`;
                                const s = raw.trim();
                                if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://')) return s;
                                return `${API}/${s.replace(/^\/+/, '')}`;
                            };
                            setSchool({
                                school_name: data.school_name || 'Smart School System',
                                school_address: data.address || 'Main Campus',
                                phone_number: data.contact_number || '',
                                school_phone2: '',
                                school_phone3: '',
                                school_logo_url: getLogo(data.logo_url)
                            });
                        }
                    })
                    .catch(() => { });

                // 5. Fetch Families Directory
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

    // Filter available sections based on selected class
    const availableSections = useMemo(() => {
        if (!selectedClass) {
            // Unique section names when no class selected
            const uniqueNames = Array.from(new Set(sections.map(s => s.section_name)));
            return uniqueNames.map(name => ({
                section_id: sections.find(s => s.section_name === name)?.section_id || 0,
                section_name: name,
                class_id: 0
            }));
        }
        const classIdNum = parseInt(selectedClass, 10);
        return sections.filter(s => s.class_id === classIdNum);
    }, [sections, selectedClass]);

    // Handle class filter change & reset section if invalid
    const handleClassChange = (newClassId: string) => {
        setSelectedClass(newClassId);
        setSelectedSection('');
    };

    // Calculate Sibling vs Cousin breakdown stats
    const familyCounts = useMemo(() => {
        let pureSiblings = 0;
        let cousins = 0;
        families.forEach(f => {
            if (f.is_cousin_family || (f.fathers_list && f.fathers_list.length > 1)) {
                cousins++;
            } else {
                pureSiblings++;
            }
        });
        return { pureSiblings, cousins };
    }, [families]);

    // Filter & Project Families and Matching Children
    // When Class/Section is filtered: ONLY the matching children in that class/section are displayed!
    const filteredFamilies = useMemo(() => {
        const s = searchTerm.toLowerCase().trim();
        const hasClassFilter = Boolean(selectedClass);
        const hasSectionFilter = Boolean(selectedSection);

        const list = families
            .map(fam => {
                // 1. Text Search matching
                const matchesSearch = !s || (
                    fam.family_id.toLowerCase().includes(s) ||
                    fam.family_name.toLowerCase().includes(s) ||
                    (fam.combined_father_names && fam.combined_father_names.toLowerCase().includes(s)) ||
                    fam.father_name.toLowerCase().includes(s) ||
                    fam.mother_name.toLowerCase().includes(s) ||
                    fam.father_phone.includes(s) ||
                    fam.mother_phone.includes(s) ||
                    (fam.combined_phones && fam.combined_phones.includes(s)) ||
                    fam.children_names.some(c => c.toLowerCase().includes(s)) ||
                    fam.members.some(m => m.admission_no.toLowerCase().includes(s)) ||
                    (fam.fathers_list && fam.fathers_list.some(f => f.name.toLowerCase().includes(s) || f.phone.includes(s)))
                );

                if (!matchesSearch) return null;

                // 2. Class & Section filter matching for member projection
                let activeMembers = fam.members;

                if (hasClassFilter || hasSectionFilter) {
                    activeMembers = fam.members.filter(m => {
                        const matchC = !hasClassFilter || m.class_id?.toString() === selectedClass || m.class_name.toLowerCase() === selectedClass.toLowerCase();
                        const matchS = !hasSectionFilter || m.section_id?.toString() === selectedSection || m.section_name.toLowerCase() === selectedSection.toLowerCase();
                        return matchC && matchS;
                    });

                    // If no children in this family belong to the filtered class/section, omit this family
                    if (activeMembers.length === 0) return null;
                }

                // Sort members inside family by Class & Section & Name
                const sortedMembers = [...activeMembers].sort((a, b) => {
                    const cComp = (a.class_name || '').localeCompare(b.class_name || '');
                    if (cComp !== 0) return cComp;
                    const sComp = (a.section_name || '').localeCompare(b.section_name || '');
                    if (sComp !== 0) return sComp;
                    return (a.first_name || '').localeCompare(b.first_name || '');
                });

                return {
                    ...fam,
                    activeMembers: sortedMembers,
                    isFilteredChildCount: sortedMembers.length !== fam.members.length
                };
            })
            .filter((item): item is FamilyData & { activeMembers: StudentMember[]; isFilteredChildCount: boolean } => item !== null);

        // Sorting Priority (Requirement 5):
        // If NO filter applied: Always show in Section-wise & Alphabetical priority
        // If filter applied: Sort alphabetically by family name
        return list.sort((a, b) => {
            if (!hasClassFilter && !hasSectionFilter && !s) {
                // Section-wise priority first
                const secA = a.activeMembers[0]?.section_name || '';
                const secB = b.activeMembers[0]?.section_name || '';
                const secCompare = secA.localeCompare(secB, undefined, { numeric: true, sensitivity: 'base' });
                if (secCompare !== 0) return secCompare;

                // Then Class-wise priority
                const clsA = a.activeMembers[0]?.class_name || '';
                const clsB = b.activeMembers[0]?.class_name || '';
                const clsCompare = clsA.localeCompare(clsB, undefined, { numeric: true, sensitivity: 'base' });
                if (clsCompare !== 0) return clsCompare;

                // Then Family Name alphabetically
                return a.family_name.localeCompare(b.family_name, undefined, { sensitivity: 'base' });
            }

            // When filters applied, alphabetical by family/father name
            return a.family_name.localeCompare(b.family_name, undefined, { sensitivity: 'base' });
        });
    }, [families, searchTerm, selectedClass, selectedSection]);

    // Total displayed student count across all filtered families
    const displayedStudentsCount = useMemo(() => {
        return filteredFamilies.reduce((acc, f) => acc + f.activeMembers.length, 0);
    }, [filteredFamilies]);

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

    // 1. Export Excel (Strictly reflects filtered families/children & conditional fee status)
    const exportExcel = () => {
        if (filteredFamilies.length === 0) return;

        const excelData: any[] = [];
        let sr = 1;

        filteredFamilies.forEach(f => {
            const isSettled = f.is_trusted_family || ['settled', 'satteled'].includes((f.fee_status || '').toLowerCase());
            f.activeMembers.forEach(m => {
                const isMemberTrusted = m.is_trusted || (m.category || '').toLowerCase() === 'trusted';
                const rowObj: any = {
                    "Sr.#": sr,
                    "Family Name": f.is_cousin_family ? (f.combined_father_names || f.family_name || '') : (f.family_name || ''),
                    "Family ID": f.family_id,
                    "Family Type": f.is_cousin_family ? "Siblings + Cousins" : "Pure Siblings",
                };

                // Requirement 5: Fee status only exported if showFeeColumns is enabled
                if (showFeeColumns) {
                    rowObj["Fee Status"] = isSettled ? "SETTLED" : (f.fee_status ? f.fee_status.toUpperCase() : "PAID");
                    rowObj["Total Bill (PKR)"] = isSettled ? 0 : (f.total_billed || 0);
                    rowObj["Paid (PKR)"] = isSettled ? 0 : (f.total_paid || 0);
                    rowObj["Balance (PKR)"] = isSettled ? 0 : (f.total_balance || 0);
                }

                rowObj["Student Name"] = m.full_name;
                rowObj["Category"] = isMemberTrusted ? "Trusted" : (m.category || "Normal");
                rowObj["Admission No"] = m.admission_no;
                rowObj["Class"] = m.class_name;
                rowObj["Section"] = m.section_name;
                rowObj["Father Name"] = m.father_name || f.father_name || "N/A";
                rowObj["Mother Name"] = m.mother_name || f.mother_name || "N/A";
                rowObj["Father Phone"] = m.father_phone || f.father_phone || "N/A";
                rowObj["Mother Phone"] = m.mother_phone || f.mother_phone || "N/A";
                rowObj["Current Address"] = m.current_address || "N/A";

                excelData.push(rowObj);
            });
            sr++;
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        const colWidths = [
            { wch: 6 },  // Sr
            { wch: 26 }, // Family Name
            { wch: 16 }, // Family ID
            { wch: 18 }, // Family Type
        ];

        if (showFeeColumns) {
            colWidths.push(
                { wch: 12 }, // Fee Status
                { wch: 16 }, // Total Bill
                { wch: 14 }, // Paid
                { wch: 14 }  // Balance
            );
        }

        colWidths.push(
            { wch: 25 }, // Student Name
            { wch: 12 }, // Category
            { wch: 15 }, // Admission No
            { wch: 14 }, // Class
            { wch: 10 }, // Section
            { wch: 22 }, // Father Name
            { wch: 22 }, // Mother Name
            { wch: 16 }, // Father Phone
            { wch: 16 }, // Mother Phone
            { wch: 30 }  // Current Address
        );

        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Family Directory");
        const dateStr = new Date().toISOString().split('T')[0];
        const filterTag = selectedClass ? `_Class_${selectedClass}` : '';
        XLSX.writeFile(wb, `${school.school_name || 'School'}_Family_Directory${filterTag}_${dateStr}.xlsx`);
    };

    // 2. Export CSV (Strictly reflects filtered families/children & conditional fee status)
    const exportCSV = () => {
        if (filteredFamilies.length === 0) return;

        const headers = ["Sr.#", "Family Name", "Family ID", "Family Type"];
        if (showFeeColumns) {
            headers.push("Fee Status", "Total Bill", "Paid", "Balance");
        }
        headers.push("Student Name", "Category", "Admission No", "Class", "Section", "Father Name", "Mother Name", "Father Phone", "Mother Phone", "Address");

        const rows: string[][] = [];
        let sr = 1;

        filteredFamilies.forEach(f => {
            const isSettled = f.is_trusted_family || ['settled', 'satteled'].includes((f.fee_status || '').toLowerCase());
            f.activeMembers.forEach(m => {
                const isMemberTrusted = m.is_trusted || (m.category || '').toLowerCase() === 'trusted';
                const row: string[] = [
                    sr.toString(),
                    `"${(f.is_cousin_family ? (f.combined_father_names || f.family_name || '') : (f.family_name || '')).replace(/"/g, '""')}"`,
                    `"${(f.family_id || '').replace(/"/g, '""')}"`,
                    `"${f.is_cousin_family ? 'Siblings + Cousins' : 'Pure Siblings'}"`
                ];

                if (showFeeColumns) {
                    row.push(
                        `"${isSettled ? 'SETTLED' : (f.fee_status || 'paid').toUpperCase()}"`,
                        `"${isSettled ? 0 : (f.total_billed || 0)}"`,
                        `"${isSettled ? 0 : (f.total_paid || 0)}"`,
                        `"${isSettled ? 0 : (f.total_balance || 0)}"`
                    );
                }

                row.push(
                    `"${(m.full_name || '').replace(/"/g, '""')}"`,
                    `"${isMemberTrusted ? 'Trusted' : (m.category || 'Normal')}"`,
                    `"${(m.admission_no || '').replace(/"/g, '""')}"`,
                    `"${(m.class_name || '').replace(/"/g, '""')}"`,
                    `"${(m.section_name || '').replace(/"/g, '""')}"`,
                    `"${(m.father_name || f.father_name || '').replace(/"/g, '""')}"`,
                    `"${(m.mother_name || f.mother_name || '').replace(/"/g, '""')}"`,
                    `"${(m.father_phone || f.father_phone || '').replace(/"/g, '""')}"`,
                    `"${(m.mother_phone || f.mother_phone || '').replace(/"/g, '""')}"`,
                    `"${(m.current_address || '').replace(/"/g, '""')}"`
                );

                rows.push(row);
            });
            sr++;
        });

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute("download", `${school.school_name || 'School'}_Family_Directory_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 3. Print / PDF Export with Hierarchical Rows & Conditional Fee Columns
    const exportPDF = () => {
        if (filteredFamilies.length === 0) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const filterTitle = selectedClass ? ` - Filtered: Class ${selectedClass}${selectedSection ? ` (${selectedSection})` : ''}` : '';

        const tableRowsHtml = filteredFamilies.map((f, idx) => {
            const M = f.activeMembers.length;
            const isSettled = f.is_trusted_family || ['settled', 'satteled'].includes((f.fee_status || '').toLowerCase());
            const feeStatusStr = isSettled ? 'SETTLED' : (f.fee_status ? f.fee_status.toUpperCase() : 'PAID');
            const statusColor = isSettled ? '#0891b2' : f.fee_status === 'unpaid' ? '#dc3545' : f.fee_status === 'partial' ? '#fd7e14' : '#198754';
            const isCousin = f.is_cousin_family;

            return f.activeMembers.map((m, mIdx) => {
                const isMemberTrusted = m.is_trusted || (m.category || '').toLowerCase() === 'trusted';
                if (mIdx === 0) {
                    return `
                        <tr style="border-top: 2px solid #215E61;">
                            <td rowspan="${M}" style="text-align: center; border: 1px solid #333; padding: 6px; font-weight: bold; vertical-align: middle; background-color: #fafafa;">${idx + 1}</td>
                            <td rowspan="${M}" style="border: 1px solid #333; padding: 6px; font-weight: bold; vertical-align: middle;">
                                <div style="font-size: 10pt; color: #233D4D;">${isCousin ? (f.combined_father_names || f.family_name) : f.family_name}</div>
                                <div style="font-size: 7.5pt; color: ${isCousin ? '#b45309' : '#047857'}; font-weight: 600; margin-top: 2px;">
                                    ${isCousin ? '🧬 SIBLINGS + COUSINS' : '👨‍👩‍👧‍👦 PURE SIBLINGS'}
                                </div>
                                ${isSettled ? `<div style="font-size: 7.5pt; color: #0891b2; font-weight: 700; margin-top: 1px;">🛡️ TRUSTED SETTLED</div>` : ''}
                                <div style="font-size: 8pt; color: #666; font-weight: normal; margin-top: 2px;">
                                    ${f.isFilteredChildCount ? `Showing ${f.activeMembers.length} of ${f.total_children} Children` : `${f.total_children} Child${f.total_children > 1 ? 'ren' : ''}`}
                                </div>
                                ${showFeeColumns ? `<div style="font-size: 7.5pt; font-weight: bold; color: ${statusColor}; margin-top: 2px;">Fee: ${feeStatusStr}</div>` : ''}
                            </td>
                            <td rowspan="${M}" style="text-align: center; border: 1px solid #333; padding: 6px; font-weight: bold; vertical-align: middle; background-color: #f8f9fa;">${f.family_id}</td>
                            ${showFeeColumns ? `
                                <td rowspan="${M}" style="text-align: right; border: 1px solid #333; padding: 6px; font-weight: bold; vertical-align: middle;">PKR ${(isSettled ? 0 : (f.total_billed || 0)).toLocaleString('en-PK')}</td>
                                <td rowspan="${M}" style="text-align: right; border: 1px solid #333; padding: 6px; font-weight: bold; color: #198754; vertical-align: middle;">PKR ${(isSettled ? 0 : (f.total_paid || 0)).toLocaleString('en-PK')}</td>
                                <td rowspan="${M}" style="text-align: right; border: 1px solid #333; padding: 6px; font-weight: bold; color: ${isSettled ? '#0891b2' : (f.total_balance || 0) > 0 ? '#dc3545' : '#198754'}; vertical-align: middle;">${isSettled ? 'PKR 0 (Settled)' : `PKR ${(f.total_balance || 0).toLocaleString('en-PK')}`}</td>
                            ` : ''}
                            <td style="border: 1px solid #333; padding: 6px; font-weight: bold; color: #111;">
                                ${m.full_name} <span style="font-size: 8pt; color: #555; font-weight: normal;">(${m.admission_no})</span>
                                ${isMemberTrusted ? `<span style="font-size: 7.5pt; color: #0891b2; font-weight: bold; margin-left: 4px;">[Trusted]</span>` : ''}
                                ${isCousin ? `<div style="font-size: 7.5pt; color: #666; font-weight: normal;">Father: <strong>${m.father_name || 'N/A'}</strong></div>` : ''}
                            </td>
                            <td style="text-align: center; border: 1px solid #333; padding: 6px;">${m.class_name}</td>
                            <td style="text-align: center; border: 1px solid #333; padding: 6px;">${m.section_name}</td>
                            <td rowspan="${M}" style="border: 1px solid #333; padding: 6px; vertical-align: middle;">
                                ${isCousin && f.fathers_list && f.fathers_list.length > 0 ? (
                                    f.fathers_list.map(fa => `<div><strong>${fa.name}</strong></div>`).join('')
                                ) : (
                                    `<div><strong>Father:</strong> ${f.father_name || 'N/A'}</div>`
                                )}
                                ${f.mother_name && !isCousin ? `<div style="font-size: 8pt; color: #555;"><strong>Mother:</strong> ${f.mother_name}</div>` : ''}
                            </td>
                            <td rowspan="${M}" style="border: 1px solid #333; padding: 6px; vertical-align: middle; white-space: nowrap;">
                                ${isCousin && f.fathers_list && f.fathers_list.length > 0 ? (
                                    f.fathers_list.map(fa => fa.phone ? `<div>${fa.name.split(' ')[0]}: ${fa.phone}</div>` : '').join('')
                                ) : (
                                    `<div>${f.father_phone ? `Father: ${f.father_phone}` : ''}</div>
                                     <div>${f.mother_phone ? `Mother: ${f.mother_phone}` : ''}</div>`
                                )}
                            </td>
                        </tr>
                    `;
                } else {
                    return `
                        <tr>
                            <td style="border: 1px solid #333; padding: 6px; font-weight: bold; color: #111;">
                                ${m.full_name} <span style="font-size: 8pt; color: #555; font-weight: normal;">(${m.admission_no})</span>
                                ${isMemberTrusted ? `<span style="font-size: 7.5pt; color: #0891b2; font-weight: bold; margin-left: 4px;">[Trusted]</span>` : ''}
                                ${isCousin ? `<div style="font-size: 7.5pt; color: #666; font-weight: normal;">Father: <strong>${m.father_name || 'N/A'}</strong></div>` : ''}
                            </td>
                            <td style="text-align: center; border: 1px solid #333; padding: 6px;">${m.class_name}</td>
                            <td style="text-align: center; border: 1px solid #333; padding: 6px;">${m.section_name}</td>
                        </tr>
                    `;
                }
            }).join('');
        }).join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Family Directory Report - ${school.school_name || 'School'}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 12mm 10mm; color: #000; background: #fff; }
                    .header { display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
                    .logo { width: 65px; height: 65px; object-fit: contain; margin-right: 15px; }
                    .school-name { font-size: 18pt; font-weight: bold; text-transform: uppercase; color: #233D4D; text-align: center; }
                    .school-sub { font-size: 9.5pt; text-align: center; margin-top: 3px; color: #444; }
                    .title-bar { background-color: #215E61; color: #fff; text-align: center; padding: 6px; font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 10px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .meta-info { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
                    th { background-color: #f0f4f5; border: 1px solid #333; padding: 6px; font-weight: bold; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @page { size: A4 landscape; margin: 10mm; }
                </style>
            </head>
            <body>
                <div class="header">
                    ${school.school_logo_url ? `<img src="${school.school_logo_url}" class="logo" alt="Logo" />` : ''}
                    <div>
                        <div class="school-name">${school.school_name || 'Smart School System'}</div>
                        <div class="school-sub">${school.school_address} ${school.phone_number ? `| Ph: ${school.phone_number}` : ''}</div>
                    </div>
                </div>
                <div class="title-bar">FAMILY DIRECTORY & STUDENT LIST${filterTitle}</div>
                <div class="meta-info">
                    <div><strong>Total Families Listed:</strong> ${filteredFamilies.length} (${displayedStudentsCount} Students)</div>
                    <div><strong>Date Generated:</strong> ${dateStr}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 4%;">Sr.#</th>
                            <th style="width: 18%;">Family Information</th>
                            <th style="width: 10%;">Family ID</th>
                            ${showFeeColumns ? `
                                <th style="width: 8%;">Total Bill</th>
                                <th style="width: 8%;">Paid</th>
                                <th style="width: 8%;">Balance</th>
                            ` : ''}
                            <th style="width: 20%;">Student / Child Name</th>
                            <th style="width: 7%;">Class</th>
                            <th style="width: 7%;">Section</th>
                            <th style="width: 14%;">Parents / Guardians</th>
                            <th style="width: 12%;">Phone Numbers</th>
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
        <div className="container-fluid p-2 p-sm-3 p-md-4 animate__animated animate__fadeIn">
            {/* Custom Responsive Styles for Family Directory */}
            <style jsx>{`
                @media (max-width: 767.98px) {
                    .family-stat-card .fs-4 {
                        font-size: 1.25rem !important;
                    }
                    .family-stat-card .fs-6 {
                        font-size: 0.85rem !important;
                    }
                    .family-table-container {
                        border-radius: 12px !important;
                    }
                    .family-table {
                        min-width: 820px;
                    }
                }
                @media (max-width: 575.98px) {
                    .family-stat-card {
                        padding: 10px !important;
                    }
                    .family-stat-card .bi {
                        font-size: 1.2rem !important;
                    }
                }
            `}</style>

            {/* Top Page Header (Academic Year Badge in top-right opposite Title) */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 mb-md-4 gap-2 gap-md-3">
                <div>
                    <h2 className="fw-bold mb-1 d-flex align-items-center gap-2" style={{ color: 'var(--primary-dark)', fontSize: 'clamp(1.3rem, 3vw, 1.75rem)' }}>
                        <i className="bi bi-people-fill" style={{ color: 'var(--primary-teal)' }}></i>
                        Family Directory
                    </h2>
                    <p className="text-muted small mb-0">
                        Class & section-filtered family units, pure sibling vs cousin households, contact directories, and fee status.
                    </p>
                </div>

                {/* Academic Year Pill Badge Opposite Title */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                    {activeYear && (
                        <div
                            className="badge d-inline-flex align-items-center gap-1.5 px-3 py-2 text-white shadow-sm"
                            style={{
                                backgroundColor: 'var(--primary-teal)',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                letterSpacing: '0.3px'
                            }}
                        >
                            <i className="bi bi-calendar-check-fill"></i>
                            <span>Academic Session: <strong>{activeYear.year_name}</strong></span>
                        </div>
                    )}
                </div>
            </div>

            {/* 4 Summary Stat Squircle Cards */}
            <div className="row g-2 g-md-3 mb-3 mb-md-4">
                <div className="col-6 col-lg-3">
                    <div className="card border-0 shadow-sm h-100 family-stat-card" style={{ borderLeft: '4px solid var(--primary-teal)', borderRadius: '16px' }}>
                        <div className="card-body p-2.5 p-md-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem' }}>Total Families</div>
                                    <div className="fw-bold fs-4 mt-1" style={{ color: 'var(--primary-dark)' }}>{stats?.total_families || families.length}</div>
                                </div>
                                <div className="p-2 rounded-3 bg-light text-teal d-none d-sm-block" style={{ color: 'var(--primary-teal)' }}>
                                    <i className="bi bi-people fs-4"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-6 col-lg-3">
                    <div className="card border-0 shadow-sm h-100 family-stat-card" style={{ borderLeft: '4px solid var(--accent-orange)', borderRadius: '16px' }}>
                        <div className="card-body p-2.5 p-md-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem' }}>Total Students</div>
                                    <div className="fw-bold fs-4 mt-1" style={{ color: 'var(--accent-orange)' }}>{stats?.total_students || 0}</div>
                                </div>
                                <div className="p-2 rounded-3 bg-light text-warning d-none d-sm-block" style={{ color: 'var(--accent-orange)' }}>
                                    <i className="bi bi-backpack4 fs-4"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-6 col-lg-3">
                    <div className="card border-0 shadow-sm h-100 family-stat-card" style={{ borderLeft: '4px solid #3b82f6', borderRadius: '16px' }}>
                        <div className="card-body p-2.5 p-md-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem' }}>Household Structure</div>
                                    <div className="fw-bold fs-6 mt-1 text-primary text-truncate">
                                        {familyCounts.pureSiblings} <span className="text-muted small fw-normal">Sib</span> • {familyCounts.cousins} <span className="text-muted small fw-normal">Cousin</span>
                                    </div>
                                </div>
                                <div className="p-2 rounded-3 bg-light text-primary d-none d-sm-block">
                                    <i className="bi bi-diagram-3 fs-4"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-6 col-lg-3">
                    <div className="card border-0 shadow-sm h-100 family-stat-card" style={{ borderLeft: '4px solid #16a34a', borderRadius: '16px' }}>
                        <div className="card-body p-2.5 p-md-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem' }}>Active Filter Results</div>
                                    <div className="fw-bold fs-4 mt-1 text-success text-truncate">
                                        {filteredFamilies.length} <span className="fs-6 text-muted fw-normal">({displayedStudentsCount} kids)</span>
                                    </div>
                                </div>
                                <div className="p-2 rounded-3 bg-light text-success d-none d-sm-block">
                                    <i className="bi bi-funnel fs-4"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Interactive Container */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                {/* Responsive Filter & Action Toolbar */}
                <div className="card-header bg-white border-bottom p-3" style={{ borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
                    <div className="row g-3 align-items-center justify-content-between">
                        {/* Search & Dynamic Class/Section Filters */}
                        <div className="col-12 col-xl-7">
                            <div className="row g-2">
                                {/* Search Input */}
                                <div className="col-12 col-md-5">
                                    <div className="input-group">
                                        <span className="input-group-text bg-light border-end-0" style={{ borderRadius: '12px 0 0 12px' }}>
                                            <i className="bi bi-search text-muted"></i>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control border-start-0 ps-0 bg-light"
                                            style={{ borderRadius: searchTerm ? '0' : '0 12px 12px 0' }}
                                            placeholder="Search name, phone, admission#..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                        {searchTerm && (
                                            <button
                                                className="btn btn-light border border-start-0"
                                                style={{ borderRadius: '0 12px 12px 0' }}
                                                type="button"
                                                onClick={() => setSearchTerm('')}
                                            >
                                                <i className="bi bi-x text-muted"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Class Dropdown */}
                                <div className="col-6 col-md-3.5 col-lg-3">
                                    <select
                                        className="form-select bg-light"
                                        style={{ borderRadius: '12px' }}
                                        value={selectedClass}
                                        onChange={e => handleClassChange(e.target.value)}
                                    >
                                        <option value="">All Classes</option>
                                        {classes.map(c => (
                                            <option key={c.class_id} value={c.class_id.toString()}>
                                                {c.class_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Section Dropdown Filter (Requirement 1 & 2) */}
                                <div className="col-6 col-md-3.5 col-lg-3">
                                    <select
                                        className="form-select bg-light"
                                        style={{ borderRadius: '12px' }}
                                        value={selectedSection}
                                        onChange={e => setSelectedSection(e.target.value)}
                                    >
                                        <option value="">All Sections</option>
                                        {availableSections.map(sec => (
                                            <option key={sec.section_id || sec.section_name} value={sec.section_id ? sec.section_id.toString() : sec.section_name}>
                                                {sec.section_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Reset Filter Button */}
                                {(searchTerm || selectedClass || selectedSection) && (
                                    <div className="col-12 col-md-auto d-flex align-items-center">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary w-100"
                                            style={{ borderRadius: '12px' }}
                                            onClick={() => {
                                                setSearchTerm('');
                                                setSelectedClass('');
                                                setSelectedSection('');
                                            }}
                                            title="Clear All Filters"
                                        >
                                            <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions & View Controls */}
                        <div className="col-12 col-xl-5 d-flex flex-wrap justify-content-xl-end align-items-center gap-2">
                            {/* Layout Toggle (Table vs Cards for Mobile/Tablet) */}
                            <div className="btn-group btn-group-sm shadow-sm" role="group" style={{ borderRadius: '10px' }}>
                                <button
                                    type="button"
                                    className={`btn ${viewMode === 'table' ? 'btn-teal text-white' : 'btn-light border'}`}
                                    style={{ backgroundColor: viewMode === 'table' ? 'var(--primary-teal)' : undefined }}
                                    onClick={() => setViewMode('table')}
                                    title="Table View"
                                >
                                    <i className="bi bi-table me-1"></i>Table
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${viewMode === 'cards' ? 'btn-teal text-white' : 'btn-light border'}`}
                                    style={{ backgroundColor: viewMode === 'cards' ? 'var(--primary-teal)' : undefined }}
                                    onClick={() => setViewMode('cards')}
                                    title="Mobile Cards View"
                                >
                                    <i className="bi bi-grid-fill me-1"></i>Cards
                                </button>
                            </div>

                            {/* Fee Toggle Button */}
                            <button
                                type="button"
                                className={`btn btn-sm ${showFeeColumns ? 'btn-teal text-white' : 'btn-light border'} px-2.5 shadow-sm d-inline-flex align-items-center gap-1`}
                                style={{
                                    borderRadius: '10px',
                                    backgroundColor: showFeeColumns ? 'var(--primary-teal)' : undefined,
                                    color: showFeeColumns ? '#fff' : 'var(--primary-teal)'
                                }}
                                onClick={() => setShowFeeColumns(!showFeeColumns)}
                                title={showFeeColumns ? "Hide Fee Columns" : "Show Fee Summary Columns"}
                            >
                                <i className={`bi ${showFeeColumns ? 'bi-cash-stack' : 'bi-currency-dollar'} fs-6`}></i>
                                <span className="small fw-semibold">{showFeeColumns ? 'Fee On' : 'Fee Off'}</span>
                            </button>

                            {/* Export Buttons */}
                            <div className="btn-group btn-group-sm shadow-sm" role="group" style={{ borderRadius: '10px' }}>
                                <button
                                    type="button"
                                    className="btn btn-light border text-danger"
                                    onClick={exportPDF}
                                    title="Export PDF Document"
                                >
                                    <i className="bi bi-file-earmark-pdf-fill fs-6"></i>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-light border text-success"
                                    onClick={exportExcel}
                                    title="Export Excel Spreadsheet"
                                >
                                    <i className="bi bi-file-earmark-excel-fill fs-6"></i>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-light border text-primary"
                                    onClick={exportCSV}
                                    title="Export CSV File"
                                >
                                    <i className="bi bi-file-earmark-text-fill fs-6"></i>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-light border text-dark"
                                    onClick={exportPDF}
                                    title="Print Directory"
                                >
                                    <i className="bi bi-printer-fill fs-6"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table or Responsive Cards Body */}
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-teal mb-2" role="status" style={{ color: 'var(--primary-teal)' }}></div>
                            <div className="text-muted small">Loading Family Directory...</div>
                        </div>
                    ) : filteredFamilies.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <i className="bi bi-people fs-1 d-block mb-2 opacity-50"></i>
                            <p className="mb-1 fw-bold">No family records found matching your filters.</p>
                            <small className="text-muted">Try resetting your class, section, or search query.</small>
                        </div>
                    ) : viewMode === 'table' ? (
                        /* Responsive Table View with Grouped Child Rows */
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.88rem' }}>
                                <thead style={{ backgroundColor: 'var(--primary-dark)', color: '#fff' }}>
                                    <tr>
                                        <th className="text-center" style={{ width: '3%', padding: '12px 8px' }}>Sr.#</th>
                                        <th style={{ width: showFeeColumns ? '17%' : '20%', padding: '12px 8px' }}>Family & Households</th>
                                        <th style={{ width: showFeeColumns ? '9%' : '11%', padding: '12px 8px' }}>Family ID</th>
                                        {showFeeColumns && (
                                            <>
                                                <th className="text-end" style={{ width: '8%', padding: '12px 8px', backgroundColor: '#1e3a8a' }}>Total Bill</th>
                                                <th className="text-end" style={{ width: '8%', padding: '12px 8px', backgroundColor: '#065f46' }}>Paid</th>
                                                <th className="text-end" style={{ width: '8%', padding: '12px 8px', backgroundColor: '#991b1b' }}>Balance</th>
                                            </>
                                        )}
                                        <th style={{ width: showFeeColumns ? '18%' : '22%', padding: '12px 8px' }}>Enrolled Student</th>
                                        <th style={{ width: '8%', padding: '12px 8px' }}>Class</th>
                                        <th style={{ width: '7%', padding: '12px 8px' }}>Section</th>
                                        <th style={{ width: '13%', padding: '12px 8px' }}>Parents / Guardians</th>
                                        <th style={{ width: '10%', padding: '12px 8px' }}>Contacts</th>
                                        <th className="text-center" style={{ width: '5%', padding: '12px 8px' }}>WhatsApp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFamilies.map((fam, famIdx) => {
                                        const waNumber = formatWhatsAppNumber(fam.primary_phone);
                                        const M = fam.activeMembers.length;
                                        const feeStatus = (fam.fee_status || 'paid').toLowerCase();
                                        const isSettled = fam.is_trusted_family || ['settled', 'satteled'].includes(feeStatus);
                                        const isUnpaid = !isSettled && feeStatus === 'unpaid';
                                        const isPartial = !isSettled && feeStatus === 'partial';
                                        const isCousin = fam.is_cousin_family;

                                        return fam.activeMembers.map((m, mIdx) => {
                                            const isFirst = mIdx === 0;
                                            const isMemberTrusted = m.is_trusted || (m.category || '').toLowerCase() === 'trusted';

                                            return (
                                                <tr
                                                    key={`${fam.family_id}-${m.student_id}`}
                                                    onClick={() => router.push(`/students/profile/${m.student_id}`)}
                                                    title={`Click to view ${m.full_name}'s student profile`}
                                                    style={{
                                                        backgroundColor: famIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                                                        borderTop: isFirst ? '2px solid #cbd5e1' : '1px dashed #e2e8f0',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {/* 1. Sr.# (Rowspan) */}
                                                    {isFirst && (
                                                        <td
                                                            rowSpan={M}
                                                            className="text-center text-muted fw-bold align-middle border-end bg-light bg-opacity-50"
                                                        >
                                                            {famIdx + 1}
                                                        </td>
                                                    )}

                                                    {/* 2. Family Information (Rowspan) with Cousin / Sibling / Trusted Badges */}
                                                    {isFirst && (
                                                        <td rowSpan={M} className="align-middle border-end">
                                                            <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                                                <span
                                                                    className="fw-bold"
                                                                    style={{
                                                                        color: isSettled ? '#0891b2' : isUnpaid ? '#dc2626' : isPartial ? '#d97706' : '#1e293b',
                                                                        fontSize: '0.92rem'
                                                                    }}
                                                                >
                                                                    {isCousin ? (fam.combined_father_names || fam.family_name) : fam.family_name}
                                                                </span>
                                                            </div>

                                                            {/* Household Type & Trusted Settled Badges */}
                                                            <div className="mt-1 d-flex flex-wrap gap-1 align-items-center">
                                                                {isCousin ? (
                                                                    <span className="badge rounded-pill text-dark border px-2 py-0.5" style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', fontSize: '0.68rem' }}>
                                                                        <i className="bi bi-diagram-3-fill me-1 text-warning"></i>Siblings + Cousins
                                                                    </span>
                                                                ) : (
                                                                    <span className="badge rounded-pill bg-light text-secondary border px-2 py-0.5" style={{ fontSize: '0.68rem' }}>
                                                                        <i className="bi bi-people-fill me-1 text-teal" style={{ color: 'var(--primary-teal)' }}></i>Pure Siblings
                                                                    </span>
                                                                )}
                                                                {isSettled && (
                                                                    <span className="badge rounded-pill border px-2 py-0.5" style={{ backgroundColor: '#e0f2fe', borderColor: '#bae6fd', color: '#0369a1', fontSize: '0.68rem', fontWeight: 600 }}>
                                                                        <i className="bi bi-shield-check me-1 text-info"></i>Settled (Trusted)
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Child Count / Filter status */}
                                                            <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                                                                {fam.isFilteredChildCount ? (
                                                                    <span className="text-primary fw-semibold">
                                                                        Showing {fam.activeMembers.length} of {fam.total_children} kids
                                                                    </span>
                                                                ) : (
                                                                    <span>{fam.total_children} child{fam.total_children > 1 ? 'ren' : ''} in family</span>
                                                                )}
                                                            </small>
                                                        </td>
                                                    )}

                                                    {/* 3. Family ID (Rowspan) */}
                                                    {isFirst && (
                                                        <td rowSpan={M} className="align-middle border-end">
                                                            <span className="badge rounded-pill text-dark border px-2.5 py-1" style={{ backgroundColor: '#f1f5f9', fontSize: '0.78rem' }}>
                                                                <i className="bi bi-tag-fill me-1 text-secondary"></i>
                                                                {fam.family_id}
                                                            </span>
                                                        </td>
                                                    )}

                                                    {/* Optional Fee Columns: Total Bill, Paid, Balance */}
                                                    {showFeeColumns && isFirst && (
                                                        <>
                                                            <td rowSpan={M} className="align-middle text-end border-end fw-bold text-dark" style={{ backgroundColor: '#f8fafc' }}>
                                                                PKR {(isSettled ? 0 : (fam.total_billed || 0)).toLocaleString('en-PK')}
                                                            </td>
                                                            <td rowSpan={M} className="align-middle text-end border-end fw-bold text-success" style={{ backgroundColor: '#f0fdf4' }}>
                                                                PKR {(isSettled ? 0 : (fam.total_paid || 0)).toLocaleString('en-PK')}
                                                            </td>
                                                            <td rowSpan={M} className="align-middle text-end border-end fw-bold" style={{ backgroundColor: isSettled ? '#f0f9ff' : (fam.total_balance || 0) > 0 ? '#fef2f2' : '#f0fdf4', color: isSettled ? '#0284c7' : (fam.total_balance || 0) > 0 ? '#dc2626' : '#166534' }}>
                                                                {isSettled ? (
                                                                    <span className="badge rounded-pill px-2 py-1" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', fontSize: '0.74rem' }}>
                                                                        <i className="bi bi-shield-check me-1"></i>Settled (PKR 0)
                                                                    </span>
                                                                ) : (
                                                                    `PKR ${(fam.total_balance || 0).toLocaleString('en-PK')}`
                                                                )}
                                                            </td>
                                                        </>
                                                    )}

                                                    {/* 4. Student Member Sub-Row Name with Specific Father Tag & Trusted Tag */}
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <i className="bi bi-person-circle" style={{ color: 'var(--primary-teal)', fontSize: '0.95rem' }}></i>
                                                            <div>
                                                                <div className="d-flex align-items-center flex-wrap gap-1">
                                                                    <span className="fw-semibold text-dark" style={{ fontSize: '0.88rem' }}>
                                                                        {m.full_name}
                                                                    </span>
                                                                    <span className="badge bg-light text-muted border" style={{ fontSize: '0.7rem' }}>
                                                                        {m.admission_no}
                                                                    </span>
                                                                    {isMemberTrusted && (
                                                                        <span className="badge rounded-pill px-1.5 py-0.5" style={{ backgroundColor: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', fontSize: '0.68rem', fontWeight: 600 }}>
                                                                            <i className="bi bi-shield-check me-1"></i>Trusted
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {/* For cousin families, show specific father tag under student name */}
                                                                {isCousin && m.father_name && (
                                                                    <div className="text-muted mt-0.5" style={{ fontSize: '0.72rem' }}>
                                                                        <i className="bi bi-person-badge me-1"></i>s/d of <strong>{m.father_name}</strong>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* 5. Class */}
                                                    <td>
                                                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle px-2 py-1" style={{ fontSize: '0.78rem' }}>
                                                            {m.class_name}
                                                        </span>
                                                    </td>

                                                    {/* 6. Section */}
                                                    <td>
                                                        <span className="badge bg-secondary bg-opacity-10 text-dark border px-2 py-1" style={{ fontSize: '0.78rem' }}>
                                                            {m.section_name}
                                                        </span>
                                                    </td>

                                                    {/* 7. Parents / Guardians (Rowspan) */}
                                                    {isFirst && (
                                                        <td rowSpan={M} className="align-middle border-start border-end">
                                                            <div className="small">
                                                                {isCousin && fam.fathers_list && fam.fathers_list.length > 0 ? (
                                                                    fam.fathers_list.map((fa, faIdx) => (
                                                                        <div key={faIdx} className="mb-1">
                                                                            <span className="fw-semibold text-dark">
                                                                                <i className="bi bi-person-fill me-1 text-primary"></i>{fa.name}
                                                                            </span>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <>
                                                                        <div className="fw-semibold text-dark">
                                                                            <i className="bi bi-person-badge me-1 text-primary"></i>
                                                                            {fam.father_name || 'N/A'}
                                                                        </div>
                                                                        {fam.mother_name && (
                                                                            <div className="text-muted mt-0.5" style={{ fontSize: '0.75rem' }}>
                                                                                <i className="bi bi-person me-1 text-secondary"></i>
                                                                                Mother: {fam.mother_name}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {/* 8. Contact Numbers (Rowspan) */}
                                                    {isFirst && (
                                                        <td rowSpan={M} className="align-middle border-end" style={{ whiteSpace: 'nowrap' }}>
                                                            <div className="small">
                                                                {isCousin && fam.fathers_list && fam.fathers_list.length > 0 ? (
                                                                    fam.fathers_list.map((fa, faIdx) => (
                                                                        fa.phone ? (
                                                                            <div key={faIdx} className="mb-0.5">
                                                                                <a
                                                                                    href={`tel:${fa.phone}`}
                                                                                    onClick={e => e.stopPropagation()}
                                                                                    className="text-decoration-none text-dark fw-semibold"
                                                                                    title={`Call ${fa.name}: ${fa.phone}`}
                                                                                >
                                                                                    <i className="bi bi-telephone-fill me-1 text-success" style={{ fontSize: '0.7rem' }}></i>
                                                                                    <span className="text-muted small me-1">{fa.name.split(' ')[0]}:</span>
                                                                                    {fa.phone}
                                                                                </a>
                                                                            </div>
                                                                        ) : null
                                                                    ))
                                                                ) : fam.father_phone ? (
                                                                    <div>
                                                                        <a
                                                                            href={`tel:${fam.father_phone}`}
                                                                            onClick={e => e.stopPropagation()}
                                                                            className="text-decoration-none text-dark fw-semibold"
                                                                        >
                                                                            <i className="bi bi-telephone-fill me-1 text-success" style={{ fontSize: '0.72rem' }}></i>
                                                                            {fam.father_phone}
                                                                        </a>
                                                                        {fam.mother_phone && (
                                                                            <div className="text-muted mt-0.5" style={{ fontSize: '0.7rem' }}>
                                                                                M: {fam.mother_phone}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : fam.mother_phone ? (
                                                                    <a
                                                                        href={`tel:${fam.mother_phone}`}
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="text-decoration-none text-dark fw-semibold"
                                                                    >
                                                                        <i className="bi bi-telephone-fill me-1 text-success" style={{ fontSize: '0.72rem' }}></i>
                                                                        {fam.mother_phone}
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-muted">—</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {/* 9. WhatsApp Direct Message (Rowspan) */}
                                                    {isFirst && (
                                                        <td rowSpan={M} className="text-center align-middle">
                                                            {waNumber ? (
                                                                <a
                                                                    href={`https://wa.me/${waNumber}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="btn btn-success btn-sm rounded-circle d-inline-flex align-items-center justify-content-center shadow-sm"
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
                                                    )}
                                                </tr>
                                            );
                                        });
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Mobile / Tablet Responsive Squircle Cards View */
                        <div className="p-3">
                            <div className="row g-3">
                                {filteredFamilies.map((fam, idx) => {
                                    const waNumber = formatWhatsAppNumber(fam.primary_phone);
                                    const feeStatus = (fam.fee_status || 'paid').toLowerCase();
                                    const isSettled = fam.is_trusted_family || ['settled', 'satteled'].includes(feeStatus);
                                    const isCousin = fam.is_cousin_family;

                                    return (
                                        <div key={fam.family_id} className="col-12 col-md-6 col-xl-4">
                                            <div className="card h-100 border shadow-sm" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                                                {/* Card Header */}
                                                <div className="card-header bg-light border-bottom p-3 d-flex justify-content-between align-items-center">
                                                    <div className="d-flex flex-wrap gap-1 align-items-center">
                                                        <span className="badge rounded-pill text-dark border bg-white me-1">
                                                            {fam.family_id}
                                                        </span>
                                                        {isCousin ? (
                                                            <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                                                                Siblings + Cousins
                                                            </span>
                                                        ) : (
                                                            <span className="badge rounded-pill bg-light text-secondary border">
                                                                Pure Siblings
                                                            </span>
                                                        )}
                                                        {isSettled && (
                                                            <span className="badge rounded-pill border" style={{ backgroundColor: '#e0f2fe', borderColor: '#bae6fd', color: '#0369a1', fontSize: '0.68rem', fontWeight: 600 }}>
                                                                <i className="bi bi-shield-check me-1"></i>Settled
                                                            </span>
                                                        )}
                                                    </div>
                                                    {waNumber && (
                                                        <a
                                                            href={`https://wa.me/${waNumber}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-success btn-sm rounded-circle d-inline-flex align-items-center justify-content-center"
                                                            style={{ width: '30px', height: '30px', backgroundColor: '#25D366' }}
                                                        >
                                                            <i className="bi bi-whatsapp text-white" style={{ fontSize: '0.8rem' }}></i>
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Card Body */}
                                                <div className="card-body p-3">
                                                    <h6 className="fw-bold mb-1" style={{ color: isSettled ? '#0891b2' : 'var(--primary-dark)' }}>
                                                        {isCousin ? (fam.combined_father_names || fam.family_name) : fam.family_name}
                                                    </h6>

                                                    {/* Contact info */}
                                                    <div className="small text-muted mb-3">
                                                        <i className="bi bi-telephone-fill text-success me-1"></i>
                                                        {fam.combined_phones || fam.primary_phone || 'No phone'}
                                                    </div>

                                                    {/* Children List in this family */}
                                                    <div className="border-top pt-2">
                                                        <div className="text-muted fw-bold mb-2" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                                            {fam.isFilteredChildCount ? `Filtered Children (${fam.activeMembers.length} of ${fam.total_children}):` : `Children (${fam.activeMembers.length}):`}
                                                        </div>
                                                        <div className="d-flex flex-column gap-2">
                                                            {fam.activeMembers.map(m => {
                                                                const isMemberTrusted = m.is_trusted || (m.category || '').toLowerCase() === 'trusted';
                                                                return (
                                                                    <div
                                                                        key={m.student_id}
                                                                        onClick={() => router.push(`/students/profile/${m.student_id}`)}
                                                                        className="p-2 rounded-3 bg-light d-flex justify-content-between align-items-center cursor-pointer"
                                                                        style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                                                                    >
                                                                        <div>
                                                                            <div className="d-flex align-items-center flex-wrap gap-1">
                                                                                <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>{m.full_name}</span>
                                                                                {isMemberTrusted && (
                                                                                    <span className="badge rounded-pill px-1.5 py-0.5" style={{ backgroundColor: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', fontSize: '0.65rem' }}>
                                                                                        <i className="bi bi-shield-check me-1"></i>Trusted
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                                                Adm# {m.admission_no} {isCousin && m.father_name && `• s/d of ${m.father_name}`}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-end">
                                                                            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle me-1" style={{ fontSize: '0.72rem' }}>
                                                                                {m.class_name}
                                                                            </span>
                                                                            <span className="badge bg-secondary bg-opacity-10 text-dark border" style={{ fontSize: '0.72rem' }}>
                                                                                {m.section_name}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
