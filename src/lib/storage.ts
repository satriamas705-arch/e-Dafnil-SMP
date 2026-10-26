import { AppState, NotificationLog, AuthUser, NilaiKelas9 } from '../types';
import { initialAppState } from '../data/initialData';

const STORAGE_KEY = 'sipenis_app_state_v1';
const AUTH_KEY = 'simpegur_auth_user_v1';

export function loadAuthUser(): AuthUser | null {
  try {
    const saved = localStorage.getItem(AUTH_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load auth user', e);
    return null;
  }
}

export function saveAuthUser(user: AuthUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(AUTH_KEY);
    } else {
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    }
  } catch (e) {
    console.error('Failed to save auth user', e);
  }
}

export function loadAppState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialAppState;
    const parsed = JSON.parse(saved);

    // Ensure all initial kelas 9 students have entries and complete k9DetailMapel
    const storedK9: NilaiKelas9[] = parsed.nilaiKelas9List || [];
    const mergedK9 = initialAppState.nilaiKelas9List.map((initialItem) => {
      const existing = storedK9.find((s) => s.siswaId === initialItem.siswaId);
      if (!existing) return initialItem;

      // Ensure k9DetailMapel is fully hydrated if missing in older saves
      const mergedDetail = { ...(initialItem.k9DetailMapel || {}), ...(existing.k9DetailMapel || {}) };
      return {
        ...initialItem,
        ...existing,
        k9DetailMapel: mergedDetail,
        nilaiRaporSem1_5: { ...(initialItem.nilaiRaporSem1_5 || {}), ...(existing.nilaiRaporSem1_5 || {}) },
        nilaiSumatifAkhir: { ...(initialItem.nilaiSumatifAkhir || {}), ...(existing.nilaiSumatifAkhir || {}) },
        nilaiSekolah: { ...(initialItem.nilaiSekolah || {}), ...(existing.nilaiSekolah || {}) },
      };
    });

    // Also include any extra custom-added grade records
    storedK9.forEach((storedItem) => {
      if (!mergedK9.some((m) => m.siswaId === storedItem.siswaId)) {
        mergedK9.push(storedItem);
      }
    });

    return {
      ...initialAppState,
      ...parsed,
      sekolah: { ...initialAppState.sekolah, ...(parsed.sekolah || {}) },
      userAccounts: parsed.userAccounts || initialAppState.userAccounts || [],
      nilaiKelas9List: mergedK9,
    };
  } catch (e) {
    console.error('Failed to load local state', e);
    return initialAppState;
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save local state', e);
  }
}

export function resetAppState(): AppState {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error(e);
  }
  return initialAppState;
}

export function createNotification(
  title: string,
  message: string,
  category: NotificationLog['category'],
  adminName = 'Administrator'
): NotificationLog {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    timestamp: `${dateStr} ${timeStr}`,
    title,
    message,
    category,
    read: false,
    adminName,
  };
}
