"""Policy detection: avoid false product name matches from HTML/CSS."""

from app.services.policy_detection import build_policy_scan_text, detect_policies, summarize_policy_matches


def test_html_transition_css_does_not_name_match():
    html = """<!DOCTYPE html><html><head><style>
    a { transition: opacity 0.3s ease; display: block; }
    </style></head><body>
    <p>Return Initiated - Order KNT-1780368507344-000</p>
    </body></html>"""
    policies, debug = detect_policies(html)
    name_matches = [p for p in policies if "(name match)" in (p.masked or "")]
    assert name_matches == []
    assert debug.get("product_name_candidates", 0) == 0


def test_visible_transition_product_name_still_matches():
    msg = "I want to switch to the Transition plan for my family cover."
    policies, _ = detect_policies(msg)
    name_matches = [p for p in policies if "(name match)" in (p.masked or "")]
    assert len(name_matches) >= 1
    assert any(p.product_group == "TRANSITION" for p in name_matches)


def test_policy_number_still_detected_in_plain_text():
    msg = "Please update policy GH9V1234567 for my claim."
    policies, debug = detect_policies(msg)
    assert debug.get("policy_number_candidates", 0) >= 1
    assert any(p.product_prefix == "GH9V" for p in policies)


def test_ba2v_maps_to_boafo_pa_funeral():
    msg = "BA2V0007327. I have been wrongfully deducted this policy from my last money in the account"
    policies, debug = detect_policies(msg)
    assert debug.get("policy_number_candidates", 0) >= 1
    hit = next(p for p in policies if p.product_prefix == "BA2V")
    assert hit.policy_number == "BA2V0007327"
    assert hit.product_group == "BOAFO-PA FUNERAL POLICIES"


def test_policy_number_hint_field_detected_without_being_in_message():
    scan = build_policy_scan_text("My claim is still pending", ["GH9V1234567"])
    policies, debug = detect_policies(scan)
    assert debug.get("policy_number_candidates", 0) >= 1
    assert any(p.product_prefix == "GH9V" for p in policies)


def test_summarize_policy_matches_verified_vs_estimated():
    verified = summarize_policy_matches(
        [{"policy_masked": "GH9V•••••567", "is_primary": True, "product_group": "TRANSITION"}]
    )
    assert verified["policy_holder_status"] == "verified"
    assert verified["has_policy_number"] is True

    estimated = summarize_policy_matches(
        [{"policy_masked": "GH9V:TRANSITION (name match)", "is_primary": True, "product_group": "TRANSITION"}]
    )
    assert estimated["policy_holder_status"] == "estimated"
    assert estimated["has_policy_number"] is False


def test_short_and_standard_policy_digits_dedupe():
    short, _ = detect_policies("Please update EB2V000024 today")
    full, _ = detect_policies("Please update EB2V0000024 today")
    assert short and full
    assert short[0].policy_number == full[0].policy_number == "EB2V0000024"
    assert short[0].policy_hash == full[0].policy_hash
