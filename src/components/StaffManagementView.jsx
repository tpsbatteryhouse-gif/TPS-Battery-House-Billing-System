import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  History,
  Shield,
  Copy,
  Check,
  UserX,
  UserMinus,
  Mail,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { DEFAULT_BUSINESS_ID } from '../context/authConstants';
import {
  ROLES,
  ACCOUNT_STATUS,
  ROLE_CONFIG,
} from '../utils/permissions';
import {
  listStaffMembers,
  listPendingRegistrations,
  approveStaffMember,
  rejectStaffRegistration,
  updateStaffRole,
  updateStaffStatus,
  registerStaffMemberDirectly,
  listStaffAuditLogs,
  migrateStaffMemberUid,
  removeStaffMember,
  getPrimaryAdminConfig,
} from '../firebase/services/staffService';

export default function StaffManagementView({ business }) {
  const { user } = useAuth();
  const businessId = business?.id || DEFAULT_BUSINESS_ID;

  // Active Tab: 'directory' | 'pending' | 'audit'
  const [activeTab, setActiveTab] = useState('directory');

  // Datasets
  const [staffList, setStaffList] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [primaryAdminUid, setPrimaryAdminUid] = useState(null);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Search & Filters for Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [roleModalMember, setRoleModalMember] = useState(null);
  const [selectedNewRole, setSelectedNewRole] = useState(ROLES.CASHIER);

  const [statusModalMember, setStatusModalMember] = useState(null);
  const [removeModalMember, setRemoveModalMember] = useState(null);

  const [approveModalReq, setApproveModalReq] = useState(null);
  const [approveRole, setApproveRole] = useState(ROLES.CASHIER);

  const [rejectModalReq, setRejectModalReq] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    uid: '',
    email: '',
    displayName: '',
    role: ROLES.CASHIER,
  });

  const [copiedUid, setCopiedUid] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleCopy = (uid) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  /**
   * Load all staff management datasets
   */
  const loadData = useCallback(async () => {
    try {
      const [members, pending, logs, adminCfg] = await Promise.all([
        listStaffMembers(businessId),
        listPendingRegistrations(businessId),
        listStaffAuditLogs(businessId, 100),
        getPrimaryAdminConfig(businessId),
      ]);
      setStaffList(members);
      setPendingList(pending);
      setAuditLogs(logs);
      if (adminCfg?.primaryAdminUid) {
        setPrimaryAdminUid(adminCfg.primaryAdminUid);
      }
      setError(null);
    } catch (err) {
      console.error('[StaffManagementView] Failed to load staff data:', err);
      setError(err.message || 'Failed to load staff administration records.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [businessId]);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        loadData();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  // Pending count for badge
  const pendingCount = useMemo(() => {
    return pendingList.filter((r) => r.status === 'pending').length;
  }, [pendingList]);

  // Filtered staff members
  const filteredStaff = useMemo(() => {
    return staffList.filter((st) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (st.displayName && st.displayName.toLowerCase().includes(q)) ||
        (st.email && st.email.toLowerCase().includes(q)) ||
        (st.uid && st.uid.toLowerCase().includes(q));

      const matchRole = roleFilter === 'ALL' || st.role === roleFilter;
      const matchStatus = statusFilter === 'ALL' || st.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [staffList, searchQuery, roleFilter, statusFilter]);

  /**
   * Role change submission
   */
  const handleConfirmRoleChange = async () => {
    if (!roleModalMember) return;
    setActionLoading(true);
    try {
      await updateStaffRole(businessId, roleModalMember.uid, selectedNewRole, {
        uid: user.uid,
        email: user.email,
      });
      showToast(`Updated ${roleModalMember.displayName}'s role to ${ROLE_CONFIG[selectedNewRole]?.label || selectedNewRole}`);
      setRoleModalMember(null);
      await loadData();
    } catch (err) {
      console.error('Role update error:', err);
      alert(`Role change failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Account status toggle submission
   */
  const handleConfirmStatusToggle = async () => {
    if (!statusModalMember) return;
    setActionLoading(true);
    const newStatus =
      statusModalMember.status === ACCOUNT_STATUS.ACTIVE
        ? ACCOUNT_STATUS.DISABLED
        : ACCOUNT_STATUS.ACTIVE;

    try {
      await updateStaffStatus(businessId, statusModalMember.uid, newStatus, {
        uid: user.uid,
        email: user.email,
      });
      showToast(
        newStatus === ACCOUNT_STATUS.DISABLED
          ? `Account for ${statusModalMember.displayName} has been deactivated.`
          : `Account for ${statusModalMember.displayName} has been reactivated.`
      );
      setStatusModalMember(null);
      await loadData();
    } catch (err) {
      console.error('Status toggle error:', err);
      alert(`Status modification failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Permanent staff removal submission
   */
  const handleConfirmRemoval = async () => {
    if (!removeModalMember) return;
    setActionLoading(true);
    try {
      await removeStaffMember(businessId, removeModalMember.uid, {
        uid: user.uid,
        email: user.email,
      });
      showToast(`Staff member ${removeModalMember.displayName || removeModalMember.email} has been permanently removed from the project.`);
      setRemoveModalMember(null);
      await loadData();
    } catch (err) {
      console.error('Staff removal error:', err);
      alert(`Staff removal failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Approve registration request
   */
  const handleConfirmApproval = async () => {
    if (!approveModalReq) return;
    setActionLoading(true);
    try {
      await approveStaffMember(businessId, approveModalReq.uid, approveRole, {
        uid: user.uid,
        email: user.email,
      });
      showToast(`Approved ${approveModalReq.displayName || approveModalReq.email} as ${ROLE_CONFIG[approveRole]?.label || approveRole}`);
      setApproveModalReq(null);
      await loadData();
    } catch (err) {
      console.error('Staff approval error:', err);
      alert(`Staff approval failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Reject registration request
   */
  const handleConfirmRejection = async () => {
    if (!rejectModalReq) return;
    setActionLoading(true);
    try {
      await rejectStaffRegistration(
        businessId,
        rejectModalReq.uid,
        rejectionReason,
        { uid: user.uid, email: user.email }
      );
      showToast(`Access request from ${rejectModalReq.email} has been rejected.`);
      setRejectModalReq(null);
      setRejectionReason('');
      await loadData();
    } catch (err) {
      console.error('Staff rejection error:', err);
      alert(`Staff rejection failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Direct staff registration
   */
  const handleDirectRegistration = async (e) => {
    e.preventDefault();
    if (!newStaffForm.uid.trim() || !newStaffForm.email.trim()) {
      alert('Firebase UID and Email are required.');
      return;
    }
    setActionLoading(true);
    try {
      await registerStaffMemberDirectly(businessId, newStaffForm, {
        uid: user.uid,
        email: user.email,
      });
      showToast(`Staff member ${newStaffForm.displayName || newStaffForm.email} registered successfully.`);
      setIsAddStaffOpen(false);
      setNewStaffForm({
        uid: '',
        email: '',
        displayName: '',
        role: ROLES.CASHIER,
      });
      await loadData();
    } catch (err) {
      console.error('Direct registration error:', err);
      alert(`Registration failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Migrate legacy placeholder UID to verified Google UID
   */
  const handleMigrateLegacyUid = async (oldUid, newUid, email) => {
    if (!window.confirm(`Link legacy staff record (${oldUid}) to verified Google identity (${newUid})?\n\nStaff role, status, and creation date will be preserved.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await migrateStaffMemberUid(businessId, oldUid, newUid, {
        uid: user.uid,
        email: user.email,
      });
      showToast(`Successfully linked ${email} to verified Google UID. Legacy record migrated.`);
      await loadData();
    } catch (err) {
      console.error('Legacy UID migration error:', err);
      alert(`UID Migration failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce border border-amber-400">
          <CheckCircle className="w-4 h-4 text-slate-950" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* View Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shrink-0">
            <Users className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Staff Administration & RBAC
              </h1>
              <span className="bg-red-500/10 text-red-400 text-[10px] font-mono px-2 py-0.5 rounded-full border border-red-500/20 font-bold uppercase tracking-wide">
                Admin Exclusive
              </span>
            </div>
            <p className="text-xs text-slate-400 pt-0.5">
              Manage team memberships, role privileges, access approvals, and immutable audit logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh staff data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddStaffOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-slate-800 gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`pb-3 px-3.5 flex items-center gap-2 transition-colors relative ${
            activeTab === 'directory'
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Directory</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {staffList.length}
          </span>
          {activeTab === 'directory' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-t-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`pb-3 px-3.5 flex items-center gap-2 transition-colors relative ${
            activeTab === 'pending'
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Pending Approvals</span>
          {pendingCount > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold animate-pulse">
              {pendingCount}
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-400 font-mono">
              0
            </span>
          )}
          {activeTab === 'pending' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-t-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-3.5 flex items-center gap-2 transition-colors relative ${
            activeTab === 'audit'
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit History</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {auditLogs.length}
          </span>
          {activeTab === 'audit' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-t-full" />
          )}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Error loading staff data</p>
            <p className="text-[11px] text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: STAFF DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Search & Filter Controls */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search staff by name, email, or UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 text-[11px]">Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none text-xs cursor-pointer"
                >
                  <option value="ALL">All Roles</option>
                  <option value={ROLES.ADMIN}>Administrator</option>
                  <option value={ROLES.MANAGER}>Store Manager</option>
                  <option value={ROLES.CASHIER}>Cashier</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                <span className="text-slate-400 text-[11px]">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none text-xs cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value={ACCOUNT_STATUS.ACTIVE}>Active</option>
                  <option value={ACCOUNT_STATUS.DISABLED}>Disabled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Staff Members Table */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
              <p className="text-xs">Loading staff memberships...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No staff members found</p>
              <p className="text-xs text-slate-500">
                {searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'Try adjusting your search query or filter settings.'
                  : 'Get started by adding a team member or reviewing pending requests.'}
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">UID</th>
                      <th className="py-3 px-4 hidden lg:table-cell">Joined Date</th>
                      <th className="py-3 px-4 hidden xl:table-cell">Last Updated</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredStaff.map((st) => {
                      const isCurrentUser = st.uid === user?.uid;
                      const roleConfig = ROLE_CONFIG[st.role] || {
                        label: st.role,
                        badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
                      };
                      const isActive = st.status === ACCOUNT_STATUS.ACTIVE;

                      return (
                        <tr
                          key={st.uid}
                          className="hover:bg-slate-850/50 transition-colors"
                        >
                          {/* Staff Name & Email */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0">
                                {(st.displayName || st.email || 'S').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate flex items-center gap-1.5">
                                  <span>{st.displayName || 'Staff Member'}</span>
                                  {isCurrentUser && (
                                    <span className="text-[9px] bg-amber-500/20 text-amber-400 font-mono px-1.5 py-0.2 rounded border border-amber-500/30">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span>{st.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${roleConfig.badgeColor}`}
                            >
                              {roleConfig.label}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                isActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isActive ? 'bg-emerald-400' : 'bg-red-400'
                                }`}
                              />
                              <span className="capitalize">{st.status}</span>
                            </span>
                          </td>

                          {/* Shortened UID */}
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <span title={st.uid}>
                                {st.uid.slice(0, 8)}...{st.uid.slice(-4)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(st.uid)}
                                className="p-1 hover:text-white rounded hover:bg-slate-800 transition-colors"
                                title="Copy UID"
                              >
                                {copiedUid === st.uid ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Joined Date */}
                          <td className="py-3 px-4 hidden lg:table-cell text-slate-400 text-[11px]">
                            {st.createdAt
                              ? new Date(st.createdAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>

                          {/* Last Updated */}
                          <td className="py-3 px-4 hidden xl:table-cell text-slate-400 text-[11px]">
                            {st.updatedAt
                              ? new Date(st.updatedAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Change Role Button */}
                              <button
                                type="button"
                                disabled={isCurrentUser}
                                onClick={() => {
                                  setRoleModalMember(st);
                                  setSelectedNewRole(st.role);
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  isCurrentUser
                                    ? 'opacity-40 cursor-not-allowed bg-slate-800/40 border-slate-800 text-slate-500'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
                                }`}
                                title={
                                  isCurrentUser
                                    ? 'You cannot modify your own role (anti-self-escalation)'
                                    : 'Change staff member role'
                                }
                              >
                                Role
                              </button>

                              {/* Toggle Status Button (Activate / Deactivate) */}
                              <button
                                type="button"
                                disabled={isCurrentUser}
                                onClick={() => setStatusModalMember(st)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  isCurrentUser
                                    ? 'opacity-40 cursor-not-allowed bg-slate-800/40 border-slate-800 text-slate-500'
                                    : isActive
                                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                }`}
                                title={
                                  isCurrentUser
                                    ? 'You cannot deactivate your own account (anti-lockout)'
                                    : isActive
                                    ? 'Suspend staff access'
                                    : 'Reactivate staff access'
                                }
                              >
                                {isActive ? 'Disable' : 'Activate'}
                              </button>

                              {/* Remove from Project Button */}
                              <button
                                type="button"
                                disabled={isCurrentUser || (primaryAdminUid && st.uid === primaryAdminUid)}
                                onClick={() => setRemoveModalMember(st)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-colors ${
                                  isCurrentUser || (primaryAdminUid && st.uid === primaryAdminUid)
                                    ? 'opacity-40 cursor-not-allowed bg-slate-800/40 border-slate-800 text-slate-500'
                                    : 'bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border-red-800/60 hover:border-red-600'
                                }`}
                                title={
                                  isCurrentUser
                                    ? 'You cannot remove your own account'
                                    : primaryAdminUid && st.uid === primaryAdminUid
                                    ? 'Primary Administrator cannot be removed'
                                    : 'Permanently remove staff member from project'
                                }
                              >
                                <UserMinus className="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PENDING APPROVALS */}
      {/* ========================================================================= */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-xs text-slate-300">
            <p className="font-semibold text-white">Google Sign-In Access Queue</p>
            <p className="text-[11px] text-slate-400 pt-0.5">
              When a new employee signs in with Google, their identity appears here. Review their identity, assign a role, and grant immediate access.
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
              <p className="text-xs">Loading pending access requests...</p>
            </div>
          ) : pendingList.length === 0 ? (
            <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 space-y-2">
              <UserCheck className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No pending access requests</p>
              <p className="text-xs text-slate-500">
                All staff access requests have been reviewed and processed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingList.map((req) => {
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const legacyMatch = staffList.find(
                  (s) => s.email && req.email && s.email.toLowerCase() === req.email.toLowerCase() && s.uid !== req.uid
                );

                return (
                  <div
                    key={req.uid}
                    className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      {req.photoURL ? (
                        <img
                          src={req.photoURL}
                          alt={req.displayName || 'Staff'}
                          className="w-10 h-10 rounded-full border border-slate-700 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center text-sm border border-amber-500/20 shrink-0">
                          {(req.displayName || req.email || 'U').slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-sm truncate">
                            {req.displayName || 'Google User'}
                          </p>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isPending
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : isApproved
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{req.email}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                          <span className="font-mono">
                            UID: {req.uid.slice(0, 8)}...{req.uid.slice(-4)}
                          </span>
                          <span>•</span>
                          <span>
                            Requested: {new Date(req.requestedAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {req.rejectionReason && (
                          <p className="text-[11px] text-red-400 italic pt-1">
                            Rejection Note: {req.rejectionReason}
                          </p>
                        )}

                        {legacyMatch && (
                          <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-[11px] text-blue-300 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                            <span>
                              Existing staff record found for <strong className="text-white">{legacyMatch.email}</strong> under legacy UID <code className="font-mono text-amber-400">{legacyMatch.uid.slice(0, 8)}...</code> with role <strong className="uppercase text-white">{legacyMatch.role}</strong>.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0">
                        {legacyMatch ? (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleMigrateLegacyUid(legacyMatch.uid, req.uid, req.email)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                            title="Migrate legacy membership to canonical Google UID"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Migrate to Google UID</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setApproveModalReq(req);
                              setApproveRole(ROLES.CASHIER);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve & Assign Role</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setRejectModalReq(req);
                            setRejectionReason('');
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-red-500/10 text-slate-300 hover:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 hover:border-red-500/30 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUDIT HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-xs text-slate-300 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Immutable Staff Audit Trail</p>
              <p className="text-[11px] text-slate-400 pt-0.5">
                Cryptographically locked records of all staff approvals, role modifications, and status changes.
              </p>
            </div>
            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/20">
              TAMPER-EVIDENT
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
              <p className="text-xs">Loading audit records...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">No audit records recorded yet</p>
              <p className="text-xs text-slate-500">
                Staff actions will automatically generate immutable audit entries here.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Target Staff</th>
                      <th className="py-3 px-4">Details</th>
                      <th className="py-3 px-4">Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {auditLogs.map((log) => {
                      const actionColor = {
                        STAFF_APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                        STAFF_REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
                        ROLE_CHANGED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                        STATUS_CHANGED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                        STAFF_REMOVED: 'bg-red-900/40 text-red-300 border-red-700/50',
                      }[log.action] || 'bg-slate-800 text-slate-300 border-slate-700';

                      return (
                        <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${actionColor}`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">
                              {log.targetName || log.targetEmail}
                            </div>
                            <div className="text-[11px] text-slate-400">{log.targetEmail}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {log.notes || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            <div className="font-medium text-slate-300">{log.actorEmail}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              UID: {log.actorUid ? `${log.actorUid.slice(0, 6)}...` : '—'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CHANGE ROLE MODAL */}
      {/* ========================================================================= */}
      {roleModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Modify Staff Role</h3>
                <p className="text-xs text-slate-400">
                  Target: <span className="text-white font-medium">{roleModalMember.displayName}</span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-slate-300 font-semibold block">
                Select New Access Role:
              </label>
              <div className="space-y-2">
                {[ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER].map((r) => {
                  const cfg = ROLE_CONFIG[r];
                  const isSelected = selectedNewRole === r;

                  return (
                    <div
                      key={r}
                      onClick={() => setSelectedNewRole(r)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{cfg.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 pt-1 leading-snug">
                        {cfg.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRoleModalMember(null)}
                className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || selectedNewRole === roleModalMember.role}
                onClick={handleConfirmRoleChange}
                className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Updating...' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: STATUS TOGGLE MODAL (ACTIVATE / DISABLE) */}
      {/* ========================================================================= */}
      {statusModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  statusModalMember.status === ACCOUNT_STATUS.ACTIVE
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {statusModalMember.status === ACCOUNT_STATUS.ACTIVE ? (
                  <UserX className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {statusModalMember.status === ACCOUNT_STATUS.ACTIVE
                    ? 'Deactivate Staff Account'
                    : 'Reactivate Staff Account'}
                </h3>
                <p className="text-xs text-slate-400">
                  Target: <span className="text-white font-medium">{statusModalMember.displayName}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {statusModalMember.status === ACCOUNT_STATUS.ACTIVE ? (
                <>
                  Deactivating will <strong className="text-red-400">immediately deny all Firestore read and write access</strong> for this staff member. Their historical invoices, receipts, and audit trail will remain permanently intact.
                </>
              ) : (
                <>
                  Reactivating will restore staff access according to their configured role (
                  <strong className="text-emerald-400">{ROLE_CONFIG[statusModalMember.role]?.label || statusModalMember.role}</strong>).
                </>
              )}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalMember(null)}
                className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmStatusToggle}
                className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50 ${
                  statusModalMember.status === ACCOUNT_STATUS.ACTIVE
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {actionLoading
                  ? 'Processing...'
                  : statusModalMember.status === ACCOUNT_STATUS.ACTIVE
                  ? 'Confirm Deactivation'
                  : 'Confirm Reactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: APPROVE REGISTRATION MODAL */}
      {/* ========================================================================= */}
      {approveModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Approve Staff Access</h3>
                <p className="text-xs text-slate-400">
                  {approveModalReq.displayName || approveModalReq.email}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-slate-300 font-semibold block">
                Assign System Role:
              </label>
              <div className="space-y-2">
                {[ROLES.CASHIER, ROLES.MANAGER, ROLES.ADMIN].map((r) => {
                  const cfg = ROLE_CONFIG[r];
                  const isSelected = approveRole === r;

                  return (
                    <div
                      key={r}
                      onClick={() => setApproveRole(r)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{cfg.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 pt-0.5">{cfg.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApproveModalReq(null)}
                className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmApproval}
                className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Approving...' : 'Grant Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: REJECT REGISTRATION MODAL */}
      {/* ========================================================================= */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Reject Access Request</h3>
                <p className="text-xs text-slate-400">{rejectModalReq.email}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-semibold block">
                Rejection Reason (Visible to user):
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Identity not recognized as current employee or contractor."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmRejection}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DIRECT ADD STAFF MEMBER MODAL */}
      {/* ========================================================================= */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Direct Staff Provisioning</h3>
                <p className="text-xs text-slate-400">
                  Manually register a verified Firebase Auth UID
                </p>
              </div>
            </div>

            <form onSubmit={handleDirectRegistration} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Firebase User UID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 7q8bK29X..."
                  value={newStaffForm.uid}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, uid: e.target.value.trim() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Staff Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="employee@tpsbattery.com"
                  value={newStaffForm.email}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Full Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sreejith V."
                  value={newStaffForm.displayName}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, displayName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Initial Role
                </label>
                <select
                  value={newStaffForm.role}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value={ROLES.CASHIER}>Billing Cashier</option>
                  <option value={ROLES.MANAGER}>Store Manager</option>
                  <option value={ROLES.ADMIN}>Administrator</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
                >
                  {actionLoading ? 'Registering...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: PERMANENT REMOVE FROM PROJECT MODAL */}
      {/* ========================================================================= */}
      {removeModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center">
                <UserMinus className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Remove from Project</h3>
                <p className="text-xs text-red-400 font-medium">Permanent Access Revocation</p>
              </div>
            </div>

            {/* Target Member Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white text-sm">
                    {removeModalMember.displayName || 'Staff Member'}
                  </p>
                  <p className="text-xs text-slate-400">{removeModalMember.email}</p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    ROLE_CONFIG[removeModalMember.role]?.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {ROLE_CONFIG[removeModalMember.role]?.label || removeModalMember.role}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                UID: {removeModalMember.uid}
              </div>
            </div>

            {/* Consequences & Clarifications */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Immediate Access Cutoff</span>
                </div>
                <p className="text-[11px] leading-relaxed text-red-200/90">
                  This user will be permanently removed from TPS Battery House. All active session tokens will be revoked and they will immediately lose all read/write permissions.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Google / Firebase Auth Account Preserved</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Their Google user account is NOT deleted. Only their membership in TPS Battery House is removed.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-blue-400">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span>Historical Data & Audit Trail Intact</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  All past invoices created by this user, transaction receipts, and prior audit logs remain permanently preserved for accounting integrity.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRemoveModalMember(null)}
                className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmRemoval}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Removing...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
