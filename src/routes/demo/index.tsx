import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Beaker,
  Shield,
  Users,
  Briefcase,
  Wrench,
  ShoppingCart,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Database,
} from "lucide-react";
import { useDemoEnvironment, useDemoRoles } from "~/hooks/useDemoEnvironment";

export const Route = createFileRoute("/demo/")({
  component: DemoLoginPage,
});

function DemoLoginPage() {
  const router = useRouter();
  const { login, isLoggingIn, loginError } = useDemoEnvironment();
  const { roles, isLoading: rolesLoading } = useDemoRoles();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "md":
        return <Briefcase className="h-6 w-6" />;
      case "field-tech":
        return <Wrench className="h-6 w-6" />;
      case "sales":
        return <ShoppingCart className="h-6 w-6" />;
      case "admin":
        return <Shield className="h-6 w-6" />;
      default:
        return <Users className="h-6 w-6" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "md":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "field-tech":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "sales":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case "admin":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const handleLogin = async (email: string, password: string) => {
    setError(null);
    setSelectedRole(email);

    login(
      { email, password },
      {
        onError: (err) => {
          setError(err.message || "Login failed");
          setSelectedRole(null);
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50 dark:from-slate-900 dark:to-slate-800">
      {/* Demo Mode Banner */}
      <div className="bg-amber-500 text-amber-950 py-2 px-4 text-center text-sm font-medium">
        <div className="flex items-center justify-center gap-2">
          <Beaker className="h-4 w-4" />
          <span>Demo Environment - All data is synthetic and isolated from production</span>
        </div>
      </div>

      <div className="container mx-auto py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-200/50 dark:border-amber-700/50">
                <Database className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-amber-700 to-orange-700 dark:from-white dark:via-amber-200 dark:to-orange-200 bg-clip-text text-transparent">
              Demo Environment
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore the AIOM platform with synthetic data. Select a role below to experience
              the application from different perspectives without affecting any production data.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">Isolated Data</p>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80">Completely separate from production</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">Synthetic Data</p>
                    <p className="text-sm text-blue-600/80 dark:text-blue-400/80">Realistic test scenarios</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">Safe Exploration</p>
                    <p className="text-sm text-amber-600/80 dark:text-amber-400/80">Test without consequences</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Message */}
          {(error || loginError) && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <p className="text-destructive">{error || loginError?.message || "Login failed"}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Role Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select a Demo Role</CardTitle>
              <CardDescription>
                Each role provides access to different features and perspectives within the platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roles.map((role) => (
                    <button
                      key={role.key}
                      onClick={() => handleLogin(role.email, "demo123!")}
                      disabled={isLoggingIn}
                      className={`
                        group relative p-6 rounded-xl border-2 text-left transition-all duration-200
                        hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]
                        ${selectedRole === role.email && isLoggingIn
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${getRoleColor(role.role)}`}>
                          {getRoleIcon(role.role)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{role.name}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {role.role}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {role.description}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>

                      {selectedRole === role.email && isLoggingIn && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                            <span className="text-sm font-medium">Logging in...</span>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-amber-800 dark:text-amber-200">Demo Environment Notice</h4>
                  <ul className="text-sm text-amber-700/80 dark:text-amber-300/80 space-y-1">
                    <li>• All data displayed is synthetic and generated for demonstration purposes</li>
                    <li>• Actions taken in demo mode do not affect production systems</li>
                    <li>• Demo sessions expire after 24 hours of inactivity</li>
                    <li>• Some features may be limited or simulated in demo mode</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Back to Main App */}
          <div className="text-center">
            <Link to="/sign-in" search={{ redirect: undefined }} className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Looking for the production environment? <span className="underline">Sign in here</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
