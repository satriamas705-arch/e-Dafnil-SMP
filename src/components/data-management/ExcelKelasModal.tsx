import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { AppState, Kelas, NotificationLog } from '../../types';
import { createNotification } from '../../lib/storage';
import {
  FileSpreadsheet,
  Download,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileDown,
  Layers,
  Trash2,
  PlusCircle,
  Save,
} from 'lucide-react';

interface ExcelKelasModalProps {
  appState: AppState;
  onClose: () => void;
  onUpdateKelasList: (newList: Kelas[], notif: NotificationLog) => void;
}

export interface ExcelKelasRow {
  id: string;
  kodeKelas: string; // e.g. "7A"
  namaKelas: string; // e.g. "Kelas 7A"
  tingkat: number; // 7, 8, 9
  waliKelasIdentifier: string; // NIP or Nama Guru (e.g. "196805121994031004" or "Bambang Hidayat")
  tahunAjaran: string; // e.g. "2025/2026"
  statusValidation: 'VALID' | 'WARNING' | 'DUPLICATE';
  validationMessage: string;
}

// Helper to save ExcelJS workbook as downloadable file
const saveWorkbook = async (workbook: ExcelJS.Workbook, fileName: string) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const ExcelKelasModal: React.FC<ExcelKelasModalProps> = ({
  appState,
  onClose,
  onUpdateKelasList,
}) => {
  const [activeSheetTab, setActiveSheetTab] = useState<'DATA' | 'REF'>('DATA');
  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to resolve guru from NIP or Nama
  const findGuruByIdentifier = (identifier: string) => {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    return appState.guruList.find(
      (g) =>
        g.nip.toLowerCase() === clean ||
        g.nama.toLowerCase() === clean ||
        g.id.toLowerCase() === clean ||
        g.nama.toLowerCase().includes(clean)
    );
  };

  // Convert current kelas list to Excel row format for preview/editing
  const convertKelasToExcelRows = (list: Kelas[]): ExcelKelasRow[] => {
    return list.map((k) => {
      const waliGuru = appState.guruList.find((g) => g.id === k.waliKelasId);
      const waliStr = waliGuru ? `${waliGuru.nama} (${waliGuru.nip})` : k.waliKelasNama || '';

      return {
        id: k.id,
        kodeKelas: k.kodeKelas,
        namaKelas: k.namaKelas,
        tingkat: k.tingkat || 7,
        waliKelasIdentifier: waliStr,
        tahunAjaran: k.tahunAjaran || '2025/2026',
        statusValidation: 'VALID',
        validationMessage: 'Data terverifikasi',
      };
    });
  };

  const [excelRows, setExcelRows] = useState<ExcelKelasRow[]>(() =>
    convertKelasToExcelRows(appState.kelasList)
  );

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>({
    row: 0,
    col: 'B',
  });

  // Selected cell value for Formula Bar display
  const getSelectedCellValue = () => {
    if (!selectedCell || selectedCell.row < 0 || selectedCell.row >= excelRows.length) {
      return '=KELAS("ROMBEL_SEKOLAH_SIMPEGUR")';
    }
    const row = excelRows[selectedCell.row];
    switch (selectedCell.col) {
      case 'A': return (selectedCell.row + 1).toString();
      case 'B': return row.kodeKelas;
      case 'C': return row.namaKelas;
      case 'D': return row.tingkat.toString();
      case 'E': return row.waliKelasIdentifier;
      case 'F': return row.tahunAjaran;
      default: return '=CELL_VALUE()';
    }
  };

  // Cell Change Handler
  const handleCellChange = (rowIndex: number, field: keyof ExcelKelasRow, value: any) => {
    setExcelRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [field]: value,
      };

      // Auto fill namaKelas if kodeKelas is updated
      if (field === 'kodeKelas' && value) {
        const uppercaseKode = value.toString().toUpperCase();
        updated[rowIndex].kodeKelas = uppercaseKode;
        if (!updated[rowIndex].namaKelas || updated[rowIndex].namaKelas.startsWith('Kelas')) {
          updated[rowIndex].namaKelas = `Kelas ${uppercaseKode}`;
        }
      }

      // Validate
      const row = updated[rowIndex];
      if (!row.kodeKelas || !row.namaKelas) {
        row.statusValidation = 'WARNING';
        row.validationMessage = 'Kode Kelas dan Nama Kelas wajib diisi!';
      } else {
        row.statusValidation = 'VALID';
        row.validationMessage = 'Data valid';
      }

      return updated;
    });
  };

  // Add new empty row to spreadsheet
  const handleAddExcelRow = () => {
    const nextNum = excelRows.length + 1;
    const defaultGuru = appState.guruList[0];
    const waliStr = defaultGuru ? `${defaultGuru.nama} (${defaultGuru.nip})` : 'Belum Ditentukan';

    const newRow: ExcelKelasRow = {
      id: 'k-excel-' + Date.now(),
      kodeKelas: `7${String.fromCharCode(64 + (nextNum > 26 ? 1 : nextNum))}`,
      namaKelas: `Kelas 7${String.fromCharCode(64 + (nextNum > 26 ? 1 : nextNum))}`,
      tingkat: 7,
      waliKelasIdentifier: waliStr,
      tahunAjaran: '2025/2026',
      statusValidation: 'VALID',
      validationMessage: 'Baris baru ditambahkan',
    };
    setExcelRows((prev) => [...prev, newRow]);
  };

  // Delete row from spreadsheet preview
  const handleDeleteRow = (index: number) => {
    setExcelRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Export to Genuine .XLSX File using ExcelJS (Berwarna & Proporsional)
  const handleExportXLSX = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'e-Dafnil Assessment System';
    wb.lastModifiedBy = 'e-Dafnil Admin';
    wb.created = new Date();
    wb.modified = new Date();

    const activeTA = appState.tahunAjaranList.find((t) => t.aktif) || {
      tahun: '2025/2026',
      semester: '1',
    };

    const ws = wb.addWorksheet('Data Kelas Rombel', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1B4F72' } },
    });

    const totalCols = 8;
    const kabName = appState.sekolah?.kabupatenKota?.toUpperCase() || 'BANYUMAS';
    const schName = appState.sekolah?.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN';

    // --- ROW 1: KOP DINAS ---
    const row1 = ws.addRow([`PEMERINTAH KABUPATEN ${kabName} - DINAS PENDIDIKAN`]);
    ws.mergeCells(1, 1, 1, totalCols);
    row1.height = 24;
    row1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row1.alignment = { vertical: 'middle', horizontal: 'center' };
    row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    // --- ROW 2: KOP SEKOLAH ---
    const row2 = ws.addRow([`${schName} - SISTEM e-DAFNIL / SIM DATA`]);
    ws.mergeCells(2, 1, 2, totalCols);
    row2.height = 28;
    row2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    row2.alignment = { vertical: 'middle', horizontal: 'center' };
    row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E80' } };

    // --- ROW 3: JUDUL DOKUMEN ---
    const row3 = ws.addRow(['FORMAT & REKAPITULASI RESMI DATA ROMBONGAN BELAJAR (KELAS)']);
    ws.mergeCells(3, 1, 3, totalCols);
    row3.height = 22;
    row3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    row3.alignment = { vertical: 'middle', horizontal: 'center' };
    row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    // --- ROW 4: SEPARATOR ---
    ws.addRow([]).height = 8;

    // --- ROW 5 & 6: METADATA BANNER ---
    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const totalSiswaAll = appState.siswaList.length;

    const row5 = ws.addRow([
      `Tahun Ajaran: ${activeTA.tahun} - Semester ${activeTA.semester}`,
      '',
      '',
      '',
      `Satuan Pendidikan: ${appState.sekolah?.namaSekolah || 'SMPN 2 Kemranjen'} (NPSN: ${appState.sekolah?.npsn || '20307730'})`,
    ]);
    row5.height = 20;
    row5.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    row5.alignment = { vertical: 'middle' };

    const row6 = ws.addRow([
      `Tanggal Ekspor: ${todayStr}`,
      '',
      '',
      '',
      `Total Kelas: ${excelRows.length} Rombel | Total Siswa: ${totalSiswaAll} Orang`,
    ]);
    row6.height = 20;
    row6.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } };
    row6.alignment = { vertical: 'middle' };

    ws.addRow([]).height = 8;

    // --- ROW 8: TABLE HEADERS ---
    const headerLabels = [
      'No',
      'Kode Kelas',
      'Nama Kelas',
      'Tingkat / Jenjang',
      'NIP Wali Kelas',
      'Nama Wali Kelas',
      'Tahun Ajaran',
      'Jumlah Siswa',
    ];

    const headerRow = ws.addRow(headerLabels);
    headerRow.height = 30;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    headerRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F3D64' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0F3D64' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      if (colNumber <= 2) {
        // No, Kode Kelas: Dark Navy Blue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 4) {
        // Nama Kelas, Tingkat: Royal Blue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 6) {
        // NIP & Nama Wali Kelas: Forest Green
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        // Tahun Ajaran & Jumlah Siswa: Amber Orange
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    // --- DATA ROWS ---
    excelRows.forEach((r, idx) => {
      const foundGuru = findGuruByIdentifier(r.waliKelasIdentifier);
      const waliNama = foundGuru ? foundGuru.nama : r.waliKelasIdentifier;
      const waliNip = foundGuru ? foundGuru.nip : '-';
      const studentCount = appState.siswaList.filter((s) => s.kodeKelas === r.kodeKelas || s.kelasId === r.id).length;

      const dataRow = ws.addRow([
        idx + 1,
        r.kodeKelas,
        r.namaKelas,
        `Tingkat ${r.tingkat}`,
        waliNip,
        waliNama,
        r.tahunAjaran,
        studentCount,
      ]);
      dataRow.height = 24;

      const isEven = idx % 2 === 1;
      const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

      dataRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (colNumber === 1) {
          // No
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF64748B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 2) {
          // Kode Kelas
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFEFF6FF' : 'FFFFFFFF' } };
        } else if (colNumber === 3) {
          // Nama Kelas
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 4) {
          // Tingkat
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 5) {
          // NIP Wali
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 6) {
          // Nama Wali
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF0FDF4' : 'FFFFFFFF' } };
        } else if (colNumber === 7) {
          // Tahun Ajaran
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else {
          // Jumlah Siswa
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF9A3412' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFF7ED' : 'FFFFFFFF' } };
        }
      });
    });

    // Proportional Column Widths
    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'kodeKelas', width: 16 },
      { key: 'namaKelas', width: 24 },
      { key: 'tingkat', width: 18 },
      { key: 'nipWali', width: 24 },
      { key: 'namaWali', width: 36 },
      { key: 'tahunAjaran', width: 18 },
      { key: 'jumlahSiswa', width: 18 },
    ];

    // --- SHEET 2: PETUNJUK FORMAT ---
    const wsHelp = wb.addWorksheet('Petunjuk Format', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1E8449' } },
    });

    const helpTitle = wsHelp.addRow(['PANDUAN & PETUNJUK FORMAT PENGISIAN DATA KELAS']);
    wsHelp.mergeCells(1, 1, 1, 3);
    helpTitle.height = 26;
    helpTitle.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    helpTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    helpTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };

    wsHelp.addRow([]).height = 8;
    const helpHeader = wsHelp.addRow(['No', 'Kolom / Field', 'Aturan & Format Pengisian']);
    helpHeader.height = 24;
    helpHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    helpHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    const instructions = [
      ['1', 'KODE KELAS', 'Wajib diisi kode unik singkat rombel (Contoh: 7A, 7B, 8A, 8B, 9A, 9B).'],
      ['2', 'NAMA KELAS', 'Wajib diisi nama lengkap rombongan belajar (Contoh: Kelas 7A, Kelas 8B).'],
      ['3', 'TINGKAT', 'Diisi angka jenjang: 7, 8, atau 9.'],
      ['4', 'NIP ATAU NAMA WALI KELAS', 'Diisi NIP atau nama lengkap pendidik yang ditugaskan sebagai wali kelas.'],
      ['5', 'TAHUN AJARAN', 'Format standar TTTT/TTTT (Contoh: 2025/2026).'],
    ];

    instructions.forEach((inst) => {
      const r = wsHelp.addRow(inst);
      r.height = 22;
      r.eachCell((c) => {
        c.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        c.font = { name: 'Arial', size: 9.5 };
      });
    });
    wsHelp.columns = [{ width: 6 }, { width: 28 }, { width: 80 }];

    // --- SHEET 3: REFERENSI GURU ---
    const wsRefGuru = wb.addWorksheet('Referensi Guru', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FFD35400' } },
    });
    const guruTitle = wsRefGuru.addRow(['REFERENSI NIP & NAMA GURU WALI KELAS']);
    wsRefGuru.mergeCells(1, 1, 1, 4);
    guruTitle.height = 24;
    guruTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    guruTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    guruTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };

    wsRefGuru.addRow([]).height = 6;
    const guruH = wsRefGuru.addRow(['No', 'NIP Guru', 'Nama Lengkap Guru', 'No. HP / WA']);
    guruH.height = 22;
    guruH.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    guruH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    appState.guruList.forEach((g, i) => {
      const r = wsRefGuru.addRow([i + 1, g.nip, g.nama, g.noHp || '-']);
      r.height = 20;
      r.eachCell((c) => {
        c.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        c.font = { name: 'Arial', size: 9.5 };
      });
    });
    wsRefGuru.columns = [{ width: 6 }, { width: 24 }, { width: 36 }, { width: 20 }];

    const cleanSchool = (appState.sekolah?.namaSekolah || 'SMPN2_Kemranjen').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanTa = (activeTA.tahun || '2025-2026').replace(/\//g, '-');
    const fileName = `Export_Data_Kelas_${cleanSchool}_${cleanTa}.xlsx`;
    await saveWorkbook(wb, fileName);
  };

  // Download Sample Template .XLSX (Berwarna & Proporsional)
  const handleDownloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'e-Dafnil Assessment System';
    wb.lastModifiedBy = 'e-Dafnil Admin';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet('Template Data Kelas', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1B4F72' } },
    });

    const totalCols = 6;
    const kabName = appState.sekolah?.kabupatenKota?.toUpperCase() || 'BANYUMAS';
    const schName = appState.sekolah?.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN';

    // Kop
    const row1 = ws.addRow([`PEMERINTAH KABUPATEN ${kabName} - DINAS PENDIDIKAN`]);
    ws.mergeCells(1, 1, 1, totalCols);
    row1.height = 24;
    row1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row1.alignment = { vertical: 'middle', horizontal: 'center' };
    row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    const row2 = ws.addRow([`${schName} - TEMPLATE IMPORT DATA KELAS / ROMBEL`]);
    ws.mergeCells(2, 1, 2, totalCols);
    row2.height = 28;
    row2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    row2.alignment = { vertical: 'middle', horizontal: 'center' };
    row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E80' } };

    const row3 = ws.addRow(['TEMPLATE FORMULIR ENTRI & IMPORT ROMBONGAN BELAJAR (OFFLINE ENTRY)']);
    ws.mergeCells(3, 1, 3, totalCols);
    row3.height = 22;
    row3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    row3.alignment = { vertical: 'middle', horizontal: 'center' };
    row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    ws.addRow([]).height = 8;

    const row5 = ws.addRow([
      `Panduan: Isi kode kelas, nama kelas, tingkat (7,8,9), dan NIP/Nama Wali Kelas.`,
      '',
      '',
      '',
      `Lihat sheet 'Ref Guru' untuk daftar NIP/Nama guru valid.`,
    ]);
    row5.height = 20;
    row5.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } };
    row5.alignment = { vertical: 'middle' };

    ws.addRow([]).height = 8;

    // Headers
    const headerLabels = [
      'No',
      'Kode Kelas',
      'Nama Kelas',
      'Tingkat',
      'NIP Atau Nama Wali Kelas',
      'Tahun Ajaran',
    ];

    const headerRow = ws.addRow(headerLabels);
    headerRow.height = 30;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    headerRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F3D64' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0F3D64' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      if (colNumber <= 2) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 4) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    const sampleGuru1 = appState.guruList[0]?.nama || 'Budi Santoso, S.Pd.';
    const sampleGuru2 = appState.guruList[1]?.nama || 'Siti Rahmawati, M.Pd.';

    const sampleClasses = [
      { no: 1, kode: '7A', nama: 'Kelas 7A', tingkat: 7, wali: sampleGuru1, ta: '2025/2026' },
      { no: 2, kode: '7B', nama: 'Kelas 7B', tingkat: 7, wali: sampleGuru2, ta: '2025/2026' },
      { no: 3, kode: '8A', nama: 'Kelas 8A', tingkat: 8, wali: sampleGuru1, ta: '2025/2026' },
      { no: 4, kode: '9A', nama: 'Kelas 9A', tingkat: 9, wali: sampleGuru2, ta: '2025/2026' },
    ];

    sampleClasses.forEach((c, idx) => {
      const dataRow = ws.addRow([
        c.no,
        c.kode,
        c.nama,
        c.tingkat,
        c.wali,
        c.ta,
      ]);
      dataRow.height = 23;

      const isEven = idx % 2 === 1;
      const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

      dataRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF64748B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFEFF6FF' : 'FFFFFFFF' } };
        } else if (colNumber === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 4) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF0FDF4' : 'FFFFFFFF' } };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        }
      });
    });

    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'kode', width: 16 },
      { key: 'nama', width: 24 },
      { key: 'tingkat', width: 14 },
      { key: 'wali', width: 36 },
      { key: 'ta', width: 18 },
    ];

    // Sheet 2: Petunjuk Format
    const wsHelp = wb.addWorksheet('Petunjuk Pengisian', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1E8449' } },
    });
    const helpTitle = wsHelp.addRow(['PANDUAN & PETUNJUK FORMAT PENGISIAN DATA KELAS']);
    wsHelp.mergeCells(1, 1, 1, 3);
    helpTitle.height = 26;
    helpTitle.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    helpTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    helpTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };

    wsHelp.addRow([]).height = 8;
    const helpHeader = wsHelp.addRow(['No', 'Kolom / Field', 'Aturan & Format Pengisian']);
    helpHeader.height = 24;
    helpHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    helpHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    const instructions = [
      ['1', 'KODE KELAS', 'Wajib diisi kode singkat kelas (Contoh: 7A, 7B, 8A, 8B, 9A, 9B).'],
      ['2', 'NAMA KELAS', 'Wajib diisi nama kelas lengkap (Contoh: Kelas 7A, Kelas 8B).'],
      ['3', 'TINGKAT', 'Diisi angka jenjang tingkat: 7, 8, atau 9.'],
      ['4', 'NIP ATAU NAMA WALI KELAS', 'Diisi NIP atau nama lengkap guru wali kelas.'],
      ['5', 'TAHUN AJARAN', 'Format standar TTTT/TTTT (Contoh: 2025/2026).'],
    ];

    instructions.forEach((inst) => {
      const r = wsHelp.addRow(inst);
      r.height = 22;
      r.eachCell((c) => {
        c.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        c.font = { name: 'Arial', size: 9.5 };
      });
    });
    wsHelp.columns = [{ width: 6 }, { width: 28 }, { width: 80 }];

    // Sheet 3: Ref Guru
    const wsRefGuru = wb.addWorksheet('Ref Guru', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FFD35400' } },
    });
    const guruTitle = wsRefGuru.addRow(['REFERENSI NIP & NAMA GURU WALI KELAS']);
    wsRefGuru.mergeCells(1, 1, 1, 4);
    guruTitle.height = 24;
    guruTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    guruTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    guruTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };

    wsRefGuru.addRow([]).height = 6;
    const guruH = wsRefGuru.addRow(['No', 'NIP Guru', 'Nama Lengkap Guru', 'No. HP / WA']);
    guruH.height = 22;
    guruH.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    guruH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    appState.guruList.forEach((g, i) => {
      const r = wsRefGuru.addRow([i + 1, g.nip, g.nama, g.noHp || '-']);
      r.height = 20;
      r.eachCell((c) => {
        c.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        c.font = { name: 'Arial', size: 9.5 };
      });
    });
    wsRefGuru.columns = [{ width: 6 }, { width: 24 }, { width: 36 }, { width: 20 }];

    const cleanSchool = (appState.sekolah?.namaSekolah || 'SMPN2_Kemranjen').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Template_Import_Data_Kelas_${cleanSchool}.xlsx`;
    await saveWorkbook(wb, fileName);
  };

  // Upload Excel File Handler (Mendukung File Bertitle/Kop Resmi maupun Format Polos)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        if (!rawData || rawData.length < 2) {
          alert('File Excel kosong atau format tidak sesuai!');
          return;
        }

        // Search for header row containing Kode Kelas or Nama Kelas
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(15, rawData.length); i++) {
          const rowStr = JSON.stringify(rawData[i] || []).toLowerCase();
          if (rowStr.includes('kode') && (rowStr.includes('kelas') || rowStr.includes('rombel'))) {
            headerRowIdx = i;
            break;
          } else if (rowStr.includes('nama kelas') || rowStr.includes('tingkat')) {
            headerRowIdx = i;
            break;
          }
        }

        let jsonData: Record<string, any>[] = [];

        if (headerRowIdx !== -1) {
          const headers = (rawData[headerRowIdx] || []).map((h) => String(h || '').trim());
          for (let r = headerRowIdx + 1; r < rawData.length; r++) {
            const rowArr = rawData[r] || [];
            if (rowArr.length === 0 || rowArr.every((c: any) => c === undefined || c === null || c === '')) {
              continue;
            }
            const rowObj: Record<string, any> = {};
            headers.forEach((h, colIdx) => {
              if (h) {
                rowObj[h] = rowArr[colIdx] !== undefined ? rowArr[colIdx] : '';
              }
            });
            jsonData.push(rowObj);
          }
        } else {
          jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
        }

        if (jsonData.length === 0) {
          alert('File Excel tidak memiliki baris data kelas yang valid!');
          return;
        }

        // Map parsed Excel JSON into ExcelKelasRow structure
        const parsedRows: ExcelKelasRow[] = jsonData.map((row, idx) => {
          const kodeKelas = (
            row['Kode Kelas'] ||
            row['KODE KELAS'] ||
            row['KODE'] ||
            row['kode_kelas'] ||
            row['kode'] ||
            ''
          ).toString().trim().toUpperCase();

          let namaKelas = (
            row['Nama Kelas'] ||
            row['NAMA KELAS'] ||
            row['NAMA'] ||
            row['nama_kelas'] ||
            row['nama'] ||
            ''
          ).toString().trim();

          if (!namaKelas && kodeKelas) {
            namaKelas = `Kelas ${kodeKelas}`;
          }

          let tingkatRaw = parseInt(
            row['Tingkat / Jenjang'] ||
            row['TINGKAT / JENJANG'] ||
            row['Tingkat'] ||
            row['TINGKAT'] ||
            row['tingkat'] ||
            kodeKelas.charAt(0) ||
            '7'
          );
          const tingkat = [7, 8, 9].includes(tingkatRaw) ? tingkatRaw : 7;

          const waliKelasIdentifier = (
            row['NIP Wali Kelas'] ||
            row['Nama Wali Kelas'] ||
            row['NIP Atau Nama Wali Kelas'] ||
            row['NIP ATAU NAMA WALI KELAS'] ||
            row['NAMA WALI KELAS'] ||
            row['WALI KELAS'] ||
            row['NIP WALI KELAS'] ||
            row['wali_kelas'] ||
            ''
          ).toString().trim();

          const tahunAjaran = (
            row['Tahun Ajaran'] ||
            row['TAHUN AJARAN'] ||
            row['TAHUN'] ||
            row['tahun_ajaran'] ||
            '2025/2026'
          ).toString().trim();

          const isDuplicate = appState.kelasList.some(
            (k) => k.kodeKelas.toLowerCase() === kodeKelas.toLowerCase() && kodeKelas !== ''
          );

          let statusValidation: 'VALID' | 'WARNING' | 'DUPLICATE' = 'VALID';
          let validationMessage = 'Siap diimpor';

          if (!kodeKelas || !namaKelas) {
            statusValidation = 'WARNING';
            validationMessage = 'Kode atau Nama Kelas kosong';
          } else if (isDuplicate) {
            statusValidation = 'DUPLICATE';
            validationMessage = 'Kode Kelas sudah ada di database';
          }

          return {
            id: 'k-imp-' + idx + '-' + Date.now(),
            kodeKelas,
            namaKelas,
            tingkat,
            waliKelasIdentifier,
            tahunAjaran,
            statusValidation,
            validationMessage,
          };
        });

        setExcelRows(parsedRows);
        alert(
          `Berhasil membaca ${parsedRows.length} baris data kelas dari file Excel "${file.name}"! Silakan periksa di lembar kerja Excel.`
        );
      } catch (err) {
        console.error('Error reading Excel file:', err);
        alert('Gagal membaca file Excel. Pastikan format file .xlsx, .xls, atau .csv valid.');
      }
    };
    reader.readAsBinaryString(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Commit Import to System State
  const handleCommitImport = () => {
    if (excelRows.length === 0) {
      alert('Tidak ada data di lembar Excel untuk diimpor.');
      return;
    }

    const convertedKelas: Kelas[] = excelRows.map((r) => {
      // Find teacher for Wali Kelas
      const foundGuru = findGuruByIdentifier(r.waliKelasIdentifier);
      const waliKelasId = foundGuru ? foundGuru.id : (appState.guruList[0]?.id || '');
      const waliKelasNama = foundGuru
        ? foundGuru.nama
        : r.waliKelasIdentifier || (appState.guruList[0]?.nama || 'Belum Ditentukan');

      return {
        id: r.id || 'k-' + Math.random().toString(36).substring(2, 9),
        kodeKelas: r.kodeKelas || '7A',
        namaKelas: r.namaKelas || `Kelas ${r.kodeKelas || '7A'}`,
        tingkat: r.tingkat || 7,
        waliKelasId,
        waliKelasNama,
        tahunAjaran: r.tahunAjaran || '2025/2026',
      };
    });

    let finalKelasList: Kelas[] = [];
    if (importMode === 'REPLACE') {
      finalKelasList = convertedKelas;
    } else {
      // MERGE: Update by Kode Kelas or append
      const existingMap = new Map<string, Kelas>();
      appState.kelasList.forEach((k) => existingMap.set(k.kodeKelas.toUpperCase(), k));
      convertedKelas.forEach((k) => existingMap.set(k.kodeKelas.toUpperCase(), k));
      finalKelasList = Array.from(existingMap.values());
    }

    const notif = createNotification(
      'Import Data Kelas Excel',
      `Berhasil memperbarui data kelas dari Excel (${convertedKelas.length} rombel diproses).`,
      'data-kelas'
    );

    onUpdateKelasList(finalKelasList, notif);
    alert(`Sukses! ${convertedKelas.length} data kelas rombel dari Excel telah berhasil disimpan ke dalam sistem.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 text-slate-100 rounded-2xl w-full max-w-6xl shadow-2xl border border-slate-700 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* MS EXCEL TOP RIBBON HEADER */}
        <div className="bg-[#107c41] text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-black text-white text-base shadow-xs">
              X
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm tracking-wide">
                  Microsoft Excel — Modul Import & Export Data Kelas Rombel
                </span>
                <span className="bg-emerald-800 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-600">
                  Live Spreadsheet Engine
                </span>
              </div>
              <p className="text-[11px] text-emerald-100 opacity-90">
                DATA_KELAS_SIMPEGUR_2025_2026.xlsx • {excelRows.length} Baris Data Rombel
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportXLSX}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer"
              title="Unduh File Excel Asli (.xlsx)"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export .XLSX</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer"
              title="Unggah File Excel untuk Diimpor"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Import .XLSX</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-emerald-800 text-emerald-100 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* EXCEL TOOLBAR */}
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <FileDown size={14} />
              <span>Download Template Excel</span>
            </button>

            <button
              onClick={handleAddExcelRow}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-blue-400 font-bold rounded-lg border border-blue-500/30 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle size={14} />
              <span>Tambah Baris Kelas</span>
            </button>

            <button
              onClick={() => setExcelRows(convertKelasToExcelRows(appState.kelasList))}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg border border-slate-600 flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Reset ke Data Kelas Saat Ini"
            >
              <RefreshCw size={13} />
              <span>Reset Data</span>
            </button>
          </div>

          {/* Import Mode & Apply */}
          <div className="flex items-center space-x-3 bg-slate-950 p-1.5 rounded-xl border border-slate-700">
            <div className="flex items-center space-x-2 px-2 text-[11px]">
              <span className="text-slate-400 font-medium">Mode Import:</span>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="radio"
                  name="importModeKelas"
                  checked={importMode === 'MERGE'}
                  onChange={() => setImportMode('MERGE')}
                  className="accent-emerald-500"
                />
                <span className={importMode === 'MERGE' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  Gabung / Timpa Kode
                </span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer ml-2">
                <input
                  type="radio"
                  name="importModeKelas"
                  checked={importMode === 'REPLACE'}
                  onChange={() => setImportMode('REPLACE')}
                  className="accent-rose-500"
                />
                <span className={importMode === 'REPLACE' ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                  Ganti Semua Data
                </span>
              </label>
            </div>

            <button
              onClick={handleCommitImport}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg shadow-md transition-all flex items-center space-x-1.5 cursor-pointer animate-pulse"
            >
              <Save size={14} />
              <span>Terapkan Ke Sistem</span>
            </button>
          </div>
        </div>

        {/* FORMULA BAR SIMULATION */}
        <div className="bg-slate-950 border-b border-slate-800 px-4 py-1.5 flex items-center space-x-2 text-xs text-slate-300 shrink-0 font-mono">
          <div className="bg-slate-800 text-emerald-400 px-2.5 py-1 rounded font-bold border border-slate-700 min-w-[70px] text-center">
            {selectedCell ? `${selectedCell.col}${selectedCell.row + 2}` : 'A1'}
          </div>
          <span className="text-slate-500 font-bold">fx</span>
          <div className="flex-1 bg-slate-900 border border-slate-800 px-3 py-1 rounded text-slate-200 overflow-hidden truncate">
            {getSelectedCellValue()}
          </div>
        </div>

        {/* EXCEL SPREADSHEET MAIN GRID AREA */}
        <div className="flex-1 overflow-auto bg-slate-950 custom-scrollbar p-2">
          {activeSheetTab === 'DATA' ? (
            <div className="min-w-[900px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-inner font-sans text-xs">
              <table className="w-full border-collapse">
                <thead>
                  {/* EXCEL COLUMN HEADERS (A, B, C, D...) */}
                  <tr className="bg-slate-800 text-slate-400 text-[11px] font-bold border-b border-slate-700">
                    <th className="w-10 border-r border-slate-700 p-1 text-center bg-slate-850">#</th>
                    <th className="w-12 border-r border-slate-700 p-1 text-center">A</th>
                    <th className="w-36 border-r border-slate-700 p-1 text-center">B (Kode Kelas)</th>
                    <th className="w-48 border-r border-slate-700 p-1 text-center">C (Nama Kelas)</th>
                    <th className="w-24 border-r border-slate-700 p-1 text-center">D (Tingkat)</th>
                    <th className="w-64 border-r border-slate-700 p-1 text-center">E (Wali Kelas)</th>
                    <th className="w-36 border-r border-slate-700 p-1 text-center">F (Tahun Ajaran)</th>
                    <th className="w-28 border-r border-slate-700 p-1 text-center">Status</th>
                    <th className="w-12 p-1 text-center">Hapus</th>
                  </tr>

                  {/* EXCEL SHEET HEADER ROW 1 */}
                  <tr className="bg-[#107c41] text-white font-extrabold text-xs border-b border-emerald-800 shadow-sm">
                    <td className="border-r border-emerald-800 p-2 text-center bg-emerald-900 text-emerald-200 font-mono">1</td>
                    <td className="border-r border-emerald-800 p-2 text-center">No</td>
                    <td className="border-r border-emerald-800 p-2">Kode Kelas *</td>
                    <td className="border-r border-emerald-800 p-2">Nama Kelas *</td>
                    <td className="border-r border-emerald-800 p-2 text-center">Tingkat</td>
                    <td className="border-r border-emerald-800 p-2">Wali Kelas (NIP / Nama Guru)</td>
                    <td className="border-r border-emerald-800 p-2">Tahun Ajaran</td>
                    <td className="border-r border-emerald-800 p-2 text-center">Validasi</td>
                    <td className="p-2 text-center">Aksi</td>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                  {excelRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 italic">
                        Belum ada data kelas. Klik "Tambah Baris Kelas" atau "Import .XLSX" untuk memulai.
                      </td>
                    </tr>
                  ) : (
                    excelRows.map((row, idx) => {
                      const excelRowIndex = idx + 2;
                      return (
                        <tr
                          key={row.id || idx}
                          className="hover:bg-slate-800/80 transition-colors border-b border-slate-800/60"
                        >
                          {/* Row Number Header */}
                          <td className="border-r border-slate-800 p-1 text-center bg-slate-850 text-slate-500 font-bold select-none text-[11px]">
                            {excelRowIndex}
                          </td>

                          {/* Column A: No */}
                          <td className="border-r border-slate-800 p-1.5 text-center text-slate-400 select-none">
                            {idx + 1}
                          </td>

                          {/* Column B: Kode Kelas */}
                          <td
                            className={`border-r border-slate-800 p-1 ${
                              selectedCell?.row === idx && selectedCell?.col === 'B'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'B' })}
                          >
                            <input
                              type="text"
                              value={row.kodeKelas}
                              onChange={(e) => handleCellChange(idx, 'kodeKelas', e.target.value)}
                              placeholder="7A, 8B"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-blue-300 font-mono font-extrabold focus:outline-hidden"
                            />
                          </td>

                          {/* Column C: Nama Kelas */}
                          <td
                            className={`border-r border-slate-800 p-1 ${
                              selectedCell?.row === idx && selectedCell?.col === 'C'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'C' })}
                          >
                            <input
                              type="text"
                              value={row.namaKelas}
                              onChange={(e) => handleCellChange(idx, 'namaKelas', e.target.value)}
                              placeholder="Kelas 7A"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-white font-sans font-bold focus:outline-hidden"
                            />
                          </td>

                          {/* Column D: Tingkat */}
                          <td
                            className={`border-r border-slate-800 p-1 text-center ${
                              selectedCell?.row === idx && selectedCell?.col === 'D'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'D' })}
                          >
                            <select
                              value={row.tingkat}
                              onChange={(e) => handleCellChange(idx, 'tingkat', parseInt(e.target.value))}
                              className="bg-slate-900 text-slate-200 border-0 text-xs px-1 py-0.5 rounded focus:outline-hidden cursor-pointer"
                            >
                              <option value={7}>7</option>
                              <option value={8}>8</option>
                              <option value={9}>9</option>
                            </select>
                          </td>

                          {/* Column E: Wali Kelas */}
                          <td
                            className={`border-r border-slate-800 p-1 ${
                              selectedCell?.row === idx && selectedCell?.col === 'E'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'E' })}
                          >
                            <input
                              type="text"
                              value={row.waliKelasIdentifier}
                              onChange={(e) => handleCellChange(idx, 'waliKelasIdentifier', e.target.value)}
                              placeholder="NIP atau Nama Guru Wali Kelas"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-emerald-300 font-sans focus:outline-hidden"
                            />
                          </td>

                          {/* Column F: Tahun Ajaran */}
                          <td
                            className={`border-r border-slate-800 p-1 ${
                              selectedCell?.row === idx && selectedCell?.col === 'F'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'F' })}
                          >
                            <input
                              type="text"
                              value={row.tahunAjaran}
                              onChange={(e) => handleCellChange(idx, 'tahunAjaran', e.target.value)}
                              placeholder="2025/2026"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-amber-300 font-mono focus:outline-hidden"
                            />
                          </td>

                          {/* Status Validation */}
                          <td className="border-r border-slate-800 p-1 text-center">
                            {row.statusValidation === 'VALID' ? (
                              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-sans font-bold inline-flex items-center space-x-1">
                                <CheckCircle2 size={10} />
                                <span>Valid</span>
                              </span>
                            ) : row.statusValidation === 'DUPLICATE' ? (
                              <span
                                className="bg-rose-950 text-rose-400 border border-rose-800 text-[10px] px-2 py-0.5 rounded-full font-sans font-bold inline-flex items-center space-x-1"
                                title={row.validationMessage}
                              >
                                <AlertCircle size={10} />
                                <span>Duplikat</span>
                              </span>
                            ) : (
                              <span
                                className="bg-amber-950 text-amber-400 border border-amber-800 text-[10px] px-2 py-0.5 rounded-full font-sans font-bold inline-flex items-center space-x-1"
                                title={row.validationMessage}
                              >
                                <AlertCircle size={10} />
                                <span>Warning</span>
                              </span>
                            )}
                          </td>

                          {/* Delete Action */}
                          <td className="p-1 text-center">
                            <button
                              onClick={() => handleDeleteRow(idx)}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              title="Hapus baris kelas ini"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* REFERENSI SHEET VIEW */
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h4 className="font-bold text-emerald-400 text-xs mb-3 flex items-center space-x-2">
                <Layers size={14} />
                <span>Daftar Guru untuk Wali Kelas (Referensi Import)</span>
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                Ketikkan NIP atau Nama Guru di kolom "Wali Kelas" pada Sheet1 agar sistem mencocokkannya secara otomatis.
              </p>
              <div className="max-h-96 overflow-y-auto border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-300 font-bold">
                    <tr>
                      <th className="p-2.5 w-12 text-center">No</th>
                      <th className="p-2.5">NIP Guru</th>
                      <th className="p-2.5">Nama Lengkap Guru</th>
                      <th className="p-2.5 text-center">JK</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">No HP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                    {appState.guruList.map((g, i) => (
                      <tr key={g.id} className="hover:bg-slate-800/60">
                        <td className="p-2 text-center text-slate-500">{i + 1}</td>
                        <td className="p-2 font-bold text-emerald-300">{g.nip}</td>
                        <td className="p-2 font-sans font-bold text-white">{g.nama}</td>
                        <td className="p-2 text-center">{g.jenisKelamin}</td>
                        <td className="p-2 text-slate-400 font-sans">{g.email || '-'}</td>
                        <td className="p-2 text-slate-400">{g.noHp || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM SHEET TABS & STATUS BAR */}
        <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveSheetTab('DATA')}
              className={`px-3 py-1 rounded-t-lg font-bold transition-all cursor-pointer text-xs flex items-center space-x-1.5 ${
                activeSheetTab === 'DATA'
                  ? 'bg-emerald-700 text-white shadow-md border-t-2 border-emerald-400'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet size={13} />
              <span>📊 Sheet1: Data Kelas</span>
            </button>

            <button
              onClick={() => setActiveSheetTab('REF')}
              className={`px-3 py-1 rounded-t-lg font-bold transition-all cursor-pointer text-xs flex items-center space-x-1.5 ${
                activeSheetTab === 'REF'
                  ? 'bg-amber-600 text-white shadow-md border-t-2 border-amber-300'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={13} />
              <span>⚙️ Sheet2: Referensi Guru & Wali Kelas</span>
            </button>
          </div>

          <div className="flex items-center space-x-4 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>READY</span>
            </span>
            <span>Total Rombel: {excelRows.length}</span>
            <span className="text-emerald-400 font-bold">
              Valid: {excelRows.filter((r) => r.statusValidation === 'VALID').length}
            </span>
            <span className="text-amber-400">
              Warning: {excelRows.filter((r) => r.statusValidation === 'WARNING').length}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
