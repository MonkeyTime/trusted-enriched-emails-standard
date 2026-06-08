package realtimemail

type TrustPolicy struct {
	trustedDomains map[string]bool
}

func NewTrustPolicy() *TrustPolicy {
	return &TrustPolicy{trustedDomains: map[string]bool{}}
}

func (policy *TrustPolicy) TrustDomain(domain string) {
	policy.trustedDomains[domain] = true
}

func (policy *TrustPolicy) RevokeDomain(domain string) {
	delete(policy.trustedDomains, domain)
}

func (policy *TrustPolicy) IsTrusted(domain string) bool {
	return policy.trustedDomains[domain]
}

func (policy *TrustPolicy) CanRender(message RealtimeMailMessage) bool {
	if message.Source == Traditional {
		return hasCapability(message.Capabilities, RenderHTML)
	}
	return policy.IsTrusted(message.Domain) && hasCapability(message.Capabilities, RenderHTML)
}

func (policy *TrustPolicy) CanRunScript(message RealtimeMailMessage) bool {
	return message.Source == Realtime && policy.IsTrusted(message.Domain) && hasCapability(message.Capabilities, RunScriptSandboxed)
}
