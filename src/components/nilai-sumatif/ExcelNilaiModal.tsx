import React, { useState, useRef, useMemo } from 'react';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { AppState, AuthUser, Guru, Siswa, Mapel, Kelas, NotificationLog } from '../../types';
import { createNotification } from '../../lib/storage';
import { getAgamaBadge } from './InputNilai';
import {
  FileSpreadsheet,
  Download,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Layers,
  Save,
  BookOpen,
  Info,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  Filter,
  Users,
} from 'lucide-react';

interface ExcelNilaiRow {
  siswaId: string;
  nisn: string;
  nama: string;
  jenisKelamin?: string;
  agama: string;
  tps: number[];
  sts: number;
  sas: number;
  statusValidation: 'VALID' | 'WARNING' | 'NOT_FOUND';
  validationMessage: string;
}

interface ExcelNilaiModalProps {
  appState: AppState;
  authUser?: AuthUser | null;
  allowedMapelIds?: string[];
  currentGuru?: Guru | null;
  selectedKelasId: string;
  selectedMapelId: string;
  jumlahSumatif: number;
  bobotS: number;
  bobotSTS: number;
  bobotSAS: number;
  currentGridData: Record<
    string,
    { tps: number[]; sts: number; sas: number }
  >;
  initialAgamaFilter?: string;
  onClose: () => void;
  onApplyImport: (
    importedData: Record<
      string,
      { tps: number[]; sts: number; sas: number }
    >,
    importedJumlahSumatif?: number
  ) => void;
}

export const ExcelNilaiModal: React.FC<ExcelNilaiModalProps> = ({
  appState,
  authUser,
  allowedMapelIds,
  currentGuru,
  selectedKelasId,
  selectedMapelId,
  jumlahSumatif,
  bobotS,
  bobotSTS,
  bobotSAS,
  currentGridData,
  initialAgamaFilter = 'ALL',
  onClose,
  onApplyImport,
}) => {
  const [activeTab, setActiveTab] = useState<'EXPORT' | 'IMPORT' | 'PREVIEW'>('EXPORT');
  const [selectedAgamaFilter, setSelectedAgamaFilter] = useState<string>(initialAgamaFilter);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGuru = authUser?.role === 'guru';
  const selectedKelas = appState.kelasList.find((k) => k.id === selectedKelasId);
  const selectedMapel = appState.mapelList.find((m) => m.id === selectedMapelId);
  const activeTA = appState.tahunAjaranList.find(
    (t) => t.id === appState.activeTahunAjaranId
  ) || appState.tahunAjaranList[0];

  const studentsInClass = useMemo(
    () =>
      appState.siswaList
        .filter((s) => s.kelasId === selectedKelasId)
        .sort((a, b) => a.nama.localeCompare(b.nama)),
    [appState.siswaList, selectedKelasId]
  );

  // Perhitungan statistik agama di kelas
  const agamaStats = useMemo(() => {
    const counts: Record<string, number> = {};
    studentsInClass.forEach((s) => {
      const ag = (s.agama || 'Islam').trim();
      counts[ag] = (counts[ag] || 0) + 1;
    });
    return counts;
  }, [studentsInClass]);

  const distinctAgamas = Object.keys(agamaStats);
  const hasMultipleAgama = distinctAgamas.length > 1;

  // Cek apakah mata pelajaran adalah mata pelajaran agama
  const isMapelAgama = Boolean(
    selectedMapel &&
      (selectedMapel.namaMapel.toLowerCase().includes('agama') ||
        selectedMapel.namaMapel.toLowerCase().includes('budi pekerti') ||
        selectedMapel.kodeMapel.toLowerCase() === 'pai' ||
        selectedMapel.kodeMapel.toLowerCase() === 'pak')
  );

  // Siswa target untuk export / template berdasarkan filter agama
  const targetStudents = useMemo(() => {
    if (selectedAgamaFilter === 'ALL') return studentsInClass;
    return studentsInClass.filter(
      (s) => (s.agama || 'Islam').trim().toLowerCase() === selectedAgamaFilter.toLowerCase()
    );
  }, [studentsInClass, selectedAgamaFilter]);

  // Initialize preview state from current grid
  const convertGridToExcelRows = (): ExcelNilaiRow[] => {
    return targetStudents.map((s) => {
      const g = currentGridData[s.id] || {
        tps: Array(jumlahSumatif).fill(80),
        sts: 80,
        sas: 80,
      };
      return {
        siswaId: s.id,
        nisn: s.nisn || '',
        nama: s.nama || '',
        jenisKelamin: s.jenisKelamin || 'L',
        agama: s.agama || 'Islam',
        tps: g.tps.length === jumlahSumatif ? g.tps : Array(jumlahSumatif).fill(80),
        sts: g.sts ?? 80,
        sas: g.sas ?? 80,
        statusValidation: 'VALID',
        validationMessage: 'Data terverifikasi',
      };
    });
  };

  const [previewRows, setPreviewRows] = useState<ExcelNilaiRow[]>(convertGridToExcelRows);
  const [importedSumatifCount, setImportedSumatifCount] = useState<number>(jumlahSumatif);

  // Helper to save ExcelJS Workbook in browser
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

  // =========================================================================
  // 1. EXPORT DATA NILAI SAAT INI (COLORED, PROPORTIONAL, LENGKAP AGAMA SISWA)
  // =========================================================================
  const handleExportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'e-Dafnil Assessment System';
    wb.lastModifiedBy = 'e-Dafnil Assessment System';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet(`Nilai ${selectedKelas?.kodeKelas || 'Kelas'}`, {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1B4F72' } },
    });

    const totalCols = 6 + jumlahSumatif + 2; // No, NISN, NIS, Nama, L/P, Agama + S1..SN + STS + SAS

    // --- ROW 1: HEADER DINAS ---
    const row1 = ws.addRow([`PEMERINTAH KABUPATEN ${appState.sekolah.kabupatenKota?.toUpperCase() || 'BANYUMAS'} - DINAS PENDIDIKAN`]);
    ws.mergeCells(1, 1, 1, totalCols);
    row1.height = 24;
    row1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row1.alignment = { vertical: 'middle', horizontal: 'center' };
    row1.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F3D64' },
    };

    // --- ROW 2: NAMA SEKOLAH ---
    const row2 = ws.addRow([`${appState.sekolah.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN'} - SISTEM e-DAFNIL`]);
    ws.mergeCells(2, 1, 2, totalCols);
    row2.height = 28;
    row2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    row2.alignment = { vertical: 'middle', horizontal: 'center' };
    row2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF164E80' },
    };

    // --- ROW 3: JUDUL DOKUMEN ---
    const row3 = ws.addRow(['FORMAT ENTRI & REKAPITULASI NILAI SUMATIF SISWA']);
    ws.mergeCells(3, 1, 3, totalCols);
    row3.height = 22;
    row3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    row3.alignment = { vertical: 'middle', horizontal: 'center' };
    row3.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    // --- ROW 4: EMPTY SEPARATOR ---
    const row4 = ws.addRow([]);
    row4.height = 8;

    // --- ROW 5: METADATA ROW 1 (MATA PELAJARAN & KELAS) ---
    const row5 = ws.addRow([]);
    row5.height = 24;

    // Left Box: Mata Pelajaran (Cols 1 to 4)
    ws.mergeCells(5, 1, 5, 4);
    const cellMapel = ws.getCell(5, 1);
    cellMapel.value = `Mata Pelajaran: ${selectedMapel?.namaMapel || 'Semua Mata Pelajaran'} (${selectedMapel?.kodeMapel || '-'})`;
    cellMapel.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    cellMapel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Right Box: Kelas & Wali (Cols 5 to totalCols)
    ws.mergeCells(5, 5, 5, totalCols);
    const cellKelas = ws.getCell(5, 5);
    cellKelas.value = `Kelas: ${selectedKelas?.namaKelas || '-'} (Wali Kelas: ${selectedKelas?.waliKelasNama || '-'})`;
    cellKelas.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cellKelas.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Fill & Border for Row 5
    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(5, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: c === 1 || c === 5 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        right: c === 4 || c === totalCols ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
      };
    }

    // --- ROW 6: METADATA ROW 2 (TAHUN AJARAN & INFO TARGET) ---
    const row6 = ws.addRow([]);
    row6.height = 24;
    const filterAgamaText = selectedAgamaFilter === 'ALL' ? 'Semua Agama' : `Khusus Agama ${selectedAgamaFilter}`;

    // Left Box: Tahun Ajaran & Semester (Cols 1 to 4)
    ws.mergeCells(6, 1, 6, 4);
    const cellTA = ws.getCell(6, 1);
    cellTA.value = `Tahun Ajaran: ${activeTA.tahun}  |  Semester: ${activeTA.semester}`;
    cellTA.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF334155' } };
    cellTA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Right Box: Jumlah Siswa & Kolom Sumatif (Cols 5 to totalCols)
    ws.mergeCells(6, 5, 6, totalCols);
    const cellInfo = ws.getCell(6, 5);
    cellInfo.value = `Jumlah Siswa: ${targetStudents.length} Orang  |  Target: ${filterAgamaText}  |  Banyaknya Sumatif: ${jumlahSumatif} Kolom`;
    cellInfo.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
    cellInfo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Fill & Border for Row 6
    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(6, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: c === 1 || c === 5 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        right: c === 4 || c === totalCols ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
      };
    }

    // --- ROW 7: EMPTY SEPARATOR ---
    const row7 = ws.addRow([]);
    row7.height = 8;

    // --- ROW 8: TABLE HEADERS (NO, NISN, NIS, NAMA, L/P, AGAMA, S1..SN, STS, SAS) ---
    const headerLabels = [
      'No',
      'NISN',
      'NIS',
      'Nama Siswa',
      'L/P',
      'Agama',
      ...Array.from({ length: jumlahSumatif }, (_, i) => `Sumatif ${i + 1} (S${i + 1})`),
      'STS',
      'SAS',
    ];

    const headerRow = ws.addRow(headerLabels);
    headerRow.height = 30;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Header Cell Colors
    headerRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F3D64' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0F3D64' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      if (colNumber <= 6) {
        // Identity columns (including Agama): Dark Navy
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 6 + jumlahSumatif) {
        // Sumatif columns: Royal Blue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber === 6 + jumlahSumatif + 1) {
        // STS: Emerald Green
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        // SAS: Amber Orange
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    // --- DATA ROWS ---
    const startDataRow = 9;
    targetStudents.forEach((s, idx) => {
      const g = currentGridData[s.id] || {
        tps: Array(jumlahSumatif).fill(80),
        sts: 80,
        sas: 80,
      };
      const tps = g.tps.length === jumlahSumatif ? g.tps : Array(jumlahSumatif).fill(80);

      const rowValues = [
        idx + 1,
        s.nisn || '',
        s.nis || '',
        s.nama || '',
        s.jenisKelamin || 'L',
        s.agama || 'Islam',
        ...tps,
        g.sts ?? 80,
        g.sas ?? 80,
      ];

      const dataRow = ws.addRow(rowValues);
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
          // NISN / NIS
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 4) {
          // Nama Siswa
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 5) {
          // L/P
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF475569' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 6) {
          // Agama
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F3D64' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF1F5F9' : 'FFF8FAFC' } };
        } else if (colNumber <= 6 + jumlahSumatif) {
          // S1..SN
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFEFF6FF' : 'FFF8FAFC' } };
        } else if (colNumber === 6 + jumlahSumatif + 1) {
          // STS
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF0FDF4' : 'FFFFFFFF' } };
        } else {
          // SAS
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF9A3412' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFF7ED' : 'FFFFFFFF' } };
        }
      });
    });

    const lastDataRow = startDataRow + targetStudents.length - 1;

    // --- FOOTER ROW: RATA-RATA KELAS ---
    if (targetStudents.length > 0) {
      const avgRowValues: any[] = ['RATA-RATA KELAS', '', '', '', '', ''];
      for (let i = 1; i <= jumlahSumatif + 2; i++) {
        const colLetter = ws.getColumn(6 + i).letter;
        avgRowValues.push({ formula: `AVERAGE(${colLetter}${startDataRow}:${colLetter}${lastDataRow})` });
      }

      const avgRow = ws.addRow(avgRowValues);
      ws.mergeCells(lastDataRow + 1, 1, lastDataRow + 1, 6);
      avgRow.height = 24;

      avgRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF0F3D64' } },
          bottom: { style: 'medium', color: { argb: 'FF0F3D64' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.numFmt = '0.00';
        }
      });
    }

    // --- PROPORTIONAL COLUMN WIDTHS ---
    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'nisn', width: 16 },
      { key: 'nis', width: 13 },
      { key: 'nama', width: 36 },
      { key: 'lp', width: 8 },
      { key: 'agama', width: 15 },
      ...Array.from({ length: jumlahSumatif }, (_, i) => ({
        key: `s${i + 1}`,
        width: 16,
      })),
      { key: 'sts', width: 14 },
      { key: 'sas', width: 14 },
    ];

    // =========================================================================
    // SHEET 2: PETUNJUK PENGISIAN & PANDUAN GURU
    // =========================================================================
    const wsHelp = wb.addWorksheet('Petunjuk & Panduan', {
      properties: { tabColor: { argb: 'FF1E8449' } },
    });

    const h1 = wsHelp.addRow(['PETUNJUK PENGISIAN NILAI SUMATIF OFFLINE (MS EXCEL)']);
    wsHelp.mergeCells('A1:D1');
    h1.height = 26;
    h1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
    h1.alignment = { vertical: 'middle', horizontal: 'center' };

    wsHelp.addRow([]);
    const guidelines = [
      ['1.', 'Kolom Identitas & Agama', 'Kolom NISN, Nama, L/P, dan Agama memuat identitas siswa yang diajar. Jangan mengubah NISN agar sinkronisasi impor berjalan presisi.'],
      ['2.', 'Siswa Berbeda Agama', 'Bagi Guru Mata Pelajaran Pendidikan Agama (Islam, Kristen, Katolik, dll.), Anda dapat memanfaatkan fitur Filter Agama untuk mengunduh template atau merekap nilai hanya untuk siswa yang Anda ajar.'],
      ['3.', 'Nilai Sumatif (S1..SN)', 'Isikan nilai Sumatif Lingkup Materi / TP dengan rentang angka bulat atau desimal (0 s.d. 100).'],
      ['4.', 'Nilai STS & SAS', 'Isikan nilai Sumatif Tengah Semester (STS) dan Sumatif Akhir Semester (SAS) dengan rentang 0 s.d. 100.'],
      ['5.', 'Perhitungan Otomatis', 'Perhitungan Rerata Sumatif dan Nilai Akhir (NA) akan dihitung secara otomatis oleh sistem saat berkas Excel diimpor kembali.'],
      ['6.', 'Proses Impor Berkas', 'Setelah selesai mengisi secara offline, unggah berkas melalui Tab "Import Berkas Excel" di aplikasi e-Dafnil.'],
    ];

    guidelines.forEach(([num, title, desc]) => {
      const r = wsHelp.addRow([num, title, desc]);
      r.height = 24;
      r.getCell(1).font = { bold: true, color: { argb: 'FF1E40AF' } };
      r.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(3).font = { color: { argb: 'FF334155' } };
      r.alignment = { vertical: 'middle' };
    });

    wsHelp.columns = [
      { width: 6 },
      { width: 25 },
      { width: 80 },
    ];

    const agamaSuffix = selectedAgamaFilter !== 'ALL' ? `_${selectedAgamaFilter}` : '';
    const fileName = `Nilai_Sumatif_${selectedKelas?.kodeKelas || 'Kelas'}_${selectedMapel?.kodeMapel || 'Mapel'}${agamaSuffix}.xlsx`;
    await saveWorkbook(wb, fileName);
  };

  // =========================================================================
  // 2. DOWNLOAD TEMPLATE EXCEL KOSONG (BERWARNA & PROPORSIONAL, LENGKAP AGAMA)
  // =========================================================================
  const handleDownloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'e-Dafnil Assessment System';
    wb.lastModifiedBy = 'e-Dafnil Assessment System';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet(`Template Nilai ${selectedKelas?.kodeKelas || 'Kelas'}`, {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF2874A6' } },
    });

    const totalCols = 6 + jumlahSumatif + 2;

    // Header Title
    const row1 = ws.addRow([`PEMERINTAH KABUPATEN ${appState.sekolah.kabupatenKota?.toUpperCase() || 'BANYUMAS'} - DINAS PENDIDIKAN`]);
    ws.mergeCells(1, 1, 1, totalCols);
    row1.height = 24;
    row1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row1.alignment = { vertical: 'middle', horizontal: 'center' };
    row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    const row2 = ws.addRow([`${appState.sekolah.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN'} - TEMPLATE INPUT NILAI`]);
    ws.mergeCells(2, 1, 2, totalCols);
    row2.height = 28;
    row2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    row2.alignment = { vertical: 'middle', horizontal: 'center' };
    row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E80' } };

    const row3 = ws.addRow(['TEMPLATE FORMULIR ENTRI NILAI SUMATIF (OFFLINE ENTRY)']);
    ws.mergeCells(3, 1, 3, totalCols);
    row3.height = 22;
    row3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    row3.alignment = { vertical: 'middle', horizontal: 'center' };
    row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    ws.addRow([]).height = 8;

    // --- ROW 5: METADATA ROW 1 (MATA PELAJARAN & KELAS) ---
    const row5 = ws.addRow([]);
    row5.height = 24;

    // Left Box: Mata Pelajaran (Cols 1 to 4)
    ws.mergeCells(5, 1, 5, 4);
    const cellMapel = ws.getCell(5, 1);
    cellMapel.value = `Mata Pelajaran: ${selectedMapel?.namaMapel || 'Semua Mata Pelajaran'} (${selectedMapel?.kodeMapel || '-'})`;
    cellMapel.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    cellMapel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Right Box: Kelas & Wali (Cols 5 to totalCols)
    ws.mergeCells(5, 5, 5, totalCols);
    const cellKelas = ws.getCell(5, 5);
    cellKelas.value = `Kelas: ${selectedKelas?.namaKelas || '-'} (Wali Kelas: ${selectedKelas?.waliKelasNama || '-'})`;
    cellKelas.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cellKelas.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Fill & Border for Row 5
    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(5, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: c === 1 || c === 5 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        right: c === 4 || c === totalCols ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
      };
    }

    // --- ROW 6: METADATA ROW 2 (TAHUN AJARAN & TARGET SISWA) ---
    const row6 = ws.addRow([]);
    row6.height = 24;
    const filterAgamaText = selectedAgamaFilter === 'ALL' ? 'Semua Agama' : `Khusus Siswa Beragama ${selectedAgamaFilter}`;

    // Left Box: Tahun Ajaran & Semester (Cols 1 to 4)
    ws.mergeCells(6, 1, 6, 4);
    const cellTA = ws.getCell(6, 1);
    cellTA.value = `Tahun Ajaran: ${activeTA.tahun}  |  Semester: ${activeTA.semester}`;
    cellTA.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF334155' } };
    cellTA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Right Box: Target Siswa & Banyaknya Kolom Sumatif (Cols 5 to totalCols)
    ws.mergeCells(6, 5, 6, totalCols);
    const cellInfo = ws.getCell(6, 5);
    cellInfo.value = `Target Siswa: ${targetStudents.length} Orang (${filterAgamaText})  |  Banyaknya Sumatif: ${jumlahSumatif} Kolom`;
    cellInfo.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
    cellInfo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Fill & Border for Row 6
    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(6, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: c === 1 || c === 5 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        right: c === 4 || c === totalCols ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
      };
    }

    ws.addRow([]).height = 8;

    // Headers (No, NISN, NIS, Nama Siswa, L/P, Agama, S1..SN, STS, SAS)
    const headerLabels = [
      'No',
      'NISN',
      'NIS',
      'Nama Siswa',
      'L/P',
      'Agama',
      ...Array.from({ length: jumlahSumatif }, (_, i) => `Sumatif ${i + 1} (S${i + 1})`),
      'STS',
      'SAS',
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

      if (colNumber <= 6) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 6 + jumlahSumatif) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber === 6 + jumlahSumatif + 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    // Blank data rows with student identity filled in
    targetStudents.forEach((s, idx) => {
      const rowValues = [
        idx + 1,
        s.nisn || '',
        s.nis || '',
        s.nama || '',
        s.jenisKelamin || 'L',
        s.agama || 'Islam',
        ...Array(jumlahSumatif).fill(''), // Blank for entry
        '', // STS
        '', // SAS
      ];

      const dataRow = ws.addRow(rowValues);
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
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F3D64' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF1F5F9' : 'FFF8FAFC' } };
        } else {
          // Entry cells
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }
      });
    });

    // Proportional column widths
    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'nisn', width: 16 },
      { key: 'nis', width: 13 },
      { key: 'nama', width: 36 },
      { key: 'lp', width: 8 },
      { key: 'agama', width: 15 },
      ...Array.from({ length: jumlahSumatif }, (_, i) => ({
        key: `s${i + 1}`,
        width: 16,
      })),
      { key: 'sts', width: 14 },
      { key: 'sas', width: 14 },
    ];

    const agamaSuffix = selectedAgamaFilter !== 'ALL' ? `_${selectedAgamaFilter}` : '';
    const fileName = `Template_Nilai_${selectedKelas?.kodeKelas || 'Kelas'}_${selectedMapel?.kodeMapel || 'Mapel'}${agamaSuffix}.xlsx`;
    await saveWorkbook(wb, fileName);
  };

  // =========================================================================
  // 3. FILE UPLOAD / IMPORT PARSER (COMPATIBLE WITH NEW STYLED & LEGACY EXCEL)
  // =========================================================================
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

        if (!rawData || rawData.length < 4) {
          alert('Format berkas Excel tidak valid atau kosong.');
          return;
        }

        // Search for header row containing NISN or Nama
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(15, rawData.length); i++) {
          const rowStr = JSON.stringify(rawData[i] || []).toLowerCase();
          if (rowStr.includes('nisn') || rowStr.includes('nama')) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          alert('Tidak dapat menemukan baris header (NISN / Nama Siswa) pada berkas Excel.');
          return;
        }

        // Check mapel restriction for Guru
        if (isGuru && allowedMapelIds && allowedMapelIds.length > 0) {
          if (!allowedMapelIds.includes(selectedMapelId)) {
            alert(
              `Gagal Impor: Anda tidak memiliki akses untuk mengimpor nilai mata pelajaran ini. Anda hanya dapat mengimpor mata pelajaran yang Anda ampu.`
            );
            return;
          }

          // Scan metadata rows (0 to headerRowIdx) for subject mismatches
          let detectedOtherMapel = false;
          let detectedMapelName = '';
          for (let r = 0; r < headerRowIdx; r++) {
            const rowContent = (rawData[r] || []).join(' ').toLowerCase();
            if (rowContent.includes('mata pelajaran:')) {
              const otherMapels = appState.mapelList.filter(
                (m) => !allowedMapelIds.includes(m.id)
              );
              for (const om of otherMapels) {
                if (
                  rowContent.includes(om.namaMapel.toLowerCase()) ||
                  rowContent.includes(`(${om.kodeMapel.toLowerCase()})`)
                ) {
                  detectedOtherMapel = true;
                  detectedMapelName = om.namaMapel;
                  break;
                }
              }
            }
          }

          if (detectedOtherMapel) {
            alert(
              `Validasi Ditolak: Berkas Excel ini terdeteksi untuk mata pelajaran "${detectedMapelName}". Sebagai Guru Pengampu, Anda hanya diizinkan mengimpor nilai untuk mata pelajaran yang Anda ampu (${selectedMapel?.namaMapel}).`
            );
            return;
          }
        }

        const headersArr: string[] = (rawData[headerRowIdx] || []).map((h) =>
          String(h || '').trim().toLowerCase()
        );

        // Find column indices
        const nisnCol = headersArr.findIndex((h) => h.includes('nisn'));
        const namaCol = headersArr.findIndex((h) => h.includes('nama'));
        const lpCol = headersArr.findIndex((h) => h.includes('l/p') || h.includes('jk') || h.includes('kelamin'));
        const agamaCol = headersArr.findIndex((h) => h.includes('agama'));
        const stsCol = headersArr.findIndex((h) => h.includes('sts'));
        const sasCol = headersArr.findIndex((h) => h.includes('sas'));

        // Identify sumatif columns (e.g. S1, S2, Sumatif 1, TP 1, etc.)
        const sumatifCols: number[] = [];
        headersArr.forEach((h, idx) => {
          if (
            (h.includes('sumatif') || h.includes('tp') || /^s\d+/i.test(h)) &&
            !h.includes('rerata') &&
            !h.includes('tengah') &&
            !h.includes('akhir') &&
            !h.includes('sts') &&
            !h.includes('sas')
          ) {
            sumatifCols.push(idx);
          }
        });

        const numSumatifFound = sumatifCols.length > 0 ? sumatifCols.length : jumlahSumatif;
        setImportedSumatifCount(numSumatifFound);

        const newPreviewRows: ExcelNilaiRow[] = [];

        // Parse data rows
        for (let i = headerRowIdx + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          const firstCell = String(row[0] || '').toLowerCase();
          if (firstCell.includes('rata') || firstCell.includes('jumlah') || firstCell.includes('tinggi')) {
            continue; // Skip summary footer
          }

          const nisnVal = String(row[nisnCol] ?? '').trim();
          const namaVal = String(row[namaCol] ?? '').trim();

          if (!nisnVal && !namaVal) continue;

          // Find student in class
          const studentMatch = studentsInClass.find(
            (s) =>
              (nisnVal && s.nisn === nisnVal) ||
              (namaVal && s.nama.toLowerCase() === namaVal.toLowerCase())
          );

          // Extract sumatif scores
          const parsedTps: number[] = [];
          if (sumatifCols.length > 0) {
            sumatifCols.forEach((colIdx) => {
              const val = parseInt(String(row[colIdx] ?? '0'));
              parsedTps.push(isNaN(val) ? 0 : Math.min(100, Math.max(0, val)));
            });
          } else {
            for (let k = 0; k < jumlahSumatif; k++) {
              parsedTps.push(80);
            }
          }

          const stsVal = parseInt(String(row[stsCol] ?? '0'));
          const sasVal = parseInt(String(row[sasCol] ?? '0'));
          const agamaVal = agamaCol >= 0 && row[agamaCol] ? String(row[agamaCol]).trim() : studentMatch?.agama || 'Islam';
          const lpVal = lpCol >= 0 && row[lpCol] ? String(row[lpCol]).trim() : studentMatch?.jenisKelamin || 'L';

          newPreviewRows.push({
            siswaId: studentMatch?.id || `unknown-${i}`,
            nisn: nisnVal || studentMatch?.nisn || '',
            nama: namaVal || studentMatch?.nama || 'Siswa Tidak Dikenal',
            jenisKelamin: lpVal,
            agama: agamaVal,
            tps: parsedTps,
            sts: isNaN(stsVal) ? 0 : Math.min(100, Math.max(0, stsVal)),
            sas: isNaN(sasVal) ? 0 : Math.min(100, Math.max(0, sasVal)),
            statusValidation: studentMatch ? 'VALID' : 'NOT_FOUND',
            validationMessage: studentMatch
              ? `Siswa teridentifikasi di kelas (${studentMatch.agama || 'Islam'})`
              : 'Siswa tidak ditemukan dalam rombel kelas terpilih',
          });
        }

        setPreviewRows(newPreviewRows);
        setActiveTab('PREVIEW');
      } catch (err) {
        console.error('Error reading Excel file:', err);
        alert('Gagal membaca berkas Excel. Pastikan berkas tidak terenkripsi atau rusak.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Confirm Import Apply (Updates matched students without wiping out other students)
  const handleApplyImportData = () => {
    const importedGrid: Record<
      string,
      { tps: number[]; sts: number; sas: number }
    > = {};

    previewRows.forEach((r) => {
      if (r.statusValidation === 'VALID') {
        importedGrid[r.siswaId] = {
          tps: r.tps,
          sts: r.sts,
          sas: r.sas,
        };
      }
    });

    onApplyImport(importedGrid, importedSumatifCount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-blue-800 p-5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20">
              <FileSpreadsheet size={24} className="text-emerald-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight flex items-center space-x-2">
                <span>Ekspor & Impor Nilai MS Excel (.XLSX)</span>
                <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full border border-white/20">
                  {selectedKelas?.kodeKelas} • {selectedMapel?.kodeMapel}
                </span>
              </h3>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Format profesional & proporsional dilengkapi identitas agama siswa untuk akurasi penilaian.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-emerald-50/90 px-5 py-2.5 border-b border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-emerald-900 shrink-0 font-medium gap-1">
          <div className="flex items-center space-x-2">
            <Sparkles size={16} className="text-emerald-700 shrink-0" />
            <span>
              Format Excel menyertakan kolom <strong>L/P & Agama Siswa</strong> untuk mempermudah guru mata pelajaran agama dan umum.
            </span>
          </div>
          {isGuru && currentGuru ? (
            <span className="text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200 px-2.5 py-0.5 rounded-md self-start sm:self-auto flex items-center space-x-1">
              <ShieldCheck size={13} className="text-blue-600" />
              <span>Mapel Ampu: {selectedMapel?.namaMapel}</span>
            </span>
          ) : (
            <span className="text-[11px] font-bold bg-emerald-200/80 text-emerald-900 px-2.5 py-0.5 rounded-md">
              Rerata & NA dihitung otomatis
            </span>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 px-5 pt-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('EXPORT')}
              className={`px-4 py-2 font-bold text-xs rounded-t-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'EXPORT'
                  ? 'bg-white text-emerald-800 border-t-2 border-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download size={14} />
              <span>Export & Template Excel</span>
            </button>
            <button
              onClick={() => setActiveTab('IMPORT')}
              className={`px-4 py-2 font-bold text-xs rounded-t-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'IMPORT'
                  ? 'bg-white text-emerald-800 border-t-2 border-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload size={14} />
              <span>Import Berkas Excel</span>
            </button>
            {previewRows.length > 0 && (
              <button
                onClick={() => setActiveTab('PREVIEW')}
                className={`px-4 py-2 font-bold text-xs rounded-t-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'PREVIEW'
                    ? 'bg-white text-emerald-800 border-t-2 border-emerald-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={14} />
                <span>Pratinjau Data ({previewRows.length} Siswa)</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {activeTab === 'EXPORT' && (
            <div className="space-y-6">
              {/* Agama Filter Selection for Export / Template */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-slate-800">
                    <Filter size={16} className="text-blue-600" />
                    <span className="font-extrabold text-xs">
                      Pilihan Target Siswa / Agama untuk Berkas Excel:
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                    Target: {targetStudents.length} Siswa Terpilih
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAgamaFilter('ALL')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      selectedAgamaFilter === 'ALL'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs">Seluruh Siswa</div>
                      <div className={`text-[10px] ${selectedAgamaFilter === 'ALL' ? 'text-blue-100' : 'text-slate-400'}`}>
                        Semua Agama di Kelas
                      </div>
                    </div>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                      selectedAgamaFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {studentsInClass.length}
                    </span>
                  </button>

                  {distinctAgamas.map((ag) => {
                    const isSelected = selectedAgamaFilter.toLowerCase() === ag.toLowerCase();
                    const badge = getAgamaBadge(ag);
                    return (
                      <button
                        key={ag}
                        type="button"
                        onClick={() => setSelectedAgamaFilter(ag)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs flex items-center space-x-1.5">
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : badge.dot}`} />
                            <span>Khusus {ag}</span>
                          </div>
                          <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            Hanya Siswa {ag}
                          </div>
                        </div>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {agamaStats[ag]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {hasMultipleAgama && (
                  <p className="text-[11px] text-slate-500 italic">
                    💡 <strong>Tips Guru Agama:</strong> Jika Anda mengajar mata pelajaran agama tertentu (misal: PAI, PAK, atau Agama Katolik), pilih opsi agama di atas agar file Excel yang diunduh hanya berisi daftar siswa yang mengambil mata pelajaran Anda.
                  </p>
                )}
              </div>

              {/* Download Option Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Option 1: Download Current Data */}
                <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/50 p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-emerald-600 text-white rounded-2xl w-fit shadow-md shadow-emerald-600/20">
                        <FileSpreadsheet size={24} />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300">
                        {activeTA.tahun} • Sem. {activeTA.semester}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        Export Data Nilai Kelas {selectedKelas?.namaKelas}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1 font-bold text-emerald-800 text-[11px]">
                        <span>Mapel:</span>
                        <span className="bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">{selectedMapel?.namaMapel} ({selectedMapel?.kodeMapel})</span>
                      </div>
                      <p className="text-slate-600 mt-2 leading-relaxed text-xs">
                        Unduh data nilai siswa saat ini dengan kolom <strong>L/P & Agama</strong>, lebar kolom proporsional, serta formula ringkasan kelas ke format <strong>.XLSX</strong>.
                      </p>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200 text-[11px] text-emerald-950 font-semibold space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span>Kolom No, NISN, NIS, Nama, L/P, Agama</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span>Kolom S1 s.d. S{jumlahSumatif}, STS, dan SAS ({targetStudents.length} Siswa)</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span>Header dokumen memuat Nama Mapel, T.A, Kelas, dan Wali</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleExportExcel}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-lg shadow-emerald-700/20 flex items-center justify-center space-x-2 cursor-pointer transition-all"
                  >
                    <Download size={16} />
                    <span>Download File Excel ({targetStudents.length} Siswa)</span>
                  </button>
                </div>

                {/* Option 2: Download Template */}
                <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-5 rounded-2xl border border-blue-200 shadow-xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-blue-600 text-white rounded-2xl w-fit shadow-md shadow-blue-600/20">
                        <FileDown size={24} />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg border border-blue-300">
                        {activeTA.tahun} • Sem. {activeTA.semester}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        Download Template Kosong ({jumlahSumatif} Sumatif)
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1 font-bold text-blue-800 text-[11px]">
                        <span>Mapel:</span>
                        <span className="bg-white/80 px-2 py-0.5 rounded-md border border-blue-200">{selectedMapel?.namaMapel} ({selectedMapel?.kodeMapel})</span>
                      </div>
                      <p className="text-slate-600 mt-2 leading-relaxed text-xs">
                        Unduh template kosong berformat resmi dengan identitas siswa (termasuk agama) yang siap diisi secara offline oleh guru mata pelajaran.
                      </p>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-blue-200 text-[11px] text-blue-950 font-semibold space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                        <span>Tersedia nama lengkap, NISN, NIS, L/P, dan Agama</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                        <span>Dilengkapi panduan petunjuk pengisian & toleransi agama</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                        <span>Header dokumen memuat Nama Mapel, T.A, Kelas, dan Wali</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadTemplate}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2 cursor-pointer transition-all"
                  >
                    <FileDown size={16} />
                    <span>Download Template Excel ({targetStudents.length} Siswa)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'IMPORT' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-8 rounded-2xl text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shadow-inner">
                  <Upload size={32} />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Unggah Berkas Excel (.XLSX)</h4>
                  <p className="text-slate-500 mt-1">
                    Pilih berkas template atau berkas nilai Excel yang telah diisi nilainya secara offline.
                  </p>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-700/20 cursor-pointer transition-all inline-flex items-center space-x-2"
                >
                  <Upload size={16} />
                  <span>Pilih & Unggah Berkas Excel</span>
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start space-x-3 text-slate-700">
                <Info size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="font-bold text-slate-900">Ketentuan & Toleransi Impor Berkas:</h5>
                  <ul className="text-[11px] text-slate-600 leading-relaxed list-disc pl-4 space-y-0.5">
                    <li>Sistem otomatis mengenali baris header <strong>NISN</strong>, <strong>Nama Siswa</strong>, <strong>Agama</strong>, kolom <strong>Sumatif (S1 s.d. SN)</strong>, <strong>STS</strong>, dan <strong>SAS</strong>.</li>
                    <li>Jika berkas hanya berisi sebagian siswa (misalnya hanya siswa beragama Kristen yang diisi oleh Guru Agama Kristen), sistem akan memperbarui nilai siswa tersebut dan <strong>menjaga data nilai siswa lainnya di kelas ini tetap aman</strong>.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PREVIEW' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 gap-2">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-slate-800">
                    Pratinjau Data Impor ({previewRows.length} Siswa Terdeteksi)
                  </span>
                  {previewRows.some((r) => r.statusValidation !== 'VALID') && (
                    <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200">
                      Ada Data Tidak Cocok
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200">
                  {importedSumatifCount} Kolom Sumatif Ditemukan
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-10 text-center">No</th>
                      <th className="p-2.5">NISN</th>
                      <th className="p-2.5 min-w-[160px]">Nama Siswa</th>
                      <th className="p-2 text-center w-12">L/P</th>
                      <th className="p-2 text-center w-24">Agama</th>
                      {Array.from({ length: importedSumatifCount }, (_, i) => (
                        <th key={i} className="p-2 text-center font-mono text-blue-700">
                          S{i + 1}
                        </th>
                      ))}
                      <th className="p-2 text-center text-emerald-700">STS</th>
                      <th className="p-2 text-center text-amber-700">SAS</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {previewRows.map((r, idx) => {
                      const badge = getAgamaBadge(r.agama);
                      return (
                        <tr key={r.siswaId} className="hover:bg-slate-50">
                          <td className="p-2 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-2 text-slate-600">{r.nisn}</td>
                          <td className="p-2 font-sans font-semibold text-slate-900">{r.nama}</td>
                          <td className="p-2 text-center font-bold text-slate-600">
                            {r.jenisKelamin || 'L'}
                          </td>
                          <td className="p-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center space-x-1 ${badge.bg}`}
                            >
                              <span className={`w-1 h-1 rounded-full ${badge.dot}`} />
                              <span>{r.agama || 'Islam'}</span>
                            </span>
                          </td>
                          {r.tps.map((score, sIdx) => (
                            <td key={sIdx} className="p-2 text-center text-blue-600 font-bold">
                              {score}
                            </td>
                          ))}
                          <td className="p-2 text-center text-emerald-600 font-bold">{r.sts}</td>
                          <td className="p-2 text-center text-amber-600 font-bold">{r.sas}</td>
                          <td className="p-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                r.statusValidation === 'VALID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {r.statusValidation === 'VALID' ? 'VALID' : 'TIDAK COCOK'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
                <span className="text-[11px] text-slate-500">
                  Data yang valid akan dimasukkan ke tabel nilai. Data siswa yang tidak ada di berkas impor akan tetap utuh.
                </span>
                <button
                  onClick={handleApplyImportData}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-700/20 flex items-center space-x-2 cursor-pointer transition-all self-end"
                >
                  <Save size={16} />
                  <span>Terapkan Nilai Impor ke Sistem</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

