import React, { useState, useRef, useEffect } from 'react';
import { AppState, AuthUser, Siswa, Mapel, Kelas } from '../../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import {
  Award,
  Printer,
  FileDown,
  FileSpreadsheet,
  ArrowLeft,
  Settings,
  Eye,
  Sliders,
  Filter,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  School,
  Users,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  Download,
  Loader2,
  RefreshCw,
  BarChart3,
  Table as TableIcon,
  ShieldCheck,
} from 'lucide-react';

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

interface RekapNilaiProps {
  appState: AppState;
  authUser?: AuthUser | null;
}

export const RekapNilai: React.FC<RekapNilaiProps> = ({ appState, authUser }) => {
  const isGuru = authUser?.role === 'guru';
  const isAdmin = !authUser || authUser.role === 'admin';

  const currentGuru = isGuru
    ? appState.guruList.find(
        (g) =>
          g.id === authUser.guruId ||
          (authUser.nip && g.nip === authUser.nip) ||
          g.nama.toLowerCase() === authUser.nama.toLowerCase() ||
          g.nama.toLowerCase().includes(authUser.username.toLowerCase()) ||
          authUser.username.toLowerCase().includes(g.nama.toLowerCase().split(' ')[0])
      )
    : null;

  const waliClass = currentGuru
    ? appState.kelasList.find(
        (k) =>
          k.waliKelasId === currentGuru.id ||
          k.waliKelasNama?.toLowerCase() === currentGuru.nama.toLowerCase() ||
          (authUser?.nama && k.waliKelasNama?.toLowerCase().includes(authUser.nama.toLowerCase()))
      )
    : null;

  const isWaliKelas = isAdmin || Boolean(waliClass);

  // Main Tab State: 'siswa' (Rekap Per Siswa / Leger) or 'komparasi' (Rekap Statistik Antar Kelas - sesuai gambar)
  const [activeTab, setActiveTab] = useState<'siswa' | 'komparasi'>('siswa');

  // Selection State for Tab 1 (Rekap Siswa)
  const [selectedKelasId, setSelectedKelasId] = useState<string>(
    waliClass?.id || appState.kelasList[0]?.id || ''
  );
  const [selectedMapelId, setSelectedMapelId] = useState<string>('ALL');

  // If user is wali class and selectedKelasId is not set to their class, default to it
  useEffect(() => {
    if (waliClass && (!selectedKelasId || selectedKelasId === '')) {
      setSelectedKelasId(waliClass.id);
    }
  }, [waliClass]);

  if (isGuru && !isWaliKelas) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-md">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Akses Terbatas: Rekap Nilai</h2>
        <p className="text-sm text-slate-600">
          Sub menu Rekapitulasi Nilai hanya dapat diakses oleh <strong>Administrator</strong> dan <strong>Wali Kelas</strong>.
        </p>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
          Anda saat ini terdaftar sebagai Guru Mata Pelajaran. Untuk mengentri dan mengimpor nilai siswa pada mata pelajaran yang Anda ampu, silakan buka sub menu <strong>Input Nilai</strong>.
        </div>
      </div>
    );
  }

  // Selection State for Tab 2 (Rekap Komparasi Antar Kelas)
  const [komparasiMapelId, setKomparasiMapelId] = useState<string>('ALL');
  const [komparasiTingkat, setKomparasiTingkat] = useState<string>('ALL'); // 'ALL', '7', '8', '9'

  // View Mode: 'table' (halaman filter & tabel data) or 'print' (halaman cetak dokumen resmi)
  const [viewMode, setViewMode] = useState<'table' | 'print'>('table');

  // Print Configuration States
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [paperSize, setPaperSize] = useState<'A4' | 'F4'>('A4');
  const [showKopSurat, setShowKopSurat] = useState<boolean>(true);
  const [kopType, setKopType] = useState<'text' | 'banner'>(
    appState.sekolah.kopSekolahUrl ? 'banner' : 'text'
  );
  const [showTtd, setShowTtd] = useState<boolean>(true);
  const [showStempel, setShowStempel] = useState<boolean>(true);
  const [showStatistik, setShowStatistik] = useState<boolean>(true);
  const [fontSizeSetting, setFontSizeSetting] = useState<'compact' | 'normal' | 'large'>('normal');

  // Async States
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  const printDocumentRef = useRef<HTMLDivElement>(null);

  const activeTA = appState.tahunAjaranList.find(
    (t) => t.id === appState.activeTahunAjaranId
  ) || appState.tahunAjaranList[0] || { tahun: '2025/2026', semester: '1' };

  const selectedKelas = appState.kelasList.find((k) => k.id === selectedKelasId) || appState.kelasList[0];
  const selectedMapel = appState.mapelList.find((m) => m.id === selectedMapelId);

  const studentsInClass: Siswa[] = appState.siswaList
    .filter((s) => s.kelasId === selectedKelasId)
    .sort((a, b) => a.nama.localeCompare(b.nama));

  const totalL = studentsInClass.filter((s) => s.jenisKelamin === 'L').length;
  const totalP = studentsInClass.filter((s) => s.jenisKelamin === 'P').length;

  // Helper Predikat
  const getPredikat = (score: number) => {
    if (score >= 90) return { letter: 'A', label: 'Sangat Baik', color: 'bg-emerald-100 text-emerald-800' };
    if (score >= 80) return { letter: 'B', label: 'Baik', color: 'bg-blue-100 text-blue-800' };
    if (score >= 75) return { letter: 'C', label: 'Cukup', color: 'bg-amber-100 text-amber-800' };
    return { letter: 'D', label: 'Perlu Bimbingan', color: 'bg-rose-100 text-rose-800' };
  };

  // Student Summary Records for Tab 1
  interface StudentSummary {
    siswa: Siswa;
    scoresPerMapel: Record<string, number>;
    totalScore: number;
    avgScore: number;
    ranking: number;
    predikat: { letter: string; label: string; color: string };
    isTuntas: boolean;
    singleTpAvg?: number;
    singleSts?: number;
    singleSas?: number;
    singleNa?: number;
    singleCatatan?: string;
  }

  const calculatedSummaries: StudentSummary[] = studentsInClass.map((s) => {
    const scoresPerMapel: Record<string, number> = {};
    let total = 0;
    let count = 0;

    appState.mapelList.forEach((m) => {
      const rec = appState.nilaiSumatifList.find(
        (n) =>
          n.siswaId === s.id &&
          n.mapelId === m.id &&
          n.tahunAjaran === activeTA.tahun &&
          String(n.semester) === String(activeTA.semester)
      );
      const score = rec ? Number(rec.nilaiAkhir) : 82.5;
      scoresPerMapel[m.id] = score;
      total += score;
      count++;
    });

    const avg = count > 0 ? parseFloat((total / count).toFixed(2)) : 0;

    let singleTpAvg = 80;
    let singleSts = 80;
    let singleSas = 84;
    let singleNa = 82;
    let singleCatatan = 'Sangat baik dalam menguasai seluruh tujuan pembelajaran.';

    if (selectedMapelId !== 'ALL') {
      const singleRec = appState.nilaiSumatifList.find(
        (n) =>
          n.siswaId === s.id &&
          n.mapelId === selectedMapelId &&
          n.tahunAjaran === activeTA.tahun &&
          String(n.semester) === String(activeTA.semester)
      );
      if (singleRec) {
        const tpArr = singleRec.tps && singleRec.tps.length > 0
          ? singleRec.tps
          : [singleRec.tp1 ?? 80, singleRec.tp2 ?? 80, singleRec.tp3 ?? 80];
        singleTpAvg = parseFloat((tpArr.reduce((a, b) => a + b, 0) / Math.max(1, tpArr.length)).toFixed(2));
        singleSts = singleRec.sts ?? 80;
        singleSas = singleRec.sas ?? 84;
        singleNa = Number(singleRec.nilaiAkhir) || 82;
        singleCatatan = singleRec.catatan || 'Sangat baik dalam menguasai seluruh tujuan pembelajaran.';
      }
    }

    const effectiveScore = selectedMapelId === 'ALL' ? avg : singleNa;

    return {
      siswa: s,
      scoresPerMapel,
      totalScore: parseFloat(total.toFixed(2)),
      avgScore: avg,
      ranking: 1,
      predikat: getPredikat(effectiveScore),
      isTuntas: effectiveScore >= 75,
      singleTpAvg,
      singleSts,
      singleSas,
      singleNa,
      singleCatatan,
    };
  });

  const sortedForRank = [...calculatedSummaries].sort((a, b) => {
    const scoreA = selectedMapelId === 'ALL' ? a.avgScore : (a.singleNa ?? 0);
    const scoreB = selectedMapelId === 'ALL' ? b.avgScore : (b.singleNa ?? 0);
    return scoreB - scoreA;
  });

  sortedForRank.forEach((item, index) => {
    item.ranking = index + 1;
  });

  const allFinalScores = calculatedSummaries.map((c) =>
    selectedMapelId === 'ALL' ? c.avgScore : (c.singleNa ?? 0)
  );

  const avgKelas =
    allFinalScores.length > 0
      ? (allFinalScores.reduce((a, b) => a + b, 0) / allFinalScores.length).toFixed(2)
      : '0.00';

  const maxNilai = allFinalScores.length > 0 ? Math.max(...allFinalScores).toFixed(2) : '0.00';
  const minNilai = allFinalScores.length > 0 ? Math.min(...allFinalScores).toFixed(2) : '0.00';
  const jumlahTuntas = calculatedSummaries.filter((c) => c.isTuntas).length;
  const persenTuntas =
    calculatedSummaries.length > 0
      ? ((jumlahTuntas / calculatedSummaries.length) * 100).toFixed(1)
      : '100';

  const mapelStats: Record<string, { total: number; avg: number; max: number; min: number }> = {};
  appState.mapelList.forEach((m) => {
    const vals = calculatedSummaries.map((s) => s.scoresPerMapel[m.id] || 0);
    const sum = vals.reduce((a, b) => a + b, 0);
    mapelStats[m.id] = {
      total: parseFloat(sum.toFixed(2)),
      avg: vals.length > 0 ? parseFloat((sum / vals.length).toFixed(2)) : 0,
      max: vals.length > 0 ? Math.max(...vals) : 0,
      min: vals.length > 0 ? Math.min(...vals) : 0,
    };
  });

  // =========================================================================
  // TAB 2 DATA CALCULATION: REKAP STATISTIK ANTAR KELAS (SESUAI GAMBAR)
  // Columns: Kelas | Nilai Sumatif [NTT, NTR, RT] | STS [NTT, NTR, RT] | SAS [NTT, NTR, RT] | Rapor [NTT, NTR, RT]
  // =========================================================================
  interface KelasStatRow {
    kelas: Kelas;
    jumlahSiswa: number;
    // Nilai Sumatif (Rerata TP)
    sumatifNtt: number;
    sumatifNtr: number;
    sumatifRt: number;
    // STS
    stsNtt: number;
    stsNtr: number;
    stsRt: number;
    // SAS
    sasNtt: number;
    sasNtr: number;
    sasRt: number;
    // Rapor (Nilai Akhir)
    raporNtt: number;
    raporNtr: number;
    raporRt: number;
  }

  const filteredKelasList = appState.kelasList.filter((k) => {
    if (komparasiTingkat === 'ALL') return true;
    return String(k.tingkat) === komparasiTingkat;
  });

  const selectedKomparasiMapel = appState.mapelList.find((m) => m.id === komparasiMapelId);

  const komparasiRows: KelasStatRow[] = filteredKelasList.map((k) => {
    const classStudents = appState.siswaList.filter((s) => s.kelasId === k.id);
    const count = classStudents.length;

    if (count === 0) {
      return {
        kelas: k,
        jumlahSiswa: 0,
        sumatifNtt: 0,
        sumatifNtr: 0,
        sumatifRt: 0,
        stsNtt: 0,
        stsNtr: 0,
        stsRt: 0,
        sasNtt: 0,
        sasNtr: 0,
        sasRt: 0,
        raporNtt: 0,
        raporNtr: 0,
        raporRt: 0,
      };
    }

    const sumatifVals: number[] = [];
    const stsVals: number[] = [];
    const sasVals: number[] = [];
    const raporVals: number[] = [];

    classStudents.forEach((s) => {
      if (komparasiMapelId === 'ALL') {
        // Average across all subjects for this student
        const studentSumatifs: number[] = [];
        const studentSts: number[] = [];
        const studentSas: number[] = [];
        const studentRapors: number[] = [];

        appState.mapelList.forEach((m) => {
          const rec = appState.nilaiSumatifList.find(
            (n) =>
              n.siswaId === s.id &&
              n.mapelId === m.id &&
              n.tahunAjaran === activeTA.tahun &&
              String(n.semester) === String(activeTA.semester)
          );
          if (rec) {
            const tpArr = rec.tps && rec.tps.length > 0 ? rec.tps : [rec.tp1 ?? 80, rec.tp2 ?? 80, rec.tp3 ?? 80];
            const avgTp = tpArr.reduce((a, b) => a + b, 0) / Math.max(1, tpArr.length);
            studentSumatifs.push(avgTp);
            studentSts.push(rec.sts ?? 80);
            studentSas.push(rec.sas ?? 84);
            studentRapors.push(Number(rec.nilaiAkhir) || 82);
          } else {
            studentSumatifs.push(80);
            studentSts.push(80);
            studentSas.push(84);
            studentRapors.push(82);
          }
        });

        const sSumatif = studentSumatifs.reduce((a, b) => a + b, 0) / Math.max(1, studentSumatifs.length);
        const sSts = studentSts.reduce((a, b) => a + b, 0) / Math.max(1, studentSts.length);
        const sSas = studentSas.reduce((a, b) => a + b, 0) / Math.max(1, studentSas.length);
        const sRapor = studentRapors.reduce((a, b) => a + b, 0) / Math.max(1, studentRapors.length);

        sumatifVals.push(sSumatif);
        stsVals.push(sSts);
        sasVals.push(sSas);
        raporVals.push(sRapor);
      } else {
        // Specific subject
        const rec = appState.nilaiSumatifList.find(
          (n) =>
            n.siswaId === s.id &&
            n.mapelId === komparasiMapelId &&
            n.tahunAjaran === activeTA.tahun &&
            String(n.semester) === String(activeTA.semester)
        );
        if (rec) {
          const tpArr = rec.tps && rec.tps.length > 0 ? rec.tps : [rec.tp1 ?? 80, rec.tp2 ?? 80, rec.tp3 ?? 80];
          const avgTp = tpArr.reduce((a, b) => a + b, 0) / Math.max(1, tpArr.length);
          sumatifVals.push(avgTp);
          stsVals.push(rec.sts ?? 80);
          sasVals.push(rec.sas ?? 84);
          raporVals.push(Number(rec.nilaiAkhir) || 82);
        } else {
          sumatifVals.push(80);
          stsVals.push(80);
          sasVals.push(84);
          raporVals.push(82);
        }
      }
    });

    const sumSumatif = sumatifVals.reduce((a, b) => a + b, 0);
    const sumSts = stsVals.reduce((a, b) => a + b, 0);
    const sumSas = sasVals.reduce((a, b) => a + b, 0);
    const sumRapor = raporVals.reduce((a, b) => a + b, 0);

    return {
      kelas: k,
      jumlahSiswa: count,
      sumatifNtt: sumatifVals.length > 0 ? Math.max(...sumatifVals) : 0,
      sumatifNtr: sumatifVals.length > 0 ? Math.min(...sumatifVals) : 0,
      sumatifRt: sumatifVals.length > 0 ? sumSumatif / sumatifVals.length : 0,
      stsNtt: stsVals.length > 0 ? Math.max(...stsVals) : 0,
      stsNtr: stsVals.length > 0 ? Math.min(...stsVals) : 0,
      stsRt: stsVals.length > 0 ? sumSts / stsVals.length : 0,
      sasNtt: sasVals.length > 0 ? Math.max(...sasVals) : 0,
      sasNtr: sasVals.length > 0 ? Math.min(...sasVals) : 0,
      sasRt: sasVals.length > 0 ? sumSas / sasVals.length : 0,
      raporNtt: raporVals.length > 0 ? Math.max(...raporVals) : 0,
      raporNtr: raporVals.length > 0 ? Math.min(...raporVals) : 0,
      raporRt: raporVals.length > 0 ? sumRapor / raporVals.length : 0,
    };
  });

  // Global School Summary for Tab 2
  const allSumatifNtt = komparasiRows.length > 0 ? Math.max(...komparasiRows.map((r) => r.sumatifNtt)) : 0;
  const allSumatifNtr = komparasiRows.length > 0 ? Math.min(...komparasiRows.map((r) => r.sumatifNtr)) : 0;
  const allSumatifRt =
    komparasiRows.length > 0
      ? komparasiRows.reduce((a, b) => a + b.sumatifRt, 0) / komparasiRows.length
      : 0;

  const allStsNtt = komparasiRows.length > 0 ? Math.max(...komparasiRows.map((r) => r.stsNtt)) : 0;
  const allStsNtr = komparasiRows.length > 0 ? Math.min(...komparasiRows.map((r) => r.stsNtr)) : 0;
  const allStsRt =
    komparasiRows.length > 0
      ? komparasiRows.reduce((a, b) => a + b.stsRt, 0) / komparasiRows.length
      : 0;

  const allSasNtt = komparasiRows.length > 0 ? Math.max(...komparasiRows.map((r) => r.sasNtt)) : 0;
  const allSasNtr = komparasiRows.length > 0 ? Math.min(...komparasiRows.map((r) => r.sasNtr)) : 0;
  const allSasRt =
    komparasiRows.length > 0
      ? komparasiRows.reduce((a, b) => a + b.sasRt, 0) / komparasiRows.length
      : 0;

  const allRaporNtt = komparasiRows.length > 0 ? Math.max(...komparasiRows.map((r) => r.raporNtt)) : 0;
  const allRaporNtr = komparasiRows.length > 0 ? Math.min(...komparasiRows.map((r) => r.raporNtr)) : 0;
  const allRaporRt =
    komparasiRows.length > 0
      ? komparasiRows.reduce((a, b) => a + b.raporRt, 0) / komparasiRows.length
      : 0;

  // =========================================================================
  // EXPORT EXCEL DENGAN EXCELJS (BERWARNA, PROPORSIONAL & PERSISI)
  // =========================================================================
  const handleExportExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'e-Dafnil Assessment System';
      wb.lastModifiedBy = 'e-Dafnil Admin';
      wb.created = new Date();
      wb.modified = new Date();

      const kabName = appState.sekolah?.kabupatenKota?.toUpperCase() || 'BANYUMAS';
      const schName = appState.sekolah?.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN';
      const todayStr = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      if (activeTab === 'komparasi') {
        // =========================================================================
        // EXPORT FORMAT SESUAI GAMBAR: REKAP NILAI ANTAR KELAS (KOMPARASI ROMBEL)
        // =========================================================================
        const ws = wb.addWorksheet('Rekap Nilai Antar Kelas', {
          views: [{ showGridLines: true }],
          properties: { tabColor: { argb: 'FF1B4F72' } },
        });

        const totalCols = 13; // Kelas + 3 (Sumatif) + 3 (STS) + 3 (SAS) + 3 (Rapor)

        // Kop Row 1
        const r1 = ws.addRow([`PEMERINTAH KABUPATEN ${kabName} - DINAS PENDIDIKAN`]);
        ws.mergeCells(1, 1, 1, totalCols);
        r1.height = 24;
        r1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        r1.alignment = { vertical: 'middle', horizontal: 'center' };
        r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

        // Kop Row 2
        const r2 = ws.addRow([`${schName} - SISTEM e-DAFNIL / REKAPITULASI NILAI`]);
        ws.mergeCells(2, 1, 2, totalCols);
        r2.height = 28;
        r2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
        r2.alignment = { vertical: 'middle', horizontal: 'center' };
        r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E80' } };

        // Title Row 3
        const mapelLabel = komparasiMapelId === 'ALL' ? 'SEMUA MATA PELAJARAN (GABUNGAN)' : selectedKomparasiMapel?.namaMapel?.toUpperCase();
        const r3 = ws.addRow([`REKAPITULASI STATISTIK NILAI ROMBEL KELAS (${mapelLabel})`]);
        ws.mergeCells(3, 1, 3, totalCols);
        r3.height = 22;
        r3.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF0F3D64' } };
        r3.alignment = { vertical: 'middle', horizontal: 'center' };
        r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

        ws.addRow([]).height = 8;

        // Metadata Row 5
        const r5 = ws.addRow([]);
        r5.height = 24;
        ws.mergeCells(5, 1, 5, 5);
        const cellTA = ws.getCell(5, 1);
        cellTA.value = `Tahun Ajaran: ${activeTA.tahun}  |  Semester: ${activeTA.semester}`;
        cellTA.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F3D64' } };
        cellTA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        ws.mergeCells(5, 6, 5, totalCols);
        const cellSch = ws.getCell(5, 6);
        cellSch.value = `Satuan Pendidikan: ${appState.sekolah?.namaSekolah} (NPSN: ${appState.sekolah?.npsn || '20307730'})`;
        cellSch.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
        cellSch.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        for (let c = 1; c <= totalCols; c++) {
          const cell = ws.getCell(5, c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: c === 1 || c === 6 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
            right: c === 5 || c === totalCols ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          };
        }

        // Metadata Row 6
        const r6 = ws.addRow([]);
        r6.height = 24;
        ws.mergeCells(6, 1, 6, 5);
        const cellDate = ws.getCell(6, 1);
        cellDate.value = `Tanggal Cetak: ${todayStr}`;
        cellDate.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
        cellDate.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        ws.mergeCells(6, 6, 6, totalCols);
        const cellKet = ws.getCell(6, 6);
        cellKet.value = `Keterangan: NTT = Nilai Tertinggi | NTR = Nilai Terendah | RT = Rata-Rata`;
        cellKet.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
        cellKet.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        for (let c = 1; c <= totalCols; c++) {
          const cell = ws.getCell(6, c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: c === 1 || c === 6 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
            right: c === 5 || c === totalCols ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          };
        }

        ws.addRow([]).height = 8;

        // Table Header Row 1 (Super Headers)
        const headerRow1 = ws.addRow([
          'Kelas',
          'Nilai Sumatif',
          '',
          '',
          'STS',
          '',
          '',
          'SAS',
          '',
          '',
          'Rapor',
          '',
          '',
        ]);
        headerRow1.height = 26;

        // Table Header Row 2 (Sub Headers)
        const headerRow2 = ws.addRow([
          '',
          'NTT',
          'NTR',
          'RT',
          'NTT',
          'NTR',
          'RT',
          'NTT',
          'NTR',
          'RT',
          'NTT',
          'NTR',
          'RT',
        ]);
        headerRow2.height = 24;

        // Merge Header Cells
        ws.mergeCells(8, 1, 9, 1); // Kelas
        ws.mergeCells(8, 2, 8, 4); // Nilai Sumatif
        ws.mergeCells(8, 5, 8, 7); // STS
        ws.mergeCells(8, 8, 8, 10); // SAS
        ws.mergeCells(8, 11, 8, 13); // Rapor

        // Style Headers
        // Kelas (Col 1)
        const cellKelas = ws.getCell(8, 1);
        cellKelas.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };
        cellKelas.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cellKelas.alignment = { vertical: 'middle', horizontal: 'center' };

        // Nilai Sumatif (Cols 2-4) - Blue Navy
        for (let col = 2; col <= 4; col++) {
          const c1 = ws.getCell(8, col);
          const c2 = ws.getCell(9, col);
          c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
          c1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          c1.alignment = { vertical: 'middle', horizontal: 'center' };
          c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
          c2.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
          c2.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // STS (Cols 5-7) - Royal Blue / Slate
        for (let col = 5; col <= 7; col++) {
          const c1 = ws.getCell(8, col);
          const c2 = ws.getCell(9, col);
          c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2471A3' } };
          c1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          c1.alignment = { vertical: 'middle', horizontal: 'center' };
          c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5499C7' } };
          c2.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
          c2.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // SAS (Cols 8-10) - Indigo / Purple
        for (let col = 8; col <= 10; col++) {
          const c1 = ws.getCell(8, col);
          const c2 = ws.getCell(9, col);
          c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B2C6F' } };
          c1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          c1.alignment = { vertical: 'middle', horizontal: 'center' };
          c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF884EA0' } };
          c2.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
          c2.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // Rapor (Cols 11-13) - Forest Green
        for (let col = 11; col <= 13; col++) {
          const c1 = ws.getCell(8, col);
          const c2 = ws.getCell(9, col);
          c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF196F3D' } };
          c1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          c1.alignment = { vertical: 'middle', horizontal: 'center' };
          c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27AE60' } };
          c2.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
          c2.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // Apply borders to headers
        [8, 9].forEach((rowNum) => {
          const row = ws.getRow(rowNum);
          for (let col = 1; col <= totalCols; col++) {
            const cell = row.getCell(col);
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
              bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
              left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
              right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            };
          }
        });

        // Add Data Rows
        komparasiRows.forEach((r, idx) => {
          const dataRow = ws.addRow([
            r.kelas.namaKelas,
            r.sumatifNtt.toFixed(1),
            r.sumatifNtr.toFixed(1),
            r.sumatifRt.toFixed(2),
            r.stsNtt.toFixed(1),
            r.stsNtr.toFixed(1),
            r.stsRt.toFixed(2),
            r.sasNtt.toFixed(1),
            r.sasNtr.toFixed(1),
            r.sasRt.toFixed(2),
            r.raporNtt.toFixed(1),
            r.raporNtr.toFixed(1),
            r.raporRt.toFixed(2),
          ]);
          dataRow.height = 24;

          const isEven = idx % 2 === 1;
          const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

          dataRow.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };

            if (colNumber === 1) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFEFF6FF' : 'FFFFFFFF' } };
            } else {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };

              // Highlight Rata-Rata Rapor Column
              if (colNumber === 13) {
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF15803D' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF0FDF4' : 'FFFFFFFF' } };
              }
            }
          });
        });

        // Summary Footer Row (RATA-RATA SEKOLAH)
        const summaryRow = ws.addRow([
          'RATA-RATA SEKOLAH',
          allSumatifNtt.toFixed(1),
          allSumatifNtr.toFixed(1),
          allSumatifRt.toFixed(2),
          allStsNtt.toFixed(1),
          allStsNtr.toFixed(1),
          allStsRt.toFixed(2),
          allSasNtt.toFixed(1),
          allSasNtr.toFixed(1),
          allSasRt.toFixed(2),
          allRaporNtt.toFixed(1),
          allRaporNtr.toFixed(1),
          allRaporRt.toFixed(2),
        ]);
        summaryRow.height = 26;

        summaryRow.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'medium', color: { argb: 'FF0F3D64' } },
            bottom: { style: 'medium', color: { argb: 'FF0F3D64' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        });

        // Column Widths
        ws.columns = [
          { key: 'kelas', width: 16 },
          { key: 's_ntt', width: 12 },
          { key: 's_ntr', width: 12 },
          { key: 's_rt', width: 14 },
          { key: 'sts_ntt', width: 12 },
          { key: 'sts_ntr', width: 12 },
          { key: 'sts_rt', width: 14 },
          { key: 'sas_ntt', width: 12 },
          { key: 'sas_ntr', width: 12 },
          { key: 'sas_rt', width: 14 },
          { key: 'r_ntt', width: 12 },
          { key: 'r_ntr', width: 12 },
          { key: 'r_rt', width: 15 },
        ];

        const cleanSchool = (appState.sekolah?.namaSekolah || 'Sekolah').replace(/[^a-zA-Z0-9]/g, '_');
        const cleanTA = (activeTA.tahun || '2025-2026').replace(/\//g, '-');
        const fileName = `Rekap_Nilai_Komparasi_Kelas_${cleanSchool}_Sem${activeTA.semester}_${cleanTA}.xlsx`;
        await saveWorkbook(wb, fileName);
        setPdfToast(`Excel berhasil diekspor: ${fileName}`);
        setTimeout(() => setPdfToast(null), 4000);
      } else {
        // =========================================================================
        // EXPORT FORMAT TAB 1: REKAP SISWA (LEGER MATRIKS ATAU SINGLE MAPEL)
        // =========================================================================
        const ws = wb.addWorksheet('Rekap Nilai Siswa', {
          views: [{ showGridLines: true }],
          properties: { tabColor: { argb: 'FF1B4F72' } },
        });

        if (selectedMapelId === 'ALL') {
          // Matrix Leger All Subjects
          const totalCols = 5 + appState.mapelList.length + 6;

          // Kop Row 1
          const r1 = ws.addRow([`PEMERINTAH KABUPATEN ${kabName} - DINAS PENDIDIKAN`]);
          ws.mergeCells(1, 1, 1, totalCols);
          r1.height = 24;
          r1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          r1.alignment = { vertical: 'middle', horizontal: 'center' };
          r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

          // Kop Row 2
          const r2 = ws.addRow([`${schName} - LEGER NILAI SUMATIF RAPOR SISWA`]);
          ws.mergeCells(2, 1, 2, totalCols);
          r2.height = 28;
          r2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
          r2.alignment = { vertical: 'middle', horizontal: 'center' };
          r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E80' } };

          // Title Row 3
          const r3 = ws.addRow([`REKAPITULASI LEGER MATRIKS NILAI KELAS ${selectedKelas?.namaKelas?.toUpperCase()}`]);
          ws.mergeCells(3, 1, 3, totalCols);
          r3.height = 22;
          r3.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF0F3D64' } };
          r3.alignment = { vertical: 'middle', horizontal: 'center' };
          r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

          ws.addRow([]).height = 8;

          const r5 = ws.addRow([]);
          r5.height = 24;
          ws.mergeCells(5, 1, 5, 5);
          const cellKelas = ws.getCell(5, 1);
          cellKelas.value = `Kelas: ${selectedKelas?.namaKelas} (Wali Kelas: ${selectedKelas?.waliKelasNama})`;
          cellKelas.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F3D64' } };
          cellKelas.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

          ws.mergeCells(5, 6, 5, totalCols);
          const cellTA = ws.getCell(5, 6);
          cellTA.value = `Tahun Ajaran: ${activeTA.tahun}  |  Semester: ${activeTA.semester}`;
          cellTA.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
          cellTA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

          for (let c = 1; c <= totalCols; c++) {
            const cell = ws.getCell(5, c);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              left: c === 1 || c === 6 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
              right: c === 5 || c === totalCols ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
            };
          }

          ws.addRow([]).height = 8;

          // Header
          const headerLabels = [
            'No',
            'NISN',
            'NIS',
            'Nama Lengkap Siswa',
            'L/P',
            ...appState.mapelList.map((m) => m.kodeMapel),
            'Total Nilai',
            'Rata-Rata',
            'Ranking',
            'Predikat',
            'Status',
          ];

          const headerRow = ws.addRow(headerLabels);
          headerRow.height = 30;
          headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

          headerRow.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'medium', color: { argb: 'FF0F3D64' } },
              bottom: { style: 'medium', color: { argb: 'FF0F3D64' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            };

            if (colNumber <= 5) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
              cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
            } else if (colNumber <= 5 + appState.mapelList.length) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
              cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
              cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
            }
          });

          // Data
          calculatedSummaries.forEach((s, idx) => {
            const dataRow = ws.addRow([
              idx + 1,
              s.siswa.nisn,
              s.siswa.nis,
              s.siswa.nama,
              s.siswa.jenisKelamin,
              ...appState.mapelList.map((m) => s.scoresPerMapel[m.id] ?? 82.5),
              s.totalScore,
              s.avgScore,
              `#${s.ranking}`,
              s.predikat.letter,
              s.isTuntas ? 'TUNTAS' : 'BELUM TUNTAS',
            ]);
            dataRow.height = 23;

            const isEven = idx % 2 === 1;
            const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

            dataRow.eachCell((cell, colNumber) => {
              cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              };

              if (colNumber === 1) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF64748B' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
              } else if (colNumber === 4) {
                cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
              } else {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
              }
            });
          });

          // Summary Rows
          const avgRow = ws.addRow([
            'RATA-RATA KELAS',
            '',
            '',
            '',
            '',
            ...appState.mapelList.map((m) => (mapelStats[m.id]?.avg ?? 0).toFixed(1)),
            '',
            avgKelas,
            '',
            '',
            `Tuntas: ${persenTuntas}%`,
          ]);
          avgRow.height = 24;
          ws.mergeCells(ws.rowCount, 1, ws.rowCount, 5);
          avgRow.eachCell((c) => {
            c.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F3D64' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            c.alignment = { vertical: 'middle', horizontal: 'center' };
          });

          ws.columns = [
            { width: 6 },
            { width: 14 },
            { width: 12 },
            { width: 28 },
            { width: 8 },
            ...appState.mapelList.map(() => ({ width: 10 })),
            { width: 14 },
            { width: 14 },
            { width: 12 },
            { width: 12 },
            { width: 16 },
          ];
        } else {
          // Single Mapel Export
          const totalCols = 12;

          const r1 = ws.addRow([`PEMERINTAH KABUPATEN ${kabName} - DINAS PENDIDIKAN`]);
          ws.mergeCells(1, 1, 1, totalCols);
          r1.height = 24;
          r1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          r1.alignment = { vertical: 'middle', horizontal: 'center' };
          r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

          const r2 = ws.addRow([`${schName} - REKAP NILAI MATA PELAJARAN`]);
          ws.mergeCells(2, 1, 2, totalCols);
          r2.height = 28;
          r2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
          r2.alignment = { vertical: 'middle', horizontal: 'center' };
          r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E80' } };

          const r3 = ws.addRow([`MATA PELAJARAN: ${selectedMapel?.namaMapel?.toUpperCase()} - KELAS ${selectedKelas?.namaKelas}`]);
          ws.mergeCells(3, 1, 3, totalCols);
          r3.height = 22;
          r3.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF0F3D64' } };
          r3.alignment = { vertical: 'middle', horizontal: 'center' };
          r3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

          ws.addRow([]).height = 8;

          const headerLabels = [
            'No',
            'NISN',
            'NIS',
            'Nama Lengkap Siswa',
            'L/P',
            'Rerata TP',
            'Nilai STS',
            'Nilai SAS',
            'Nilai Akhir',
            'Predikat',
            'Status',
            'Deskripsi Capaian Kompetensi',
          ];

          const headerRow = ws.addRow(headerLabels);
          headerRow.height = 30;
          headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

          headerRow.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'medium', color: { argb: 'FF0F3D64' } },
              bottom: { style: 'medium', color: { argb: 'FF0F3D64' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNumber <= 5 ? 'FF1B4F72' : 'FF2874A6' } };
            cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
          });

          calculatedSummaries.forEach((s, idx) => {
            const dataRow = ws.addRow([
              idx + 1,
              s.siswa.nisn,
              s.siswa.nis,
              s.siswa.nama,
              s.siswa.jenisKelamin,
              s.singleTpAvg,
              s.singleSts,
              s.singleSas,
              s.singleNa,
              s.predikat.letter,
              s.isTuntas ? 'TUNTAS' : 'BELUM TUNTAS',
              s.singleCatatan,
            ]);
            dataRow.height = 23;

            const isEven = idx % 2 === 1;
            const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

            dataRow.eachCell((cell, colNumber) => {
              cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              };
              if (colNumber === 4 || colNumber === 12) {
                cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
              } else {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
              }
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
              cell.font = { name: 'Arial', size: 9.5 };
            });
          });

          ws.columns = [
            { width: 6 },
            { width: 14 },
            { width: 12 },
            { width: 28 },
            { width: 8 },
            { width: 12 },
            { width: 12 },
            { width: 12 },
            { width: 14 },
            { width: 12 },
            { width: 14 },
            { width: 45 },
          ];
        }

        const safeKelas = (selectedKelas?.namaKelas || 'Kelas').replace(/\s+/g, '_');
        const safeMapel = (selectedMapelId === 'ALL' ? 'Leger_Semua_Mapel' : selectedMapel?.kodeMapel || 'Mapel').replace(/\s+/g, '_');
        const safeTA = (activeTA.tahun || '2025-2026').replace(/\//g, '-');
        const fileName = `Rekap_Nilai_${safeKelas}_${safeMapel}_Sem${activeTA.semester}_${safeTA}.xlsx`;
        await saveWorkbook(wb, fileName);
        setPdfToast(`Excel berhasil diekspor: ${fileName}`);
        setTimeout(() => setPdfToast(null), 4000);
      }
    } catch (e) {
      console.error('Gagal export excel:', e);
      alert('Gagal mengekspor file Excel.');
    }
  };

  // Action: Print via Browser
  const handlePrint = () => {
    window.print();
  };

  // Action: Download PDF using html2canvas & jsPDF
  const handleDownloadPDF = async () => {
    if (!printDocumentRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const element = printDocumentRef.current;

      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const isLandscape = printOrientation === 'landscape';

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: paperSize === 'F4' ? [215, 330] : 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      while (heightLeft > 5) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      const safeSuffix =
        activeTab === 'komparasi'
          ? 'Komparasi_Antar_Kelas'
          : `${(selectedKelas?.namaKelas || 'Kelas').replace(/\s+/g, '_')}_${(selectedMapelId === 'ALL' ? 'Leger' : selectedMapel?.kodeMapel || 'Mapel').replace(/\s+/g, '_')}`;
      const safeTA = (activeTA.tahun || '2025-2026').replace(/\//g, '-');
      const fileName = `Rekap_Nilai_${safeSuffix}_Sem${activeTA.semester}_${safeTA}.pdf`;

      pdf.save(fileName);
      setPdfToast(`PDF berhasil diunduh: ${fileName}`);
      setTimeout(() => setPdfToast(null), 4000);
    } catch (error) {
      console.error('Gagal generate PDF:', error);
      alert('Terjadi kendala saat membuat file PDF. Silakan gunakan tombol Cetak -> Simpan sebagai PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getTableFontSizeClass = () => {
    if (fontSizeSetting === 'compact') return 'text-[9.5px] leading-tight';
    if (fontSizeSetting === 'large') return 'text-[12px] leading-normal';
    return 'text-[11px] leading-snug';
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {pdfToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{pdfToast}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE 1: HALAMAN DATA & TABEL INTERAKTIF */}
      {/* ========================================================================= */}
      {viewMode === 'table' && (
        <div className="space-y-6">
          {/* Header Banner & Tab Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Award size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Rekapitulasi Nilai Asesmen
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Rekap nilai rapor siswa, leger kurikulum merdeka, serta komparasi statistik nilai antar rombel kelas.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons: Unduh Excel, Unduh PDF, Cetak */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
                title="Ekspor ke format Microsoft Excel (.xlsx) berwarna & proporsional"
              >
                <FileSpreadsheet size={16} />
                <span>Unduh Excel</span>
              </button>

              <button
                onClick={() => {
                  setViewMode('print');
                  setTimeout(() => handleDownloadPDF(), 300);
                }}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
                title="Unduh langsung lembar rekapitulasi ke format PDF"
              >
                <FileDown size={16} />
                <span>Unduh PDF</span>
              </button>

              <button
                onClick={() => setViewMode('print')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2 cursor-pointer"
                title="Tampilkan Halaman Cetak Dokumen Rekapitulasi Lengkap"
              >
                <Printer size={16} />
                <span>Cetak Rekapitulasi</span>
              </button>
            </div>
          </div>

          {/* Wali Kelas / Admin Role Badge */}
          {waliClass && (
            <div className="bg-gradient-to-r from-teal-800 to-blue-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-xs border border-teal-700/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/15 rounded-xl">
                  <ShieldCheck size={18} className="text-teal-300" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-white">
                    Akses Wali Kelas: {waliClass.namaKelas}
                  </span>
                  <p className="text-[11px] text-teal-200">
                    Wali Kelas: {waliClass.waliKelasNama} • Memiliki hak akses penuh untuk melihat rekapitulasi & komparasi nilai.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedKelasId(waliClass.id)}
                className="text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                Pilih Kelas Saya ({waliClass.kodeKelas})
              </button>
            </div>
          )}

          {/* Sub Menu / View Selector Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1.5">
            <button
              onClick={() => setActiveTab('siswa')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'siswa'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <TableIcon size={16} />
              <span>Rekap Nilai Siswa / Leger Rombel</span>
            </button>

            <button
              onClick={() => setActiveTab('komparasi')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeTab === 'komparasi'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <BarChart3 size={16} />
              <span>Rekap Nilai Antar Kelas (Statistik: Sumatif, STS, SAS, Rapor)</span>
              <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-extrabold uppercase">
                Format Baru
              </span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: REKAP NILAI SISWA PER KELAS / LEGER */}
          {/* ========================================================================= */}
          {activeTab === 'siswa' && (
            <div className="space-y-6">
              {/* Filters Toolbar */}
              <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <Users size={14} className="text-blue-600" />
                    <span>Rombel Kelas</span>
                  </label>
                  <select
                    value={selectedKelasId}
                    onChange={(e) => setSelectedKelasId(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    {appState.kelasList.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.namaKelas} (Wali: {k.waliKelasNama})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <BookOpen size={14} className="text-indigo-600" />
                    <span>Format Nilai Mata Pelajaran</span>
                  </label>
                  <select
                    value={selectedMapelId}
                    onChange={(e) => setSelectedMapelId(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="ALL">🌟 Semua Mata Pelajaran (Matriks Leger Lengkap)</option>
                    {appState.mapelList.map((m) => (
                      <option key={m.id} value={m.id}>
                        📖 {m.namaMapel} ({m.kodeMapel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <Calendar size={14} className="text-emerald-600" />
                    <span>Tahun Ajaran & Semester</span>
                  </label>
                  <div className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 flex items-center justify-between">
                    <span>T.A. {activeTA.tahun} - Semester {activeTA.semester}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-extrabold uppercase">
                      Aktif
                    </span>
                  </div>
                </div>
              </div>

              {/* Statistics Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      Nilai Rata-Rata Kelas
                    </p>
                    <div className="text-2xl font-black text-blue-600 mt-1">
                      {avgKelas}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      Rerata {studentsInClass.length} siswa kelas {selectedKelas?.namaKelas}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shrink-0">
                    <TrendingUp size={22} />
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      Nilai Tertinggi
                    </p>
                    <div className="text-2xl font-black text-emerald-600 mt-1">
                      {maxNilai}
                    </div>
                    <p className="text-[11px] text-emerald-700/80 mt-0.5 font-medium">
                      Capaian maksimum kelas
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shrink-0">
                    <Award size={22} />
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      Nilai Terendah
                    </p>
                    <div className="text-2xl font-black text-amber-600 mt-1">
                      {minNilai}
                    </div>
                    <p className="text-[11px] text-amber-700/80 mt-0.5 font-medium">
                      Capaian minimum kelas
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 shrink-0">
                    <TrendingDown size={22} />
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      Ketuntasan Belajar
                    </p>
                    <div className="text-2xl font-black text-indigo-600 mt-1">
                      {persenTuntas}%
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      {jumlahTuntas} dari {studentsInClass.length} siswa tuntas KKM (75)
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shrink-0">
                    <CheckCircle2 size={22} />
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-100/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className="font-extrabold text-slate-900 uppercase">
                    Rekap Nilai {selectedKelas?.namaKelas} • {selectedMapelId === 'ALL' ? 'Leger Matriks Semua Mapel' : selectedMapel?.namaMapel}
                  </span>
                  <div className="flex items-center space-x-3 text-slate-600 font-semibold">
                    <span>Total: {studentsInClass.length} Siswa (L: {totalL}, P: {totalP})</span>
                    <span>•</span>
                    <span className="text-blue-700">Wali: {selectedKelas?.waliKelasNama}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {selectedMapelId === 'ALL' ? (
                    /* ALL SUBJECTS MATRIX LEGER TABLE */
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-10 text-center border-r border-slate-200">No</th>
                          <th className="p-3 min-w-[90px] border-r border-slate-200">NISN</th>
                          <th className="p-3 min-w-[80px] border-r border-slate-200">NIS</th>
                          <th className="p-3 min-w-[190px] border-r border-slate-200">Nama Siswa</th>
                          <th className="p-3 w-12 text-center border-r border-slate-200">L/P</th>
                          {appState.mapelList.map((m) => (
                            <th key={m.id} className="p-2 text-center border-r border-slate-200 font-mono" title={m.namaMapel}>
                              {m.kodeMapel}
                            </th>
                          ))}
                          <th className="p-3 text-center bg-slate-100 border-r border-slate-200 font-black">JML</th>
                          <th className="p-3 text-center bg-blue-50 border-r border-slate-200 font-black text-blue-800">RATA2</th>
                          <th className="p-3 text-center bg-amber-50 border-r border-slate-200 font-black text-amber-800">RANK</th>
                          <th className="p-3 text-center border-r border-slate-200">PRED</th>
                          <th className="p-3 text-center min-w-[100px]">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {calculatedSummaries.map((item, idx) => (
                          <tr key={item.siswa.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 text-center font-bold text-slate-400 border-r border-slate-200">{idx + 1}</td>
                            <td className="p-2.5 font-mono text-slate-600 border-r border-slate-200">{item.siswa.nisn}</td>
                            <td className="p-2.5 font-mono text-slate-600 border-r border-slate-200">{item.siswa.nis}</td>
                            <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200 truncate max-w-[200px]">
                              {item.siswa.nama}
                            </td>
                            <td className="p-2.5 text-center font-semibold text-slate-600 border-r border-slate-200">
                              {item.siswa.jenisKelamin}
                            </td>
                            {appState.mapelList.map((m) => {
                              const score = item.scoresPerMapel[m.id] ?? 82.5;
                              const isUnder = score < 75;
                              return (
                                <td
                                  key={m.id}
                                  className={`p-2 text-center font-mono font-semibold border-r border-slate-200 ${
                                    isUnder ? 'text-rose-600 bg-rose-50/50 font-bold' : 'text-slate-800'
                                  }`}
                                >
                                  {score.toFixed(1)}
                                </td>
                              );
                            })}
                            <td className="p-2.5 text-center font-mono font-bold text-slate-900 bg-slate-50 border-r border-slate-200">
                              {item.totalScore}
                            </td>
                            <td className="p-2.5 text-center font-mono font-black text-blue-700 bg-blue-50/60 border-r border-slate-200">
                              {item.avgScore.toFixed(2)}
                            </td>
                            <td className="p-2.5 text-center font-mono font-black text-amber-700 bg-amber-50/60 border-r border-slate-200">
                              #{item.ranking}
                            </td>
                            <td className="p-2.5 text-center font-bold border-r border-slate-200">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${item.predikat.color}`}>
                                {item.predikat.letter}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  item.isTuntas ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.isTuntas ? 'TUNTAS' : 'REMIDI'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                        <tr>
                          <td colSpan={5} className="p-2.5 text-right uppercase tracking-wider text-[11px] border-r border-slate-200">
                            Rata-Rata Nilai Mapel:
                          </td>
                          {appState.mapelList.map((m) => (
                            <td key={m.id} className="p-2 text-center font-mono text-blue-700 border-r border-slate-200">
                              {mapelStats[m.id]?.avg.toFixed(1) || '0.0'}
                            </td>
                          ))}
                          <td className="p-2.5 text-center font-mono border-r border-slate-200">-</td>
                          <td className="p-2.5 text-center font-mono font-black text-blue-800 bg-blue-100 border-r border-slate-200">
                            {avgKelas}
                          </td>
                          <td colSpan={3} className="p-2.5 text-center text-emerald-700">
                            Ketuntasan: {persenTuntas}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    /* SINGLE SUBJECT DETAILED TABLE */
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-10 text-center border-r border-slate-200">No</th>
                          <th className="p-3 min-w-[90px] border-r border-slate-200">NISN</th>
                          <th className="p-3 min-w-[80px] border-r border-slate-200">NIS</th>
                          <th className="p-3 min-w-[190px] border-r border-slate-200">Nama Siswa</th>
                          <th className="p-3 w-12 text-center border-r border-slate-200">L/P</th>
                          <th className="p-3 text-center border-r border-slate-200 font-mono">Rerata TP</th>
                          <th className="p-3 text-center border-r border-slate-200 font-mono text-blue-700">STS</th>
                          <th className="p-3 text-center border-r border-slate-200 font-mono text-indigo-700">SAS</th>
                          <th className="p-3 text-center bg-slate-100 border-r border-slate-200 font-black">Nilai Akhir (NA)</th>
                          <th className="p-3 text-center border-r border-slate-200">Predikat</th>
                          <th className="p-3 text-center border-r border-slate-200">Status</th>
                          <th className="p-3 min-w-[220px]">Deskripsi Capaian Kompetensi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {calculatedSummaries.map((item, idx) => (
                          <tr key={item.siswa.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center font-bold text-slate-400 border-r border-slate-200">{idx + 1}</td>
                            <td className="p-3 font-mono text-slate-600 border-r border-slate-200">{item.siswa.nisn}</td>
                            <td className="p-3 font-mono text-slate-600 border-r border-slate-200">{item.siswa.nis}</td>
                            <td className="p-3 font-bold text-slate-900 border-r border-slate-200">{item.siswa.nama}</td>
                            <td className="p-3 text-center font-semibold text-slate-600 border-r border-slate-200">
                              {item.siswa.jenisKelamin}
                            </td>
                            <td className="p-3 text-center font-mono font-semibold border-r border-slate-200">
                              {item.singleTpAvg?.toFixed(2)}
                            </td>
                            <td className="p-3 text-center font-mono font-semibold text-blue-600 border-r border-slate-200">
                              {item.singleSts}
                            </td>
                            <td className="p-3 text-center font-mono font-semibold text-indigo-600 border-r border-slate-200">
                              {item.singleSas}
                            </td>
                            <td className="p-3 text-center font-mono font-black text-sm bg-slate-50 border-r border-slate-200">
                              {item.singleNa?.toFixed(2)}
                            </td>
                            <td className="p-3 text-center border-r border-slate-200">
                              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${item.predikat.color}`}>
                                {item.predikat.letter} ({item.predikat.label})
                              </span>
                            </td>
                            <td className="p-3 text-center border-r border-slate-200">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  item.isTuntas ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.isTuntas ? 'TUNTAS' : 'REMIDI'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 text-[11px] leading-relaxed">
                              {item.singleCatatan}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                        <tr>
                          <td colSpan={8} className="p-3 text-right uppercase tracking-wider text-[11px] border-r border-slate-200">
                            Rata-Rata Nilai Akhir Kelas:
                          </td>
                          <td className="p-3 text-center font-mono font-black text-sm text-blue-800 bg-blue-100 border-r border-slate-200">
                            {avgKelas}
                          </td>
                          <td colSpan={3} className="p-3 text-center text-emerald-700">
                            Tertinggi: {maxNilai} | Terendah: {minNilai} | Tuntas: {persenTuntas}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: REKAP NILAI ANTAR KELAS (FORMAT PERSIS GAMBAR) */}
          {/* ========================================================================= */}
          {activeTab === 'komparasi' && (
            <div className="space-y-6">
              {/* Filter Toolbar for Komparasi */}
              <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <BookOpen size={14} className="text-indigo-600" />
                    <span>Mata Pelajaran yang Direkap</span>
                  </label>
                  <select
                    value={komparasiMapelId}
                    onChange={(e) => setKomparasiMapelId(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="ALL">🌟 Semua Mata Pelajaran (Rata-Rata Gabungan)</option>
                    {appState.mapelList.map((m) => (
                      <option key={m.id} value={m.id}>
                        📖 {m.namaMapel} ({m.kodeMapel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <Layers size={14} className="text-blue-600" />
                    <span>Filter Tingkat / Jenjang</span>
                  </label>
                  <select
                    value={komparasiTingkat}
                    onChange={(e) => setKomparasiTingkat(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="ALL">Semua Tingkat (Kelas 7, 8, dan 9)</option>
                    <option value="7">Jenjang Kelas 7</option>
                    <option value="8">Jenjang Kelas 8</option>
                    <option value="9">Jenjang Kelas 9</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <Calendar size={14} className="text-emerald-600" />
                    <span>Tahun Ajaran & Semester</span>
                  </label>
                  <div className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 flex items-center justify-between">
                    <span>T.A. {activeTA.tahun} - Sem {activeTA.semester}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-extrabold uppercase">
                      Aktif
                    </span>
                  </div>
                </div>
              </div>

              {/* Statistics Overview Cards for Komparasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase">Nilai Sumatif (TP)</span>
                    <span className="p-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black">RT: {allSumatifRt.toFixed(2)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div className="text-emerald-700 font-bold">NTT: {allSumatifNtt.toFixed(1)}</div>
                    <div className="text-amber-700 font-bold">NTR: {allSumatifNtr.toFixed(1)}</div>
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase">Sumatif T. Semester (STS)</span>
                    <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black">RT: {allStsRt.toFixed(2)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div className="text-emerald-700 font-bold">NTT: {allStsNtt.toFixed(1)}</div>
                    <div className="text-amber-700 font-bold">NTR: {allStsNtr.toFixed(1)}</div>
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase">Sumatif A. Semester (SAS)</span>
                    <span className="p-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-black">RT: {allSasRt.toFixed(2)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div className="text-emerald-700 font-bold">NTT: {allSasNtt.toFixed(1)}</div>
                    <div className="text-amber-700 font-bold">NTR: {allSasNtr.toFixed(1)}</div>
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase">Nilai Akhir (Rapor)</span>
                    <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black">RT: {allRaporRt.toFixed(2)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div className="text-emerald-700 font-bold">NTT: {allRaporNtt.toFixed(1)}</div>
                    <div className="text-amber-700 font-bold">NTR: {allRaporNtr.toFixed(1)}</div>
                  </div>
                </div>
              </div>

              {/* TABEL KOMPARASI SESUAI GAMBAR DENGAN TAMPILAN BERSIH & RAPI */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-100/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className="font-extrabold text-slate-900 uppercase">
                    Format Rekapitulasi Statistik Nilai Per Rombel Kelas • {komparasiMapelId === 'ALL' ? 'Semua Mapel (Gabungan)' : selectedKomparasiMapel?.namaMapel}
                  </span>
                  <span className="text-slate-500 font-medium">
                    Keterangan: NTT = Nilai Tertinggi | NTR = Nilai Terendah | RT = Rata-Rata
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-center text-xs border-collapse">
                    <thead>
                      {/* Top Header Row */}
                      <tr className="bg-slate-50/90 text-slate-800 font-bold border-b border-slate-200">
                        <th
                          rowSpan={2}
                          className="p-3.5 text-center min-w-[120px] border-r border-slate-200 font-extrabold text-slate-900 bg-slate-100/60"
                        >
                          Kelas
                        </th>
                        <th colSpan={3} className="p-3 text-center border-r border-slate-200 bg-blue-50/50 text-blue-900 font-black">
                          Nilai Sumatif
                        </th>
                        <th colSpan={3} className="p-3 text-center border-r border-slate-200 bg-indigo-50/50 text-indigo-900 font-black">
                          STS
                        </th>
                        <th colSpan={3} className="p-3 text-center border-r border-slate-200 bg-purple-50/50 text-purple-900 font-black">
                          SAS
                        </th>
                        <th colSpan={3} className="p-3 text-center bg-emerald-50/50 text-emerald-900 font-black">
                          Rapor
                        </th>
                      </tr>

                      {/* Sub Header Row (NTT, NTR, RT) */}
                      <tr className="bg-slate-50 text-slate-700 font-bold text-[11px] border-b-2 border-slate-200">
                        {/* Nilai Sumatif */}
                        <th className="p-2 w-16 text-center border-r border-slate-200 text-emerald-700 bg-emerald-50/30">NTT</th>
                        <th className="p-2 w-16 text-center border-r border-slate-200 text-amber-700 bg-amber-50/30">NTR</th>
                        <th className="p-2 w-18 text-center border-r border-slate-200 text-blue-800 bg-blue-50/30 font-black">RT</th>

                        {/* STS */}
                        <th className="p-2 w-16 text-center border-r border-slate-200 text-emerald-700 bg-emerald-50/30">NTT</th>
                        <th className="p-2 w-16 text-center border-r border-slate-200 text-amber-700 bg-amber-50/30">NTR</th>
                        <th className="p-2 w-18 text-center border-r border-slate-200 text-indigo-800 bg-indigo-50/30 font-black">RT</th>

                        {/* SAS */}
                        <th className="p-2 w-16 text-center border-r border-slate-200 text-emerald-700 bg-emerald-50/30">NTT</th>
                        <th className="p-2 w-16 text-center border-r border-slate-200 text-amber-700 bg-amber-50/30">NTR</th>
                        <th className="p-2 w-18 text-center border-r border-slate-200 text-purple-800 bg-purple-50/30 font-black">RT</th>

                        {/* Rapor */}
                        <th className="p-2 w-16 text-center border-r border-slate-200 text-emerald-700 bg-emerald-50/30">NTT</th>
                        <th className="p-2 w-16 text-center border-r border-slate-200 text-amber-700 bg-amber-50/30">NTR</th>
                        <th className="p-2 w-20 text-center text-emerald-900 bg-emerald-100/50 font-black">RT</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {komparasiRows.map((row, idx) => (
                        <tr key={row.kelas.id} className="hover:bg-slate-50 transition-colors">
                          {/* Kelas */}
                          <td className="p-3 text-center font-extrabold text-slate-900 border-r border-slate-200 bg-slate-50/40">
                            {row.kelas.namaKelas}
                          </td>

                          {/* Nilai Sumatif */}
                          <td className="p-2.5 font-mono text-emerald-700 font-bold border-r border-slate-200">
                            {row.sumatifNtt.toFixed(1)}
                          </td>
                          <td className="p-2.5 font-mono text-amber-700 font-bold border-r border-slate-200">
                            {row.sumatifNtr.toFixed(1)}
                          </td>
                          <td className="p-2.5 font-mono text-blue-700 font-black border-r border-slate-200 bg-blue-50/20">
                            {row.sumatifRt.toFixed(2)}
                          </td>

                          {/* STS */}
                          <td className="p-2.5 font-mono text-emerald-700 font-bold border-r border-slate-200">
                            {row.stsNtt.toFixed(1)}
                          </td>
                          <td className="p-2.5 font-mono text-amber-700 font-bold border-r border-slate-200">
                            {row.stsNtr.toFixed(1)}
                          </td>
                          <td className="p-2.5 font-mono text-indigo-700 font-black border-r border-slate-200 bg-indigo-50/20">
                            {row.stsRt.toFixed(2)}
                          </td>

                          {/* SAS */}
                          <td className="p-2.5 font-mono text-emerald-700 font-bold border-r border-slate-200">
                            {row.sasNtt.toFixed(1)}
                          </td>
                          <td className="p-2.5 font-mono text-amber-700 font-bold border-r border-slate-200">
                            {row.sasNtr.toFixed(1)}
                          </td>
                          <td className="p-2.5 font-mono text-purple-700 font-black border-r border-slate-200 bg-purple-50/20">
                            {row.sasRt.toFixed(2)}
                          </td>

                          {/* Rapor */}
                          <td className="p-2.5 font-mono text-emerald-700 font-bold border-r border-slate-200">
                            {row.raporNtt.toFixed(1)}
                          </td>
                          <td className="p-2.5 font-mono text-amber-700 font-bold border-r border-slate-200">
                            {row.raporNtr.toFixed(1)}
                          </td>
                          <td className="p-2.5 font-mono text-emerald-800 font-black bg-emerald-50/50">
                            {row.raporRt.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Summary Footer Row */}
                    <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <tr>
                        <td className="p-3 text-center uppercase tracking-wider text-[11px] border-r border-slate-200 bg-slate-200/70">
                          Rata-Rata Sekolah
                        </td>
                        <td className="p-2.5 font-mono text-emerald-800 border-r border-slate-200">{allSumatifNtt.toFixed(1)}</td>
                        <td className="p-2.5 font-mono text-amber-800 border-r border-slate-200">{allSumatifNtr.toFixed(1)}</td>
                        <td className="p-2.5 font-mono text-blue-900 border-r border-slate-200 bg-blue-100/50">{allSumatifRt.toFixed(2)}</td>

                        <td className="p-2.5 font-mono text-emerald-800 border-r border-slate-200">{allStsNtt.toFixed(1)}</td>
                        <td className="p-2.5 font-mono text-amber-800 border-r border-slate-200">{allStsNtr.toFixed(1)}</td>
                        <td className="p-2.5 font-mono text-indigo-900 border-r border-slate-200 bg-indigo-100/50">{allStsRt.toFixed(2)}</td>

                        <td className="p-2.5 font-mono text-emerald-800 border-r border-slate-200">{allSasNtt.toFixed(1)}</td>
                        <td className="p-2.5 font-mono text-amber-800 border-r border-slate-200">{allSasNtr.toFixed(1)}</td>
                        <td className="p-2.5 font-mono text-purple-900 border-r border-slate-200 bg-purple-100/50">{allSasRt.toFixed(2)}</td>

                        <td className="p-2.5 font-mono text-emerald-800 border-r border-slate-200">{allRaporNtt.toFixed(1)}</td>
                        <td className="p-2.5 font-mono text-amber-800 border-r border-slate-200">{allRaporNtr.toFixed(1)}</td>
                        <td className="p-2.5 font-mono text-emerald-900 bg-emerald-200/50">{allRaporRt.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE 2: HALAMAN CETAK DOKUMEN REKAPITULASI RESMI & PRATINJAU */}
      {/* ========================================================================= */}
      {viewMode === 'print' && (
        <div className="space-y-6">
          {/* Top Control Toolbar (Hidden in Print) */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm print:hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-18 z-20">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setViewMode('table')}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                title="Kembali ke Tabel Nilai"
              >
                <ArrowLeft size={16} />
                <span>Kembali</span>
              </button>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                  Halaman Cetak Dokumen Rekapitulasi
                </h3>
                <p className="text-xs text-slate-500">
                  {activeTab === 'komparasi'
                    ? `Pratinjau rekapitulasi statistik nilai antar rombel kelas • TA ${activeTA.tahun}`
                    : `Pratinjau lembar cetak kedinasan kelas ${selectedKelas?.namaKelas} • TA ${activeTA.tahun}`}
                </p>
              </div>
            </div>

            {/* Quick Layout Settings */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setPrintOrientation('landscape')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    printOrientation === 'landscape' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Landscape
                </button>
                <button
                  onClick={() => setPrintOrientation('portrait')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    printOrientation === 'portrait' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Portrait
                </button>
              </div>

              <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setPaperSize('A4')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    paperSize === 'A4' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  A4
                </button>
                <button
                  onClick={() => setPaperSize('F4')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    paperSize === 'F4' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  F4 (Folio)
                </button>
              </div>

              {/* Action Buttons */}
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <FileSpreadsheet size={15} />
                <span>Excel</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Membuat PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown size={15} />
                    <span>Unduh PDF</span>
                  </>
                )}
              </button>

              <button
                onClick={handlePrint}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Printer size={15} />
                <span>Cetak / Print</span>
              </button>
            </div>
          </div>

          {/* Printable Document Sheet (Simulated A4/F4 Page) */}
          <div className="flex justify-center overflow-x-auto pb-10">
            <div
              ref={printDocumentRef}
              className={`bg-white text-slate-900 p-8 sm:p-10 md:p-12 shadow-2xl rounded-sm border border-slate-300 transition-all ${
                printOrientation === 'landscape' ? 'w-[1050px] min-h-[740px]' : 'w-[800px] min-h-[1050px]'
              }`}
              style={{
                fontFamily: "'Times New Roman', Times, serif",
              }}
            >
              {/* 1. KOP SURAT RESMI */}
              {showKopSurat && (
                <div className="border-b-4 border-double border-black pb-3 mb-5">
                  {kopType === 'banner' && appState.sekolah.kopSekolahUrl ? (
                    <img
                      src={appState.sekolah.kopSekolahUrl}
                      alt="Kop Surat"
                      className="w-full max-h-28 object-contain mx-auto"
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="w-20 h-20 flex items-center justify-center shrink-0">
                        <img
                          src={appState.sekolah.logoUrl || '/favicon.png'}
                          alt="Logo Instansi"
                          className="max-h-18 max-w-18 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/favicon.svg';
                          }}
                        />
                      </div>

                      <div className="text-center flex-1 px-4">
                        <h4 className="text-xs uppercase font-bold tracking-wider leading-tight">
                          PEMERINTAH KABUPATEN {appState.sekolah.kabupatenKota?.toUpperCase() || 'BANYUMAS'}
                        </h4>
                        <h4 className="text-xs uppercase font-bold tracking-wider leading-tight">
                          DINAS PENDIDIKAN
                        </h4>
                        <h2 className="text-lg md:text-xl font-black uppercase tracking-wide my-0.5">
                          {appState.sekolah.namaSekolah || 'SMP NEGERI 2 KEMRANJEN'}
                        </h2>
                        <p className="text-[10px] leading-tight text-slate-800">
                          {appState.sekolah.alamat}, Kec. {appState.sekolah.kecamatan}, Kab. {appState.sekolah.kabupatenKota}, Prov. {appState.sekolah.provinsi} - Kode Pos {appState.sekolah.kodePos}
                        </p>
                        <p className="text-[10px] leading-tight text-slate-800 mt-0.5">
                          Telepon: {appState.sekolah.telepon || '(0281) 123456'} • Email: {appState.sekolah.email || 'smpn2kemranjen@gmail.sch.id'} • NPSN: {appState.sekolah.npsn || '20301234'}
                        </p>
                      </div>

                      <div className="w-20 h-20 flex items-center justify-center shrink-0">
                        <img
                          src="/favicon.svg"
                          alt="Logo e-Dafnil"
                          className="max-h-18 max-w-18 object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. JUDUL LAPORAN */}
              <div className="text-center my-3">
                <h3 className="text-base font-bold uppercase tracking-wider underline">
                  {activeTab === 'komparasi'
                    ? 'REKAPITULASI STATISTIK NILAI ROMBONGAN BELAJAR'
                    : 'REKAPITULASI NILAI SUMATIF RAPOR SISWA'}
                </h3>
                <p className="text-xs font-semibold uppercase mt-0.5">
                  TAHUN PELAJARAN {activeTA.tahun} • SEMESTER {String(activeTA.semester).toUpperCase()}
                </p>
              </div>

              {/* 3. IDENTITAS & METADATA */}
              {activeTab === 'komparasi' ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs my-4 border border-slate-400 p-3 bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex">
                      <span className="w-32 font-semibold">Satuan Pendidikan</span>
                      <span>: {appState.sekolah.namaSekolah}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-semibold">Mata Pelajaran</span>
                      <span>: {komparasiMapelId === 'ALL' ? 'Semua Mata Pelajaran (Rata-Rata Gabungan)' : selectedKomparasiMapel?.namaMapel}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex">
                      <span className="w-32 font-semibold">Jumlah Rombel</span>
                      <span>: {komparasiRows.length} Kelas</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-semibold">Keterangan Kolom</span>
                      <span>: NTT (Tertinggi), NTR (Terendah), RT (Rata-Rata)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs my-4 border border-slate-400 p-3 bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex">
                      <span className="w-32 font-semibold">Satuan Pendidikan</span>
                      <span>: {appState.sekolah.namaSekolah}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-semibold">Kelas / Rombel</span>
                      <span>: {selectedKelas?.namaKelas} (Tingkat {selectedKelas?.tingkat})</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-semibold">Wali Kelas</span>
                      <span>: {selectedKelas?.waliKelasNama}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex">
                      <span className="w-32 font-semibold">Mata Pelajaran</span>
                      <span>: {selectedMapelId === 'ALL' ? 'Semua Mata Pelajaran (Matriks Leger)' : selectedMapel?.namaMapel}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-semibold">Kriteria Ketuntasan</span>
                      <span>: 75.00</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 font-semibold">Jumlah Siswa</span>
                      <span>: {studentsInClass.length} Siswa (L: {totalL}, P: {totalP})</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. TABEL CETAK */}
              <div className="my-4">
                {activeTab === 'komparasi' ? (
                  /* TABEL CETAK KOMPARASI ANTAR KELAS */
                  <table className={`w-full text-center border border-black border-collapse ${getTableFontSizeClass()}`}>
                    <thead>
                      <tr className="bg-slate-200 text-black font-bold uppercase text-center border-b border-black">
                        <th rowSpan={2} className="border border-black p-1.5 w-24">Kelas</th>
                        <th colSpan={3} className="border border-black p-1.5">Nilai Sumatif</th>
                        <th colSpan={3} className="border border-black p-1.5">STS</th>
                        <th colSpan={3} className="border border-black p-1.5">SAS</th>
                        <th colSpan={3} className="border border-black p-1.5 bg-slate-300">Rapor</th>
                      </tr>
                      <tr className="bg-slate-100 text-black font-bold uppercase text-center border-b border-black text-[10px]">
                        <th className="border border-black p-1 w-12">NTT</th>
                        <th className="border border-black p-1 w-12">NTR</th>
                        <th className="border border-black p-1 w-14">RT</th>
                        <th className="border border-black p-1 w-12">NTT</th>
                        <th className="border border-black p-1 w-12">NTR</th>
                        <th className="border border-black p-1 w-14">RT</th>
                        <th className="border border-black p-1 w-12">NTT</th>
                        <th className="border border-black p-1 w-12">NTR</th>
                        <th className="border border-black p-1 w-14">RT</th>
                        <th className="border border-black p-1 w-12">NTT</th>
                        <th className="border border-black p-1 w-12">NTR</th>
                        <th className="border border-black p-1 w-14 bg-slate-200">RT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {komparasiRows.map((r) => (
                        <tr key={r.kelas.id} className="even:bg-slate-50/70 font-mono">
                          <td className="border border-black p-1 font-bold text-black font-sans">{r.kelas.namaKelas}</td>
                          <td className="border border-black p-1">{r.sumatifNtt.toFixed(1)}</td>
                          <td className="border border-black p-1">{r.sumatifNtr.toFixed(1)}</td>
                          <td className="border border-black p-1 font-bold">{r.sumatifRt.toFixed(2)}</td>
                          <td className="border border-black p-1">{r.stsNtt.toFixed(1)}</td>
                          <td className="border border-black p-1">{r.stsNtr.toFixed(1)}</td>
                          <td className="border border-black p-1 font-bold">{r.stsRt.toFixed(2)}</td>
                          <td className="border border-black p-1">{r.sasNtt.toFixed(1)}</td>
                          <td className="border border-black p-1">{r.sasNtr.toFixed(1)}</td>
                          <td className="border border-black p-1 font-bold">{r.sasRt.toFixed(2)}</td>
                          <td className="border border-black p-1">{r.raporNtt.toFixed(1)}</td>
                          <td className="border border-black p-1">{r.raporNtr.toFixed(1)}</td>
                          <td className="border border-black p-1 font-bold bg-slate-100">{r.raporRt.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="font-bold bg-slate-100 text-[10.5px]">
                      <tr>
                        <td className="border border-black p-1.5 text-center font-sans font-black bg-slate-200">
                          RATA-RATA SEKOLAH
                        </td>
                        <td className="border border-black p-1">{allSumatifNtt.toFixed(1)}</td>
                        <td className="border border-black p-1">{allSumatifNtr.toFixed(1)}</td>
                        <td className="border border-black p-1 font-black">{allSumatifRt.toFixed(2)}</td>
                        <td className="border border-black p-1">{allStsNtt.toFixed(1)}</td>
                        <td className="border border-black p-1">{allStsNtr.toFixed(1)}</td>
                        <td className="border border-black p-1 font-black">{allStsRt.toFixed(2)}</td>
                        <td className="border border-black p-1">{allSasNtt.toFixed(1)}</td>
                        <td className="border border-black p-1">{allSasNtr.toFixed(1)}</td>
                        <td className="border border-black p-1 font-black">{allSasRt.toFixed(2)}</td>
                        <td className="border border-black p-1">{allRaporNtt.toFixed(1)}</td>
                        <td className="border border-black p-1">{allRaporNtr.toFixed(1)}</td>
                        <td className="border border-black p-1 font-black bg-slate-200">{allRaporRt.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                ) : selectedMapelId === 'ALL' ? (
                  /* CETAK: LEGER SEMUA MAPEL */
                  <table className={`w-full text-left border border-black border-collapse ${getTableFontSizeClass()}`}>
                    <thead>
                      <tr className="bg-slate-200 text-black font-bold uppercase text-center border-b border-black">
                        <th className="border border-black p-1.5 w-7">No</th>
                        <th className="border border-black p-1.5 w-18">NISN</th>
                        <th className="border border-black p-1.5 w-16">NIS</th>
                        <th className="border border-black p-1.5 text-left min-w-[140px]">Nama Siswa</th>
                        <th className="border border-black p-1.5 w-7">L/P</th>
                        {appState.mapelList.map((m) => (
                          <th key={m.id} className="border border-black p-1 w-8 font-mono text-[9.5px]">
                            {m.kodeMapel}
                          </th>
                        ))}
                        <th className="border border-black p-1.5 w-10 font-bold bg-slate-300">JML</th>
                        <th className="border border-black p-1.5 w-10 font-bold bg-slate-300">RATA</th>
                        <th className="border border-black p-1.5 w-8 font-bold bg-slate-300">RANK</th>
                        <th className="border border-black p-1.5 w-8">PRED</th>
                        <th className="border border-black p-1.5 w-14">KET</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculatedSummaries.map((item, idx) => (
                        <tr key={item.siswa.id} className="even:bg-slate-50/70">
                          <td className="border border-black p-1 text-center font-bold">{idx + 1}</td>
                          <td className="border border-black p-1 font-mono text-center">{item.siswa.nisn}</td>
                          <td className="border border-black p-1 font-mono text-center">{item.siswa.nis}</td>
                          <td className="border border-black p-1 font-bold truncate max-w-[170px]">{item.siswa.nama}</td>
                          <td className="border border-black p-1 text-center">{item.siswa.jenisKelamin}</td>
                          {appState.mapelList.map((m) => {
                            const score = item.scoresPerMapel[m.id] ?? 82.5;
                            return (
                              <td key={m.id} className="border border-black p-1 text-center font-mono">
                                {score.toFixed(0)}
                              </td>
                            );
                          })}
                          <td className="border border-black p-1 text-center font-mono font-bold bg-slate-100">
                            {item.totalScore.toFixed(0)}
                          </td>
                          <td className="border border-black p-1 text-center font-mono font-bold bg-slate-100">
                            {item.avgScore.toFixed(1)}
                          </td>
                          <td className="border border-black p-1 text-center font-bold bg-slate-100">
                            {item.ranking}
                          </td>
                          <td className="border border-black p-1 text-center font-bold">
                            {item.predikat.letter}
                          </td>
                          <td className="border border-black p-1 text-center text-[9px] font-bold">
                            {item.isTuntas ? 'TUNTAS' : 'REMIDI'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {showStatistik && (
                      <tfoot className="font-bold bg-slate-100 text-[10px]">
                        <tr>
                          <td colSpan={5} className="border border-black p-1 text-right uppercase">
                            Rata-Rata Kelas:
                          </td>
                          {appState.mapelList.map((m) => (
                            <td key={m.id} className="border border-black p-1 text-center font-mono text-blue-900">
                              {mapelStats[m.id]?.avg.toFixed(1) || '-'}
                            </td>
                          ))}
                          <td className="border border-black p-1 text-center font-mono">-</td>
                          <td className="border border-black p-1 text-center font-mono font-bold bg-slate-200">
                            {avgKelas}
                          </td>
                          <td colSpan={3} className="border border-black p-1 text-center text-[9.5px]">
                            Ketuntasan: {persenTuntas}%
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                ) : (
                  /* CETAK: DETAIL PER MATA PELAJARAN */
                  <table className={`w-full text-left border border-black border-collapse ${getTableFontSizeClass()}`}>
                    <thead>
                      <tr className="bg-slate-200 text-black font-bold uppercase text-center border-b border-black">
                        <th className="border border-black p-1.5 w-8">No</th>
                        <th className="border border-black p-1.5 w-20">NISN</th>
                        <th className="border border-black p-1.5 w-18">NIS</th>
                        <th className="border border-black p-1.5 text-left min-w-[170px]">Nama Siswa</th>
                        <th className="border border-black p-1.5 w-8">L/P</th>
                        <th className="border border-black p-1.5 w-14">Rerata TP</th>
                        <th className="border border-black p-1.5 w-12">STS</th>
                        <th className="border border-black p-1.5 w-12">SAS</th>
                        <th className="border border-black p-1.5 w-14 bg-slate-300 font-black">NA</th>
                        <th className="border border-black p-1.5 w-12">Predikat</th>
                        <th className="border border-black p-1.5 w-14">Status</th>
                        <th className="border border-black p-1.5 text-left min-w-[200px]">Capaian Kompetensi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculatedSummaries.map((item, idx) => (
                        <tr key={item.siswa.id} className="even:bg-slate-50/70">
                          <td className="border border-black p-1.5 text-center font-bold">{idx + 1}</td>
                          <td className="border border-black p-1.5 font-mono text-center">{item.siswa.nisn}</td>
                          <td className="border border-black p-1.5 font-mono text-center">{item.siswa.nis}</td>
                          <td className="border border-black p-1.5 font-bold">{item.siswa.nama}</td>
                          <td className="border border-black p-1.5 text-center">{item.siswa.jenisKelamin}</td>
                          <td className="border border-black p-1.5 text-center font-mono">{item.singleTpAvg?.toFixed(1)}</td>
                          <td className="border border-black p-1.5 text-center font-mono">{item.singleSts}</td>
                          <td className="border border-black p-1.5 text-center font-mono">{item.singleSas}</td>
                          <td className="border border-black p-1.5 text-center font-mono font-bold bg-slate-100">
                            {item.singleNa?.toFixed(1)}
                          </td>
                          <td className="border border-black p-1.5 text-center font-bold">
                            {item.predikat.letter} ({item.predikat.label})
                          </td>
                          <td className="border border-black p-1.5 text-center font-bold text-[9px]">
                            {item.isTuntas ? 'TUNTAS' : 'REMIDI'}
                          </td>
                          <td className="border border-black p-1.5 text-[10px] leading-tight">
                            {item.singleCatatan}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {showStatistik && (
                      <tfoot className="font-bold bg-slate-100 text-[10px]">
                        <tr>
                          <td colSpan={8} className="border border-black p-1.5 text-right uppercase">
                            Rata-Rata Nilai Akhir Kelas:
                          </td>
                          <td className="border border-black p-1.5 text-center font-mono font-bold bg-slate-200">
                            {avgKelas}
                          </td>
                          <td colSpan={3} className="border border-black p-1.5 text-center">
                            Tertinggi: {maxNilai} • Terendah: {minNilai} • Ketuntasan: {persenTuntas}%
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </div>

              {/* 5. TANDA TANGAN KEDINASAN RESMI */}
              {showTtd && (
                <div className="mt-8 pt-4 grid grid-cols-2 gap-8 text-xs break-inside-avoid">
                  <div className="text-left space-y-1">
                    <p>Mengetahui,</p>
                    <p className="font-bold">
                      {activeTab === 'komparasi'
                        ? 'Waka Kurikulum / Tim Asesmen'
                        : `Wali Kelas ${selectedKelas?.namaKelas}`}
                    </p>
                    <div className="h-18 flex items-center"></div>
                    <p className="font-bold underline text-slate-950">
                      {activeTab === 'komparasi'
                        ? 'Dra. Hj. Siti Munawaroh, M.Pd.'
                        : selectedKelas?.waliKelasNama || '..............................................'}
                    </p>
                    <p className="text-[11px] text-slate-800">
                      NIP. {activeTab === 'komparasi' ? '197503142000032001' : appState.guruList.find((g) => g.id === selectedKelas?.waliKelasId)?.nip || '-'}
                    </p>
                  </div>

                  <div className="text-right space-y-1 relative">
                    <p>
                      {appState.sekolah.kabupatenKota || 'Kemranjen'}, {appState.sekolah.tanggalSurat || '19 Agustus 2026'}
                    </p>
                    <p className="font-bold">Kepala {appState.sekolah.namaSekolah}</p>

                    <div className="h-18 flex items-center justify-end relative">
                      {showStempel && appState.sekolah.stempelUrl && (
                        <img
                          src={appState.sekolah.stempelUrl}
                          alt="Stempel Sekolah"
                          className="max-h-16 object-contain opacity-80 absolute right-16 -top-2"
                        />
                      )}
                      {appState.sekolah.ttdKepalaSekolahUrl && (
                        <img
                          src={appState.sekolah.ttdKepalaSekolahUrl}
                          alt="Tanda Tangan Kepala Sekolah"
                          className="max-h-16 object-contain relative z-10"
                        />
                      )}
                    </div>

                    <p className="font-bold underline text-slate-950">
                      {appState.sekolah.namaKepalaSekolah || 'Drs. H. Ahmad Wijaya, M.Pd.'}
                    </p>
                    <p className="text-[11px] text-slate-800">
                      NIP. {appState.sekolah.nipKepalaSekolah || '196805121994031005'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
