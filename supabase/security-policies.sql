-- ═══════════════════════════════════════════════════════════════════════════
-- ÇORUM İKBAL SPOR — SUPABASE RLS GÜVENLİK BETİĞİ (Uygulamaya birebir uyumlu)
-- ═══════════════════════════════════════════════════════════════════════════
-- 25.11.2026 • Kod tabanlı erişim haritasından türetildi, idempotenttir
-- (birden fazla kez çalıştırılabilir). Supabase Dashboard → SQL Editor.
--
-- MİMARİ GERÇEKLERİ (kod denetimiyle doğrulandı):
--  • Yönetici  → Supabase e-posta/şifre oturumu (role = authenticated).
--  • Antrenör  → PIN girişi (web API üzerinden) → Supabase'e ANON yazar.
--  • Sporcu    → PIN girişi → Supabase'e ANON yazar (PIN/foto/yoklama/tahmin).
--  • Sunucu API uçları → SUPABASE_SERVICE_ROLE_KEY tanımlı DEĞİLSE anon'a
--    düşer; bu yüzden push-token ve görev tabloları anon'a kapalı olamaz.
--  Bu nedenle koç/sporcu yazan tablolar bugünkü işleyişi bozmamak için
--  anon'a açıktır; gerçek rol ayrımı FAZ 2'de (koçları auth.users'a taşıyınca)
--  sıkılaştırılabilir. Betik yine de ciddi sertleştirme getirir:
--    – RLS tüm tablolarda açık (şema kazaları/veri sızıntıları tavan altında)
--    – Yöneticiye özel tablolar (coaches, dues, envanter x3, club_settings,
--      membership yönetimi, log yönetimi, oyuncu ekle/sil) auth'a kilitli
--    – Form/token kayıtlarında WITH CHECK biçim kuralları
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1) RLS'i aç (var olmayan tablo atlansın) ───────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'players','coaches','membership_requests','activity_logs',
    'player_push_tokens','admin_push_tokens','tasks_assignments',
    'trainings','prayer_sessions','prayer_attendance',
    'match_predictions','match_results','dues',
    'equipment_stock','equipment_logs','jersey_sets',
    'club_messages','club_settings'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ─── 2) Yalnız bu 18 tablonun eski politikalarını temizle (idempotent) ───────
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'players','coaches','membership_requests','activity_logs',
        'player_push_tokens','admin_push_tokens','tasks_assignments',
        'trainings','prayer_sessions','prayer_attendance',
        'match_predictions','match_results','dues',
        'equipment_stock','equipment_logs','jersey_sets',
        'club_messages','club_settings')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- ─── 3) OKUMA ────────────────────────────────────────────────────────────────
-- Vitrin modeli: kadro/program/sonuç/duyuru kamusaldır.
CREATE POLICY "oyuncu_oku"     ON public.players           FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "gorev_oku"      ON public.tasks_assignments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "antrenman_oku"  ON public.trainings         FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sonuc_oku"      ON public.match_results     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "duyuru_oku"     ON public.club_messages     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ayar_oku"       ON public.club_settings     FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "qr_oturum_oku"  ON public.prayer_sessions   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "yoklama_oku"    ON public.prayer_attendance FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tahmin_oku"     ON public.match_predictions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "aidat_oku"      ON public.dues              FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "env_stok_oku"   ON public.equipment_stock   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "env_log_oku"    ON public.equipment_logs    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "form_oku"       ON public.jersey_sets       FOR SELECT TO anon, authenticated USING (true);
-- Token tabloları sunucu API ucu + yönetici oturumuyla da okunur
-- (send-push ucu yönetici Bearer'ı ile authenticated rolüne düşebilir):
CREATE POLICY "ptoken_oku"     ON public.player_push_tokens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "atoken_oku"     ON public.admin_push_tokens  FOR SELECT TO anon, authenticated USING (true);
-- Antrenör listesi sporcu/koç ekranlarında da okunur (eğitim atama, kadro):
CREATE POLICY "antrenor_oku"   ON public.coaches            FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "uye_oku"        ON public.membership_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "log_oku"        ON public.activity_logs      FOR SELECT TO authenticated USING (true);

-- ─── 4) SPORCU/AİDAT/ÜYELİK YAZMALARI (anon zorunlu — bugünkü akış) ─────────
-- Üyelik formu: biçim kuralları WITH CHECK'te (bot/garbage süzgeci)
CREATE POLICY "uye_yaz" ON public.membership_requests FOR INSERT TO anon, authenticated
  WITH CHECK (length(trim(full_name)) BETWEEN 2 AND 100
              AND length(trim(parent_phone)) BETWEEN 7 AND 24);

-- Faaliyet günlüğü yalnız eklenir (denetim izi), silinemez:
CREATE POLICY "log_yaz" ON public.activity_logs FOR INSERT TO anon, authenticated
  WITH CHECK (length(actor) <= 80 AND length(action) <= 60);

-- Push token kayıtları: gerçek Expo token'ı olmalı; cihaz kendini günceller:
CREATE POLICY "ptoken_yaz" ON public.player_push_tokens FOR INSERT TO anon, authenticated
  WITH CHECK (expo_push_token LIKE 'ExponentPushToken%');
CREATE POLICY "ptoken_guncelle" ON public.player_push_tokens FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (expo_push_token LIKE 'ExponentPushToken%');
CREATE POLICY "ptoken_sil" ON public.player_push_tokens FOR DELETE TO anon, authenticated
  USING (expo_push_token LIKE 'ExponentPushToken%');
CREATE POLICY "atoken_yaz" ON public.admin_push_tokens FOR INSERT TO anon, authenticated
  WITH CHECK (expo_push_token LIKE 'ExponentPushToken%');
CREATE POLICY "atoken_guncelle" ON public.admin_push_tokens FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (expo_push_token LIKE 'ExponentPushToken%');
CREATE POLICY "atoken_sil" ON public.admin_push_tokens FOR DELETE TO anon, authenticated
  USING (expo_push_token LIKE 'ExponentPushToken%');

-- Sporcu kendi PIN/foto/kart özelleştirmesini günceller (ekran kilidi PIN'de):
CREATE POLICY "oyuncu_guncelle" ON public.players FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

-- QR yoklama yazma + koç seansı yönetimi:
CREATE POLICY "yoklama_tam" ON public.prayer_attendance FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "qr_seans" ON public.prayer_sessions FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Tahmin: upsert (INSERT+UPDATE) + ödül talebi güncellemesi:
CREATE POLICY "tahmin_yaz" ON public.match_predictions FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "tahmin_guncelle" ON public.match_predictions FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

-- ─── 5) KOÇ PANOSU YAZMALARI (anon: koç PIN'li, Supabase oturumu yok) ──────
CREATE POLICY "gorev_tam"   ON public.tasks_assignments FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "antrenman_tam" ON public.trainings FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "duyuru_tam"  ON public.club_messages FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
-- Maç sonucu sekmesi rol filtresiz (koç da girer):
CREATE POLICY "sonuc_tam"   ON public.match_results FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- ─── 6) YALNIZ YÖNETİCİ (authenticated) — ANON YAZAMAZ ──────────────────────
-- Antrenör tanımı yalnız yöneticiden; aidat; envanter x3; kulüp ayarları;
-- sporcu ekle/sil; üyelik onay/red; log temizliği:
CREATE POLICY "antrenor_yonet"  ON public.coaches           FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "oyuncu_ekle_sil" ON public.players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "oyuncu_sil"      ON public.players FOR DELETE TO authenticated USING (true);
CREATE POLICY "aidat_yonet"     ON public.dues             FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "env_stok_yonet"  ON public.equipment_stock  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "env_log_yonet"   ON public.equipment_logs   FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "form_yonet"      ON public.jersey_sets      FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "ayar_yonet"      ON public.club_settings    FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "uye_yonet"       ON public.membership_requests FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "log_sil"         ON public.activity_logs    FOR DELETE TO authenticated USING (true);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- UYGULAMA SONRASI DOĞRULAMA (ayrı sorgu olarak çalıştırın):
--
-- A) 18 tabloda da RLS açık mı? (relrowsecurity = false olan gelmemeli)
--    SELECT relname FROM pg_class
--    WHERE relnamespace='public'::regnamespace AND relkind='r'
--      AND relrowsecurity = FALSE;
--
-- B) Politika dökümü:
--    SELECT tablename, cmd, roles, policyname FROM pg_policies
--    WHERE schemaname='public' ORDER BY tablename, cmd;
--
-- HIZLI CANLI TEST: Web'de admin dışı bir sekmeden (ör. sporcu PIN güncelle,
-- antrenör görev ekle, bildirim gönder) birer işlem yapıp akışın bozulmadığını
-- doğrulayın. Sonra YÖNETİCİ panelinden antrenör ekleyip envanter yazın.
--
-- FAZ 2 (ileride): antrenörleri Supabase auth.users'a taşıyın; buradaki
-- "koç panosu yazmaları (anon)" bloğunu TO authenticated'a çevirip USING
-- içine rol claim'i kontrolü ekleyin. SUPABASE_SERVICE_ROLE_KEY'i sunucuya
-- tanımladığınızda API uçları otomatik olarak yönetici ayrıcalığına geçer.
-- ═══════════════════════════════════════════════════════════════════════════
