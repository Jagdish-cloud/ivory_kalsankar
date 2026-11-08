import { Search } from "lucide-react";
import { useLookup } from "@/features/inventory/api";
import { useStoreOptions } from "@/features/stores/api";
import { useAuth } from "@/context/AuthContext";
import { CHAIN_LABELS, storesInChain, type StoreChain } from "@/lib/branding";

export type CatalogChainFilter = StoreChain | "all";

export interface InventoryFiltersState {
  search: string;
  categoryId: string;
  brandId: string;
  sizeId: string;
  colourId: string;
  /** "all" = stock of every store. */
  storeId: string;
  /** Super admin only. Default "all" (both chains). */
  chain: CatalogChainFilter;
}

interface FiltersProps {
  value: InventoryFiltersState;
  onChange: (value: InventoryFiltersState) => void;
}

export function InventoryFilters({ value, onChange }: FiltersProps) {
  const { data: categories } = useLookup("categories");
  const { data: brands } = useLookup("brands");
  const { data: sizes } = useLookup("sizes");
  const { data: colours } = useLookup("colours");
  const { data: stores } = useStoreOptions();
  const { user, isSuperAdmin } = useAuth();
  const listedStores = isSuperAdmin
    ? value.chain === "all"
      ? stores ?? []
      : storesInChain(stores ?? [], value.chain)
    : storesInChain(stores ?? [], user?.store.chain);
  const showLingerieFilters = isSuperAdmin ? value.chain !== "KALSANKAR_OS" : user?.store.chain !== "KALSANKAR_OS";
  const isSaree = !isSuperAdmin && user?.store.chain === "KALSANKAR_OS";

  function set<K extends keyof InventoryFiltersState>(key: K, val: InventoryFiltersState[K]) {
    onChange({ ...value, [key]: val });
  }

  function setChain(chain: CatalogChainFilter) {
    if (chain === "all") {
      onChange({ ...value, chain, storeId: "all" });
      return;
    }
    const nextStores = storesInChain(stores ?? [], chain);
    const storeOk = value.storeId === "all" || nextStores.some((s) => s.id === value.storeId);
    onChange({ ...value, chain, storeId: storeOk ? value.storeId : "all" });
  }

  const selectClasses =
    "rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-400 focus:outline-none";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        <input
          value={value.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder={isSaree ? "Search saree ID / type / colour..." : "Search style / code / brand..."}
          className="w-full rounded-lg border border-brand-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none"
        />
      </div>

      {isSuperAdmin && (
        <select className={selectClasses} value={value.chain} onChange={(e) => setChain(e.target.value as CatalogChainFilter)} aria-label="Chain">
          <option value="all">All chains</option>
          <option value="IVORY_LACE">{CHAIN_LABELS.IVORY_LACE}</option>
          <option value="KALSANKAR_OS">{CHAIN_LABELS.KALSANKAR_OS}</option>
        </select>
      )}

      <select
        className={selectClasses}
        value={value.storeId}
        onChange={(e) => set("storeId", e.target.value)}
        aria-label="Store"
      >
        <option value="all">All Stores</option>
        {listedStores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.id === user?.store.id ? `My store - ${s.name}` : s.name}
          </option>
        ))}
      </select>

      {showLingerieFilters && (
        <>
          <select className={selectClasses} value={value.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">All Categories</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select className={selectClasses} value={value.brandId} onChange={(e) => set("brandId", e.target.value)}>
            <option value="">All Brands</option>
            {brands?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select className={selectClasses} value={value.sizeId} onChange={(e) => set("sizeId", e.target.value)}>
            <option value="">All Sizes</option>
            {sizes?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <select className={selectClasses} value={value.colourId} onChange={(e) => set("colourId", e.target.value)}>
            <option value="">All Colours</option>
            {colours?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
