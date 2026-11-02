'use client';
import { useContext, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { availableSlots } from '@/app/gestao/actions';
import { duration, money } from '@/lib/salon';
import { todayKey, moveDate, uid, type Appointment, type Data } from '@/lib/management/model';
import { maputoTime, maputoDay } from '@/lib/management/live-adapters';
import { OperationContext } from './operation-context';

export function LiveBookingForm({ data, date, appointment, onSave, onClose }: { data: Data; date: string; appointment?: Appointment; onSave: (value: Appointment) => void; onClose: () => void }) {
  const busy = useContext(OperationContext);
  const [serviceIds,S] = useState<string[]>(appointment?.items.map(i => i.serviceId) ?? []);
  const [professionalId,P] = useState(appointment?.professionalId ?? ''), [day,D] = useState(appointment?.date ?? date), [slot,T] = useState('');
  const [slots,V] = useState<string[]>([]), [loading,L] = useState(false), [error,E] = useState('');
  const items = appointment?.items ?? serviceIds.map(id => data.services.find(s => s.id === id)!).filter(Boolean).map(s => ({ serviceId: s.id, name: s.name, price: s.price, minutes: s.minutes }));
  const eligible = data.professionals.filter(p => p.active && serviceIds.length > 0 && serviceIds.every(id => p.serviceIds.includes(id)));
  const selectionKey = serviceIds.join(',');
  const bookingId = appointment?.id;
  useEffect(() => {
    let active = true; T(''); V([]); E('');
    if (!selectionKey || !professionalId || !day) { L(false); return; }
    L(true);
    availableSlots(selectionKey.split(','), professionalId, day, bookingId).then(result => {
      if (!active) return;
      if (result.ok) V(result.slots.map(s => s.slot_start)); else E(result.error);
    }).catch(() => { if (active) E('Não foi possível consultar os horários. Altere a selecção ou volte a abrir o formulário.'); }).finally(() => { if (active) L(false); });
    return () => { active = false; };
  }, [selectionKey, professionalId, day, bookingId]);
  return <form className="mg-form" onSubmit={event => {
    event.preventDefault();
    if (busy || loading) return;
    if (!items.length || !slot || !slots.includes(slot) || !eligible.some(p => p.id === professionalId)) { E('Seleccione serviços, profissional e um horário disponível.'); return; }
    const form = new FormData(event.currentTarget);
    onSave({ id: appointment?.id ?? uid(), customerId: appointment?.customerId ?? String(form.get('customer')), professionalId, date: maputoDay(slot), time: maputoTime(slot), items, status: appointment?.status ?? 'confirmed', notes: appointment?.notes ?? '' });
  }}>
    <fieldset disabled={busy}>
    {appointment ? <p className="mg-help">{data.customers.find(c => c.id === appointment.customerId)?.name} · Reagendar preserva serviços, valores, pagamentos e estado.</p> : <><label>Cliente<select name="customer" required defaultValue=""><option value="" disabled>Seleccionar cliente</option>{data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><p className="mg-help">Para uma nova cliente, crie primeiro a ficha em Clientes.</p></>}
    <fieldset><legend>Serviços</legend><div className="mg-service-picker">{appointment ? items.map(i => <p key={i.serviceId}>{i.name} · {duration(i.minutes)} · {money(i.price)}</p>) : data.services.filter(s => s.active).map(s => <label key={s.id} className={serviceIds.includes(s.id) ? 'selected' : ''}><input type="checkbox" name="services" value={s.id} checked={serviceIds.includes(s.id)} onChange={() => { S(ids => ids.includes(s.id) ? ids.filter(id => id !== s.id) : [...ids,s.id]); P(''); }}/><span>{s.name}<small>{duration(s.minutes)}</small></span><b>{money(s.price)}</b></label>)}</div></fieldset>
    <div className="mg-selection-total"><span><Clock size={14}/>{items.length ? duration(items.reduce((n,i) => n+i.minutes,0)) : 'Seleccione os serviços'}</span><strong>{items.length ? money(items.reduce((n,i) => n+i.price,0)) : '—'}</strong></div>
    <label>Profissional<select required value={professionalId} onChange={e => P(e.target.value)}><option value="">Seleccionar profissional</option>{eligible.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {serviceIds.length > 0 && !eligible.length && <p role="status" className="mg-help">Nenhum profissional activo realiza todos os serviços seleccionados.</p>}
    <div className="mg-form-grid"><label>Data<input type="date" required min={todayKey()} max={moveDate(todayKey(),60)} value={day} onChange={e => D(e.target.value)}/></label><label>Hora de início<select required disabled={loading || !slots.length} value={slot} onChange={e => T(e.target.value)}><option value="">{loading ? 'A consultar…' : 'Seleccionar horário'}</option>{slots.map(s => <option key={s} value={s}>{maputoTime(s)}</option>)}</select></label></div>
    {!loading && professionalId && !slots.length && !error && <p role="status" className="mg-help">Sem horários disponíveis neste dia. Experimente outra data.</p>}
    <p className="mg-help">A disponibilidade é confirmada no servidor ao guardar.{!appointment && ' Uma única marcação reúne os serviços e fica confirmada ao guardar. O pagamento é registado separadamente.'}</p>
    {error && <p role="alert" className="mg-form-error">{error}</p>}
    <div className="mg-form-actions"><button type="button" className="mg-button secondary" onClick={onClose}>Cancelar</button><button className="mg-button" disabled={busy || loading || !slot}>{busy ? 'A guardar…' : appointment ? 'Guardar reagendamento' : 'Criar marcação'}</button></div>
    </fieldset>
  </form>;
}
