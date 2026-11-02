import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  ShieldCheck,
  Check,
  X,
  Sparkles,
  Layers,
  Wrench,
  Sun,
  Zap,
  BatteryCharging,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  CATEGORY_CONFIG,
  MULTI_CATEGORY_UNITS,
  formatItemSpecifications,
} from '../utils/categories';
import { formatNumber } from '../utils/numberToWords';
import { generateId } from '../utils/idGenerator';

export default function ProductCatalogView({
  catalog = [],
  setCatalog,
  onAddToInvoice,
  _onNavigateToEditor,
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState(null); // null or product object
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Distinct brands for filter dropdown
  const allBrands = useMemo(() => {
    const brands = new Set();
    catalog.forEach((p) => {
      if (p.brand && p.brand.trim()) brands.add(p.brand.trim());
    });
    return Array.from(brands).sort();
  }, [catalog]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return catalog.filter((product) => {
      // Category filter
      if (selectedCategory !== 'all' && product.category !== selectedCategory) {
        return false;
      }

      // Brand filter
      if (selectedBrand !== 'all' && product.brand !== selectedBrand) {
        return false;
      }

      // Search query (matches name, brand, model, SKU, HSN, specs)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const specsText = formatItemSpecifications(product).toLowerCase();
        const match =
          (product.name || '').toLowerCase().includes(query) ||
          (product.brand || '').toLowerCase().includes(query) ||
          (product.model || '').toLowerCase().includes(query) ||
          (product.sku || '').toLowerCase().includes(query) ||
          (product.hsn || '').toLowerCase().includes(query) ||
          specsText.includes(query);

        if (!match) return false;
      }

      return true;
    });
  }, [catalog, selectedCategory, selectedBrand, searchQuery]);

  // Open modal for new product
  const handleCreateNew = () => {
    const defaultCat = selectedCategory !== 'all' ? selectedCategory : PRODUCT_CATEGORIES.BATTERY;
    const catCfg = CATEGORY_CONFIG[defaultCat] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];

    setEditingProduct({
      id: generateId('prod'),
      sku: `TPS-${defaultCat.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      name: '',
      category: defaultCat,
      subcategory: catCfg.subcategories[0] || '',
      brand: '',
      model: '',
      description: '',
      specs: {},
      unit: catCfg.defaultUnit || 'Nos',
      hsn: catCfg.defaultHsn || '8507',
      sellingPrice: 0,
      costPrice: 0,
      gstRate: catCfg.defaultGstRate || 28,
      isTaxInclusive: true,
      warranty: '36 Months',
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleEdit = (prod) => {
    setEditingProduct({
      ...prod,
      specs: { ...(prod.specs || {}) },
    });
    setIsModalOpen(true);
  };

  // Delete product with confirmation
  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to remove "${name}" from the product catalog?`)) {
      setCatalog((prev) => prev.filter((p) => p.id !== id));
      showToast(`Removed "${name}" from catalog.`);
    }
  };

  // Save product (create or update)
  const handleSaveProduct = (e) => {
    e.preventDefault();
    if (!editingProduct.name.trim()) {
      alert('Product name is required.');
      return;
    }

    const updatedProduct = {
      ...editingProduct,
      updatedAt: new Date().toISOString(),
    };

    setCatalog((prev) => {
      const idx = prev.findIndex((p) => p.id === updatedProduct.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedProduct;
        return copy;
      }
      return [updatedProduct, ...prev];
    });

    setIsModalOpen(false);
    setEditingProduct(null);
    showToast(`Product "${updatedProduct.name}" saved!`);
  };

  // Category Icon component
  const getCategoryIcon = (category, className = 'w-4 h-4') => {
    switch (category) {
      case PRODUCT_CATEGORIES.BATTERY:
        return <BatteryCharging className={className} />;
      case PRODUCT_CATEGORIES.INVERTER:
        return <Zap className={className} />;
      case PRODUCT_CATEGORIES.SOLAR:
        return <Sun className={className} />;
      case PRODUCT_CATEGORIES.SERVICES:
        return <Wrench className={className} />;
      default:
        return <Package className={className} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-bounce">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Catalog Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                TPS Product & Services Catalog
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Manage all product lines: Batteries, Inverters, Solar Systems, and Installation Services
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Search, Category Filter Tabs & Brand Filter */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg space-y-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 shrink-0 transition-all ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>All Categories ({catalog.length})</span>
          </button>

          {Object.values(CATEGORY_CONFIG).map((cfg) => {
            const count = catalog.filter((p) => p.category === cfg.id).length;
            const isSelected = selectedCategory === cfg.id;
            return (
              <button
                key={cfg.id}
                type="button"
                onClick={() => setSelectedCategory(cfg.id)}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 shrink-0 transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750'
                }`}
              >
                {getCategoryIcon(cfg.id, 'w-3.5 h-3.5')}
                <span>
                  {cfg.label} ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar & Brand Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by model, brand, capacity (e.g. 150Ah, 1100VA, 550W), or HSN..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Brands ({allBrands.length})</option>
              {allBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Product Cards Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No products found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {searchQuery || selectedCategory !== 'all' || selectedBrand !== 'all'
                ? 'Try adjusting your search criteria or category filter.'
                : 'Your catalog is empty. Click "Add New Product" to populate items.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add First Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((prod) => {
            const catCfg = CATEGORY_CONFIG[prod.category] || CATEGORY_CONFIG[PRODUCT_CATEGORIES.BATTERY];
            const specsStr = formatItemSpecifications(prod);

            return (
              <div
                key={prod.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between shadow-lg transition-all group"
              >
                <div className="space-y-3">
                  {/* Category Pill & SKU */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${catCfg.badgeClass}`}
                    >
                      {getCategoryIcon(prod.category, 'w-3 h-3')}
                      <span>{catCfg.label}</span>
                      {prod.subcategory && (
                        <>
                          <span className="opacity-40">•</span>
                          <span className="truncate max-w-[120px]">{prod.subcategory}</span>
                        </>
                      )}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{prod.sku}</span>
                  </div>

                  {/* Brand & Name */}
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      {prod.brand || 'Generic'}
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                      {prod.name}
                    </h3>
                    {prod.model && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">Model: {prod.model}</p>
                    )}
                  </div>

                  {/* Technical Specifications */}
                  {specsStr && (
                    <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800 text-[11px] text-slate-300">
                      <span className="text-slate-500 font-medium">Specs: </span>
                      <span>{specsStr}</span>
                    </div>
                  )}

                  {/* HSN & Warranty Pills */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                    <span className="bg-slate-800 px-2 py-0.5 rounded font-mono">
                      HSN: {prod.hsn || catCfg.defaultHsn}
                    </span>
                    <span className="bg-slate-800 px-2 py-0.5 rounded font-mono">
                      GST: {prod.gstRate}%
                    </span>
                    {prod.warranty && (
                      <span className="bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1 text-slate-300">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        {prod.warranty}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price & Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Selling Price</span>
                    <span className="text-base font-extrabold text-amber-400 font-mono">
                      ₹{formatNumber(prod.sellingPrice)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      {prod.isTaxInclusive ? '(Incl. GST)' : '+ GST'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEdit(prod)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
                      title="Edit Product"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(prod.id, prod.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAddToInvoice(prod);
                        showToast(`Added "${prod.name}" to bill!`);
                      }}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-all shadow-sm"
                      title="Add product to active bill"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Bill</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Create Product Modal */}
      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {editingProduct.id.includes('prod-') && catalog.some((p) => p.id === editingProduct.id)
                      ? 'Edit Product'
                      : 'Add New Product to Catalog'}
                  </h2>
                  <p className="text-xs text-slate-400">Configure specifications, HSN, and GST rates</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Product Line / Category *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.values(CATEGORY_CONFIG).map((cfg) => {
                    const isSelected = editingProduct.category === cfg.id;
                    return (
                      <button
                        key={cfg.id}
                        type="button"
                        onClick={() => {
                          setEditingProduct((prev) => ({
                            ...prev,
                            category: cfg.id,
                            subcategory: cfg.subcategories[0] || '',
                            hsn: cfg.defaultHsn,
                            gstRate: cfg.defaultGstRate,
                            unit: cfg.defaultUnit,
                            specs: {},
                          }));
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {getCategoryIcon(cfg.id, 'w-4 h-4')}
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Basic Details: Name, Brand, Model, Subcategory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-slate-400">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    placeholder="e.g. Exide InvaTubular IT500 150Ah"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Brand</label>
                  <input
                    type="text"
                    value={editingProduct.brand || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                    placeholder="e.g. Exide, Luminous, Microtek, Tata"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Model</label>
                  <input
                    type="text"
                    value={editingProduct.model || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, model: e.target.value })}
                    placeholder="e.g. IT500, EcoVolt 1050"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-slate-400">Subcategory</label>
                  <select
                    value={editingProduct.subcategory || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, subcategory: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {(CATEGORY_CONFIG[editingProduct.category]?.subcategories || []).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Category-Specific Technical Specifications */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Category Technical Specifications
                </h4>

                {/* Battery Specs */}
                {editingProduct.category === PRODUCT_CATEGORIES.BATTERY && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">Capacity (Ah)</label>
                      <input
                        type="text"
                        value={editingProduct.specs?.capacity || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, capacity: e.target.value },
                          })
                        }
                        placeholder="e.g. 150Ah, 100Ah"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">Voltage</label>
                      <input
                        type="text"
                        value={editingProduct.specs?.voltage || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, voltage: e.target.value },
                          })
                        }
                        placeholder="e.g. 12V, 24V"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">Technology</label>
                      <input
                        type="text"
                        value={editingProduct.specs?.batteryType || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, batteryType: e.target.value },
                          })
                        }
                        placeholder="e.g. Tall Tubular, SMF"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Inverter Specs */}
                {editingProduct.category === PRODUCT_CATEGORIES.INVERTER && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">Capacity (VA)</label>
                      <input
                        type="text"
                        value={editingProduct.specs?.capacityVa || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, capacityVa: e.target.value },
                          })
                        }
                        placeholder="e.g. 900VA, 1100VA"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">Power Rating (Watts)</label>
                      <input
                        type="text"
                        value={editingProduct.specs?.powerWatts || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, powerWatts: e.target.value },
                          })
                        }
                        placeholder="e.g. 756W, 900W"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">Waveform</label>
                      <input
                        type="text"
                        value={editingProduct.specs?.waveform || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, waveform: e.target.value },
                          })
                        }
                        placeholder="e.g. Pure Sine Wave"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Solar Specs */}
                {editingProduct.category === PRODUCT_CATEGORIES.SOLAR && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">Rated Capacity (Wp)</label>
                      <input
                        type="text"
                        value={editingProduct.specs?.ratedCapacityWp || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, ratedCapacityWp: e.target.value },
                          })
                        }
                        placeholder="e.g. 550Wp, 400Wp"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">Panel Technology</label>
                      <input
                        type="text"
                        value={editingProduct.specs?.panelTechnology || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, panelTechnology: e.target.value },
                          })
                        }
                        placeholder="e.g. Mono PERC, Bifacial"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">System Capacity</label>
                      <input
                        type="text"
                        value={editingProduct.specs?.systemCapacityKw || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, systemCapacityKw: e.target.value },
                          })
                        }
                        placeholder="e.g. 3 kW, 5 kW"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Services Specs */}
                {editingProduct.category === PRODUCT_CATEGORIES.SERVICES && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">Service Scope</label>
                      <input
                        type="text"
                        value={editingProduct.specs?.serviceScope || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, serviceScope: e.target.value },
                          })
                        }
                        placeholder="e.g. Complete on-site wiring & mounting"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-400">Turnaround / Terms</label>
                      <input
                        type="text"
                        value={editingProduct.specs?.terms || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            specs: { ...editingProduct.specs, terms: e.target.value },
                          })
                        }
                        placeholder="e.g. Same day installation included"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Tax & Financial Details: HSN, GST Rate, Unit, Price */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">HSN / SAC Code</label>
                  <input
                    type="text"
                    value={editingProduct.hsn || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, hsn: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">GST Rate (%)</label>
                  <select
                    value={editingProduct.gstRate}
                    onChange={(e) => setEditingProduct({ ...editingProduct, gstRate: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value={28}>28% (Batteries)</option>
                    <option value={18}>18% (Inverters / Services)</option>
                    <option value={12}>12% (Solar Devices)</option>
                    <option value={5}>5% (Solar Components)</option>
                    <option value={0}>0% (Exempt)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Unit</label>
                  <select
                    value={editingProduct.unit}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {MULTI_CATEGORY_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Warranty</label>
                  <input
                    type="text"
                    value={editingProduct.warranty || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, warranty: e.target.value })}
                    placeholder="e.g. 36 Months"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Selling Price & Pricing Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Selling Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editingProduct.sellingPrice}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        sellingPrice: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Pricing Mode</label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingProduct({
                        ...editingProduct,
                        isTaxInclusive: !editingProduct.isTaxInclusive,
                      })
                    }
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center transition-colors ${
                      editingProduct.isTaxInclusive
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {editingProduct.isTaxInclusive ? 'Rate Includes GST (MRP)' : 'Rate Excludes GST (+ Tax)'}
                  </button>
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
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Save Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
