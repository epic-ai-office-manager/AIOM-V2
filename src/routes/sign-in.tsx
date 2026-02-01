import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Eye,
  EyeOff,
  Shield,
  Activity,
  Zap,
  BarChart3,
} from "lucide-react";

const signInSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type SignInForm = z.infer<typeof signInSchema>;

export const Route = createFileRoute("/sign-in")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: search.redirect as string | undefined,
  }),
});

function RouteComponent() {
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignInForm) => {
    setIsLoading(true);
    setAuthError("");

    try {
      await authClient.signIn.email(
        {
          email: data.email,
          password: data.password,
        },
        {
          onSuccess: () => {
            if (redirect) {
              window.location.href = redirect;
            } else {
              router.navigate({ to: "/dashboard" });
            }
          },
          onError: (error) => {
            setAuthError(error.error.message || "Invalid email or password");
          },
        }
      );
    } catch (error) {
      setAuthError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto relative min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <aside
        className="relative hidden h-full flex-col bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-12 text-white lg:flex border-r border-border overflow-hidden"
        role="complementary"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-cyan-600/8 to-blue-600/5" />
        <div className="absolute top-32 right-32 h-48 w-48 rounded-full bg-gradient-to-br from-blue-400/15 to-cyan-400/10 blur-2xl animate-pulse" />
        <div className="absolute bottom-32 left-32 h-32 w-32 rounded-full bg-gradient-to-br from-cyan-400/10 to-blue-400/8 blur-xl" />

        <header className="relative z-20 flex items-center text-xl font-semibold">
          <div className="mr-4 rounded-xl bg-gradient-to-br from-blue-500/25 to-cyan-500/20 p-3 backdrop-blur-sm border border-blue-200/20 shadow-lg">
            <Zap className="h-6 w-6 text-cyan-200" />
          </div>
          <h1 className="bg-gradient-to-r from-white via-blue-50 to-cyan-50 bg-clip-text text-transparent font-bold text-2xl tracking-tight">
            AIOM
          </h1>
        </header>

        <main className="relative z-20 flex-1 flex flex-col justify-center">
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold leading-tight bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
                AI Operations Manager
              </h2>
              <p className="text-blue-200/70 text-lg mt-3">
                Intelligent business monitoring, automated operations, executive decision support.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3 text-blue-200/80">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Activity className="h-4 w-4" />
                </div>
                <span>Real-time Odoo ERP monitoring</span>
              </div>
              <div className="flex items-center gap-3 text-blue-200/80">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <span>Cross-department business intelligence</span>
              </div>
              <div className="flex items-center gap-3 text-blue-200/80">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Shield className="h-4 w-4" />
                </div>
                <span>Autonomous action proposals with approval gates</span>
              </div>
            </div>
          </div>
        </main>

        <footer className="relative z-20 mt-auto">
          <p className="text-sm text-blue-300/40">
            EPIC Communications Inc — Powered by AIOM
          </p>
        </footer>
      </aside>

      <div className="lg:p-8">
        <div className="mb-6 flex items-center justify-center space-x-6 text-xs text-muted-foreground lg:hidden">
          <div className="flex items-center space-x-1">
            <Zap className="h-3 w-3" />
            <span>AIOM</span>
          </div>
          <div className="flex items-center space-x-1">
            <Shield className="h-3 w-3" />
            <span>Secure</span>
          </div>
          <div className="flex items-center space-x-1">
            <Activity className="h-3 w-3" />
            <span>Real-time</span>
          </div>
        </div>
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[380px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight animate-fadeInUp">
              Sign in
            </h1>
            <p className="text-sm text-muted-foreground animate-fadeInUp animation-delay-100">
              Access AIOM Operations Dashboard
            </p>
          </div>
          <div className="grid gap-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid gap-4">
                  {authError && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                      <p className="text-sm text-destructive">{authError}</p>
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="name@epic.dm"
                            type="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Password</FormLabel>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="Enter your password"
                              type={showPassword ? "text" : "password"}
                              autoComplete="current-password"
                              disabled={isLoading}
                              className="pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              disabled={isLoading}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    disabled={isLoading}
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] font-medium"
                  >
                    {isLoading && (
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    )}
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
          <p className="px-8 text-center text-sm text-muted-foreground">
            <Link
              to="/sign-up"
              className="underline underline-offset-4 hover:text-primary"
              search={{ redirect: undefined }}
            >
              Request an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
