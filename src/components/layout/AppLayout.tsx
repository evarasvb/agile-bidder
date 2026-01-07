import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { StatusBar } from "./StatusBar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="pl-64">
        <StatusBar />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
