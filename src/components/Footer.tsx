import { Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span>AIOM — AI Operations Manager</span>
          </div>
          <div>
            <span>© {new Date().getFullYear()} EPIC Communications Inc</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
