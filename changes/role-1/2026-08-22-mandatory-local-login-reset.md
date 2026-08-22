# Mandatory local login reset

- Changed Test Lab clean-start reset to clear the saved fake ChatXPT account, the obsolete account-bypass flag, and gameplay-capture preference while leaving the development server running.
- Removed **Connect Twitch without demo account** so local Studio entry requires the prefilled fake-login form before Twitch OAuth.
- Changed the demo-account **Sign out** action to return immediately to the same mandatory login gate rather than silently enabling a bypass.
- Preserved the prefilled `Local Streamer`, `streamer@chatxpt.local`, and local-only demo password values; the password is still never transmitted or stored.

Evidence: focused account/reset rendering tests, the full repository gate, and a running local browser reset flow. Twitch's own `twitch.tv` login cookie remains outside ChatXPT's browser-reset authority.
