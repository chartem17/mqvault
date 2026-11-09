"""MQVault Bridge: reads MT5 deal history from terminals already running on this PC and sends it to the journal.

Read-only towards MetaTrader (claims S1/S2, docs/features/mt5-bridge.md §4.3), outbound HTTPS only, every request
signed with a device key that never leaves the PC.
"""
__version__ = "0.1.0"
