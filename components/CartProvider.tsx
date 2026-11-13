"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, effectivePrice, type Product, type Settings } from "@/lib/types";

export type Line = { key: string; product: Product; qty: number; picks: [number, number][]; extra: number; label: string; note: string };
export type AddOpts = { picks: [number, number][]; extra: number; label: string; note: string; qty: number };
export const makeKey = (id: number, picks: [number, number][] = [], note = "") =>
  `${id}|${picks.map((p) => p.join(".")).sort().join(",")}|${note.trim()}`;
export const unitOf = (l: Line) => effectivePrice(l.product) + l.extra;

type Ctx = {
  lines: Line[]; count: number; total: number; open: boolean; toast: string; settings: Settings; favs: number[];
  setOpen: (v: boolean) => void;
  add: (p: Product, o?: AddOpts) => void; change: (key: string, d: number) => void; clear: () => void;
  qtyOf: (id: number) => number; toggleFav: (id: number) => void;
};
const CartCtx = createContext<Ctx>(null!);
export const useCart = () => useContext(CartCtx);
const KEY = "burger-nha-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [favs, setFavs] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) setLines((JSON.parse(s) as any[]).map((l) => ({ picks: [], extra: 0, label: "", note: "", ...l, key: l.key ?? makeKey(l.product.id) })));
    } catch {}
    setReady(true);
    supabase.from("settings").select("*").maybeSingle().then(({ data }) => data && setSettings({ ...DEFAULT_SETTINGS, ...data }));
    const loadFavs = () => supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setFavs([]); return; }
      supabase.from("favorites").select("product_id").then(({ data }) => setFavs((data ?? []).map((f) => f.product_id)));
    });
    loadFavs();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { setTimeout(loadFavs, 0); });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {}
  }, [lines, ready]);

  const value = useMemo<Ctx>(() => ({
    lines, open, setOpen, toast, settings, favs,
    count: lines.reduce((s, l) => s + l.qty, 0),
    total: lines.reduce((s, l) => s + l.qty * unitOf(l), 0),
    qtyOf: (id) => lines.filter((l) => l.product.id === id).reduce((s, l) => s + l.qty, 0),
    add: (p, o) => {
      const flash = (msg: string) => {
        setToast(msg);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setToast(""), 1800);
      };
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          flash("Vui lòng đăng nhập để thêm món vào giỏ hàng");
          setTimeout(() => { window.location.href = "/login"; }, 1000);
          return;
        }
        const picks = o?.picks ?? [], note = o?.note ?? "", qty = o?.qty ?? 1;
        const key = makeKey(p.id, picks, note);
        setLines((ls) => ls.some((l) => l.key === key)
          ? ls.map((l) => l.key === key ? { ...l, qty: l.qty + qty } : l)
          : [...ls, { key, product: p, qty, picks, extra: o?.extra ?? 0, label: o?.label ?? "", note }]);
        flash(`Đã thêm ${p.name}`);
      });
    },
    change: (key, d) => setLines((ls) => ls.map((l) => l.key === key ? { ...l, qty: l.qty + d } : l).filter((l) => l.qty > 0)),
    clear: () => setLines([]),
    toggleFav: async (id) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      if (favs.includes(id)) {
        setFavs((f) => f.filter((x) => x !== id));
        await supabase.from("favorites").delete().eq("product_id", id);
      } else {
        setFavs((f) => [...f, id]);
        await supabase.from("favorites").insert({ user_id: session.user.id, product_id: id });
      }
    },
  }), [lines, open, toast, settings, favs]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}