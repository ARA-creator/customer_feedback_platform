#!/usr/bin/env python3
"""
Test script to simulate webhook calls from different platforms.

This helps you understand what each platform sends and test your integrations
without needing real accounts set up.
"""
import json
import requests
from datetime import datetime

BASE_URL = "http://localhost:5000"


def test_email_poll():
    """Test email polling endpoint."""
    print("\n" + "="*60)
    print("TEST 1: Email Poll")
    print("="*60)
    
    # This will use credentials from .env if configured
    response = requests.post(
        f"{BASE_URL}/integrations/email/poll",
        json={},
        timeout=30
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")


def test_whatsapp_twilio():
    """Simulate Twilio WhatsApp webhook."""
    print("\n" + "="*60)
    print("TEST 2: WhatsApp (Twilio) Webhook")
    print("="*60)
    
    # This is what Twilio actually sends
    form_data = {
        "Body": "I need help with my insurance claim. It's been 2 weeks!",
        "From": "whatsapp:+1234567890",
        "To": "whatsapp:+14155238886",
        "MessageSid": "SM" + str(int(datetime.now().timestamp())),
        "AccountSid": "AC1234567890abcdef",
    }
    
    response = requests.post(
        f"{BASE_URL}/integrations/whatsapp/twilio",
        data=form_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    print(f"\nSimulated message: '{form_data['Body']}'")
    print("Check your dashboard - should see new feedback with source='whatsapp'")


def test_instagram_webhook():
    """Simulate Instagram DM webhook."""
    print("\n" + "="*60)
    print("TEST 3: Instagram Webhook (DM)")
    print("="*60)
    
    # This is what Meta sends for Instagram DMs
    payload = {
        "entry": [{
            "id": "instagram_page_id",
            "time": int(datetime.now().timestamp()),
            "messaging": [{
                "sender": {"id": "123456789"},
                "recipient": {"id": "987654321"},
                "timestamp": int(datetime.now().timestamp() * 1000),
                "message": {
                    "mid": "mid.123456789",
                    "text": "Your service is amazing! Thank you so much!",
                }
            }]
        }]
    }
    
    response = requests.post(
        f"{BASE_URL}/integrations/instagram/webhook",
        json=payload,
        headers={"Content-Type": "application/json"},
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    print(f"\nSimulated DM: '{payload['entry'][0]['messaging'][0]['message']['text']}'")


def test_facebook_webhook():
    """Simulate Facebook Messenger webhook."""
    print("\n" + "="*60)
    print("TEST 4: Facebook Webhook (Messenger)")
    print("="*60)
    
    # This is what Meta sends for Facebook Messenger
    payload = {
        "entry": [{
            "id": "page_id",
            "time": int(datetime.now().timestamp()),
            "messaging": [{
                "sender": {"id": "123456789"},
                "recipient": {"id": "987654321"},
                "timestamp": int(datetime.now().timestamp() * 1000),
                "message": {
                    "mid": "mid.123456789",
                    "text": "I'm having trouble logging into my account. Can you help?",
                }
            }]
        }]
    }
    
    response = requests.post(
        f"{BASE_URL}/integrations/facebook/webhook",
        json=payload,
        headers={"Content-Type": "application/json"},
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    print(f"\nSimulated message: '{payload['entry'][0]['messaging'][0]['message']['text']}'")


def test_webhook_verification():
    """Test webhook verification (GET request)."""
    print("\n" + "="*60)
    print("TEST 5: Webhook Verification (Instagram)")
    print("="*60)
    
    # This is what Meta sends during webhook setup
    params = {
        "hub.mode": "subscribe",
        "hub.challenge": "test_challenge_12345",
        "hub.verify_token": "change-this-verify-token",  # Default from config
    }
    
    response = requests.get(
        f"{BASE_URL}/integrations/instagram/webhook",
        params=params,
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    print("\nIf status is 200 and response is 'test_challenge_12345', verification works!")


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("INTEGRATION TEST SUITE")
    print("="*60)
    print("\nMake sure your Flask app is running on http://localhost:5000")
    print("Press Enter to continue...")
    input()
    
    try:
        # Test webhook verification first (doesn't require real data)
        test_webhook_verification()
        
        # Test actual webhooks
        test_whatsapp_twilio()
        test_instagram_webhook()
        test_facebook_webhook()
        
        # Email poll requires real credentials, so it might fail
        print("\n" + "="*60)
        print("Note: Email poll test requires EMAIL_* credentials in .env")
        print("="*60)
        try:
            test_email_poll()
        except Exception as e:
            print(f"Email poll test skipped: {e}")
        
        print("\n" + "="*60)
        print("TESTS COMPLETE")
        print("="*60)
        print("\nCheck your dashboard at http://localhost:5000")
        print("You should see new feedback entries from the simulated webhooks!")
        
    except requests.exceptions.ConnectionError:
        print("\nERROR: Could not connect to Flask app.")
        print("Make sure 'python backend/run.py' is running on port 5000")
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
