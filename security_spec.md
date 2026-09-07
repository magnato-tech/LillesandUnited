# Security Specification & Hardening Rules (Lillesand United)

## 1. Data Invariants
- **Master Deny**: Any write or read to unlisted paths is strictly forbidden.
- **Connection Test**: The test collection `/test/{testId}` allows reading connection health documents and writing test docs with valid ID format.
- **Persons**: Documents in `/persons/{personId}` must have matching `id == personId`. Fields `id`, `firstName`, `nameNumber`, and `displayId` are mandatory. ID lengths must not exceed 128 characters, names <= 64 chars.
- **Tournament Matches**: Matches cannot be updated without a valid match ID and valid round/position types.
- **Tournament Participants**: Participant records must link to valid personId and match path `{participantId}`.
- **Popcorn Bongs**: Bong numbers must be within valid capacity (1..100). Status transitions are restricted (blank -> activated -> used).
- **Alpha Interest**: Contact records require valid firstName and registration timestamp with sane length constraints.
- **App State**: Consolidated state documents can only be written by admin/server operations.

## 2. The "Dirty Dozen" Payloads (All MUST return PERMISSION_DENIED or be rejected)
1. **Ghost Field Poisoning**: Payload to `/persons/{personId}` injecting arbitrary system/admin properties like `isAdmin: true`.
2. **Denial-of-Wallet Overflow**: Attempt to write a `firstName` or `notes` containing a 2MB string.
3. **ID Poisoning / Traversal**: Attempt to write to a path using non-alphanumeric or path-traversal ID `../../secret`.
4. **Invalid Number Range**: Attempt to write a popcorn bong with `number: -5` or `number: 999999`.
5. **State Shortcut / Status Violation**: Attempt to update a match status directly to an invalid enum state like `hacked`.
6. **Immutable Field Mutate**: Attempt to mutate `createdAt` or `id` during update of a Person document.
7. **Spoofed User/Person ID**: Attempt to create a participant with mismatched ID from path ID.
8. **Null / Missing Mandatory Keys**: Attempt to create a person without `displayId` or `nameNumber`.
9. **Blanket Query Scraping**: Attempting an unbounded collection query without valid permissions.
10. **Type Confusion Attack**: Attempting to write a boolean or array into a field expected to be a number (`nameNumber: true`).
11. **Overwriting System State**: Unauthenticated client attempting to overwrite `/appState/current`.
12. **Bong Double Activation / Status Skip**: Attempting to transition a bong directly from `used` back to `blank` or `activated`.
