// Her rota değişiminde yeniden mount olur; sayfayı perdeli bir sahne
// girişiyle karşılar. Animasyon bilinçli olarak saf CSS'tir (.k-sahne-girisi):
// tüm sayfa ağacı JS-güdümlü framer animasyonuna girdiğinde sekme geçişleri
// düşük güçlü telefonlarda kare kaybediyordu. Aynı görünüm, GPU kompozitörde.

export default function RouteSahne({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="k-sahne-girisi">{children}</div>;
}
