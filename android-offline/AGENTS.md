# Mente Ágil Beta: update continuity

- The permanent beta package is `com.menteagil.offline.beta`. Keep it unchanged.
- Increase `versionCode` for each delivered update; preserve the existing data schema,
  SharedPreferences names, AndroidKeyStore aliases and ranking install identity.
- All beta themes, including Rosa Aurora, remain unlocked until the user requests otherwise.
- Build `release`, then use `scripts/sign_beta.py` with the existing private signing key.
  Never deliver a debug-signed APK or generate a replacement signing key for an update.
- The public certificate fingerprint is pinned in `release-identity.json`. Do not change
  that file to make a wrong key pass validation.
- The encrypted signing key is saved privately as `Mente-Agil-Beta-Signing.p12`, and its
  password is saved separately as `Mente-Agil-Beta-Signing-Password.txt`. Retrieve the
  existing files from the owner's private storage when the local workspace is missing them.
  Never commit, upload to Actions, print or share their contents with testers.
- If the existing key cannot be retrieved, stop before publishing an incompatible APK.
- Pass the previously delivered signed beta APK to `--previous-apk` when signing updates.
- The old Temas previews are separate apps. The user explicitly excluded their migration.
- Run the existing tests and signing validation. Do not modify the website or merge this
  beta into the official mobile branch as part of a beta delivery.
