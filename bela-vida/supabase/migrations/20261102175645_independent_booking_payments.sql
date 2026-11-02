-- Approval and payment are independent; expired legacy reservations are not revived.
CREATE OR REPLACE FUNCTION public.request_booking_services(p_services uuid[], p_professional uuid, p_starts_at timestamp with time zone, p_client uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result uuid; customer uuid; client uuid; hold integer; total numeric; dur integer;
begin
 if auth.uid() is null or not public.can_manage() then raise exception 'Sem permissão. Envie um pedido para aprovação.';end if;
 if p_client is not null and not public.can_manage() then raise exception 'Sem permissão.';end if;
 perform pg_advisory_xact_lock(hashtext(p_professional::text));
 -- Keep catalogue snapshots stable until transaction commit.
 perform s.id from public.services s where s.id=any(p_services) order by s.id for share;
 if not exists(select 1 from public.available_booking_slots(p_services,p_professional,(p_starts_at at time zone 'Africa/Maputo')::date) where slot_start=p_starts_at) then raise exception 'Horário indisponível. Actualize a agenda.';end if;
 if p_client is null then customer:=auth.uid(); select id into client from public.clients where profile_id=customer;
 else select id,profile_id into client,customer from public.clients where id=p_client; if client is null then raise exception 'Cliente inexistente.';end if;end if;
 select hold_minutes into hold from public.salon_settings where id=true;
 select sum(price_mzn),sum(duration_minutes) into total,dur from public.services where id=any(p_services);
 insert into public.bookings(customer_id,client_id,service_id,professional_id,starts_at,ends_at,price_mzn,expires_at,status)
 values(customer,client,p_services[1],p_professional,p_starts_at,p_starts_at+make_interval(mins=>dur),total,now()+make_interval(mins=>hold),'confirmed') returning id into result;
 insert into public.booking_items(booking_id,position,service_id,service_name,price_mzn,duration_minutes)
 select result,x.position,s.id,s.name,s.price_mzn,s.duration_minutes
 from unnest(p_services) with ordinality x(id,position) join public.services s on s.id=x.id;
 return result;
end;$function$;
CREATE OR REPLACE FUNCTION public.register_payment(p_booking uuid, p_amount numeric, p_method payment_method, p_reference text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.bookings%rowtype; result uuid; paid numeric;
begin
 if auth.uid() is null or not public.can_manage() then raise exception 'Sem permissão.';end if;
 select * into b from public.bookings where id=p_booking for update;
 if not found or b.status not in ('confirmed','in_progress','completed') then raise exception 'A marcação não permite registar pagamentos.';end if;
 select coalesce(sum(amount_mzn),0) into paid from public.payments where booking_id=p_booking and validation_status<>'rejected' and refunded_at is null;
 if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or paid+p_amount<>b.price_mzn then raise exception 'Registe o valor integral em falta.';end if;
 if p_method is null then raise exception 'Indique o método de pagamento.';end if;
 if p_method<>'cash' and length(trim(coalesce(p_reference,'')))=0 then raise exception 'Indique a referência do pagamento.';end if;
 if p_method='pos' then raise exception 'POS excluído deste MVP.';end if;
 insert into public.payments(booking_id,amount_mzn,method,registered_by,reference) values(p_booking,p_amount,p_method,auth.uid(),nullif(trim(p_reference),'')) returning id into result;
 return result;
end;$function$;
CREATE OR REPLACE FUNCTION public.validate_payment(p_payment uuid, p_approve boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.bookings%rowtype; p public.payments%rowtype; total numeric;
begin
 if auth.uid() is null or not public.can_manage() then raise exception 'Sem permissão.';end if;
 select b0.* into b from public.bookings b0 join public.payments p0 on p0.booking_id=b0.id where p0.id=p_payment;
 if not found then raise exception 'Pagamento inexistente.';end if;
 perform pg_advisory_xact_lock(hashtextextended('booking:'||b.id::text,0));
 select b0.* into b from public.bookings b0 join public.payments p0 on p0.booking_id=b0.id where p0.id=p_payment;
 if not found then raise exception 'Pagamento inexistente.';end if;
 perform pg_advisory_xact_lock(hashtext(b.professional_id::text));
 select * into b from public.bookings where id=b.id for update;
 select * into p from public.payments where id=p_payment for update;
 if p.validation_status<>'pending' then raise exception 'Pagamento já tratado.';end if;
 if p_approve is null then raise exception 'Decisão inválida.';end if;
 if p_approve and b.status not in ('confirmed','in_progress','completed') then raise exception 'Reserva expirada ou cancelada. Não validar; tratar com a gerência.';end if;
 update public.payments set validation_status=case when p_approve then 'validated' else 'rejected' end,validated_by=auth.uid(),validated_at=now() where id=p_payment;
 select coalesce(sum(amount_mzn),0) into total from public.payments where booking_id=b.id and validation_status='validated' and refunded_at is null;
 if p_approve and total>b.price_mzn then raise exception 'Total superior ao valor da marcação.';end if;
end;$function$;
CREATE OR REPLACE FUNCTION public.review_booking_request(p_request uuid, p_approve boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.booking_requests%rowtype; client uuid; booking uuid;
begin
 if auth.uid() is null or not public.can_manage() then raise exception 'Sem permissão.';end if;
 if p_approve is null then raise exception 'Decisão inválida.';end if;
 select * into r from public.booking_requests where id=p_request for update;
 if not found then raise exception 'Pedido não encontrado.';end if;
 if r.status='approved' and p_approve then return r.booking_id;end if;
 if r.status<>'pending' then raise exception 'Este pedido já foi tratado.';end if;
 if p_approve then
  insert into public.clients(full_name,phone) values(r.full_name,r.phone) returning id into client;
  booking:=public.request_booking_services(r.service_ids,r.professional_id,r.starts_at,client);
 end if;
 update public.booking_requests set status=case when p_approve then 'approved' else 'rejected' end,booking_id=booking,reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
 return booking;
end; $function$;
CREATE OR REPLACE FUNCTION public.set_booking_status(p_booking uuid, p_status booking_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.bookings%rowtype;
begin
 if auth.uid() is null then raise exception 'Inicie sessão.';end if;
 select * into b from public.bookings where id=p_booking for update;
 if not found or not(public.can_manage() or exists(select 1 from public.professionals where id=b.professional_id and profile_id=auth.uid())) then raise exception 'Sem permissão.';end if;
 if p_status is null or not ((b.status='confirmed' and p_status='in_progress') or (b.status='in_progress' and p_status='completed')) then raise exception 'Transição não permitida.';end if;
 update public.bookings set status=p_status,updated_at=now() where id=p_booking;
end;$function$;
update public.bookings set status='confirmed',updated_at=now() where status='pending_payment' and expires_at>now();
revoke execute on function public.register_payment(p_booking uuid, p_amount numeric, p_method payment_method, p_reference text) from public,anon;
grant execute on function public.register_payment(p_booking uuid, p_amount numeric, p_method payment_method, p_reference text) to authenticated;
revoke execute on function public.request_booking_services(p_services uuid[], p_professional uuid, p_starts_at timestamp with time zone, p_client uuid) from public,anon;
grant execute on function public.request_booking_services(p_services uuid[], p_professional uuid, p_starts_at timestamp with time zone, p_client uuid) to authenticated;
revoke execute on function public.review_booking_request(p_request uuid, p_approve boolean) from public,anon;
grant execute on function public.review_booking_request(p_request uuid, p_approve boolean) to authenticated;
revoke execute on function public.set_booking_status(p_booking uuid, p_status booking_status) from public,anon;
grant execute on function public.set_booking_status(p_booking uuid, p_status booking_status) to authenticated;
revoke execute on function public.validate_payment(p_payment uuid, p_approve boolean) from public,anon;
grant execute on function public.validate_payment(p_payment uuid, p_approve boolean) to authenticated;
