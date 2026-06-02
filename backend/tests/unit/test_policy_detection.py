"""Policy detection: avoid false product name matches from HTML/CSS."""

from app.services.policy_detection import detect_policies


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
    assert any("•••••" in (p.masked or "") for p in policies)
