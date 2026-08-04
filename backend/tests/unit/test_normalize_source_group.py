from app.services.prioritization import normalize_source_group


def test_whatsapp_before_mail_heuristic():
    assert normalize_source_group("whatsapp") == "whatsapp"


def test_voicemail_not_grouped_as_email():
    assert normalize_source_group("voicemail") != "email"
    assert normalize_source_group("voicemail") == "voicemail"


def test_email_still_normalized():
    assert normalize_source_group("email") == "email"
    assert normalize_source_group("gmail_forward") == "email"


def test_hnw_and_cx_mailbox_labels():
    assert normalize_source_group("hnw_email") == "hnw_email"
    assert normalize_source_group("HNW email") == "hnw_email"
    assert normalize_source_group("cx") == "cx"
    assert normalize_source_group("cx_email") == "cx"
