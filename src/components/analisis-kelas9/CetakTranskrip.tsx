import React, { useState, useEffect, useRef } from 'react';
import { AppState, AuthUser, Siswa, Mapel, NilaiKelas9, NotificationLog } from '../../types';
import { isGrade9Student, getMapelFinalScore, formatScoreVal } from '../../lib/k9GradeHelper';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { createNotification } from '../../lib/storage';
import {
  Printer,
  FileBadge,
  School,
  Settings,
  Sliders,
  FileText,
  Download,
  Eye,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
  Users,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Upload,
  Save,
  HelpCircle,
  FileDown,
  Hash,
  Calendar,
  Award,
} from 'lucide-react';

interface CetakTranskripProps {
  appState: AppState;
  authUser?: AuthUser | null;
  onUpdateNilaiKelas9?: (newList: NilaiKelas9[], notif: NotificationLog) => void;
  onUpdateSiswaList?: (newList: Siswa[], notif: NotificationLog) => void;
}

export const CetakTranskrip: React.FC<CetakTranskripProps> = ({
  appState,
  authUser,
  onUpdateNilaiKelas9,
  onUpdateSiswaList,
}) => {
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

  const waliKelas9Obj = currentGuru
    ? appState.kelasList.find((k) => {
        const isClass9 =
          Number(k.tingkat) === 9 ||
          k.kodeKelas.startsWith('9') ||
          k.kodeKelas.startsWith('IX') ||
          k.namaKelas.includes('9') ||
          k.namaKelas.includes('IX');
        const isWali =
          k.waliKelasId === currentGuru.id ||
          k.waliKelasNama?.toLowerCase() === currentGuru.nama.toLowerCase() ||
          (authUser?.nama && k.waliKelasNama?.toLowerCase().includes(authUser.nama.toLowerCase()));
        return isClass9 && isWali;
      })
    : null;

  const isWaliKelas9 = isAdmin || Boolean(waliKelas9Obj);

  // 1. Strict Filter Siswa Kelas 9
  const kelas9Students = appState.siswaList.filter((s) => {
    const isK9 = isGrade9Student(s, appState.kelasList);
    if (!isK9) return false;
    if (waliKelas9Obj) {
      return s.kelasId === waliKelas9Obj.id || s.kodeKelas === waliKelas9Obj.kodeKelas;
    }
    return true;
  });

  const [selectedSiswaId, setSelectedSiswaId] = useState<string>(
    kelas9Students[0]?.id || ''
  );

  useEffect(() => {
    if (kelas9Students.length > 0 && (!selectedSiswaId || !kelas9Students.some((s) => s.id === selectedSiswaId))) {
      setSelectedSiswaId(kelas9Students[0].id);
    }
  }, [kelas9Students, selectedSiswaId]);

  if (isGuru && !isWaliKelas9) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-md">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Akses Terbatas: Cetak Transkrip Nilai</h2>
        <p className="text-sm text-slate-600">
          Menu ini hanya dapat diakses oleh <strong>Administrator</strong> dan <strong>Wali Kelas 9</strong>.
        </p>
      </div>
    );
  }

  const selectedIndex = kelas9Students.findIndex((s) => s.id === selectedSiswaId);
  const selectedSiswa = appState.siswaList.find((s) => s.id === selectedSiswaId);
  const gradeRecord = appState.nilaiKelas9List.find((n) => n.siswaId === selectedSiswaId);

  // Settings Panel State
  const [showSettings, setShowSettings] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<
    'kop' | 'surat' | 'ttd' | 'layout' | 'mapel' | 'excel' | 'masal'
  >('surat');

  // Search in student picker
  const [searchSiswa, setSearchSiswa] = useState<string>('');
  const [filterKelas, setFilterKelas] = useState<string>('all');

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [pdfSuccessToast, setPdfSuccessToast] = useState<string | null>(null);

  // 1. Pengaturan Kop Surat (Diambilkan dari Sub Menu Pengaturan Sekolah)
  const [kopType, setKopType] = useState<'text' | 'banner'>(
    appState.sekolah.kopSekolahUrl ? 'banner' : 'text'
  );
  const [showLogoLeft, setShowLogoLeft] = useState<boolean>(true);
  const [showLogoRight, setShowLogoRight] = useState<boolean>(true);
  const [showStempel, setShowStempel] = useState<boolean>(false);
  const [showTtdKepsek, setShowTtdKepsek] = useState<boolean>(false);

  // 2. Pengaturan Field Surat & Identitas Transkrip
  const defaultNoSurat =
    gradeRecord?.noSuratTranskrip ||
    `400.3.11.1/${(selectedIndex >= 0 ? selectedIndex : 0) + 158}.43/2026`;
  const [noSurat, setNoSurat] = useState<string>(defaultNoSurat);

  const defaultNoIjazah =
    selectedSiswa?.noIjazah ||
    gradeRecord?.noIjazah ||
    `12120260015594${(selectedIndex >= 0 ? selectedIndex : 0) + 1}`;
  const [noIjazah, setNoIjazah] = useState<string>(defaultNoIjazah);

  const defaultTanggalKelulusan =
    selectedSiswa?.tanggalKelulusan ||
    gradeRecord?.tanggalKelulusan ||
    '2 Juni 2026';
  const [tanggalKelulusan, setTanggalKelulusan] = useState<string>(defaultTanggalKelulusan);

  const [namaSekolahLengkap, setNamaSekolahLengkap] = useState<string>(
    appState.sekolah.namaSekolah
      ? appState.sekolah.namaSekolah.replace(/^SMP\s*/i, 'Sekolah Menengah Pertama ')
      : 'Sekolah Menengah Pertama Negeri 2 Kemranjen'
  );
  const [npsnSekolah, setNpsnSekolah] = useState<string>(
    appState.sekolah.npsn || '20301942'
  );

  // 3. Pengaturan Tempat & Tanggal TTD
  const [tempatTtd, setTempatTtd] = useState<string>(
    appState.sekolah.kabupatenKota || 'Banyumas'
  );
  const [tanggalTtd, setTanggalTtd] = useState<string>('8 Juni 2026');
  const [jabatanTtd, setJabatanTtd] = useState<string>('Kepala,');
  const [namaKepalaSekolah, setNamaKepalaSekolah] = useState<string>(
    appState.sekolah.namaKepalaSekolah || 'Budhy Susanto, S. Pd.'
  );
  const [nipKepalaSekolah, setNipKepalaSekolah] = useState<string>(
    appState.sekolah.nipKepalaSekolah || '197908202005011013'
  );

  // 4. Layout, Font, Kertas & Margin
  const [fontFamily, setFontFamily] = useState<
    'Arial' | 'Times New Roman' | 'Calibri' | 'Bookman Old Style'
  >('Arial');
  const [fontSize, setFontSize] = useState<string>('10pt');
  const [paperSize, setPaperSize] = useState<'A4' | 'F4' | 'Letter' | 'Legal'>('A4');

  const [margins, setMargins] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
  }>({
    top: 15,
    bottom: 15,
    left: 20,
    right: 15,
  });

  // 5. Pengaturan Mata Pelajaran & Nama Mapel
  const [religionMode, setReligionMode] = useState<'general' | 'auto_simple' | 'auto_specific'>(
    'general'
  );

  // Default Standard Subjects List
  const defaultSubjects: { id: string; defaultName: string; defaultScore: number }[] = [
    { id: 'm-1', defaultName: 'Pendidikan Agama dan Budi Pekerti', defaultScore: 91.3 },
    { id: 'm-2', defaultName: 'Pendidikan Pancasila', defaultScore: 93.1 },
    { id: 'm-3', defaultName: 'Bahasa Indonesia', defaultScore: 90.7 },
    { id: 'm-4', defaultName: 'Matematika', defaultScore: 93.6 },
    { id: 'm-5', defaultName: 'Ilmu Pengetahuan Alam', defaultScore: 86.1 },
    { id: 'm-6', defaultName: 'Ilmu Pengetahuan Sosial', defaultScore: 91.4 },
    { id: 'm-7', defaultName: 'Bahasa Inggris', defaultScore: 87.7 },
    { id: 'm-8', defaultName: 'Seni Budaya/Prakarya', defaultScore: 87.7 },
    { id: 'm-9', defaultName: 'Pendidikan Jasmani, Olah Raga dan Kesehatan', defaultScore: 84.9 },
    { id: 'm-10', defaultName: 'Informatika', defaultScore: 91.0 },
    { id: 'm-11', defaultName: 'Bahasa Jawa', defaultScore: 88.6 },
  ];

  const sortedMapels = [...appState.mapelList].sort(
    (a, b) => (a.urutan || 99) - (b.urutan || 99)
  );

  // Gunakan data mata pelajaran persis dari sub menu Data Mapel (appState.mapelList)
  const allMapelOptions =
    sortedMapels.length > 0
      ? sortedMapels
      : defaultSubjects.map((d) => ({
          id: d.id,
          kodeMapel: d.id.toUpperCase(),
          namaMapel: d.defaultName,
          kelompok: 'Kelompok A (Wajib)' as const,
          urutan: parseInt(d.id.replace('m-', ''), 10) || 1,
        }));

  const [selectedMapelIds, setSelectedMapelIds] = useState<string[]>(
    allMapelOptions.map((m) => m.id)
  );

  // 6. Excel State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelImportModalOpen, setExcelImportModalOpen] = useState<boolean>(false);
  const [excelPreviewData, setExcelPreviewData] = useState<{
    rows: Array<{
      nis: string;
      nisn: string;
      nama: string;
      noSuratTranskrip: string;
      noIjazah: string;
      tanggalKelulusan: string;
      statusMatch: 'MATCHED' | 'NOT_FOUND';
    }>;
    matchedCount: number;
    unmatchedCount: number;
  } | null>(null);
  const [excelFileLoading, setExcelFileLoading] = useState<boolean>(false);

  // Auto Number Generator Dialog
  const [autoNumberModalOpen, setAutoNumberModalOpen] = useState<boolean>(false);
  const [autoSuratPrefix, setAutoSuratPrefix] = useState<string>('400.3.11.1/');
  const [autoSuratStartNo, setAutoSuratStartNo] = useState<number>(158);
  const [autoSuratSuffix, setAutoSuratSuffix] = useState<string>('.43/2026');
  const [autoIjazahPrefix, setAutoIjazahPrefix] = useState<string>('121202600155');
  const [autoIjazahStartNo, setAutoIjazahStartNo] = useState<number>(947);
  const [autoTanggalKelulusanVal, setAutoTanggalKelulusanVal] = useState<string>('2 Juni 2026');

  // Batch student selection for multi-print
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>(
    kelas9Students.map((s) => s.id)
  );

  // Sync selected mapels when appState.mapelList changes
  useEffect(() => {
    if (appState.mapelList.length > 0) {
      setSelectedMapelIds((prev) => {
        const currentIds = appState.mapelList.map((m) => m.id);
        const validPrev = prev.filter((id) => currentIds.includes(id));
        return validPrev.length > 0 ? validPrev : currentIds;
      });
    }
  }, [appState.mapelList]);

  // Sync with School Profile
  useEffect(() => {
    if (appState.sekolah.kabupatenKota) setTempatTtd(appState.sekolah.kabupatenKota);
    if (appState.sekolah.namaKepalaSekolah) setNamaKepalaSekolah(appState.sekolah.namaKepalaSekolah);
    if (appState.sekolah.nipKepalaSekolah) setNipKepalaSekolah(appState.sekolah.nipKepalaSekolah);
    if (appState.sekolah.npsn) setNpsnSekolah(appState.sekolah.npsn);
    if (appState.sekolah.namaSekolah) {
      const clean = appState.sekolah.namaSekolah.replace(/^SMP\s*/i, 'Sekolah Menengah Pertama ');
      setNamaSekolahLengkap(clean);
    }
    if (appState.sekolah.kopSekolahUrl) {
      setKopType('banner');
    }
  }, [appState.sekolah]);

  // Sync student specific fields when selected student changes
  useEffect(() => {
    if (gradeRecord?.noSuratTranskrip) {
      setNoSurat(gradeRecord.noSuratTranskrip);
    } else {
      const idxStr = String((selectedIndex >= 0 ? selectedIndex : 0) + 158);
      setNoSurat(`400.3.11.1/${idxStr}.43/2026`);
    }

    if (selectedSiswa?.noIjazah || gradeRecord?.noIjazah) {
      setNoIjazah(selectedSiswa?.noIjazah || gradeRecord?.noIjazah || '');
    } else {
      const pad = String((selectedIndex >= 0 ? selectedIndex : 0) + 947).padStart(3, '0');
      setNoIjazah(`121202600155${pad}`);
    }

    if (selectedSiswa?.tanggalKelulusan || gradeRecord?.tanggalKelulusan) {
      setTanggalKelulusan(
        selectedSiswa?.tanggalKelulusan || gradeRecord?.tanggalKelulusan || '2 Juni 2026'
      );
    }
  }, [selectedSiswaId, gradeRecord, selectedSiswa, selectedIndex]);

  // Mapel toggle
  const handleToggleMapel = (id: string) => {
    setSelectedMapelIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleSelectAllMapel = () => {
    setSelectedMapelIds(allMapelOptions.map((m) => m.id));
  };

  const handleDeselectAllMapel = () => {
    setSelectedMapelIds([]);
  };

  // Helper format nama mapel
  const getFormattedMapelName = (namaMapel: string, agamaSiswa?: string): string => {
    const trimmedAgama = agamaSiswa?.trim() || 'Islam';
    const lower = (namaMapel || '').toLowerCase();

    if (lower.includes('pendidikan agama') || lower.startsWith('agama') || lower.includes('pai')) {
      if (religionMode === 'auto_simple') {
        return `Pendidikan Agama ${trimmedAgama}`;
      }
      if (religionMode === 'auto_specific') {
        return `Pendidikan Agama ${trimmedAgama} dan Budi Pekerti`;
      }
      return namaMapel;
    }
    return namaMapel;
  };

  // Helper format score with 2 decimals and comma
  const formatScoreVal = (val: number | undefined | null): string => {
    if (val === undefined || val === null || isNaN(val) || val <= 0) return '-';
    return Number(val).toFixed(2).replace('.', ',');
  };

  // Helper format date Indonesian
  const formatIndonesianDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    if (/[a-zA-Z]/.test(dateStr) && !dateStr.includes('-')) return dateStr;
    const months = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (month >= 0 && month < 12 && !isNaN(day)) {
        return `${day} ${months[month]} ${year}`;
      }
    }
    return dateStr;
  };

  // Calculate Transkrip Grades for a student (Hanya mapel dengan nilai > 0 yang ditampilkan)
  const getStudentTranskripGrades = (siswaId: string) => {
    const targetSiswa = appState.siswaList.find((s) => s.id === siswaId);
    const targetGrade = appState.nilaiKelas9List.find((n) => n.siswaId === siswaId);

    const mapelsToRender = allMapelOptions.filter((m) => selectedMapelIds.includes(m.id));

    let totalNilai = 0;
    let validCount = 0;

    const validRows: Array<{
      namaMapel: string;
      scoreRaw: number;
      scoreStr: string;
    }> = [];

    mapelsToRender.forEach((m) => {
      // Ambil nilai murni yang terpusat melalui getMapelFinalScore
      const rawScore = getMapelFinalScore(targetGrade, m.id);

      // Validasi: Perolehan nilai 0 atau belum diinput dianggap siswa tidak memiliki nilai pada mapel tersebut
      // Maka mata pelajaran terkait TIDAK ditampilkan dalam dokumen Transkrip Nilai
      if (rawScore <= 0) {
        return;
      }

      totalNilai += rawScore;
      validCount++;

      const formattedMapel = getFormattedMapelName(m.namaMapel, targetSiswa?.agama);

      validRows.push({
        namaMapel: formattedMapel,
        scoreRaw: rawScore,
        scoreStr: formatScoreVal(rawScore),
      });
    });

    const rows = validRows.map((r, idx) => ({
      no: idx + 1,
      ...r,
    }));

    const averageRaw = validCount > 0 ? totalNilai / validCount : 0;

    return {
      rows,
      totalNilaiRaw: totalNilai,
      totalNilaiStr: validCount > 0 ? formatScoreVal(totalNilai) : '-',
      averageRaw,
      averageStr: validCount > 0 ? formatScoreVal(averageRaw) : '-',
    };
  };

  const { rows: currentRows, averageStr } = getStudentTranskripGrades(selectedSiswaId);

  // Student Navigation
  const handlePrevStudent = () => {
    if (selectedIndex > 0) {
      setSelectedSiswaId(kelas9Students[selectedIndex - 1].id);
    }
  };

  const handleNextStudent = () => {
    if (selectedIndex < kelas9Students.length - 1) {
      setSelectedSiswaId(kelas9Students[selectedIndex + 1].id);
    }
  };

  // Dimensions & CSS mapping
  const getPaperDimensionsMm = (): {
    width: number;
    height: number;
    format: [number, number] | string;
  } => {
    switch (paperSize) {
      case 'F4':
        return { width: 215, height: 330, format: [215, 330] };
      case 'Letter':
        return { width: 215.9, height: 279.4, format: 'letter' };
      case 'Legal':
        return { width: 215.9, height: 355.6, format: 'legal' };
      case 'A4':
      default:
        return { width: 210, height: 297, format: 'a4' };
    }
  };

  const getFontFamilyCss = (): string => {
    switch (fontFamily) {
      case 'Times New Roman':
        return '"Times New Roman", Times, serif';
      case 'Calibri':
        return 'Calibri, "Gill Sans", sans-serif';
      case 'Bookman Old Style':
        return '"Bookman Old Style", Georgia, serif';
      case 'Arial':
      default:
        return 'Arial, Helvetica, sans-serif';
    }
  };

  // Preload Image as Data URL
  const loadImageDataUrl = (url?: string): Promise<string | null> => {
    if (!url) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
            return;
          }
        } catch (e) {
          console.warn('Image conversion warning:', e);
        }
        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  // ADVANCED VECTOR PDF GENERATOR USING JSPDF & JSPDF-AUTOTABLE
  const generateVectorPdf = async (
    targetSiswaList: Siswa[],
    isBatch = false
  ): Promise<jsPDF | null> => {
    if (targetSiswaList.length === 0) return null;

    const { width: pageWidth, height: pageHeight, format } = getPaperDimensionsMm();
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: format,
      compress: true,
    });

    // Preload image assets
    const [logoPemdaData, logoSekolahData, kopBannerData, stempelData, ttdData] =
      await Promise.all([
        showLogoLeft ? loadImageDataUrl(appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl) : Promise.resolve(null),
        showLogoRight
          ? loadImageDataUrl(appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl)
          : Promise.resolve(null),
        kopType === 'banner'
          ? loadImageDataUrl(appState.sekolah.kopSekolahUrl)
          : Promise.resolve(null),
        showStempel ? loadImageDataUrl(appState.sekolah.stempelUrl) : Promise.resolve(null),
        showTtdKepsek
          ? loadImageDataUrl(appState.sekolah.ttdKepalaSekolahUrl)
          : Promise.resolve(null),
      ]);

    const jsPdfFont = fontFamily === 'Times New Roman' ? 'times' : 'helvetica';

    for (let sIdx = 0; sIdx < targetSiswaList.length; sIdx++) {
      const siswa = targetSiswaList[sIdx];
      if (sIdx > 0) {
        pdf.addPage(format, 'portrait');
      }

      const sGradeRecord = appState.nilaiKelas9List.find((n) => n.siswaId === siswa.id);
      const sNoSurat =
        sGradeRecord?.noSuratTranskrip ||
        (siswa.id === selectedSiswaId
          ? noSurat
          : `400.3.11.1/${158 + sIdx}.43/2026`);
      const sNoIjazah =
        siswa.noIjazah ||
        sGradeRecord?.noIjazah ||
        (siswa.id === selectedSiswaId
          ? noIjazah
          : `121202600155${String(947 + sIdx).padStart(3, '0')}`);
      const sTanggalKelulusan =
        siswa.tanggalKelulusan ||
        sGradeRecord?.tanggalKelulusan ||
        (siswa.id === selectedSiswaId ? tanggalKelulusan : '2 Juni 2026');

      const { rows: sRows, averageStr: sAvgStr } = getStudentTranskripGrades(siswa.id);

      const top = margins.top;
      const left = margins.left;
      const right = margins.right;
      const contentWidth = pageWidth - left - right;

      let currentY = top;

      // 1. KOP SURAT (HAPUS GARIS DI BAWAH KOP SESUAI PERMINTAAN USER)
      if (kopType === 'banner' && kopBannerData) {
        const bannerHeight = 28;
        try {
          pdf.addImage(
            kopBannerData,
            'PNG',
            left,
            currentY,
            contentWidth,
            bannerHeight,
            undefined,
            'FAST'
          );
        } catch (e) {}
        currentY += bannerHeight + 5;
      } else {
        const kopStartY = currentY;

        // Left Logo (Logo Pemda)
        if (showLogoLeft && logoPemdaData) {
          try {
            pdf.addImage(logoPemdaData, 'PNG', left, currentY, 18, 18, undefined, 'FAST');
          } catch (e) {}
        }

        // Right Logo (Logo Sekolah)
        if (showLogoRight && logoSekolahData) {
          try {
            pdf.addImage(
              logoSekolahData,
              'PNG',
              left + contentWidth - 18,
              currentY,
              18,
              18,
              undefined,
              'FAST'
            );
          } catch (e) {}
        }

        // Kop Typography
        pdf.setFont(jsPdfFont, 'bold');
        pdf.setFontSize(10.5);
        pdf.text(
          (
            appState.sekolah.pemerintahDaerah ||
            `PEMERINTAH KABUPATEN ${(appState.sekolah.kabupatenKota || 'BANYUMAS')}`
          ).toUpperCase(),
          left + contentWidth / 2,
          currentY + 4,
          { align: 'center' }
        );

        pdf.setFontSize(13);
        pdf.text(
          (appState.sekolah.namaSekolah || 'SMP NEGERI 2 KEMRANJEN').toUpperCase(),
          left + contentWidth / 2,
          currentY + 9.5,
          { align: 'center' }
        );

        pdf.setFont(jsPdfFont, 'normal');
        pdf.setFontSize(8.5);

        if (appState.sekolah.alamatLengkapKop) {
          const kopLines = appState.sekolah.alamatLengkapKop.split('\n').filter(Boolean);
          kopLines.forEach((line, idx) => {
            if (line.toLowerCase().includes('email')) {
              pdf.setTextColor(0, 80, 160);
            } else {
              pdf.setTextColor(0, 0, 0);
            }
            pdf.text(line, left + contentWidth / 2, currentY + 14 + (idx * 3.5), { align: 'center' });
          });
          pdf.setTextColor(0, 0, 0);
          currentY += 14 + (kopLines.length * 3.5) + 3;
        } else {
          const contactLine = `${appState.sekolah.alamat || 'Karangsalam'}, Telp. ${
            appState.sekolah.telepon || '08112627753'
          }, Kec. ${appState.sekolah.kecamatan || 'Kemranjen'}, ${
            appState.sekolah.kabupatenKota || 'Banyumas'
          } - ${appState.sekolah.kodePos || '53194'}`;
          pdf.text(contactLine, left + contentWidth / 2, currentY + 14, {
            align: 'center',
          });

          if (appState.sekolah.email || appState.sekolah.website) {
            pdf.setFontSize(8);
            pdf.text(
              `email : ${appState.sekolah.email || 'smpn2.kemranjen@banyumaskab.go.id'}`,
              left + contentWidth / 2,
              currentY + 17.5,
              { align: 'center' }
            );
          }
          currentY += 21;
        }
      }

      // Garis tebal tipis di bawah kop dengan 1,5 spasi
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.85); // Garis tebal (atas)
      pdf.line(left, currentY, left + contentWidth, currentY);
      pdf.setLineWidth(0.25); // Garis tipis (bawah)
      pdf.line(left, currentY + 0.8, left + contentWidth, currentY + 0.8);

      // Jarak 1,5 spasi (~6.5 mm) sebelum judul dokumen
      currentY += 7.0;

      // 2. JUDUL DOKUMEN: TRANSKRIP NILAI
      pdf.setFont(jsPdfFont, 'bold');
      pdf.setFontSize(13.5);
      pdf.text('TRANSKRIP NILAI', left + contentWidth / 2, currentY, {
        align: 'center',
      });
      currentY += 4.5;

      pdf.setFont(jsPdfFont, 'normal');
      pdf.setFontSize(9.5);
      pdf.text(`Nomor : ${sNoSurat}`, left + contentWidth / 2, currentY, {
        align: 'center',
      });
      currentY += 7;

      // 3. BLOK IDENTITAS PESERTA DIDIK
      pdf.setFont(jsPdfFont, 'normal');
      pdf.setFontSize(9);
      const labelW = 55;
      const colonW = 4;
      const rowGap = 4.2;

      const printIdentitasRow = (label: string, value: string) => {
        pdf.setFont(jsPdfFont, 'normal');
        pdf.text(label, left, currentY);
        pdf.text(':', left + labelW, currentY);
        pdf.setFont(jsPdfFont, label === 'Nama Lengkap' ? 'bold' : 'normal');
        pdf.text(value, left + labelW + colonW, currentY);
        currentY += rowGap;
      };

      printIdentitasRow('Satuan Pendidikan', namaSekolahLengkap);
      printIdentitasRow('Nomor Pokok Sekolah Nasional', npsnSekolah);
      printIdentitasRow('Nama Lengkap', (siswa.nama || '').toUpperCase());
      const tglLahirFormatted = formatIndonesianDate(siswa.tanggalLahir);
      printIdentitasRow(
        'Tempat, tanggal lahir',
        `${siswa.tempatLahir || 'Banyumas'}, ${tglLahirFormatted}`
      );
      printIdentitasRow('Nomor Induk Siswa Nasional', siswa.nisn || '-');
      printIdentitasRow('Nomor Ijazah', sNoIjazah || '-');
      printIdentitasRow('Tanggal Kelulusan', sTanggalKelulusan || '2 Juni 2026');

      // 4. TABEL NILAI TRANSKRIP
      currentY += 2.5;
      const tableHead = [
        [
          { content: 'No', styles: { halign: 'center' as const } },
          { content: 'Mata Pelajaran', styles: { halign: 'center' as const } },
          { content: 'Nilai', styles: { halign: 'center' as const } },
        ],
      ];

      const tableBody = sRows.map((r) => [
        { content: String(r.no), styles: { halign: 'center' as const } },
        { content: r.namaMapel, styles: { halign: 'left' as const } },
        { content: r.scoreStr, styles: { halign: 'center' as const } },
      ]);

      const tableFoot = [
        [
          {
            content: 'Rata-rata',
            colSpan: 2,
            styles: { halign: 'center' as const, fontStyle: 'bold' as const },
          },
          {
            content: sAvgStr,
            styles: { halign: 'center' as const, fontStyle: 'bold' as const },
          },
        ],
      ];

      autoTable(pdf, {
        startY: currentY,
        head: tableHead,
        body: tableBody,
        foot: tableFoot,
        theme: 'plain',
        margin: { left, right },
        styles: {
          font: jsPdfFont,
          fontSize: 8.8,
          cellPadding: 1.2,
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          textColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [255, 255, 255],
          fontStyle: 'bold',
          textColor: [0, 0, 0],
          lineWidth: 0.25,
        },
        footStyles: {
          fillColor: [255, 255, 255],
          fontStyle: 'bold',
          textColor: [0, 0, 0],
          lineWidth: 0.25,
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 26, halign: 'center' },
        },
        tableLineWidth: 0.25,
        tableLineColor: [0, 0, 0],
      });

      // @ts-ignore
      currentY = pdf.lastAutoTable.finalY + 6;

      // 5. TANDA TANGAN (KANAN BAWAH)
      const ttdX = left + contentWidth - 68;
      pdf.setFont(jsPdfFont, 'normal');
      pdf.setFontSize(9);
      pdf.text(`${tempatTtd}, ${tanggalTtd}`, ttdX, currentY);
      currentY += 4.5;
      pdf.text(jabatanTtd || 'Kepala,', ttdX, currentY);

      // Area TTD & Stempel
      const ttdCenterY = currentY + 12;
      if (showStempel && stempelData) {
        try {
          pdf.addImage(stempelData, 'PNG', ttdX - 12, ttdCenterY - 10, 24, 24, undefined, 'FAST');
        } catch (e) {}
      }
      if (showTtdKepsek && ttdData) {
        try {
          pdf.addImage(ttdData, 'PNG', ttdX + 2, ttdCenterY - 7, 26, 16, undefined, 'FAST');
        } catch (e) {}
      }

      currentY += 21;
      pdf.setFont(jsPdfFont, 'bold');
      pdf.text(namaKepalaSekolah, ttdX, currentY);
      currentY += 4.5;
      pdf.setFont(jsPdfFont, 'normal');
      pdf.text(`NIP ${nipKepalaSekolah}`, ttdX, currentY);

      if (isBatch && batchProgress) {
        setBatchProgress({ current: sIdx + 1, total: targetSiswaList.length });
      }
    }

    return pdf;
  };

  // Handle Download Single Student PDF
  const handleDownloadSinglePdf = async () => {
    if (!selectedSiswa) return;
    setIsGeneratingPdf(true);
    try {
      const pdf = await generateVectorPdf([selectedSiswa]);
      if (pdf) {
        const cleanName = (selectedSiswa.nama || 'Siswa').replace(/[^a-zA-Z0-9_-]/g, '_');
        pdf.save(`Transkrip_Nilai_${selectedSiswa.nisn || selectedSiswa.nis}_${cleanName}.pdf`);
        setPdfSuccessToast(`Transkrip Nilai untuk ${selectedSiswa.nama} berhasil diunduh!`);
        setTimeout(() => setPdfSuccessToast(null), 4000);
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handle Download Batch PDF
  const handleDownloadBatchPdf = async () => {
    const targetStudents = kelas9Students.filter((s) => batchSelectedIds.includes(s.id));
    if (targetStudents.length === 0) return;

    setIsBatchGenerating(true);
    setBatchProgress({ current: 1, total: targetStudents.length });
    try {
      const pdf = await generateVectorPdf(targetStudents, true);
      if (pdf) {
        const dateTag = new Date().toISOString().slice(0, 10);
        pdf.save(`Transkrip_Nilai_Kelas9_Masal_${targetStudents.length}_Siswa_${dateTag}.pdf`);
        setPdfSuccessToast(
          `Cetak masal ${targetStudents.length} Transkrip Nilai berhasil digabungkan ke PDF!`
        );
        setTimeout(() => setPdfSuccessToast(null), 4000);
      }
    } catch (err) {
      console.error('Error batch PDF:', err);
    } finally {
      setIsBatchGenerating(false);
      setBatchProgress(null);
    }
  };

  // Handle Save Current Student Transkrip Fields
  const handleSaveStudentDetails = () => {
    if (!selectedSiswa) return;

    // Update NilaiKelas9List
    const existingIndex = appState.nilaiKelas9List.findIndex(
      (n) => n.siswaId === selectedSiswaId
    );
    let updatedNilaiList: NilaiKelas9[] = [...appState.nilaiKelas9List];

    if (existingIndex >= 0) {
      updatedNilaiList[existingIndex] = {
        ...updatedNilaiList[existingIndex],
        noSuratTranskrip: noSurat,
        noIjazah: noIjazah,
        tanggalKelulusan: tanggalKelulusan,
        updatedAt: new Date().toISOString(),
      };
    } else {
      updatedNilaiList.push({
        id: `k9-${Date.now()}-${selectedSiswaId}`,
        siswaId: selectedSiswaId,
        tahunAjaran: appState.sekolah.tanggalSurat || '2025/2026',
        nilaiRaporSem1_5: {},
        nilaiSumatifAkhir: {},
        nilaiSekolah: {},
        rataRataKeseluruhan: 88.5,
        statusLulus: 'LULUS',
        noSuratTranskrip: noSurat,
        noIjazah: noIjazah,
        tanggalKelulusan: tanggalKelulusan,
        updatedAt: new Date().toISOString(),
      });
    }

    // Update SiswaList (for noIjazah & tanggalKelulusan)
    const updatedSiswaList: Siswa[] = appState.siswaList.map((s) => {
      if (s.id === selectedSiswaId) {
        return {
          ...s,
          noIjazah: noIjazah,
          tanggalKelulusan: tanggalKelulusan,
        };
      }
      return s;
    });

    const notif = createNotification(
      'Update Data Transkrip',
      `Nomor surat dan data ijazah untuk ${selectedSiswa.nama} berhasil disimpan.`,
      'kelas9'
    );

    if (onUpdateNilaiKelas9) onUpdateNilaiKelas9(updatedNilaiList, notif);
    if (onUpdateSiswaList) onUpdateSiswaList(updatedSiswaList, notif);

    setPdfSuccessToast(`Data Transkrip ${selectedSiswa.nama} berhasil disimpan!`);
    setTimeout(() => setPdfSuccessToast(null), 3000);
  };

  // EXCEL EXPORT HANDLER
  const handleExportExcel = () => {
    const excelData = kelas9Students.map((s, idx) => {
      const g = appState.nilaiKelas9List.find((n) => n.siswaId === s.id);
      const studentNoSurat =
        g?.noSuratTranskrip || `400.3.11.1/${158 + idx}.43/2026`;
      const studentNoIjazah =
        s.noIjazah || g?.noIjazah || `121202600155${String(947 + idx).padStart(3, '0')}`;
      const studentTglLulus =
        s.tanggalKelulusan || g?.tanggalKelulusan || '2 Juni 2026';

      return {
        'No': idx + 1,
        'ID_Siswa': s.id,
        'Kelas': s.kodeKelas,
        'NIS': s.nis || '',
        'NISN': s.nisn || '',
        'Nama Lengkap': s.nama,
        'Nomor Surat Transkrip': studentNoSurat,
        'Nomor Ijazah': studentNoIjazah,
        'Tanggal Kelulusan / Ijazah': studentTglLulus,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [
      { wch: 5 }, // No
      { wch: 15 }, // ID_Siswa
      { wch: 8 }, // Kelas
      { wch: 12 }, // NIS
      { wch: 15 }, // NISN
      { wch: 30 }, // Nama
      { wch: 30 }, // No Surat Transkrip
      { wch: 25 }, // No Ijazah
      { wch: 22 }, // Tgl Kelulusan
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DATA_TRANSKRIP');
    XLSX.writeFile(
      workbook,
      `Data_Nomor_Surat_Ijazah_Kelas9_${appState.sekolah.namaSekolah || 'Sekolah'}.xlsx`
    );

    setPdfSuccessToast('File Excel Data Transkrip & Ijazah berhasil diunduh!');
    setTimeout(() => setPdfSuccessToast(null), 3000);
  };

  // EXCEL IMPORT HANDLER
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileLoading(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        let matched = 0;
        let unmatched = 0;

        const parsedRows = rawJson.map((row: any) => {
          const nisVal = String(row['NIS'] || row['nis'] || '').trim();
          const nisnVal = String(row['NISN'] || row['nisn'] || '').trim();
          const idVal = String(row['ID_Siswa'] || row['id'] || '').trim();
          const namaVal = String(row['Nama Lengkap'] || row['Nama'] || row['nama'] || '').trim();

          const noSuratVal = String(
            row['Nomor Surat Transkrip'] ||
              row['Nomor Surat'] ||
              row['noSuratTranskrip'] ||
              row['No Surat'] ||
              ''
          ).trim();

          const noIjazahVal = String(
            row['Nomor Ijazah'] || row['noIjazah'] || row['No Ijazah'] || ''
          ).trim();

          const tglLulusVal = String(
            row['Tanggal Kelulusan / Ijazah'] ||
              row['Tanggal Kelulusan'] ||
              row['Tanggal Ijazah'] ||
              row['tanggalKelulusan'] ||
              ''
          ).trim();

          const isMatch = kelas9Students.some(
            (s) =>
              (idVal && s.id === idVal) ||
              (nisnVal && s.nisn === nisnVal) ||
              (nisVal && s.nis === nisVal) ||
              (namaVal && s.nama.toLowerCase() === namaVal.toLowerCase())
          );

          if (isMatch) matched++;
          else unmatched++;

          return {
            nis: nisVal,
            nisn: nisnVal,
            nama: namaVal,
            noSuratTranskrip: noSuratVal,
            noIjazah: noIjazahVal,
            tanggalKelulusan: tglLulusVal,
            statusMatch: isMatch ? ('MATCHED' as const) : ('NOT_FOUND' as const),
          };
        });

        setExcelPreviewData({
          rows: parsedRows,
          matchedCount: matched,
          unmatchedCount: unmatched,
        });
        setExcelImportModalOpen(true);
      } catch (err) {
        console.error('Failed to parse excel:', err);
        alert('Gagal membaca file Excel. Pastikan format file .xlsx valid.');
      } finally {
        setExcelFileLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  // APPLY EXCEL IMPORT DATA TO STATE
  const handleApplyExcelImport = () => {
    if (!excelPreviewData) return;

    let updatedNilaiList: NilaiKelas9[] = [...appState.nilaiKelas9List];
    let updatedSiswaList: Siswa[] = [...appState.siswaList];
    let updateCount = 0;

    excelPreviewData.rows.forEach((row) => {
      const student = kelas9Students.find(
        (s) =>
          (row.nisn && s.nisn === row.nisn) ||
          (row.nis && s.nis === row.nis) ||
          (row.nama && s.nama.toLowerCase() === row.nama.toLowerCase())
      );

      if (student) {
        updateCount++;

        // Update Siswa Record
        const sIndex = updatedSiswaList.findIndex((s) => s.id === student.id);
        if (sIndex >= 0) {
          updatedSiswaList[sIndex] = {
            ...updatedSiswaList[sIndex],
            noIjazah: row.noIjazah || updatedSiswaList[sIndex].noIjazah,
            tanggalKelulusan: row.tanggalKelulusan || updatedSiswaList[sIndex].tanggalKelulusan,
          };
        }

        // Update NilaiKelas9 Record
        const nIndex = updatedNilaiList.findIndex((n) => n.siswaId === student.id);
        if (nIndex >= 0) {
          updatedNilaiList[nIndex] = {
            ...updatedNilaiList[nIndex],
            noSuratTranskrip: row.noSuratTranskrip || updatedNilaiList[nIndex].noSuratTranskrip,
            noIjazah: row.noIjazah || updatedNilaiList[nIndex].noIjazah,
            tanggalKelulusan: row.tanggalKelulusan || updatedNilaiList[nIndex].tanggalKelulusan,
            updatedAt: new Date().toISOString(),
          };
        } else {
          updatedNilaiList.push({
            id: `k9-${Date.now()}-${student.id}`,
            siswaId: student.id,
            tahunAjaran: appState.sekolah.tanggalSurat || '2025/2026',
            nilaiRaporSem1_5: {},
            nilaiSumatifAkhir: {},
            nilaiSekolah: {},
            rataRataKeseluruhan: 88.5,
            statusLulus: 'LULUS',
            noSuratTranskrip: row.noSuratTranskrip,
            noIjazah: row.noIjazah,
            tanggalKelulusan: row.tanggalKelulusan,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    });

    const notif = createNotification(
      'Impor Excel Transkrip & Ijazah',
      `Berhasil memperbarui data nomor surat & ijazah untuk ${updateCount} siswa.`,
      'kelas9'
    );

    if (onUpdateNilaiKelas9) onUpdateNilaiKelas9(updatedNilaiList, notif);
    if (onUpdateSiswaList) onUpdateSiswaList(updatedSiswaList, notif);

    setExcelImportModalOpen(false);
    setExcelPreviewData(null);
    setPdfSuccessToast(`Berhasil memperbarui data transkrip untuk ${updateCount} siswa!`);
    setTimeout(() => setPdfSuccessToast(null), 4000);
  };

  // GENERATE AUTO NUMBERING FOR ALL GRADE 9 STUDENTS
  const handleApplyAutoNumbering = () => {
    let updatedNilaiList: NilaiKelas9[] = [...appState.nilaiKelas9List];
    let updatedSiswaList: Siswa[] = [...appState.siswaList];

    kelas9Students.forEach((student, idx) => {
      const studentNoSurat = `${autoSuratPrefix}${autoSuratStartNo + idx}${autoSuratSuffix}`;
      const studentNoIjazah = `${autoIjazahPrefix}${String(autoIjazahStartNo + idx).padStart(
        3,
        '0'
      )}`;

      // Update Siswa
      const sIndex = updatedSiswaList.findIndex((s) => s.id === student.id);
      if (sIndex >= 0) {
        updatedSiswaList[sIndex] = {
          ...updatedSiswaList[sIndex],
          noIjazah: studentNoIjazah,
          tanggalKelulusan: autoTanggalKelulusanVal,
        };
      }

      // Update NilaiKelas9
      const nIndex = updatedNilaiList.findIndex((n) => n.siswaId === student.id);
      if (nIndex >= 0) {
        updatedNilaiList[nIndex] = {
          ...updatedNilaiList[nIndex],
          noSuratTranskrip: studentNoSurat,
          noIjazah: studentNoIjazah,
          tanggalKelulusan: autoTanggalKelulusanVal,
          updatedAt: new Date().toISOString(),
        };
      } else {
        updatedNilaiList.push({
          id: `k9-${Date.now()}-${student.id}`,
          siswaId: student.id,
          tahunAjaran: appState.sekolah.tanggalSurat || '2025/2026',
          nilaiRaporSem1_5: {},
          nilaiSumatifAkhir: {},
          nilaiSekolah: {},
          rataRataKeseluruhan: 88.5,
          statusLulus: 'LULUS',
          noSuratTranskrip: studentNoSurat,
          noIjazah: studentNoIjazah,
          tanggalKelulusan: autoTanggalKelulusanVal,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    const notif = createNotification(
      'Auto-Generate Nomor Transkrip & Ijazah',
      `Berhasil men-generate nomor surat & ijazah berurutan untuk ${kelas9Students.length} siswa kelas 9.`,
      'kelas9'
    );

    if (onUpdateNilaiKelas9) onUpdateNilaiKelas9(updatedNilaiList, notif);
    if (onUpdateSiswaList) onUpdateSiswaList(updatedSiswaList, notif);

    setAutoNumberModalOpen(false);
    setPdfSuccessToast(
      `Nomor surat & ijazah berhasil di-generate untuk ${kelas9Students.length} siswa!`
    );
    setTimeout(() => setPdfSuccessToast(null), 4000);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {pdfSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
          <span className="text-xs font-semibold">{pdfSuccessToast}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Award size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Cetak Transkrip Nilai Akademik
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Penerbitan dokumen transkrip nilai resmi kelulusan dengan penomoran surat, nomor ijazah, dan sinkronisasi Excel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setAutoNumberModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Hash size={15} />
            <span>Auto Nomor</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>Ekspor Excel</span>
          </button>

          <label className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition flex items-center space-x-1.5 cursor-pointer">
            <Upload size={15} />
            <span>{excelFileLoading ? 'Membaca...' : 'Impor Excel'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          <button
            onClick={() => setShowPreviewModal(true)}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Eye size={15} />
            <span>Pratinjau Layar Penuh</span>
          </button>

          <button
            onClick={handleDownloadSinglePdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl transition shadow-md shadow-blue-500/20 flex items-center space-x-1.5 cursor-pointer"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Membuat PDF...</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>Unduh PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Settings & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Controls & Settings */}
        <div className="lg:col-span-5 space-y-6">
          {/* Student Selector Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Users size={14} />
                <span>Pilih Siswa ({selectedIndex + 1} dari {kelas9Students.length})</span>
              </h3>
              <div className="flex items-center space-x-1">
                <button
                  onClick={handlePrevStudent}
                  disabled={selectedIndex <= 0}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Siswa Sebelumnya"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNextStudent}
                  disabled={selectedIndex >= kelas9Students.length - 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Siswa Selanjutnya"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Cari siswa..."
                  value={searchSiswa}
                  onChange={(e) => setSearchSiswa(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">Semua Kelas 9</option>
                {Array.from(new Set(kelas9Students.map((s) => s.kodeKelas))).map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={selectedSiswaId}
              onChange={(e) => setSelectedSiswaId(e.target.value)}
              className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              {kelas9Students
                .filter(
                  (s) =>
                    (filterKelas === 'all' || s.kodeKelas === filterKelas) &&
                    (s.nama.toLowerCase().includes(searchSiswa.toLowerCase()) ||
                      s.nisn.includes(searchSiswa) ||
                      s.nis.includes(searchSiswa))
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} - NISN: {s.nisn} ({s.kodeKelas})
                  </option>
                ))}
            </select>
          </div>

          {/* Settings Tabs Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none bg-slate-50/50">
              <button
                onClick={() => setActiveTab('surat')}
                className={`px-3.5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition cursor-pointer ${
                  activeTab === 'surat'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Nomor & Ijazah
              </button>
              <button
                onClick={() => setActiveTab('ttd')}
                className={`px-3.5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition cursor-pointer ${
                  activeTab === 'ttd'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Tempat & TTD
              </button>
              <button
                onClick={() => setActiveTab('kop')}
                className={`px-3.5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition cursor-pointer ${
                  activeTab === 'kop'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Kop Surat
              </button>
              <button
                onClick={() => setActiveTab('layout')}
                className={`px-3.5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition cursor-pointer ${
                  activeTab === 'layout'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Font & Margin
              </button>
              <button
                onClick={() => setActiveTab('mapel')}
                className={`px-3.5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition cursor-pointer ${
                  activeTab === 'mapel'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Mata Pelajaran
              </button>
              <button
                onClick={() => setActiveTab('masal')}
                className={`px-3.5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition cursor-pointer ${
                  activeTab === 'masal'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Cetak Masal
              </button>
            </div>

            <div className="p-5">
              {/* TAB 1: NOMOR SURAT & IJAZAH */}
              {activeTab === 'surat' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nomor Surat Transkrip
                    </label>
                    <input
                      type="text"
                      value={noSurat}
                      onChange={(e) => setNoSurat(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      placeholder="400.3.11.1/158.43/2026"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Nomor Ijazah
                      </label>
                      <input
                        type="text"
                        value={noIjazah}
                        onChange={(e) => setNoIjazah(e.target.value)}
                        className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        placeholder="121202600155947"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Tanggal Kelulusan
                      </label>
                      <input
                        type="text"
                        value={tanggalKelulusan}
                        onChange={(e) => setTanggalKelulusan(e.target.value)}
                        className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        placeholder="2 Juni 2026"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Satuan Pendidikan Lengkap
                    </label>
                    <input
                      type="text"
                      value={namaSekolahLengkap}
                      onChange={(e) => setNamaSekolahLengkap(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      NPSN Sekolah
                    </label>
                    <input
                      type="text"
                      value={npsnSekolah}
                      onChange={(e) => setNpsnSekolah(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <button
                    onClick={handleSaveStudentDetails}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer mt-2"
                  >
                    <Save size={15} />
                    <span>Simpan Perubahan Siswa Ini</span>
                  </button>
                </div>
              )}

              {/* TAB 2: TEMPAT & TTD */}
              {activeTab === 'ttd' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Tempat Tanda Tangan
                      </label>
                      <input
                        type="text"
                        value={tempatTtd}
                        onChange={(e) => setTempatTtd(e.target.value)}
                        className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Banyumas"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Tanggal Tanda Tangan
                      </label>
                      <input
                        type="text"
                        value={tanggalTtd}
                        onChange={(e) => setTanggalTtd(e.target.value)}
                        className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        placeholder="8 Juni 2026"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Jabatan Penandatangan
                    </label>
                    <input
                      type="text"
                      value={jabatanTtd}
                      onChange={(e) => setJabatanTtd(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Kepala,"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nama Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={namaKepalaSekolah}
                      onChange={(e) => setNamaKepalaSekolah(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Budhy Susanto, S. Pd."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      NIP Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={nipKepalaSekolah}
                      onChange={(e) => setNipKepalaSekolah(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      placeholder="197908202005011013"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTtdKepsek}
                        onChange={(e) => setShowTtdKepsek(e.target.checked)}
                        className="rounded-sm text-blue-600 focus:ring-blue-500"
                      />
                      <span>Sertakan Gambar TTD Digital (dari Profil Sekolah)</span>
                    </label>

                    <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showStempel}
                        onChange={(e) => setShowStempel(e.target.checked)}
                        className="rounded-sm text-blue-600 focus:ring-blue-500"
                      />
                      <span>Sertakan Gambar Stempel Resmi (dari Profil Sekolah)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 3: KOP SURAT */}
              {activeTab === 'kop' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-blue-800 leading-relaxed">
                    Kop Transkrip otomatis disinkronkan dari <strong>Sub Menu Pengaturan Sekolah</strong> dilengkapi dengan garis ganda tebal-tipis resmi berjarak 1,5 spasi.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tipe Kop Surat
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setKopType('text')}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                          kopType === 'text'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Teks Resmi Berlogo
                      </button>
                      <button
                        type="button"
                        onClick={() => setKopType('banner')}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                          kopType === 'banner'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Banner Gambar Kop
                      </button>
                    </div>
                  </div>

                  {kopType === 'text' && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showLogoLeft}
                          onChange={(e) => setShowLogoLeft(e.target.checked)}
                          className="rounded-sm text-blue-600 focus:ring-blue-500"
                        />
                        <span>Tampilkan Logo Kiri (Logo Pemda)</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showLogoRight}
                          onChange={(e) => setShowLogoRight(e.target.checked)}
                          className="rounded-sm text-blue-600 focus:ring-blue-500"
                        />
                        <span>Tampilkan Logo Kanan (Logo Sekolah)</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: LAYOUT, FONT & MARGIN */}
              {activeTab === 'layout' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Bentuk Huruf (Font)
                      </label>
                      <select
                        value={fontFamily}
                        onChange={(e: any) => setFontFamily(e.target.value)}
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="Arial">Arial (Sesuai Gambar)</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Calibri">Calibri</option>
                        <option value="Bookman Old Style">Bookman Old Style</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Ukuran Kertas
                      </label>
                      <select
                        value={paperSize}
                        onChange={(e: any) => setPaperSize(e.target.value)}
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="A4">A4 (210 x 297 mm)</option>
                        <option value="F4">F4 / Folio (215 x 330 mm)</option>
                        <option value="Letter">Letter (215.9 x 279.4 mm)</option>
                        <option value="Legal">Legal (215.9 x 355.6 mm)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ukuran Huruf Dokumen
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['9pt', '9.5pt', '10pt', '11pt'].map((fs) => (
                        <button
                          key={fs}
                          type="button"
                          onClick={() => setFontSize(fs)}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                            fontSize === fs
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {fs}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Pengaturan Margin (mm)
                      </label>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => setMargins({ top: 15, bottom: 15, left: 20, right: 15 })}
                          className="text-[10px] text-blue-600 hover:underline font-semibold"
                        >
                          Standar
                        </button>
                        <span className="text-[10px] text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setMargins({ top: 10, bottom: 10, left: 15, right: 10 })}
                          className="text-[10px] text-blue-600 hover:underline font-semibold"
                        >
                          Ringkas
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Atas
                        </span>
                        <input
                          type="number"
                          value={margins.top}
                          onChange={(e) =>
                            setMargins({ ...margins, top: parseInt(e.target.value, 10) || 0 })
                          }
                          className="w-full text-xs text-center font-bold bg-slate-50 border border-slate-200 rounded-lg py-1.5 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Bawah
                        </span>
                        <input
                          type="number"
                          value={margins.bottom}
                          onChange={(e) =>
                            setMargins({ ...margins, bottom: parseInt(e.target.value, 10) || 0 })
                          }
                          className="w-full text-xs text-center font-bold bg-slate-50 border border-slate-200 rounded-lg py-1.5 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Kiri
                        </span>
                        <input
                          type="number"
                          value={margins.left}
                          onChange={(e) =>
                            setMargins({ ...margins, left: parseInt(e.target.value, 10) || 0 })
                          }
                          className="w-full text-xs text-center font-bold bg-slate-50 border border-slate-200 rounded-lg py-1.5 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Kanan
                        </span>
                        <input
                          type="number"
                          value={margins.right}
                          onChange={(e) =>
                            setMargins({ ...margins, right: parseInt(e.target.value, 10) || 0 })
                          }
                          className="w-full text-xs text-center font-bold bg-slate-50 border border-slate-200 rounded-lg py-1.5 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: MATA PELAJARAN */}
              {activeTab === 'mapel' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Mata Pelajaran Ditampilkan ({selectedMapelIds.length}/{allMapelOptions.length})
                    </span>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={handleSelectAllMapel}
                        className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllMapel}
                        className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                      >
                        Batal Semua
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                    {allMapelOptions.map((m, idx) => {
                      const checked = selectedMapelIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition ${
                            checked ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleMapel(m.id)}
                              className="rounded-sm text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-semibold">
                              {idx + 1}. {m.namaMapel}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {m.kodeMapel || m.id}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Format Penamaan Mapel Agama
                    </label>
                    <select
                      value={religionMode}
                      onChange={(e: any) => setReligionMode(e.target.value)}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
                    >
                      <option value="general">Sesuai Input Data Mapel (Contoh Gambar)</option>
                      <option value="auto_simple">Otomatis Agama (Pendidikan Agama Islam)</option>
                      <option value="auto_specific">
                        Otomatis Lengkap (Pendidikan Agama Islam dan Budi Pekerti)
                      </option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 6: CETAK MASAL */}
              {activeTab === 'masal' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Pilih Siswa Cetak Masal ({batchSelectedIds.length}/{kelas9Students.length})
                    </span>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setBatchSelectedIds(kelas9Students.map((s) => s.id))}
                        className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setBatchSelectedIds([])}
                        className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                    {kelas9Students.map((s, idx) => {
                      const checked = batchSelectedIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition ${
                            checked ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setBatchSelectedIds((prev) =>
                                  prev.includes(s.id)
                                    ? prev.filter((id) => id !== s.id)
                                    : [...prev, s.id]
                                )
                              }
                              className="rounded-sm text-blue-600 focus:ring-blue-500"
                            />
                            <span>
                              {idx + 1}. {s.nama}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {s.kodeKelas}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleDownloadBatchPdf}
                    disabled={isBatchGenerating || batchSelectedIds.length === 0}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {isBatchGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>
                          Menggabungkan PDF ({batchProgress?.current}/{batchProgress?.total})...
                        </span>
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        <span>Unduh PDF Masal ({batchSelectedIds.length} Siswa)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE TRANSKRIP PREVIEW (PERSIS CONTOH GAMBAR) */}
        <div className="lg:col-span-7">
          <div className="sticky top-6 bg-slate-200/70 p-4 md:p-6 rounded-3xl border border-slate-300/80 shadow-inner overflow-x-auto">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                <FileBadge size={14} className="text-blue-600" />
                <span>Lembar Transkrip Nilai Resmi</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-2.5 py-1 text-[11px] font-bold bg-white text-slate-700 hover:bg-slate-100 rounded-lg shadow-xs border border-slate-200 flex items-center space-x-1 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Cetak</span>
                </button>
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-xs flex items-center space-x-1 cursor-pointer"
                >
                  <Maximize2 size={13} />
                  <span>Perbesar</span>
                </button>
              </div>
            </div>

            {/* PAPER SHEET SIMULATION */}
            <div
              className="bg-white mx-auto shadow-2xl rounded-xs text-slate-900 transition-all border border-slate-300"
              style={{
                fontFamily: getFontFamilyCss(),
                width: '100%',
                maxWidth: '680px',
                minHeight: '880px',
                paddingTop: `${margins.top}mm`,
                paddingBottom: `${margins.bottom}mm`,
                paddingLeft: `${margins.left}mm`,
                paddingRight: `${margins.right}mm`,
                fontSize: fontSize === '9pt' ? '12px' : fontSize === '9.5pt' ? '12.5px' : fontSize === '11pt' ? '14px' : '13px',
              }}
            >
              {/* 1. KOP SURAT (TANPA GARIS DI BAWAH KOP) */}
              {kopType === 'banner' && appState.sekolah.kopSekolahUrl ? (
                <div className="mb-4 text-center">
                  <img
                    src={appState.sekolah.kopSekolahUrl}
                    alt="Kop Surat Banner"
                    className="w-full max-h-28 object-contain mx-auto"
                  />
                </div>
              ) : (
                <div className="mb-4 text-center relative flex items-center justify-between">
                  {showLogoLeft && (
                    <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                      {(appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl) ? (
                        <img
                          src={appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl}
                          alt="Logo Pemda"
                          className="w-14 h-14 object-contain"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full border border-slate-400 flex items-center justify-center text-[10px] font-bold">
                          LOGO
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex-1 px-2 text-center">
                    <h3 className="text-[11px] font-bold tracking-wider uppercase text-slate-800">
                      {appState.sekolah.pemerintahDaerah?.toUpperCase() || `PEMERINTAH KABUPATEN ${(appState.sekolah.kabupatenKota || 'BANYUMAS').toUpperCase()}`}
                    </h3>
                    <h1 className="text-[15px] font-black tracking-wide text-slate-900 uppercase">
                      {appState.sekolah.namaSekolah || 'SMP NEGERI 2 KEMRANJEN'}
                    </h1>
                    {appState.sekolah.alamatLengkapKop ? (
                      <p className="text-[9.5px] text-slate-800 leading-tight whitespace-pre-line font-medium">
                        {appState.sekolah.alamatLengkapKop}
                      </p>
                    ) : (
                      <>
                        <p className="text-[10px] text-slate-700 leading-tight">
                          {appState.sekolah.alamat || 'Karangsalam'}, Telp. {appState.sekolah.telepon || '08112627753'}, Kec. {appState.sekolah.kecamatan || 'Kemranjen'}, {appState.sekolah.kabupatenKota || 'Banyumas'} {appState.sekolah.kodePos || '53194'}
                        </p>
                        <p className="text-[9.5px] text-blue-700 leading-tight">
                          email : {appState.sekolah.email || 'smpn2.kemranjen@banyumaskab.go.id'}
                        </p>
                      </>
                    )}
                  </div>

                  {showLogoRight && (
                    <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                      {(appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl) ? (
                        <img
                          src={appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl}
                          alt="Logo Sekolah"
                          className="w-14 h-14 object-contain"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full border border-slate-400 flex items-center justify-center text-[10px] font-bold">
                          LOGO
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Garis Tebal Tipis di Bawah Kop dengan 1,5 Spasi */}
              <div className="mt-2 mb-4">
                <div className="border-t-[2.5px] border-black"></div>
                <div className="border-t-[0.75px] border-black mt-[1.5px]"></div>
              </div>

              {/* 2. JUDUL DOKUMEN */}
              <div className="text-center mb-5">
                <h2 className="text-base font-extrabold uppercase tracking-wide">
                  TRANSKRIP NILAI
                </h2>
                <p className="text-[12px] font-normal text-slate-800">
                  Nomor : {noSurat}
                </p>
              </div>

              {/* 3. BLOK IDENTITAS SISWA */}
              <div className="text-[12px] leading-relaxed mb-4 space-y-1">
                <div className="flex">
                  <div className="w-56 shrink-0">Satuan Pendidikan</div>
                  <div className="w-4 text-center">:</div>
                  <div className="flex-1">{namaSekolahLengkap}</div>
                </div>
                <div className="flex">
                  <div className="w-56 shrink-0">Nomor Pokok Sekolah Nasional</div>
                  <div className="w-4 text-center">:</div>
                  <div className="flex-1">{npsnSekolah}</div>
                </div>
                <div className="flex">
                  <div className="w-56 shrink-0 font-medium">Nama Lengkap</div>
                  <div className="w-4 text-center">:</div>
                  <div className="flex-1 font-bold uppercase">{selectedSiswa?.nama || '-'}</div>
                </div>
                <div className="flex">
                  <div className="w-56 shrink-0">Tempat, tanggal lahir</div>
                  <div className="w-4 text-center">:</div>
                  <div className="flex-1">
                    {selectedSiswa?.tempatLahir || 'Banyumas'}, {formatIndonesianDate(selectedSiswa?.tanggalLahir)}
                  </div>
                </div>
                <div className="flex">
                  <div className="w-56 shrink-0">Nomor Induk Siswa Nasional</div>
                  <div className="w-4 text-center">:</div>
                  <div className="flex-1">{selectedSiswa?.nisn || '-'}</div>
                </div>
                <div className="flex">
                  <div className="w-56 shrink-0">Nomor Ijazah</div>
                  <div className="w-4 text-center">:</div>
                  <div className="flex-1">{noIjazah}</div>
                </div>
                <div className="flex">
                  <div className="w-56 shrink-0">Tanggal Kelulusan</div>
                  <div className="w-4 text-center">:</div>
                  <div className="flex-1">{tanggalKelulusan}</div>
                </div>
              </div>

              {/* 4. TABEL NILAI TRANSKRIP (PERSIS SESUAI GAMBAR) */}
              <table className="w-full border-collapse border border-slate-900 text-[11.5px] mb-6">
                <thead>
                  <tr className="border-b border-slate-900 font-bold text-center">
                    <th className="border border-slate-900 py-1 px-2 w-12">No</th>
                    <th className="border border-slate-900 py-1 px-3 text-center">Mata Pelajaran</th>
                    <th className="border border-slate-900 py-1 px-3 w-24">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="border border-slate-900 py-3 px-3 text-center text-slate-500 italic">
                        Belum ada nilai mata pelajaran yang terisi (nilai 0 / belum diinput pada menu Input Nilai K9).
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((r) => (
                      <tr key={r.no} className="border-b border-slate-900">
                        <td className="border border-slate-900 py-1 px-2 text-center">{r.no}</td>
                        <td className="border border-slate-900 py-1 px-3 text-left">{r.namaMapel}</td>
                        <td className="border border-slate-900 py-1 px-3 text-center font-normal">{r.scoreStr}</td>
                      </tr>
                    ))
                  )}
                  {/* FOOTER RATA-RATA (SATU BARIS SESUAI GAMBAR) */}
                  <tr className="border-t border-slate-900 font-bold">
                    <td colSpan={2} className="border border-slate-900 py-1.5 px-3 text-center">
                      Rata-rata
                    </td>
                    <td className="border border-slate-900 py-1.5 px-3 text-center">
                      {averageStr}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 5. TANDA TANGAN (KANAN BAWAH) */}
              <div className="flex justify-end pt-2">
                <div className="w-64 text-left text-[12px] leading-snug">
                  <p>{tempatTtd}, {tanggalTtd}</p>
                  <p>{jabatanTtd}</p>
                  
                  {/* Space for signature */}
                  <div className="h-16 relative flex items-center">
                    {showStempel && appState.sekolah.stempelUrl && (
                      <img
                        src={appState.sekolah.stempelUrl}
                        alt="Stempel"
                        className="w-16 h-16 object-contain absolute -left-6 opacity-75 pointer-events-none"
                      />
                    )}
                    {showTtdKepsek && appState.sekolah.ttdKepalaSekolahUrl && (
                      <img
                        src={appState.sekolah.ttdKepalaSekolahUrl}
                        alt="TTD"
                        className="w-24 h-12 object-contain absolute left-4 pointer-events-none"
                      />
                    )}
                  </div>

                  <p className="font-bold">{namaKepalaSekolah}</p>
                  <p>NIP {nipKepalaSekolah}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col justify-between animate-in fade-in">
          {/* Modal Top Bar */}
          <div className="bg-slate-900 px-6 py-3.5 flex items-center justify-between text-white border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <Award className="text-blue-400" size={20} />
              <div>
                <h3 className="text-sm font-bold">
                  Pratinjau Cetak: {selectedSiswa?.nama} ({selectedSiswa?.kodeKelas})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Transkrip Nilai Akademik Kelulusan
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Zoom Controls */}
              <div className="flex items-center space-x-1 bg-slate-800 rounded-xl p-1 border border-slate-700">
                <button
                  onClick={() => setPreviewZoom(Math.max(50, previewZoom - 10))}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 cursor-pointer"
                  title="Perkecil"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono px-2 text-slate-300">
                  {previewZoom}%
                </span>
                <button
                  onClick={() => setPreviewZoom(Math.min(150, previewZoom + 10))}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 cursor-pointer"
                  title="Perbesar"
                >
                  <ZoomIn size={16} />
                </button>
              </div>

              <button
                onClick={handleDownloadSinglePdf}
                disabled={isGeneratingPdf}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 cursor-pointer"
              >
                <Download size={15} />
                <span>Unduh PDF</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center space-x-1.5 cursor-pointer"
              >
                <Printer size={15} />
                <span>Cetak</span>
              </button>

              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Sheet Viewer */}
          <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-slate-950/60">
            <div
              style={{
                transform: `scale(${previewZoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
              }}
            >
              <div
                className="bg-white shadow-2xl rounded-xs text-slate-900 border border-slate-300"
                style={{
                  fontFamily: getFontFamilyCss(),
                  width: '210mm',
                  minHeight: '297mm',
                  paddingTop: `${margins.top}mm`,
                  paddingBottom: `${margins.bottom}mm`,
                  paddingLeft: `${margins.left}mm`,
                  paddingRight: `${margins.right}mm`,
                  fontSize: fontSize === '9pt' ? '12px' : fontSize === '9.5pt' ? '12.5px' : fontSize === '11pt' ? '14px' : '13px',
                }}
              >
                {/* 1. KOP SURAT (TANPA GARIS BAWAH) */}
                {kopType === 'banner' && appState.sekolah.kopSekolahUrl ? (
                  <div className="mb-4 text-center">
                    <img
                      src={appState.sekolah.kopSekolahUrl}
                      alt="Kop Surat Banner"
                      className="w-full max-h-28 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="mb-4 text-center relative flex items-center justify-between">
                    {showLogoLeft && (
                      <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                        {(appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl) ? (
                          <img
                            src={appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl}
                            alt="Logo Pemda"
                            className="w-14 h-14 object-contain"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full border border-slate-400 flex items-center justify-center text-[10px] font-bold">
                            LOGO
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex-1 px-2 text-center">
                      <h3 className="text-[11px] font-bold tracking-wider uppercase text-slate-800">
                        {appState.sekolah.pemerintahDaerah?.toUpperCase() || `PEMERINTAH KABUPATEN ${(appState.sekolah.kabupatenKota || 'BANYUMAS').toUpperCase()}`}
                      </h3>
                      <h1 className="text-[15px] font-black tracking-wide text-slate-900 uppercase">
                        {appState.sekolah.namaSekolah || 'SMP NEGERI 2 KEMRANJEN'}
                      </h1>
                      {appState.sekolah.alamatLengkapKop ? (
                        <p className="text-[9.5px] text-slate-800 leading-tight whitespace-pre-line font-medium">
                          {appState.sekolah.alamatLengkapKop}
                        </p>
                      ) : (
                        <>
                          <p className="text-[10px] text-slate-700 leading-tight">
                            {appState.sekolah.alamat || 'Karangsalam'}, Telp. {appState.sekolah.telepon || '08112627753'}, Kec. {appState.sekolah.kecamatan || 'Kemranjen'}, {appState.sekolah.kabupatenKota || 'Banyumas'} {appState.sekolah.kodePos || '53194'}
                          </p>
                          <p className="text-[9.5px] text-blue-700 leading-tight">
                            email : {appState.sekolah.email || 'smpn2.kemranjen@banyumaskab.go.id'}
                          </p>
                        </>
                      )}
                    </div>

                    {showLogoRight && (
                      <div className="w-14 h-14 shrink-0 flex items-center justify-center">
                        {(appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl) ? (
                          <img
                            src={appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl}
                            alt="Logo Sekolah"
                            className="w-14 h-14 object-contain"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full border border-slate-400 flex items-center justify-center text-[10px] font-bold">
                            LOGO
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Garis Tebal Tipis di Bawah Kop dengan 1,5 Spasi */}
                <div className="mt-1.5 mb-4">
                  <div className="border-t-[2.5px] border-black"></div>
                  <div className="border-t-[0.75px] border-black mt-[1.5px]"></div>
                </div>

                {/* 2. JUDUL */}
                <div className="text-center mb-4">
                  <h2 className="text-base font-extrabold uppercase tracking-wide">
                    TRANSKRIP NILAI
                  </h2>
                  <p className="text-[12px] font-normal text-slate-800">
                    Nomor : {noSurat}
                  </p>
                </div>

                {/* 3. IDENTITAS SISWA */}
                <div className="text-[12px] leading-relaxed mb-4 space-y-1">
                  <div className="flex">
                    <div className="w-56 shrink-0">Satuan Pendidikan</div>
                    <div className="w-4 text-center">:</div>
                    <div className="flex-1">{namaSekolahLengkap}</div>
                  </div>
                  <div className="flex">
                    <div className="w-56 shrink-0">Nomor Pokok Sekolah Nasional</div>
                    <div className="w-4 text-center">:</div>
                    <div className="flex-1">{npsnSekolah}</div>
                  </div>
                  <div className="flex">
                    <div className="w-56 shrink-0 font-medium">Nama Lengkap</div>
                    <div className="w-4 text-center">:</div>
                    <div className="flex-1 font-bold uppercase">{selectedSiswa?.nama || '-'}</div>
                  </div>
                  <div className="flex">
                    <div className="w-56 shrink-0">Tempat, tanggal lahir</div>
                    <div className="w-4 text-center">:</div>
                    <div className="flex-1">
                      {selectedSiswa?.tempatLahir || 'Banyumas'}, {formatIndonesianDate(selectedSiswa?.tanggalLahir)}
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-56 shrink-0">Nomor Induk Siswa Nasional</div>
                    <div className="w-4 text-center">:</div>
                    <div className="flex-1">{selectedSiswa?.nisn || '-'}</div>
                  </div>
                  <div className="flex">
                    <div className="w-56 shrink-0">Nomor Ijazah</div>
                    <div className="w-4 text-center">:</div>
                    <div className="flex-1">{noIjazah}</div>
                  </div>
                  <div className="flex">
                    <div className="w-56 shrink-0">Tanggal Kelulusan</div>
                    <div className="w-4 text-center">:</div>
                    <div className="flex-1">{tanggalKelulusan}</div>
                  </div>
                </div>

                {/* 4. TABEL NILAI TRANSKRIP */}
                <table className="w-full border-collapse border border-slate-900 text-[11.5px] mb-6">
                  <thead>
                    <tr className="border-b border-slate-900 font-bold text-center">
                      <th className="border border-slate-900 py-1 px-2 w-12">No</th>
                      <th className="border border-slate-900 py-1 px-3 text-center">Mata Pelajaran</th>
                      <th className="border border-slate-900 py-1 px-3 w-24">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="border border-slate-900 py-3 px-3 text-center text-slate-500 italic">
                          Belum ada nilai mata pelajaran yang terisi (nilai 0 / belum diinput pada menu Input Nilai K9).
                        </td>
                      </tr>
                    ) : (
                      currentRows.map((r) => (
                        <tr key={r.no} className="border-b border-slate-900">
                          <td className="border border-slate-900 py-1 px-2 text-center">{r.no}</td>
                          <td className="border border-slate-900 py-1 px-3 text-left">{r.namaMapel}</td>
                          <td className="border border-slate-900 py-1 px-3 text-center font-normal">{r.scoreStr}</td>
                        </tr>
                      ))
                    )}
                    <tr className="border-t border-slate-900 font-bold">
                      <td colSpan={2} className="border border-slate-900 py-1.5 px-3 text-center">
                        Rata-rata
                      </td>
                      <td className="border border-slate-900 py-1.5 px-3 text-center">
                        {averageStr}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 5. TANDA TANGAN */}
                <div className="flex justify-end pt-2">
                  <div className="w-64 text-left text-[12px] leading-snug">
                    <p>{tempatTtd}, {tanggalTtd}</p>
                    <p>{jabatanTtd}</p>
                    
                    <div className="h-16 relative flex items-center">
                      {showStempel && appState.sekolah.stempelUrl && (
                        <img
                          src={appState.sekolah.stempelUrl}
                          alt="Stempel"
                          className="w-16 h-16 object-contain absolute -left-6 opacity-75 pointer-events-none"
                        />
                      )}
                      {showTtdKepsek && appState.sekolah.ttdKepalaSekolahUrl && (
                        <img
                          src={appState.sekolah.ttdKepalaSekolahUrl}
                          alt="TTD"
                          className="w-24 h-12 object-contain absolute left-4 pointer-events-none"
                        />
                      )}
                    </div>

                    <p className="font-bold">{namaKepalaSekolah}</p>
                    <p>NIP {nipKepalaSekolah}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Bottom Bar: Navigation */}
          <div className="bg-slate-900 px-6 py-3 flex items-center justify-between text-white border-t border-slate-800">
            <button
              onClick={handlePrevStudent}
              disabled={selectedIndex <= 0}
              className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl flex items-center space-x-1.5 cursor-pointer"
            >
              <ChevronLeft size={16} />
              <span>Siswa Sebelumnya</span>
            </button>

            <span className="text-xs font-semibold text-slate-400">
              Siswa {selectedIndex + 1} dari {kelas9Students.length}
            </span>

            <button
              onClick={handleNextStudent}
              disabled={selectedIndex >= kelas9Students.length - 1}
              className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl flex items-center space-x-1.5 cursor-pointer"
            >
              <span>Siswa Selanjutnya</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* EXCEL IMPORT PREVIEW MODAL */}
      {excelImportModalOpen && excelPreviewData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Konfirmasi Impor Data Excel
                  </h3>
                  <p className="text-xs text-slate-500">
                    {excelPreviewData.matchedCount} data siswa cocok ditemukan dalam file Excel.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExcelImportModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto space-y-4">
              <div className="flex items-center space-x-3 text-xs">
                <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold">
                  {excelPreviewData.matchedCount} Siswa Cocok
                </div>
                {excelPreviewData.unmatchedCount > 0 && (
                  <div className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-bold">
                    {excelPreviewData.unmatchedCount} Baris Tidak Cocok
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">NISN</th>
                      <th className="py-2.5 px-3">No. Surat Transkrip</th>
                      <th className="py-2.5 px-3">No. Ijazah</th>
                      <th className="py-2.5 px-3">Tgl. Kelulusan</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {excelPreviewData.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{row.nama || '-'}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{row.nisn || '-'}</td>
                        <td className="py-2 px-3 font-mono text-blue-700">{row.noSuratTranskrip || '-'}</td>
                        <td className="py-2 px-3 font-mono text-slate-800">{row.noIjazah || '-'}</td>
                        <td className="py-2 px-3 text-slate-700">{row.tanggalKelulusan || '-'}</td>
                        <td className="py-2 px-3 text-center">
                          {row.statusMatch === 'MATCHED' ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                              Cocok
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px]">
                              Lewati
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3">
              <button
                onClick={() => setExcelImportModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleApplyExcelImport}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Save size={15} />
                <span>Simpan & Terapkan Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO NUMBER GENERATOR MODAL */}
      {autoNumberModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Hash size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Auto-Generate Nomor Transkrip & Ijazah
                  </h3>
                  <p className="text-xs text-slate-500">
                    Penomoran berurutan untuk {kelas9Students.length} siswa kelas 9.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAutoNumberModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Format Nomor Surat Transkrip
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={autoSuratPrefix}
                    onChange={(e) => setAutoSuratPrefix(e.target.value)}
                    placeholder="400.3.11.1/"
                    className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                  />
                  <input
                    type="number"
                    value={autoSuratStartNo}
                    onChange={(e) => setAutoSuratStartNo(parseInt(e.target.value, 10) || 1)}
                    placeholder="158"
                    className="text-xs text-center font-bold bg-slate-50 border border-slate-200 rounded-xl px-2 py-2"
                  />
                  <input
                    type="text"
                    value={autoSuratSuffix}
                    onChange={(e) => setAutoSuratSuffix(e.target.value)}
                    placeholder=".43/2026"
                    className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Contoh: {autoSuratPrefix}{autoSuratStartNo}{autoSuratSuffix}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Format Nomor Ijazah
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={autoIjazahPrefix}
                    onChange={(e) => setAutoIjazahPrefix(e.target.value)}
                    placeholder="121202600155"
                    className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                  <input
                    type="number"
                    value={autoIjazahStartNo}
                    onChange={(e) => setAutoIjazahStartNo(parseInt(e.target.value, 10) || 1)}
                    placeholder="947"
                    className="text-xs text-center font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Contoh: {autoIjazahPrefix}{String(autoIjazahStartNo).padStart(3, '0')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tanggal Kelulusan / Ijazah Bersama
                </label>
                <input
                  type="text"
                  value={autoTanggalKelulusanVal}
                  onChange={(e) => setAutoTanggalKelulusanVal(e.target.value)}
                  placeholder="2 Juni 2026"
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3">
              <button
                onClick={() => setAutoNumberModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleApplyAutoNumbering}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Sparkles size={15} />
                <span>Terapkan ke Semua Siswa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
