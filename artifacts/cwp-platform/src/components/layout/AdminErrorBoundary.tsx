import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error("[AdminErrorBoundary] Uncaught rendering exception:", error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-3xl mx-auto my-8">
          <Card className="border-destructive/40 shadow-lg">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-destructive font-semibold">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle className="text-lg">
                  {this.props.fallbackTitle ?? "Application View Error"}
                </CardTitle>
              </div>
              <CardDescription>
                An unexpected error occurred while rendering this view. Your session and saved changes remain secure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="rounded-md bg-muted/80 p-3 font-mono text-xs text-foreground overflow-x-auto border border-border">
                  <p className="font-semibold text-destructive">{this.state.error.name}: {this.state.error.message}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button onClick={this.handleReload} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Reload Page
                </Button>
                <Button variant="outline" onClick={this.handleReset} className="gap-2">
                  Try Again
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    window.location.href = "/admin/dashboard";
                  }}
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
