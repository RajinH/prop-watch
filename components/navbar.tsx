import { Building2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">PropWatch</span>
        </div>
        <Separator orientation="vertical" className="mx-4 h-6" />
        <nav className="flex items-center gap-6 text-sm">
          <a
            href="#"
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            Dashboard
          </a>
          <a
            href="#"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Properties
          </a>
          <a
            href="#"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Analytics
          </a>
          <a
            href="#"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Settings
          </a>
        </nav>
      </div>
    </header>
  );
}
