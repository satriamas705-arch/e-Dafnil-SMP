import React, { useState, useEffect, useRef } from 'react';
import { AppState, AuthUser, Siswa, Mapel } from '../../types';
import { isGrade9Student, calculateK9MapelScores, formatScoreVal } from '../../lib/k9GradeHelper';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import {
  Printer,
  FileCheck,
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
  ShieldCheck,
  Search,
} from 'lucide-react';

interface CetakSKNRProps {
  appState: AppState;
  authUser?: AuthUser | null;
}

export const CetakSKNR: React.FC<CetakSKNRProps> = ({ appState, authUser }) => {
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

  // Strict Filter Siswa Kelas 9
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

  // Quick Class and Search filter
  const [filterKelas, setFilterKelas] = useState<string>('all');
  const [searchSiswa, setSearchSiswa] = useState<string>('');

  const availableKelasList = Array.from(new Set(kelas9Students.map((s) => s.kodeKelas))).sort();

  const filteredStudents = kelas9Students.filter((s) => {
    const matchesSearch =
      s.nama.toLowerCase().includes(searchSiswa.toLowerCase()) ||
      s.nis.includes(searchSiswa) ||
      s.nisn.includes(searchSiswa);
    const matchesKelas = filterKelas === 'all' || s.kodeKelas === filterKelas;
    return matchesSearch && matchesKelas;
  });

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
        <h2 className="text-xl font-extrabold text-slate-900">Akses Terbatas: Cetak SKNR</h2>
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

  // 1. Pengaturan Kop Surat
  const [kopType, setKopType] = useState<'banner' | 'text'>(
    appState.sekolah.kopSekolahUrl ? 'banner' : 'text'
  );
  const [showLogoLeft, setShowLogoLeft] = useState<boolean>(true);
  const [showLogoRight, setShowLogoRight] = useState<boolean>(true);
  const [showStempel, setShowStempel] = useState<boolean>(true);
  const [showTtdKepsek, setShowTtdKepsek] = useState<boolean>(true);

  // 2. Pengaturan Field Surat & Pejabat
  const [noSurat, setNoSurat] = useState<string>(
    gradeRecord?.noSuratSKNR || `421.3/SKNR/${appState.sekolah.npsn || '10203040'}/2026/001`
  );
  const [tempatTtd, setTempatTtd] = useState<string>(
    appState.sekolah.kabupatenKota || 'Banyumas'
  );
  const [tanggalTtd, setTanggalTtd] = useState<string>(
    appState.sekolah.tanggalSurat || '13 Agustus 2026'
  );
  const [namaKepalaSekolah, setNamaKepalaSekolah] = useState<string>(
    appState.sekolah.namaKepalaSekolah || 'Drs. H. Ahmad Wijaya, M.Pd.'
  );
  const [nipKepalaSekolah, setNipKepalaSekolah] = useState<string>(
    appState.sekolah.nipKepalaSekolah || '196805121994031005'
  );
  const [jabatanKepalaSekolah, setJabatanKepalaSekolah] = useState<string>(
    `Kepala ${appState.sekolah.namaSekolah || 'Sekolah Menengah Pertama'}`
  );
  const [npsnSekolah, setNpsnSekolah] = useState<string>(
    appState.sekolah.npsn || '10203040'
  );

  // Sync state when appState.sekolah changes
  useEffect(() => {
    setTempatTtd(appState.sekolah.kabupatenKota || 'Banyumas');
    setTanggalTtd(appState.sekolah.tanggalSurat || '13 Agustus 2026');
    setNamaKepalaSekolah(appState.sekolah.namaKepalaSekolah || 'Drs. H. Ahmad Wijaya, M.Pd.');
    setNipKepalaSekolah(appState.sekolah.nipKepalaSekolah || '196805121994031005');
    setJabatanKepalaSekolah(`Kepala ${appState.sekolah.namaSekolah || 'Sekolah Menengah Pertama'}`);
    setNpsnSekolah(appState.sekolah.npsn || '10203040');
    if (appState.sekolah.kopSekolahUrl) {
      setKopType('banner');
    }
  }, [appState.sekolah]);

  // Sync noSurat when selected student changes
  useEffect(() => {
    if (gradeRecord?.noSuratSKNR) {
      setNoSurat(gradeRecord.noSuratSKNR);
    } else {
      const idxStr = String((selectedIndex >= 0 ? selectedIndex : 0) + 1).padStart(3, '0');
      setNoSurat(`421.3/SKNR/${appState.sekolah.npsn || '10203040'}/2026/${idxStr}`);
    }
  }, [selectedSiswaId, gradeRecord, selectedIndex, appState.sekolah.npsn]);

  // 3. Layout, Font, Kertas & Margin
  const [fontFamily, setFontFamily] = useState<'Times New Roman' | 'Arial' | 'Calibri' | 'Bookman Old Style'>('Times New Roman');
  const [fontSize, setFontSize] = useState<string>('11pt');
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

  // 4. Pengaturan Mata Pelajaran
  const sortedMapels = [...appState.mapelList].sort(
    (a, b) => (a.urutan || 99) - (b.urutan || 99)
  );

  const [selectedMapelIds, setSelectedMapelIds] = useState<string[]>(
    sortedMapels.map((m) => m.id)
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

  const handleToggleMapel = (id: string) => {
    setSelectedMapelIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleSelectAllMapel = () => {
    setSelectedMapelIds(sortedMapels.map((m) => m.id));
  };

  const handleDeselectAllMapel = () => {
    setSelectedMapelIds([]);
  };

  const printableMapels = sortedMapels.filter((m) => selectedMapelIds.includes(m.id));

  // Helper function: sesuaikan nama mata pelajaran agama dengan agama siswa
  const getFormattedMapelName = (namaMapel: string, agamaSiswa?: string): string => {
    const trimmedAgama = agamaSiswa?.trim();
    const lower = namaMapel.toLowerCase();

    // Khusus mapel pendidikan agama, sesuaikan dengan agama siswa
    if (lower.includes('pendidikan agama') || lower.startsWith('agama')) {
      if (!trimmedAgama) return namaMapel;
      const hasBudiPekerti = lower.includes('budi pekerti');
      if (hasBudiPekerti) {
        return `Pendidikan Agama ${trimmedAgama} dan Budi Pekerti`;
      }
      return `Pendidikan Agama ${trimmedAgama}`;
    }

    return namaMapel;
  };

  // Helper format nilai dengan 2 angka di belakang koma (misal: 83,00 atau 90,60)
  const formatScoreVal = (val: number | undefined | null): string => {
    if (val === undefined || val === null || isNaN(val) || val <= 0) return '-';
    return Number(val).toFixed(2).replace('.', ',');
  };

  // Compute student grades calculation
  const getStudentGrades = (siswaId: string) => {
    const targetSiswa = appState.siswaList.find((s) => s.id === siswaId);
    const studentGrade = appState.nilaiKelas9List.find((n) => n.siswaId === siswaId);
    let sumS1 = 0, countS1 = 0;
    let sumS2 = 0, countS2 = 0;
    let sumS3 = 0, countS3 = 0;
    let sumS4 = 0, countS4 = 0;
    let sumS5 = 0, countS5 = 0;
    let sumOverall = 0, countOverall = 0;

    const validRows: Array<{
      namaMapel: string;
      s1Raw: number;
      s2Raw: number;
      s3Raw: number;
      s4Raw: number;
      s5Raw: number;
      avgRaw: number;
      s1: string;
      s2: string;
      s3: string;
      s4: string;
      s5: string;
      avg: string;
    }> = [];

    printableMapels.forEach((m) => {
      const detail = studentGrade?.k9DetailMapel?.[m.id];
      let s1 = detail?.s1;
      let s2 = detail?.s2;
      let s3 = detail?.s3;
      let s4 = detail?.s4;
      let s5 = detail?.s5;

      const legacyRapor = studentGrade?.nilaiRaporSem1_5?.[m.id] || studentGrade?.nilaiSekolah?.[m.id] || 0;

      // Fallback jika k9DetailMapel belum terisi per semester tapi ada nilai rapor/sekolah
      if (
        (s1 === undefined || s1 === null || s1 === 0) &&
        (s2 === undefined || s2 === null || s2 === 0) &&
        (s3 === undefined || s3 === null || s3 === 0) &&
        (s4 === undefined || s4 === null || s4 === 0) &&
        (s5 === undefined || s5 === null || s5 === 0) &&
        legacyRapor > 0
      ) {
        s1 = legacyRapor;
        s2 = legacyRapor;
        s3 = legacyRapor;
        s4 = legacyRapor;
        s5 = legacyRapor;
      }

      const semVals = [s1, s2, s3, s4, s5].map((v) => Number(v) || 0);
      const validVals = semVals.filter((v) => v > 0);
      const rowAvg =
        validVals.length > 0
          ? validVals.reduce((a, b) => a + b, 0) / validVals.length
          : legacyRapor;

      const hasScore = validVals.length > 0 || rowAvg > 0;

      // Siswa dianggap memiliki nilai jika terdapat nilai di salah satu semester atau rerata > 0
      if (!hasScore) {
        return;
      }

      if (s1 && s1 > 0) { sumS1 += s1; countS1++; }
      if (s2 && s2 > 0) { sumS2 += s2; countS2++; }
      if (s3 && s3 > 0) { sumS3 += s3; countS3++; }
      if (s4 && s4 > 0) { sumS4 += s4; countS4++; }
      if (s5 && s5 > 0) { sumS5 += s5; countS5++; }

      if (rowAvg > 0) {
        sumOverall += rowAvg;
        countOverall++;
      }

      const formattedName = getFormattedMapelName(m.namaMapel, targetSiswa?.agama);

      validRows.push({
        namaMapel: formattedName,
        s1Raw: s1 || 0,
        s2Raw: s2 || 0,
        s3Raw: s3 || 0,
        s4Raw: s4 || 0,
        s5Raw: s5 || 0,
        avgRaw: rowAvg,
        s1: formatScoreVal(s1),
        s2: formatScoreVal(s2),
        s3: formatScoreVal(s3),
        s4: formatScoreVal(s4),
        s5: formatScoreVal(s5),
        avg: formatScoreVal(rowAvg),
      });
    });

    const rows = validRows.map((r, idx) => ({
      no: idx + 1,
      ...r,
    }));

    const averages = {
      avgS1: countS1 > 0 ? formatScoreVal(sumS1 / countS1) : '-',
      avgS2: countS2 > 0 ? formatScoreVal(sumS2 / countS2) : '-',
      avgS3: countS3 > 0 ? formatScoreVal(sumS3 / countS3) : '-',
      avgS4: countS4 > 0 ? formatScoreVal(sumS4 / countS4) : '-',
      avgS5: countS5 > 0 ? formatScoreVal(sumS5 / countS5) : '-',
      avgOverall: countOverall > 0 ? formatScoreVal(sumOverall / countOverall) : '-',
    };

    return { rows, averages };
  };

  const { rows: currentRows, averages: colAvgs } = getStudentGrades(selectedSiswaId);

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

  const getPaperDimensionsCss = () => {
    switch (paperSize) {
      case 'F4':
        return '215mm 330mm';
      case 'Letter':
        return 'letter';
      case 'Legal':
        return 'legal';
      case 'A4':
      default:
        return 'A4';
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

    for (let sIdx = 0; sIdx < targetSiswaList.length; sIdx++) {
      const siswa = targetSiswaList[sIdx];
      if (sIdx > 0) {
        pdf.addPage(format, 'portrait');
      }

      const sGradeRecord = appState.nilaiKelas9List.find((n) => n.siswaId === siswa.id);
      const sNoSurat =
        sGradeRecord?.noSuratSKNR ||
        `421.3/SKNR/${appState.sekolah.npsn || '10203040'}/2026/${String(sIdx + 1).padStart(3, '0')}`;
      const { rows: sRows, averages: sAvgs } = getStudentGrades(siswa.id);

      const top = margins.top;
      const left = margins.left;
      const right = margins.right;
      const contentWidth = pageWidth - left - right;

      let currentY = top;

      // 1. KOP SURAT (TANPA GARIS DI BAWAH KOP SESUAI PERMINTAAN USER)
      if (kopType === 'banner' && kopBannerData) {
        // Render Banner Image
        const bannerHeight = 28;
        pdf.addImage(kopBannerData, 'PNG', left, currentY, contentWidth, bannerHeight, undefined, 'FAST');
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

        // Centered Header Text
        pdf.setFont(fontFamily === 'Arial' ? 'helvetica' : 'times', 'bold');
        pdf.setFontSize(10.5);
        pdf.text(
          (appState.sekolah.pemerintahDaerah || `PEMERINTAH KABUPATEN ${(appState.sekolah.kabupatenKota || 'BANYUMAS')}`).toUpperCase(),
          left + contentWidth / 2,
          currentY + 3.5,
          { align: 'center' }
        );

        pdf.setFontSize(13.5);
        pdf.text(
          (appState.sekolah.namaSekolah || 'SMP NEGERI 2 KEMRANJEN').toUpperCase(),
          left + contentWidth / 2,
          currentY + 8.5,
          { align: 'center' }
        );

        pdf.setFont(fontFamily === 'Arial' ? 'helvetica' : 'times', 'normal');
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
            const contactText = `email : ${appState.sekolah.email || `info@${(appState.sekolah.namaSekolah || 'sekolah').toLowerCase().replace(/\s+/g, '')}.sch.id`}`;
            pdf.setTextColor(0, 80, 160);
            pdf.text(contactText, left + contentWidth / 2, currentY + 16.5, { align: 'center' });
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
      pdf.setFont(fontFamily === 'Arial' ? 'helvetica' : 'times', 'bold');
      pdf.setFontSize(12);
      pdf.text('SURAT KETERANGAN NILAI RAPOR', left + contentWidth / 2, currentY, { align: 'center' });

      pdf.setFont(fontFamily === 'Arial' ? 'helvetica' : 'times', 'normal');
      pdf.setFontSize(9.5);
      currentY += 4.8;
      pdf.text(`Nomor : ${sNoSurat}`, left + contentWidth / 2, currentY, { align: 'center' });
      currentY += 6;

      // 3. PEJABAT SECTION
      pdf.setFontSize(9);
      pdf.text('Yang bertanda tangan di bawah ini :', left, currentY);
      currentY += 4.5;

      const indentX = left + 4;
      const colColonX = indentX + 22;
      const colValX = indentX + 26;

      const printPejabatRow = (label: string, value: string, isBold = false) => {
        pdf.setFont(fontFamily === 'Arial' ? 'helvetica' : 'times', 'normal');
        pdf.text(label, indentX, currentY);
        pdf.text(':', colColonX, currentY);
        pdf.setFont(fontFamily === 'Arial' ? 'helvetica' : 'times', isBold ? 'bold' : 'normal');
        pdf.text(value, colValX, currentY);
        currentY += 4.2;
      };

      printPejabatRow('Nama', namaKepalaSekolah, true);
      printPejabatRow('NIP', nipKepalaSekolah);
      printPejabatRow('Jabatan', jabatanKepalaSekolah);
      printPejabatRow('NPSN', npsnSekolah);

      currentY += 1.5;

      // 4. SISWA SECTION
      pdf.setFont(fontFamily === 'Arial' ? 'helvetica' : 'times', 'normal');
      pdf.text('Menerangkan Nilai Rapor :', left, currentY);
      currentY += 4.5;

      printPejabatRow('Nama', (siswa.nama || '-').toUpperCase(), true);
      printPejabatRow('NISN', siswa.nisn || '-');

      currentY += 2;

      // 5. TABLE WITH JSPDF-AUTOTABLE (DENGAN NAMA AGAMA DISESUAIKAN & DESIMAL KOMA)
      const tableHead = [
        [
          { content: 'No', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
          { content: 'MATA PELAJARAN', rowSpan: 2, styles: { halign: 'left' as const, valign: 'middle' as const } },
          { content: 'NILAI RAPOR SEMESTER', colSpan: 5, styles: { halign: 'center' as const } },
          { content: 'Rata Rata\nNilai\nSemester I-V', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
        ],
        [
          { content: 'SMT I', styles: { halign: 'center' as const } },
          { content: 'SMT II', styles: { halign: 'center' as const } },
          { content: 'SMT III', styles: { halign: 'center' as const } },
          { content: 'SMT IV', styles: { halign: 'center' as const } },
          { content: 'SMT V', styles: { halign: 'center' as const } },
        ],
      ];

      const tableBody = sRows.map((r) => [
        { content: String(r.no), styles: { halign: 'center' as const } },
        { content: r.namaMapel, styles: { halign: 'left' as const } },
        { content: String(r.s1), styles: { halign: 'center' as const } },
        { content: String(r.s2), styles: { halign: 'center' as const } },
        { content: String(r.s3), styles: { halign: 'center' as const } },
        { content: String(r.s4), styles: { halign: 'center' as const } },
        { content: String(r.s5), styles: { halign: 'center' as const } },
        { content: String(r.avg), styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
      ]);

      const tableFoot = [
        [
          { content: 'RERATA TOTAL', colSpan: 2, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: sAvgs.avgS1, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: sAvgs.avgS2, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: sAvgs.avgS3, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: sAvgs.avgS4, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: sAvgs.avgS5, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: sAvgs.avgOverall, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
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
          font: fontFamily === 'Arial' ? 'helvetica' : 'times',
          fontSize: 8.5,
          cellPadding: 1.5,
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
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
          0: { cellWidth: 8 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 15 },
          3: { cellWidth: 15 },
          4: { cellWidth: 15 },
          5: { cellWidth: 15 },
          6: { cellWidth: 15 },
          7: { cellWidth: 28 },
        },
      });

      const finalTableY = (pdf as any).lastAutoTable?.finalY || currentY + 70;
      currentY = finalTableY + 4;

      // 6. CLOSING PARAGRAPH
      pdf.setFont(fontFamily === 'Arial' ? 'helvetica' : 'times', 'normal');
      pdf.setFontSize(8.5);
      const closingText =
        'Demikian Surat Keterangan ini dibuat untuk dapat dipergunakan dengan semestinya, dan kepada yang berkepentingan untuk menjadikan maklum.';
      const splitClosing = pdf.splitTextToSize(closingText, contentWidth);
      pdf.text(splitClosing, left, currentY);
      currentY += splitClosing.length * 4 + 3;

      // 7. SIGNATURE BLOCK (Right Aligned)
      const sigBlockWidth = 65;
      const sigLeft = left + contentWidth - sigBlockWidth;

      pdf.text(`${tempatTtd}, ${tanggalTtd}`, sigLeft, currentY);
      currentY += 4;
      pdf.text('Kepala Sekolah,', sigLeft, currentY);
      currentY += 3;

      const sigSpaceY = currentY;

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

      currentY += 17;

      // Pejabat Name & NIP
      pdf.setFont(fontFamily === 'Arial' ? 'helvetica' : 'times', 'bold');
      pdf.text(namaKepalaSekolah, sigLeft, currentY);

      currentY += 4.2;
      pdf.setFont(fontFamily === 'Arial' ? 'helvetica' : 'times', 'normal');
      pdf.text(`NIP ${nipKepalaSekolah}`, sigLeft, currentY);
    }

    return pdf;
  };

  // Single Student PDF Download
  const handleDownloadPdf = async () => {
    if (!selectedSiswa) return;
    try {
      setIsGeneratingPdf(true);
      const pdf = await generateVectorPdf([selectedSiswa]);
      if (!pdf) throw new Error('Gagal menginisialisasi dokumen PDF.');

      const sanitizeName = (selectedSiswa.nama || 'Siswa')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 30);
      const fileName = `SKNR_${sanitizeName}_${selectedSiswa.nisn || 'NISN'}.pdf`;

      pdf.save(fileName);
      setPdfSuccessToast(`Berkas PDF "${fileName}" berhasil diunduh secara instan!`);
      setTimeout(() => setPdfSuccessToast(null), 4000);
    } catch (err) {
      console.error('Error generating vector PDF:', err);
      alert('Terjadi kendala saat membuat PDF. Anda dapat menggunakan tombol "Cetak Dokumen" sebagai alternatif.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Batch PDF Download (All Students in single file)
  const handleBatchDownloadPdf = async () => {
    if (kelas9Students.length === 0) return;
    try {
      setIsBatchGenerating(true);
      setBatchProgress({ current: 1, total: kelas9Students.length });

      const pdf = await generateVectorPdf(kelas9Students, true);
      if (!pdf) throw new Error('Gagal menginisialisasi batch PDF.');

      const fileName = `SKNR_SEMUA_KELAS9_${appState.sekolah.namaSekolah || 'SEKOLAH'}.pdf`.replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      );
      pdf.save(fileName);

      setPdfSuccessToast(`Berhasil mengunduh SKNR untuk ${kelas9Students.length} siswa dalam 1 file PDF!`);
      setTimeout(() => setPdfSuccessToast(null), 5000);
    } catch (err) {
      console.error('Error generating batch PDF:', err);
      alert('Gagal membuat batch PDF.');
    } finally {
      setIsBatchGenerating(false);
      setBatchProgress(null);
    }
  };

  // CLEAN DEDICATED PRINT ENGINE (ISOLATED WINDOW / IFRAME)
  const handleDedicatedPrint = () => {
    const printContent = document.getElementById('sknr-document-to-print');
    if (!printContent) {
      window.print();
      return;
    }

    // Open dedicated clean print window
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) {
      // Fallback if popup blocker is active
      window.print();
      return;
    }

    const docHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak SKNR - ${selectedSiswa?.nama || 'Siswa'}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: ${getPaperDimensionsCss()};
              margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
            }
            body {
              font-family: ${getFontFamilyCss()};
              font-size: ${fontSize};
              color: #000000;
              background: #ffffff;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            * {
              box-sizing: border-box;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 12px 0;
              font-size: inherit;
            }
            th, td {
              border: 1px solid #000000;
              padding: 4px 6px;
              text-align: left;
            }
            th {
              background-color: #f3f4f6 !important;
              text-align: center;
              font-weight: bold;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            .underline { text-decoration: underline; }
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
              width: 70px;
              max-height: 70px;
              object-contain: contain;
            }
            .kop-text {
              flex: 1;
              margin: 0 10px;
            }
            .kop-text h3 { margin: 0; font-size: 11pt; font-weight: bold; }
            .kop-text h1 { margin: 2px 0; font-size: 14pt; font-weight: 900; }
            .kop-text p { margin: 1px 0; font-size: 8.5pt; }
            .title-block {
              text-align: center;
              margin: 12px 0 10px 0;
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
            .grid-row {
              display: flex;
              margin-bottom: 3px;
              font-size: 9.5pt;
            }
            .grid-label { width: 110px; }
            .grid-colon { width: 15px; }
            .grid-val { flex: 1; }
            .sig-block {
              margin-top: 20px;
              display: flex;
              justify-content: flex-end;
              font-size: 9.5pt;
            }
            .sig-content {
              width: 240px;
              text-align: left;
              position: relative;
            }
            .sig-space {
              height: 60px;
              position: relative;
            }
            .sig-stamp {
              position: absolute;
              left: -15px;
              top: -5px;
              width: 75px;
              height: 75px;
              opacity: 0.85;
            }
            .sig-ttd {
              position: absolute;
              left: 10px;
              top: 5px;
              max-height: 55px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(docHtml);
    printWindow.document.close();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Dynamic @page CSS for standard in-page window.print() */}
      <style>{`
        @media print {
          @page {
            size: ${getPaperDimensionsCss()};
            margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
          }
          body {
            background-color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .sknr-document-sheet {
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* PDF Toast Notification */}
      {pdfSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-800 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 border border-emerald-600 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-300" />
          <span className="text-xs font-bold">{pdfSuccessToast}</span>
        </div>
      )}

      {/* Main Control Toolbar Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
              <FileCheck className="text-blue-600 shrink-0" size={24} />
              <span>Cetak SKNR (Surat Keterangan Nilai Rapor)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Dilengkapi <strong>Engine Vektor jsPDF canggih</strong>, sinkronisasi profil sekolah otomatis, format folio F4/A4, serta unduh masal semua siswa kelas 9.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Toggle Settings */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                showSettings
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Settings size={15} />
              <span>{showSettings ? 'Tutup Pengaturan' : 'Pengaturan Cetak'}</span>
            </button>

            {/* Interactive Preview Button */}
            <button
              onClick={() => setShowPreviewModal(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Eye size={15} />
              <span>Pratinjau Cetak</span>
            </button>

            {/* High-Performance Vector PDF Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-500/20 transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Unduh PDF Vektor Resolusi Tinggi (Teks Tajam)"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>Unduh PDF Vektor</span>
                </>
              )}
            </button>

            {/* Dedicated Print Button */}
            <button
              onClick={handleDedicatedPrint}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer size={15} />
              <span>Cetak Dokumen</span>
            </button>
          </div>
        </div>

        {/* Student Selector Row with Quick Filter and Navigation */}
        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Filter Kelas */}
            <div className="flex items-center space-x-2 shrink-0">
              <label className="text-xs font-bold text-slate-700">Kelas:</label>
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:bg-white focus:outline-hidden"
              >
                <option value="all">Semua Kelas 9 ({kelas9Students.length})</option>
                {availableKelasList.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                value={searchSiswa}
                onChange={(e) => setSearchSiswa(e.target.value)}
                placeholder="Cari siswa kelas 9 (nama / NISN)..."
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Prev/Next Buttons */}
            <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
              <button
                onClick={handlePrevStudent}
                disabled={selectedIndex <= 0}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed"
                title="Siswa Sebelumnya"
              >
                <ChevronLeft size={14} />
                <span className="hidden sm:inline">Sebelumnya</span>
              </button>

              <span className="text-xs font-extrabold text-slate-600 px-2 py-1 bg-slate-100 rounded-lg">
                {selectedIndex + 1} / {kelas9Students.length}
              </span>

              <button
                onClick={handleNextStudent}
                disabled={selectedIndex >= kelas9Students.length - 1}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed"
                title="Siswa Berikutnya"
              >
                <span className="hidden sm:inline">Berikutnya</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-700 shrink-0">
              Pilih Siswa:
            </label>
            <select
              value={selectedSiswaId}
              onChange={(e) => setSelectedSiswaId(e.target.value)}
              className="flex-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
            >
              {filteredStudents.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  {idx + 1}. {s.nama} ({s.nisn ? `NISN: ${s.nisn}` : `Kelas ${s.kodeKelas}`})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Expandable Settings Drawer */}
        {showSettings && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            {/* Setting Tabs */}
            <div className="flex border-b border-slate-200 space-x-2 text-xs font-bold overflow-x-auto">
              <button
                onClick={() => setActiveTab('kop')}
                className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'kop'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <School size={14} />
                <span>Kop Surat (Pengaturan Sekolah)</span>
              </button>

              <button
                onClick={() => setActiveTab('surat')}
                className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'surat'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText size={14} />
                <span>Nomor Surat & Pejabat</span>
              </button>

              <button
                onClick={() => setActiveTab('layout')}
                className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'layout'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sliders size={14} />
                <span>Font, Kertas & Margin</span>
              </button>

              <button
                onClick={() => setActiveTab('mapel')}
                className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'mapel'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckSquare size={14} />
                <span>Pilih Mapel ({printableMapels.length}/{sortedMapels.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('masal')}
                className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'masal'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users size={14} />
                <span>Cetak Masal / Batch PDF</span>
              </button>
            </div>

            {/* TAB 0: KOP SURAT */}
            {activeTab === 'kop' && (
              <div className="space-y-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="font-extrabold text-slate-900 flex items-center space-x-1.5">
                      <School size={16} className="text-blue-600" />
                      <span>Sinkronisasi Kop Surat dari Pengaturan Sekolah</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Terhubung dengan data profil: <strong>{appState.sekolah.namaSekolah || 'Sekolah'}</strong>.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold text-slate-600">Model Kop:</span>
                    <button
                      type="button"
                      onClick={() => setKopType('banner')}
                      className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        kopType === 'banner'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      Banner Kop Gambar
                    </button>
                    <button
                      type="button"
                      onClick={() => setKopType('text')}
                      className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        kopType === 'text'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      Kop Teks Resmi
                    </button>
                  </div>
                </div>

                {/* Status Kop Banner */}
                {kopType === 'banner' && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        Pratinjau Banner Kop ({appState.sekolah.kopSekolahUrl ? 'Tersedia' : 'Belum Ada'})
                      </span>
                    </div>
                    {appState.sekolah.kopSekolahUrl ? (
                      <div className="p-2 border border-dashed border-slate-300 rounded-lg bg-slate-50 text-center">
                        <img
                          src={appState.sekolah.kopSekolahUrl}
                          alt="Banner Kop Sekolah"
                          className="max-h-24 mx-auto object-contain"
                        />
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 text-center font-medium">
                        Kop banner belum diunggah di Pengaturan Profil Sekolah. Anda dapat mengunggahnya di Pengaturan Profil Sekolah atau menggunakan Kop Teks Resmi.
                      </div>
                    )}
                  </div>
                )}

                {/* Pengaturan Kop Teks & Logo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-200">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLogoLeft}
                      onChange={(e) => setShowLogoLeft(e.target.checked)}
                      className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-700">Logo Kiri (Pemda)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLogoRight}
                      onChange={(e) => setShowLogoRight(e.target.checked)}
                      className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-700">Logo Kanan (Sekolah)</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showStempel}
                      onChange={(e) => setShowStempel(e.target.checked)}
                      className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-700">Stempel Sekolah</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTtdKepsek}
                      onChange={(e) => setShowTtdKepsek(e.target.checked)}
                      className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-700">Tanda Tangan Digital</span>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 1: FIELD SURAT & PEJABAT */}
            {activeTab === 'surat' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nomor Surat SKNR
                  </label>
                  <input
                    type="text"
                    value={noSurat}
                    onChange={(e) => setNoSurat(e.target.value)}
                    className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                    placeholder="e.g. 421.3/SKNR/2026/001"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tempat TTD
                  </label>
                  <input
                    type="text"
                    value={tempatTtd}
                    onChange={(e) => setTempatTtd(e.target.value)}
                    className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                    placeholder="e.g. Banyumas"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal TTD Surat
                  </label>
                  <input
                    type="text"
                    value={tanggalTtd}
                    onChange={(e) => setTanggalTtd(e.target.value)}
                    className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                    placeholder="e.g. 13 Agustus 2026"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    value={namaKepalaSekolah}
                    onChange={(e) => setNamaKepalaSekolah(e.target.value)}
                    className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    NIP Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    value={nipKepalaSekolah}
                    onChange={(e) => setNipKepalaSekolah(e.target.value)}
                    className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jabatan Pejabat
                  </label>
                  <input
                    type="text"
                    value={jabatanKepalaSekolah}
                    onChange={(e) => setJabatanKepalaSekolah(e.target.value)}
                    className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: FONT, KERTAS & MARGIN */}
            {activeTab === 'layout' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Bentuk Huruf (Font Family)
                    </label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value as any)}
                      className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                    >
                      <option value="Times New Roman">Times New Roman (Serif Resmi)</option>
                      <option value="Arial">Arial (Sans-Serif Bersih)</option>
                      <option value="Calibri">Calibri (Modern)</option>
                      <option value="Bookman Old Style">Bookman Old Style (Klasik)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ukuran Huruf Dokumen
                    </label>
                    <select
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value)}
                      className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                    >
                      <option value="10pt">10 pt (Kecil Padat)</option>
                      <option value="11pt">11 pt (Standar Resmi)</option>
                      <option value="12pt">12 pt (Sedang)</option>
                      <option value="13pt">13 pt (Besar)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ukuran Kertas Cetak
                    </label>
                    <select
                      value={paperSize}
                      onChange={(e) => setPaperSize(e.target.value as any)}
                      className="w-full font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                    >
                      <option value="A4">A4 (210 x 297 mm)</option>
                      <option value="F4">F4 / Folio (215 x 330 mm)</option>
                      <option value="Letter">Letter (216 x 279 mm)</option>
                      <option value="Legal">Legal (216 x 356 mm)</option>
                    </select>
                  </div>
                </div>

                {/* Margin Inputs */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Pengaturan Margin Cetak (Milimeter / mm)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Margin Atas (Top)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={50}
                        value={margins.top}
                        onChange={(e) =>
                          setMargins({ ...margins, top: Math.max(0, parseInt(e.target.value) || 0) })
                        }
                        className="w-full font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Margin Bawah (Bottom)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={50}
                        value={margins.bottom}
                        onChange={(e) =>
                          setMargins({ ...margins, bottom: Math.max(0, parseInt(e.target.value) || 0) })
                        }
                        className="w-full font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Margin Kiri (Left)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={50}
                        value={margins.left}
                        onChange={(e) =>
                          setMargins({ ...margins, left: Math.max(0, parseInt(e.target.value) || 0) })
                        }
                        className="w-full font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Margin Kanan (Right)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={50}
                        value={margins.right}
                        onChange={(e) =>
                          setMargins({ ...margins, right: Math.max(0, parseInt(e.target.value) || 0) })
                        }
                        className="w-full font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PILIH MAPEL */}
            {activeTab === 'mapel' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">
                    Pilih Mata Pelajaran yang Akan Ditampilkan pada Tabel SKNR:
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleSelectAllMapel}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[11px] border border-blue-200 transition-colors cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllMapel}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] border border-slate-200 transition-colors cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-56 overflow-y-auto">
                  {sortedMapels.map((m) => {
                    const isChecked = selectedMapelIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center space-x-2 p-2 rounded-lg border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-white border-blue-300 text-slate-900 font-bold shadow-2xs'
                            : 'bg-slate-100/60 border-slate-200 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleMapel(m.id)}
                          className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <span className="truncate">{m.namaMapel}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: BATCH / CETAK MASAL */}
            {activeTab === 'masal' && (
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-3 text-xs">
                <div className="flex items-center space-x-2 text-rose-900 font-extrabold text-sm">
                  <Users size={18} className="text-rose-600" />
                  <span>Cetak Masal / Export Semua SKNR Siswa Kelas 9 ({kelas9Students.length} Siswa)</span>
                </div>
                <p className="text-rose-700 leading-relaxed">
                  Fitur ini akan menyusun seluruh lembar SKNR dari semua siswa kelas 9 yang aktif ke dalam <strong>1 file PDF master</strong> (masing-masing siswa menempati 1 halaman dengan nomor surat terurut).
                </p>

                <div className="pt-2 flex items-center space-x-3">
                  <button
                    onClick={handleBatchDownloadPdf}
                    disabled={isBatchGenerating || kelas9Students.length === 0}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    {isBatchGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Membuat {batchProgress?.current}/{batchProgress?.total} Dokumen...</span>
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        <span>Unduh Master PDF ({kelas9Students.length} Siswa)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* INSPECTABLE PRINTABLE SKNR DOCUMENT SHEET */}
      <div
        id="sknr-document-to-print"
        className="sknr-document-sheet bg-white p-8 md:p-12 rounded-2xl border border-slate-200 shadow-xl print:shadow-none print:border-none print:p-0 text-black leading-relaxed"
        style={{
          fontFamily: getFontFamilyCss(),
          fontSize: fontSize,
        }}
      >
        {/* KOP SURAT SECTION (TANPA GARIS DI BAWAH KOP) */}
        {kopType === 'banner' && appState.sekolah.kopSekolahUrl ? (
          <div className="pb-2 mb-4 text-center">
            <img
              src={appState.sekolah.kopSekolahUrl}
              alt="Kop Surat Sekolah"
              className="w-full max-h-36 object-contain mx-auto"
            />
          </div>
        ) : (
          <div className="pb-2 mb-4">
            <div className="flex items-center justify-between gap-2 text-center pb-1">
              {/* Left Logo (Logo Pemda) */}
              {showLogoLeft && (
                <div className="w-20 shrink-0 flex items-center justify-center">
                  {(appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl) ? (
                    <img
                      src={appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl}
                      alt="Logo Pemda"
                      className="max-h-20 max-w-full object-contain"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-400 flex items-center justify-center text-slate-700 font-bold text-[9px] text-center p-1">
                      LOGO PEMDA
                    </div>
                  )}
                </div>
              )}

              {/* Center Kop Text */}
              <div className="flex-1 space-y-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wider leading-tight">
                  {appState.sekolah.pemerintahDaerah?.toUpperCase() || `PEMERINTAH KABUPATEN ${appState.sekolah.kabupatenKota?.toUpperCase() || 'BANYUMAS'}`}
                </h3>
                <h1 className="text-sm md:text-base font-black uppercase tracking-wide leading-tight">
                  {appState.sekolah.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN'}
                </h1>
                {appState.sekolah.alamatLengkapKop ? (
                  <p className="text-[10px] md:text-[11px] leading-relaxed font-medium whitespace-pre-line text-slate-800">
                    {appState.sekolah.alamatLengkapKop}
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] md:text-[11px] leading-tight font-medium">
                      {appState.sekolah.alamat || 'Karangsalam'}
                      {appState.sekolah.telepon ? ` Telp: ${appState.sekolah.telepon}` : ''}
                      {appState.sekolah.kecamatan ? ` ${appState.sekolah.kecamatan}` : ''}
                      {appState.sekolah.kabupatenKota ? ` ${appState.sekolah.kabupatenKota}` : ''}
                      {appState.sekolah.kodePos ? ` Pos: ${appState.sekolah.kodePos}` : ''}
                    </p>
                    {appState.sekolah.email && (
                      <p className="text-[10px] md:text-[11px] leading-tight font-medium text-blue-900 underline">
                        email : {appState.sekolah.email}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Right Logo (Sekolah) */}
              {showLogoRight && (
                <div className="w-20 shrink-0 flex items-center justify-center">
                  {(appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl) ? (
                    <img
                      src={appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl}
                      alt="Logo Sekolah"
                      className="max-h-20 max-w-full object-contain"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-400 flex items-center justify-center text-slate-700 font-bold text-[9px] text-center p-1">
                      LOGO SEKOLAH
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

        {/* Title Block */}
        <div className="text-center mb-4 space-y-0.5">
          <h2 className="text-sm md:text-base font-black uppercase tracking-wide">
            SURAT KETERANGAN NILAI RAPOR
          </h2>
          <p className="text-xs font-medium">
            Nomor : {noSurat}
          </p>
        </div>

        {/* Pejabat Section */}
        <div className="text-xs space-y-1 mb-3">
          <p className="mb-1">Yang bertanda tangan di bawah ini :</p>
          <div className="grid grid-cols-[110px_12px_1fr] pl-4">
            <span>Nama</span>
            <span>:</span>
            <span className="font-bold">{namaKepalaSekolah}</span>
          </div>
          <div className="grid grid-cols-[110px_12px_1fr] pl-4">
            <span>NIP</span>
            <span>:</span>
            <span>{nipKepalaSekolah}</span>
          </div>
          <div className="grid grid-cols-[110px_12px_1fr] pl-4">
            <span>Jabatan</span>
            <span>:</span>
            <span>{jabatanKepalaSekolah}</span>
          </div>
          <div className="grid grid-cols-[110px_12px_1fr] pl-4">
            <span>NPSN</span>
            <span>:</span>
            <span>{npsnSekolah}</span>
          </div>
        </div>

        {/* Siswa Section */}
        <div className="text-xs space-y-1 mb-4">
          <p className="mb-1">Menerangkan Nilai Rapor :</p>
          <div className="grid grid-cols-[110px_12px_1fr] pl-4">
            <span>Nama</span>
            <span>:</span>
            <span className="font-bold uppercase">{selectedSiswa?.nama || '-'}</span>
          </div>
          <div className="grid grid-cols-[110px_12px_1fr] pl-4">
            <span>NISN</span>
            <span>:</span>
            <span>{selectedSiswa?.nisn || '-'}</span>
          </div>
        </div>

        {/* Tabel Nilai SKNR */}
        <table className="w-full text-xs border-collapse border border-black my-4">
          <thead>
            <tr className="bg-slate-50 text-center font-bold border-b border-black uppercase">
              <th rowSpan={2} className="border border-black p-1.5 w-8">
                No
              </th>
              <th rowSpan={2} className="border border-black p-1.5 text-left min-w-[160px]">
                MATA PELAJARAN
              </th>
              <th colSpan={5} className="border border-black p-1.5">
                NILAI RAPOR SEMESTER
              </th>
              <th
                rowSpan={2}
                className="border border-black p-1.5 w-28 text-center leading-tight"
              >
                Rata Rata<br />Nilai<br />Semester I-V
              </th>
            </tr>
            <tr className="bg-slate-50 text-center font-bold border-b border-black uppercase text-[10px]">
              <th className="border border-black p-1 w-12">SMT I</th>
              <th className="border border-black p-1 w-12">SMT II</th>
              <th className="border border-black p-1 w-12">SMT III</th>
              <th className="border border-black p-1 w-12">SMT IV</th>
              <th className="border border-black p-1 w-12">SMT V</th>
            </tr>
          </thead>

          <tbody>
            {currentRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-slate-400 italic">
                  Belum ada nilai mata pelajaran yang terisi (nilai 0 / belum diinput pada menu Input Nilai K9).
                </td>
              </tr>
            ) : (
              currentRows.map((r) => (
                <tr key={r.no} className="border-b border-black">
                  <td className="border border-black p-1.5 text-center">{r.no}</td>
                  <td className="border border-black p-1.5">{r.namaMapel}</td>
                  <td className="border border-black p-1.5 text-center">{r.s1}</td>
                  <td className="border border-black p-1.5 text-center">{r.s2}</td>
                  <td className="border border-black p-1.5 text-center">{r.s3}</td>
                  <td className="border border-black p-1.5 text-center">{r.s4}</td>
                  <td className="border border-black p-1.5 text-center">{r.s5}</td>
                  <td className="border border-black p-1.5 text-center font-bold">{r.avg}</td>
                </tr>
              ))
            )}

            {/* RERATA TOTAL */}
            <tr className="font-bold border-t-2 border-black bg-slate-50 uppercase text-center">
              <td colSpan={2} className="border border-black p-1.5 text-center font-bold">
                RERATA TOTAL
              </td>
              <td className="border border-black p-1.5">{colAvgs.avgS1}</td>
              <td className="border border-black p-1.5">{colAvgs.avgS2}</td>
              <td className="border border-black p-1.5">{colAvgs.avgS3}</td>
              <td className="border border-black p-1.5">{colAvgs.avgS4}</td>
              <td className="border border-black p-1.5">{colAvgs.avgS5}</td>
              <td className="border border-black p-1.5 font-black">{colAvgs.avgOverall}</td>
            </tr>
          </tbody>
        </table>

        {/* Closing Paragraph */}
        <p className="text-xs leading-relaxed my-4">
          Demikian Surat Keterangan ini dibuat untuk dapat dipergunakan dengan semestinya, dan kepada yang berkepentingan untuk menjadikan maklum.
        </p>

        {/* Signatures Section with Stempel & TTD */}
        <div className="flex justify-end text-xs mt-6 pt-2">
          <div className="text-left w-64 space-y-1 relative">
            <p>
              {tempatTtd}, {tanggalTtd}
            </p>
            <p>Kepala Sekolah,</p>

            <div className="h-16 relative flex items-center">
              {/* Optional Stempel */}
              {showStempel && appState.sekolah.stempelUrl && (
                <img
                  src={appState.sekolah.stempelUrl}
                  alt="Stempel Sekolah"
                  className="absolute left-[-20px] top-[-10px] w-20 h-20 object-contain opacity-80 pointer-events-none"
                />
              )}

              {/* Optional TTD Kepala Sekolah */}
              {showTtdKepsek && appState.sekolah.ttdKepalaSekolahUrl && (
                <img
                  src={appState.sekolah.ttdKepalaSekolahUrl}
                  alt="TTD Kepala Sekolah"
                  className="absolute left-4 top-0 max-h-16 object-contain pointer-events-none"
                />
              )}
            </div>

            <p className="font-bold underline uppercase">{namaKepalaSekolah}</p>
            <p>NIP {nipKepalaSekolah}</p>
          </div>
        </div>
      </div>

      {/* FULLSCREEN REALISTIC PRINT PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col no-print animate-in fade-in">
          {/* Modal Header Toolbar */}
          <div className="bg-slate-900 text-white px-4 md:px-6 py-3.5 flex flex-wrap items-center justify-between border-b border-slate-700 gap-3 shrink-0">
            <div className="flex items-center space-x-3">
              <Eye size={20} className="text-blue-400 shrink-0" />
              <div>
                <h3 className="text-xs md:text-sm font-extrabold flex items-center space-x-2">
                  <span>Pratinjau Cetak:</span>
                  <span className="text-blue-300 font-bold">{selectedSiswa?.nama}</span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Ukuran: {paperSize} ({getPaperDimensionsCss()}) • Font: {fontFamily} {fontSize}
                </p>
              </div>
            </div>

            {/* Quick Actions in Modal Header */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center space-x-1 bg-slate-800 rounded-xl px-2 py-1 border border-slate-700 text-xs">
                <button
                  onClick={() => setPreviewZoom(Math.max(40, previewZoom - 15))}
                  className="p-1 text-slate-300 hover:text-white cursor-pointer"
                  title="Perkecil"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="px-1 text-[11px] font-bold text-slate-200 min-w-[42px] text-center">
                  {previewZoom}%
                </span>
                <button
                  onClick={() => setPreviewZoom(Math.min(160, previewZoom + 15))}
                  className="p-1 text-slate-300 hover:text-white cursor-pointer"
                  title="Perbesar"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={() => setPreviewZoom(100)}
                  className="text-[10px] text-slate-400 hover:text-white pl-1.5 border-l border-slate-700 cursor-pointer"
                >
                  100%
                </button>
              </div>

              {/* Prev / Next Student */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={handlePrevStudent}
                  disabled={selectedIndex <= 0}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  title="Siswa Sebelumnya"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[11px] font-mono text-slate-300 px-1">
                  {selectedIndex + 1}/{kelas9Students.length}
                </span>
                <button
                  onClick={handleNextStudent}
                  disabled={selectedIndex >= kelas9Students.length - 1}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  title="Siswa Berikutnya"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Direct Vector PDF Download */}
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-md shadow-rose-600/20"
              >
                {isGeneratingPdf ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                <span>Unduh PDF</span>
              </button>

              {/* Direct Print */}
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setTimeout(() => handleDedicatedPrint(), 200);
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-md shadow-blue-600/20"
              >
                <Printer size={13} />
                <span>Cetak</span>
              </button>

              {/* Close Modal */}
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Tutup Pratinjau"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Preview Canvas Sheet */}
          <div className="flex-1 overflow-auto p-4 md:p-8 flex items-start justify-center bg-slate-950/85">
            <div
              style={{
                transform: `scale(${previewZoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
                width: paperSize === 'F4' ? '215mm' : '210mm',
                minHeight: paperSize === 'F4' ? '330mm' : '297mm',
              }}
              className="bg-white text-black p-10 md:p-12 shadow-2xl rounded-xs border border-slate-300 relative mx-auto my-4 text-black shrink-0"
            >
              {/* Paper Watermark Info */}
              <div className="absolute top-2 right-3 text-[9px] text-slate-400 font-mono select-none">
                PRATINJAU CETAK SKNR • {paperSize} • {selectedSiswa?.nama}
              </div>

              {/* KOP DI PRATINJAU */}
              {kopType === 'banner' && appState.sekolah.kopSekolahUrl ? (
                <div className="pb-1 text-center">
                  <img
                    src={appState.sekolah.kopSekolahUrl}
                    alt="Kop Surat Sekolah"
                    className="w-full max-h-36 object-contain mx-auto"
                  />
                </div>
              ) : (
                <div className="pb-1">
                  <div className="flex items-center justify-between gap-2 text-center pb-1">
                    {showLogoLeft && (
                      <div className="w-16 shrink-0 flex items-center justify-center">
                        {(appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl) ? (
                          <img
                            src={appState.sekolah.logoPemdaUrl || appState.sekolah.logoUrl}
                            alt="Logo Pemda"
                            className="max-h-16 max-w-full object-contain"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-400 flex items-center justify-center text-slate-700 font-bold text-[8px] text-center p-1">
                            LOGO PEMDA
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex-1 space-y-0.5">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider leading-tight">
                        {appState.sekolah.pemerintahDaerah?.toUpperCase() || `PEMERINTAH KABUPATEN ${appState.sekolah.kabupatenKota?.toUpperCase() || 'BANYUMAS'}`}
                      </h3>
                      <h1 className="text-sm font-black uppercase tracking-wide leading-tight">
                        {appState.sekolah.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN'}
                      </h1>
                      {appState.sekolah.alamatLengkapKop ? (
                        <p className="text-[9px] leading-relaxed font-medium whitespace-pre-line text-slate-800">
                          {appState.sekolah.alamatLengkapKop}
                        </p>
                      ) : (
                        <>
                          <p className="text-[9px] leading-tight font-medium">
                            {appState.sekolah.alamat || 'Karangsalam'}
                            {appState.sekolah.telepon ? ` Telp: ${appState.sekolah.telepon}` : ''}
                            {appState.sekolah.kecamatan ? ` ${appState.sekolah.kecamatan}` : ''}
                            {appState.sekolah.kabupatenKota ? ` ${appState.sekolah.kabupatenKota}` : ''}
                            {appState.sekolah.kodePos ? ` Pos: ${appState.sekolah.kodePos}` : ''}
                          </p>
                          {appState.sekolah.email && (
                            <p className="text-[9px] leading-tight font-medium text-blue-900 underline">
                              email : {appState.sekolah.email}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {showLogoRight && (
                      <div className="w-16 shrink-0 flex items-center justify-center">
                        {(appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl) ? (
                          <img
                            src={appState.sekolah.logoUrl || appState.sekolah.kopSekolahUrl}
                            alt="Logo Sekolah"
                            className="max-h-16 max-w-full object-contain"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-400 flex items-center justify-center text-slate-700 font-bold text-[8px] text-center p-1">
                            LOGO
                          </div>
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

              {/* Title */}
              <div className="text-center mb-3 space-y-0.5">
                <h2 className="text-sm font-black uppercase tracking-wide">
                  SURAT KETERANGAN NILAI RAPOR
                </h2>
                <p className="text-[11px] font-medium">
                  Nomor : {noSurat}
                </p>
              </div>

              {/* Pejabat */}
              <div className="text-[11px] space-y-0.5 mb-2">
                <p>Yang bertanda tangan di bawah ini :</p>
                <div className="grid grid-cols-[100px_10px_1fr] pl-3">
                  <span>Nama</span><span>:</span><span className="font-bold">{namaKepalaSekolah}</span>
                </div>
                <div className="grid grid-cols-[100px_10px_1fr] pl-3">
                  <span>NIP</span><span>:</span><span>{nipKepalaSekolah}</span>
                </div>
                <div className="grid grid-cols-[100px_10px_1fr] pl-3">
                  <span>Jabatan</span><span>:</span><span>{jabatanKepalaSekolah}</span>
                </div>
                <div className="grid grid-cols-[100px_10px_1fr] pl-3">
                  <span>NPSN</span><span>:</span><span>{npsnSekolah}</span>
                </div>
              </div>

              {/* Siswa */}
              <div className="text-[11px] space-y-0.5 mb-3">
                <p>Menerangkan Nilai Rapor :</p>
                <div className="grid grid-cols-[100px_10px_1fr] pl-3">
                  <span>Nama</span><span>:</span><span className="font-bold uppercase">{selectedSiswa?.nama || '-'}</span>
                </div>
                <div className="grid grid-cols-[100px_10px_1fr] pl-3">
                  <span>NISN</span><span>:</span><span>{selectedSiswa?.nisn || '-'}</span>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-[10px] border-collapse border border-black my-2">
                <thead>
                  <tr className="bg-slate-50 text-center font-bold border-b border-black uppercase">
                    <th rowSpan={2} className="border border-black p-1 w-6">No</th>
                    <th rowSpan={2} className="border border-black p-1 text-left min-w-[140px]">MATA PELAJARAN</th>
                    <th colSpan={5} className="border border-black p-1">NILAI RAPOR SEMESTER</th>
                    <th rowSpan={2} className="border border-black p-1 w-24 text-center leading-tight">
                      Rata Rata<br />Semester I-V
                    </th>
                  </tr>
                  <tr className="bg-slate-50 text-center font-bold border-b border-black uppercase text-[9px]">
                    <th className="border border-black p-0.5 w-10">SMT I</th>
                    <th className="border border-black p-0.5 w-10">SMT II</th>
                    <th className="border border-black p-0.5 w-10">SMT III</th>
                    <th className="border border-black p-0.5 w-10">SMT IV</th>
                    <th className="border border-black p-0.5 w-10">SMT V</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-black p-3 text-center text-slate-500 italic">
                        Belum ada nilai mata pelajaran yang terisi (nilai 0 / belum diinput pada menu Input Nilai K9).
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((r) => (
                      <tr key={r.no} className="border-b border-black">
                        <td className="border border-black p-1 text-center">{r.no}</td>
                        <td className="border border-black p-1">{r.namaMapel}</td>
                        <td className="border border-black p-1 text-center">{r.s1}</td>
                        <td className="border border-black p-1 text-center">{r.s2}</td>
                        <td className="border border-black p-1 text-center">{r.s3}</td>
                        <td className="border border-black p-1 text-center">{r.s4}</td>
                        <td className="border border-black p-1 text-center">{r.s5}</td>
                        <td className="border border-black p-1 text-center font-bold">{r.avg}</td>
                      </tr>
                    ))
                  )}
                  <tr className="font-bold border-t-2 border-black bg-slate-50 uppercase text-center">
                    <td colSpan={2} className="border border-black p-1 text-center font-bold">
                      RERATA TOTAL
                    </td>
                    <td className="border border-black p-1">{colAvgs.avgS1}</td>
                    <td className="border border-black p-1">{colAvgs.avgS2}</td>
                    <td className="border border-black p-1">{colAvgs.avgS3}</td>
                    <td className="border border-black p-1">{colAvgs.avgS4}</td>
                    <td className="border border-black p-1">{colAvgs.avgS5}</td>
                    <td className="border border-black p-1 font-black">{colAvgs.avgOverall}</td>
                  </tr>
                </tbody>
              </table>

              {/* Closing */}
              <p className="text-[10px] leading-relaxed my-3">
                Demikian Surat Keterangan ini dibuat untuk dapat dipergunakan dengan semestinya, dan kepada yang berkepentingan untuk menjadikan maklum.
              </p>

              {/* Signatures */}
              <div className="flex justify-end text-[10px] mt-4">
                <div className="text-left w-56 space-y-0.5">
                  <p>{tempatTtd}, {tanggalTtd}</p>
                  <p>Kepala Sekolah,</p>
                  <div className="h-14 flex items-center relative">
                    {showStempel && appState.sekolah.stempelUrl && (
                      <img
                        src={appState.sekolah.stempelUrl}
                        alt="Stempel"
                        className="absolute left-[-15px] top-[-5px] w-16 h-16 object-contain opacity-80 pointer-events-none"
                      />
                    )}
                    {showTtdKepsek && appState.sekolah.ttdKepalaSekolahUrl && (
                      <img
                        src={appState.sekolah.ttdKepalaSekolahUrl}
                        alt="TTD"
                        className="absolute left-2 top-0 max-h-12 object-contain pointer-events-none"
                      />
                    )}
                  </div>
                  <p className="font-bold underline uppercase">{namaKepalaSekolah}</p>
                  <p>NIP {nipKepalaSekolah}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
