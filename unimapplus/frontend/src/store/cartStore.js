import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Multi-vendor cart persisted to localStorage so it survives logout/refresh
// { [vendorId]: { vendorName, items: { [menu_id]: { item, quantity, portions } } } }

const useCartStore = create(
  persist(
    (set, get) => ({
      carts: {},

      addItem(item, vendorId, vendorName, portions) {
        const { carts } = get();
        const vc = carts[vendorId] || { vendorName: vendorName || 'Eatery', items: {} };
        const existing = vc.items[item.menu_id];
        set({
          carts: {
            ...carts,
            [vendorId]: {
              ...vc,
              vendorName: vendorName || vc.vendorName,
              items: {
                ...vc.items,
                [item.menu_id]: {
                  item,
                  quantity: (existing?.quantity || 0) + 1,
                  portions: portions ?? existing?.portions ?? 1,
                }
              }
            }
          }
        });
      },

      removeItem(menu_id, vendorId) {
        const { carts } = get();
        const vc = carts[vendorId];
        if (!vc) return;
        const existing = vc.items[menu_id];
        if (!existing) return;
        let newItems;
        if (existing.quantity <= 1) {
          const { [menu_id]: _, ...rest } = vc.items;
          newItems = rest;
        } else {
          newItems = { ...vc.items, [menu_id]: { ...existing, quantity: existing.quantity - 1 } };
        }
        if (Object.keys(newItems).length === 0) {
          const { [vendorId]: _, ...rest } = carts;
          set({ carts: rest });
        } else {
          set({ carts: { ...carts, [vendorId]: { ...vc, items: newItems } } });
        }
      },

      // Set portions for a specific item (1-3, one pack regardless)
      setPortions(menu_id, vendorId, portions) {
        const { carts } = get();
        const vc = carts[vendorId];
        if (!vc || !vc.items[menu_id]) return;
        set({
          carts: {
            ...carts,
            [vendorId]: {
              ...vc,
              items: {
                ...vc.items,
                [menu_id]: { ...vc.items[menu_id], portions: Math.min(3, Math.max(1, portions)) }
              }
            }
          }
        });
      },

      clearVendorCart(vendorId) {
        const { carts } = get();
        const { [vendorId]: _, ...rest } = carts;
        set({ carts: rest });
      },

      clearAllCarts() { set({ carts: {} }); },

      // Get items as array for a vendor
      getCartArray(vendorId) {
        const vc = get().carts[vendorId];
        if (!vc) return [];
        return Object.values(vc.items).map(({ item, quantity, portions }) => ({
          menu_id: item.menu_id,
          item_name: item.item_name,
          price: item.price,
          quantity,
          portions: portions || 1,
        }));
      },

      // Total price for a vendor (portions × quantity × price)
      getVendorTotal(vendorId) {
        const vc = get().carts[vendorId];
        if (!vc) return 0;
        return Object.values(vc.items).reduce(
          (s, i) => s + i.item.price * i.quantity * (i.portions || 1), 0
        );
      },

      // All vendors with items
      getVendorList() {
        return Object.entries(get().carts).map(([vid, vc]) => ({
          vendorId: Number(vid),
          vendorName: vc.vendorName,
          itemCount: Object.values(vc.items).reduce((s, i) => s + i.quantity, 0),
          total: Object.values(vc.items).reduce(
            (s, i) => s + i.item.price * i.quantity * (i.portions || 1), 0
          ),
          items: Object.values(vc.items).map(({ item, quantity, portions }) => ({
            menu_id: item.menu_id,
            item_name: item.item_name,
            price: item.price,
            quantity,
            portions: portions || 1,
          }))
        }));
      },

      // Total items across all vendors (for badge)
      getTotalCount() {
        return Object.values(get().carts).reduce(
          (sum, vc) => sum + Object.values(vc.items).reduce((s, i) => s + i.quantity, 0), 0
        );
      },
    }),
    {
      name: 'unimap-cart', // localStorage key - persists across sessions
      // Only persist carts, not derived state
      partialize: (state) => ({ carts: state.carts }),
    }
  )
);

export default useCartStore;
