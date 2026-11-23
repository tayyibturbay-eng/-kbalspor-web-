// PlayerProgramTab.tsx
import { TaskAssignment, Training } from "@/types/club";

interface PlayerProgramTabProps {
  trainings: Training[];
  tasks: TaskAssignment[];
}

function buildMapsUrl(location?: string | null): string {
  const q = (location || "Nazmi Avluca Spor Tesisi Çorum").trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q
  )}`;
}

export function PlayerProgramTab({ trainings, tasks }: PlayerProgramTabProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-black text-[var(--text-primary)]">
          Antrenman Programım
        </h2>
        {trainings.length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-6 text-center space-y-1">
            <p className="text-sm font-extrabold text-[var(--text-primary)]">
              Kayıtlı antrenman bulunmuyor.
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Grubunuz için yeni antrenman planlandığında burada listelenecek.
            </p>
          </div>
        ) : (
          trainings.map((t) => (
            <div
              key={t.id}
              className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1"
            >
              <div className="font-extrabold text-[var(--text-primary)]">
                {t.title}
              </div>
              <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                {t.training_type === "duzenli" ? t.day_of_week : t.training_date}{" "}
                • {t.start_time}
                {t.end_time ? ` - ${t.end_time}` : ""}
              </div>
              {t.coach_name && (
                <div className="text-xs font-bold text-[var(--brand-navy)] dark:text-sky-300">
                  Antrenör: {t.coach_name}
                </div>
              )}
              {t.location && (
                <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-2">
                  <span>Saha: {t.location}</span>
                  <a
                    href={buildMapsUrl(t.location)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--brand-navy)] dark:text-sky-300 font-bold underline"
                  >
                    Haritada Aç
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-black text-[var(--brand-red)]">
          Maç &amp; Görev Takvimi
        </h2>
        {tasks.length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-subtle)] border border-dashed border-[var(--border-strong)] p-6 text-center space-y-1">
            <p className="text-sm font-extrabold text-[var(--text-primary)]">
              Yaklaşan maç veya görev yok.
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Planlanan maç ve görevler yayınlandığında burada görünecek.
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1"
            >
              <div className="font-extrabold text-[var(--text-primary)]">
                {task.title}
              </div>
              <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                {task.event_date}{" "}
                {task.match_time ? `• ${task.match_time}` : ""}
              </div>
              <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-2">
                <span>Yer: {task.location}</span>
                {task.location && (
                  <a
                    href={buildMapsUrl(task.location)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--brand-navy)] dark:text-sky-300 font-bold underline"
                  >
                    Haritada Aç
                  </a>
                )}
              </div>
              {task.has_shuttle && (
                <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--status-info-bg)] text-[var(--status-info-text)] text-[11px] font-bold">
                  Servis Var
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}