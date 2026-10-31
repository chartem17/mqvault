# Local MT5 bridge retired

The owner permanently rejected the user-operated local bridge. Do not ask for its source or use it as a dependency for EOD tracking.

This package removes the account manager panel, terminal-link button and active useMt5 calls from the account manager. The compatibility useMt5 export is passive: no effects, polling, network requests or fake account balances. The existing endpoint files remain but return HTTP 410 local_bridge_retired without requesting any local daemon. Previous implementations remain in Git history; no file deletion is performed.

MT5 remains platform metadata, independent of personal/prop and manual trade entry. New MT5 profiles can omit login/server; optional values are metadata, never credentials for an automatic connection. No password is collected. Legacy AccountKind keys and derived account.source compatibility fields are not database migrations or proof of a connection. Existing journal trade source values, accounts, raw import data, trade IDs and financial history are not rewritten. JournalTab already creates manually entered trades with source manual regardless of platform.

Existing local-storage import helpers and historical imported trades are untouched. Automatic synchronization without user-operated local software requires a separately selected and approved provider/API architecture. No provider, live import or verified EOD balance feed is claimed here. Prop rule configuration and exact reference arithmetic remain available, while the trusted EOD-history integration remains unavailable.

CI checks the passive API and revised profile validation. Browser acceptance must additionally verify the network panel has no repeated /api/mt5 requests, both personal and prop MT5 profiles can be created without login, previous trades are unchanged and manual trade creation still works. No Supabase mutation, migration, auth change, deletion-model change, or main merge is part of this package.
