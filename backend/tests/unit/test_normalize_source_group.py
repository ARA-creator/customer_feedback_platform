from app.services.prioritization import normalize_source_group


def test_whatsapp_before_mail_heuristic():
    assert normalize_source_group("whatsapp") == "whatsapp"


def test_voicemail_not_grouped_as_email():
    assert normalize_source_group("voicemail") != "email"
    assert normalize_source_group("voicemail") == "voicemail"


def test_email_still_normalized():
    assert normalize_source_group("email") == "email"
    assert normalize_source_group("gmail_forward") == "email"
