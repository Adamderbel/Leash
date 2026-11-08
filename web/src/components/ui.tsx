"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

import { explorerUrl, shortAddr } from "@/lib/config";

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "warn" };

export function Button({ variant = "primary", className = "", ...rest }: BtnProps) {
  const styles = {
    primary: "bg-emerald-400 text-zinc-950 hover:bg-emerald-300",
    ghost: "border border-white/15 text-zinc-200 hover:bg-white/5",
    danger: "bg-rose-500/90 text-white hover:bg-rose-500",
    warn: "bg-amber-400 text-zinc-950 hover:bg-amber-300",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
      {...rest}
    />
  );
}

export function Input({ label, hint, suffix, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; suffix?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>}
      <div className="flex items-center rounded-xl border border-white/10 bg-black/30 focus-within:border-emerald-400/60">
        <input className="w-full min-w-0 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600" {...rest} />
        {suffix && <span className="pr-3 text-xs text-zinc-500">{suffix}</span>}
      </div>
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function AddrLink({ address, label, kind = "address" }: { address: string; label?: string; kind?: "address" | "tx" }) {
  return (
    <a
      href={explorerUrl(kind, address)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs text-emerald-300/90 underline decoration-emerald-300/30 underline-offset-2 hover:text-emerald-200"
      title={address}
    >
      {label ?? shortAddr(address)}
    </a>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-2xl font-semibold text-zinc-50">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export function Pill({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "green" | "red" | "amber" }) {
  const t = {
    zinc: "bg-white/5 text-zinc-300",
    green: "bg-emerald-400/10 text-emerald-300",
    red: "bg-rose-500/10 text-rose-300",
    amber: "bg-amber-400/10 text-amber-300",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}
