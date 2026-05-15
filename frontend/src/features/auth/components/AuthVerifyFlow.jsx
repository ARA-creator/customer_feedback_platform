import { useState } from 'react'
import AuthVerifyEmailPrompt from './AuthVerifyEmailPrompt'
import AuthVerifyInline from './AuthVerifyInline'

export default function AuthVerifyFlow({
  email,
  onEmailChange,
  showEmailField,
  onBack,
  onSuccess,
  codeSent = false,
  initialStep = 'prompt',
}) {
  const [step, setStep] = useState(initialStep)

  if (step === 'prompt') {
    return (
      <AuthVerifyEmailPrompt
        email={email}
        codeSent={codeSent}
        onEnterCode={() => setStep('code')}
        onBack={onBack}
      />
    )
  }

  return (
    <AuthVerifyInline
      email={email}
      onEmailChange={onEmailChange}
      showEmailField={showEmailField}
      codeSent={codeSent}
      onBack={() => setStep('prompt')}
      onSuccess={onSuccess}
      secondaryLabel="Back"
    />
  )
}
