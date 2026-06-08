import type { DomainStateSnapshot, MessageStateSnapshot } from "@realtimemail/sdk";

export type ClientStateRecord = {
  trustedDomains: string[];
  mutedDomains: string[];
  revokedDomains: string[];
  subscribedChannels: string[];
  dismissedMessageIds: string[];
  deletedMessageIds: string[];
  supersededMessageIds: string[];
};

const defaultState: ClientStateRecord = {
  trustedDomains: ["billing.acme.tld", "status.ops.tld"],
  mutedDomains: [],
  revokedDomains: [],
  subscribedChannels: ["billing.acme.tld:invoice-events", "status.ops.tld:incident-feed"],
  dismissedMessageIds: [],
  deletedMessageIds: [],
  supersededMessageIds: []
};

export class ClientStateStore {
  private state: ClientStateRecord;

  constructor(
    private readonly storage: Pick<Storage, "getItem" | "setItem"> | undefined,
    private readonly key = "realtime-mail.client-state.v1",
    initialState: ClientStateRecord = defaultState
  ) {
    this.state = this.load(initialState);
  }

  snapshot(): ClientStateRecord {
    return cloneState(this.state);
  }

  domainSnapshot(): DomainStateSnapshot {
    return {
      trustedDomains: this.state.trustedDomains,
      mutedDomains: this.state.mutedDomains,
      revokedDomains: this.state.revokedDomains
    };
  }

  messageSnapshot(now = new Date()): MessageStateSnapshot {
    return {
      dismissedMessageIds: this.state.dismissedMessageIds,
      deletedMessageIds: this.state.deletedMessageIds,
      supersededMessageIds: this.state.supersededMessageIds,
      now
    };
  }

  trustDomain(domain: string): void {
    this.remove("revokedDomains", domain);
    this.remove("mutedDomains", domain);
    this.add("trustedDomains", domain);
    this.save();
  }

  muteDomain(domain: string): void {
    this.remove("revokedDomains", domain);
    this.add("trustedDomains", domain);
    this.add("mutedDomains", domain);
    this.save();
  }

  revokeDomain(domain: string): void {
    this.remove("trustedDomains", domain);
    this.remove("mutedDomains", domain);
    this.add("revokedDomains", domain);
    this.state.subscribedChannels = this.state.subscribedChannels.filter((key) => !key.startsWith(`${domain}:`));
    this.save();
  }

  subscribe(domain: string, channelId: string): void {
    this.add("subscribedChannels", channelKey(domain, channelId));
    this.save();
  }

  unsubscribe(domain: string, channelId: string): void {
    this.remove("subscribedChannels", channelKey(domain, channelId));
    this.save();
  }

  deleteMessage(messageId: string): void {
    this.add("deletedMessageIds", messageId);
    this.remove("dismissedMessageIds", messageId);
    this.save();
  }

  dismissMessage(messageId: string): void {
    if (!this.state.deletedMessageIds.includes(messageId)) {
      this.add("dismissedMessageIds", messageId);
      this.save();
    }
  }

  supersedeMessage(messageId: string): void {
    this.add("supersededMessageIds", messageId);
    this.save();
  }

  isSubscribed(domain: string, channelId: string): boolean {
    return this.state.subscribedChannels.includes(channelKey(domain, channelId));
  }

  private load(initialState: ClientStateRecord): ClientStateRecord {
    const raw = this.storage?.getItem(this.key);
    if (!raw) {
      return cloneState(initialState);
    }
    try {
      const parsed = JSON.parse(raw) as Partial<ClientStateRecord>;
      return {
        trustedDomains: arrayOr(parsed.trustedDomains, initialState.trustedDomains),
        mutedDomains: arrayOr(parsed.mutedDomains, initialState.mutedDomains),
        revokedDomains: arrayOr(parsed.revokedDomains, initialState.revokedDomains),
        subscribedChannels: arrayOr(parsed.subscribedChannels, initialState.subscribedChannels),
        dismissedMessageIds: arrayOr(parsed.dismissedMessageIds, initialState.dismissedMessageIds),
        deletedMessageIds: arrayOr(parsed.deletedMessageIds, initialState.deletedMessageIds),
        supersededMessageIds: arrayOr(parsed.supersededMessageIds, initialState.supersededMessageIds)
      };
    } catch {
      return cloneState(initialState);
    }
  }

  private add(key: keyof ClientStateRecord, value: string): void {
    if (!this.state[key].includes(value)) {
      this.state[key] = [...this.state[key], value];
    }
  }

  private remove(key: keyof ClientStateRecord, value: string): void {
    this.state[key] = this.state[key].filter((item) => item !== value);
  }

  private save(): void {
    this.storage?.setItem(this.key, JSON.stringify(this.state));
  }
}

export function channelKey(domain: string, channelId: string): string {
  return `${domain}:${channelId}`;
}

function cloneState(state: ClientStateRecord): ClientStateRecord {
  return {
    trustedDomains: [...state.trustedDomains],
    mutedDomains: [...state.mutedDomains],
    revokedDomains: [...state.revokedDomains],
    subscribedChannels: [...state.subscribedChannels],
    dismissedMessageIds: [...state.dismissedMessageIds],
    deletedMessageIds: [...state.deletedMessageIds],
    supersededMessageIds: [...state.supersededMessageIds]
  };
}

function arrayOr(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : [...fallback];
}
