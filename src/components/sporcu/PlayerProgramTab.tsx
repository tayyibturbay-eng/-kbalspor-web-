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
    <div className="grid md:grid-cols-2 gap-6 tabular-nums">
      <div className="k-artik p-6 space-y-3.5">
        <div className="space-y-0.5">
          <span className="k-koz text-[10px] block">HAFTALIK İDMAN</span>
          <h2 className="k-posta text-lg sm:text-xl text-[var(--text-primary)]">
            Antrenman Programım
          </h2>
        </div>

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
              className="k-kart p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5"
            >
              <div className="font-extrabold text-sm text-[var(--text-primary)]">
                {t.title}
              </div>
              <div className="text-xs font-semibold text-[var(--text-secondary)]">
                {t.training_type === "duzenli" ? t.day_of_week : t.training_date}{" "}
                • {t.start_time}
                {t.end_time ? ` - ${t.end_time}` : ""}
              </div>
              {t.coach_name && (
                <div>
                  <span className="k-etiket k-etiket--lacivert">
                    Antrenör: {t.coach_name}
                  </span>
                </div>
              )}
              {t.location && (
                <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <span>Saha: {t.location}</span>
                  <a
                    href={buildMapsUrl(t.location)}
                    target="_blank"
                    rel="noreferrer"
                    className="k-altcizgi text-[var(--brand-ink)] font-extrabold"
                  >
                    Haritada Aç →
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="k-artik p-6 space-y-3.5">
        <div className="space-y-0.5">
          <span className="k-koz text-[10px] text-[var(--brand-red)] block">
            FİKSTÜR &amp; GÖREVLER
          </span>
          <h2 className="k-posta text-lg sm:text-xl text-[var(--brand-red)]">
            Maç &amp; Görev Takvimi
          </h2>
        </div>

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
              className="k-kart p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5"
            >
              <div className="font-extrabold text-sm text-[var(--text-primary)]">
                {task.title}
              </div>
              <div className="text-xs font-semibold text-[var(--text-secondary)]">
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
                    className="k-altcizgi text-[var(--brand-ink)] font-extrabold"
                  >
                    Haritada Aç →
                  </a>
                )}
              </div>
              {task.has_shuttle && (
                <div className="pt-0.5">
                  <span className="k-etiket k-etiket--bilgi">Servis Var</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}