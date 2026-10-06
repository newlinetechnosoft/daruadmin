# src/server/platform — users, settings, gateway config, notifications, audit

**Read when:** activate/deactivate users, create staff, site settings, payment gateway settings, notifications, audit log.
**Conventions:** `src/server/AGENT.md` · **Auth/roles:** `src/lib/AGENT.md`.

## Users (admin ERP)

- One `user` table + `role` (`admin | manager | rider | customer`); extra profile tables for rider/manager. Use better-auth's **admin plugin** for ban/unban, role changes, create user, set password, impersonation (avoid impersonation unless needed).
- **Activate/deactivate** = set `isActive` and ban; deactivated users' sessions are rejected by `authMiddleware`; revoke existing sessions.
- Admin can manage all roles; managers can only **view** customers/riders (see matrix in `src/lib/AGENT.md`).
- Never let an admin deactivate/demote the last active admin.

## Site settings (`site_settings`, key/value JSON)

VAT %, delivery fee model, store info (name, PAN/VAT no., address, phone), age-gate text & cookie duration, low-stock default, order notification options. `getSiteSettings` returns a **public subset** to the storefront.

## Gateway config (admin only — eSewa, future)

Table `payment_gateways` (`provider`, `mode` test/live, `config` **AES-GCM encrypted**, `isActive`). Getter returns **masked** values; update replaces secrets only when a new value is provided. Key from `APP_ENCRYPTION_KEY`. Log every change in the audit log.

## Notifications

- `notifications` table (`userId`, `type`, `title`, `body`, `data`, `readAt`). Producer API: `notify(userIds | role, payload)` — keep it stable so the transport can change.
- Transport v1: **polling** (`refetchInterval` ~15–30 s while the tab is visible) — Vercel has no persistent WebSockets. Later: Web Push (PWA + VAPID) for riders, optional SMS.
- Events: new order → managers; rider assigned → rider; order status changes → customer.

## Audit log

`audit_logs` (`actorId`, `action`, `entityType`, `entityId`, `before`, `after`, `ip`, `createdAt`). Written by `audit.ts` for every admin/manager mutation. Append-only.

## Functions

| Function                                                                    | Roles                                  | Purpose                       | Status |
| --------------------------------------------------------------------------- | -------------------------------------- | ----------------------------- | ------ |
| `listUsers(role)`, `getUser`                                                | admin (manager: view riders/customers) | Users with filters/pagination | ⬜     |
| `createStaffUser`, `setUserRole`                                            | admin                                  | Create manager/rider/admin    | ⬜     |
| `setUserActive`, `resetUserPassword`                                        | admin                                  | Activate/deactivate, reset    | ⬜     |
| `getSiteSettings` (public subset), `updateSiteSettings`                     | public / admin                         | Settings                      | ⬜     |
| `getGatewayConfig` (masked), `updateGatewayConfig`                          | admin                                  | eSewa config                  | ⬜     |
| `listMyNotifications`, `markNotificationRead`, `markAllRead`, `unreadCount` | any signed-in                          | In-app notifications          | ⬜     |
| `listAuditLogs`                                                             | admin                                  | Audit trail                   | ⬜     |
| internal: `notify`, `audit`                                                 | (server only)                          | Helpers                       | ⬜     |

## Assumptions to confirm

- Whether managers may deactivate customers (default: no).
- SMS provider (future).

## Status: ⬜ not started
