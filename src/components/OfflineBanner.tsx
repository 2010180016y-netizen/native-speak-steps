import { useSyncExternalStore } from "react";

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/** Explains why screens stay empty while the device has no connection (the shell itself works offline, see public/sw.js). */
const OfflineBanner = () => {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-destructive px-3 py-1.5 text-center text-xs font-bold text-destructive-foreground"
    >
      오프라인이에요. 연결되기 전에는 학습 기록과 AI 기능을 쓸 수 없어요.
    </div>
  );
};

export default OfflineBanner;
