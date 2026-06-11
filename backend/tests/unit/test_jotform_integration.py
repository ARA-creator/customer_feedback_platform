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
    assert result["source"] == "jotform"
    assert "category" not in result
    assert "rating" not in result


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


def test_parse_jotform_from_pretty_summary():
    pretty = (
        "Name:Araba  Eshun, Email:lexietate10@gmail.com, Give your feedback.:The claims process took too long, "
        "Which category does your feedback fall in?:Claims, Do you mind if we recorded your feedback for analysis?:Yes"
    )
    result = parse_jotform_submission(
        form_id="261602995063056",
        submission_id="sub-2",
        pretty=pretty,
        raw_request={},
    )
    assert result is not None
    assert result["message"] == "The claims process took too long"
    assert result["email"] == "lexietate10@gmail.com"
    assert result["channel_metadata"]["customer_name"] == "Araba Eshun"
    assert result["channel_metadata"]["sender_email"] == "lexietate10@gmail.com"
    assert "category" not in result
    assert "recording_consent" not in result["channel_metadata"]


def test_parse_jotform_nested_raw_request_uses_human_labels():
    raw = {
        "q3_name": {
            "name": "name",
            "text": "Name",
            "type": "control_fullname",
            "answer": {"first": "Araba", "last": "Eshun"},
        },
        "q4_email": {
            "name": "email",
            "text": "Email",
            "type": "control_email",
            "answer": "lexietate10@gmail.com",
        },
        "q5_feedback": {
            "name": "feedback",
            "text": "Give your feedback.",
            "type": "control_textarea",
            "answer": "The claims process took too long",
        },
        "q6_category": {
            "name": "category",
            "text": "Which category does your feedback fall in?",
            "type": "control_dropdown",
            "answer": "Claims",
        },
    }
    result = parse_jotform_submission(form_id="261602995063056", submission_id="sub-3", raw_request=raw)
    assert result is not None
    assert result["message"] == "The claims process took too long"
    assert result["email"] == "lexietate10@gmail.com"
    assert result["channel_metadata"]["customer_name"] == "Araba Eshun"
    assert "category" not in result


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
    assert result["channel_metadata"]["customer_name"] == "Ama Mensah"
    assert "category" not in result
    assert "recording_consent" not in result["channel_metadata"]


def test_parse_jotform_extracts_policy_number_field():
    answers = {
        "First Name": "Kofi",
        "Last Name": "Asante",
        "Email": "kofi@example.com",
        "Give your feedback.": "My claim is still pending",
        "Policy Number": "GH9V1234567",
    }
    result = parse_jotform_submission(form_id="261602995063056", submission_id="sub-4", raw_request=answers)
    assert result is not None
    assert result["message"] == "My claim is still pending"
    assert result["policy_number_hints"] == ["GH9V1234567"]
    assert "GH9V1234567" not in result["message"]


def test_parse_jotform_ignores_non_feedback_fields_without_message():
    pretty = "Name:Jane Doe, Email:jane@example.com, Which category does your feedback fall in?:Claims"
    result = parse_jotform_submission(pretty=pretty, raw_request={})
    assert result is None
