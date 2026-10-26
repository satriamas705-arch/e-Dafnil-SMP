import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { AppState, Mapel, NotificationLog } from '../../types';
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

interface ExcelMapelModalProps {
  appState: AppState;
  onClose: () => void;
  onUpdateMapelList: (newList: Mapel[], notif: NotificationLog) => void;
}

export interface ExcelMapelRow {
  id: string;
  urutan: number; // Urutan untuk transkrip nilai
  kodeMapel: string; // e.g. "MTK", "BIN", "IPA"
  namaMapel: string; // e.g. "Matematika", "Bahasa Indonesia"
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

export const ExcelMapelModal: React.FC<ExcelMapelModalProps> = ({
  appState,
  onClose,
  onUpdateMapelList,
}) => {
  const [activeSheetTab, setActiveSheetTab] = useState<'DATA' | 'REF'>('DATA');
  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert current mapel list to Excel row format for spreadsheet preview/editing
  const convertMapelToExcelRows = (list: Mapel[]): ExcelMapelRow[] => {
    return [...list]
      .sort((a, b) => (a.urutan || 99) - (b.urutan || 99))
      .map((m, idx) => ({
        id: m.id,
        urutan: m.urutan || idx + 1,
        kodeMapel: m.kodeMapel,
        namaMapel: m.namaMapel,
        statusValidation: 'VALID',
        validationMessage: 'Data terverifikasi',
      }));
  };

  const [excelRows, setExcelRows] = useState<ExcelMapelRow[]>(() =>
    convertMapelToExcelRows(appState.mapelList)
  );

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>({
    row: 0,
    col: 'C',
  });

  // Selected cell value for Formula Bar display
  const getSelectedCellValue = () => {
    if (!selectedCell || selectedCell.row < 0 || selectedCell.row >= excelRows.length) {
      return '=MAPEL("KURIKULUM_MERDEKA_SMP")';
    }
    const row = excelRows[selectedCell.row];
    switch (selectedCell.col) {
      case 'A': return (selectedCell.row + 1).toString();
      case 'B': return row.urutan.toString();
      case 'C': return row.kodeMapel;
      case 'D': return row.namaMapel;
      default: return '=CELL_VALUE()';
    }
  };

  // Cell Change Handler
  const handleCellChange = (rowIndex: number, field: keyof ExcelMapelRow, value: any) => {
    setExcelRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [field]: value,
      };

      if (field === 'urutan') {
        updated[rowIndex].urutan = parseInt(value) || 1;
      }
      if (field === 'kodeMapel' && value) {
        updated[rowIndex].kodeMapel = value.toString().toUpperCase().replace(/\s+/g, '');
      }

      // Re-validate
      const row = updated[rowIndex];
      if (!row.kodeMapel || !row.namaMapel) {
        row.statusValidation = 'WARNING';
        row.validationMessage = 'Kode Mapel dan Nama Mapel wajib diisi!';
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
    const newRow: ExcelMapelRow = {
      id: 'm-excel-' + Date.now(),
      urutan: nextNum,
      kodeMapel: `MPL${nextNum}`,
      namaMapel: `Mata Pelajaran ${nextNum}`,
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

    const ws = wb.addWorksheet('Data Mata Pelajaran', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF5B2C6F' } },
    });

    const totalCols = 7;
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
    const row3 = ws.addRow(['FORMAT & REKAPITULASI RESMI MATA PELAJARAN (KURIKULUM & TRANSKRIP)']);
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

    const row5 = ws.addRow([
      `Tahun Ajaran: ${activeTA.tahun} - Semester ${activeTA.semester}`,
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
      `Total Mata Pelajaran: ${excelRows.length} Mapel Terdaftar`,
    ]);
    row6.height = 20;
    row6.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } };
    row6.alignment = { vertical: 'middle' };

    ws.addRow([]).height = 8;

    // --- ROW 8: TABLE HEADERS ---
    const headerLabels = [
      'No',
      'Urutan Rapor / Transkrip',
      'Kode Mata Pelajaran',
      'Nama Lengkap Mata Pelajaran',
      'Kelompok Mapel',
      'KKM / Kriteria Ketercapaian',
      'Guru Pengampu',
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
        // No, Urutan: Dark Navy Blue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 4) {
        // Kode & Nama Mapel: Royal Purple
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B2C6F' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 6) {
        // Kelompok & KKM: Royal Blue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        // Guru Pengampu: Forest Green
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    // --- DATA ROWS ---
    excelRows.forEach((r, idx) => {
      const origMapel = appState.mapelList.find(
        (m) => m.kodeMapel.toLowerCase() === r.kodeMapel.toLowerCase() || m.id === r.id
      );

      // Find teachers who teach this subject
      const teachers = appState.guruList
        .filter((g) => {
          const mapelCodes = (g.mapelDiampu || []).map((c) => c.toLowerCase());
          return (
            mapelCodes.includes(r.kodeMapel.toLowerCase()) ||
            (origMapel && mapelCodes.includes(origMapel.id.toLowerCase()))
          );
        })
        .map((g) => g.nama)
        .join(', ');

      const kelompok = origMapel?.kelompok || 'A';
      const kkm = origMapel?.kkm || 75;

      const dataRow = ws.addRow([
        idx + 1,
        r.urutan,
        r.kodeMapel,
        r.namaMapel,
        kelompok,
        kkm,
        teachers || '-',
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
          // Urutan
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1B4F72' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 3) {
          // Kode Mapel
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF5B2C6F' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFDF4FF' : 'FFFFFFFF' } };
        } else if (colNumber === 4) {
          // Nama Mapel
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 5) {
          // Kelompok
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 6) {
          // KKM
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF2563EB' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else {
          // Guru Pengampu
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        }
      });
    });

    // Proportional Column Widths
    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'urutan', width: 24 },
      { key: 'kodeMapel', width: 22 },
      { key: 'namaMapel', width: 40 },
      { key: 'kelompok', width: 18 },
      { key: 'kkm', width: 26 },
      { key: 'guruPengampu', width: 38 },
    ];

    // --- SHEET 2: PETUNJUK FORMAT & PENGISIAN ---
    const wsHelp = wb.addWorksheet('Petunjuk Pengisian', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1E8449' } },
    });

    const helpTitle = wsHelp.addRow(['PANDUAN & PETUNJUK FORMAT PENGISIAN DATA MATA PELAJARAN']);
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
      ['1', 'URUTAN TRANSKRIP', 'Diisi nomor urut mapel pada cetak rapor / transkrip nilai kelulusan (Contoh: 1, 2, 3...).'],
      ['2', 'KODE MAPEL', 'Wajib diisi kode singkat mapel tanpa spasi (Contoh: PAI, PKN, BIN, MTK, IPA, IPS, BIG, PJOK, INF, SB, MLK).'],
      ['3', 'NAMA MATA PELAJARAN', 'Wajib diisi nama resmi mata pelajaran sesuai kurikulum yang berlaku.'],
      ['4', 'KELOMPOK MAPEL', 'Opsional: Diisi A (Umum), B (Muatan Lokal), atau C (Peminatan).'],
      ['5', 'KKM / KRITERIA', 'Opsional: Nilai KKM / Kriteria Ketercapaian Tujuan Pembelajaran (KKTP).'],
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

    const cleanSchool = (appState.sekolah?.namaSekolah || 'SMPN2_Kemranjen').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanTa = (activeTA.tahun || '2025-2026').replace(/\//g, '-');
    const fileName = `Export_Data_Mata_Pelajaran_${cleanSchool}_${cleanTa}.xlsx`;
    await saveWorkbook(wb, fileName);
  };

  // Download Sample Template .XLSX (Berwarna & Proporsional)
  const handleDownloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'e-Dafnil Assessment System';
    wb.lastModifiedBy = 'e-Dafnil Admin';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet('Template Data Mapel', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF5B2C6F' } },
    });

    const totalCols = 4;
    const kabName = appState.sekolah?.kabupatenKota?.toUpperCase() || 'BANYUMAS';
    const schName = appState.sekolah?.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN';

    // Kop
    const row1 = ws.addRow([`PEMERINTAH KABUPATEN ${kabName} - DINAS PENDIDIKAN`]);
    ws.mergeCells(1, 1, 1, totalCols);
    row1.height = 24;
    row1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row1.alignment = { vertical: 'middle', horizontal: 'center' };
    row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    const row2 = ws.addRow([`${schName} - TEMPLATE IMPORT MATA PELAJARAN`]);
    ws.mergeCells(2, 1, 2, totalCols);
    row2.height = 28;
    row2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    row2.alignment = { vertical: 'middle', horizontal: 'center' };
    row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E80' } };

    const row3 = ws.addRow(['TEMPLATE FORMULIR ENTRI MATA PELAJARAN KURIKULUM (OFFLINE ENTRY)']);
    ws.mergeCells(3, 1, 3, totalCols);
    row3.height = 22;
    row3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    row3.alignment = { vertical: 'middle', horizontal: 'center' };
    row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    ws.addRow([]).height = 8;

    const row5 = ws.addRow([
      `Panduan: Isi nomor urut transkrip, kode mapel tanpa spasi, dan nama lengkap mata pelajaran.`,
    ]);
    row5.height = 20;
    row5.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } };
    row5.alignment = { vertical: 'middle' };

    ws.addRow([]).height = 8;

    // Headers
    const headerLabels = [
      'No',
      'Urutan Transkrip',
      'Kode Mapel',
      'Nama Mata Pelajaran',
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
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B2C6F' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    const sampleSubjects = [
      { no: 1, urutan: 1, kode: 'PAI', nama: 'Pendidikan Agama & Budi Pekerti' },
      { no: 2, urutan: 2, kode: 'PKN', nama: 'Pendidikan Pancasila & Kewarganegaraan' },
      { no: 3, urutan: 3, kode: 'BIN', nama: 'Bahasa Indonesia' },
      { no: 4, urutan: 4, kode: 'MTK', nama: 'Matematika' },
      { no: 5, urutan: 5, kode: 'IPA', nama: 'Ilmu Pengetahuan Alam' },
      { no: 6, urutan: 6, kode: 'IPS', nama: 'Ilmu Pengetahuan Sosial' },
      { no: 7, urutan: 7, kode: 'BIG', nama: 'Bahasa Inggris' },
      { no: 8, urutan: 8, kode: 'PJOK', nama: 'Pendidikan Jasmani, Olahraga & Kesehatan' },
      { no: 9, urutan: 9, kode: 'INF', nama: 'Informatika' },
      { no: 10, urutan: 10, kode: 'SB', nama: 'Seni Budaya' },
      { no: 11, urutan: 11, kode: 'MLK', nama: 'Bahasa Jawa / Muatan Lokal' },
    ];

    sampleSubjects.forEach((s, idx) => {
      const dataRow = ws.addRow([
        s.no,
        s.urutan,
        s.kode,
        s.nama,
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
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1B4F72' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF5B2C6F' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFDF4FF' : 'FFFFFFFF' } };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        }
      });
    });

    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'urutan', width: 20 },
      { key: 'kode', width: 22 },
      { key: 'nama', width: 42 },
    ];

    // Sheet 2: Petunjuk Format
    const wsHelp = wb.addWorksheet('Petunjuk Pengisian', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1E8449' } },
    });
    const helpTitle = wsHelp.addRow(['PANDUAN & PETUNJUK FORMAT PENGISIAN DATA MATA PELAJARAN']);
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
      ['1', 'URUTAN TRANSKRIP', 'Diisi nomor urut urutan penampilan mapel pada transkrip atau lembar rapor.'],
      ['2', 'KODE MAPEL', 'Wajib diisi kode singkat mata pelajaran tanpa spasi (Contoh: PAI, BIN, MTK, IPA).'],
      ['3', 'NAMA MATA PELAJARAN', 'Wajib diisi nama mata pelajaran secara lengkap.'],
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

    const cleanSchool = (appState.sekolah?.namaSekolah || 'SMPN2_Kemranjen').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Template_Import_Data_Mata_Pelajaran_${cleanSchool}.xlsx`;
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

        // Search for header row containing Kode Mapel or Nama Mata Pelajaran
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(15, rawData.length); i++) {
          const rowStr = JSON.stringify(rawData[i] || []).toLowerCase();
          if (rowStr.includes('kode') && (rowStr.includes('mapel') || rowStr.includes('pelajaran'))) {
            headerRowIdx = i;
            break;
          } else if (rowStr.includes('nama mata pelajaran') || rowStr.includes('nama mapel') || rowStr.includes('urutan')) {
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
          alert('File Excel tidak memiliki baris data mata pelajaran yang valid!');
          return;
        }

        // Map parsed Excel JSON into ExcelMapelRow structure
        const parsedRows: ExcelMapelRow[] = jsonData.map((row, idx) => {
          const rawUrutan =
            row['Urutan Rapor / Transkrip'] ||
            row['Urutan Transkrip'] ||
            row['URUTAN TRANSKRIP'] ||
            row['Urutan'] ||
            row['URUTAN'] ||
            row['urutan_transkrip'] ||
            row['urutan'] ||
            row['No'] ||
            row['NO'] ||
            idx + 1;
          const urutan = parseInt(rawUrutan) || idx + 1;

          const kodeMapel = (
            row['Kode Mata Pelajaran'] ||
            row['Kode Mapel'] ||
            row['KODE MAPEL'] ||
            row['KODE'] ||
            row['kode_mapel'] ||
            row['kode'] ||
            ''
          )
            .toString()
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '');

          const namaMapel = (
            row['Nama Lengkap Mata Pelajaran'] ||
            row['Nama Mata Pelajaran'] ||
            row['NAMA MATA PELAJARAN'] ||
            row['Nama Mapel'] ||
            row['NAMA MAPEL'] ||
            row['NAMA'] ||
            row['nama_mapel'] ||
            row['nama'] ||
            ''
          )
            .toString()
            .trim();

          const isDuplicate = appState.mapelList.some(
            (m) => m.kodeMapel.toLowerCase() === kodeMapel.toLowerCase() && kodeMapel !== ''
          );

          let statusValidation: 'VALID' | 'WARNING' | 'DUPLICATE' = 'VALID';
          let validationMessage = 'Siap diimpor';

          if (!kodeMapel || !namaMapel) {
            statusValidation = 'WARNING';
            validationMessage = 'Kode atau Nama Mapel kosong';
          } else if (isDuplicate) {
            statusValidation = 'DUPLICATE';
            validationMessage = 'Kode Mapel sudah ada di database';
          }

          return {
            id: 'm-imp-' + idx + '-' + Date.now(),
            urutan,
            kodeMapel,
            namaMapel,
            statusValidation,
            validationMessage,
          };
        });

        setExcelRows(parsedRows);
        alert(
          `Berhasil membaca ${parsedRows.length} baris data mata pelajaran dari file Excel "${file.name}"! Silakan periksa di lembar kerja Excel.`
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

    const convertedMapelList: Mapel[] = excelRows.map((r, idx) => ({
      id: r.id || 'm-' + Math.random().toString(36).substring(2, 9),
      urutan: r.urutan || idx + 1,
      kodeMapel: r.kodeMapel || 'MPL',
      namaMapel: r.namaMapel || 'Mata Pelajaran',
    }));

    let finalMapelList: Mapel[] = [];
    if (importMode === 'REPLACE') {
      finalMapelList = convertedMapelList;
    } else {
      // MERGE: Update by Kode Mapel or append
      const existingMap = new Map<string, Mapel>();
      appState.mapelList.forEach((m) => existingMap.set(m.kodeMapel.toUpperCase(), m));
      convertedMapelList.forEach((m) => existingMap.set(m.kodeMapel.toUpperCase(), m));
      finalMapelList = Array.from(existingMap.values());
    }

    const notif = createNotification(
      'Import Data Mapel Excel',
      `Berhasil memperbarui data mata pelajaran dari Excel (${convertedMapelList.length} mapel diproses).`,
      'data-mapel'
    );

    onUpdateMapelList(finalMapelList, notif);
    alert(`Sukses! ${convertedMapelList.length} data mata pelajaran dari Excel telah berhasil disimpan ke dalam sistem.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 text-slate-100 rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-700 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* MS EXCEL TOP RIBBON HEADER */}
        <div className="bg-[#107c41] text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-black text-white text-base shadow-xs">
              X
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm tracking-wide">
                  Microsoft Excel — Modul Import & Export Data Mata Pelajaran
                </span>
                <span className="bg-emerald-800 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-600">
                  Live Spreadsheet Engine
                </span>
              </div>
              <p className="text-[11px] text-emerald-100 opacity-90">
                DATA_MAPEL_SIMPEGUR_2025_2026.xlsx • {excelRows.length} Baris Data Mapel
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
              <span>Tambah Baris Mapel</span>
            </button>

            <button
              onClick={() => setExcelRows(convertMapelToExcelRows(appState.mapelList))}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg border border-slate-600 flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Reset ke Data Mapel Saat Ini"
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
                  name="importModeMapel"
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
                  name="importModeMapel"
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
            <div className="min-w-[700px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-inner font-sans text-xs">
              <table className="w-full border-collapse">
                <thead>
                  {/* EXCEL COLUMN HEADERS (A, B, C, D...) */}
                  <tr className="bg-slate-800 text-slate-400 text-[11px] font-bold border-b border-slate-700">
                    <th className="w-10 border-r border-slate-700 p-1 text-center bg-slate-850">#</th>
                    <th className="w-12 border-r border-slate-700 p-1 text-center">A</th>
                    <th className="w-32 border-r border-slate-700 p-1 text-center">B (Urutan Transkrip)</th>
                    <th className="w-40 border-r border-slate-700 p-1 text-center">C (Kode Mapel)</th>
                    <th className="w-64 border-r border-slate-700 p-1 text-center">D (Nama Mata Pelajaran)</th>
                    <th className="w-28 border-r border-slate-700 p-1 text-center">Status</th>
                    <th className="w-12 p-1 text-center">Hapus</th>
                  </tr>

                  {/* EXCEL SHEET HEADER ROW 1 */}
                  <tr className="bg-[#107c41] text-white font-extrabold text-xs border-b border-emerald-800 shadow-sm">
                    <td className="border-r border-emerald-800 p-2 text-center bg-emerald-900 text-emerald-200 font-mono">1</td>
                    <td className="border-r border-emerald-800 p-2 text-center">No</td>
                    <td className="border-r border-emerald-800 p-2 text-center">Urutan Transkrip *</td>
                    <td className="border-r border-emerald-800 p-2">Kode Mapel *</td>
                    <td className="border-r border-emerald-800 p-2">Nama Mata Pelajaran *</td>
                    <td className="border-r border-emerald-800 p-2 text-center">Validasi</td>
                    <td className="p-2 text-center">Aksi</td>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 text-slate-200 font-mono">
                  {excelRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                        Belum ada data mata pelajaran. Klik "Tambah Baris Mapel" atau "Import .XLSX" untuk memulai.
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

                          {/* Column B: Urutan Transkrip */}
                          <td
                            className={`border-r border-slate-800 p-1 ${
                              selectedCell?.row === idx && selectedCell?.col === 'B'
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/40'
                                : ''
                            }`}
                            onClick={() => setSelectedCell({ row: idx, col: 'B' })}
                          >
                            <input
                              type="number"
                              min={1}
                              value={row.urutan}
                              onChange={(e) => handleCellChange(idx, 'urutan', e.target.value)}
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-center text-amber-300 font-mono font-extrabold focus:outline-hidden"
                            />
                          </td>

                          {/* Column C: Kode Mapel */}
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
                              value={row.kodeMapel}
                              onChange={(e) => handleCellChange(idx, 'kodeMapel', e.target.value)}
                              placeholder="MTK, BIN, IPA"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-blue-300 font-mono font-extrabold focus:outline-hidden"
                            />
                          </td>

                          {/* Column D: Nama Mata Pelajaran */}
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
                              value={row.namaMapel}
                              onChange={(e) => handleCellChange(idx, 'namaMapel', e.target.value)}
                              placeholder="Matematika"
                              className="w-full bg-transparent px-1.5 py-0.5 text-xs text-white font-sans font-bold focus:outline-hidden"
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
                              title="Hapus baris mapel ini"
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
                <span>Petunjuk Format Import Excel Data Mata Pelajaran</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-white text-xs block">1. Kolom Kode Mapel</span>
                  <p className="text-slate-400 leading-relaxed">
                    Kode singkat tanpa spasi untuk mata pelajaran (misal: <code className="text-blue-300 font-mono">MTK</code>, <code className="text-blue-300 font-mono">BIN</code>, <code className="text-blue-300 font-mono">IPA</code>, <code className="text-blue-300 font-mono">IPS</code>, <code className="text-blue-300 font-mono">BIG</code>, <code className="text-blue-300 font-mono">PAI</code>, <code className="text-blue-300 font-mono">INF</code>).
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-white text-xs block">2. Kolom Nama Mata Pelajaran</span>
                  <p className="text-slate-400 leading-relaxed">
                    Nama lengkap mata pelajaran sesuai dengan Kurikulum Merdeka (misal: <span className="text-white font-medium">Matematika, Bahasa Indonesia, Ilmu Pengetahuan Alam</span>).
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="font-bold text-amber-400 text-xs block mb-1">Catatan Penyederhanaan Kurikulum:</span>
                <p className="text-slate-400 leading-relaxed">
                  Bidang KKM, Kelompok Mapel, dan Jam per Minggu telah disederhanakan agar manajemen data mata pelajaran lebih fokus, fleksibel, dan terintegrasi langsung dengan penilaian.
                </p>
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
              <span>📊 Sheet1: Data Mata Pelajaran</span>
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
            <span>Total Mapel: {excelRows.length}</span>
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
