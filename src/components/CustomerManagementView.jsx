import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Building,
  Edit2,
  Trash2,
  Receipt,
  RefreshCw,
  CloudOff,
  AlertCircle,
  Lock,
  X,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/useAuth.js';

export default function CustomerManagementView({
  customers = [],
  onSelectCustomerForBill,
  onSaveCustomer,
  onDeleteCustomer,
  syncStatus = 'synced',
  syncError = null,
  onRefresh,
  loading = false,
}) {
  const { permissions } = useAuth();
  const canManage = Boolean(permissions?.canManageCustomers);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all'); // 'all' | 'b2b' | 'b2c'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((cust) => {
      const isB2B = Boolean(cust.gstin && cust.gstin.trim().length >= 10);
      if (selectedType === 'b2b' && !isB2B) return false;
      if (selectedType === 'b2c' && isB2B) return false;

      if (!q) return true;
      return (
        (cust.name && cust.name.toLowerCase().includes(q)) ||
        (cust.phone && cust.phone.toLowerCase().includes(q)) ||
        (cust.gstin && cust.gstin.toLowerCase().includes(q)) ||
        (cust.city && cust.city.toLowerCase().includes(q)) ||
        (cust.district && cust.district.toLowerCase().includes(q))
      );
    });
  }, [customers, searchQuery, selectedType]);

  const handleCreateNew = () => {
    if (!canManage) return;
    setEditingCustomer({
      name: '',
      phone: '',
      address: '',
      shippingAddress: '',
      city: 'Thrithala',
      district: 'Palakkad',
      state: 'Kerala',
      stateCode: '32',
      pincode: '679552',
      gstin: '',
      pan: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (cust) => {
    if (!canManage) return;
    setEditingCustomer({ ...cust });
    setIsModalOpen(true);
  };

  const handleDelete = async (customerId, customerName) => {
    if (!canManage) return;
    setDeleteConfirmation({ id: customerId, name: customerName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    try {
      if (onDeleteCustomer) {
        await onDeleteCustomer(deleteConfirmation.id);
      }
      showToast(`Customer "${deleteConfirmation.name}" deleted.`);
    } catch (err) {
      alert(`Failed to delete customer: ${err.message}`);
    } finally {
      setDeleteConfirmation(null);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canManage || isSubmitting) return;

    if (!editingCustomer.name.trim()) {
      alert('Customer name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (onSaveCustomer) {
        await onSaveCustomer(editingCustomer);
      }
      showToast(`Customer "${editingCustomer.name}" saved!`);
      setIsModalOpen(false);
      setEditingCustomer(null);
    } catch (err) {
      alert(`Failed to save customer: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 border border-amber-400">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Customer & Buyer Directory
                </h1>
                {syncStatus === 'synced' && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Cloud Synced
                  </span>
                )}
                {syncStatus === 'syncing' && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    Syncing...
                  </span>
                )}
                {syncStatus === 'offline' && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700/50 text-slate-300 border border-slate-600">
                    <CloudOff className="w-2.5 h-2.5 text-slate-400" />
                    Offline Cache
                  </span>
                )}
                {syncStatus === 'error' && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20" title={syncError || 'Sync error'}>
                    <AlertCircle className="w-2.5 h-2.5" />
                    Sync Error
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Manage B2B registered business accounts and B2C retail customers for fast bill generation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50"
              title="Refresh customer directory"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline text-xs">Refresh</span>
            </button>
          )}

          {!canManage ? (
            <div className="px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Directory Read-Only (Cashier)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCreateNew}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, GSTIN, city..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              selectedType === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('b2b')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              selectedType === 'b2b'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            B2B Entities ({customers.filter((c) => c.gstin && c.gstin.length >= 10).length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('b2c')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              selectedType === 'b2c'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            B2C Retail ({customers.filter((c) => !c.gstin || c.gstin.length < 10).length})
          </button>
        </div>
      </div>

      {/* Customers List Grid */}
      {loading && customers.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <RefreshCw className="w-7 h-7 animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Loading Customer Directory...</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Synchronizing customer records with Cloud Firestore.
            </p>
          </div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No customers found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {searchQuery || selectedType !== 'all'
                ? 'Try adjusting your search criteria or filter.'
                : canManage
                ? 'No customer records found. Click "Add Customer" to add your first customer.'
                : 'No customer records currently in the directory.'}
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add First Customer
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((cust) => {
            const isB2B = Boolean(cust.gstin && cust.gstin.trim().length >= 10);

            return (
              <div
                key={cust.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between shadow-lg transition-all group"
              >
                <div className="space-y-3">
                  {/* Badge & Type */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isB2B
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {isB2B ? <Building className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                      <span>{isB2B ? 'B2B Registered' : 'B2C Retail'}</span>
                    </span>

                    <span className="text-[10px] font-mono text-slate-500">
                      State: {cust.stateCode || '32'}
                    </span>
                  </div>

                  {/* Customer Name */}
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                      {cust.name}
                    </h3>
                    {cust.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-1">
                        <Phone className="w-3 h-3 text-amber-500" />
                        <span>+91 {cust.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  {(cust.address || cust.city) && (
                    <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                      <span>
                        {[cust.address, cust.city, cust.district].filter(Boolean).join(', ')}
                        {cust.pincode ? ` - ${cust.pincode}` : ''}
                      </span>
                    </div>
                  )}

                  {/* GSTIN / PAN */}
                  {cust.gstin && (
                    <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800 text-[11px] space-y-0.5">
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">GSTIN:</span>
                        <span className="text-amber-400 font-bold">{cust.gstin}</span>
                      </div>
                      {cust.pan && (
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-slate-500">PAN:</span>
                          <span className="text-slate-300">{cust.pan}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEdit(cust)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cust.id, cust.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {onSelectCustomerForBill && (
                    <button
                      type="button"
                      onClick={() => onSelectCustomerForBill(cust)}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-sm"
                      title="Create fresh bill for this customer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Create Bill</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Customer?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Are you sure you want to delete <span className="text-white font-semibold">"{deleteConfirmation.name}"</span>?
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              Note: Historical invoices issued to this customer will remain completely untouched.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-white rounded-lg text-xs font-bold shadow-md shadow-rose-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingCustomer.id ? 'Edit Customer Details' : 'Add New Customer'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Saves customer profile to Cloud Firestore directory
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Customer / Entity Name *</label>
                <input
                  type="text"
                  required
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  placeholder="e.g. Green Valley Agro Farm / Rajesh K."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Phone & GSTIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Phone Number</label>
                  <input
                    type="tel"
                    value={editingCustomer.phone || ''}
                    onChange={(e) =>
                      setEditingCustomer({
                        ...editingCustomer,
                        phone: e.target.value.replace(/[^\d+ -]/g, ''),
                      })
                    }
                    placeholder="e.g. 9847334455"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={editingCustomer.gstin || ''}
                    onChange={(e) => {
                      const g = e.target.value.toUpperCase();
                      const pan = g.length >= 12 ? g.slice(2, 12) : editingCustomer.pan;
                      setEditingCustomer({ ...editingCustomer, gstin: g, pan });
                    }}
                    placeholder="e.g. 32AABCG9981A1Z4"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono uppercase text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Billing Street / Area Address</label>
                <input
                  type="text"
                  value={editingCustomer.address || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                  placeholder="Building / House / Street Name"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Shipping Address */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Shipping Address (Optional)</label>
                <input
                  type="text"
                  value={editingCustomer.shippingAddress || ''}
                  onChange={(e) =>
                    setEditingCustomer({ ...editingCustomer, shippingAddress: e.target.value })
                  }
                  placeholder="Leave blank if same as billing address"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* City, District, PIN */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">City / Town</label>
                  <input
                    type="text"
                    value={editingCustomer.city || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, city: e.target.value })}
                    placeholder="Thrithala"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">District</label>
                  <input
                    type="text"
                    value={editingCustomer.district || ''}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, district: e.target.value })
                    }
                    placeholder="Palakkad"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">PIN Code</label>
                  <input
                    type="text"
                    value={editingCustomer.pincode || ''}
                    onChange={(e) =>
                      setEditingCustomer({
                        ...editingCustomer,
                        pincode: e.target.value.replace(/\D/g, '').slice(0, 6),
                      })
                    }
                    placeholder="679552"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* State & State Code */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">State</label>
                  <input
                    type="text"
                    value={editingCustomer.state || 'Kerala'}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, state: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">State Code *</label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.stateCode || '32'}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, stateCode: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all ${
                    isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Save Customer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
