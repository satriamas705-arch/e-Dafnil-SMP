import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { AppState, Guru, NotificationLog } from '../../types';
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
  HelpCircle,
  Edit3,
  Trash2,
  Sparkles,
  PlusCircle,
  Save,
} from 'lucide-react';

interface ExcelGuruModalProps {
  appState: AppState;
  onClose: () => void;
  onUpdateGuruList: (newList: Guru[], notif: NotificationLog) => void;
}

export interface ExcelGuruRow {
  id: string;
  nip: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  mapelKodeStr: string; // e.g. "m-3, m-7" or "BIN, BIG"
  kelasKodeStr: string; // e.g. "7A, 8B"
  email: string;
  noHp: string;
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

export const ExcelGuruModal: React.FC<ExcelGuruModalProps> = ({
  appState,
  onClose,
  onUpdateGuruList,
}) => {
  const [activeTab, setActiveTab] = useState<'EXPORT' | 'IMPORT' | 'PREVIEW'>('PREVIEW');
  const [activeSheetTab, setActiveSheetTab] = useState<'DATA' | 'REF'>('DATA');
  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert current guru list to Excel row format for preview/editing
  const convertGuruToExcelRows = (list: Guru[]): ExcelGuruRow[] => {
    return list.map((g) => {
      const mapelCodes = (g.mapelAmpuanIds || [])
        .map((mId) => {
          const m = appState.mapelList.find((item) => item.id === mId);
          return m ? m.kodeMapel : mId;
        })
        .join(', ');

      const kelasCodes = (g.kelasAmpuanIds || [])
        .map((kId) => {
          const k = appState.kelasList.find((item) => item.id === kId);
          return k ? k.kodeKelas : kId;
        })
        .join(', ');

      return {
        id: g.id,
        nip: g.nip,
        nama: g.nama,
        jenisKelamin: g.jenisKelamin || 'L',
        mapelKodeStr: mapelCodes,
        kelasKodeStr: kelasCodes,
        email: g.email || '',
        noHp: g.noHp || '',
        statusValidation: 'VALID',
        validationMessage: 'Data terverifikasi',
      };
    });
  };

  const [excelRows, setExcelRows] = useState<ExcelGuruRow[]>(() =>
    convertGuruToExcelRows(appState.guruList)
  );

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>({
    row: 0,
    col: 'B',
  });

  // Selected cell value for Excel Formula Bar display
  const getSelectedCellValue = () => {
    if (!selectedCell || selectedCell.row < 0 || selectedCell.row >= excelRows.length) {
      return '=GURU("DATA_PEMBELAJARAN_SIPENIS")';
    }
    const row = excelRows[selectedCell.row];
    switch (selectedCell.col) {
      case 'A': return (selectedCell.row + 1).toString();
      case 'B': return row.nip;
      case 'C': return row.nama;
      case 'D': return row.jenisKelamin;
      case 'E': return row.mapelKodeStr;
      case 'F': return row.kelasKodeStr;
      case 'G': return row.email;
      case 'H': return row.noHp;
      default: return '=CELL_VALUE()';
    }
  };

  // Cell Change Handler
  const handleCellChange = (rowIndex: number, field: keyof ExcelGuruRow, value: string) => {
    setExcelRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [field]: value,
      };

      // Re-validate row
      const row = updated[rowIndex];
      if (!row.nip || !row.nama) {
        row.statusValidation = 'WARNING';
        row.validationMessage = 'NIP dan Nama tidak boleh kosong!';
      } else {
        row.statusValidation = 'VALID';
        row.validationMessage = 'Data valid';
      }

      return updated;
    });
  };

  // Add new empty row to spreadsheet
  const handleAddExcelRow = () => {
    const newRow: ExcelGuruRow = {
      id: 'g-excel-' + Date.now(),
      nip: '',
      nama: '',
      jenisKelamin: 'L',
      mapelKodeStr: appState.mapelList[0]?.kodeMapel || 'BIN',
      kelasKodeStr: appState.kelasList[0]?.kodeKelas || '7A',
      email: '',
      noHp: '',
      statusValidation: 'WARNING',
      validationMessage: 'Lengkapi NIP dan Nama',
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

    const ws = wb.addWorksheet('Data Guru', {
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
    const row3 = ws.addRow(['FORMAT & REKAPITULASI RESMI DATA GURU & TENAGA PENDIDIK']);
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
      `Total Guru & Pendidik: ${excelRows.length} Orang (Laki-laki: ${lCount} | Perempuan: ${pCount})`,
    ]);
    row6.height = 20;
    row6.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } };
    row6.alignment = { vertical: 'middle' };

    ws.addRow([]).height = 8;

    // --- ROW 8: TABLE HEADERS ---
    const headerLabels = [
      'No',
      'NIP Guru',
      'Nama Lengkap Guru',
      'JK (L/P)',
      'Kode Mapel Ampuan',
      'Nama Mapel Ampuan',
      'Kode Kelas Ampuan',
      'Nama Kelas Ampuan',
      'Email',
      'No HP / WhatsApp',
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
        // No, NIP: Dark Navy Blue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 4) {
        // Nama, JK: Royal Blue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 8) {
        // Mapel & Kelas Ampuan: Royal Purple
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B2C6F' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        // Email & No HP: Forest Green
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    // --- DATA ROWS ---
    excelRows.forEach((r, idx) => {
      // Map mapel codes to names
      const mapelNames = r.mapelKodeStr
        .split(',')
        .map((code) => {
          const cleanCode = code.trim().toLowerCase();
          const m = appState.mapelList.find(
            (item) => item.kodeMapel.toLowerCase() === cleanCode || item.id.toLowerCase() === cleanCode
          );
          return m ? m.namaMapel : code.trim();
        })
        .filter(Boolean)
        .join(', ');

      // Map kelas codes to names
      const kelasNames = r.kelasKodeStr
        .split(',')
        .map((code) => {
          const cleanCode = code.trim().toLowerCase();
          const k = appState.kelasList.find(
            (item) => item.kodeKelas.toLowerCase() === cleanCode || item.id.toLowerCase() === cleanCode
          );
          return k ? k.namaKelas : code.trim();
        })
        .filter(Boolean)
        .join(', ');

      const dataRow = ws.addRow([
        idx + 1,
        r.nip,
        r.nama,
        r.jenisKelamin,
        r.mapelKodeStr,
        mapelNames,
        r.kelasKodeStr,
        kelasNames,
        r.email,
        r.noHp,
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
          // NIP
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 3) {
          // Nama Lengkap Guru
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 4) {
          // JK
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF475569' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 5) {
          // Kode Mapel
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF5B2C6F' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFDF4FF' : 'FFFFFFFF' } };
        } else if (colNumber === 6) {
          // Nama Mapel
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 7) {
          // Kode Kelas
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E40AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFEFF6FF' : 'FFFFFFFF' } };
        } else if (colNumber === 8) {
          // Nama Kelas
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 9) {
          // Email
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0D9488' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else {
          // No HP
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        }
      });
    });

    // Proportional Column Widths
    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'nip', width: 24 },
      { key: 'nama', width: 36 },
      { key: 'jk', width: 12 },
      { key: 'kodeMapel', width: 24 },
      { key: 'namaMapel', width: 36 },
      { key: 'kodeKelas', width: 24 },
      { key: 'namaKelas', width: 36 },
      { key: 'email', width: 32 },
      { key: 'noHp', width: 20 },
    ];

    // --- SHEET 2: PETUNJUK FORMAT & PENGISIAN ---
    const wsHelp = wb.addWorksheet('Petunjuk Pengisian', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1E8449' } },
    });

    const helpTitle = wsHelp.addRow(['PANDUAN & PETUNJUK FORMAT PENGISIAN DATA GURU']);
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
      ['1', 'NIP GURU', 'Wajib diisi 18 digit NIP resmi atau kode identitas unik pendidik. Tidak boleh kosong.'],
      ['2', 'NAMA LENGKAP GURU', 'Wajib diisi nama lengkap dan gelar pendidik.'],
      ['3', 'JK (L/P)', 'Diisi L untuk Laki-laki atau P untuk Perempuan.'],
      ['4', 'KODE MAPEL AMPUAN', 'Diisi kode mapel yang diampu, dipisahkan koma jika lebih dari satu (Contoh: BIN, BIG, MTK).'],
      ['5', 'KODE KELAS AMPUAN', 'Diisi kode kelas yang diajar, dipisahkan koma jika lebih dari satu (Contoh: 7A, 7B, 8A).'],
      ['6', 'EMAIL', 'Diisi alamat email aktif guru (opsional, disarankan format email institusi/sekolah).'],
      ['7', 'NO HP / WHATSAPP', 'Diisi nomor handphone atau WhatsApp aktif guru (opsional).'],
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

    // --- SHEET 3: REFERENSI MAPEL ---
    const wsRefMapel = wb.addWorksheet('Ref Mapel', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF5B2C6F' } },
    });
    const mapelTitle = wsRefMapel.addRow(['REFERENSI KODE MATA PELAJARAN YANG TERDAFTAR']);
    wsRefMapel.mergeCells(1, 1, 1, 4);
    mapelTitle.height = 24;
    mapelTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    mapelTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    mapelTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B2C6F' } };

    wsRefMapel.addRow([]).height = 6;
    const mapelH = wsRefMapel.addRow(['No', 'Kode Mapel', 'Nama Mata Pelajaran', 'Kelompok']);
    mapelH.height = 22;
    mapelH.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    mapelH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    appState.mapelList.forEach((m, i) => {
      const r = wsRefMapel.addRow([i + 1, m.kodeMapel, m.namaMapel, m.kelompok || '-']);
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
    wsRefMapel.columns = [{ width: 6 }, { width: 16 }, { width: 36 }, { width: 16 }];

    // --- SHEET 4: REFERENSI KELAS ---
    const wsRefKelas = wb.addWorksheet('Ref Kelas', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FFD35400' } },
    });
    const kelasTitle = wsRefKelas.addRow(['REFERENSI KODE KELAS & ROMBEL YANG TERDAFTAR']);
    wsRefKelas.mergeCells(1, 1, 1, 5);
    kelasTitle.height = 24;
    kelasTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    kelasTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    kelasTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };

    wsRefKelas.addRow([]).height = 6;
    const kelasH = wsRefKelas.addRow(['No', 'Kode Kelas', 'Nama Kelas', 'Tingkat', 'Wali Kelas']);
    kelasH.height = 22;
    kelasH.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    kelasH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

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
    const fileName = `Export_Data_Guru_${cleanSchool}_${cleanTa}.xlsx`;
    await saveWorkbook(wb, fileName);
  };

  // Download Sample Template .XLSX (Berwarna & Proporsional)
  const handleDownloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'e-Dafnil Assessment System';
    wb.lastModifiedBy = 'e-Dafnil Admin';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet('Template Data Guru', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1B4F72' } },
    });

    const totalCols = 8;
    const kabName = appState.sekolah?.kabupatenKota?.toUpperCase() || 'BANYUMAS';
    const schName = appState.sekolah?.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN';

    // Kop
    const row1 = ws.addRow([`PEMERINTAH KABUPATEN ${kabName} - DINAS PENDIDIKAN`]);
    ws.mergeCells(1, 1, 1, totalCols);
    row1.height = 24;
    row1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row1.alignment = { vertical: 'middle', horizontal: 'center' };
    row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    const row2 = ws.addRow([`${schName} - TEMPLATE IMPORT DATA GURU`]);
    ws.mergeCells(2, 1, 2, totalCols);
    row2.height = 28;
    row2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    row2.alignment = { vertical: 'middle', horizontal: 'center' };
    row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E80' } };

    const row3 = ws.addRow(['TEMPLATE FORMULIR ENTRI & IMPORT DATA GURU / PENDIDIK (OFFLINE ENTRY)']);
    ws.mergeCells(3, 1, 3, totalCols);
    row3.height = 22;
    row3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    row3.alignment = { vertical: 'middle', horizontal: 'center' };
    row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    ws.addRow([]).height = 8;

    const row5 = ws.addRow([
      `Panduan: Isi NIP dan Nama Lengkap Guru. Kode mapel dan kelas ampuan dipisahkan tanda koma.`,
      '',
      '',
      '',
      `Lihat sheet 'Ref Mapel' & 'Ref Kelas' untuk daftar kode valid.`,
    ]);
    row5.height = 20;
    row5.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } };
    row5.alignment = { vertical: 'middle' };

    ws.addRow([]).height = 8;

    // Headers
    const headerLabels = [
      'No',
      'NIP Guru',
      'Nama Lengkap Guru',
      'JK (L/P)',
      'Kode Mapel Ampuan',
      'Kode Kelas Ampuan',
      'Email',
      'No HP / WhatsApp',
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
      } else if (colNumber <= 6) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B2C6F' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    const sampleTeachers = [
      { no: 1, nip: '198501012010011001', nama: 'Budi Santoso, S.Pd.', jk: 'L', mapel: 'BIN, BIG', kelas: '7A, 7B, 8A', email: 'budi.santoso@sekolah.sch.id', hp: '081234567890' },
      { no: 2, nip: '198803122012022002', nama: 'Siti Rahmawati, M.Pd.', jk: 'P', mapel: 'MAT, IPA', kelas: '8A, 8B, 9A', email: 'siti.rahmawati@sekolah.sch.id', hp: '081398765432' },
      { no: 3, nip: '199005152015031003', nama: 'Ahmad Fauzi, S.Kom.', jk: 'L', mapel: 'INF', kelas: '7A, 7B, 8A, 8B, 9A, 9B', email: 'ahmad.fauzi@sekolah.sch.id', hp: '085712345678' },
    ];

    sampleTeachers.forEach((t, idx) => {
      const dataRow = ws.addRow([
        t.no,
        t.nip,
        t.nama,
        t.jk,
        t.mapel,
        t.kelas,
        t.email,
        t.hp,
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
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 4) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF475569' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF5B2C6F' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFDF4FF' : 'FFFFFFFF' } };
        } else if (colNumber === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E40AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFEFF6FF' : 'FFFFFFFF' } };
        } else if (colNumber === 7) {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF0D9488' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        }
      });
    });

    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'nip', width: 24 },
      { key: 'nama', width: 36 },
      { key: 'jk', width: 12 },
      { key: 'kodeMapel', width: 26 },
      { key: 'kodeKelas', width: 26 },
      { key: 'email', width: 32 },
      { key: 'noHp', width: 20 },
    ];

    // Sheet 2: Petunjuk Format
    const wsHelp = wb.addWorksheet('Petunjuk Pengisian', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1E8449' } },
    });
    const helpTitle = wsHelp.addRow(['PANDUAN & PETUNJUK FORMAT PENGISIAN DATA GURU']);
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
      ['1', 'NIP GURU', 'Wajib diisi 18 digit NIP resmi atau kode unik pendidik. Tidak boleh kosong.'],
      ['2', 'NAMA LENGKAP GURU', 'Wajib diisi nama lengkap dan gelar pendidik.'],
      ['3', 'JK (L/P)', 'Diisi L untuk Laki-laki atau P untuk Perempuan.'],
      ['4', 'KODE MAPEL AMPUAN', 'Diisi kode mapel yang diampu, dipisahkan koma (Contoh: BIN, BIG, MTK).'],
      ['5', 'KODE KELAS AMPUAN', 'Diisi kode kelas yang diajar, dipisahkan koma (Contoh: 7A, 7B, 8A).'],
      ['6', 'EMAIL', 'Diisi alamat email aktif guru (opsional).'],
      ['7', 'NO HP / WHATSAPP', 'Diisi nomor handphone atau WhatsApp aktif guru (opsional).'],
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

    // Sheet 3: Ref Mapel
    const wsRefMapel = wb.addWorksheet('Ref Mapel', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF5B2C6F' } },
    });
    const mapelTitle = wsRefMapel.addRow(['REFERENSI KODE MATA PELAJARAN YANG TERDAFTAR']);
    wsRefMapel.mergeCells(1, 1, 1, 4);
    mapelTitle.height = 24;
    mapelTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    mapelTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    mapelTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B2C6F' } };

    wsRefMapel.addRow([]).height = 6;
    const mapelH = wsRefMapel.addRow(['No', 'Kode Mapel', 'Nama Mata Pelajaran', 'Kelompok']);
    mapelH.height = 22;
    mapelH.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    mapelH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    appState.mapelList.forEach((m, i) => {
      const r = wsRefMapel.addRow([i + 1, m.kodeMapel, m.namaMapel, m.kelompok || '-']);
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
    wsRefMapel.columns = [{ width: 6 }, { width: 16 }, { width: 36 }, { width: 16 }];

    // Sheet 4: Ref Kelas
    const wsRefKelas = wb.addWorksheet('Ref Kelas', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FFD35400' } },
    });
    const kelasTitle = wsRefKelas.addRow(['REFERENSI KODE KELAS & ROMBEL YANG TERDAFTAR']);
    wsRefKelas.mergeCells(1, 1, 1, 5);
    kelasTitle.height = 24;
    kelasTitle.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    kelasTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    kelasTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };

    wsRefKelas.addRow([]).height = 6;
    const kelasH = wsRefKelas.addRow(['No', 'Kode Kelas', 'Nama Kelas', 'Tingkat', 'Wali Kelas']);
    kelasH.height = 22;
    kelasH.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    kelasH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

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
    const fileName = `Template_Import_Data_Guru_${cleanSchool}.xlsx`;
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

        // Search for header row containing NIP or Nama Guru
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(15, rawData.length); i++) {
          const rowStr = JSON.stringify(rawData[i] || []).toLowerCase();
          if (rowStr.includes('nip') || (rowStr.includes('nama') && (rowStr.includes('guru') || rowStr.includes('lengkap')))) {
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
          alert('File Excel tidak memiliki baris data guru yang valid!');
          return;
        }

        // Map parsed Excel JSON into ExcelGuruRow structure
        const parsedRows: ExcelGuruRow[] = jsonData.map((row, idx) => {
          // Normalize Keys (Handle variations in column headers)
          const nip = (
            row['NIP Guru'] ||
            row['NIP GURU'] ||
            row['NIP'] ||
            row['nip'] ||
            row['Nip'] ||
            ''
          ).toString().trim();

          const nama = (
            row['Nama Lengkap Guru'] ||
            row['NAMA LENGKAP GURU'] ||
            row['Nama Guru'] ||
            row['NAMA GURU'] ||
            row['NAMA'] ||
            row['nama'] ||
            ''
          ).toString().trim();

          let jkRaw = (
            row['JK (L/P)'] ||
            row['Jenis Kelamin (L/P)'] ||
            row['JK'] ||
            row['JENIS KELAMIN'] ||
            row['jenis_kelamin'] ||
            'L'
          ).toString().trim().toUpperCase();

          const jenisKelamin: 'L' | 'P' = jkRaw.startsWith('P') || jkRaw === 'PEREMPUAN' ? 'P' : 'L';

          const mapelKodeStr = (
            row['Kode Mapel Ampuan'] ||
            row['KODE MAPEL AMPUAN'] ||
            row['KODE MAPEL'] ||
            row['MAPEL'] ||
            row['mapel'] ||
            ''
          ).toString().trim();

          const kelasKodeStr = (
            row['Kode Kelas Ampuan'] ||
            row['KODE KELAS AMPUAN'] ||
            row['KODE KELAS'] ||
            row['KELAS'] ||
            row['kelas'] ||
            ''
          ).toString().trim();

          const email = (row['Email'] || row['EMAIL'] || row['email'] || '').toString().trim();
          const noHp = (row['No HP / WhatsApp'] || row['NO HP / WHATSAPP'] || row['NO HP'] || row['NO_HP'] || row['no_hp'] || '').toString().trim();

          // Check duplicate NIP in existing system
          const isDuplicate = appState.guruList.some((g) => g.nip === nip && nip !== '');

          let statusValidation: 'VALID' | 'WARNING' | 'DUPLICATE' = 'VALID';
          let validationMessage = 'Siap diimpor';

          if (!nip || !nama) {
            statusValidation = 'WARNING';
            validationMessage = 'NIP atau Nama kosong';
          } else if (isDuplicate) {
            statusValidation = 'DUPLICATE';
            validationMessage = 'NIP sudah terdaftar di sistem';
          }

          return {
            id: 'g-imp-' + idx + '-' + Date.now(),
            nip,
            nama,
            jenisKelamin,
            mapelKodeStr,
            kelasKodeStr,
            email,
            noHp,
            statusValidation,
            validationMessage,
          };
        });

        setExcelRows(parsedRows);
        setActiveTab('PREVIEW');
        alert(`Berhasil membaca ${parsedRows.length} baris data dari file Excel "${file.name}"! Silakan periksa di lembar kerja Excel.`);
      } catch (err) {
        console.error('Error reading Excel file:', err);
        alert('Gagal membaca file Excel. Pastikan format file .xlsx, .xls, atau .csv valid.');
      }
    };
    reader.readAsBinaryString(file);

    // Reset input
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

    // Convert excelRows to standard Guru objects
    const convertedGurus: Guru[] = excelRows.map((r) => {
      // Resolve Mapel IDs from mapelKodeStr
      const mapelCodes = r.mapelKodeStr.split(',').map((s) => s.trim().toLowerCase());
      const matchedMapelIds: string[] = [];

      mapelCodes.forEach((code) => {
        if (!code) return;
        const found = appState.mapelList.find(
          (m) =>
            m.kodeMapel.toLowerCase() === code ||
            m.id.toLowerCase() === code ||
            m.namaMapel.toLowerCase() === code
        );
        if (found) {
          if (!matchedMapelIds.includes(found.id)) matchedMapelIds.push(found.id);
        }
      });

      // Fallback if no mapel matched
      if (matchedMapelIds.length === 0 && appState.mapelList[0]) {
        matchedMapelIds.push(appState.mapelList[0].id);
      }

      // Resolve Kelas IDs from kelasKodeStr
      const kelasCodes = r.kelasKodeStr.split(',').map((s) => s.trim().toLowerCase());
      const matchedKelasIds: string[] = [];

      kelasCodes.forEach((code) => {
        if (!code) return;
        const found = appState.kelasList.find(
          (k) =>
            k.kodeKelas.toLowerCase() === code ||
            k.id.toLowerCase() === code ||
            k.namaKelas.toLowerCase().includes(code)
        );
        if (found) {
          if (!matchedKelasIds.includes(found.id)) matchedKelasIds.push(found.id);
        }
      });

      // Fallback if no kelas matched
      if (matchedKelasIds.length === 0 && appState.kelasList[0]) {
        matchedKelasIds.push(appState.kelasList[0].id);
      }

      return {
        id: r.id || 'g-' + Math.random().toString(36).substring(2, 9),
        nip: r.nip || '000000000000000000',
        nama: r.nama || 'Tanpa Nama',
        jenisKelamin: r.jenisKelamin,
        email: r.email,
        noHp: r.noHp,
        mapelAmpuanIds: matchedMapelIds,
        kelasAmpuanIds: matchedKelasIds,
      };
    });

    let finalGuruList: Guru[] = [];
    if (importMode === 'REPLACE') {
      finalGuruList = convertedGurus;
    } else {
      // MERGE: update existing NIP or append new
      const existingMap = new Map<string, Guru>();
      appState.guruList.forEach((g) => existingMap.set(g.nip || g.id, g));
      convertedGurus.forEach((g) => existingMap.set(g.nip || g.id, g));
      finalGuruList = Array.from(existingMap.values());
    }

    const notif = createNotification(
      'Import Data Guru Excel',
      `Berhasil memperbarui data guru dari Excel (${convertedGurus.length} baris diproses).`,
      'data-guru'
    );

    onUpdateGuruList(finalGuruList, notif);
    alert(`Sukses! ${convertedGurus.length} data guru dari Excel telah berhasil disimpan ke dalam sistem.`);
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
                  Microsoft Excel — Modul Import & Export Data Guru
                </span>
                <span className="bg-emerald-800 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-600">
                  Live Spreadsheet Engine
                </span>
              </div>
              <p className="text-[11px] text-emerald-100 opacity-90">
                DATA_GURU_SIPENIS_2025_2026.xlsx • {excelRows.length} Baris Data Read-Write
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

        {/* EXCEL MENU BAR / TOOLBAR */}
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
              <span>Tambah Baris Excel</span>
            </button>

            <button
              onClick={() => setExcelRows(convertGuruToExcelRows(appState.guruList))}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg border border-slate-600 flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Reset ke Data Guru Saat Ini"
            >
              <RefreshCw size={13} />
              <span>Reset Data</span>
            </button>
          </div>

          {/* Import Mode Selector & Apply Button */}
          <div className="flex items-center space-x-3 bg-slate-950 p-1.5 rounded-xl border border-slate-700">
            <div className="flex items-center space-x-2 px-2 text-[11px]">
              <span className="text-slate-400 font-medium">Mode Import:</span>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'MERGE'}
                  onChange={() => setImportMode('MERGE')}
                  className="accent-emerald-500"
                />
                <span className={importMode === 'MERGE' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  Gabung / Timpa NIP
                </span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer ml-2">
                <input
                  type="radio"
                  name="importMode"
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

        {/* EXCEL FORMULA BAR SIMULATION */}
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
                  {/* EXCEL COLUMN HEADERS (A, B, C, D...) */}
                  <tr className="bg-slate-800 text-slate-400 text-[11px] font-bold border-b border-slate-700">
                    <th className="w-10 border-r border-slate-700 p-1 text-center bg-slate-850">#</th>
                    <th className="w-12 border-r border-slate-700 p-1 text-center">A</th>
                    <th className="w-44 border-r border-slate-700 p-1 text-center">B (NIP)</th>
                    <th className="w-56 border-r border-slate-700 p-1 text-center">C (Nama Guru)</th>
                    <th className="w-20 border-r border-slate-700 p-1 text-center">D (JK)</th>
                    <th className="w-48 border-r border-slate-700 p-1 text-center">E (Kode Mapel)</th>
                    <th className="w-44 border-r border-slate-700 p-1 text-center">F (Kode Kelas)</th>
                    <th className="w-44 border-r border-slate-700 p-1 text-center">G (Email)</th>
                    <th className="w-36 border-r border-slate-700 p-1 text-center">H (No HP)</th>
                    <th className="w-28 border-r border-slate-700 p-1 text-center">Status</th>
                    <th className="w-12 p-1 text-center">Hapus</th>
                  </tr>

                  {/* EXCEL SHEET HEADER ROW 1 */}
                  <tr className="bg-[#107c41] text-white font-extrabold text-xs border-b border-emerald-800 shadow-sm">
                    <td className="border-r border-emerald-800 p-2 text-center bg-emerald-900 text-emerald-200 font-mono">1</td>
                    <td className="border-r border-emerald-800 p-2 text-center">No</td>
                    <td className="border-r border-emerald-800 p-2">NIP Guru *</td>
                    <td className="border-r border-emerald-800 p-2">Nama Lengkap Guru *</td>
                    <td className="border-r border-emerald-800 p-2 text-center">L / P</td>
                    <td className="border-r border-emerald-800 p-2">Kode Mapel (Koma)</td>
                    <td className="border-r border-emerald-800 p-2">Kode Kelas (Koma)</td>
                    <td className="border-r border-emerald-800 p-2">Email</td>
                    <td className="border-r border-emerald-800 p-2">No HP</td>
                    <td className="border-r border-emerald-800 p-2 text-center">Validasi</td>
                    <td className="p-2 text-center">Aksi</td>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                  {excelRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-500 italic">
                        Belum ada data guru. Klik "Tambah Baris Excel" atau "Import .XLSX" untuk memulai.
                      </td>
                    </tr>
                  ) : (
                    excelRows.map((row, idx) => {
                      const excelRowIndex = idx + 2; // Excel row 2, 3, 4...
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

                          {/* Column B: NIP */}
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
                              value={row.nip}
                              onChange={(e) => handleCellChange(idx, 'nip', e.target.value)}
                              placeholder="NIP Guru"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-emerald-300 font-mono focus:outline-hidden"
                            />
                          </td>

                          {/* Column C: Nama */}
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
                              value={row.nama}
                              onChange={(e) => handleCellChange(idx, 'nama', e.target.value)}
                              placeholder="Nama Guru"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-white font-sans font-bold focus:outline-hidden"
                            />
                          </td>

                          {/* Column D: JK */}
                          <td
                            className={`border-r border-slate-800 p-1 text-center ${
                              selectedCell?.row === idx && selectedCell?.col === 'D'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'D' })}
                          >
                            <select
                              value={row.jenisKelamin}
                              onChange={(e) => handleCellChange(idx, 'jenisKelamin', e.target.value as 'L' | 'P')}
                              className="bg-slate-900 text-slate-200 border-0 text-xs px-1 py-0.5 rounded focus:outline-hidden cursor-pointer"
                            >
                              <option value="L">L</option>
                              <option value="P">P</option>
                            </select>
                          </td>

                          {/* Column E: Mapel Kode Str */}
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
                              value={row.mapelKodeStr}
                              onChange={(e) => handleCellChange(idx, 'mapelKodeStr', e.target.value)}
                              placeholder="BIN, MAT, IPA"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-blue-300 font-mono focus:outline-hidden"
                            />
                          </td>

                          {/* Column F: Kelas Kode Str */}
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
                              value={row.kelasKodeStr}
                              onChange={(e) => handleCellChange(idx, 'kelasKodeStr', e.target.value)}
                              placeholder="7A, 7B, 8A"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-amber-300 font-mono focus:outline-hidden"
                            />
                          </td>

                          {/* Column G: Email */}
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
                              value={row.email}
                              onChange={(e) => handleCellChange(idx, 'email', e.target.value)}
                              placeholder="email@sekolah.sch.id"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-slate-300 font-sans focus:outline-hidden"
                            />
                          </td>

                          {/* Column H: No HP */}
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
                              value={row.noHp}
                              onChange={(e) => handleCellChange(idx, 'noHp', e.target.value)}
                              placeholder="0812xxxx"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-slate-300 font-mono focus:outline-hidden"
                            />
                          </td>

                          {/* Validation Badge */}
                          <td className="border-r border-slate-800 p-1 text-center">
                            {row.statusValidation === 'VALID' ? (
                              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-sans font-bold inline-flex items-center space-x-1">
                                <CheckCircle2 size={10} />
                                <span>Valid</span>
                              </span>
                            ) : row.statusValidation === 'DUPLICATE' ? (
                              <span className="bg-rose-950 text-rose-400 border border-rose-800 text-[10px] px-2 py-0.5 rounded-full font-sans font-bold inline-flex items-center space-x-1" title={row.validationMessage}>
                                <AlertCircle size={10} />
                                <span>Duplikat</span>
                              </span>
                            ) : (
                              <span className="bg-amber-950 text-amber-400 border border-amber-800 text-[10px] px-2 py-0.5 rounded-full font-sans font-bold inline-flex items-center space-x-1" title={row.validationMessage}>
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
                              title="Hapus baris ini dari Excel"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reference Mapel */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <h4 className="font-bold text-emerald-400 text-xs mb-3 flex items-center space-x-2">
                  <Layers size={14} />
                  <span>Daftar Kode Mata Pelajaran (Referensi Import)</span>
                </h4>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800 text-xs">
                  {appState.mapelList.map((m) => (
                    <div key={m.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white">{m.namaMapel}</span>
                        <span className="text-slate-500 text-[11px] block">{m.kelompok || '-'}</span>
                      </div>
                      <span className="bg-blue-950 text-blue-300 font-mono border border-blue-800 px-2 py-0.5 rounded text-xs font-bold">
                        {m.kodeMapel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reference Kelas */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <h4 className="font-bold text-amber-400 text-xs mb-3 flex items-center space-x-2">
                  <Layers size={14} />
                  <span>Daftar Kode Kelas Rombel (Referensi Import)</span>
                </h4>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800 text-xs">
                  {appState.kelasList.map((k) => (
                    <div key={k.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white">{k.namaKelas}</span>
                        <span className="text-slate-500 text-[11px] block">Wali: {k.waliKelasNama}</span>
                      </div>
                      <span className="bg-emerald-950 text-emerald-300 font-mono border border-emerald-800 px-2 py-0.5 rounded text-xs font-bold">
                        {k.kodeKelas}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* EXCEL BOTTOM SHEET TABS & STATUS BAR */}
        <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          {/* Sheet Tabs */}
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
              <span>📊 Sheet1: Data Guru</span>
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
              <span>⚙️ Sheet2: Referensi Kode Mapel & Kelas</span>
            </button>
          </div>

          {/* Excel Status Bar */}
          <div className="flex items-center space-x-4 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>READY</span>
            </span>
            <span>Total Baris: {excelRows.length}</span>
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
