package realtimemail

import "time"

type TrustCapability string

const (
	RenderHTML                TrustCapability = "render:html"
	RenderCSS                 TrustCapability = "render:css"
	RenderSVG                 TrustCapability = "render:svg"
	RunScriptSandboxed        TrustCapability = "run:script-sandboxed"
	OpenURLUserGesture        TrustCapability = "open-url:user-gesture"
	PaymentRequestUserGesture TrustCapability = "payment-request:user-gesture"
	StorageIsolated           TrustCapability = "storage:isolated"
	NetworkDomainOnly         TrustCapability = "network:domain-only"
)

type MailSource string

const (
	Traditional MailSource = "traditional"
	Realtime    MailSource = "realtime"
)

type TrustedDomainState string

const (
	TrustedDomain TrustedDomainState = "trusted"
	MutedDomain   TrustedDomainState = "muted"
	RevokedDomain TrustedDomainState = "revoked"
)

type MessageLifecycleState string

const (
	VisibleMessage    MessageLifecycleState = "visible"
	DismissedMessage  MessageLifecycleState = "dismissed"
	DeletedMessage    MessageLifecycleState = "deleted"
	SupersededMessage MessageLifecycleState = "superseded"
	ExpiredMessage    MessageLifecycleState = "expired"
)

type RealtimeMailActionType string

const (
	OpenURL             RealtimeMailActionType = "open_url"
	PublishGatewayEvent RealtimeMailActionType = "publish_gateway_event"
	RequestNotification RealtimeMailActionType = "request_notification"
	StoreIsolatedValue  RealtimeMailActionType = "store_isolated_value"
)

type RealtimeMailChannel struct {
	ID           string            `json:"id"`
	Label        string            `json:"label"`
	Route        string            `json:"route"`
	Description  string            `json:"description,omitempty"`
	Capabilities []TrustCapability `json:"capabilities"`
}

type RealtimeMailManifest struct {
	Protocol    string                `json:"protocol"`
	Version     string                `json:"version"`
	Domain      string                `json:"domain"`
	DisplayName string                `json:"displayName"`
	PublicKeys  []string              `json:"publicKeys"`
	Channels    []RealtimeMailChannel `json:"channels"`
}

type RealtimeMailMessage struct {
	ID           string            `json:"id"`
	Source       MailSource        `json:"source"`
	Domain       string            `json:"domain"`
	ChannelID    string            `json:"channelId,omitempty"`
	From         string            `json:"from"`
	Subject      string            `json:"subject"`
	HTML         string            `json:"html"`
	CSS          string            `json:"css,omitempty"`
	Script       string            `json:"script,omitempty"`
	Capabilities []TrustCapability `json:"capabilities"`
	ReceivedAt   time.Time         `json:"receivedAt"`
	ExpiresAt    time.Time         `json:"expiresAt,omitempty"`
	Signature    string            `json:"signature,omitempty"`
}

type TraditionalMailAccount struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	Provider     string `json:"provider"`
	IncomingHost string `json:"incomingHost"`
	OutgoingHost string `json:"outgoingHost"`
}

type RealtimeMailAction struct {
	ID                  string                 `json:"id"`
	MessageID           string                 `json:"messageId"`
	Domain              string                 `json:"domain"`
	Type                RealtimeMailActionType `json:"type"`
	RequiresUserGesture bool                   `json:"requiresUserGesture"`
	URL                 string                 `json:"url,omitempty"`
	Payload             any                    `json:"payload,omitempty"`
}
