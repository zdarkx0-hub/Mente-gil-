"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [["/", "Início"], ["/treinar", "Treinar"], ["/revisar", "Revisar"], ["/progresso", "Progresso"], ["/ranking", "Ranking"]];

export default function StudyNavigation() {
  const pathname = (usePathname() || "/").replace(/\/$/, "") || "/";
  return <nav className="study-navigation" aria-label="Navegação principal">
    {items.map(([href, label]) => <Link key={href} href={href} aria-current={(href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)) ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
