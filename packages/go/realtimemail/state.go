package realtimemail

import "time"

type DomainStateSnapshot struct {
	TrustedDomains map[string]bool
	MutedDomains   map[string]bool
	RevokedDomains map[string]bool
}

type MessageStateSnapshot struct {
	DismissedMessageIDs map[string]bool
	DeletedMessageIDs   map[string]bool
	SupersededMessageIDs map[string]bool
	Now                 time.Time
}

type StatePolicy struct{}

func (StatePolicy) EvaluateDomainState(domain string, snapshot DomainStateSnapshot) TrustedDomainState {
	if snapshot.RevokedDomains[domain] {
		return RevokedDomain
	}
	if snapshot.MutedDomains[domain] {
		return MutedDomain
	}
	if snapshot.TrustedDomains[domain] {
		return TrustedDomain
	}
	return RevokedDomain
}

func (StatePolicy) EvaluateMessageState(message RealtimeMailMessage, snapshot MessageStateSnapshot) MessageLifecycleState {
	if snapshot.DeletedMessageIDs[message.ID] {
		return DeletedMessage
	}
	if snapshot.SupersededMessageIDs[message.ID] {
		return SupersededMessage
	}
	now := snapshot.Now
	if now.IsZero() {
		now = time.Now()
	}
	if !message.ExpiresAt.IsZero() && !message.ExpiresAt.After(now) {
		return ExpiredMessage
	}
	if snapshot.DismissedMessageIDs[message.ID] {
		return DismissedMessage
	}
	return VisibleMessage
}

func (policy StatePolicy) ShouldDisplay(message RealtimeMailMessage, domainSnapshot DomainStateSnapshot, messageSnapshot MessageStateSnapshot) bool {
	return policy.EvaluateDomainState(message.Domain, domainSnapshot) == TrustedDomain &&
		policy.EvaluateMessageState(message, messageSnapshot) == VisibleMessage
}
