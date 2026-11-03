import React, { useState, useEffect, useRef } from 'react';
import {
  BatteryCharging,
  Clock,
  Calendar,
  User,
  ChevronDown,
  LogOut,
  Settings,
  LayoutDashboard,
  FileSpreadsheet,
  ReceiptText,
  Package,
} from 'lucide-react';
import { MOCK_USER } from '../data/mockData';
import { useAuth } from '../context/useAuth';
import { ROLE_CONFIG } from '../utils/permissions';

export default function Header({
  activeView,
  setActiveView,
  onOpenSettings,
  onOpenProfile,
  onSignOut,
  business,
  totalInvoicesCount = 0,
}) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Authenticated user & permissions from AuthContext
  const authContext = useAuth();
  const user = authContext?.user;
  const member = authContext?.member;
  const permissions = authContext?.permissions;
  const signOutUser = authContext?.signOutUser;

  const displayName = member?.displayName || user?.displayName || MOCK_USER.name;
  const email = member?.email || user?.email || MOCK_USER.email;
  const roleLabel = ROLE_CONFIG[member?.role]?.label || member?.role || MOCK_USER.role;
  const roleBadgeColor = ROLE_CONFIG[member?.role]?.badgeColor || 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
  const avatarInitials = (displayName || 'U')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = () => {
    setIsDropdownOpen(false);
    if (signOutUser) {
      signOutUser();
    }
    if (onSignOut) {
      onSignOut();
    }
  };

  // Live Digital Clock updating every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date and time
  const formattedDate = currentTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md no-print">
      <div className="max-w-[1700px] mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Brand Left */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
              <BatteryCharging className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white uppercase group-hover:text-amber-400 transition-colors">
                  {business?.businessName || 'TPS BATTERYS HOUSE'}
                </span>
                <span className="bg-amber-500/10 text-amber-400 text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-500/30 hidden lg:inline-block">
                  GSTIN: {business?.gstin || '32DIUPP1211B2ZN'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:block">
                GST Billing & Invoice Management
              </p>
            </div>
          </button>
        </div>

        {/* Center View Navigation Tabs */}
        <nav className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium ${
              activeView === 'dashboard'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('invoices')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium ${
              activeView === 'invoices'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Invoices</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
              {totalInvoicesCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('editor')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium ${
              activeView === 'editor'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <ReceiptText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tax Bill Generator</span>
            <span className="sm:hidden">Generator</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('catalog')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium ${
              activeView === 'catalog'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Catalog</span>
          </button>
        </nav>

        {/* Right Section: Date, Live Digital Clock & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Date & Digital Clock (hidden on tiny screens) */}
          <div className="hidden md:flex flex-col items-end text-right pr-2 border-r border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400">
              <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>{formattedTime}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* Settings Button (Visible only to Admin or when permissions allow) */}
          {(!permissions || permissions.canManageSettings) && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
              title="Store Settings & GST Config"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* User Profile Section with Interactive Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-all text-left focus:outline-none focus:ring-1 focus:ring-amber-500"
              aria-label="User profile menu"
              aria-expanded={isDropdownOpen}
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  className="w-7 h-7 rounded-lg object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center shrink-0">
                  {avatarInitials}
                </div>
              )}
              <div className="hidden xl:block text-xs leading-tight">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span className="truncate max-w-[120px]">{displayName}</span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>{roleLabel}</span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 text-xs animate-fade-in divide-y divide-slate-800">
                {/* User info preview in dropdown */}
                <div className="px-3.5 py-2.5">
                  <p className="font-bold text-white truncate">{displayName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{email}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${roleBadgeColor}`}>
                      {roleLabel}
                    </span>
                    <span className="text-[9px] text-emerald-400 font-mono">● Active</span>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenProfile();
                    }}
                    className="w-full px-3.5 py-2 text-left text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2 transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>My Staff Profile</span>
                  </button>

                  {(!permissions || permissions.canManageSettings) && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full px-3.5 py-2 text-left text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>Store & Bank Settings</span>
                    </button>
                  )}
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full px-3.5 py-2 text-left text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
