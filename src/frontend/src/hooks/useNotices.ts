"use client";

/**
 * useNotices
 *
 * NoticesStore의 얇은 래퍼입니다.
 * 실제 데이터 fetching은 noticesStore 모듈에서 관리됩니다.
 */

import { useNoticesStore } from "@/store/noticesStore";

// Re-export type for backward compatibility
export type { NoticeItem } from "@/store/noticesStore";

export function useNotices() {
  const notices = useNoticesStore((s) => s.notices);
  const isLoading = useNoticesStore((s) => s.isLoading);
  const error = useNoticesStore((s) => s.error);
  const fetchNotices = useNoticesStore((s) => s.fetchNotices);
  const createNotice = useNoticesStore((s) => s.createNotice);
  const updateNotice = useNoticesStore((s) => s.updateNotice);
  const deleteNotice = useNoticesStore((s) => s.deleteNotice);

  const unreadCount = notices.filter((n) => !n.read).length;

  return {
    notices,
    isLoading,
    error,
    unreadCount,
    createNotice,
    updateNotice,
    deleteNotice,
    refetch: fetchNotices,
  };
}
