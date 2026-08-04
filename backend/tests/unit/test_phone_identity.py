"""Ghana phone forms (+233 / 233 / 0…) must resolve to one customer identity."""

from app.services.metadata_normalization import format_phone_display, normalize_phone_identity, phone_identity_variants


def test_ghana_phone_forms_canonicalize_together():
    expected = "+233547890122"
    assert normalize_phone_identity("+233547890122") == expected
    assert normalize_phone_identity("233547890122") == expected
    assert normalize_phone_identity("0547890122") == expected
    assert normalize_phone_identity("547890122") == expected
    assert normalize_phone_identity("whatsapp:+233547890122") == expected
    assert normalize_phone_identity("phone:0547890122") == expected


def test_phone_identity_variants_cover_local_and_intl():
    variants = phone_identity_variants("0547890122")
    assert "phone:+233547890122" in variants
    assert "phone:233547890122" in variants
    assert "phone:0547890122" in variants
    assert "wa:+233547890122" in variants
    assert "wa:0547890122" in variants


def test_variants_from_intl_include_local_zero_form():
    variants = set(phone_identity_variants("+233246052499"))
    assert "phone:+233246052499" in variants
    assert "phone:0246052499" in variants
    assert "phone:246052499" in variants


def test_format_phone_display_prefers_local_zero():
    assert format_phone_display('+233246052499') == '0246052499'
    assert format_phone_display('233246052499') == '0246052499'
    assert format_phone_display('0246052499') == '0246052499'
