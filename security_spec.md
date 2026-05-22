# Security Specification - Academy Guard

## Data Invariants
1. A Package cannot exist without a valid Player ID.
2. Access to Player data is restricted to the specific Tenant (identified by `ownerId`).
3. Only Admins can modify `role` or `ownerId` in `appUsers`.
4. Users cannot modify `ownerId` on existing documents (Immutability).
5. All writes must include a valid `ownerId` matching the user's tenant ID.

## The "Dirty Dozen" Payloads (Deny Test Cases)

1. **Identity Spoofing**: Create a player with someone else's `ownerId`.
   ```json
   { "name": "Hack", "ownerId": "target-tenant-id", "levelId": "l1", "locationId": "loc1", "numSessions": 8 }
   ```
2. **Privilege Escalation**: Non-admin trying to set `role: 'admin'` in their profile.
   ```json
   { "role": "admin" }
   ```
3. **Ghost Field Injection**: Adding `isVerified: true` to a player document.
   ```json
   { "name": "Joe", "isVerified": true, "ownerId": "my-id" }
   ```
4. **ID Poisoning**: Using a 2MB string as a document ID.
5. **Orphaned Writes**: Creating a session for a non-existent package.
6. **State Shortcutting**: Updating a package status to 'Paid' without being an admin (if restricted).
7. **Cross-Tenant Read**: Trying to `get()` a player from another tenant.
8. **Malicious Regex**: Injecting script tags into a name field.
9. **Unverified Auth**: Write operation from a user with an unverified email (if enforced).
10. **Shadow Update**: Updating `ownerId` on an existing document.
11. **PII Leak**: Accessing the `appUsers` collection as a different user.
12. **Recursive Cost Attack**: Deeply nested document lookups (checked by rule structure).

## Test Runner (Conceptual - Firestore Emulator recommended for local dev)

`firestore.rules.test.ts` logic:
- Initialize `firebase-testing` with various auth profiles.
- Verify `PERMISSION_DENIED` for all "Dirty Dozen" payloads.
- Verify `ALLOWED` for legitimate CRUD operations.
