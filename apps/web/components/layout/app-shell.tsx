'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  FileText,
  Receipt,
  ClipboardList,
  Users,
  HardHat,
  MapPin,
  Building,
  Sparkles,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { getInitials } from '@lms/shared'

type Props = {
  user: { id: string; email: string; fullName: string; avatarUrl: string | null }
  organization: { id: string; name: string; slug: string }
  role: string
  children: React.ReactNode
}

const NAV_ITEMS = [
  { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, group: 'main' },
  { label: 'Chantiers', href: '/chantiers', icon: Briefcase, group: 'main' },
  { label: 'Planning', href: '/planning', icon: Calendar, group: 'ops' },
  { label: 'Devis', href: '/devis', icon: FileText, group: 'finance' },
  { label: 'Factures', href: '/factures', icon: Receipt, group: 'finance' },
  { label: 'Bons d\'intervention', href: '/bons', icon: ClipboardList, group: 'ops' },
  { label: 'Clients', href: '/clients', icon: Users, group: 'crm' },
  { label: 'Équipe', href: '/equipe', icon: HardHat, group: 'crm' },
  { label: 'Fournisseurs', href: '/fournisseurs', icon: Building, group: 'crm' },
  { label: 'Agences', href: '/agences', icon: MapPin, group: 'admin' },
  { label: 'Import IA', href: '/import', icon: Sparkles, group: 'ops' },
] as const

export function AppShell({ user, organization, role, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  async function handleLogout() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className="w-60 flex flex-col text-white flex-shrink-0"
        style={{ background: 'linear-gradient(175deg,#07172f 0%,#09265a 35%,#0f3b78 70%,#082f6d 100%)' }}
      >
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 200 175" fill="none" width="28" height="24">
                <path d="M100 10 L188 78 L188 165 L12 165 L12 78 Z" fill="#0F2644" />
                <rect x="116" y="100" width="72" height="65" rx="7" fill="#F5A623" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-black uppercase tracking-wide">{organization.name}</p>
              <p className="text-[8px] text-white/40 mt-0.5">Gestion interne · v0.1</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors',
                  active
                    ? 'bg-gradient-to-r from-[#F5A623] to-[#F97316] text-white font-semibold shadow-lg'
                    : 'text-white/60 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-2 border-t border-white/10 relative">
          {userMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-2 bg-[#0d1f3c] border border-white/10 rounded-lg overflow-hidden shadow-xl">
              <Link
                href="/settings/profile"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-xs text-white/70 hover:bg-white/5 hover:text-white"
              >
                <Settings className="h-4 w-4" />
                Paramètres
              </Link>
              <div className="border-t border-white/10" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-white/5"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          )}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-white/5 transition"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-[#F5A623] to-[#F97316] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {getInitials(user.fullName)}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-semibold truncate">{user.fullName}</p>
              <p className="text-[10px] text-white/40 truncate capitalize">{role}</p>
            </div>
            <ChevronDown
              className={cn('h-3 w-3 text-white/40 transition-transform', userMenuOpen && 'rotate-180')}
            />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-orange to-brand-blue" />
        {children}
      </div>
    </div>
  )
}
