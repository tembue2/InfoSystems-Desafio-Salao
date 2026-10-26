begin;
-- Executar após a migração dentro da mesma transacção; ROLLBACK obrigatório.
insert into auth.users(id,email) values
('00000000-0000-4000-a000-000000000001','mvp-test-manager@example.invalid'),
('00000000-0000-4000-a000-000000000002','mvp-test-customer@example.invalid'),
('00000000-0000-4000-a000-000000000003','mvp-test-professional@example.invalid'),
('00000000-0000-4000-a000-000000000004','mvp-test-other@example.invalid'),
('00000000-0000-4000-a000-000000000005','mvp-test-reception@example.invalid');
update public.profiles set role='manager' where id='00000000-0000-4000-a000-000000000001';
update public.profiles set role='professional' where id='00000000-0000-4000-a000-000000000003';
update public.profiles set role='reception' where id='00000000-0000-4000-a000-000000000005';
insert into public.services(id,name,price_mzn,duration_minutes) values('00000000-0000-4000-b000-000000000001','MVP TEST SERVICE',100,60);
insert into public.professionals(id,display_name,profile_id) values('00000000-0000-4000-b000-000000000002','MVP TEST PROFESSIONAL','00000000-0000-4000-a000-000000000003');
insert into public.professional_services values('00000000-0000-4000-b000-000000000002','00000000-0000-4000-b000-000000000001');
insert into public.work_hours(professional_id,weekday,opens,closes) select '00000000-0000-4000-b000-000000000002',d,'08:00','17:00' from generate_series(1,7)d;
insert into public.products(id,name,kind,quantity) values('00000000-0000-4000-b000-000000000003','MVP TEST PRODUCT','consumable',5);
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000002',true);
set local role authenticated;
DO $$ declare bid uuid;pid uuid;slot timestamptz;failed boolean;begin
 select slot_start into slot from public.available_slots('00000000-0000-4000-b000-000000000001','00000000-0000-4000-b000-000000000002',(now() at time zone 'Africa/Maputo')::date+1) limit 1;
 if slot is null then raise exception 'TEST no slots';end if;
 bid:=public.create_booking('00000000-0000-4000-b000-000000000001','00000000-0000-4000-b000-000000000002',slot);
 perform set_config('test.booking',bid::text,true);
 failed:=false;begin perform public.create_booking('00000000-0000-4000-b000-000000000001','00000000-0000-4000-b000-000000000002',slot);exception when others then failed:=true;end;
 if not failed then raise exception 'TEST overlapping reservation allowed';end if;
 failed:=false;begin perform public.register_payment(bid,100,'cash');exception when others then failed:=true;end;
 if not failed then raise exception 'TEST customer registered payment';end if;
 failed:=false;begin update public.profiles set role='manager' where id=auth.uid();exception when insufficient_privilege then failed:=true;end;
 if not failed then raise exception 'TEST role escalation';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000004',true);
 if exists(select 1 from public.bookings where id=bid) then raise exception 'TEST other customer can read';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000005',true);
 pid:=public.register_payment(bid,40,'cash','TEST PARTIAL');
 if (select status from public.bookings where id=bid)<>'pending_payment' then raise exception 'TEST registration confirmed';end if;
 perform public.validate_payment(pid,true);
 if (select status from public.bookings where id=bid)<>'pending_payment' then raise exception 'TEST partial payment confirmed';end if;
 failed:=false;begin perform public.register_payment(bid,61,'cash');exception when others then failed:=true;end;
 if not failed then raise exception 'TEST overpayment';end if;
 pid:=public.register_payment(bid,60,'mpesa','TEST COMPLETE');perform public.validate_payment(pid,true);
 if (select status from public.bookings where id=bid)<>'confirmed' then raise exception 'TEST full payment failed';end if;
 failed:=false;begin perform public.validate_payment(pid,true);exception when others then failed:=true;end;
 if not failed then raise exception 'TEST duplicate validation';end if;
 if public.finance_summary(now()-interval '1 day',now()+interval '1 day') is not null then raise exception 'TEST reception finance leak';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000003',true);
 if exists(select 1 from public.payments where booking_id=bid) then raise exception 'TEST professional payment leak';end if;
 if not exists(select 1 from public.bookings where id=bid) then raise exception 'TEST professional cannot see assigned booking';end if;
 perform public.set_booking_status(bid,'in_progress');perform public.set_booking_status(bid,'completed');
 failed:=false;begin perform public.set_booking_status(bid,'confirmed');exception when others then failed:=true;end;
 if not failed then raise exception 'TEST invalid transition';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000001',true);
 if public.adjust_stock('00000000-0000-4000-b000-000000000003',-2,'TEST consumption')<>3 then raise exception 'TEST stock';end if;
 failed:=false;begin perform public.adjust_stock('00000000-0000-4000-b000-000000000003',-4,'TEST insufficient');exception when others then failed:=true;end;
 if not failed then raise exception 'TEST negative stock';end if;
 if (select count(*) from public.stock_movements where product_id='00000000-0000-4000-b000-000000000003')<>1 then raise exception 'TEST stock atomicity';end if;
 if (select sum(amount_mzn) from public.payments where booking_id=bid and validation_status='validated')<>100 then raise exception 'TEST duplicate income';end if;
 if not exists(select 1 from public.audit_events where record_id=bid::text) then raise exception 'TEST audit missing';end if;
end;$$;

DO $$ declare d date:=(now() at time zone 'Africa/Maputo')::date+1; at_time timestamptz; result jsonb;begin
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000001',true);
 select slot_start into at_time from public.available_slots('00000000-0000-4000-b000-000000000001','00000000-0000-4000-b000-000000000002',d) limit 1;
 insert into public.time_off(professional_id,starts_at,ends_at,reason) values('00000000-0000-4000-b000-000000000002',at_time,at_time+interval '1 hour','TEST time off');
 if exists(select 1 from public.available_slots('00000000-0000-4000-b000-000000000001','00000000-0000-4000-b000-000000000002',d) where slot_start=at_time) then raise exception 'TEST time off ignored';end if;
 update public.work_hours set closes='08:30' where professional_id='00000000-0000-4000-b000-000000000002';
 if exists(select 1 from public.available_slots('00000000-0000-4000-b000-000000000001','00000000-0000-4000-b000-000000000002',d)) then raise exception 'TEST service does not fit work hours';end if;
 insert into public.expenses(description,amount_mzn,occurred_at) values('TEST finance',30,'2200-01-01 12:00+02');
 insert into public.manual_income(description,amount_mzn,occurred_at) values('TEST finance',50,'2200-01-01 12:00+02');
 result:=public.finance_summary('2200-01-01 00:00+02','2200-01-02 00:00+02');
 if (result->>'expenses')::numeric<>30 or (result->>'other')::numeric<>50 then raise exception 'TEST finance aggregation';end if;
end;$$;

reset role;
select 'PASS: reservation, overlap, RLS four roles, payments partial/full, duplicate validation, operational states, stock, audit, time off, work hours, finance' as test_result;

rollback;
