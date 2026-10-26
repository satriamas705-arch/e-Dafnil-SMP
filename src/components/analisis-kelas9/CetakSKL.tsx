import React, { useState, useEffect, useRef } from 'react';
import { AppState, AuthUser, Siswa, Mapel } from '../../types';
import { isGrade9Student, getMapelFinalScore, formatScoreVal } from '../../lib/k9GradeHelper';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  ShieldCheck,
} from 'lucide-react';

interface CetakSKLProps {
  appState: AppState;
  authUser?: AuthUser | null;
}

export const CetakSKL: React.FC<CetakSKLProps> = ({ appState, authUser }) => {
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

  // Search and filter in student picker
  const [searchSiswa, setSearchSiswa] = useState<string>('');
  const [filterKelas, setFilterKelas] = useState<string>('all');

  const availableKelasList = Array.from(new Set(kelas9Students.map((s) => s.kodeKelas))).sort();

  const filteredStudents = kelas9Students.filter((s) => {
    const matchesSearch =
      s.nama.toLowerCase().includes(searchSiswa.toLowerCase()) ||
      s.nis.includes(searchSiswa) ||
      s.nisn.includes(searchSiswa);
    const matchesKelas = filterKelas === 'all' || s.kodeKelas === filterKelas;
    return matchesSearch && matchesKelas;
  });

  if (isGuru && !isWaliKelas9) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-md">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Akses Terbatas: Cetak SKL</h2>
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
  const [activeTab, setActiveTab] = useState<'kop' | 'surat' | 'layout' | 'mapel' | 'masal'>('kop');

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [pdfSuccessToast, setPdfSuccessToast] = useState<string | null>(null);

  // 1. Pengaturan Kop Surat (Sinkron Profil Sekolah)
  const [kopType, setKopType] = useState<'banner' | 'text'>(
    appState.sekolah.kopSekolahUrl ? 'banner' : 'text'
  );
  const [showLogoLeft, setShowLogoLeft] = useState<boolean>(true);
  const [showLogoRight, setShowLogoRight] = useState<boolean>(true);
  const [showStempel, setShowStempel] = useState<boolean>(true);
  const [showTtdKepsek, setShowTtdKepsek] = useState<boolean>(true);

  // 2. Pengaturan Field Surat & Pejabat
  const [noSurat, setNoSurat] = useState<string>(
    gradeRecord?.noSuratSKL || `400.3.11/156/2026`
  );
  const [tempatTtd, setTempatTtd] = useState<string>(
    appState.sekolah.kabupatenKota || 'Banyumas'
  );
  const [tanggalTtd, setTanggalTtd] = useState<string>(
    appState.sekolah.tanggalSurat || '2 Juni 2026'
  );
  const [namaKepalaSekolah, setNamaKepalaSekolah] = useState<string>(
    appState.sekolah.namaKepalaSekolah || 'Budhy Susanto, S. Pd.'
  );
  const [nipKepalaSekolah, setNipKepalaSekolah] = useState<string>(
    appState.sekolah.nipKepalaSekolah || '197908202005011013'
  );
  const [namaSekolahLengkap, setNamaSekolahLengkap] = useState<string>(
    appState.sekolah.namaSekolah ? `Sekolah Menengah Pertama Negeri 2 Kemranjen` : 'Sekolah Menengah Pertama Negeri 2 Kemranjen'
  );
  const [kabupatenSekolah, setKabupatenSekolah] = useState<string>(
    appState.sekolah.kabupatenKota || 'Banyumas'
  );
  const [npsnSekolah, setNpsnSekolah] = useState<string>(
    appState.sekolah.npsn || '20301942'
  );
  const activeTahunObj =
    appState.tahunAjaranList.find((t) => t.id === appState.activeTahunAjaranId) ||
    appState.tahunAjaranList.find((t) => t.isAktif) ||
    appState.tahunAjaranList[0];
  const defaultActiveTahun = activeTahunObj?.tahun || '2025/2026';

  const [tahunAjaran, setTahunAjaran] = useState<string>(defaultActiveTahun);

  // 3. Layout, Font, Kertas & Margin
  const [fontFamily, setFontFamily] = useState<'Times New Roman' | 'Arial' | 'Calibri' | 'Bookman Old Style'>('Arial');
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

  // 4. Pengaturan Mata Pelajaran & Penyesuaian Agama
  const [religionMode, setReligionMode] = useState<'auto_specific' | 'general' | 'auto_simple'>('general');
  // 'general': "Pendidikan Agama dan Budi Pekerti" (sesuai contoh gambar persis)
  // 'auto_specific': "Pendidikan Agama Islam dan Budi Pekerti"
  // 'auto_simple': "Pendidikan Agama Islam"

  // Base list of subjects in standardized order
  const defaultSubjects: { id: string; defaultName: string; defaultScore: number }[] = [
    { id: 'm-1', defaultName: 'Pendidikan Agama dan Budi Pekerti', defaultScore: 91.30 },
    { id: 'm-2', defaultName: 'Pendidikan Pancasila', defaultScore: 89.70 },
    { id: 'm-3', defaultName: 'Bahasa Indonesia', defaultScore: 89.90 },
    { id: 'm-4', defaultName: 'Matematika', defaultScore: 90.60 },
    { id: 'm-5', defaultName: 'Ilmu Pengetahuan Alam', defaultScore: 85.00 },
    { id: 'm-6', defaultName: 'Ilmu Pengetahuan Sosial', defaultScore: 89.20 },
    { id: 'm-7', defaultName: 'Bahasa Inggris', defaultScore: 86.60 },
    { id: 'm-8', defaultName: 'Seni Budaya/Prakarya', defaultScore: 86.20 },
    { id: 'm-9', defaultName: 'Pendidikan Jasmani, Olah Raga dan Kesehatan', defaultScore: 86.05 },
    { id: 'm-10', defaultName: 'Informatika', defaultScore: 90.30 },
    { id: 'm-11', defaultName: 'Bahasa Jawa', defaultScore: 89.00 },
  ];

  const sortedMapels = [...appState.mapelList].sort(
    (a, b) => (a.urutan || 99) - (b.urutan || 99)
  );

  // Gunakan data mata pelajaran persis dari sub menu Data Mapel (appState.mapelList)
  const allMapelOptions = sortedMapels.length > 0 ? sortedMapels : defaultSubjects.map(d => ({
    id: d.id,
    kodeMapel: d.id.toUpperCase(),
    namaMapel: d.defaultName,
    kelompok: 'Kelompok A (Wajib)' as const,
    urutan: parseInt(d.id.replace('m-', ''), 10) || 1,
  }));

  const [selectedMapelIds, setSelectedMapelIds] = useState<string[]>(
    allMapelOptions.map((m) => m.id)
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

  // Sync state when appState.sekolah or active tahun ajaran changes
  useEffect(() => {
    if (appState.sekolah.kabupatenKota) setTempatTtd(appState.sekolah.kabupatenKota);
    if (appState.sekolah.tanggalSurat) setTanggalTtd(appState.sekolah.tanggalSurat);
    if (appState.sekolah.namaKepalaSekolah) setNamaKepalaSekolah(appState.sekolah.namaKepalaSekolah);
    if (appState.sekolah.nipKepalaSekolah) setNipKepalaSekolah(appState.sekolah.nipKepalaSekolah);
    if (appState.sekolah.npsn) setNpsnSekolah(appState.sekolah.npsn);
    if (appState.sekolah.namaSekolah) {
      const cleanNama = appState.sekolah.namaSekolah.replace(/^SMP\s*/i, 'Sekolah Menengah Pertama ');
      setNamaSekolahLengkap(cleanNama);
    }
    if (appState.sekolah.kopSekolahUrl) {
      setKopType('banner');
    }
    const currentActiveTahun =
      appState.tahunAjaranList.find((t) => t.id === appState.activeTahunAjaranId)?.tahun ||
      appState.tahunAjaranList.find((t) => t.isAktif)?.tahun;
    if (currentActiveTahun) {
      setTahunAjaran(currentActiveTahun);
    }
  }, [appState.sekolah, appState.tahunAjaranList, appState.activeTahunAjaranId]);

  // Sync noSurat when selected student changes
  useEffect(() => {
    if (gradeRecord?.noSuratSKL) {
      setNoSurat(gradeRecord.noSuratSKL);
    } else {
      const idxStr = String((selectedIndex >= 0 ? selectedIndex : 0) + 156);
      setNoSurat(`400.3.11/${idxStr}/2026`);
    }
  }, [selectedSiswaId, gradeRecord, selectedIndex]);

  // Batch student selection
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>(
    kelas9Students.map((s) => s.id)
  );

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

  // Helper function: sesuaikan nama mata pelajaran seperti input pada sub menu data mapel
  const getFormattedMapelName = (namaMapel: string, agamaSiswa?: string): string => {
    const trimmedAgama = agamaSiswa?.trim() || 'Islam';
    const lower = (namaMapel || '').toLowerCase();

    // Khusus mapel pendidikan agama jika pengguna memilih opsi penyesuaian agama otomatis
    if (lower.includes('pendidikan agama') || lower.startsWith('agama') || lower.includes('pai')) {
      if (religionMode === 'auto_simple') {
        return `Pendidikan Agama ${trimmedAgama}`;
      }
      if (religionMode === 'auto_specific') {
        return `Pendidikan Agama ${trimmedAgama} dan Budi Pekerti`;
      }
      // 'general': gunakan namaMapel persis seperti diinput di Data Mapel
      return namaMapel;
    }

    // Seluruh nama mapel lainnya menggunakan persis seperti input pada sub menu data mapel
    return namaMapel;
  };

  // Helper format nilai dengan 2 angka di belakang koma (misal: 91,30 atau 88,53)
  const formatScoreVal = (val: number | undefined | null): string => {
    if (val === undefined || val === null || isNaN(val) || val <= 0) return '-';
    return Number(val).toFixed(2).replace('.', ',');
  };

  // Helper format tanggal Indonesia
  const formatIndonesianDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    if (/[a-zA-Z]/.test(dateStr) && !dateStr.includes('-')) return dateStr;
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
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

  // Calculate SKL Grades for a Student (Hanya mapel dengan nilai > 0 yang ditampilkan)
  const getStudentSKLGrades = (siswaId: string) => {
    const targetSiswa = appState.siswaList.find((s) => s.id === siswaId);
    const targetGrade = appState.nilaiKelas9List.find((n) => n.siswaId === siswaId);

    // Mapel source
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
      // Maka mata pelajaran terkait TIDAK ditampilkan dalam dokumen SKL
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

  const { rows: currentRows, totalNilaiStr, averageStr } = getStudentSKLGrades(selectedSiswaId);

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
  const getPaperDimensionsMm = (): { width: number; height: number; format: [number, number] | string } => {
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

  const getFontFamilyCss = () => {
    switch (fontFamily) {
      case 'Arial':
        return 'Arial, Helvetica, sans-serif';
      case 'Calibri':
        return 'Calibri, sans-serif';
      case 'Bookman Old Style':
        return "'Bookman Old Style', Georgia, serif";
      case 'Times New Roman':
      default:
        return "'Times New Roman', Times, serif";
    }
  };

  // Load Image into Base64 Data URL for jsPDF
  const loadImageDataUrl = async (url: string | undefined): Promise<string | null> => {
    if (!url) return null;
    if (url.startsWith('data:image/')) return url;
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
        showLogoRight ? loadImageDataUrl(appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl) : Promise.resolve(null),
        kopType === 'banner' ? loadImageDataUrl(appState.sekolah.kopSekolahUrl) : Promise.resolve(null),
        showStempel ? loadImageDataUrl(appState.sekolah.stempelUrl) : Promise.resolve(null),
        showTtdKepsek ? loadImageDataUrl(appState.sekolah.ttdKepalaSekolahUrl) : Promise.resolve(null),
      ]);

    const jsPdfFont = fontFamily === 'Times New Roman' ? 'times' : 'helvetica';

    for (let sIdx = 0; sIdx < targetSiswaList.length; sIdx++) {
      const siswa = targetSiswaList[sIdx];
      if (sIdx > 0) {
        pdf.addPage(format, 'portrait');
      }

      const sGradeRecord = appState.nilaiKelas9List.find((n) => n.siswaId === siswa.id);
      const sNoSurat =
        sGradeRecord?.noSuratSKL ||
        `400.3.11/${156 + sIdx}/2026`;
      const { rows: sRows, totalNilaiStr: sTotalStr, averageStr: sAvgStr } = getStudentSKLGrades(siswa.id);

      const top = margins.top;
      const left = margins.left;
      const right = margins.right;
      const contentWidth = pageWidth - left - right;

      let currentY = top;

      // 1. KOP SURAT (TANPA GARIS DI BAWAH KOP SESUAI PERMINTAAN USER)
      if (kopType === 'banner' && kopBannerData) {
        // Render Banner Image
        const bannerHeight = 28;
        try {
          pdf.addImage(kopBannerData, 'PNG', left, currentY, contentWidth, bannerHeight, undefined, 'FAST');
        } catch (e) {}
        currentY += bannerHeight + 5;
      } else {
        // Render Structured Text Kop
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
            pdf.addImage(logoSekolahData, 'PNG', left + contentWidth - 18, currentY, 18, 18, undefined, 'FAST');
          } catch (e) {}
        }

        // Kop Typography
        pdf.setFont(jsPdfFont, 'bold');
        pdf.setFontSize(10.5);
        pdf.text(
          (appState.sekolah.pemerintahDaerah || `PEMERINTAH KABUPATEN ${(appState.sekolah.kabupatenKota || 'BANYUMAS')}`).toUpperCase(),
          left + contentWidth / 2,
          currentY + 4,
          { align: 'center' }
        );

        pdf.setFontSize(13.5);
        pdf.text(
          (appState.sekolah.namaSekolah || 'SMP NEGERI 2 KEMRANJEN').toUpperCase(),
          left + contentWidth / 2,
          currentY + 9,
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
            pdf.text(line, left + contentWidth / 2, currentY + 13 + (idx * 3.5), { align: 'center' });
          });
          pdf.setTextColor(0, 0, 0);
          currentY += 13 + (kopLines.length * 3.5) + 3;
        } else {
          const addressText = `${appState.sekolah.alamat || 'Karangsalam'}${
            appState.sekolah.telepon ? ` Telp: ${appState.sekolah.telepon}` : ''
          }${appState.sekolah.kecamatan ? ` ${appState.sekolah.kecamatan}` : ''}${
            appState.sekolah.kabupatenKota ? ` ${appState.sekolah.kabupatenKota}` : ''
          }${appState.sekolah.kodePos ? ` Pos: ${appState.sekolah.kodePos}` : ''}`;
          pdf.text(addressText, left + contentWidth / 2, currentY + 13, { align: 'center' });

          if (appState.sekolah.email || appState.sekolah.npsn) {
            const emailStr = `email : ${appState.sekolah.email || `smpn2.kemranjen@banyumaskab.go.id`}`;
            pdf.setTextColor(0, 80, 160);
            pdf.text(emailStr, left + contentWidth / 2, currentY + 16.5, { align: 'center' });
            pdf.setTextColor(0, 0, 0);
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

      // 2. DOCUMENT TITLE & NUMBER
      pdf.setFont(jsPdfFont, 'bold');
      pdf.setFontSize(12);
      pdf.text('SURAT KETERANGAN LULUS', left + contentWidth / 2, currentY, { align: 'center' });

      pdf.setFont(jsPdfFont, 'normal');
      pdf.setFontSize(9.5);
      currentY += 4.5;
      pdf.text(`Nomor : ${sNoSurat}`, left + contentWidth / 2, currentY, { align: 'center' });
      currentY += 6;

      // 3. PARAGRAF PEMBUKA
      pdf.setFontSize(8.5);
      const pembukaText = `Yang bertanda tangan di bawah ini, Kepala ${namaSekolahLengkap}, Kabupaten ${kabupatenSekolah}, Nomor Pokok Sekolah Nasional (NPSN) ${npsnSekolah} menerangkan dengan sesungguhnya bahwa:`;
      const splitPembuka = pdf.splitTextToSize(pembukaText, contentWidth);
      pdf.text(splitPembuka, left, currentY);
      currentY += splitPembuka.length * 3.8 + 2.5;

      // 4. IDENTITAS PESERTA DIDIK
      const indentX = left;
      const colColonX = indentX + 42;
      const colValX = indentX + 45;

      const printSiswaRow = (label: string, value: string, isBold = false) => {
        pdf.setFont(jsPdfFont, 'normal');
        pdf.text(label, indentX, currentY);
        pdf.text(':', colColonX, currentY);
        pdf.setFont(jsPdfFont, isBold ? 'bold' : 'normal');
        pdf.text(value, colValX, currentY);
        currentY += 4.2;
      };

      printSiswaRow('Nama Peserta Didik', siswa.nama.toUpperCase(), true);
      const tglLahirFormatted = formatIndonesianDate(siswa.tanggalLahir);
      printSiswaRow('Tempat, tgl. Lahir', `${siswa.tempatLahir || 'Purbalingga'}, ${tglLahirFormatted}`);
      printSiswaRow('NIS/NISN', `${siswa.nis || '-'} / ${siswa.nisn || '-'}`);

      // 5. PERNYATAAN STATUS KELULUSAN
      currentY += 1.5;
      pdf.setFont(jsPdfFont, 'normal');
      const pernyataanText = `Dinyatakan LULUS dari satuan pendidikan Tahun Ajaran ${tahunAjaran}, dengan nilai sebagai berikut:`;
      pdf.text(pernyataanText, left, currentY);
      currentY += 3.5;

      // 6. TABEL NILAI DENGAN JSPDF-AUTOTABLE
      const tableHead = [
        [
          { content: 'No.', styles: { halign: 'center' as const } },
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
          { content: 'Jumlah Nilai', colSpan: 2, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: sTotalStr, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
        ],
        [
          { content: 'Rata-rata', colSpan: 2, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: sAvgStr, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
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
          fontSize: 8.5,
          cellPadding: 1.1,
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
          0: { cellWidth: 12 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 32 },
        },
      });

      // @ts-ignore
      currentY = pdf.lastAutoTable.finalY + 4;

      // 7. PARAGRAF PENUTUP
      pdf.setFont(jsPdfFont, 'normal');
      pdf.setFontSize(8.5);
      const closingText = `Surat Keterangan Lulus ini berlaku sementara sampai dengan diterbitkannya Ijazah Tahun Ajaran ${tahunAjaran}, untuk menjadikan maklum bagi yang berkepentingan.`;
      const splitClosing = pdf.splitTextToSize(closingText, contentWidth);
      pdf.text(splitClosing, left, currentY);
      currentY += splitClosing.length * 3.8 + 4;

      // 8. TANDA TANGAN (Right Aligned)
      const sigBlockWidth = 70;
      const sigLeft = left + contentWidth - sigBlockWidth;

      pdf.setFont(jsPdfFont, 'normal');
      pdf.setFontSize(9);
      pdf.text(`${tempatTtd}, ${tanggalTtd}`, sigLeft, currentY);
      currentY += 4.2;
      pdf.text('Kepala Sekolah', sigLeft, currentY);

      const sigSpaceY = currentY + 1;

      // Stempel & TTD overlay
      if (showStempel && stempelData) {
        try {
          pdf.addImage(stempelData, 'PNG', sigLeft - 8, sigSpaceY - 2, 22, 22, undefined, 'FAST');
        } catch (e) {}
      }

      if (showTtdKepsek && ttdData) {
        try {
          pdf.addImage(ttdData, 'PNG', sigLeft + 4, sigSpaceY, 28, 15, undefined, 'FAST');
        } catch (e) {}
      }

      currentY += 18;

      // Pejabat Name & NIP
      pdf.setFont(jsPdfFont, 'bold');
      pdf.text(namaKepalaSekolah, sigLeft, currentY);

      currentY += 4.2;
      pdf.setFont(jsPdfFont, 'normal');
      pdf.text(`NIP ${nipKepalaSekolah}`, sigLeft, currentY);
    }

    return pdf;
  };

  // Single Student PDF Download
  const handleDownloadPdf = async () => {
    if (!selectedSiswa) return;
    setIsGeneratingPdf(true);
    try {
      const pdf = await generateVectorPdf([selectedSiswa]);
      if (pdf) {
        const cleanName = selectedSiswa.nama.replace(/[^a-zA-Z0-9]/g, '_');
        pdf.save(`SKL_${selectedSiswa.nis || 'Siswa'}_${cleanName}.pdf`);
        setPdfSuccessToast(`Berhasil mengunduh dokumen SKL ${selectedSiswa.nama}!`);
        setTimeout(() => setPdfSuccessToast(null), 4000);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Terjadi kesalahan saat membuat PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Batch PDF Download
  const handleBatchDownloadPdf = async () => {
    const targetStudents = kelas9Students.filter((s) => batchSelectedIds.includes(s.id));
    if (targetStudents.length === 0) {
      alert('Pilih minimal 1 siswa untuk cetak masal.');
      return;
    }

    setIsBatchGenerating(true);
    setBatchProgress({ current: 0, total: targetStudents.length });

    try {
      const pdf = await generateVectorPdf(targetStudents, true);
      if (pdf) {
        pdf.save(`SKL_Masal_Kelas9_${appState.sekolah.namaSekolah || 'Sekolah'}.pdf`);
        setPdfSuccessToast(`Berhasil mengunduh ${targetStudents.length} dokumen SKL sekaligus!`);
        setTimeout(() => setPdfSuccessToast(null), 4000);
      }
    } catch (error) {
      console.error('Error in batch PDF generation:', error);
      alert('Gagal membuat dokumen PDF masal.');
    } finally {
      setIsBatchGenerating(false);
      setBatchProgress(null);
    }
  };

  // Direct Browser Print
  const handleDirectPrint = () => {
    const printContent = document.getElementById('printable-skl-document');
    if (!printContent) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      const pDim = getPaperDimensionsMm();
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cetak SKL - ${selectedSiswa?.nama || 'Siswa'}</title>
            <style>
              @page {
                size: ${pDim.width}mm ${pDim.height}mm;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                background: white;
                color: #000000;
                font-family: ${getFontFamilyCss()};
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .page-container {
                width: ${pDim.width}mm;
                min-height: ${pDim.height}mm;
                padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
                box-sizing: border-box;
                margin: 0 auto;
                font-size: ${fontSize};
                line-height: 1.35;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .text-left { text-align: left; }
              .font-bold { font-weight: bold; }
              .uppercase { text-transform: uppercase; }
              .kop-container {
                padding-bottom: 4px;
                margin-bottom: 12px;
              }
              .kop-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                text-align: center;
              }
              .kop-logo {
                width: 65px;
                height: 65px;
                object-fit: contain;
              }
              .kop-text {
                flex: 1;
                padding: 0 10px;
              }
              .kop-text h2 {
                margin: 0;
                font-size: 11pt;
                font-weight: bold;
                letter-spacing: 0.5px;
              }
              .kop-text h1 {
                margin: 2px 0;
                font-size: 14pt;
                font-weight: bold;
                letter-spacing: 0.5px;
              }
              .kop-text p {
                margin: 1px 0;
                font-size: 8.5pt;
              }
              .title-block {
                text-align: center;
                margin: 14px 0 10px 0;
              }
              .title-block h2 {
                margin: 0;
                font-size: 12pt;
                font-weight: bold;
                text-transform: uppercase;
              }
              .title-block p {
                margin: 2px 0 0 0;
                font-size: 9.5pt;
              }
              .pembuka {
                font-size: 8.5pt;
                margin-bottom: 8px;
                text-align: justify;
              }
              .identitas-table {
                width: 100%;
                margin: 8px 0 10px 0;
                font-size: 9pt;
                border-collapse: collapse;
              }
              .identitas-table td {
                padding: 2px 0;
                vertical-align: top;
              }
              .identitas-table td.label {
                width: 160px;
              }
              .identitas-table td.colon {
                width: 15px;
                text-align: center;
              }
              .status-statement {
                font-size: 8.5pt;
                margin: 8px 0 6px 0;
              }
              .grade-table {
                width: 100%;
                border-collapse: collapse;
                margin: 6px 0 10px 0;
                font-size: 8.5pt;
              }
              .grade-table th, .grade-table td {
                border: 1px solid #000000;
                padding: 3px 6px;
              }
              .grade-table th {
                font-weight: bold;
                text-align: center;
                background-color: transparent;
              }
              .closing-p {
                font-size: 8.5pt;
                margin: 10px 0 16px 0;
                text-align: justify;
              }
              .sig-container {
                display: flex;
                justify-content: flex-end;
                margin-top: 14px;
                font-size: 9pt;
              }
              .sig-box {
                width: 260px;
                text-align: left;
              }
              .sig-space {
                height: 55px;
                position: relative;
              }
              .sig-img {
                position: absolute;
                left: 10px;
                top: 5px;
                max-height: 45px;
              }
              .stamp-img {
                position: absolute;
                left: -20px;
                top: -5px;
                max-height: 60px;
                opacity: 0.85;
              }
            </style>
          </head>
          <body>
            <div class="page-container">
              ${printContent.innerHTML}
            </div>
          </body>
        </html>
      `);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 500);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto text-slate-800">
      {/* Toast Notification */}
      {pdfSuccessToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-3 border border-emerald-500 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={20} className="shrink-0" />
          <span className="text-sm font-semibold">{pdfSuccessToast}</span>
        </div>
      )}

      {/* TOP HEADER & ACTION BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <FileBadge size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Cetak SKL (Surat Keterangan Lulus)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Format resmi surat keterangan kelulusan dengan sinkronisasi profil sekolah, kop resmi, dan tabel nilai presisi.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 border transition-all ${
              showSettings
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Sliders size={15} />
            <span>{showSettings ? 'Tutup Pengaturan' : 'Pengaturan Cetak'}</span>
          </button>

          <button
            onClick={() => setShowPreviewModal(true)}
            className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-xs"
          >
            <Eye size={15} />
            <span>Pratinjau Layar Penuh</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            <span>Unduh PDF</span>
          </button>

          <button
            onClick={handleDirectPrint}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-2 transition-all"
          >
            <Printer size={15} />
            <span>Cetak Langsung</span>
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE ADVANCED SETTINGS PANEL */}
      {showSettings && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden animate-in fade-in duration-200">
          {/* Settings Tabs Bar */}
          <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/70 p-1.5 gap-1">
            <button
              onClick={() => setActiveTab('kop')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 shrink-0 ${
                activeTab === 'kop'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <School size={14} />
              <span>Kop Surat & Logo</span>
            </button>

            <button
              onClick={() => setActiveTab('surat')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 shrink-0 ${
                activeTab === 'surat'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <FileText size={14} />
              <span>Nomor Surat & Pejabat</span>
            </button>

            <button
              onClick={() => setActiveTab('layout')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 shrink-0 ${
                activeTab === 'layout'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Sliders size={14} />
              <span>Font, Kertas & Margin</span>
            </button>

            <button
              onClick={() => setActiveTab('mapel')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 shrink-0 ${
                activeTab === 'mapel'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Sparkles size={14} />
              <span>Mapel & Penyesuaian Agama</span>
            </button>

            <button
              onClick={() => setActiveTab('masal')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 shrink-0 ${
                activeTab === 'masal'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Users size={14} />
              <span>Cetak Masal (Batch)</span>
            </button>
          </div>

          <div className="p-5">
            {/* TAB 1: KOP SURAT */}
            {activeTab === 'kop' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Model Kop Surat
                    </label>
                    <select
                      value={kopType}
                      onChange={(e) => setKopType(e.target.value as 'banner' | 'text')}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="text">Teks Resmi + Logo Sekolah</option>
                      <option value="banner">Banner Gambar Utuh</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-3 pt-6">
                    <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={showLogoLeft}
                        onChange={(e) => setShowLogoLeft(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Logo Kiri (Pemda)</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-3 pt-6">
                    <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={showLogoRight}
                        onChange={(e) => setShowLogoRight(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Logo Kanan (Sekolah)</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-3 pt-6">
                    <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={showStempel}
                        onChange={(e) => setShowStempel(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Tampilkan Stempel</span>
                    </label>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start space-x-3 text-xs text-blue-900">
                  <School className="text-blue-600 shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="font-semibold">Sinkronisasi Data Kop Surat Sekolah</p>
                    <p className="text-blue-700 mt-0.5 text-[11px]">
                      Kop surat diambil otomatis dari data <b>Pengaturan Sekolah</b> ({appState.sekolah.namaSekolah || 'SMP Negeri 2 Kemranjen'}, {appState.sekolah.alamat}, dsb.) dilengkapi dengan <b>garis ganda tebal-tipis</b> resmi berjarak 1,5 spasi.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: NOMOR SURAT & PEJABAT */}
            {activeTab === 'surat' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nomor Surat SKL (Aktif)
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={noSurat}
                        onChange={(e) => setNoSurat(e.target.value)}
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                        placeholder="400.3.11/156/2026"
                      />
                      <button
                        title="Reset Nomor Default"
                        onClick={() => {
                          const idxStr = String((selectedIndex >= 0 ? selectedIndex : 0) + 156);
                          setNoSurat(`400.3.11/${idxStr}/2026`);
                        }}
                        className="p-2 text-slate-500 hover:text-blue-600 bg-slate-100 rounded-xl shrink-0"
                      >
                        <RefreshCw size={15} />
                      </button>
                    </div>
                  </div>

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
                      placeholder="2 Juni 2026"
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
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tahun Ajaran (Aktif)
                    </label>
                    <input
                      type="text"
                      value={tahunAjaran}
                      onChange={(e) => setTahunAjaran(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      placeholder="2025/2026"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LAYOUT, FONT & MARGIN */}
            {activeTab === 'layout' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Bentuk Huruf (Font Family)
                    </label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value as any)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
                    >
                      <option value="Arial">Arial (Sans-Serif - Sesuai Contoh Gambar)</option>
                      <option value="Times New Roman">Times New Roman (Serif Formal)</option>
                      <option value="Calibri">Calibri (Modern)</option>
                      <option value="Bookman Old Style">Bookman Old Style (Klasik)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ukuran Huruf (Font Size)
                    </label>
                    <select
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
                    >
                      <option value="9.5pt">9.5 pt (Kompak)</option>
                      <option value="10pt">10 pt (Standar Rekomendasi)</option>
                      <option value="10.5pt">10.5 pt</option>
                      <option value="11pt">11 pt</option>
                      <option value="11.5pt">11.5 pt</option>
                      <option value="12pt">12 pt (Besar)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ukuran Kertas (Paper Size)
                    </label>
                    <select
                      value={paperSize}
                      onChange={(e) => setPaperSize(e.target.value as any)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
                    >
                      <option value="A4">A4 (210 x 297 mm)</option>
                      <option value="F4">F4 / Folio (215 x 330 mm)</option>
                      <option value="Letter">Letter (215.9 x 279.4 mm)</option>
                      <option value="Legal">Legal (215.9 x 355.6 mm)</option>
                    </select>
                  </div>
                </div>

                {/* Margins */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">
                      Pengaturan Margin Dokumen (dalam satuan mm)
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setMargins({ top: 15, bottom: 15, left: 20, right: 15 })}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        Standar (15/15/20/15)
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => setMargins({ top: 10, bottom: 10, left: 15, right: 10 })}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        Kompak (10/10/15/10)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">
                        Margin Atas (Top)
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="5"
                          max="40"
                          value={margins.top}
                          onChange={(e) => setMargins({ ...margins, top: Number(e.target.value) })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                        />
                        <span className="text-xs font-medium text-slate-500">mm</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">
                        Margin Bawah (Bottom)
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="5"
                          max="40"
                          value={margins.bottom}
                          onChange={(e) => setMargins({ ...margins, bottom: Number(e.target.value) })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                        />
                        <span className="text-xs font-medium text-slate-500">mm</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">
                        Margin Kiri (Left)
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="5"
                          max="40"
                          value={margins.left}
                          onChange={(e) => setMargins({ ...margins, left: Number(e.target.value) })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                        />
                        <span className="text-xs font-medium text-slate-500">mm</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">
                        Margin Kanan (Right)
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="5"
                          max="40"
                          value={margins.right}
                          onChange={(e) => setMargins({ ...margins, right: Number(e.target.value) })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                        />
                        <span className="text-xs font-medium text-slate-500">mm</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: MAPEL & PENYESUAIAN AGAMA */}
            {activeTab === 'mapel' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Format Nama Mapel Pendidikan Agama
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80">
                      <input
                        type="radio"
                        name="religionMode"
                        checked={religionMode === 'general'}
                        onChange={() => setReligionMode('general')}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Sesuai Input Data Mapel
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Sesuai nama mapel yang diinput di menu Data Mapel.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80">
                      <input
                        type="radio"
                        name="religionMode"
                        checked={religionMode === 'auto_specific'}
                        onChange={() => setReligionMode('auto_specific')}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Sesuai Agama + Budi Pekerti
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Contoh: &quot;Pendidikan Agama Islam dan Budi Pekerti&quot;
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80">
                      <input
                        type="radio"
                        name="religionMode"
                        checked={religionMode === 'auto_simple'}
                        onChange={() => setReligionMode('auto_simple')}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Sesuai Agama Sederhana
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Contoh: &quot;Pendidikan Agama Islam&quot;
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Selection of mapel items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">
                      Pilih Mata Pelajaran Yang Dicetak ({selectedMapelIds.length} dari {allMapelOptions.length} Mapel)
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSelectAllMapel}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={handleDeselectAllMapel}
                        className="text-[11px] font-semibold text-slate-500 hover:underline"
                      >
                        Batal Pilih
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {allMapelOptions.map((m, idx) => {
                      const isChecked = selectedMapelIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center space-x-2.5 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-blue-50/70 border-blue-200 text-blue-950 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-500 opacity-70'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleMapel(m.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 shrink-0"
                          />
                          <span className="truncate">{idx + 1}. {m.namaMapel}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: CETAK MASAL */}
            {activeTab === 'masal' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Cetak & Unduh SKL Masal (Multi-Siswa PDF)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hasilkan 1 file PDF gabungan yang berisi lembar SKL seluruh siswa kelas 9 secara berurutan.
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setBatchSelectedIds(kelas9Students.map((s) => s.id))}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Pilih Semua ({kelas9Students.length})
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setBatchSelectedIds([])}
                      className="text-xs font-semibold text-slate-500 hover:underline"
                    >
                      Batal Semua
                    </button>
                    <button
                      onClick={handleBatchDownloadPdf}
                      disabled={isBatchGenerating || batchSelectedIds.length === 0}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-2 disabled:opacity-50"
                    >
                      {isBatchGenerating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      <span>Unduh PDF Masal ({batchSelectedIds.length})</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-56 overflow-y-auto p-1">
                  {kelas9Students.map((s) => {
                    const isSelected = batchSelectedIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-200 text-blue-900 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setBatchSelectedIds((prev) =>
                              prev.includes(s.id)
                                ? prev.filter((id) => id !== s.id)
                                : [...prev, s.id]
                            );
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="truncate">{s.nama}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STUDENT SELECTION & NAVIGATION BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <button
              onClick={handlePrevStudent}
              disabled={selectedIndex <= 0}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-all"
              title="Siswa Sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextStudent}
              disabled={selectedIndex >= kelas9Students.length - 1}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-all"
              title="Siswa Berikutnya"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={searchSiswa}
                onChange={(e) => setSearchSiswa(e.target.value)}
                placeholder="Cari nama / NIS / NISN..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden w-44 md:w-56"
              />
            </div>

            {availableKelasList.length > 1 && (
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden"
              >
                <option value="all">Semua Kelas</option>
                {availableKelasList.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Selected student dropdown */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-slate-500 shrink-0">Pilih Siswa:</span>
          <select
            value={selectedSiswaId}
            onChange={(e) => setSelectedSiswaId(e.target.value)}
            className="text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden max-w-xs md:max-w-md truncate"
          >
            {filteredStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama} • NIS: {s.nis} ({s.kodeKelas})
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400 font-medium">
            {selectedIndex + 1} dari {kelas9Students.length}
          </span>
        </div>
      </div>

      {/* DOCUMENT PREVIEW CONTAINER (SIMULATION OF PHYSICAL SHEET) */}
      <div className="flex justify-center overflow-x-auto pb-12">
        <div
          id="printable-skl-document"
          className="bg-white shadow-2xl transition-all duration-200 text-black shrink-0 relative"
          style={{
            width: `${getPaperDimensionsMm().width}mm`,
            minHeight: `${getPaperDimensionsMm().height}mm`,
            paddingTop: `${margins.top}mm`,
            paddingBottom: `${margins.bottom}mm`,
            paddingLeft: `${margins.left}mm`,
            paddingRight: `${margins.right}mm`,
            fontFamily: getFontFamilyCss(),
            fontSize: fontSize,
            boxSizing: 'border-box',
          }}
        >
          {/* KOP SURAT SECTION (TANPA GARIS DI BAWAH KOP SESUAI GAMBAR & INSTRUKSI) */}
          {kopType === 'banner' && appState.sekolah.kopSekolahUrl ? (
            <div className="pb-2 mb-4 text-center">
              <img
                src={appState.sekolah.kopSekolahUrl}
                alt="Kop Surat Sekolah"
                className="w-full max-h-32 object-contain mx-auto"
              />
            </div>
          ) : (
            <div className="pb-2 mb-3">
              <div className="flex items-center justify-between gap-2 text-center pb-1">
                {/* Left Logo (Logo Pemda) */}
                {showLogoLeft && (
                  <div className="w-16 shrink-0 flex items-center justify-center">
                    {appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl ? (
                      <img
                        src={appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl}
                        alt="Logo Pemda"
                        className="w-14 h-14 object-contain"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs">
                        PEMDA
                      </div>
                    )}
                  </div>
                )}

                {/* Kop Text */}
                <div className="flex-1 px-2 leading-tight">
                  <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-black">
                    {appState.sekolah.pemerintahDaerah?.toUpperCase() || `PEMERINTAH KABUPATEN ${(appState.sekolah.kabupatenKota || 'BANYUMAS').toUpperCase()}`}
                  </h3>
                  <h1 className="text-sm md:text-base font-black tracking-wide uppercase text-black my-0.5">
                    {(appState.sekolah.namaSekolah || 'SMP NEGERI 2 KEMRANJEN').toUpperCase()}
                  </h1>
                  {appState.sekolah.alamatLengkapKop ? (
                    <p className="text-[10px] md:text-[11px] leading-relaxed font-medium whitespace-pre-line text-slate-800">
                      {appState.sekolah.alamatLengkapKop}
                    </p>
                  ) : (
                    <>
                      <p className="text-[10px] md:text-[11px] leading-tight font-medium">
                        {appState.sekolah.alamat || 'Karangsalam'}
                        {appState.sekolah.telepon ? ` ☎ ${appState.sekolah.telepon}` : ''}
                        {appState.sekolah.kecamatan ? ` ${appState.sekolah.kecamatan}` : ''}
                        {appState.sekolah.kabupatenKota ? ` ${appState.sekolah.kabupatenKota}` : ''}
                        {appState.sekolah.kodePos ? ` ✉ ${appState.sekolah.kodePos}` : ''}
                      </p>
                      {appState.sekolah.email && (
                        <p className="text-[10px] md:text-[11px] leading-tight font-medium text-blue-700 underline">
                          email : {appState.sekolah.email || 'smpn2.kemranjen@banyumaskab.go.id'}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Right Logo (Logo Sekolah) */}
                {showLogoRight && (
                  <div className="w-16 shrink-0 flex items-center justify-center">
                    {appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl ? (
                      <img
                        src={appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl}
                        alt="Logo Sekolah"
                        className="w-14 h-14 object-contain"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs">
                        SEKOLAH
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Garis Tebal Tipis di Bawah Kop dengan 1,5 Spasi */}
          <div className="mt-2 mb-4">
            <div className="border-t-[2.5px] border-black"></div>
            <div className="border-t-[0.75px] border-black mt-[1.5px]"></div>
          </div>

          {/* DOCUMENT TITLE & NOMOR SURAT */}
          <div className="text-center mb-3.5 space-y-0.5">
            <h2 className="text-sm md:text-base font-black uppercase tracking-wide">
              SURAT KETERANGAN LULUS
            </h2>
            <p className="text-xs font-medium">
              Nomor : {noSurat}
            </p>
          </div>

          {/* OPENING PARAGRAPH */}
          <p className="text-[11.5px] leading-relaxed text-justify mb-3">
            Yang bertanda tangan di bawah ini, Kepala {namaSekolahLengkap}, Kabupaten {kabupatenSekolah}, Nomor Pokok Sekolah Nasional (NPSN) {npsnSekolah} menerangkan dengan sesungguhnya bahwa:
          </p>

          {/* STUDENT IDENTITY DETAILS */}
          <div className="text-[11.5px] mb-3 space-y-1">
            <div className="flex">
              <div className="w-44 shrink-0 font-medium">Nama Peserta Didik</div>
              <div className="w-4 text-center">:</div>
              <div className="flex-1 font-bold uppercase">{selectedSiswa?.nama}</div>
            </div>
            <div className="flex">
              <div className="w-44 shrink-0 font-medium">Tempat, tgl. Lahir</div>
              <div className="w-4 text-center">:</div>
              <div className="flex-1">
                {selectedSiswa?.tempatLahir || 'Purbalingga'}, {formatIndonesianDate(selectedSiswa?.tanggalLahir)}
              </div>
            </div>
            <div className="flex">
              <div className="w-44 shrink-0 font-medium">NIS/NISN</div>
              <div className="w-4 text-center">:</div>
              <div className="flex-1">
                {selectedSiswa?.nis || '-'} / {selectedSiswa?.nisn || '-'}
              </div>
            </div>
          </div>

          {/* STATUS KELULUSAN STATEMENT */}
          <p className="text-[11.5px] leading-relaxed mb-2">
            Dinyatakan LULUS dari satuan pendidikan Tahun Ajaran {tahunAjaran}, dengan nilai sebagai berikut:
          </p>

          {/* GRADE TABLE */}
          <table className="w-full border-collapse border border-black text-[11px] mb-3">
            <thead>
              <tr className="border-b border-black font-bold text-center">
                <th className="border border-black px-2 py-1 w-12 text-center">No.</th>
                <th className="border border-black px-3 py-1 text-center">Mata Pelajaran</th>
                <th className="border border-black px-3 py-1 w-36 text-center">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="border border-black p-3 text-center text-slate-500 italic">
                    Belum ada nilai mata pelajaran yang terisi (nilai 0 / belum diinput pada menu Input Nilai K9).
                  </td>
                </tr>
              ) : (
                currentRows.map((r) => (
                  <tr key={r.no} className="border-b border-black">
                    <td className="border border-black px-2 py-0.5 text-center">{r.no}</td>
                    <td className="border border-black px-3 py-0.5 text-left">{r.namaMapel}</td>
                    <td className="border border-black px-3 py-0.5 text-center">{r.scoreStr}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-black font-bold">
                <td colSpan={2} className="border border-black px-3 py-1 text-center font-bold">
                  Jumlah Nilai
                </td>
                <td className="border border-black px-3 py-1 text-center font-bold">
                  {totalNilaiStr}
                </td>
              </tr>
              <tr className="border-t border-black font-bold">
                <td colSpan={2} className="border border-black px-3 py-1 text-center font-bold">
                  Rata-rata
                </td>
                <td className="border border-black px-3 py-1 text-center font-bold">
                  {averageStr}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* CLOSING PARAGRAPH */}
          <p className="text-[11px] leading-relaxed text-justify mb-5">
            Surat Keterangan Lulus ini berlaku sementara sampai dengan diterbitkannya Ijazah Tahun Ajaran {tahunAjaran}, untuk menjadikan maklum bagi yang berkepentingan.
          </p>

          {/* SIGNATURE BLOCK */}
          <div className="flex justify-end pt-1">
            <div className="w-64 text-left text-[11.5px] leading-snug">
              <p>
                {tempatTtd}, {tanggalTtd}
              </p>
              <p className="mb-2">Kepala Sekolah</p>

              {/* Signature and Stamp space */}
              <div className="h-16 relative flex items-center">
                {showStempel && appState.sekolah.stempelUrl && (
                  <img
                    src={appState.sekolah.stempelUrl}
                    alt="Stempel Sekolah"
                    className="absolute -left-6 -top-2 w-20 h-20 object-contain opacity-85 pointer-events-none"
                  />
                )}
                {showTtdKepsek && appState.sekolah.ttdKepalaSekolahUrl && (
                  <img
                    src={appState.sekolah.ttdKepalaSekolahUrl}
                    alt="Tanda Tangan Kepala Sekolah"
                    className="absolute left-4 top-1 max-h-14 object-contain pointer-events-none"
                  />
                )}
              </div>

              <p className="font-bold text-black text-[12px]">{namaKepalaSekolah}</p>
              <p className="text-[11px]">NIP {nipKepalaSekolah}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN INTERACTIVE PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col justify-between animate-in fade-in duration-200">
          {/* Modal Header */}
          <div className="bg-slate-900 border-b border-slate-800 p-4 text-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileBadge className="text-blue-400" size={20} />
              <div>
                <h3 className="text-sm font-bold">
                  Pratinjau Cetak SKL • {selectedSiswa?.nama} ({selectedSiswa?.kodeKelas})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Ukuran: {paperSize} • Font: {fontFamily} ({fontSize}) • Margin: {margins.top}/{margins.right}/{margins.bottom}/{margins.left} mm
                </p>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-slate-800 rounded-lg p-1 space-x-1">
                <button
                  onClick={() => setPreviewZoom((prev) => Math.max(50, prev - 10))}
                  className="p-1 text-slate-300 hover:text-white rounded-md"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono px-2 text-slate-300">{previewZoom}%</span>
                <button
                  onClick={() => setPreviewZoom((prev) => Math.min(150, prev + 10))}
                  className="p-1 text-slate-300 hover:text-white rounded-md"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  onClick={() => setPreviewZoom(100)}
                  className="p-1 text-slate-300 hover:text-white rounded-md"
                  title="Reset Zoom"
                >
                  <Maximize2 size={15} />
                </button>
              </div>

              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center space-x-1.5"
              >
                {isGeneratingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span>Unduh PDF</span>
              </button>

              <button
                onClick={handleDirectPrint}
                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg flex items-center space-x-1.5"
              >
                <Printer size={14} />
                <span>Cetak</span>
              </button>

              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Preview Body */}
          <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-900/60">
            <div
              style={{
                transform: `scale(${previewZoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
              }}
              className="bg-white shadow-2xl rounded-xs p-8 text-black"
            >
              <div
                style={{
                  width: `${getPaperDimensionsMm().width}mm`,
                  minHeight: `${getPaperDimensionsMm().height}mm`,
                  paddingTop: `${margins.top}mm`,
                  paddingBottom: `${margins.bottom}mm`,
                  paddingLeft: `${margins.left}mm`,
                  paddingRight: `${margins.right}mm`,
                  fontFamily: getFontFamilyCss(),
                  fontSize: fontSize,
                  boxSizing: 'border-box',
                }}
              >
                {/* Kop di Pratinjau */}
                {kopType === 'banner' && appState.sekolah.kopSekolahUrl ? (
                  <div className="pb-1 text-center">
                    <img
                      src={appState.sekolah.kopSekolahUrl}
                      alt="Kop Surat Sekolah"
                      className="w-full max-h-32 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="pb-1">
                    <div className="flex items-center justify-between gap-2 text-center pb-1">
                      {showLogoLeft && (
                        <div className="w-16 shrink-0 flex items-center justify-center">
                          {(appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl) && (
                            <img
                              src={appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl}
                              alt="Logo Pemda"
                              className="w-14 h-14 object-contain"
                            />
                          )}
                        </div>
                      )}

                      <div className="flex-1 px-2 leading-tight">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                          {appState.sekolah.pemerintahDaerah?.toUpperCase() || `PEMERINTAH KABUPATEN ${(appState.sekolah.kabupatenKota || 'BANYUMAS').toUpperCase()}`}
                        </h3>
                        <h1 className="text-sm font-black tracking-wide uppercase text-black my-0.5">
                          {(appState.sekolah.namaSekolah || 'SMP NEGERI 2 KEMRANJEN').toUpperCase()}
                        </h1>
                        {appState.sekolah.alamatLengkapKop ? (
                          <p className="text-[10px] leading-relaxed font-medium whitespace-pre-line text-slate-800">
                            {appState.sekolah.alamatLengkapKop}
                          </p>
                        ) : (
                          <>
                            <p className="text-[10px] leading-tight font-medium">
                              {appState.sekolah.alamat || 'Karangsalam'}
                              {appState.sekolah.telepon ? ` ☎ ${appState.sekolah.telepon}` : ''}
                              {appState.sekolah.kecamatan ? ` ${appState.sekolah.kecamatan}` : ''}
                              {appState.sekolah.kabupatenKota ? ` ${appState.sekolah.kabupatenKota}` : ''}
                              {appState.sekolah.kodePos ? ` ✉ ${appState.sekolah.kodePos}` : ''}
                            </p>
                            {appState.sekolah.email && (
                              <p className="text-[10px] leading-tight font-medium text-blue-700 underline">
                                email : {appState.sekolah.email || 'smpn2.kemranjen@banyumaskab.go.id'}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      {showLogoRight && (
                        <div className="w-16 shrink-0 flex items-center justify-center">
                          {(appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl) && (
                            <img
                              src={appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl}
                              alt="Logo Sekolah"
                              className="w-14 h-14 object-contain"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Garis Tebal Tipis di Bawah Kop dengan 1,5 Spasi */}
                <div className="mt-1.5 mb-3.5">
                  <div className="border-t-[2.5px] border-black"></div>
                  <div className="border-t-[0.75px] border-black mt-[1.5px]"></div>
                </div>

                {/* Judul & Nomor */}
                <div className="text-center mb-3.5 space-y-0.5">
                  <h2 className="text-sm font-black uppercase tracking-wide">
                    SURAT KETERANGAN LULUS
                  </h2>
                  <p className="text-xs font-medium">Nomor : {noSurat}</p>
                </div>

                {/* Paragraf Pembuka */}
                <p className="text-[11.5px] leading-relaxed text-justify mb-3">
                  Yang bertanda tangan di bawah ini, Kepala {namaSekolahLengkap}, Kabupaten {kabupatenSekolah}, Nomor Pokok Sekolah Nasional (NPSN) {npsnSekolah} menerangkan dengan sesungguhnya bahwa:
                </p>

                {/* Identitas Siswa */}
                <div className="text-[11.5px] mb-3 space-y-1">
                  <div className="flex">
                    <div className="w-44 shrink-0 font-medium">Nama Peserta Didik</div>
                    <div className="w-4 text-center">:</div>
                    <div className="flex-1 font-bold uppercase">{selectedSiswa?.nama}</div>
                  </div>
                  <div className="flex">
                    <div className="w-44 shrink-0 font-medium">Tempat, tgl. Lahir</div>
                    <div className="w-4 text-center">:</div>
                    <div className="flex-1">
                      {selectedSiswa?.tempatLahir || 'Purbalingga'}, {formatIndonesianDate(selectedSiswa?.tanggalLahir)}
                    </div>
                  </div>
                  <div className="flex">
                    <div className="w-44 shrink-0 font-medium">NIS/NISN</div>
                    <div className="w-4 text-center">:</div>
                    <div className="flex-1">{selectedSiswa?.nis} / {selectedSiswa?.nisn}</div>
                  </div>
                </div>

                {/* Pernyataan */}
                <p className="text-[11.5px] leading-relaxed mb-2">
                  Dinyatakan LULUS dari satuan pendidikan Tahun Ajaran {tahunAjaran}, dengan nilai sebagai berikut:
                </p>

                {/* Tabel Nilai */}
                <table className="w-full border-collapse border border-black text-[11px] mb-3">
                  <thead>
                    <tr className="border-b border-black font-bold text-center">
                      <th className="border border-black px-2 py-1 w-12 text-center">No.</th>
                      <th className="border border-black px-3 py-1 text-center">Mata Pelajaran</th>
                      <th className="border border-black px-3 py-1 w-36 text-center">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="border border-black p-3 text-center text-slate-500 italic">
                          Belum ada nilai mata pelajaran yang terisi (nilai 0 / belum diinput pada menu Input Nilai K9).
                        </td>
                      </tr>
                    ) : (
                      currentRows.map((r) => (
                        <tr key={r.no} className="border-b border-black">
                          <td className="border border-black px-2 py-0.5 text-center">{r.no}</td>
                          <td className="border border-black px-3 py-0.5 text-left">{r.namaMapel}</td>
                          <td className="border border-black px-3 py-0.5 text-center">{r.scoreStr}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-black font-bold">
                      <td colSpan={2} className="border border-black px-3 py-1 text-center font-bold">
                        Jumlah Nilai
                      </td>
                      <td className="border border-black px-3 py-1 text-center font-bold">
                        {totalNilaiStr}
                      </td>
                    </tr>
                    <tr className="border-t border-black font-bold">
                      <td colSpan={2} className="border border-black px-3 py-1 text-center font-bold">
                        Rata-rata
                      </td>
                      <td className="border border-black px-3 py-1 text-center font-bold">
                        {averageStr}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Penutup */}
                <p className="text-[11px] leading-relaxed text-justify mb-5">
                  Surat Keterangan Lulus ini berlaku sementara sampai dengan diterbitkannya Ijazah Tahun Ajaran {tahunAjaran}, untuk menjadikan maklum bagi yang berkepentingan.
                </p>

                {/* Tanda Tangan */}
                <div className="flex justify-end pt-1">
                  <div className="w-64 text-left text-[11.5px] leading-snug">
                    <p>{tempatTtd}, {tanggalTtd}</p>
                    <p className="mb-2">Kepala Sekolah</p>
                    <div className="h-16 relative flex items-center">
                      {showStempel && appState.sekolah.stempelUrl && (
                        <img
                          src={appState.sekolah.stempelUrl}
                          alt="Stempel"
                          className="absolute -left-6 -top-2 w-20 h-20 object-contain opacity-85"
                        />
                      )}
                      {showTtdKepsek && appState.sekolah.ttdKepalaSekolahUrl && (
                        <img
                          src={appState.sekolah.ttdKepalaSekolahUrl}
                          alt="TTD"
                          className="absolute left-4 top-1 max-h-14 object-contain"
                        />
                      )}
                    </div>
                    <p className="font-bold text-black text-[12px]">{namaKepalaSekolah}</p>
                    <p className="text-[11px]">NIP {nipKepalaSekolah}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
