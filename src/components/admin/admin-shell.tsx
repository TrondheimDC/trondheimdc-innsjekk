"use client"

import { FileUp, FlaskConical, Package, Printer, ScanLine, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@/components/auth/user/user-button"
import { TdcLogo } from "@/components/tdc-logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </SidebarProvider>
  )
}

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  const closeMobile = () => setOpenMobile(false)

  return (
    <>
      <Sidebar>
        <SidebarHeader className="hidden px-4 py-5 md:block">
          <TdcLogo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin/printers")}
                    size="lg"
                  >
                    <Link href="/admin/printers" onClick={closeMobile}>
                      <Printer />
                      Printere
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin/import")}
                    size="lg"
                  >
                    <Link href="/admin/import" onClick={closeMobile}>
                      <FileUp />
                      Deltakere
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin/smooth-print")}
                    size="lg"
                  >
                    <Link href="/admin/smooth-print" onClick={closeMobile}>
                      <Package />
                      Android-app
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin/brukere")}
                    size="lg"
                  >
                    <Link href="/admin/brukere" onClick={closeMobile}>
                      <Users />
                      Brukere
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin/testutskrift")}
                    size="lg"
                  >
                    <Link href="/admin/testutskrift" onClick={closeMobile}>
                      <FlaskConical />
                      Testutskrift
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/10 p-3">
          {/* Back to the door screens; the Android app has no address bar. */}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg">
                <Link href="/" onClick={closeMobile}>
                  <ScanLine />
                  Til innsjekk
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <UserButton className="w-full justify-start" align="start" side="top" hideSettings />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex items-center gap-2 border-b border-white/10 p-3 pt-[max(0.75rem,calc(env(safe-area-inset-top)+var(--printer-status-bar,0px)))] md:hidden">
          <SidebarTrigger />
          <TdcLogo />
          <div className="ml-auto">
            <UserButton size="icon" align="end" hideSettings />
          </div>
        </div>
        {children}
      </SidebarInset>
    </>
  )
}
