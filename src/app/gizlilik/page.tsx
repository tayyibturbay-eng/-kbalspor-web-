import { redirect } from "next/navigation";

// Eski adres: Google Play konsolunda ve eski paylaşım bağlantılarında bu yol
// kullanılmış olabileceği için kalıcı yönlendirme korunur.
export default function GizlilikEskiAdres() {
  redirect("/gizlilik-politikasi");
}
