package org.realtimemail;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class TraditionalMailAccountManager {
  private final Map<String, TraditionalMailAccount> accounts = new HashMap<>();

  public void addAccount(TraditionalMailAccount account) {
    accounts.put(account.id(), account);
  }

  public void removeAccount(String accountId) {
    accounts.remove(accountId);
  }

  public List<TraditionalMailAccount> listAccounts() {
    return new ArrayList<>(accounts.values());
  }
}
