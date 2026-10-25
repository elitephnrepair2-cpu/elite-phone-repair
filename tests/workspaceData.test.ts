import { afterEach,expect,it,vi } from 'vitest';
import { attachTicketCustomers,createWorkspaceLoader,fetchWorkspaceRows } from '../services/workspaceData';
function clientFor(response:(table:string,start:number,count:boolean)=>any) {
  const calls:{table:string;start:number;select:string;count:boolean;location:string}[]=[];
  return {calls,client:{from:(table:string)=>{
    let select='';let count=false;let location='';
    const query={select:(value:string,options?:any)=>{select=value;count=options?.count==='exact';return query;},
      eq:(_key:string,value:string)=>{location=value;return query;},order:()=>query,
      range:(start:number)=>{calls.push({table,start,select,count,location});return Promise.resolve(response(table,start,count));}};
    return query;
  }}};
}
afterEach(()=>vi.useRealTimers());
it('preserves all history and fetches remaining pages concurrently with stable location filters',async()=>{
  const rows=Array.from({length:2501},(_,id)=>({id}));
  const {client,calls}=clientFor((_table,start,count)=>({data:rows.slice(start,start+1000),count:count?rows.length:null}));
  expect(await fetchWorkspaceRows(client,'customers','Houston')).toEqual(rows);
  expect(calls.map(c=>c.start)).toEqual([0,1000,2000]);
  expect(calls.every(c=>c.location==='Houston' && c.select==='*')).toBe(true);
});
it('ticket requests do not duplicate customer data through a join',async()=>{
  const {client,calls}=clientFor(()=>({data:[],count:0}));await fetchWorkspaceRows(client,'tickets','Beaumont');
  expect(calls[0].select).toBe('*');
});
it('falls back to complete paging if a proxy omits exact counts',async()=>{
  const rows=Array.from({length:1001},(_,id)=>({id}));
  const {client}=clientFor((_table,start)=>({data:rows.slice(start,start+1000)}));
  expect(await fetchWorkspaceRows(client,'customers','Beaumont')).toHaveLength(1001);
});
it('throws on an incomplete page instead of replacing a valid directory with partial results',async()=>{
  const {client}=clientFor((_table,start)=>start ? {error:{message:'Offline'}} : {data:Array(1000).fill({id:1}),count:1200});
  await expect(fetchWorkspaceRows(client,'customers','Beaumont')).rejects.toMatchObject({message:'Offline'});
});
it('coalesces 100 realtime ticket events into one ticket refresh and no unrelated requests',async()=>{
  vi.useFakeTimers();const onRows=vi.fn();const {client,calls}=clientFor(()=>({data:[],count:0}));
  const loader=createWorkspaceLoader({client,location:'Beaumont',onRows,onError:vi.fn()});
  for(let i=0;i<100;i++) loader.schedule('tickets');
  expect(calls).toHaveLength(0);await vi.advanceTimersByTimeAsync(200);
  expect(calls).toHaveLength(1);expect(calls[0].table).toBe('tickets');expect(onRows).toHaveBeenCalledTimes(1);loader.dispose();
});
it('events during an in-flight query produce one follow-up refresh and no overlapping requests',async()=>{
  let release:(value:any)=>void;let n=0;
  const {client,calls}=clientFor(()=>++n===1?new Promise(resolve=>{release=resolve;}):{data:[{id:'fresh'}],count:1});
  const onRows=vi.fn();const loader=createWorkspaceLoader({client,location:'Beaumont',onRows,onError:vi.fn()});
  const first=loader.refresh(['tickets']);
  const second=loader.refresh(['tickets']);const third=loader.refresh(['tickets']);
  expect(calls).toHaveLength(1);release!({data:[{id:'old'}],count:1});await Promise.all([first,second,third]);
  expect(calls).toHaveLength(2);expect(onRows).toHaveBeenLastCalledWith('tickets',[{id:'fresh'}]);loader.dispose();
});
it('a disposed location cannot publish stale data or continue scheduled refreshes',async()=>{
  vi.useFakeTimers();let release:(value:any)=>void;
  const {client,calls}=clientFor(()=>new Promise(resolve=>{release=resolve;}));
  const onRows=vi.fn();const loader=createWorkspaceLoader({client,location:'Beaumont',onRows,onError:vi.fn()});
  const task=loader.refresh(['customers']);loader.schedule('quotes');loader.dispose();
  release!({data:[{id:'previous-store'}],count:1});await task;await vi.advanceTimersByTimeAsync(500);
  expect(onRows).not.toHaveBeenCalled();expect(calls).toHaveLength(1);
});
it('hydrates repeated tickets from one contact, preserving cross-store links and updates',()=>{
  const tickets=[{id:'t1',customer_id:'c1'},{id:'t2',customer_id:'c1'},{id:'t3',customer_id:'other-store'}];
  const contact={id:'c1',name:'Updated name'};const other={id:'other-store',name:'Cross-store customer'};
  const rows=attachTicketCustomers(tickets,[contact],[other]);
  expect(rows[0].customer).toBe(contact);expect(rows[1].customer).toBe(contact);expect(rows[2].customer).toBe(other);
});
