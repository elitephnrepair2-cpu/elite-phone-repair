export const WORKSPACE_TABLES = ['customers','tickets','appointments','parts_orders','quotes'] as const;
export type WorkspaceTable = typeof WORKSPACE_TABLES[number];
export type WorkspaceRows = Record<WorkspaceTable, any[]>;
const PAGE_SIZE = 1000;

// Fetch independent pages together, with bounded concurrency. Keep history complete:
// customer search, campaign recipients and analytics must never see a truncated list.
export async function fetchWorkspaceRows(client: any, table: WorkspaceTable, location: string): Promise<any[]> {
  const order = table === 'appointments' ? 'date' : 'created_at';
  const page = async (number: number, count = false) => {
    const response = await client.from(table).select('*', count ? { count:'exact' } : undefined)
      .eq('location',location).order(order,{ascending:table === 'appointments'})
      .order('id',{ascending:false}).range(number * PAGE_SIZE,(number + 1) * PAGE_SIZE - 1);
    if (response.error) throw response.error;
    return response;
  };
  const first = await page(0,true);
  const rows = [...(first.data || [])];
  if (typeof first.count === 'number') {
    const pages = Math.ceil(first.count / PAGE_SIZE);
    for (let start = 1; start < pages; start += 3) {
      const batch = await Promise.all(Array.from({length:Math.min(3,pages-start)},(_,offset)=>page(start+offset)));
      for (const result of batch) rows.push(...(result.data || []));
    }
  } else {
    // Some proxies omit counts. Fall back to paging until exhaustion.
    for (let number = 1, full = rows.length === PAGE_SIZE; full; number++) {
      const result = await page(number); rows.push(...(result.data || []));
      full = result.data?.length === PAGE_SIZE;
    }
  }
  return rows;
}

export function createWorkspaceLoader(options: {
  client:any; location:string; onRows:(table:WorkspaceTable, rows:any[])=>void;
  onError:(error:any)=>void; delay?:number;
}) {
  let disposed = false;
  const inFlight = new Map<WorkspaceTable,Promise<void>>();
  const dirty = new Set<WorkspaceTable>();
  const pending = new Set<WorkspaceTable>();
  let timer:ReturnType<typeof setTimeout> | undefined;

  function load(table:WorkspaceTable):Promise<void> {
    if (disposed) return Promise.resolve();
    const existing = inFlight.get(table);
    if (existing) { dirty.add(table); return existing; }
    const task = (async()=>{
      do {
        dirty.delete(table);
        try {
          const rows = await fetchWorkspaceRows(options.client,table,options.location);
          if (!disposed) options.onRows(table,rows);
        } catch(error) {
          if (!disposed) options.onError(error);
        }
      } while (!disposed && dirty.has(table));
    })().finally(()=>inFlight.delete(table));
    inFlight.set(table,task);
    return task;
  }
  const refresh = (tables:readonly WorkspaceTable[] = WORKSPACE_TABLES) => Promise.all(tables.map(load)).then(()=>{});
  return {
    refresh,
    schedule(table:WorkspaceTable) {
      if (disposed) return;
      pending.add(table);
      if (timer) return;
      timer = setTimeout(()=>{
        timer = undefined;
        const tables=[...pending]; pending.clear(); void refresh(tables);
      },options.delay ?? 200);
    },
    dispose() { disposed=true; if(timer) clearTimeout(timer); pending.clear(); dirty.clear(); },
  };
}

export function attachTicketCustomers(tickets:any[], customers:any[], relatedCustomers:any[] = []) {
  const byId = new Map(relatedCustomers.map(customer=>[customer.id,customer]));
  for (const customer of customers) byId.set(customer.id,customer);
  return tickets.map(ticket=>({ ...ticket, customer:byId.get(ticket.customer_id) || ticket.customer || null }));
}
