use base64::prelude::{Engine as _, BASE64_URL_SAFE_NO_PAD};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MailSource {
    #[serde(rename = "traditional")]
    Traditional,
    #[serde(rename = "realtime")]
    Realtime,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrustedDomainState {
    Trusted,
    Muted,
    Revoked,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MessageLifecycleState {
    Visible,
    Dismissed,
    Deleted,
    Superseded,
    Expired,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrustCapability {
    #[serde(rename = "render:html")]
    RenderHtml,
    #[serde(rename = "render:css")]
    RenderCss,
    #[serde(rename = "render:svg")]
    RenderSvg,
    #[serde(rename = "run:script-sandboxed")]
    RunScriptSandboxed,
    #[serde(rename = "open-url:user-gesture")]
    OpenUrlUserGesture,
    #[serde(rename = "payment-request:user-gesture")]
    PaymentRequestUserGesture,
    #[serde(rename = "storage:isolated")]
    StorageIsolated,
    #[serde(rename = "network:domain-only")]
    NetworkDomainOnly,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum RealtimeMailActionType {
    #[serde(rename = "open_url")]
    OpenUrl,
    #[serde(rename = "publish_gateway_event")]
    PublishGatewayEvent,
    #[serde(rename = "request_notification")]
    RequestNotification,
    #[serde(rename = "store_isolated_value")]
    StoreIsolatedValue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RealtimeMailChannel {
    pub id: String,
    pub label: String,
    pub route: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub capabilities: Vec<TrustCapability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct RealtimeMailManifest {
    pub protocol: String,
    pub version: String,
    pub domain: String,
    pub display_name: String,
    pub public_keys: Vec<String>,
    pub channels: Vec<RealtimeMailChannel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct RealtimeMailMessage {
    pub id: String,
    pub source: MailSource,
    pub domain: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub channel_id: Option<String>,
    pub from: String,
    pub subject: String,
    pub html: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub css: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub script: Option<String>,
    pub capabilities: Vec<TrustCapability>,
    pub received_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct RealtimeMailAction {
    pub id: String,
    pub message_id: String,
    pub domain: String,
    #[serde(rename = "type")]
    pub action_type: RealtimeMailActionType,
    pub requires_user_gesture: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct ValidationIssue {
    pub path: String,
    pub message: String,
}

#[derive(Debug, Error)]
#[error("validation failed")]
pub struct ValidationError {
    pub issues: Vec<ValidationIssue>,
}

#[derive(Debug, Clone)]
pub struct HostActionDecision {
    pub ok: bool,
    pub reason: String,
    pub action: Option<RealtimeMailAction>,
}

#[derive(Debug, Clone)]
pub struct RouteAuthorizationDecision {
    pub ok: bool,
    pub reason: String,
    pub channel: Option<RealtimeMailChannel>,
}

#[derive(Debug, Clone)]
pub struct GatewayActionDecision {
    pub ok: bool,
    pub reason: String,
    pub action: Option<RealtimeMailAction>,
}

#[derive(Debug, Clone, Default)]
pub struct DomainStateSnapshot {
    pub trusted_domains: HashSet<String>,
    pub muted_domains: HashSet<String>,
    pub revoked_domains: HashSet<String>,
}

#[derive(Debug, Clone, Default)]
pub struct MessageStateSnapshot {
    pub dismissed_message_ids: HashSet<String>,
    pub deleted_message_ids: HashSet<String>,
    pub superseded_message_ids: HashSet<String>,
    pub now: Option<String>,
}

pub struct ManifestValidator;

impl ManifestValidator {
    pub fn validate(manifest: &RealtimeMailManifest) -> Vec<ValidationIssue> {
        let mut issues = Vec::new();
        if manifest.protocol != "realtime-mail" {
            issues.push(issue("$.protocol", "must equal realtime-mail"));
        }
        if !is_domain(&manifest.domain) {
            issues.push(issue("$.domain", "must be a valid domain"));
        }
        if manifest.version.is_empty() {
            issues.push(issue("$.version", "must be set"));
        }
        if manifest.display_name.is_empty() {
            issues.push(issue("$.displayName", "must be set"));
        }
        if manifest.public_keys.is_empty() {
            issues.push(issue("$.publicKeys", "must be non-empty"));
        }
        if manifest.channels.is_empty() {
            issues.push(issue("$.channels", "must be non-empty"));
        }
        issues
    }

    pub fn parse(manifest: RealtimeMailManifest) -> Result<RealtimeMailManifest, ValidationError> {
        let issues = Self::validate(&manifest);
        if issues.is_empty() {
            Ok(manifest)
        } else {
            Err(ValidationError { issues })
        }
    }
}

pub struct MessageValidator;

impl MessageValidator {
    pub fn validate(message: &RealtimeMailMessage) -> Vec<ValidationIssue> {
        let mut issues = Vec::new();
        if message.id.is_empty() {
            issues.push(issue("$.id", "must be set"));
        }
        if !is_domain(&message.domain) {
            issues.push(issue("$.domain", "must be a valid domain"));
        }
        if message.from.is_empty() {
            issues.push(issue("$.from", "must be set"));
        }
        if message.html.is_empty() {
            issues.push(issue("$.html", "must be set"));
        }
        if message.source == MailSource::Realtime && message.channel_id.is_none() {
            issues.push(issue("$.channelId", "is required for realtime messages"));
        }
        if message.source == MailSource::Realtime && message.signature.is_none() {
            issues.push(issue("$.signature", "is required for realtime messages"));
        }
        if message.script.is_some() && !message.capabilities.contains(&TrustCapability::RunScriptSandboxed) {
            issues.push(issue("$.capabilities", "must include run:script-sandboxed when script is present"));
        }
        issues
    }

    pub fn parse(message: RealtimeMailMessage) -> Result<RealtimeMailMessage, ValidationError> {
        let issues = Self::validate(&message);
        if issues.is_empty() {
            Ok(message)
        } else {
            Err(ValidationError { issues })
        }
    }
}

pub struct ActionValidator;

impl ActionValidator {
    pub fn validate(action: &RealtimeMailAction) -> Vec<ValidationIssue> {
        let mut issues = Vec::new();
        if action.id.is_empty() {
            issues.push(issue("$.id", "must be set"));
        }
        if action.message_id.is_empty() {
            issues.push(issue("$.messageId", "must be set"));
        }
        if !is_domain(&action.domain) {
            issues.push(issue("$.domain", "must be a valid domain"));
        }
        if !action.requires_user_gesture {
            issues.push(issue("$.requiresUserGesture", "must be true"));
        }
        if action.action_type == RealtimeMailActionType::OpenUrl && !is_https_url_for_domain(action.url.as_deref(), &action.domain) {
            issues.push(issue("$.url", "must be an https URL for the action domain"));
        }
        issues
    }

    pub fn parse(action: RealtimeMailAction) -> Result<RealtimeMailAction, ValidationError> {
        let issues = Self::validate(&action);
        if issues.is_empty() {
            Ok(action)
        } else {
            Err(ValidationError { issues })
        }
    }
}

pub struct TrustPolicy {
    trusted_domains: HashSet<String>,
}

impl TrustPolicy {
    pub fn new() -> Self {
        Self {
            trusted_domains: HashSet::new(),
        }
    }

    pub fn trust_domain(&mut self, domain: &str) {
        self.trusted_domains.insert(domain.to_string());
    }

    pub fn revoke_domain(&mut self, domain: &str) {
        self.trusted_domains.remove(domain);
    }

    pub fn is_trusted(&self, domain: &str) -> bool {
        self.trusted_domains.contains(domain)
    }
}

impl Default for TrustPolicy {
    fn default() -> Self {
        Self::new()
    }
}

pub struct StatePolicy;

impl StatePolicy {
    pub fn evaluate_domain_state(domain: &str, snapshot: &DomainStateSnapshot) -> TrustedDomainState {
        if snapshot.revoked_domains.contains(domain) {
            return TrustedDomainState::Revoked;
        }
        if snapshot.muted_domains.contains(domain) {
            return TrustedDomainState::Muted;
        }
        if snapshot.trusted_domains.contains(domain) {
            return TrustedDomainState::Trusted;
        }
        TrustedDomainState::Revoked
    }

    pub fn evaluate_message_state(message: &RealtimeMailMessage, snapshot: &MessageStateSnapshot) -> MessageLifecycleState {
        if snapshot.deleted_message_ids.contains(&message.id) {
            return MessageLifecycleState::Deleted;
        }
        if snapshot.superseded_message_ids.contains(&message.id) {
            return MessageLifecycleState::Superseded;
        }
        if message.expires_at.as_ref().is_some_and(|expires_at| {
            let now = snapshot.now.as_deref().unwrap_or("");
            !now.is_empty() && expires_at.as_str() <= now
        }) {
            return MessageLifecycleState::Expired;
        }
        if snapshot.dismissed_message_ids.contains(&message.id) {
            return MessageLifecycleState::Dismissed;
        }
        MessageLifecycleState::Visible
    }

    pub fn should_display(
        message: &RealtimeMailMessage,
        domain_snapshot: &DomainStateSnapshot,
        message_snapshot: &MessageStateSnapshot,
    ) -> bool {
        Self::evaluate_domain_state(&message.domain, domain_snapshot) == TrustedDomainState::Trusted
            && Self::evaluate_message_state(message, message_snapshot) == MessageLifecycleState::Visible
    }
}

pub struct HostActionBroker<'a> {
    pub trust_policy: &'a TrustPolicy,
}

impl<'a> HostActionBroker<'a> {
    pub fn authorize(
        &self,
        action: RealtimeMailAction,
        message: &RealtimeMailMessage,
        manifest: &RealtimeMailManifest,
        user_gesture: bool,
        now: &str,
    ) -> HostActionDecision {
        if !ActionValidator::validate(&action).is_empty() {
            return rejected_host_action("invalid_action");
        }
        if action.message_id != message.id {
            return rejected_host_action("message_mismatch");
        }
        if action.domain != message.domain || action.domain != manifest.domain {
            return rejected_host_action("domain_mismatch");
        }
        if !self.trust_policy.is_trusted(&action.domain) {
            return rejected_host_action("domain_not_trusted");
        }
        if !user_gesture || !action.requires_user_gesture {
            return rejected_host_action("user_gesture_required");
        }
        if message.expires_at.as_deref().is_some_and(|expires_at| expires_at <= now) {
            return rejected_host_action("message_expired");
        }
        if !manifest.public_keys.iter().any(|key| key.starts_with("ed25519:") && SignatureVerifier::verify_ed25519(message, key)) {
            return rejected_host_action("signature_required");
        }
        if action.action_type == RealtimeMailActionType::OpenUrl && !message.capabilities.contains(&TrustCapability::OpenUrlUserGesture) {
            return rejected_host_action("capability_required");
        }
        if is_payment_request(&action) && !message.capabilities.contains(&TrustCapability::PaymentRequestUserGesture) {
            return rejected_host_action("capability_required");
        }
        HostActionDecision {
            ok: true,
            reason: "ok".to_string(),
            action: Some(action),
        }
    }
}

fn is_payment_request(action: &RealtimeMailAction) -> bool {
    action.payload.as_ref()
        .and_then(|payload| payload.get("kind"))
        .and_then(|kind| kind.as_str())
        .is_some_and(|kind| kind == "host-mediated-payment-request")
}

pub struct RealtimeMessageBuilder {
    pub manifest: RealtimeMailManifest,
}

impl RealtimeMessageBuilder {
    pub fn build(&self, input: RealtimeMessageInput) -> Result<RealtimeMailMessage, ValidationError> {
        let Some(channel) = self.manifest.channels.iter().find(|channel| channel.id == input.channel_id) else {
            return Err(ValidationError {
                issues: vec![issue("$.channelId", "unknown channel")],
            });
        };
        let message = RealtimeMailMessage {
            id: input.id,
            source: MailSource::Realtime,
            domain: self.manifest.domain.clone(),
            channel_id: Some(channel.id.clone()),
            from: input.from,
            subject: input.subject,
            html: input.html,
            css: input.css,
            script: input.script,
            capabilities: input.capabilities.unwrap_or_else(|| channel.capabilities.clone()),
            received_at: input.received_at,
            expires_at: input.expires_at,
            signature: None,
        };
        let mut validation_message = message.clone();
        validation_message.signature = Some("unsigned-builder-placeholder".to_string());
        let issues = MessageValidator::validate(&validation_message);
        if issues.is_empty() {
            Ok(message)
        } else {
            Err(ValidationError { issues })
        }
    }
}

pub struct RealtimeMessageInput {
    pub id: String,
    pub channel_id: String,
    pub from: String,
    pub subject: String,
    pub html: String,
    pub css: Option<String>,
    pub script: Option<String>,
    pub capabilities: Option<Vec<TrustCapability>>,
    pub received_at: String,
    pub expires_at: Option<String>,
}

pub struct MessageSigner;

impl MessageSigner {
    pub fn sign_ed25519(message: &RealtimeMailMessage, signing_key: &SigningKey) -> Result<RealtimeMailMessage, serde_json::Error> {
        let mut unsigned = message.clone();
        unsigned.signature = None;
        let canonical = SignatureVerifier::canonical_message(&unsigned)?;
        let signature = signing_key.sign(canonical.as_bytes());
        unsigned.signature = Some(format!(
            "rmail1.eyJhbGciOiJFZDI1NTE5IiwidHlwIjoicm1haWwxIn0.{}",
            BASE64_URL_SAFE_NO_PAD.encode(signature.to_bytes())
        ));
        Ok(unsigned)
    }
}

pub struct RouteAuthorizer {
    pub manifest: RealtimeMailManifest,
}

impl RouteAuthorizer {
    pub fn authorize(&self, route: &str, channel_id: Option<&str>, user_id: Option<&str>) -> RouteAuthorizationDecision {
        for channel in &self.manifest.channels {
            if channel_id.is_some_and(|id| id != channel.id) {
                continue;
            }
            if route_matches(&channel.route, route, user_id) {
                return RouteAuthorizationDecision {
                    ok: true,
                    reason: "ok".to_string(),
                    channel: Some(channel.clone()),
                };
            }
        }
        RouteAuthorizationDecision {
            ok: false,
            reason: "route_not_allowed".to_string(),
            channel: None,
        }
    }
}

pub struct ActionReceiver {
    pub domain: String,
}

impl ActionReceiver {
    pub fn receive(&self, action: RealtimeMailAction) -> GatewayActionDecision {
        if !ActionValidator::validate(&action).is_empty() {
            return GatewayActionDecision {
                ok: false,
                reason: "invalid_action".to_string(),
                action: None,
            };
        }
        if action.domain != self.domain {
            return GatewayActionDecision {
                ok: false,
                reason: "domain_not_allowed".to_string(),
                action: None,
            };
        }
        GatewayActionDecision {
            ok: true,
            reason: "ok".to_string(),
            action: Some(action),
        }
    }
}

pub struct SignatureVerifier;

impl SignatureVerifier {
    pub fn canonical_message(message: &RealtimeMailMessage) -> Result<String, serde_json::Error> {
        let mut value = BTreeMap::new();
        value.insert("capabilities", serde_json::to_value(&message.capabilities)?);
        if let Some(channel_id) = &message.channel_id {
            value.insert("channelId", serde_json::Value::String(channel_id.clone()));
        }
        if let Some(css) = &message.css {
            value.insert("css", serde_json::Value::String(css.clone()));
        }
        value.insert("domain", serde_json::Value::String(message.domain.clone()));
        value.insert("from", serde_json::Value::String(message.from.clone()));
        value.insert("html", serde_json::Value::String(message.html.clone()));
        value.insert("id", serde_json::Value::String(message.id.clone()));
        value.insert("receivedAt", serde_json::Value::String(message.received_at.clone()));
        if let Some(expires_at) = &message.expires_at {
            value.insert("expiresAt", serde_json::Value::String(expires_at.clone()));
        }
        if let Some(script) = &message.script {
            value.insert("script", serde_json::Value::String(script.clone()));
        }
        value.insert("source", serde_json::to_value(&message.source)?);
        value.insert("subject", serde_json::Value::String(message.subject.clone()));
        serde_json::to_string(&value)
    }

    pub fn verify_ed25519(message: &RealtimeMailMessage, public_key: &str) -> bool {
        let Some(signature_value) = &message.signature else {
            return false;
        };
        let Some(public_key_value) = public_key.strip_prefix("ed25519:") else {
            return false;
        };
        let Ok(key_bytes) = BASE64_URL_SAFE_NO_PAD.decode(public_key_value) else {
            return false;
        };
        let Ok(key_array) = <[u8; 32]>::try_from(key_bytes.as_slice()) else {
            return false;
        };
        let Ok(signature_bytes) = signature_bytes(signature_value) else {
            return false;
        };
        let Ok(signature_array) = <[u8; 64]>::try_from(signature_bytes.as_slice()) else {
            return false;
        };
        let Ok(canonical) = Self::canonical_message(message) else {
            return false;
        };
        let key = VerifyingKey::from_bytes(&key_array);
        let signature = Signature::from_bytes(&signature_array);
        key.is_ok_and(|verifying_key| verifying_key.verify(canonical.as_bytes(), &signature).is_ok())
    }
}

fn signature_bytes(signature: &str) -> Result<Vec<u8>, base64::DecodeError> {
    if signature.starts_with("rmail1.") {
        let parts: Vec<&str> = signature.split('.').collect();
        return BASE64_URL_SAFE_NO_PAD.decode(parts.get(2).copied().unwrap_or_default());
    }
    BASE64_URL_SAFE_NO_PAD.decode(signature.strip_prefix("ed25519:").unwrap_or(signature))
}

fn issue(path: &str, message: &str) -> ValidationIssue {
    ValidationIssue {
        path: path.to_string(),
        message: message.to_string(),
    }
}

fn rejected_host_action(reason: &str) -> HostActionDecision {
    HostActionDecision {
        ok: false,
        reason: reason.to_string(),
        action: None,
    }
}

fn route_matches(pattern: &str, route: &str, user_id: Option<&str>) -> bool {
    let pattern_parts: Vec<&str> = pattern.split('/').filter(|part| !part.is_empty()).collect();
    let route_parts: Vec<&str> = route.split('/').filter(|part| !part.is_empty()).collect();
    if pattern_parts.len() != route_parts.len() {
        return false;
    }
    pattern_parts.iter().zip(route_parts.iter()).all(|(pattern_part, route_part)| {
        if *pattern_part == ":userId" {
            user_id.is_some_and(|id| id == *route_part)
        } else {
            pattern_part.starts_with(':') || pattern_part == route_part
        }
    })
}

fn is_domain(value: &str) -> bool {
    value.contains('.') && value.chars().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '.')
}

fn is_https_url_for_domain(value: Option<&str>, domain: &str) -> bool {
    let Some(value) = value else {
        return false;
    };
    value.starts_with("https://") && value.strip_prefix("https://").is_some_and(|rest| rest.starts_with(domain) && (rest.len() == domain.len() || rest.as_bytes().get(domain.len()) == Some(&b'/')))
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::prelude::BASE64_URL_SAFE_NO_PAD;
    use ed25519_dalek::{Signer, SigningKey};
    use std::collections::HashSet;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn conformance_fixtures_validate() {
        let valid_manifest: RealtimeMailManifest = read_json("valid-manifest.acme.json");
        assert!(ManifestValidator::validate(&valid_manifest).is_empty());

        assert_json_rejected::<RealtimeMailManifest>("invalid-manifest.missing-keys.json");
        assert_json_rejected::<RealtimeMailManifest>("invalid-manifest.unknown-channel-property.json");

        let valid_message: RealtimeMailMessage = read_json("valid-message.invoice.json");
        assert!(MessageValidator::validate(&valid_message).is_empty());

        let invalid_message: RealtimeMailMessage = read_json("invalid-message.script-without-capability.json");
        assert!(!MessageValidator::validate(&invalid_message).is_empty());
        assert_json_rejected::<RealtimeMailMessage>("invalid-message.unknown-property.json");

        let valid_action: RealtimeMailAction = read_json("valid-action.open-url.json");
        assert!(ActionValidator::validate(&valid_action).is_empty());

        let invalid_action: RealtimeMailAction = read_json("invalid-action.no-user-gesture.json");
        assert!(!ActionValidator::validate(&invalid_action).is_empty());

        let cross_domain_action: RealtimeMailAction = read_json("invalid-action.cross-domain-url.json");
        assert!(!ActionValidator::validate(&cross_domain_action).is_empty());
    }

    #[test]
    fn ed25519_signature_verification_detects_tampering() {
        let signing_key = SigningKey::from_bytes(&[7u8; 32]);
        let public_key = format!("ed25519:{}", BASE64_URL_SAFE_NO_PAD.encode(signing_key.verifying_key().as_bytes()));
        let mut message = RealtimeMailMessage {
            id: "crypto-vector-001".to_string(),
            source: MailSource::Realtime,
            domain: "billing.acme.tld".to_string(),
            channel_id: Some("invoice-events".to_string()),
            from: "billing@acme.tld".to_string(),
            subject: "Signed message".to_string(),
            html: "<article><h1>Signed</h1></article>".to_string(),
            css: Some("body { font-family: sans-serif; }".to_string()),
            script: None,
            capabilities: vec![TrustCapability::RenderHtml, TrustCapability::RenderCss],
            received_at: "2026-06-08T08:00:00.000Z".to_string(),
            expires_at: None,
            signature: None,
        };

        let canonical = SignatureVerifier::canonical_message(&message).expect("canonical message");
        let signature = signing_key.sign(canonical.as_bytes());
        message.signature = Some(format!(
            "rmail1.eyJhbGciOiJFZDI1NTE5IiwidHlwIjoicm1haWwxIn0.{}",
            BASE64_URL_SAFE_NO_PAD.encode(signature.to_bytes())
        ));

        assert!(SignatureVerifier::verify_ed25519(&message, &public_key));
        message.subject = "Tampered".to_string();
        assert!(!SignatureVerifier::verify_ed25519(&message, &public_key));
    }

    #[test]
    fn gateway_profile_security_gates() {
        let signing_key = SigningKey::from_bytes(&[9u8; 32]);
        let public_key = format!("ed25519:{}", BASE64_URL_SAFE_NO_PAD.encode(signing_key.verifying_key().as_bytes()));
        let manifest = RealtimeMailManifest {
            protocol: "realtime-mail".to_string(),
            version: "0.1-draft".to_string(),
            domain: "billing.acme.tld".to_string(),
            display_name: "ACME Billing".to_string(),
            public_keys: vec![public_key],
            channels: vec![RealtimeMailChannel {
                id: "invoice-events".to_string(),
                label: "Invoices".to_string(),
                route: "/rt/invoices/:userId".to_string(),
                description: None,
                capabilities: vec![
                    TrustCapability::RenderHtml,
                    TrustCapability::RenderCss,
                    TrustCapability::OpenUrlUserGesture,
                ],
            }],
        };
        let message = RealtimeMessageBuilder { manifest: manifest.clone() }
            .build(RealtimeMessageInput {
                id: "host-action-001".to_string(),
                channel_id: "invoice-events".to_string(),
                from: "billing@acme.tld".to_string(),
                subject: "Action test".to_string(),
                html: "<a>Open</a>".to_string(),
                css: None,
                script: None,
                capabilities: None,
                received_at: "2026-06-08T08:00:00.000Z".to_string(),
                expires_at: Some("2026-06-08T08:15:00.000Z".to_string()),
            })
            .expect("message");
        let message = MessageSigner::sign_ed25519(&message, &signing_key).expect("signed");
        let action = RealtimeMailAction {
            id: "open-invoice".to_string(),
            message_id: message.id.clone(),
            domain: message.domain.clone(),
            action_type: RealtimeMailActionType::OpenUrl,
            requires_user_gesture: true,
            url: Some("https://billing.acme.tld/invoices/1".to_string()),
            payload: None,
        };
        let mut trust = TrustPolicy::new();
        trust.trust_domain("billing.acme.tld");
        let broker = HostActionBroker { trust_policy: &trust };
        assert!(broker.authorize(action.clone(), &message, &manifest, true, "2026-06-08T08:01:00.000Z").ok);
        assert!(!broker.authorize(action.clone(), &message, &manifest, false, "2026-06-08T08:01:00.000Z").ok);
        assert!(!broker.authorize(action.clone(), &message, &manifest, true, "2026-06-08T08:16:00.000Z").ok);
        assert!(RouteAuthorizer { manifest: manifest.clone() }.authorize("/rt/invoices/demo-user", Some("invoice-events"), Some("demo-user")).ok);
        assert!(!RouteAuthorizer { manifest: manifest.clone() }.authorize("/rt/admin/demo-user", Some("invoice-events"), Some("demo-user")).ok);
        assert!(ActionReceiver { domain: "billing.acme.tld".to_string() }.receive(action.clone()).ok);
        assert!(!ActionReceiver { domain: "billing.acme.tld".to_string() }.receive(RealtimeMailAction {
            domain: "evil.example".to_string(),
            url: Some("https://evil.example/invoices/1".to_string()),
            ..action
        }).ok);
        assert_eq!(
            StatePolicy::evaluate_domain_state("billing.acme.tld", &DomainStateSnapshot {
                trusted_domains: HashSet::from(["billing.acme.tld".to_string()]),
                ..Default::default()
            }),
            TrustedDomainState::Trusted
        );
        assert_eq!(
            StatePolicy::evaluate_domain_state("billing.acme.tld", &DomainStateSnapshot {
                trusted_domains: HashSet::from(["billing.acme.tld".to_string()]),
                muted_domains: HashSet::from(["billing.acme.tld".to_string()]),
                ..Default::default()
            }),
            TrustedDomainState::Muted
        );
        assert_eq!(
            StatePolicy::evaluate_domain_state("billing.acme.tld", &DomainStateSnapshot {
                trusted_domains: HashSet::from(["billing.acme.tld".to_string()]),
                revoked_domains: HashSet::from(["billing.acme.tld".to_string()]),
                ..Default::default()
            }),
            TrustedDomainState::Revoked
        );
        assert_eq!(
            StatePolicy::evaluate_message_state(&message, &MessageStateSnapshot {
                now: Some("2026-06-08T08:16:00.000Z".to_string()),
                ..Default::default()
            }),
            MessageLifecycleState::Expired
        );
        assert_eq!(
            StatePolicy::evaluate_message_state(&message, &MessageStateSnapshot {
                dismissed_message_ids: HashSet::from([message.id.clone()]),
                deleted_message_ids: HashSet::from([message.id.clone()]),
                now: Some("2026-06-08T08:16:00.000Z".to_string()),
                ..Default::default()
            }),
            MessageLifecycleState::Deleted
        );
    }

    fn read_json<T: for<'de> serde::Deserialize<'de>>(name: &str) -> T {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("..");
        let content = fs::read_to_string(root.join("conformance").join(name)).expect("fixture");
        serde_json::from_str(&content).expect("json")
    }

    fn assert_json_rejected<T: for<'de> serde::Deserialize<'de>>(name: &str) {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("..");
        let content = fs::read_to_string(root.join("conformance").join(name)).expect("fixture");
        assert!(serde_json::from_str::<T>(&content).is_err());
    }
}
