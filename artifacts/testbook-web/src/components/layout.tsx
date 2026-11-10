import { useState, ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, Menu, Home, User, BookOpen, Clock, LifeBuoy, Bot, FilePlus, Crown } from "lucide-react";
import { Button } from "./ui/button.tsx";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet.tsx";
import { useQuery } from "@tanstack/react-query";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/tests", label: "Mock Tests", icon: BookOpen },
  { href: "/history", label: "My History", icon: Clock },
  { href: "/ai-space", label: "AI Space", icon: Bot },
  { href: "/create-test", label: "Create Test", icon: FilePlus },
  { href: "/profile", label: "Profile & VIP", icon: User },
  { href: "/support", label: "Help & Support", icon: LifeBuoy },
];

function NavLinks({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 no-scrollbar">
      {navItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <item.icon className={`h-5 w-5 ${isActive ? "text-primary-foreground" : "text-sidebar-foreground/50"}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("learner_token"));
  }, []);

  const { data: profile } = useQuery({
    queryKey: ['learner-profile', token],
    queryFn: async () => {
      const res = await fetch(`/api/learner/profile?token=${token}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!token
  });

  const logout = () => {
    localStorage.removeItem("learner_token");
    setLocation("/login");
  };

  const currentPage = navItems.find((n) => location === n.href);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="w-[280px] border-r border-sidebar-border bg-sidebar flex-col hidden md:flex shrink-0">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
              W
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground leading-tight">Web Portal</h1>
              <p className="text-[11px] text-sidebar-foreground/50 font-medium">Student Area</p>
            </div>
          </Link>
        </div>
        
        <NavLinks location={location} />
        
        <div className="p-4 border-t border-sidebar-border bg-sidebar/50">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <header className="flex md:hidden items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground font-bold text-xs">
              W
            </div>
            <h1 className="text-sm font-bold text-sidebar-foreground">Web Portal</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-sidebar-foreground/70 font-medium mr-2">
              {currentPage?.label}
            </span>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 flex flex-col bg-sidebar border-r-sidebar-border">
                <div className="p-6 border-b border-sidebar-border">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm">
                      W
                    </div>
                    <div>
                      <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground leading-tight">Web Portal</h1>
                      <p className="text-[11px] text-sidebar-foreground/50 font-medium">Student Area</p>
                    </div>
                  </div>
                </div>
                <NavLinks location={location} onNavigate={() => setMobileOpen(false)} />
                <div className="p-4 border-t border-sidebar-border">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-muted/30 relative">
          {profile?.tier === "Premium" && (
            <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/20 to-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center justify-center gap-3 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Crown className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">VIP Member</span>
              </div>
              <div className="h-3 w-px bg-amber-500/30 hidden sm:block"></div>
              <div className="text-xs font-medium text-amber-800/90 hidden sm:flex items-center gap-2">
                {profile.premiumExpiry ? (
                  <>
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-300 shadow-sm">
                      {Math.max(0, Math.ceil((new Date(profile.premiumExpiry).getTime() - Date.now()) / 86400000))} Days Left
                    </span>
                    <span className="opacity-80">Renews {new Date(profile.premiumExpiry).toLocaleDateString()}</span>
                  </>
                ) : (
                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-300 shadow-sm">
                    Lifetime Access
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] pointer-events-none mix-blend-overlay"></div>
          <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 relative z-10 min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
