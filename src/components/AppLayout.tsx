import BottomNav from "./BottomNav";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
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
