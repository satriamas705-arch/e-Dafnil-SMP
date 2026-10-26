export type MenuCategory = 
  | 'dashboard'
  | 'data-guru'
  | 'data-kelas'
  | 'data-mapel'
  | 'data-siswa'
  | 'input-nilai'
  | 'rekap-nilai'
  | 'input-kelas9'
  | 'cetak-sknr'
  | 'cetak-skl'
  | 'cetak-transkrip'
  | 'pengaturan-sekolah'
  | 'tahun-ajaran'
  | 'backup-restore'
  | 'ubah-password';

export interface Guru {
  id: string;
  nip: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  email: string;
  noHp: string;
  fotoUrl?: string; // Teacher profile photo base64 or URL
  mapelAmpuanIds: string[];
  kelasAmpuanIds: string[];
}

export interface Kelas {
  id: string;
  kodeKelas: string; // e.g. "7A", "8A", "9A"
  namaKelas: string; // e.g. "Kelas 7A"
  tingkat: number; // 7, 8, 9
  waliKelasId: string; // Guru id
  waliKelasNama: string;
  tahunAjaran: string;
}

export interface Mapel {
  id: string;
  kodeMapel: string; // e.g. "MTK", "BIN", "IPA"
  namaMapel: string;
  urutan?: number; // Urutan mapel untuk transkrip nilai (e.g. 1, 2, 3)
  kelompok?: 'Kelompok A (Wajib)' | 'Kelompok B (Wajib)' | 'Muatan Lokal';
  kkm?: number; // e.g. 75
  jamPerMinggu?: number;
}

export interface Siswa {
  id: string;
  nis: string;
  nisn: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  agama: string; // e.g. "Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Khonghucu"
  kelasId: string;
  kodeKelas: string;
  tempatLahir: string;
  tanggalLahir: string; // YYYY-MM-DD
  status: 'Aktif' | 'Lulus' | 'Pindah' | 'Keluar';
  noPesertaUjian?: string;
  noIjazah?: string;
  tanggalIjazah?: string;
  tanggalKelulusan?: string;
}

export interface ClassSumatifConfig {
  jumlahSumatif: number;
  bobotS: number;
  bobotSTS: number;
  bobotSAS: number;
}

export interface NilaiSumatif {
  id: string;
  siswaId: string;
  mapelId: string;
  kelasId: string;
  tahunAjaran: string;
  semester: 'Ganjil' | 'Genap';
  tp1?: number; // Tujuan Pembelajaran 1
  tp2?: number; // Tujuan Pembelajaran 2
  tp3?: number; // Tujuan Pembelajaran 3
  tps?: number[]; // Array of dynamic sumatif scores [S1, S2, S3, ...]
  [key: string]: any; // Allow dynamic tp4, tp5, etc.
  sts?: number; // Sumatif Tengah Semester
  sas?: number; // Sumatif Akhir Semester
  bobotS?: number;
  bobotSTS?: number;
  bobotSAS?: number;
  jumlahSumatif?: number;
  nilaiAkhir: number;
  catatan?: string;
  updatedAt: string;
}

export interface K9MapelDetail {
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  s6: number;
  usTulis: number;
  usPraktik: number;
}

export interface NilaiKelas9 {
  id: string;
  siswaId: string;
  tahunAjaran: string;
  // Nilai Rata-rata Rapor Semester 1 s/d 6 per mapel or overall
  nilaiRaporSem1_5: Record<string, number>; // mapelId -> nilai
  nilaiSumatifAkhir: Record<string, number>; // mapelId -> nilai ujian/sumatif akhir
  nilaiSekolah: Record<string, number>; // mapelId -> nilai gabungan
  k9DetailMapel?: Record<string, K9MapelDetail>; // mapelId -> detail S1..S6, US Tulis, US Praktik
  rataRataKeseluruhan: number;
  statusLulus: 'LULUS' | 'TIDAK LULUS' | 'DIPERTIMBANGKAN';
  noSuratSKL?: string;
  noSuratSKNR?: string;
  noSuratTranskrip?: string;
  noIjazah?: string;
  tanggalIjazah?: string;
  tanggalKelulusan?: string;
  updatedAt: string;
}

export interface PengaturanSekolah {
  namaSekolah: string;
  npsn: string;
  nseri: string;
  alamat: string;
  desaKelurahan: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi: string;
  kodePos: string;
  telepon: string;
  email: string;
  website: string;
  namaKepalaSekolah: string;
  nipKepalaSekolah: string;
  tanggalSurat: string; // e.g. "15 Juni 2026"
  logoUrl?: string;
  logoPemdaUrl?: string; // Logo Pemerintah Daerah (Kiri)
  kopSekolahUrl?: string;
  stempelUrl?: string;
  ttdKepalaSekolahUrl?: string;
  adminFotoUrl?: string; // Administrator avatar photo
  fotoLoginUrl?: string; // Foto background dan galeri halaman login
  sistemHariSekolah?: string; // e.g. "5 Hari (Senin - Jumat)" | "6 Hari (Senin - Sabtu)"
  pemerintahDaerah?: string; // e.g. "PEMERINTAH KABUPATEN BANYUMAS"
  alamatLengkapKop?: string; // e.g. "Karangsalam ✆ 08112627753 Kemranjen Banyumas ✉ 53194\nEmail : smpn2.kemranjen@banyumaskab.go.id"
}

export interface TahunAjaranConfig {
  id: string;
  tahun: string; // e.g. "2025/2026"
  semester: 'Ganjil' | 'Genap';
  isAktif: boolean;
  statusSemester: 'Aktif' | 'Terkunci';
}

export interface NotificationLog {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  category: 'data-guru' | 'data-kelas' | 'data-mapel' | 'data-siswa' | 'nilai' | 'pengaturan' | 'kelas9';
  read: boolean;
  adminName: string;
}

export interface AuthUser {
  role: 'admin' | 'guru';
  username: string;
  nama: string;
  nip?: string;
  guruId?: string;
  fotoUrl?: string; // User profile photo
  tahunAjaran: string;
  semester: 'Ganjil' | 'Genap';
  loggedInAt: string;
}

export interface UserAccount {
  id: string; // 'admin' or `acc-${guruId}`
  role: 'admin' | 'guru';
  username: string; // 'admin' or NIP / custom username
  nama: string;
  password: string; // Plain password stored locally for school assessment system
  guruId?: string; // Associated guru id if role === 'guru'
  nip?: string;
  fotoUrl?: string; // Profile photo
  updatedAt: string;
}

export interface AppState {
  sekolah: PengaturanSekolah;
  tahunAjaranList: TahunAjaranConfig[];
  activeTahunAjaranId: string;
  guruList: Guru[];
  kelasList: Kelas[];
  mapelList: Mapel[];
  siswaList: Siswa[];
  nilaiSumatifList: NilaiSumatif[];
  nilaiKelas9List: NilaiKelas9[];
  notifications: NotificationLog[];
  userAccounts?: UserAccount[];
  sumatifConfigByClass?: Record<string, ClassSumatifConfig>;
}
