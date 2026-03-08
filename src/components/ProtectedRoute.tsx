import { forwardRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const ProtectedRoute = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => {
    const { user, loading } = useAuth();

    if (loading) {
      return (
        <div ref={ref} className="flex min-h-screen items-center justify-center bg-background">
          <div className="animate-bounce-in text-4xl">🌱</div>
        </div>
      );
    }

    if (!user) return <Navigate to="/auth" replace />;

    return <div ref={ref}>{children}</div>;
  }
);

ProtectedRoute.displayName = "ProtectedRoute";

export default ProtectedRoute;
