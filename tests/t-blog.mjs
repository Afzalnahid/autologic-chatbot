// The blog (owner, 2026-10-04): slugs, the prompt and its facts sheet, the checks
// on what the model returns, the editor's checks, and the safe Markdown renderer.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");
const B = await import(pathToFileURL(join(root, "src", "lib", "blog.js")).href);
const M = await import(pathToFileURL(join(root, "src", "lib", "blog-md.js")).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", name); } };

// Slugs.
ok("a title becomes a slug", B.slugify("Facebook Page Chatbot: 7 Ways to Sell More!") === "facebook-page-chatbot-7-ways-to-sell-more");
ok("accents are dropped", B.slugify("Café & Crème") === "cafe-and-creme");
ok("a Bangla-only title gives a fallback", B.slugify("ফেসবুক চ্যাটবট") === "post");
ok("a slug is never longer than 80", B.slugify("a".repeat(200)).length <= 80);
ok("a taken slug gets -2, then -3", B.uniqueSlug("whatsapp-bot", ["whatsapp-bot"]) === "whatsapp-bot-2" && B.uniqueSlug("whatsapp-bot", ["whatsapp-bot", "whatsapp-bot-2"]) === "whatsapp-bot-3");

// Reading time.
ok("reading time is at least a minute", B.readingMinutes("short") === 1);
ok("~1,000 English words is about 5 minutes", B.readingMinutes("word ".repeat(1000)) === 5);

// The facts sheet and the prompt.
const facts = B.factsSheet({ plans: [{ name: "Shop Basic", biz: "ecommerce", monthly: 2699, byok_monthly: 1349 }, { name: "Service Basic", biz: "agency", monthly: 2299, byok_monthly: 1149 }], solutions: [{ slug: "whatsapp-chatbot", title: "WhatsApp chatbot" }] });
ok("the facts carry the live prices", facts.includes("Shop Basic: ৳2,699/month") && facts.includes("own AI key: ৳1,349"));
ok("the facts carry the Meta wording rule", facts.includes("Meta Tech Provider") && /Never write "Meta Verified"/.test(facts));
ok("the facts forbid invented numbers and customers", /DO NOT INVENT/.test(facts));
ok("the facts list the internal links", facts.includes("/solutions/whatsapp-chatbot") && facts.includes("/pricing"));
const en = B.buildPrompt({ keyword: "facebook page chatbot", lang: "en", facts });
const bn = B.buildPrompt({ keyword: "ফেসবুক পেজ চ্যাটবট", lang: "bn", notes: "for clothing shops", facts });
ok("the prompt asks for one JSON object with every field", /Return ONE JSON object/.test(en.system) && ["title", "slug", "meta_description", "excerpt", "body_markdown", "faq"].every((k) => en.system.includes(`"${k}"`)));
ok("the prompt carries the facts", en.system.includes(facts));
ok("a Bangla prompt asks for natural Bangla", /natural, conversational Bangla/.test(bn.system) && /in Bangla/.test(bn.system));
ok("the slug stays English even for Bangla", /lowercase English words/.test(bn.system));
ok("the owner's notes reach the model", bn.user.includes("for clothing shops") && bn.user.includes("Language: Bangla"));

// What the model returns.
const body = "Intro paragraph. ".repeat(10) + "\n\n## Why it matters\n\n" + "word ".repeat(520);
const good = B.parseDraft(JSON.stringify({ title: "Facebook page chatbot for shops", slug: "Facebook Page Chatbot", meta_description: "Answer every message.", excerpt: "Short.", body_markdown: "# Facebook page chatbot\n\n" + body, faq: [{ q: "Is it free?", a: "There is a trial." }, { question: "Q2", answer: "A2" }, { q: "", a: "x" }] }));
ok("a good draft is accepted", good.ok);
ok("…its slug is cleaned", good.draft.slug === "facebook-page-chatbot");
ok("…a stray # title at the top is removed", !good.draft.body_md.startsWith("# "));
ok("…FAQ in either key style is kept, empties dropped", good.draft.faq.length === 2 && good.draft.faq[1].q === "Q2");
ok("a draft in a code fence is still read", B.parseDraft("```json\n" + JSON.stringify({ title: "T", body_markdown: body }) + "\n```").ok);
ok("a too-short draft is refused", !B.parseDraft({ title: "T", body_markdown: "too short" }).ok);
ok("no title is refused", !B.parseDraft({ body_markdown: body }).ok);
ok("broken JSON is refused with a plain reason", /readable/.test(B.parseDraft("{nope").error));
const long = B.parseDraft({ title: "x ".repeat(80), meta_description: "y ".repeat(120), body_markdown: body });
ok("an over-long title and description are trimmed", long.ok && long.draft.title.length <= B.MAX_TITLE && long.draft.meta_description.length <= B.MAX_META);

// The editor.
ok("an edit needs a title", !B.cleanEdit({ body_md: "x" }).ok);
ok("an edit needs an article", !B.cleanEdit({ title: "T" }).ok);
ok("an edit's slug is cleaned", B.cleanEdit({ title: "T", slug: "My Post!", body_md: "x" }).edit.slug === "my-post");

// The Markdown renderer is safe.
const r = M.renderMarkdown("Intro with **bold**, *italic* and `code`.\n\n## Section one\n\n- a\n- b\n\n1. first\n2. second\n\n> quoted\n\n[pricing](/pricing) [ext](https://example.com) [bad](javascript:alert(1)) <script>alert(1)</script> <img src=x onerror=alert(1)>");
ok("bold, italic and code render", r.html.includes("<strong>bold</strong>") && r.html.includes("<em>italic</em>") && r.html.includes("<code>code</code>"));
ok("headings render with an anchor and are listed", r.html.includes('<h2 id="section-one">Section one</h2>') && r.headings[0].text === "Section one");
ok("lists render", r.html.includes("<ul><li>a</li><li>b</li></ul>") && r.html.includes("<ol><li>first</li><li>second</li></ol>"));
ok("a quote renders", r.html.includes("<blockquote>quoted</blockquote>"));
ok("a site link stays on the site", r.html.includes('<a href="/pricing">pricing</a>'));
ok("an outside link opens apart and is nofollow", r.html.includes('href="https://example.com" target="_blank" rel="noopener nofollow"'));
ok("a javascript: link becomes plain text", !r.html.includes("javascript:") && r.html.includes("bad"));
ok("raw HTML is escaped, never run", !r.html.includes("<script>") && !r.html.includes("<img") && r.html.includes("&lt;script&gt;"));
ok("a # inside the body is never a second H1", !M.renderMarkdown("# Big").html.includes("<h1"));

// Wiring.
const route = read("src", "app", "api", "admin", "blog", "route.js");
ok("changing the blog key needs full access and the secret admin key", /CAN_DELETE\.includes\(role\)/.test(route) && /checkSuperKey\(request\)/.test(route));
ok("the key is checked with OpenAI before it is saved, and stored encrypted", /listModels\("openai", key\)/.test(route) && /encryptSecret\(key\)/.test(route));
ok("the browser only ever sees a mask", !/api_key_enc[^;]*NextResponse\.json/.test(route) && /key_mask/.test(route));
ok("only an approved draft is published", /action === "publish"/.test(route) && /status: "published"/.test(route));
const page = read("src", "app", "blog", "[slug]", "page.js");
ok("the public page shows published posts only", /\.eq\("status", "published"\)/.test(page));
ok("a partner's white-label address has no blog", /isWhiteLabel\(brandForHost\(headers\(\)\.get\("host"\)\)\)\) notFound\(\)/.test(page));
ok("the article is rendered with the safe renderer", /renderMarkdown\(post\.body_md\)/.test(page));

console.log(`t-blog: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
