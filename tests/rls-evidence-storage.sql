-- Disposable PostgreSQL Storage RLS checks. Simulates metadata operations,
-- NOT Supabase Storage API upload, JWT validation, file bytes or signed URLs.
-- Run after migrations and tests/postgres-storage-bootstrap.sql.
begin;
set local statement_timeout = '30s';

insert into auth.users(id, raw_user_meta_data) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}'::jsonb),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{}'::jsonb),
 ('cccccccc-4ccc-4ccc-8ccc-cccccccccccc', '{}'::jsonb),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '{}'::jsonb),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '{}'::jsonb);
insert into public.organisations(id, name) values
 ('11111111-1111-4111-8111-111111111111', 'Evidence Org A'),
 ('22222222-2222-4222-8222-222222222222', 'Evidence Org B');
insert into public.organisation_members(organisation_id,user_id,role,active) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','site_manager',true),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','inspector',true),
 ('11111111-1111-4111-8111-111111111111','cccccccc-4ccc-4ccc-8ccc-cccccccccccc','viewer',true),
 ('22222222-2222-4222-8222-222222222222','dddddddd-dddd-4ddd-8ddd-dddddddddddd','site_manager',true),
 ('11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','inspector',false);
insert into public.projects(id,organisation_id,name) values
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Evidence Project');
insert into public.plots(id,project_id,plot_number) values
 ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','1');
insert into public.qa_inspections(id,plot_id,stage_number,attempt,result,created_by)
values ('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444',1,1,'pass','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into storage.buckets(id,name,public) values ('other-bucket','other-bucket',false);

do $$ begin
  if not exists (
    select 1 from storage.buckets
    where id='qa-evidence' and public=false and file_size_limit=20971520
      and allowed_mime_types @> array['image/jpeg','image/png','image/heic','application/pdf']::text[]
  ) then raise exception 'FAIL: private evidence bucket configuration missing'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
insert into storage.objects(bucket_id,name,owner_id,metadata) values (
 'qa-evidence',
 '11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555/66666666-6666-4666-8666-666666666666.jpg',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '{"mimetype":"image/jpeg"}'::jsonb
);
do $$ begin
 if (select count(*) from storage.objects where bucket_id='qa-evidence') <> 1
 then raise exception 'FAIL: authorised manager cannot read own evidence'; end if;
end $$;

-- An active inspector may upload to an existing inspection.
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
insert into storage.objects(bucket_id,name,owner_id,metadata) values (
 'qa-evidence',
 '11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555/77777777-7777-4777-8777-777777777777.pdf',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '{"mimetype":"application/pdf"}'::jsonb
);

-- Invalid paths, mismatched MIME, wrong org, missing inspection and wrong
-- bucket must all be denied, even for an otherwise authorised inspector.
do $$
declare v record; denied boolean;
begin
 for v in
   select * from (values
     ('qa-evidence','22222222-2222-4222-8222-222222222222/55555555-5555-4555-8555-555555555555/88888888-8888-4888-8888-888888888888.jpg','image/jpeg'),
     ('qa-evidence','11111111-1111-4111-8111-111111111111/99999999-9999-4999-8999-999999999999/88888888-8888-4888-8888-888888888888.jpg','image/jpeg'),
     ('qa-evidence','11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555/88888888-8888-4888-8888-888888888888.jpg','application/pdf'),
     ('qa-evidence','11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555/88888888-8888-4888-8888-888888888888.exe','image/jpeg'),
     ('qa-evidence','11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555/../escape.jpg','image/jpeg'),
     ('other-bucket','11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555/88888888-8888-4888-8888-888888888888.jpg','image/jpeg')
   ) as cases(bucket_id,path,mime)
 loop
   denied := false;
   begin
     insert into storage.objects(bucket_id,name,metadata)
     values (v.bucket_id,v.path,jsonb_build_object('mimetype',v.mime));
   exception when insufficient_privilege then denied := true;
   end;
   if not denied then raise exception 'FAIL: invalid evidence accepted: %',v.path; end if;
 end loop;
end $$;

-- A viewer may read but not upload.
select set_config('request.jwt.claim.sub','cccccccc-4ccc-4ccc-8ccc-cccccccccccc',true);
do $$
declare denied boolean := false;
begin
 if (select count(*) from storage.objects where bucket_id='qa-evidence') <> 2
 then raise exception 'FAIL: viewer cannot read own organisation evidence'; end if;
 begin
   insert into storage.objects(bucket_id,name,metadata) values (
     'qa-evidence',
     '11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555/88888888-8888-4888-8888-888888888888.png',
     '{"mimetype":"image/png"}'::jsonb);
 exception when insufficient_privilege then denied := true;
 end;
 if not denied then raise exception 'FAIL: viewer uploaded evidence'; end if;
end $$;

-- A different organisation must neither read nor upload A's evidence.
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $$
declare denied boolean := false;
begin
 if exists (select 1 from storage.objects where bucket_id='qa-evidence')
 then raise exception 'FAIL: cross-org evidence readable'; end if;
 begin
   insert into storage.objects(bucket_id,name,metadata) values (
     'qa-evidence',
     '11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555/88888888-8888-4888-8888-888888888888.png',
     '{"mimetype":"image/png"}'::jsonb);
 exception when insufficient_privilege then denied := true;
 end;
 if not denied then raise exception 'FAIL: cross-org evidence uploaded'; end if;
end $$;

select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
do $$ begin
 if exists (select 1 from storage.objects where bucket_id='qa-evidence')
 then raise exception 'FAIL: inactive user can read evidence'; end if;
end $$;

-- Evidence must remain append-only even for the originating manager.
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$
declare changed integer;
begin
 update storage.objects set name = 'tampered.jpg' where bucket_id='qa-evidence';
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'FAIL: evidence could be overwritten'; end if;
 delete from storage.objects where bucket_id='qa-evidence';
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'FAIL: evidence could be deleted'; end if;
 if (select count(*) from storage.objects where bucket_id='qa-evidence') <> 2
 then raise exception 'FAIL: evidence changed after blocked write'; end if;
end $$;

rollback;
