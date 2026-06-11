export function safePolicyMatches(item) {
  return Array.isArray(item?.policy_matches) ? item.policy_matches : []
}

export function isVerifiedPolicyMatch(match) {
  return String(match?.policy_masked || '').includes('•••••')
}

export function policyHolderStatusFromItem(item) {
  if (item?.policy_holder_status) return item.policy_holder_status
  const matches = safePolicyMatches(item)
  if (matches.some(isVerifiedPolicyMatch)) return 'verified'
  if (matches.length) return 'estimated'
  return null
}

export function getPolicySummary(item) {
  const matches = safePolicyMatches(item)
  if (!matches.length) return null
  const primary = matches.find((m) => m && m.is_primary) || matches[0]
  if (!primary) return null
  const status = policyHolderStatusFromItem(item)
  return {
    primary,
    labelLeft: primary.product_group || primary.product_prefix || 'product',
    labelRight: primary.policy_masked || 'policy',
    extra: Math.max(0, matches.length - 1),
    needsReview: matches.some((m) => m && m.needs_review),
    status,
    matches,
  }
}

export function policyHolderBadge(item) {
  const status = policyHolderStatusFromItem(item)
  if (status === 'verified') {
    return {
      label: 'Policyholder',
      title: 'A policy number was detected and linked to this customer.',
      className:
        'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    }
  }
  if (status === 'estimated') {
    return {
      label: 'Possible policyholder',
      title: 'A product or plan was inferred from the message; confirm if needed.',
      className:
        'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    }
  }
  return null
}
