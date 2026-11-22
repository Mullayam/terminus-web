import { create } from 'zustand';

/** UI-facing state of terminal recordings; the events themselves live in `terminal2/recorder.ts`. */
export interface RecordingStatus {
  isRecording: boolean;
  startedAt: number;
  eventCount: number;
  bytes: number;
}

interface RecorderState {
  status: Record<string, RecordingStatus>;
  /** Why a recording stopped on its own (size cap, tab closed, …), per session. */
  notice: Record<string, string | null>;
  /** Bumped whenever a recording is saved, so lists can reload. */
  savedVersion: number;
  setStatus: (sessionId: string, status: RecordingStatus) => void;
  setNotice: (sessionId: string, notice: string | null) => void;
  bumpSaved: () => void;
}

export const useRecorderStore = create<RecorderState>((set) => ({
  status: {},
  notice: {},
  savedVersion: 0,
  setStatus: (sessionId, status) => set((s) => ({ status: { ...s.status, [sessionId]: status } })),
  setNotice: (sessionId, notice) => set((s) => ({ notice: { ...s.notice, [sessionId]: notice } })),
  bumpSaved: () => set((s) => ({ savedVersion: s.savedVersion + 1 })),
}));
