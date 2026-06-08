namespace RealtimeMail;

public sealed class TraditionalMailAccountManager
{
    private readonly Dictionary<string, TraditionalMailAccount> accounts = new();

    public void AddAccount(TraditionalMailAccount account)
    {
        accounts[account.Id] = account;
    }

    public void RemoveAccount(string accountId)
    {
        accounts.Remove(accountId);
    }

    public IReadOnlyList<TraditionalMailAccount> ListAccounts()
    {
        return accounts.Values.ToList();
    }
}
