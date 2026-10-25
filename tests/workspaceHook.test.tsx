// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { act,cleanup,renderHook,waitFor } from '@testing-library/react';
const mocks=vi.hoisted(()=>({from:vi.fn(),channel:vi.fn(),removeChannel:vi.fn(),events:{} as Record<string,()=>void>}));
vi.mock('../supabaseClient',()=>({supabase:mocks}));
import { useWorkspaceData } from '../hooks/useWorkspaceData';
beforeEach(()=>{
 vi.clearAllMocks();mocks.events={};
 const channel={on:vi.fn((_type:string,filter:any,callback:()=>void)=>{mocks.events[filter.table]=callback;return channel;}),subscribe:vi.fn(()=>channel)};
 mocks.channel.mockReturnValue(channel);mocks.removeChannel.mockResolvedValue({});
 mocks.from.mockImplementation((table:string)=>{
  let location='';const q={select:()=>q,eq:(_key:string,value:string)=>{location=value;return q;},order:()=>q,
   range:()=>Promise.resolve({data:table==='customers'?[{id:`${location}-customer`,name:location}]:table==='tickets'?[{id:`${location}-ticket`,customer_id:`${location}-customer`}]:[],count:table==='customers'||table==='tickets'?1:0}),
   in:vi.fn(()=>Promise.resolve({data:[]}))};return q;
 });
});
afterEach(cleanup);
it('loads complete data, joins contacts in memory and does not subscribe the workspace to SMS writes',async()=>{
 const {result}=renderHook(()=>useWorkspaceData('Beaumont',vi.fn()));
 await waitFor(()=>expect(result.current.loading).toBe(false));
 expect(result.current.tickets[0].customer.name).toBe('Beaumont');
 expect(Object.keys(mocks.events).sort()).toEqual(['appointments','customers','parts_orders','quotes','tickets']);
 expect(mocks.events.sms_messages).toBeUndefined();
 expect(mocks.from.mock.calls.filter(([name])=>name==='customers')).toHaveLength(1);
});
it('changing stores immediately hides the previous store’s records and releases its subscription',async()=>{
 const {result,rerender}=renderHook(({location})=>useWorkspaceData(location,vi.fn()),{initialProps:{location:'Beaumont'}});
 await waitFor(()=>expect(result.current.customers[0]?.name).toBe('Beaumont'));
 rerender({location:'Houston'});
 expect(result.current.customers.some(c=>c.name==='Beaumont')).toBe(false);
 await waitFor(()=>expect(result.current.customers[0]?.name).toBe('Houston'));
 expect(result.current.tickets[0].customer.name).toBe('Houston');expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
});
it('fetches a missing cross-store customer once and shares it between linked tickets',async()=>{
 mocks.from.mockImplementation((table:string)=>{
  const q={select:()=>q,eq:()=>q,order:()=>q,
   range:()=>Promise.resolve({data:table==='tickets'?[{id:'t1',customer_id:'cross-store'},{id:'t2',customer_id:'cross-store'}]:[],count:table==='tickets'?2:0}),
   in:vi.fn(()=>Promise.resolve({data:[{id:'cross-store',name:'Linked customer'}]}))};return q;
 });
 const {result}=renderHook(()=>useWorkspaceData('Beaumont',vi.fn()));
 await waitFor(()=>expect(result.current.tickets[1]?.customer?.name).toBe('Linked customer'));
 expect(result.current.tickets[0].customer).toBe(result.current.tickets[1].customer);
 expect(mocks.from.mock.calls.filter(([name])=>name==='customers')).toHaveLength(2);
});
it('failed refreshes keep existing records and expose a retryable error',async()=>{
 const {result}=renderHook(()=>useWorkspaceData('Beaumont',vi.fn()));
 await waitFor(()=>expect(result.current.loading).toBe(false));
 mocks.from.mockImplementation(()=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:()=>Promise.resolve({error:{code:'NETWORK',message:'Offline'}})};return q;});
 await act(async()=>{await result.current.refreshData(['customers']);});
 expect(result.current.customers[0].name).toBe('Beaumont');expect(result.current.error).toContain('could not refresh');
});
it('an expired session still locks the workstation instead of serving stale access',async()=>{
 const lock=vi.fn();mocks.from.mockImplementation(()=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:()=>Promise.resolve({error:{code:'PGRST301'}})};return q;});
 const {result}=renderHook(()=>useWorkspaceData('Beaumont',lock));
 await waitFor(()=>expect(result.current.loading).toBe(false));expect(lock).toHaveBeenCalled();
});
