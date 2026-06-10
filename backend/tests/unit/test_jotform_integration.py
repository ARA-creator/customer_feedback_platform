import json

from app.integrations.jotform_integration import parse_jotform_submission, parse_jotform_webhook_request


def test_parse_jotform_raw_request_flat_fields():
    raw = {
        "q3_feedback": "Claims process was slow",
        "q4_email": "customer@example.com",
        "q5_rating": "2",
    }
    result = parse_jotform_submission(form_id="123", submission_id="456", raw_request=raw)
    assert result is not None
    assert result["message"] == "Claims process was slow"
    assert result["email"] == "customer@example.com"
    assert result["rating"] == 2
    assert result["source"] == "jotform"


def test_parse_jotform_multipart_form():
    raw = json.dumps({"q3_feedback": "Great service", "q4_email": "a@b.com"})
    form = {
        "formID": "999",
        "submissionID": "888",
        "rawRequest": raw,
        "pretty": "feedback: Great service",
    }
    result = parse_jotform_webhook_request(form)
    assert result is not None
    assert result["message"] == "Great service"
    assert result["channel_metadata"]["form_id"] == "999"
    assert result["channel_metadata"]["submission_id"] == "888"


def test_parse_jotform_json_payload():
    payload = {
        "form_id": "f1",
        "submission_id": "s1",
        "message": "Direct JSON test",
        "email": "test@example.com",
    }
    result = parse_jotform_webhook_request({}, json_payload=payload)
    assert result is not None
    assert result["message"] == "Direct JSON test"


def test_parse_enterprise_life_customer_pulse_form():
    answers = {
        "First Name": "Ama",
        "Last Name": "Mensah",
        "Give your feedback.": "Claims took too long to process",
        "Which category does your feedback fall in?": "Other",
        "If other, what does your complaint fall under": "Maturity payout delay",
        "Do you mind if we recorded your feedback for analysis?": "Yes",
    }
    result = parse_jotform_submission(form_id="261602995063056", submission_id="sub-1", raw_request=answers)
    assert result is not None
    assert result["message"] == "Claims took too long to process"
    assert result["category"] == "Maturity payout delay"
    assert result["channel_metadata"]["customer_name"] == "Ama Mensah"
    assert result["channel_metadata"]["recording_consent"] == "Yes"
