import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { reportError } from "@/lib/errorReporting";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// A lazy route that cannot be downloaded (offline, or removed by a new deploy) fails like this in
// Chrome, Firefox and Safari, and when Vite cannot preload its CSS. Retrying cannot fix it: the
// failed import stays failed, so the page has to be reloaded.
const isChunkLoadError = (error: Error | null) =>
  /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(error?.message ?? "");

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    void reportError(error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      if (isChunkLoadError(this.state.error)) {
        return (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
            <h2 className="text-lg font-semibold text-foreground">화면을 불러오지 못했어요</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              인터넷 연결을 확인해 주세요. 새 버전이 나왔다면 새로고침하면 돼요.
            </p>
            <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              새로고침
            </Button>
          </div>
        );
      }

      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            문제가 발생했어요
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            예상치 못한 오류가 발생했습니다. 다시 시도해 주세요.
          </p>
          <Button
            variant="outline"
            onClick={this.handleReset}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
