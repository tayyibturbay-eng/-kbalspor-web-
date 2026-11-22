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
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-black text-[#02274c]">Antrenman Programım</h2>
        {trainings.length === 0 ? (
          <p className="text-sm text-slate-500">Kayıtlı antrenman bulunamadı.</p>
        ) : (
          trainings.map((t) => (
            <div
              key={t.id}
              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1"
            >
              <div className="font-extrabold text-slate-900">{t.title}</div>
              <div className="text-xs text-slate-600">
                {t.training_type === "duzenli" ? t.day_of_week : t.training_date}{" "}
                • {t.start_time}
                {t.end_time ? ` - ${t.end_time}` : ""}
              </div>
              {t.coach_name && (
                <div className="text-xs font-bold text-[#02274c]">
                  Antrenör: {t.coach_name}
                </div>
              )}
              {t.location && (
                <div className="text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
                  <span>Saha: {t.location}</span>
                  <a
                    href={buildMapsUrl(t.location)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#02274c] font-bold underline"
                  >
                    Haritada Aç
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-black text-[#a60513]">Maç &amp; Görev Takvimi</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500">Yaklaşan maç veya görev yok.</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1"
            >
              <div className="font-extrabold text-slate-900">{task.title}</div>
              <div className="text-xs text-slate-600">
                {task.event_date} {task.match_time ? `• ${task.match_time}` : ""}
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
                <span>Yer: {task.location}</span>
                {task.location && (
                  <a
                    href={buildMapsUrl(task.location)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#02274c] font-bold underline"
                  >
                    Haritada Aç
                  </a>
                )}
              </div>
              {task.has_shuttle && (
                <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
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