"""Tests for Twilio WhatsApp thread sync."""

from app.integrations.whatsapp_integration import parse_twilio_outbound_record


def test_parse_twilio_outbound_record_customer_in_to():
    msg = {
        "sid": "SM123",
        "body": "Hello from officer",
        "from": "whatsapp:+14155238886",
        "to": "whatsapp:+233246052499",
        "direction": "outbound-api",
        "date_sent": "2026-08-14T10:00:00Z",
    }
    rec = parse_twilio_outbound_record(msg)
    assert rec is not None
    assert rec["thread_key"] == "+233246052499"
    assert rec["body"] == "Hello from officer"
    assert rec["message_sid"] == "SM123"
    assert rec["direction"] == "outbound"


def test_parse_twilio_outbound_record_skips_empty_body():
    assert parse_twilio_outbound_record({"body": "", "to": "whatsapp:+233200000000"}) is None


def test_parse_twilio_outbound_record_skips_non_whatsapp_to():
    assert parse_twilio_outbound_record({"body": "hi", "to": "+233200000000", "from": "whatsapp:+1"}) is None
