"use client";

import { useAtom } from "jotai";
import { Link as LinkIcon, Plus, Zap } from "lucide-react";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { activeStrategyIdsAtom, allSignalsAtom, authStatusAtom } from "@/store";

interface TopHeaderProps {
  onAddStrategy: () => void;
  onConnect: () => void;
}

export function TopHeader({ onAddStrategy, onConnect }: TopHeaderProps) {
  const { data: session } = useSession();
  const [authStatus] = useAtom(authStatusAtom);
  const [allSignals] = useAtom(allSignalsAtom);
  const [activeStrategyIds] = useAtom(activeStrategyIdsAtom);
  const isConnected = authStatus?.is_connected ?? false;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      {/* Desktop sidebar trigger */}
      <SidebarTrigger className="hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 hidden h-4 md:block" />

      {/* Mobile brand */}
      <div className="flex items-center gap-2 md:hidden">
        <SidebarTrigger />
        <div className="flex items-center gap-1.5">
          <Zap className="size-4 text-primary" />
          <span className="text-sm font-semibold">SignalEdge</span>
        </div>
      </div>

      {/* Status badges */}
      <div className="hidden items-center gap-2 sm:flex">
        <Badge variant="outline" className="font-mono text-xs">
          {allSignals.length} signals
        </Badge>
        {activeStrategyIds.length > 0 && (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          >
            {activeStrategyIds.length} running
          </Badge>
        )}
      </div>

      {/* Right side actions */}
      <div className="ml-auto flex items-center gap-2">
        {isConnected ? (
          <Button
            size="sm"
            onClick={onAddStrategy}
            className="h-8 gap-1.5"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">Add Strategy</span>
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onConnect}
            variant="outline"
            className="h-8 gap-1.5"
          >
            <LinkIcon className="size-3.5" />
            <span className="hidden sm:inline">Connect Kite</span>
          </Button>
        )}

        {/* Mobile avatar */}
        <div className="md:hidden">
          <Avatar className="h-7 w-7">
            <AvatarImage
              src={session?.user?.image ?? ""}
              referrerPolicy="no-referrer"
            />
            <AvatarFallback className="text-xs">
              {session?.user?.name?.charAt(0) ?? "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
