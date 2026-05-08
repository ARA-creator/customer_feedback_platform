from app.services.sentiment import analyze_sentiment


CASES = [
    ("My claim was processed quickly and the payout was received on time.", "positive"),
    ("The customer service representative was very helpful and explained everything clearly.", "positive"),
    ("I renewed my policy easily without any issues.", "positive"),
    ("The claims team kept me updated throughout the process.", "positive"),
    ("I appreciate how fast the hospital authorization was approved.", "positive"),
    ("The mobile app made premium payment very convenient.", "positive"),
    ("My agent responded immediately and resolved my concern.", "positive"),
    ("The settlement amount was fair and paid promptly.", "positive"),
    ("Policy onboarding was smooth and straightforward.", "positive"),
    ("The support team handled my complaint professionally.", "positive"),
    ("I finally received my policy document.", "neutral"),
    ("My claim is currently under review.", "neutral"),
    ("The premium has been updated for the next renewal cycle.", "neutral"),
    ("I visited the branch to request additional information.", "neutral"),
    ("The underwriting process is still ongoing.", "neutral"),
    ("The payment is pending confirmation.", "neutral"),
    ("I was asked to submit additional medical documents.", "neutral"),
    ("The policy will expire next month.", "neutral"),
    ("Customer support said they will get back to me.", "neutral"),
    ("The request has been forwarded to the claims department.", "neutral"),
    ("My claim has been delayed for over a month.", "negative"),
    ("Nobody is responding to my emails regarding the claim.", "negative"),
    ("The premium increase is too high this year.", "negative"),
    ("My policy was cancelled without proper notice.", "negative"),
    ("The payout process has been frustrating and slow.", "negative"),
    ("I have called several times and still have no resolution.", "negative"),
    ("The claim was declined without a clear explanation.", "negative"),
    ("The waiting period was not explained to me properly.", "negative"),
    ("The mobile app keeps failing whenever I try to make payment.", "negative"),
    ("I regret taking this insurance policy.", "negative"),
    ("The branch staff were rude and unprofessional.", "negative"),
    ("My refund has still not been processed.", "negative"),
    ("I am disappointed with how my complaint was handled.", "negative"),
    ("The claims officer keeps giving conflicting information.", "negative"),
    ("This is the worst claims experience I have ever had.", "negative"),
    ("The agent stopped responding after I purchased the policy.", "negative"),
    ("I have been waiting weeks for approval.", "negative"),
    ("The policy terms were misleading.", "negative"),
    ("I may cancel my policy if this issue continues.", "negative"),
    ("The delay in settlement has caused serious inconvenience.", "negative"),
    ("Thank you for resolving my issue so quickly.", "positive"),
    ("The renewal reminder helped me avoid policy lapse.", "positive"),
    ("The claim approval process was seamless.", "positive"),
    ("Your digital platform is easy to use.", "positive"),
    ("The reimbursement was faster than expected.", "positive"),
    ("Everything has been submitted successfully.", "neutral"),
    ("The customer requested a change of beneficiary.", "neutral"),
    ("The policy is active until December.", "neutral"),
    ("The complaint has been escalated for further review.", "neutral"),
    ("The insurer requested additional verification before approval.", "neutral"),
]


def test_insurance_sentiment_dataset_labels():
    for msg, expected in CASES:
        r = analyze_sentiment(msg, source="api", insurance_tags=None)
        assert r["label"] == expected, (msg, r)

