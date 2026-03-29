"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { TopHeader } from "@/components/layout/top-header";
import { StrategyPickerDialog } from "@/components/dashboard/strategy-picker-dialog";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useInitialData } from "@/hooks/use-initial-data";
import { useSSEStream } from "@/hooks/use-sse-stream";
import { useStrategyActions } from "@/hooks/use-strategy-actions";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [showPicker, setShowPicker] = useState(false);

  useInitialData();
  useSSEStream();
  const { handleKiteLogin, handleStartStrategy } = useStrategyActions();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopHeader
          onAddStrategy={() => setShowPicker(true)}
          onConnect={handleKiteLogin}
        />
        <main className="flex-1 overflow-auto pb-20 md:pb-0">{children}</main>
      </SidebarInset>
      <BottomTabBar />
      <StrategyPickerDialog
        open={showPicker}
        onOpenChange={setShowPicker}
        onAdd={handleStartStrategy}
      />
      <Toaster />
    </SidebarProvider>
  );
}
