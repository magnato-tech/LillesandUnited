import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { KioskItem } from '../types';
import {
  addKioskItem,
  updateKioskItem,
  deleteKioskItem,
  toggleKioskItemAvailability,
} from '../services/api';

interface KioskAdminPanelProps {
  items: KioskItem[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRequestConfirm: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'primary' | 'success';
    onConfirm: () => Promise<void> | void;
  }) => void;
}

const COMMON_ICONS = ['🍿', '🌭', '🥤', '🍫', '☕', '🍕', '🍔', '🍦', '🍩', '🍬', '🧃', '🥪'];

const COMMON_CATEGORIES = ['Varmmat', 'Drikke', 'Snacks & Godteri', 'Kaffe & Te', 'Annet'];

export const KioskAdminPanel: React.FC<KioskAdminPanelProps> = ({
  items,
  onRefresh,
  showToast,
  onRequestConfirm,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [icon, setIcon] = useState('🌭');
  const [category, setCategory] = useState('Varmmat');

  const resetForm = () => {
    setName('');
    setDesc('');
    setPrice('');
    setIcon('🌭');
    setCategory('Varmmat');
    setIsCreating(false);
    setEditingId(null);
  };

  const handleStartEdit = (item: KioskItem) => {
    setIsCreating(false);
    setEditingId(item.id);
    setName(item.name);
    setDesc(item.desc || '');
    setPrice(item.price);
    setIcon(item.icon || '🛒');
    setCategory(item.category || 'Varmmat');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Vennligst oppgi varenavn', 'error');
      return;
    }
    if (!price.trim()) {
      showToast('Vennligst oppgi pris (f.eks. "25 kr")', 'error');
      return;
    }

    try {
      setLoading(true);
      if (editingId) {
        await updateKioskItem(editingId, {
          name: name.trim(),
          desc: desc.trim(),
          price: price.trim(),
          icon: icon.trim() || '🛒',
          category: category.trim() || 'Diverse',
        });
        showToast(`«${name}» ble oppdatert!`, 'success');
      } else {
        await addKioskItem({
          name: name.trim(),
          desc: desc.trim(),
          price: price.trim(),
          icon: icon.trim() || '🛒',
          category: category.trim() || 'Diverse',
        });
        showToast(`«${name}» ble lagt til i kioskmenyen!`, 'success');
      }
      resetForm();
      onRefresh();
    } catch (err: any) {
      showToast(err?.message || 'Feil ved lagring av vare', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (item: KioskItem) => {
    onRequestConfirm({
      title: `Slette «${item.name}»?`,
      message: `Er du sikker på at du vil fjerne «${item.name}» fra kioskmenyen?`,
      confirmLabel: 'Ja, slett vare',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteKioskItem(item.id);
          showToast(`«${item.name}» ble slettet.`, 'success');
          onRefresh();
        } catch (err: any) {
          showToast(err?.message || 'Kunne ikke slette varen', 'error');
        }
      },
    });
  };

  const handleToggle = async (item: KioskItem) => {
    try {
      await toggleKioskItemAvailability(item.id);
      const newStatus = !(item.isAvailable ?? true);
      showToast(
        `«${item.name}» er nå markert som ${newStatus ? 'tilgjengelig' : 'utsolgt'}`,
        'info'
      );
      onRefresh();
    } catch (err: any) {
      showToast(err?.message || 'Kunne ikke endre status', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card with quick actions */}
      <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-zinc-800 shadow-artistic-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-black text-white uppercase tracking-tight">
              Kioskmeny & Varmmat
            </h3>
          </div>
          <p className="text-xs text-zinc-400 font-medium">
            Legg inn, endre og administrer varene som vises for ungdommene under Kiosk & Varmmat.
          </p>
        </div>

        {!isCreating && !editingId && (
          <button
            onClick={() => {
              resetForm();
              setIsCreating(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-artistic-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Ny vare</span>
          </button>
        )}
      </div>

      {/* Create / Edit Form Card */}
      {(isCreating || editingId) && (
        <div className="p-6 rounded-3xl bg-zinc-900 border-2 border-amber-400/50 shadow-artistic-md space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {editingId ? 'Endre kioskvare' : 'Opprett ny kioskvare'}
            </h4>
            <button
              onClick={resetForm}
              className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              title="Avbryt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Varenavn *
                </label>
                <input
                  type="text"
                  placeholder="f.eks. Varm Grillpølse"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white text-xs font-bold focus:outline-none focus:border-amber-400 shadow-artistic-sm"
                  autoFocus
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Pris / Bong *
                </label>
                <input
                  type="text"
                  placeholder="f.eks. 25 kr eller Gratis bong / 20 kr"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white text-xs font-bold focus:outline-none focus:border-amber-400 shadow-artistic-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                Beskrivelse / Tilbehør (valgfritt)
              </label>
              <input
                type="text"
                placeholder="f.eks. Serveres med ketchup og sennep i brød eller lompe"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white text-xs font-bold focus:outline-none focus:border-amber-400 shadow-artistic-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Kategori
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-colors ${
                        category === cat
                          ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-artistic-sm'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Eller skriv egen kategori"
                  className="w-full px-3.5 py-2 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white text-xs font-bold focus:outline-none focus:border-amber-400 shadow-artistic-sm"
                />
              </div>

              {/* Icon selector */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Ikon / Emoji
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setIcon(emoji)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all ${
                        icon === emoji
                          ? 'bg-amber-400 border-amber-400 scale-110 shadow-artistic-sm'
                          : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="Eller lim inn egen emoji"
                  className="w-full px-3.5 py-2 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-white text-xs font-bold focus:outline-none focus:border-amber-400 shadow-artistic-sm"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="px-4 py-2.5 rounded-2xl bg-zinc-950 border-2 border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-black uppercase tracking-wider transition-colors"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim() || !price.trim()}
                className="px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-artistic-sm transition-all"
              >
                <Check className="w-4 h-4" />
                <span>{editingId ? 'Lagre endringer' : 'Opprett vare'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
            Varer i kioskmenyen ({items.length})
          </span>
          {items.length > 0 && (
            <span className="text-[11px] text-zinc-500 font-medium">
              Trykk på bryteren for å sette vare som tilgjengelig eller utsolgt
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-8 rounded-3xl bg-zinc-900 border-2 border-dashed border-zinc-800 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-zinc-950 border-2 border-zinc-800 text-amber-400 flex items-center justify-center mx-auto shadow-artistic-sm">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-tight">
                Ingen varer er lagt inn i kioskmenyen ennå
              </h4>
              <p className="text-xs text-zinc-400 font-medium max-w-sm mx-auto mt-1">
                Trykk på «Ny vare» ovenfor for å legge til pølser, brus, popcorn eller annet som skal selges i kiosken.
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setIsCreating(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-artistic-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Legg til første vare</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item) => {
              const isAvail = item.isAvailable ?? true;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border-2 transition-all shadow-artistic-sm flex items-center justify-between gap-3 ${
                    isAvail
                      ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      : 'bg-zinc-950 border-zinc-900 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{item.icon || '🛒'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-white text-sm truncate">{item.name}</h4>
                        {!isAvail && (
                          <span className="text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                            Utsolgt
                          </span>
                        )}
                        {item.category && (
                          <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold">
                            {item.category}
                          </span>
                        )}
                      </div>
                      {item.desc && (
                        <p className="text-xs text-zinc-400 font-medium truncate mt-0.5">
                          {item.desc}
                        </p>
                      )}
                      <p className="text-xs font-mono font-black text-amber-400 mt-1">
                        {item.price}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Availability toggle */}
                    <button
                      onClick={() => handleToggle(item)}
                      className={`p-2 rounded-xl border transition-colors ${
                        isAvail
                          ? 'bg-lime-400/10 text-lime-400 border-lime-400/30 hover:bg-lime-400/20'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                      }`}
                      title={isAvail ? 'Marker som utsolgt' : 'Marker som tilgjengelig'}
                    >
                      {isAvail ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors"
                      title="Endre vare"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 border border-zinc-700 hover:border-rose-800/60 transition-colors"
                      title="Slett vare"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
