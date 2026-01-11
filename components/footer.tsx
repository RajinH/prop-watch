import { Building2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">PropWatch</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Track and monitor your property investment portfolio with
              real-time insights and analytics.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h3 className="font-semibold">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Properties
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Analytics
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Reports
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h3 className="font-semibold">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="font-semibold">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Cookie Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} PropWatch. All rights reserved.
          </p>
          <p>Made with care for property investors in Australia</p>
        </div>
      </div>
    </footer>
  );
}
