import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * AppState: 애플리케이션 전역 상태 타입 정의
 * 필요에 따라 슬라이스를 추가해 확장하세요.
 */
interface AppState {
  /** 예시 카운터 값 */
  count: number;
  /** 카운터 증가 */
  increment: () => void;
  /** 카운터 감소 */
  decrement: () => void;
  /** 카운터 초기화 */
  reset: () => void;
}

/**
 * useAppStore
 *
 * devtools 미들웨어가 적용된 Zustand 스토어.
 * 브라우저의 Redux DevTools Extension으로 상태 변화를 추적할 수 있습니다.
 *
 * @example
 * const count = useAppStore((s) => s.count);
 * const increment = useAppStore((s) => s.increment);
 */
export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      count: 0,
      increment: () =>
        set((state) => ({ count: state.count + 1 }), false, 'increment'),
      decrement: () =>
        set((state) => ({ count: state.count - 1 }), false, 'decrement'),
      reset: () => set({ count: 0 }, false, 'reset'),
    }),
    {
      name: 'AppStore', // Redux DevTools에 표시될 스토어 이름
    },
  ),
);
