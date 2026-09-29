import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";

// Every page is its own chunk; the initial bundle is only the shell (PLT-1).
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ImportPage = lazy(() => import("./pages/ImportPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ChatHistoryPage = lazy(() => import("./pages/ChatHistoryPage"));
const CardsPage = lazy(() => import("./pages/CardsPage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SpeakingPage = lazy(() => import("./pages/SpeakingPage"));
const SpeakingHistoryPage = lazy(() => import("./pages/SpeakingHistoryPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="animate-bounce-in text-4xl">🌱</div>
  </div>
);

const App = () => (
  <>
    <Toaster />
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
              <Route path="/chat-history" element={<ProtectedRoute><ChatHistoryPage /></ProtectedRoute>} />
              <Route path="/cards" element={<ProtectedRoute><CardsPage /></ProtectedRoute>} />
              <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/speaking" element={<ProtectedRoute><SpeakingPage /></ProtectedRoute>} />
              <Route path="/speaking-history" element={<ProtectedRoute><SpeakingHistoryPage /></ProtectedRoute>} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/privacy" element={<LegalPage doc="privacy" />} />
              <Route path="/terms" element={<LegalPage doc="terms" />} />
              {/* Removed features (PLT-1): keep old links and bookmarks working. */}
              <Route path="/pet" element={<Navigate to="/dashboard" replace />} />
              <Route path="/leaderboard" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </>
);

export default App;
