import json
import os

locales_dir = r'H:\argus\apps\argus-mobile\assets\locales'

# Portuguese
pt = {
    "common": {"loading": "Carregando…", "error": "Erro", "cancel": "Cancelar", "ok": "OK", "delete": "Excluir", "save": "Salvar"},
    "status": {"idle": "Pronto", "thinking": "Pensando…", "error": "Erro"},
    "agentStatus": {"modelNotSet": "Modelo não definido", "connectionNotConfigured": "Conexão não configurada", "keySet": "chave definida", "noKey": "sem chave", "messages": "mensagens"},
    "settings": {"language": "Idioma", "model": "Modelo", "apiFormat": "Formato API", "connection": "CONEXÃO", "provider": "Provedor", "custom": "Personalizado", "noKey": "Sem chave", "token": "Token", "keyOptional": "Chave (opcional)", "loading": "Carregando…", "permissions": "PERMISSÕES", "stats": "ESTATÍSTICAS", "update": "ATUALIZAÇÃO", "skills": "HABILIDADES", "settingsTitle": "Configurações"},
    "workspace": {"welcomeTitle": "Como posso ajudar?", "inputPlaceholder": "Pergunte ao assistente…", "connected": "Conectado", "notConfigured": "Não configurado"},
    "messageBubble": {"copied": "Copiado", "copy": "Copiar"}
}

# Arabic
ar = {
    "common": {"loading": "جارٍ التحميل…", "error": "خطأ", "cancel": "إلغاء", "ok": "موافق", "delete": "حذف", "save": "حفظ"},
    "status": {"idle": "جاهز", "thinking": "جارٍ التفكير…", "error": "خطأ"},
    "agentStatus": {"modelNotSet": "النموذج غير محدد", "connectionNotConfigured": "الاتصال غير مهيأ", "keySet": "المفتاح محدد", "noKey": "بلا مفتاح", "messages": "رسائل"},
    "settings": {"language": "اللغة", "model": "النموذج", "apiFormat": "تنسيق API", "connection": "الاتصال", "provider": "المزود", "custom": "مخصص", "noKey": "بلا مفتاح", "token": "رمز", "keyOptional": "المفتاح (اختياري)", "loading": "جارٍ التحميل…", "permissions": "التصاريح", "stats": "الإحصائيات", "update": "التحديث", "skills": "المهارات", "settingsTitle": "الإعدادات"},
    "workspace": {"welcomeTitle": "كيف يمكنني مساعدتك؟", "inputPlaceholder": "اسأل المساعد…", "connected": "متصل", "notConfigured": "غير مهيأ"},
    "messageBubble": {"copied": "تم النسخ", "copy": "نسخ"}
}

# German
de = {
    "common": {"loading": "Laden…", "error": "Fehler", "cancel": "Abbrechen", "ok": "OK", "delete": "Löschen", "save": "Speichern"},
    "status": {"idle": "Bereit", "thinking": "Denke nach…", "error": "Fehler"},
    "agentStatus": {"modelNotSet": "Modell nicht eingestellt", "connectionNotConfigured": "Verbindung nicht konfiguriert", "keySet": "Schlüssel gesetzt", "noKey": "kein Schlüssel", "messages": "Nachrichten"},
    "settings": {"language": "Sprache", "model": "Modell", "apiFormat": "API-Format", "connection": "VERBINDUNG", "provider": "Anbieter", "custom": "Benutzerdefiniert", "noKey": "Kein Schlüssel", "token": "Token", "keyOptional": "Schlüssel (optional)", "loading": "Laden…", "permissions": "BERECHTIGUNGEN", "stats": "STATISTIKEN", "update": "AKTUALISIERUNG", "skills": "FÄHIGKEITEN", "settingsTitle": "Einstellungen"},
    "workspace": {"welcomeTitle": "Wie kann ich helfen?", "inputPlaceholder": "Fragen Sie den Assistenten…", "connected": "Verbunden", "notConfigured": "Nicht konfiguriert"},
    "messageBubble": {"copied": "Kopiert", "copy": "Kopieren"}
}

# French
fr = {
    "common": {"loading": "Chargement…", "error": "Erreur", "cancel": "Annuler", "ok": "OK", "delete": "Supprimer", "save": "Enregistrer"},
    "status": {"idle": "Prêt", "thinking": "Réflexion…", "error": "Erreur"},
    "agentStatus": {"modelNotSet": "Modèle non défini", "connectionNotConfigured": "Connexion non configurée", "keySet": "clé définie", "noKey": "pas de clé", "messages": "messages"},
    "settings": {"language": "Langue", "model": "Modèle", "apiFormat": "Format API", "connection": "CONNEXION", "provider": "Fournisseur", "custom": "Personnalisé", "noKey": "Pas de clé", "token": "Jeton", "keyOptional": "Clé (optionnel)", "loading": "Chargement…", "permissions": "AUTORISATIONS", "stats": "STATISTIQUES", "update": "MISE À JOUR", "skills": "COMPÉTENCES", "settingsTitle": "Paramètres"},
    "workspace": {"welcomeTitle": "Comment puis-je aider?", "inputPlaceholder": "Demandez à l'assistant…", "connected": "Connecté", "notConfigured": "Non configuré"},
    "messageBubble": {"copied": "Copié", "copy": "Copier"}
}

# Turkish
tr = {
    "common": {"loading": "Yükleniyor…", "error": "Hata", "cancel": "İptal", "ok": "Tamam", "delete": "Sil", "save": "Kaydet"},
    "status": {"idle": "Hazır", "thinking": "Düşünüyor…", "error": "Hata"},
    "agentStatus": {"modelNotSet": "Model ayarlanmamış", "connectionNotConfigured": "Bağlantı yapılandırılmamış", "keySet": "anahtar ayarlı", "noKey": "anahtar yok", "messages": "mesaj"},
    "settings": {"language": "Dil", "model": "Model", "apiFormat": "API Formatı", "connection": "BAĞLANTI", "provider": "Sağlayıcı", "custom": "Özel", "noKey": "Anahtar yok", "token": "Jeton", "keyOptional": "Anahtar (isteğe bağlı)", "loading": "Yükleniyor…", "permissions": "İZİNLER", "stats": "İSTATİSTİKLER", "update": "GÜNCELLEME", "skills": "BECERİLER", "settingsTitle": "Ayarlar"},
    "workspace": {"welcomeTitle": "Nasıl yardımcı olabilirim?", "inputPlaceholder": "Asistana sor…", "connected": "Bağlı", "notConfigured": "Yapılandırılmamış"},
    "messageBubble": {"copied": "Kopyalandı", "copy": "Kopyala"}
}

# Korean
ko = {
    "common": {"loading": "로딩 중…", "error": "오류", "cancel": "취소", "ok": "확인", "delete": "삭제", "save": "저장"},
    "status": {"idle": "준비", "thinking": "생각 중…", "error": "오류"},
    "agentStatus": {"modelNotSet": "모델 미설정", "connectionNotConfigured": "연결 미설정", "keySet": "키 설정됨", "noKey": "키 없음", "messages": "메시지"},
    "settings": {"language": "언어", "model": "모델", "apiFormat": "API 형식", "connection": "연결", "provider": "제공자", "custom": "사용자 지정", "noKey": "키 없음", "token": "토큰", "keyOptional": "키 (선택)", "loading": "로딩 중…", "permissions": "권한", "stats": "통계", "update": "업데이트", "skills": "스킬", "settingsTitle": "설정"},
    "workspace": {"welcomeTitle": "도와드릴까요?", "inputPlaceholder": "어시스턴트에게 물어보세요…", "connected": "연결됨", "notConfigured": "미설정"},
    "messageBubble": {"copied": "복사됨", "copy": "복사"}
}

# Japanese
ja = {
    "common": {"loading": "読み込み中…", "error": "エラー", "cancel": "キャンセル", "ok": "OK", "delete": "削除", "save": "保存"},
    "status": {"idle": "準備完了", "thinking": "思考中…", "error": "エラー"},
    "agentStatus": {"modelNotSet": "モデル未設定", "connectionNotConfigured": "接続未設定", "keySet": "キー設定済み", "noKey": "キーなし", "messages": "メッセージ"},
    "settings": {"language": "言語", "model": "モデル", "apiFormat": "API形式", "connection": "接続", "provider": "プロバイダー", "custom": "カスタム", "noKey": "キーなし", "token": "トークン", "keyOptional": "キー（オプション）", "loading": "読み込み中…", "permissions": "権限", "stats": "統計", "update": "更新", "skills": "スキル", "settingsTitle": "設定"},
    "workspace": {"welcomeTitle": "お手伝いできますか？", "inputPlaceholder": "アシスタントに質問…", "connected": "接続済み", "notConfigured": "未設定"},
    "messageBubble": {"copied": "コピーしました", "copy": "コピー"}
}

# Polish
pl = {
    "common": {"loading": "Ładowanie…", "error": "Błąd", "cancel": "Anuluj", "ok": "OK", "delete": "Usuń", "save": "Zapisz"},
    "status": {"idle": "Gotowy", "thinking": "Myślę…", "error": "Błąd"},
    "agentStatus": {"modelNotSet": "Model nie ustawiony", "connectionNotConfigured": "Połączenie nie skonfigurowane", "keySet": "klucz ustawiony", "noKey": "brak klucza", "messages": "wiadomości"},
    "settings": {"language": "Język", "model": "Model", "apiFormat": "Format API", "connection": "POŁĄCZENIE", "provider": "Dostawca", "custom": "Niestandardowy", "noKey": "Brak klucza", "token": "Token", "keyOptional": "Klucz (opcjonalny)", "loading": "Ładowanie…", "permissions": "UPRAWNIENIA", "stats": "STATYSTYKI", "update": "AKTUALIZACJA", "skills": "UMIEJĘTNOŚCI", "settingsTitle": "Ustawienia"},
    "workspace": {"welcomeTitle": "Jak mogę pomóc?", "inputPlaceholder": "Zapytaj asystenta…", "connected": "Połączono", "notConfigured": "Nieskonfigurowane"},
    "messageBubble": {"copied": "Skopiowano", "copy": "Kopiuj"}
}

# Vietnamese
vi = {
    "common": {"loading": "Đang tải…", "error": "Lỗi", "cancel": "Hủy", "ok": "OK", "delete": "Xóa", "save": "Lưu"},
    "status": {"idle": "Sẵn sàng", "thinking": "Đang suy nghĩ…", "error": "Lỗi"},
    "agentStatus": {"modelNotSet": "Chưa đặt mô hình", "connectionNotConfigured": "Chưa cấu hình kết nối", "keySet": "đã đặt khóa", "noKey": "không có khóa", "messages": "tin nhắn"},
    "settings": {"language": "Ngôn ngữ", "model": "Mô hình", "apiFormat": "Định dạng API", "connection": "KẾT NỐI", "provider": "Nhà cung cấp", "custom": "Tùy chỉnh", "noKey": "Không có khóa", "token": "Mã thông báo", "keyOptional": "Khóa (tùy chọn)", "loading": "Đang tải…", "permissions": "QUYỀN", "stats": "THỐNG KÊ", "update": "CẬP NHẬT", "skills": "KỸ NĂNG", "settingsTitle": "Cài đặt"},
    "workspace": {"welcomeTitle": "Tôi có thể giúp gì?", "inputPlaceholder": "Hỏi trợ lý…", "connected": "Đã kết nối", "notConfigured": "Chưa cấu hình"},
    "messageBubble": {"copied": "Đã sao chép", "copy": "Sao chép"}
}

# Thai
th = {
    "common": {"loading": "กำลังโหลด…", "error": "ข้อผิดพลาด", "cancel": "ยกเลิก", "ok": "ตกลง", "delete": "ลบ", "save": "บันทึก"},
    "status": {"idle": "พร้อม", "thinking": "กำลังคิด…", "error": "ข้อผิดพลาด"},
    "agentStatus": {"modelNotSet": "ยังไม่ได้ตั้งค่าโมเดล", "connectionNotConfigured": "ยังไม่ได้ตั้งค่าการเชื่อมต่อ", "keySet": "ตั้งค่าคีย์แล้ว", "noKey": "ไม่มีคีย์", "messages": "ข้อความ"},
    "settings": {"language": "ภาษา", "model": "โมเดล", "apiFormat": "รูปแบบ API", "connection": "การเชื่อมต่อ", "provider": "ผู้ให้บริการ", "custom": "กำหนดเอง", "noKey": "ไม่มีคีย์", "token": "โทเค็น", "keyOptional": "คีย์ (ไม่บังคับ)", "loading": "กำลังโหลด…", "permissions": "สิทธิ์", "stats": "สถิติ", "update": "อัปเดต", "skills": "ทักษะ", "settingsTitle": "การตั้งค่า"},
    "workspace": {"welcomeTitle": "ช่วยอะไรได้บ้าง?", "inputPlaceholder": "ถามผู้ช่วย…", "connected": "เชื่อมต่อแล้ว", "notConfigured": "ยังไม่ได้ตั้งค่า"},
    "messageBubble": {"copied": "คัดลอกแล้ว", "copy": "คัดลอก"}
}

# Indonesian
id = {
    "common": {"loading": "Memuat…", "error": "Kesalahan", "cancel": "Batal", "ok": "OK", "delete": "Hapus", "save": "Simpan"},
    "status": {"idle": "Siap", "thinking": "Berpikir…", "error": "Kesalahan"},
    "agentStatus": {"modelNotSet": "Model belum diatur", "connectionNotConfigured": "Koneksi belum dikonfigurasi", "keySet": "kunci diatur", "noKey": "tanpa kunci", "messages": "pesan"},
    "settings": {"language": "Bahasa", "model": "Model", "apiFormat": "Format API", "connection": "KONEKSI", "provider": "Penyedia", "custom": "Kustom", "noKey": "Tanpa kunci", "token": "Token", "keyOptional": "Kunci (opsional)", "loading": "Memuat…", "permissions": "IZIN", "stats": "STATISTIK", "update": "PEMBARUAN", "skills": "KETERAMPILAN", "settingsTitle": "Pengaturan"},
    "workspace": {"welcomeTitle": "Apa yang bisa saya bantu?", "inputPlaceholder": "Tanya asisten…", "connected": "Tersambung", "notConfigured": "Belum dikonfigurasi"},
    "messageBubble": {"copied": "Disalin", "copy": "Salin"}
}

# Persian (Farsi)
fa = {
    "common": {"loading": "در حال بارگذاری…", "error": "خطا", "cancel": "لغو", "ok": "باشه", "delete": "حذف", "save": "ذخیره"},
    "status": {"idle": "آماده", "thinking": "در حال فکر کردن…", "error": "خطا"},
    "agentStatus": {"modelNotSet": "مدل تنظیم نشده", "connectionNotConfigured": "اتصال پیکربندی نشده", "keySet": "کلید تنظیم شده", "noKey": "بدون کلید", "messages": "پیام"},
    "settings": {"language": "زبان", "model": "مدل", "apiFormat": "فرمت API", "connection": "اتصال", "provider": "ارائه‌دهنده", "custom": "سفارشی", "noKey": "بدون کلید", "token": "توکن", "keyOptional": "کلید (اختیاری)", "loading": "در حال بارگذاری…", "permissions": "مجوزها", "stats": "آمار", "update": "به‌روزرسانی", "skills": "مهارت‌ها", "settingsTitle": "تنظیمات"},
    "workspace": {"welcomeTitle": "چطور می‌تونم کمک کنم؟", "inputPlaceholder": "از دستیار بپرسید…", "connected": "متصل", "notConfigured": "پیکربندی نشده"},
    "messageBubble": {"copied": "کپی شد", "copy": "کپی"}
}

# Save all
for lang_code, lang_data in [('pt', pt), ('ar', ar), ('de', de), ('fr', fr), ('tr', tr), ('ko', ko), ('ja', ja), ('pl', pl), ('vi', vi), ('th', th), ('id', id), ('fa', fa)]:
    filepath = os.path.join(locales_dir, f'{lang_code}.json')
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(lang_data, f, ensure_ascii=False, indent=2)
    print(f'Created {lang_code}.json')

print(f'\nCreated 12 more locale files')
