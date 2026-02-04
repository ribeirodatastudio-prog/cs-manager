import React from "react";
import { LayoutDashboard, Users, Crosshair, Settings, Bell, Menu, Trophy, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Roster", icon: Users, active: false },
  { label: "Training", icon: Crosshair, active: false },
  { label: "Tactics", icon: Activity, active: false },
  { label: "Tournaments", icon: Trophy, active: false },
  { label: "Settings", icon: Settings, active: false },
];

export function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center px-6 border-b border-border bg-black/20">
          <h1 className="text-xl font-black tracking-tighter uppercase text-primary italic">
            STRAT<span className="text-white">OS</span>
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors border-l-2",
                item.active
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border bg-black/20">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-accent rounded-none flex items-center justify-center font-bold text-white">
                GM
             </div>
             <div className="text-sm">
                <div className="font-bold text-white">Guest Manager</div>
                <div className="text-xs text-muted-foreground">Pro Team</div>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
         {/* Mobile Header */}
         <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/80 backdrop-blur sticky top-0 z-10">
             <div className="md:hidden flex items-center gap-2">
                 <Menu className="w-6 h-6 text-muted-foreground" />
                 <span className="font-bold uppercase text-primary">Stratos</span>
             </div>

             {/* Breadcrumb / Title (Desktop) */}
             <div className="hidden md:block text-sm text-muted-foreground">
                <span className="text-foreground font-bold">DASHBOARD</span> / ROSTER OVERVIEW
             </div>

             <div className="flex items-center gap-4">
                <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
                </button>
             </div>
         </header>

         <div className="flex-1 p-6 md:p-8 overflow-y-auto">
            {children}
         </div>
      </main>
    </div>
  );
}
