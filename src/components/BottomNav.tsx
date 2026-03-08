import { useLocation, Link } from "react-router-dom";
import { Home, Upload, MessageCircle, Mic, PawPrint, User } from "lucide-react";

const NAV_ITEMS = [
  { path: "/dashboard", icon: Home, label: "홈" },
  { path: "/import", icon: Upload, label: "분석" },
  { path: "/chat", icon: MessageCircle, label: "채팅" },
  { path: "/speaking", icon: Mic, label: "스피킹" },
  { path: "/pet", icon: PawPrint, label: "펫" },
];

const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
