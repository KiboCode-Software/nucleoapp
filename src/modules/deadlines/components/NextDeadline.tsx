import { ArrowRight, CalendarCheck, PartyPopper } from "lucide-react";
import { Link } from "react-router";
import type { Deadline } from "@/database/repositories/deadlines.repository";
import { cn } from "@/utils/cn";
import { formatDue, KIND_META, parseDue, preciseCountdown } from "../schedule";

/** La entrega más urgente, destacada con su cuenta regresiva. */
export function NextDeadline({ deadline, now, onDone }: { deadline: Deadline | null; now: Date; onDone: (id: number) => void }) {
  if (!deadline) {
    return (
      <section aria-label="Próxima entrega" className="flex items-center gap-4 rounded-[22px] bg-success-soft p-6">
        <span className="grid size-14 shrink-0 place-items-center rounded-[16px] bg-success text-white">
          <PartyPopper className="size-7" strokeWidth={2} />
        </span>
        <div>
          <p className="text-[19px] font-bold tracking-[-0.02em]">Todo entregado</p>
          <p className="text-[13.5px] text-ink-muted">No tienes entregas pendientes. Añade la siguiente cuando la conozcas.</p>
        </div>
      </section>
    );
  }

  const { icon: Icon, tint, label } = KIND_META[deadline.kind];
  const overdue = parseDue(deadline.due_at) < now;

  return (
    <section
      aria-label="Próxima entrega"
      className="relative overflow-hidden rounded-[22px] p-6 text-white shadow-float"
      style={{ background: `linear-gradient(135deg, ${tint}, color-mix(in srgb, ${tint} 62%, #000))` }}
    >
      <span className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/10" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-24 -bottom-24 size-64 rounded-full bg-white/[0.07]" aria-hidden="true" />

      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-[12px] font-semibold tracking-[0.02em] uppercase backdrop-blur">
            <Icon className="size-3.5" strokeWidth={2.5} />
            {overdue ? "Vencida" : "Próxima"} · {label}
          </p>
          <h2 className="truncate text-[26px] leading-tight font-bold tracking-[-0.03em]">{deadline.title}</h2>
          <p className="mt-1 text-[13.5px] text-white/80 first-letter:uppercase">
            {formatDue(deadline.due_at)}
            {deadline.project_name && ` · ${deadline.project_name}`}
            {deadline.weight != null && ` · ${deadline.weight}% de la nota`}
          </p>
        </div>

        <div className="text-right">
          <p className={cn("leading-none font-bold tracking-[-0.03em] tabular-nums", overdue ? "text-[26px]" : "text-[34px]")} aria-live="polite">
            {preciseCountdown(deadline.due_at, now)}
          </p>
          <p className="mt-1 text-[12.5px] text-white/75">{overdue ? "Ponte al día cuanto antes" : "para la entrega"}</p>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDone(deadline.id)}
          className="pressable inline-flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-[14px] font-semibold text-[#1c1c1e] hover:bg-white/90"
        >
          <CalendarCheck className="size-4" /> Marcar como hecha
        </button>
        <Link
          to={`/deadlines/${deadline.id}`}
          className="pressable inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-white/15 px-3.5 text-[14px] font-medium hover:bg-white/25"
        >
          Ver detalles <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
