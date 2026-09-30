import { useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import { useSessionTracker } from "@/hooks/useSessionTracker";

const ROUTE_ACTIVITY_MAP: Record<string, string> = {
  "/dashboard": "general",
  "/import": "import",
  "/chat": "chat",
  "/cards": "cards",
  "/stats": "general",
  "/speaking": "speaking",
  "/profile": "general",
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const activityType = ROUTE_ACTIVITY_MAP[location.pathname] || "general";
  useSessionTracker(activityType);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 pt-4">
        {children}
      </div>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
