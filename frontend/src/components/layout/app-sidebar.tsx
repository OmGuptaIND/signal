"use client";

import { useAtom } from "jotai";
import {
  Activity,
  BarChart3,
  ChevronUp,
  LayoutDashboard,
  LogOut,
  Settings,
  User2,
  Zap,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { ConnectionPill } from "@/components/layout/connection-pill";
import { activeStrategyIdsAtom, authStatusAtom, strategiesAtom } from "@/store";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [authStatus] = useAtom(authStatusAtom);
  const [activeStrategyIds] = useAtom(activeStrategyIdsAtom);
  const [strategies] = useAtom(strategiesAtom);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isConnected = authStatus?.is_connected ?? false;

  const navItems = [
    { label: "Overview", icon: LayoutDashboard, href: "/" },
    { label: "Settings", icon: Settings, href: "/settings" },
  ];

  const getStrategyName = (id: string) =>
    strategies.find((s) => s.id === id)?.name ?? id;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">SignalEdge</span>
                <span className="truncate text-xs text-muted-foreground">
                  Options Intelligence
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Connection status pill */}
        {!isCollapsed && (
          <div className="px-2 pt-1">
            <ConnectionPill />
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href)
                    }
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {activeStrategyIds.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Active Strategies</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {activeStrategyIds.map((id) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      render={<Link href={`/strategy/${id}`} />}
                      isActive={pathname === `/strategy/${id}`}
                      tooltip={getStrategyName(id)}
                    >
                      <BarChart3 />
                      <span>{getStrategyName(id)}</span>
                      <span className="ml-auto flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {strategies.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>All Strategies</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {strategies
                  .filter((s) => !activeStrategyIds.includes(s.id))
                  .map((s) => (
                    <SidebarMenuItem key={s.id}>
                      <SidebarMenuButton
                        render={<Link href={`/strategy/${s.id}`} />}
                        isActive={pathname === `/strategy/${s.id}`}
                        tooltip={s.name}
                      >
                        <Activity className="opacity-40" />
                        <span className="text-muted-foreground">{s.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent"
                  />
                }
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={session?.user?.image ?? ""}
                    alt={session?.user?.name ?? ""}
                    referrerPolicy="no-referrer"
                  />
                  <AvatarFallback className="rounded-lg">
                    <User2 className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {session?.user?.name ?? "User"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {session?.user?.email}
                  </span>
                </div>
                <ChevronUp className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem
                  onClick={() => (window.location.href = "/settings")}
                >
                  <Settings className="mr-2 size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
