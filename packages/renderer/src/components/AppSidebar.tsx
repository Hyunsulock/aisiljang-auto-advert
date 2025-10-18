import { Home, Network, TestTube2, Package, LogOut, User, Settings } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useAuthStore } from '../stores/authStore'
import { Button } from './ui/button'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from './ui/sidebar'

const menuItems = [
  {
    title: 'Home',
    url: '/',
    icon: Home,
  },
  {
    title: '매물 관리',
    url: '/offers',
    icon: Network,
  },
  {
    title: '배치 관리',
    url: '/batches',
    icon: Package,
  },
  {
    title: '설정',
    url: '/settings',
    icon: Settings,
  },
  {
    title: '크롤러 테스트',
    url: '/crawler-test',
    icon: TestTube2,
  },
]

export function AppSidebar() {
  const { user, signOut } = useAuthStore()

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>애플리케이션</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="px-3 py-2 space-y-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" />
                  <span className="truncate">
                    {user?.user_metadata?.full_name || '사용자'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate pl-6">
                  {user?.email}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  )
}
