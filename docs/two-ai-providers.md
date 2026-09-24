# One provider runs everything — Gemini or OpenAI

Owner's decision, 2026-09-24:

> "If it is a Gemini API key then the full system will run with this key, and if
> it is an OpenAI key the full system will run with the OpenAI key. Not a single
> part will run with another key… I can set the two providers and there will be
> an on/off switch — when one provider is turned on the other goes off
> automatically. Two providers can't be on at the same time, but both can be off
> at the same time… The embedding method has to be as per your plan — that has
> to happen automatically, not give me any hassle."

## What the system asks of an AI

Six things, and both providers do all six. Nothing in the product uses a
provider-only feature — no Google Search grounding, no file API, no response
schemas — which is why this was possible at all.

| | Google AI Studio | OpenAI |
|---|---|---|
| Replies to customers | Gemini chat models | GPT chat models |
| Reads a photograph | same model | same model |
| Hears a voice note | same model | `gpt-transcribe` |
| Makes search vectors | `gemini-embedding-001`, 768 numbers | `text-embedding-3-small`, asked for 768 |
| Default primary | `gemini-3.6-flash` | `gpt-6-luna` |
| Default fallback | `gemini-3.8-flash` | `gpt-6-sol` |

Prices, read from each provider on 2026-09-24, per million tokens
(input / output):

| Model | Input | Output |
|---|---|---|
| `gemini-3.6-flash` | $0.75 | $3.75 |
| `gpt-6-luna` | **$0.10** | **$0.50** |
| `gpt-6-sol` | $2.00 | $10.00 |
| `gemini-embedding-001` | $0.15 | — |
| `text-embedding-3-small` | $0.02 | — |

**One caveat worth knowing.** The Gemini fallback costs exactly what the primary
costs, so a failover changes nothing on the bill. OpenAI has no same-price
sibling for `gpt-6-luna`, so its fallback is twenty times dearer. It only fires
when the primary is out of quota or retired — rare, and twenty times a very
small number is still small — but it is not the free swap the Gemini pair is.

## The switch

One row per provider in `platform_ai`, each with a key, models and `enabled`.

- Turning one on turns the other off, in that order — off first, then on.
- **Both on is impossible.** A unique index (`platform_ai_one_enabled`) allows at
  most one enabled row, so a bug, a hand-run `UPDATE` or two admins pressing at
  once all hit the same wall rather than producing a half-and-half platform.
- **Both off is allowed** and means the `GEMINI_API_KEY` environment variable —
  exactly how the platform ran before any of this existed. That is the safety
  net, which is why the state is permitted.
- A provider with no saved key cannot be switched on; turning it on would stop
  every bot at once.
- Changing the switch needs the secret admin key, like every other change to a
  platform key.

Clients choose for themselves in **AI Engine**: a provider, then a primary and a
fallback model read live from that provider with their own key. One key, one
provider, everything.

## The dangerous part, and what makes it safe

Search works by comparing a question's 768 numbers with a product's 768 numbers.
Gemini's 768 and OpenAI's 768 are **different spaces**. Comparing across them
does not fail — it returns confident nonsense, which is worse than an error
because nobody sees it.

Three things together make a provider change safe:

1. **Every embedded row records the model that made it** —
   `products.embedding_model`, `knowledge_base.embedding_model`. A row from
   before this column existed is Gemini's; that is all there was.
2. **Search only compares the same space.** `match_documents` and
   `match_knowledge` take the question's model and skip every row made by a
   different one. So immediately after a switch the bot finds *fewer* products —
   never the wrong ones.
3. **The rest is rebuilt automatically.** `/api/cron/embeddings` re-embeds rows
   in the wrong space: nightly at 05:00, and at once when the platform's
   provider is switched or a client saves a key for a different provider. It is
   bounded (120 rows per table per client per run, 25 clients per run) so a huge
   catalogue cannot run the function out of time or spend an unexpected amount
   on a new key in one go; whatever is left is picked up next run.

Nobody has to press anything. The worst visible effect is a few minutes of
thinner search results.

## Where each piece lives

| Piece | File |
|---|---|
| The rules — which providers, the switch, stale vectors | `src/lib/ai-providers.js` (pure, `tests/t-ai-providers.mjs`) |
| OpenAI's six capabilities | `src/lib/openai.js` |
| Gemini's six capabilities | `src/lib/gemini.js` |
| Routing a client to one of them | `src/lib/ai.js` (`getClientAI`, `platformChat`) |
| Which provider the platform is on | `src/lib/platform-ai.js` |
| Admin switch + keys | `/api/admin/ai`, `src/app/admin/AIAdmin.js` |
| Client's own key | `/api/ai-key`, `src/app/dashboard/components/AIEngine.js` |
| The rebuild | `/api/cron/embeddings` |
| Page scraping, provider-neutral | `src/lib/scrape-products.js` |
| Migrations | `docs/sql/2026-09-24-two-ai-providers.sql`, and the search functions |

## Checks

```sql
select id, provider, enabled, (api_key_enc is not null) as has_key, model_chain
from platform_ai order by id;                        -- two rows, at most one enabled

update platform_ai set enabled = true where id = 'openai';
-- must fail with a unique violation while another row is enabled

select embedding_model, count(*) from products group by 1;
select embedding_model, count(*) from knowledge_base group by 1;
-- no NULL where embedding is not null
```

`tests/t-ai-providers.mjs` (44) and `tests/t-two-providers.mjs` (52).

## What actually changes if you switch Gemini → OpenAI

| Part | What happens |
|---|---|
| Replying to customers | Works at once. Wording and judgement differ a little — the locked prompts are tuned on Gemini. |
| Reading a photograph | Works at once. Both providers are sent the image **as bytes we download ourselves**, never a CDN link, so signed Facebook / WhatsApp URLs behave identically. |
| Voice notes | Works at once, through `gpt-transcribe`. Silence and unintelligible audio both come back as the same `[unclear]` marker the bot already understands. |
| **Finding a product or a document** | **The one thing that is briefly reduced.** Rows embedded by Gemini are skipped until the sweep re-embeds them: the bot finds fewer items for a few minutes, never the wrong ones. |
| Orders, bookings, tags, broadcasts | Unaffected — they read what the reply produced, not who produced it. |
| Cost report | Correct from the first call: OpenAI's rates are in `model_prices`, and usage is filed under the provider that really answered. |
| Clients on their OWN key | Completely unaffected. Their key, their provider; the platform's switch does not touch them. |
| Voice cost in the report | Under-counted. OpenAI bills transcription per MINUTE, not per token, so the token meter estimates it. Chat and vision are exact. |
| The model fallback | Costs more than Gemini's did: `gpt-6-sol` is twenty times `gpt-6-luna`, and it fires when the primary is out of quota. |

**How long is "a few minutes"?** The sweep does up to 120 products and 120
documents per client per run, 25 clients per run, and runs immediately on the
switch plus nightly. A shop with 120 products or fewer is whole after the first
run. The biggest package allows 2,500 products — that is 21 runs, so a catalogue
that size finishes over the following nights unless the sweep is called again.

Nothing else in the product asks anything of the AI, so nothing else can change.

## What has NOT been proved

The OpenAI side has never run against a real OpenAI key — there is none on this
machine or in the project. Every shape was written from OpenAI's own current
documentation and is covered by tests, but the first real call will be the first
real proof. Switch it on with a key, send one message on a test channel, and
check the reply and the cost line before moving any client onto it.

The bot's behaviour is also tuned on Gemini: the locked prompts, the Bangla /
Banglish rules, the hand-off token, the order format. OpenAI will follow the
same instructions differently. Try a few real conversations before deciding.
