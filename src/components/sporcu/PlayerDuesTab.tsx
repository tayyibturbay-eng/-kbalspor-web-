export type DueDisplayItem = {
  monthLabel: string;
  amount: number;
  state: "paid" | "overdue" | "unpaid" | "upcoming";
};

interface PlayerDuesTabProps {
  dueItems: DueDisplayItem[];
  overdueCount: number;
}

export function PlayerDuesTab({ dueItems, overdueCount }: PlayerDuesTabProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
      <h2 className="text-lg font-black text-[#02274c]">Aidat Durumum</h2>

      {overdueCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-extrabold">
          ⚠️ Geçmiş dönemden gecikmiş {overdueCount} adet aidat ödemeniz
          bulunmaktadır. Lütfen yöneticinizle iletişime geçin.
        </div>
      )}

      <div className="space-y-2.5">
        {dueItems.map((item) => (
          <div
            key={item.monthLabel}
            className={`flex items-center justify-between p-4 rounded-2xl border ${
              item.state === "overdue"
                ? "bg-red-50 border-red-200"
                : item.state === "unpaid"
                ? "bg-amber-50 border-amber-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div>
              <div className="font-extrabold text-slate-900">
                {item.monthLabel}
              </div>
              <div className="text-xs text-slate-600">
                {item.amount} TL
                {item.state === "overdue" && " • Ödeme süresi geçti"}
                {item.state === "unpaid" && " • Güncel dönem ödemesi"}
              </div>
            </div>

            {item.state === "paid" && (
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                ✓ Ödendi
              </span>
            )}
            {item.state === "unpaid" && (
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-200 text-amber-950">
                Ödenmedi
              </span>
            )}
            {item.state === "overdue" && (
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-red-600 text-white">
                ⚠️ Gecikti
              </span>
            )}
            {item.state === "upcoming" && (
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-200 text-slate-700">
                Bekleniyor
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}