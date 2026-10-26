import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { AppState, Siswa, NotificationLog } from '../../types';
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
  BookOpen,
} from 'lucide-react';

interface ExcelSiswaModalProps {
  appState: AppState;
  onClose: () => void;
  onUpdateSiswaList: (newList: Siswa[], notif: NotificationLog) => void;
}

export interface ExcelSiswaRow {
  id: string;
  nis: string;
  nisn: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  kodeKelas: string;
  agama: string;
  tempatLahir: string;
  tanggalLahir: string;
  status: 'Aktif' | 'Lulus' | 'Pindah' | 'Keluar';
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

export const ExcelSiswaModal: React.FC<ExcelSiswaModalProps> = ({
  appState,
  onClose,
  onUpdateSiswaList,
}) => {
  const [activeSheetTab, setActiveSheetTab] = useState<'DATA' | 'REF'>('DATA');
  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert current student list to Excel row format for preview/editing
  const convertSiswaToExcelRows = (list: Siswa[]): ExcelSiswaRow[] => {
    return list.map((s) => ({
      id: s.id,
      nis: s.nis || '',
      nisn: s.nisn || '',
      nama: s.nama || '',
      jenisKelamin: s.jenisKelamin || 'L',
      kodeKelas: s.kodeKelas || '7A',
      agama: s.agama || 'Islam',
      tempatLahir: s.tempatLahir || 'Jakarta',
      tanggalLahir: s.tanggalLahir || '2011-01-01',
      status: s.status || 'Aktif',
      statusValidation: 'VALID',
      validationMessage: 'Data terverifikasi',
    }));
  };

  const [excelRows, setExcelRows] = useState<ExcelSiswaRow[]>(() =>
    convertSiswaToExcelRows(appState.siswaList)
  );

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>({
    row: 0,
    col: 'D',
  });

  // Selected cell value for Formula Bar display
  const getSelectedCellValue = () => {
    if (!selectedCell || selectedCell.row < 0 || selectedCell.row >= excelRows.length) {
      return '=SISWA("KURIKULUM_MERDEKA")';
    }
    const row = excelRows[selectedCell.row];
    switch (selectedCell.col) {
      case 'A': return (selectedCell.row + 1).toString();
      case 'B': return row.nis;
      case 'C': return row.nisn;
      case 'D': return row.nama;
      case 'E': return row.jenisKelamin;
      case 'F': return row.kodeKelas;
      case 'G': return row.agama;
      case 'H': return row.tempatLahir;
      case 'I': return row.tanggalLahir;
      case 'J': return row.status;
      default: return '=CELL_VALUE()';
    }
  };

  // Cell Change Handler
  const handleCellChange = (rowIndex: number, field: keyof ExcelSiswaRow, value: any) => {
    setExcelRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [field]: value,
      };

      if (field === 'jenisKelamin') {
        const valUpper = value.toString().toUpperCase().trim();
        updated[rowIndex].jenisKelamin = valUpper.startsWith('P') ? 'P' : 'L';
      }

      if (field === 'kodeKelas' && value) {
        updated[rowIndex].kodeKelas = value.toString().toUpperCase().trim();
      }

      // Re-validate
      const row = updated[rowIndex];
      if (!row.nama || !row.nisn) {
        row.statusValidation = 'WARNING';
        row.validationMessage = 'Nama dan NISN wajib diisi!';
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
    const defaultKelas = appState.kelasList[0]?.kodeKelas || '7A';
    const newRow: ExcelSiswaRow = {
      id: 's-excel-' + Date.now(),
      nis: `25260${nextNum.toString().padStart(3, '0')}`,
      nisn: `011234${nextNum.toString().padStart(4, '0')}`,
      nama: `Siswa Baru ${nextNum}`,
      jenisKelamin: nextNum % 2 === 0 ? 'P' : 'L',
      kodeKelas: defaultKelas,
      agama: 'Islam',
      tempatLahir: 'Jakarta',
      tanggalLahir: '2012-05-15',
      status: 'Aktif',
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

    const ws = wb.addWorksheet('Data Siswa', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1B4F72' } },
    });

    const totalCols = 10;
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
    const row3 = ws.addRow(['FORMAT & REKAPITULASI RESMI DATA PESERTA DIDIK (DATA SISWA)']);
    ws.mergeCells(3, 1, 3, totalCols);
    row3.height = 22;
    row3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    row3.alignment = { vertical: 'middle', horizontal: 'center' };
    row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    // --- ROW 4: SEPARATOR ---
    ws.addRow([]).height = 8;

    // --- ROW 5 & 6: METADATA BANNER ---
    const lCount = excelRows.filter((r) => r.jenisKelamin === 'L').length;
    const pCount = excelRows.filter((r) => r.jenisKelamin === 'P').length;
    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const row5 = ws.addRow([
      `Tahun Ajaran: ${activeTA.tahun} - Semester ${activeTA.semester}`,
      '',
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
      '',
      `Total Siswa: ${excelRows.length} Orang (Laki-laki: ${lCount} | Perempuan: ${pCount})`,
    ]);
    row6.height = 20;
    row6.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } };
    row6.alignment = { vertical: 'middle' };

    ws.addRow([]).height = 8;

    // --- ROW 8: TABLE HEADERS ---
    const headerLabels = [
      'No',
      'NIS',
      'NISN',
      'Nama Lengkap Siswa',
      'Jenis Kelamin (L/P)',
      'Kelas / Rombel',
      'Agama',
      'Tempat Lahir',
      'Tanggal Lahir (YYYY-MM-DD)',
      'Status Siswa',
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

      if (colNumber <= 3) {
        // No, NIS, NISN: Dark Navy Blue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 6) {
        // Nama, JK, Kelas: Royal Blue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 9) {
        // Agama, Tempat Lahir, Tgl Lahir: Forest Green
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        // Status Siswa: Amber Orange
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    // --- DATA ROWS ---
    excelRows.forEach((r, idx) => {
      const dataRow = ws.addRow([
        idx + 1,
        r.nis,
        r.nisn,
        r.nama,
        r.jenisKelamin,
        r.kodeKelas,
        r.agama,
        r.tempatLahir,
        r.tanggalLahir,
        r.status,
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
          // No
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF64748B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 2 || colNumber === 3) {
          // NIS / NISN
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 4) {
          // Nama Siswa
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 5) {
          // JK
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF475569' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 6) {
          // Kelas
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFEFF6FF' : 'FFFFFFFF' } };
        } else if (colNumber === 7) {
          // Agama
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 8) {
          // Tempat Lahir
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 9) {
          // Tanggal Lahir
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else {
          // Status
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF0FDF4' : 'FFFFFFFF' } };
        }
      });
    });

    // Proportional Column Widths
    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'nis', width: 15 },
      { key: 'nisn', width: 18 },
      { key: 'nama', width: 36 },
      { key: 'jk', width: 20 },
      { key: 'kelas', width: 16 },
      { key: 'agama', width: 14 },
      { key: 'tempatLahir', width: 20 },
      { key: 'tanggalLahir', width: 24 },
      { key: 'status', width: 16 },
    ];

    // --- SHEET 2: PETUNJUK & PANDUAN IMPORT ---
    const wsHelp = wb.addWorksheet('Petunjuk Format', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1E8449' } },
    });

    const helpTitle = wsHelp.addRow(['PANDUAN & PETUNJUK FORMAT PENGISIAN DATA SISWA']);
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
      ['1', 'NISN', 'Wajib diisi 10 digit angka unik. Tidak boleh ada duplikasi antar siswa.'],
      ['2', 'NAMA LENGKAP SISWA', 'Wajib diisi nama lengkap peserta didik sesuai Akta Kelahiran / Ijazah SD.'],
      ['3', 'JENIS KELAMIN', 'Diisi L (Laki-laki) atau P (Perempuan).'],
      ['4', 'KELAS / ROMBEL', 'Diisi kode kelas yang terdaftar di sistem (Contoh: 7A, 7B, 8A, 8B, 9A, 9B).'],
      ['5', 'AGAMA', 'Diisi salah satu: Islam, Kristen, Katolik, Hindu, Buddha, atau Khonghucu.'],
      ['6', 'TEMPAT LAHIR', 'Diisi nama kota/kabupaten tempat kelahiran peserta didik.'],
      ['7', 'TANGGAL LAHIR', 'Format standar YYYY-MM-DD (Contoh: 2011-04-12).'],
      ['8', 'STATUS SISWA', 'Diisi salah satu: Aktif, Lulus, Pindah, atau Keluar (Default: Aktif).'],
    ];

    instructions.forEach((inst, idx) => {
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

    wsHelp.columns = [{ width: 6 }, { width: 25 }, { width: 80 }];

    // --- SHEET 3: REFERENSI KELAS ---
    const wsRefKelas = wb.addWorksheet('Referensi Kelas', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FFD35400' } },
    });

    const refTitle = wsRefKelas.addRow(['REFERENSI KODE KELAS & WALI KELAS YANG TERDAFTAR']);
    wsRefKelas.mergeCells(1, 1, 1, 4);
    refTitle.height = 24;
    refTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    refTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    refTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };

    wsRefKelas.addRow([]).height = 6;
    const refH = wsRefKelas.addRow(['No', 'Kode Kelas', 'Nama Kelas', 'Tingkat', 'Wali Kelas']);
    refH.height = 22;
    refH.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    refH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    appState.kelasList.forEach((k, i) => {
      const r = wsRefKelas.addRow([i + 1, k.kodeKelas, k.namaKelas, k.tingkat, k.waliKelasNama]);
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

    wsRefKelas.columns = [{ width: 6 }, { width: 16 }, { width: 22 }, { width: 12 }, { width: 32 }];

    const cleanSchool = (appState.sekolah?.namaSekolah || 'SMPN2_Kemranjen').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanTa = (activeTA.tahun || '2025-2026').replace(/\//g, '-');
    const fileName = `Export_Data_Siswa_${cleanSchool}_${cleanTa}.xlsx`;
    await saveWorkbook(wb, fileName);
  };

  // Download Sample Template .XLSX (Berwarna & Proporsional)
  const handleDownloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'e-Dafnil Assessment System';
    wb.lastModifiedBy = 'e-Dafnil Admin';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet('Template Data Siswa', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1B4F72' } },
    });

    const totalCols = 10;
    const kabName = appState.sekolah?.kabupatenKota?.toUpperCase() || 'BANYUMAS';
    const schName = appState.sekolah?.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN';

    // Kop
    const row1 = ws.addRow([`PEMERINTAH KABUPATEN ${kabName} - DINAS PENDIDIKAN`]);
    ws.mergeCells(1, 1, 1, totalCols);
    row1.height = 24;
    row1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row1.alignment = { vertical: 'middle', horizontal: 'center' };
    row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    const row2 = ws.addRow([`${schName} - TEMPLATE IMPORT DATA SISWA`]);
    ws.mergeCells(2, 1, 2, totalCols);
    row2.height = 28;
    row2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    row2.alignment = { vertical: 'middle', horizontal: 'center' };
    row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E80' } };

    const row3 = ws.addRow(['TEMPLATE FORMULIR ENTRI & IMPORT DATA PESERTA DIDIK (OFFLINE ENTRY)']);
    ws.mergeCells(3, 1, 3, totalCols);
    row3.height = 22;
    row3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    row3.alignment = { vertical: 'middle', horizontal: 'center' };
    row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    ws.addRow([]).height = 8;

    const row5 = ws.addRow([
      `Panduan: Isi baris data di bawah ini sesuai format. Jangan ubah nama kolom header.`,
      '',
      '',
      '',
      '',
      `Format Valid: NISN (10 Digit Angka), JK (L/P), Tgl Lahir (YYYY-MM-DD)`,
    ]);
    row5.height = 20;
    row5.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } };
    row5.alignment = { vertical: 'middle' };

    ws.addRow([]).height = 8;

    // Headers
    const headerLabels = [
      'No',
      'NIS',
      'NISN',
      'Nama Lengkap Siswa',
      'Jenis Kelamin (L/P)',
      'Kelas / Rombel',
      'Agama',
      'Tempat Lahir',
      'Tanggal Lahir (YYYY-MM-DD)',
      'Status Siswa',
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

      if (colNumber <= 3) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 6) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 9) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    // Sample data rows for template
    const sampleTemplateData = [
      { no: 1, nis: '23240901', nisn: '0089123401', nama: 'Aditya Pratama Putra', jk: 'L', kelas: '9A', agama: 'Islam', tempat: 'Jakarta', tgl: '2011-04-12', status: 'Aktif' },
      { no: 2, nis: '23240902', nisn: '0089123402', nama: 'Alysia Anindya Putri', jk: 'P', kelas: '9A', agama: 'Islam', tempat: 'Bandung', tgl: '2011-08-25', status: 'Aktif' },
      { no: 3, nis: '23240905', nisn: '0089123405', nama: 'David Dimas Wijaya', jk: 'L', kelas: '9A', agama: 'Kristen', tempat: 'Semarang', tgl: '2011-06-18', status: 'Aktif' },
      { no: 4, nis: '24250801', nisn: '0098765401', nama: 'Hafiz Al-Fikri', jk: 'L', kelas: '8A', agama: 'Islam', tempat: 'Jakarta', tgl: '2012-05-20', status: 'Aktif' },
      { no: 5, nis: '25260701', nisn: '0101122301', nama: 'Jonathan Kevin Prasetyo', jk: 'L', kelas: '7A', agama: 'Katolik', tempat: 'Jakarta', tgl: '2013-11-03', status: 'Aktif' },
    ];

    sampleTemplateData.forEach((s, idx) => {
      const dataRow = ws.addRow([
        s.no,
        s.nis,
        s.nisn,
        s.nama,
        s.jk,
        s.kelas,
        s.agama,
        s.tempat,
        s.tgl,
        s.status,
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
        } else if (colNumber === 2 || colNumber === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 4) {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF475569' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFEFF6FF' : 'FFFFFFFF' } };
        } else if (colNumber === 7) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 9) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF0FDF4' : 'FFFFFFFF' } };
        }
      });
    });

    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'nis', width: 15 },
      { key: 'nisn', width: 18 },
      { key: 'nama', width: 36 },
      { key: 'jk', width: 20 },
      { key: 'kelas', width: 16 },
      { key: 'agama', width: 14 },
      { key: 'tempatLahir', width: 20 },
      { key: 'tanggalLahir', width: 24 },
      { key: 'status', width: 16 },
    ];

    // Sheet 2: Petunjuk Format
    const wsHelp = wb.addWorksheet('Petunjuk Format', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1E8449' } },
    });

    const helpTitle = wsHelp.addRow(['PANDUAN & PETUNJUK FORMAT PENGISIAN DATA SISWA']);
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
      ['1', 'NISN', 'Wajib diisi 10 digit angka unik. Tidak boleh ada duplikasi antar siswa.'],
      ['2', 'NAMA LENGKAP SISWA', 'Wajib diisi nama lengkap peserta didik sesuai Akta Kelahiran / Ijazah SD.'],
      ['3', 'JENIS KELAMIN', 'Diisi L (Laki-laki) atau P (Perempuan).'],
      ['4', 'KELAS / ROMBEL', 'Diisi kode kelas yang terdaftar di sistem (Contoh: 7A, 7B, 8A, 8B, 9A, 9B).'],
      ['5', 'AGAMA', 'Diisi salah satu: Islam, Kristen, Katolik, Hindu, Buddha, atau Khonghucu.'],
      ['6', 'TEMPAT LAHIR', 'Diisi nama kota/kabupaten tempat kelahiran peserta didik.'],
      ['7', 'TANGGAL LAHIR', 'Format standar YYYY-MM-DD (Contoh: 2011-04-12).'],
      ['8', 'STATUS SISWA', 'Diisi salah satu: Aktif, Lulus, Pindah, atau Keluar (Default: Aktif).'],
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
    wsHelp.columns = [{ width: 6 }, { width: 25 }, { width: 80 }];

    // Sheet 3: Referensi Kelas
    const wsRefKelas = wb.addWorksheet('Referensi Kelas', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FFD35400' } },
    });
    const refTitle = wsRefKelas.addRow(['REFERENSI KODE KELAS & WALI KELAS YANG TERDAFTAR']);
    wsRefKelas.mergeCells(1, 1, 1, 5);
    refTitle.height = 24;
    refTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    refTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    refTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };

    wsRefKelas.addRow([]).height = 6;
    const refH = wsRefKelas.addRow(['No', 'Kode Kelas', 'Nama Kelas', 'Tingkat', 'Wali Kelas']);
    refH.height = 22;
    refH.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    refH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    appState.kelasList.forEach((k, i) => {
      const r = wsRefKelas.addRow([i + 1, k.kodeKelas, k.namaKelas, k.tingkat, k.waliKelasNama]);
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
    wsRefKelas.columns = [{ width: 6 }, { width: 16 }, { width: 22 }, { width: 12 }, { width: 32 }];

    const cleanSchool = (appState.sekolah?.namaSekolah || 'SMPN2_Kemranjen').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Template_Import_Data_Siswa_${cleanSchool}.xlsx`;
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

        // Search for header row containing NISN or Nama or NIS
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(15, rawData.length); i++) {
          const rowStr = JSON.stringify(rawData[i] || []).toLowerCase();
          if (rowStr.includes('nisn') || (rowStr.includes('nama') && (rowStr.includes('siswa') || rowStr.includes('lengkap')))) {
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
          alert('File Excel tidak memiliki baris data siswa yang valid!');
          return;
        }

        // Map parsed Excel JSON into ExcelSiswaRow structure
        const parsedRows: ExcelSiswaRow[] = jsonData.map((row, idx) => {
          const nis = (
            row['NIS'] ||
            row['nis'] ||
            row['NIS LOKAL'] ||
            ''
          ).toString().trim();

          const nisn = (
            row['NISN'] ||
            row['nisn'] ||
            ''
          ).toString().trim();

          const nama = (
            row['Nama Lengkap Siswa'] ||
            row['NAMA LENGKAP SISWA'] ||
            row['NAMA SISWA'] ||
            row['Nama Siswa'] ||
            row['NAMA LENGKAP'] ||
            row['NAMA'] ||
            row['nama'] ||
            ''
          ).toString().trim();

          const rawJK = (
            row['Jenis Kelamin (L/P)'] ||
            row['JENIS KELAMIN (L/P)'] ||
            row['JENIS KELAMIN'] ||
            row['Jenis Kelamin'] ||
            row['JK'] ||
            row['jk'] ||
            'L'
          ).toString().toUpperCase().trim();
          const jenisKelamin: 'L' | 'P' = rawJK.startsWith('P') ? 'P' : 'L';

          const kodeKelas = (
            row['Kelas / Rombel'] ||
            row['KELAS / ROMBEL'] ||
            row['KELAS'] ||
            row['Kelas'] ||
            row['ROMBEL'] ||
            row['kode_kelas'] ||
            row['kodeKelas'] ||
            '7A'
          ).toString().toUpperCase().trim();

          const agama = (
            row['Agama'] ||
            row['AGAMA'] ||
            row['agama'] ||
            'Islam'
          ).toString().trim();

          const tempatLahir = (
            row['Tempat Lahir'] ||
            row['TEMPAT LAHIR'] ||
            row['tempat_lahir'] ||
            row['tempatLahir'] ||
            'Jakarta'
          ).toString().trim();

          const tanggalLahir = (
            row['Tanggal Lahir (YYYY-MM-DD)'] ||
            row['TANGGAL LAHIR (YYYY-MM-DD)'] ||
            row['TANGGAL LAHIR'] ||
            row['Tanggal Lahir'] ||
            row['tanggal_lahir'] ||
            row['tanggalLahir'] ||
            '2011-01-01'
          ).toString().trim();

          const rawStatus = (
            row['Status Siswa'] ||
            row['STATUS SISWA'] ||
            row['STATUS'] ||
            row['status'] ||
            'Aktif'
          ).toString().trim();
          let status: 'Aktif' | 'Lulus' | 'Pindah' | 'Keluar' = 'Aktif';
          if (['Lulus', 'Pindah', 'Keluar'].includes(rawStatus)) {
            status = rawStatus as any;
          }

          const isDuplicate = appState.siswaList.some(
            (s) => s.nisn === nisn && nisn !== ''
          );

          let statusValidation: 'VALID' | 'WARNING' | 'DUPLICATE' = 'VALID';
          let validationMessage = 'Siap diimpor';

          if (!nama || !nisn) {
            statusValidation = 'WARNING';
            validationMessage = 'Nama atau NISN kosong';
          } else if (isDuplicate) {
            statusValidation = 'DUPLICATE';
            validationMessage = 'NISN sudah terdaftar di database';
          }

          return {
            id: 's-imp-' + idx + '-' + Date.now(),
            nis,
            nisn,
            nama,
            jenisKelamin,
            kodeKelas,
            agama: agama || 'Islam',
            tempatLahir: tempatLahir || 'Jakarta',
            tanggalLahir: tanggalLahir || '2011-01-01',
            status,
            statusValidation,
            validationMessage,
          };
        });

        setExcelRows(parsedRows);
        alert(
          `Berhasil membaca ${parsedRows.length} baris data siswa dari file Excel "${file.name}"! Silakan periksa di lembar kerja Excel.`
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

    const convertedSiswaList: Siswa[] = excelRows.map((r) => {
      // Find matching class ID in appState.kelasList or pick first
      const foundKelas = appState.kelasList.find(
        (k) => k.kodeKelas.toUpperCase() === r.kodeKelas.toUpperCase()
      );
      const kelasId = foundKelas ? foundKelas.id : appState.kelasList[0]?.id || 'k-7a';
      const kodeKelas = foundKelas ? foundKelas.kodeKelas : r.kodeKelas || '7A';

      return {
        id: r.id || 's-' + Math.random().toString(36).substring(2, 9),
        nis: r.nis || '',
        nisn: r.nisn || `00${Math.floor(10000000 + Math.random() * 90000000)}`,
        nama: r.nama || 'Siswa Tanpa Nama',
        jenisKelamin: r.jenisKelamin || 'L',
        kelasId,
        kodeKelas,
        agama: r.agama || 'Islam',
        tempatLahir: r.tempatLahir || 'Jakarta',
        tanggalLahir: r.tanggalLahir || '2011-01-01',
        status: r.status || 'Aktif',
      };
    });

    let finalSiswaList: Siswa[] = [];
    if (importMode === 'REPLACE') {
      finalSiswaList = convertedSiswaList;
    } else {
      // MERGE: Update by NISN or append
      const existingMap = new Map<string, Siswa>();
      appState.siswaList.forEach((s) => existingMap.set(s.nisn, s));
      convertedSiswaList.forEach((s) => existingMap.set(s.nisn, s));
      finalSiswaList = Array.from(existingMap.values());
    }

    const notif = createNotification(
      'Import Data Siswa Excel',
      `Berhasil memperbarui data siswa dari Excel (${convertedSiswaList.length} siswa diproses).`,
      'data-siswa'
    );

    onUpdateSiswaList(finalSiswaList, notif);
    alert(`Sukses! ${convertedSiswaList.length} data siswa dari Excel telah berhasil disimpan ke dalam sistem.`);
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
                  Microsoft Excel — Modul Import & Export Data Siswa
                </span>
                <span className="bg-emerald-800 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-600">
                  Live Spreadsheet Engine
                </span>
              </div>
              <p className="text-[11px] text-emerald-100 opacity-90">
                DATA_SISWA_SIMPEGUR_2025_2026.xlsx • {excelRows.length} Baris Data Siswa
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
              <span>Tambah Baris Siswa</span>
            </button>

            <button
              onClick={() => setExcelRows(convertSiswaToExcelRows(appState.siswaList))}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg border border-slate-600 flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Reset ke Data Siswa Saat Ini"
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
                  name="importModeSiswa"
                  checked={importMode === 'MERGE'}
                  onChange={() => setImportMode('MERGE')}
                  className="accent-emerald-500"
                />
                <span className={importMode === 'MERGE' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  Gabung / Timpa NISN
                </span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer ml-2">
                <input
                  type="radio"
                  name="importModeSiswa"
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
            <div className="min-w-[1000px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-inner font-sans text-xs">
              <table className="w-full border-collapse">
                <thead>
                  {/* EXCEL COLUMN HEADERS (A, B, C...) */}
                  <tr className="bg-slate-800 text-slate-400 text-[11px] font-bold border-b border-slate-700">
                    <th className="w-10 border-r border-slate-700 p-1 text-center bg-slate-850">#</th>
                    <th className="w-10 border-r border-slate-700 p-1 text-center">A</th>
                    <th className="w-28 border-r border-slate-700 p-1 text-center">B (NIS)</th>
                    <th className="w-32 border-r border-slate-700 p-1 text-center">C (NISN)</th>
                    <th className="w-60 border-r border-slate-700 p-1 text-center">D (Nama Lengkap)</th>
                    <th className="w-20 border-r border-slate-700 p-1 text-center">E (JK)</th>
                    <th className="w-24 border-r border-slate-700 p-1 text-center">F (Kelas)</th>
                    <th className="w-28 border-r border-slate-700 p-1 text-center">G (Agama)</th>
                    <th className="w-32 border-r border-slate-700 p-1 text-center">H (Tmp Lahir)</th>
                    <th className="w-32 border-r border-slate-700 p-1 text-center">I (Tgl Lahir)</th>
                    <th className="w-24 border-r border-slate-700 p-1 text-center">J (Status)</th>
                    <th className="w-24 border-r border-slate-700 p-1 text-center">Status</th>
                    <th className="w-12 p-1 text-center">Hapus</th>
                  </tr>

                  {/* EXCEL SHEET HEADER ROW 1 */}
                  <tr className="bg-[#107c41] text-white font-extrabold text-xs border-b border-emerald-800 shadow-sm">
                    <td className="border-r border-emerald-800 p-2 text-center bg-emerald-900 text-emerald-200 font-mono">1</td>
                    <td className="border-r border-emerald-800 p-2 text-center">No</td>
                    <td className="border-r border-emerald-800 p-2">NIS</td>
                    <td className="border-r border-emerald-800 p-2">NISN *</td>
                    <td className="border-r border-emerald-800 p-2">Nama Lengkap Siswa *</td>
                    <td className="border-r border-emerald-800 p-2 text-center">JK (L/P)</td>
                    <td className="border-r border-emerald-800 p-2 text-center">Rombel Kelas</td>
                    <td className="border-r border-emerald-800 p-2">Agama</td>
                    <td className="border-r border-emerald-800 p-2">Tempat Lahir</td>
                    <td className="border-r border-emerald-800 p-2">Tanggal Lahir</td>
                    <td className="border-r border-emerald-800 p-2 text-center">Status</td>
                    <td className="border-r border-emerald-800 p-2 text-center">Validasi</td>
                    <td className="p-2 text-center">Aksi</td>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                  {excelRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="p-8 text-center text-slate-500 italic">
                        Belum ada data siswa. Klik "Tambah Baris Siswa" atau "Import .XLSX" untuk memulai.
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

                          {/* Column B: NIS */}
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
                              value={row.nis}
                              onChange={(e) => handleCellChange(idx, 'nis', e.target.value)}
                              placeholder="23240901"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-slate-300 font-mono focus:outline-hidden"
                            />
                          </td>

                          {/* Column C: NISN */}
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
                              value={row.nisn}
                              onChange={(e) => handleCellChange(idx, 'nisn', e.target.value)}
                              placeholder="0089123401"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-blue-400 font-mono font-bold focus:outline-hidden"
                            />
                          </td>

                          {/* Column D: Nama Lengkap */}
                          <td
                            className={`border-r border-slate-800 p-1 ${
                              selectedCell?.row === idx && selectedCell?.col === 'D'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'D' })}
                          >
                            <input
                              type="text"
                              value={row.nama}
                              onChange={(e) => handleCellChange(idx, 'nama', e.target.value)}
                              placeholder="Nama Siswa"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-white font-sans font-bold focus:outline-hidden"
                            />
                          </td>

                          {/* Column E: JK (L/P) */}
                          <td
                            className={`border-r border-slate-800 p-1 text-center ${
                              selectedCell?.row === idx && selectedCell?.col === 'E'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'E' })}
                          >
                            <select
                              value={row.jenisKelamin}
                              onChange={(e) => handleCellChange(idx, 'jenisKelamin', e.target.value)}
                              className="bg-transparent text-amber-300 font-bold focus:outline-hidden cursor-pointer"
                            >
                              <option value="L" className="bg-slate-900 text-white">L</option>
                              <option value="P" className="bg-slate-900 text-white">P</option>
                            </select>
                          </td>

                          {/* Column F: Kode Kelas */}
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
                              value={row.kodeKelas}
                              onChange={(e) => handleCellChange(idx, 'kodeKelas', e.target.value)}
                              placeholder="7A, 8B, 9A"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-center text-emerald-300 font-mono font-bold focus:outline-hidden"
                            />
                          </td>

                          {/* Column G: Agama */}
                          <td
                            className={`border-r border-slate-800 p-1 ${
                              selectedCell?.row === idx && selectedCell?.col === 'G'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'G' })}
                          >
                            <input
                              type="text"
                              value={row.agama}
                              onChange={(e) => handleCellChange(idx, 'agama', e.target.value)}
                              placeholder="Islam, Kristen..."
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-purple-300 font-sans font-medium focus:outline-hidden"
                            />
                          </td>

                          {/* Column H: Tempat Lahir */}
                          <td
                            className={`border-r border-slate-800 p-1 ${
                              selectedCell?.row === idx && selectedCell?.col === 'H'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'H' })}
                          >
                            <input
                              type="text"
                              value={row.tempatLahir}
                              onChange={(e) => handleCellChange(idx, 'tempatLahir', e.target.value)}
                              placeholder="Jakarta"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-slate-300 font-sans focus:outline-hidden"
                            />
                          </td>

                          {/* Column I: Tanggal Lahir */}
                          <td
                            className={`border-r border-slate-800 p-1 ${
                              selectedCell?.row === idx && selectedCell?.col === 'I'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'I' })}
                          >
                            <input
                              type="text"
                              value={row.tanggalLahir}
                              onChange={(e) => handleCellChange(idx, 'tanggalLahir', e.target.value)}
                              placeholder="2011-04-12"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-slate-300 font-mono focus:outline-hidden"
                            />
                          </td>

                          {/* Column J: Status */}
                          <td
                            className={`border-r border-slate-800 p-1 text-center ${
                              selectedCell?.row === idx && selectedCell?.col === 'J'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'J' })}
                          >
                            <select
                              value={row.status}
                              onChange={(e) => handleCellChange(idx, 'status', e.target.value)}
                              className="bg-transparent text-xs font-bold focus:outline-hidden cursor-pointer"
                            >
                              <option value="Aktif" className="bg-slate-900 text-emerald-400">Aktif</option>
                              <option value="Lulus" className="bg-slate-900 text-blue-400">Lulus</option>
                              <option value="Pindah" className="bg-slate-900 text-amber-400">Pindah</option>
                              <option value="Keluar" className="bg-slate-900 text-rose-400">Keluar</option>
                            </select>
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
                              title="Hapus baris siswa ini"
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
            /* PETUNJUK FORMAT SHEET VIEW */
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4 text-xs">
              <h4 className="font-bold text-emerald-400 text-sm flex items-center space-x-2">
                <BookOpen size={16} />
                <span>Petunjuk Format Import Excel Data Siswa</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-white text-xs block">1. Kolom NISN & Nama Siswa *</span>
                  <p className="text-slate-400 leading-relaxed">
                    Wajib diisi. NISN merupakan 10 digit nomor induk siswa nasional unik yang menjadi kunci utama identifikasi siswa.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-white text-xs block">2. Kolom Jenis Kelamin & Kelas</span>
                  <p className="text-slate-400 leading-relaxed">
                    Jenis Kelamin diisi <code className="text-amber-300 font-mono">L</code> (Laki-laki) atau <code className="text-amber-300 font-mono">P</code> (Perempuan). Kelas diisi sesuai Kode Rombel di sistem (misal: <code className="text-emerald-300 font-mono">7A</code>, <code className="text-emerald-300 font-mono">8A</code>, <code className="text-emerald-300 font-mono">9A</code>).
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-white text-xs block">3. Kolom Agama & Tempat/Tgl Lahir</span>
                  <p className="text-slate-400 leading-relaxed">
                    Agama diisi nama agama (Islam, Kristen, Katolik, Hindu, Buddha, Khonghucu). Tanggal Lahir dengan format <code className="text-blue-300 font-mono">YYYY-MM-DD</code> (contoh: 2011-04-12).
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-white text-xs block">4. Kolom Status</span>
                  <p className="text-slate-400 leading-relaxed">
                    Status peserta didik diisi: <span className="text-emerald-400 font-bold">Aktif</span>, <span className="text-blue-400 font-bold">Lulus</span>, <span className="text-amber-400 font-bold">Pindah</span>, atau <span className="text-rose-400 font-bold">Keluar</span>.
                  </p>
                </div>
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
              <span>📊 Sheet1: Data Siswa</span>
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
              <span>⚙️ Sheet2: Petunjuk Format</span>
            </button>
          </div>

          <div className="flex items-center space-x-4 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>READY</span>
            </span>
            <span>Total Siswa: {excelRows.length}</span>
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
