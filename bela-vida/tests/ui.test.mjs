import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Render the real React workspace with server-action boundaries stubbed. This is
// a rendering check, not a substitute for browser or production login tests.
const root = new URL('../', import.meta.url);
registerHooks({
 resolve(specifier, context, next) {
  if (specifier.startsWith('@/') || (specifier.startsWith('.') && context.parentURL?.startsWith('file:'))) {
   const target = specifier.startsWith('@/') ? new URL(specifier.slice(2), root) : new URL(specifier, context.parentURL);
   for (const suffix of ['', '.ts', '.tsx']) {
    const candidate = target.href + suffix;
    if (existsSync(fileURLToPath(candidate))) return next(candidate, context);
   }
  }
  return next(specifier, context);
 },
 load(url, context, next) {
  if (url.endsWith('/app/gestao/actions.ts')) return { format: 'module', shortCircuit: true, source: 'export async function executeCommand(){throw new Error("not called during rendering")} export async function refreshWorkspace(){throw new Error("not called during rendering")} export async function availableSlots(){throw new Error("not called during rendering")}' };
  if (url.endsWith('/app/gestao/entrar/actions.ts')) return { format: 'module', shortCircuit: true, source: 'export async function logout(){throw new Error("not called during rendering")}' };
  if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: "import React from 'react';\n" + ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
  return next(url, context);
 },
});
const { default: Management } = await import('../components/management/workspace.tsx');
const empty = { source:'supabase',loadedAt:'2026-11-01T10:00:00Z',customers:[],appointments:[],professionals:[],services:[],payments:[],expenses:[],products:[],stockMovements:[],audit:[],otherIncome:[],professionalAccounts:[],operationalSettings:null,settings:{name:'Salão Bela Vida',phone:'',address:'',schedule:[]} };

test('the integrated workspace renders real empty data without seeding demo customers',()=>{
 const html=renderToString(React.createElement(Management,{access:{id:'test',role:'manager',name:'Conta verificada'},initialData:empty}));
 assert.match(html,/Conta verificada/);assert.match(html,/Gestão ligada ao sistema/);assert.match(html,/Sem marcações/);assert.doesNotMatch(html,/Dados fictícios|Ana Mucavele|Frontend de demonstração/);
});
test('reception rendering does not expose manager navigation or inventory',()=>{
 const html=renderToString(React.createElement(Management,{access:{id:'test',role:'reception',name:'Recepção'},initialData:empty}));
 assert.doesNotMatch(html,/>Financeiro<|>Produtos e materiais<|>Definições do salão</);assert.match(html,/Gestão ligada ao sistema/);
});

const { LiveBookingForm } = await import('../components/management/live-booking.tsx');
test('booking form offers multiple selections and a bundle total within the existing UI',()=>{
 const data={...empty,services:[{id:'a',name:'Unhas',minutes:30,price:100,active:true},{id:'b',name:'Cabelo',minutes:60,price:200,active:true}]};
 const html=renderToString(React.createElement(LiveBookingForm,{data,date:'2026-11-03',onSave:()=>{},onClose:()=>{}}));
 assert.equal((html.match(/type="checkbox"/g)??[]).length,2);assert.doesNotMatch(html,/type="radio"/);assert.match(html,/Criar marcação/);
});
test('reschedule form retains contracted service details and does not offer service or client edits',()=>{
 const appointment={id:'booking',customerId:'client',professionalId:'pro',date:'2026-11-03',time:'08:00',status:'confirmed',notes:'',items:[{serviceId:'a',name:'Unhas históricas',minutes:30,price:100},{serviceId:'b',name:'Cabelo histórico',minutes:60,price:200}]};
 const data={...empty,customers:[{id:'client',name:'Cliente QA'}],professionals:[{id:'pro',name:'Equipa QA',active:true,serviceIds:['a','b']}]};
 const html=renderToString(React.createElement(LiveBookingForm,{data,date:appointment.date,appointment,onSave:()=>{},onClose:()=>{}}));
 assert.match(html,/Unhas históricas/);assert.match(html,/Cabelo histórico/);assert.match(html,/Guardar reagendamento/);assert.doesNotMatch(html,/type="checkbox"|name="customer"/);
});
