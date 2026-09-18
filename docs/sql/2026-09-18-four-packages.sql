-- Four packages, and every one of them carries every feature.
-- Applied to production 2026-09-18. Safe to run twice.
--
-- WHY: six packages (three for shops, three for services) withheld four
-- capabilities by tier and sold on a per-message price that lost money. They are
-- replaced by a trial and three sizes, priced off the measured cost of a reply
-- (৳0.49 on 2026-09-18, from seven real messages through Autologic).
--
-- biz is "both" throughout: the capacity row is read as PRODUCTS by a shop and
-- as DOCUMENTS by a service, so one row serves both sides. That is what turns
-- six packages into three without taking anything away from either.
--
-- The old six are NOT deleted and NOT deactivated. They are made private:
-- invisible on the pricing page, fully alive for the accounts already on them.
-- Deactivating a package somebody is paying for would stop their bot.

insert into plans as p
 (id, biz, name, tagline, sort, active, public, monthly, yearly, byok_monthly, byok_yearly,
  messages_per_day, messages_per_month, channels,
  max_products, max_kb_files, max_scrapes_per_month, max_broadcasts_per_month,
  features, feature_list, highlight)
select t.id, t.biz, t.name, t.tagline, t.sort, true, true, t.monthly, t.yearly, t.byok_monthly, t.byok_yearly,
  t.mpd, t.mpm, t.channels, t.prods, t.docs, t.scrapes, t.casts,
  jsonb_build_object('vision',true,'voice',true,'comments',true,'widget',true,'broadcast',true,
    'followup',true,'kb',true,'photo_import',true,'website_import',true,
    'assistant',true,'calendar',true,'analytics',true,'byok',true),
  t.feature_list, t.highlight
from (values
 ('trial','both','Free Trial','Every feature, for three days',0,0,0,null::int,null::int,
  30::int,null::int,1,20::int,2::int,5::int,2::int,
  '["Every feature switched on","30 bot replies a day (about 5-6 customers)","1 channel of your choice","20 products or 2 documents","No card needed"]'::jsonb,false),
 ('basic','both','Basic','One or two pages, answered all day',1,1999,19990,1499,14990,
  null::int,2000::int,2,500::int,25::int,20::int,10::int,
  '["2,000 bot replies / month","2 channels + website widget","500 products or 25 documents","Every feature — nothing is held back","Extra replies at ৳0.60 each"]'::jsonb,false),
 ('pro','both','Pro','Every channel, a full catalogue',2,4999,49990,3499,34990,
  null::int,5500::int,3,1500::int,150::int,100::int,40::int,
  '["5,500 bot replies / month","All 3 channels + website widget","1,500 products or 150 documents","Every feature — nothing is held back","Extra replies at ৳0.60 each"]'::jsonb,true),
 ('enterprise','both','Enterprise','Your numbers, set to your business',3,9999,99990,6999,69990,
  null::int,12000::int,3,null::int,null::int,null::int,null::int,
  '["12,000 bot replies / month, or your own number","All 3 channels + website widget","Unlimited products and documents","Priority support","Limits set per account — tell us what you need"]'::jsonb,false)
) as t(id,biz,name,tagline,sort,monthly,yearly,byok_monthly,byok_yearly,
       mpd,mpm,channels,prods,docs,scrapes,casts,feature_list,highlight)
on conflict (id) do update set
 biz=excluded.biz, name=excluded.name, tagline=excluded.tagline, sort=excluded.sort,
 active=true, public=true, monthly=excluded.monthly, yearly=excluded.yearly,
 byok_monthly=excluded.byok_monthly, byok_yearly=excluded.byok_yearly,
 messages_per_day=excluded.messages_per_day, messages_per_month=excluded.messages_per_month,
 channels=excluded.channels, max_products=excluded.max_products, max_kb_files=excluded.max_kb_files,
 max_scrapes_per_month=excluded.max_scrapes_per_month, max_broadcasts_per_month=excluded.max_broadcasts_per_month,
 features=excluded.features, feature_list=excluded.feature_list, highlight=excluded.highlight,
 updated_at=now();

-- Withdrawn from sale, still live for whoever is on them.
update plans set public = false, updated_at = now()
where id in ('shop_starter','shop_growth','shop_scale','svc_starter','svc_growth','svc_scale');

-- These two predate the shop/service split and nobody is on them.
update plans set active = false, public = false, updated_at = now()
where id in ('starter','agency')
  and id not in (select distinct plan from clients where plan is not null);
