-- Two package sets — shops and services — each with its own BYOK price list,
-- and every retired package removed. Applied to production 2026-09-19.
--
-- WHY: the owner, 2026-09-19: "there are two types, ecommerce and agency, so
-- there will be two types of packages and there will have byok client also so
-- they have also a price list" — and the old packages "should clear from every
-- where". The one "both" ladder of 2026-09-18 is replaced by shop_* and svc_*.
-- Services are cheaper: no catalogue for the AI to read. Launch prices to
-- 31 December 2026. Nothing unlimited; products/documents are adds a month.
--
-- The three accounts still on retired packages move first (owner: straight to
-- the new limits, no carried-over allowance), keeping their expiry dates:
--   Broker's BD  shop_growth → shop_pro
--   EzPz         svc_starter → svc_basic
--   Autologic    svc_growth  → svc_enterprise  (internal account)
-- Only then are the retired rows deleted — deleting a package somebody is on
-- would stop their bot. Run as one transaction.

begin;

insert into plans as p
 (id, biz, name, tagline, sort, active, public, monthly, yearly, byok_monthly, byok_yearly,
  messages_per_day, messages_per_month, channels,
  max_products, max_kb_files, max_scrapes_per_month, max_broadcasts_per_month, max_assistant_per_month,
  features, feature_list, highlight)
select t.id, t.biz, t.name, t.tagline, t.sort, true, true, t.m, t.m * 10, t.bm, t.bm * 10,
  null, t.mpm, t.ch, t.prods, t.docs, t.scrapes, t.casts, t.asst,
  jsonb_build_object('vision',true,'voice',true,'comments',true,'widget',true,'broadcast',true,
    'followup',true,'kb',true,'photo_import',true,'website_import',true,
    'assistant',true,'calendar',true,'analytics',true,'byok',true),
  t.fl, t.hl
from (values
 ('shop_basic','ecommerce','Shop Basic','One or two pages, your catalogue answering all day',1,2699,1999,2000,2,500,0,10,10,100,
  '["2,000 bot replies / month","2 channels + website widget","500 products added / month","100 AI Assistant questions / month","Every feature — nothing is held back"]'::jsonb,false),
 ('shop_pro','ecommerce','Shop Pro','Every channel, a full catalogue',2,5999,4499,5500,3,1000,0,40,40,400,
  '["5,500 bot replies / month","All 3 channels + website widget","1,000 products added / month","400 AI Assistant questions / month","Every feature — nothing is held back"]'::jsonb,true),
 ('shop_enterprise','ecommerce','Shop Enterprise','The most of everything, and room to fit your shop',3,11999,8999,12000,3,2500,0,100,100,800,
  '["12,000 bot replies / month","All 3 channels + website widget","2,500 products added / month","800 AI Assistant questions / month","Priority support","Need more? We set your limits to fit"]'::jsonb,false),
 ('svc_basic','agency','Service Basic','One or two pages, answering from your own documents',4,2299,1699,2000,2,0,20,0,10,100,
  '["2,000 bot replies / month","2 channels + website widget","20 knowledge documents added / month","100 AI Assistant questions / month","Every feature, Google Calendar booking included"]'::jsonb,false),
 ('svc_pro','agency','Service Pro','Every channel, and meetings booked while you sleep',5,4999,3499,5500,3,0,60,0,40,400,
  '["5,500 bot replies / month","All 3 channels + website widget","60 knowledge documents added / month","400 AI Assistant questions / month","Every feature, Google Calendar booking included"]'::jsonb,true),
 ('svc_enterprise','agency','Service Enterprise','The most of everything, and room to fit your practice',6,9999,7499,12000,3,0,150,0,100,800,
  '["12,000 bot replies / month","All 3 channels + website widget","150 knowledge documents added / month","800 AI Assistant questions / month","Priority support","Need more? We set your limits to fit"]'::jsonb,false)
) as t(id,biz,name,tagline,sort,m,bm,mpm,ch,prods,docs,scrapes,casts,asst,fl,hl)
on conflict (id) do update set
 biz=excluded.biz, name=excluded.name, tagline=excluded.tagline, sort=excluded.sort,
 active=true, public=true, monthly=excluded.monthly, yearly=excluded.yearly,
 byok_monthly=excluded.byok_monthly, byok_yearly=excluded.byok_yearly,
 messages_per_day=null, messages_per_month=excluded.messages_per_month, messages_per_channel=null,
 channels=excluded.channels, max_products=excluded.max_products, max_kb_files=excluded.max_kb_files,
 max_scrapes_per_month=excluded.max_scrapes_per_month, max_broadcasts_per_month=excluded.max_broadcasts_per_month,
 max_assistant_per_month=excluded.max_assistant_per_month,
 features=excluded.features, feature_list=excluded.feature_list, highlight=excluded.highlight,
 model_chain=null, updated_at=now();

update clients set plan = 'shop_pro'       where plan = 'shop_growth';
update clients set plan = 'svc_basic'      where plan = 'svc_starter';
update clients set plan = 'svc_enterprise' where plan = 'svc_growth';

-- Anybody still on a retired id stops the migration rather than being cut off.
do $$ begin
  if exists (select 1 from clients where plan in
    ('basic','pro','enterprise','starter','agency',
     'shop_starter','shop_growth','shop_scale','svc_starter','svc_growth','svc_scale')) then
    raise exception 'a client is still on a retired package — move them first';
  end if;
end $$;

delete from plans where id in
  ('basic','pro','enterprise','starter','agency',
   'shop_starter','shop_growth','shop_scale','svc_starter','svc_growth','svc_scale');

commit;
