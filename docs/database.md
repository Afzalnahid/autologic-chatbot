# Database

Supabase Postgres, project ref `cchvsgouqqxibhubioch`, with the `pgvector` extension.
Every tenant-owned table carries `client_id uuid` referencing `clients.id`.

---

## Tables

### `clients` — the tenant record
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, used as `client_id` everywhere |
| `business_name` | text | Shown in the dashboard sidebar |
| `owner_email` | text | Matches the Supabase Auth user |
| `plan` | text | `none` / `trial` / `starter` / `pro` / `agency` |
| `plan_expires_at` | timestamptz | Paid plans; null on legacy rows means "no expiry" |
| `trial_start`, `trial_end` | timestamptz | 3-day trial window |
| `trial_notified` | boolean | Guards duplicate expiry emails |
| `status` | text | Legacy field |
| `suspended` | boolean | Set by admin; blocks the bot immediately |
| `business_type` | text | `ecommerce` or `agency` — drives the whole product |
| `item_label` | text | "product" or "service", used in prompts and UI |
| `phone`, `address`, `website`, `logo_url` | text | Business profile |
| `gcal_access_token`, `gcal_refresh_token` | text | Google Calendar OAuth |
| `gcal_token_expiry` | timestamptz | Refresh trigger |
| `gcal_email`, `gcal_connected` | text / boolean | Connection state |

### `channels` — connected messaging pages
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `client_id` | uuid | Owner |
| `platform` | text | `facebook` / `instagram` / `whatsapp` |
| `page_id` | text | Page id, IG business id, or WA phone number id — **the webhook lookup key** |
| `access_token` | text | Page/permanent token used for sending |
| `status` | text | `connected` / `paused` |
| `bot_enabled` | boolean | Per-channel pause switch |
| `connected_at`, `created_at` | timestamptz | |

### `message_buffer` — every message in and out
| Column | Type | Notes |
|---|---|---|
| `id` | bigint | PK |
| `client_id` | uuid | Owner |
| `sender_id` | text | The customer's platform id |
| `role` | text | `customer` / `bot` / `agent` — drives analytics and quota |
| `message_content` | text | Text, or a vision description for images |
| `attachments` | text | Comma-separated media URLs |
| `platform` | text | Channel it arrived on |
| `status` | text | `Pending` / `Processed` — debounce state |
| `wa_msg_id`, `message_id`, `conversation_id`, `execution_id` | text | Platform ids, dedupe |
| `created_at` | timestamptz | |

Only `role = 'customer'` rows count towards plan limits.

### `products` — e-commerce catalogue (vector)
| Column | Type | Notes |
|---|---|---|
| `id` | text | PK |
| `client_id` | uuid | Owner |
| `content` | text | Text that was embedded (name + code + vision description) |
| `embedding` | vector(768) | `gemini-embedding-001` |
| `metadata` | jsonb | What the bot sees: name, code, prices, image_url |
| `product_id`, `product_name`, `category` | text | Flat columns for the UI |
| `regular_price`, `sale_price` | numeric | Price fallback: sale → regular → "contact us" |
| `image_url`, `stock_status` | text | |
| `analyze_images` | boolean | Whether vision ran at import |

### `knowledge_base` — agency RAG chunks (vector)
| Column | Type | Notes |
|---|---|---|
| `id` | bigint | PK |
| `client_id` | uuid | Owner |
| `file_id` | text | Groups chunks belonging to one upload |
| `content` | text | The chunk |
| `embedding` | vector(768) | |
| `metadata` | jsonb | file_name, chunk index |

### `file_registry` — one row per uploaded document
`file_id` (PK), `client_id`, `file_name`, `file_url`, `file_type`, `chunks`,
`status`, `created_at`, `last_synced`.

Deleting a file must remove the registry row, all `knowledge_base` chunks **and**
the object in Storage — see [error-handling.md](./error-handling.md#orphaned-knowledge-files).

### `orders` — e-commerce conversions
`id`, `client_id`, `order_code`, `customer_name`, `phone_number`, `address`,
`product_ids`, `product_names`, `quantity`, `total_price` (free text, e.g.
`"Shirt (2 pc) = 900 TK + Delivery = 80 TK | Total = 980 TK"`), `status`,
`image_urls`, `created_at`.

`total_price` is text because the bot writes a human-readable breakdown. Analytics
parses the `Total = N` portion.

### `bookings` — agency conversions
`id`, `client_id`, `customer_name`, `email`, `phone`, `service_want`,
`meeting_date`, `meeting_time` (text as collected), `meeting_datetime` (timestamptz),
`meeting_link` (Google Meet), `calendar_event_id`, `sender_id`, `platform`,
`status`, `created_at`.

### `comments` — Facebook post comments
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial | PK |
| `client_id` | uuid | Owner |
| `platform`, `page_id`, `post_id` | text | Where the comment lives |
| `comment_id` | text | **Unique** — also the dedupe key |
| `parent_id` | text | Set when the comment is a reply to another comment |
| `commenter_id`, `commenter_name` | text | Who commented |
| `comment_text` | text | What they wrote |
| `reply_text` | text | What the bot replied |
| `replied` | boolean | Public reply succeeded |
| `reply_error` | text | Why the public reply failed, if it did |
| `dm_sent` | boolean | Private reply (comment-to-inbox) succeeded |
| `dm_error` | text | Why the private reply failed, if it did |

Comments are deliberately **not** stored in `message_buffer`. They have different
identifiers and a different lifecycle, and mixing them into the direct-message
inbox made a comment reply look like a chat message in the customer's thread.
The dashboard shows them in their own Comments tab, including the failure reason
when Facebook rejects a private reply.

### `contacts` — per-customer state
`sender_id` + `client_id`, `name`, `bot_enabled` (per-contact pause for human
handoff), `created_at`.

### `chat_memory` — conversation context
`id`, `session_id`, `client_id`, `message` (jsonb), `created_at`. Trimmed to a
rolling window when building the prompt.

### `app_settings` — per-client bot configuration
| Column | Type | Notes |
|---|---|---|
| `id` | text | **The `client_id` as a string**, not a uuid |
| `settings` | jsonb | `botName`, `greeting`, `businessPrompt`, `questionnaire`, legacy `systemPrompt` |
| `updated_at` | timestamptz | |

### `payment_requests` — manual payment verification
`id`, `client_id`, `plan`, `billing_cycle`, `amount`, `method`, `sender_number`,
`txn_id`, `status` (`pending` / `approved` / `rejected`), `admin_note`,
`reviewed_at`, `reviewed_by`, `created_at`.

Only one `pending` row per client is allowed — enforced in the billing API.

### `admin_users` — platform staff
`id`, `email` (unique), `role` (`super` / `full` / `editor` / `viewer` / `pending`),
timestamps. New signups land as `pending` until a super admin grants a role.

---

## Vector search functions

```sql
match_documents(query_embedding vector, match_count int, filter jsonb)  -- products
match_knowledge(query_embedding vector, match_count int, filter jsonb)  -- knowledge_base
```

Both take a 768-dimension embedding and a `filter` of `{"client_id": "<uuid>"}`,
and return rows with a `similarity` score. `bot.js` passes that score to the model
as `match_score` and refuses to guess below 0.5.

**Each function must have exactly one signature.** A duplicate overload makes
PostgREST unable to choose and the call fails silently — drop extras explicitly.

---

## Row Level Security

RLS is **enabled on every table**. The application connects with the service-role
key, which bypasses RLS, so tenant isolation is enforced by the API layer
(`requireClient` + `client_id` filters). RLS is the second line of defence for any
path that ever uses the anon key.

A practical consequence: the Supabase SQL editor and the service-role client can
return different rows for the same query. When results disagree, trust what the
application sees and fix data through an app endpoint, not raw SQL.

---

## Storage buckets

| Bucket | Access | Contents |
|---|---|---|
| `product-images` | public | Product photos |
| `logos` | public | Business logos |
| `knowledge-files` | private | Uploaded PDFs/DOCX/TXT |

`storage.objects` has a `protect_objects_delete` trigger: deleting rows with SQL
raises an error. Objects must be removed through the Storage API.

---

## Migration notes

- Supabase's `execute_sql` returns only the **last** statement's result. Run one
  statement per call when you need the output.
- After adding a column, PostgREST may keep a stale schema cache and return empty
  arrays for it. Fix with `NOTIFY pgrst, 'reload schema';`, or select `*` and filter
  in JavaScript.
