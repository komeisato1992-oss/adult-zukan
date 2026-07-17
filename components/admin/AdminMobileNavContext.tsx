"use client";

import { createContext, useContext } from "react";

type AdminMobileNavContextValue = {
  openMobileNav: () => void;
};

const AdminMobileNavContext = createContext<AdminMobileNavContextValue | null>(
  null,
);

export function AdminMobileNavProvider({
  openMobileNav,
  children,
}: {
  openMobileNav: () => void;
  children: React.ReactNode;
}) {
  return (
    <AdminMobileNavContext.Provider value={{ openMobileNav }}>
      {children}
    </AdminMobileNavContext.Provider>
  );
}

export function useAdminMobileNav() {
  return useContext(AdminMobileNavContext);
}
