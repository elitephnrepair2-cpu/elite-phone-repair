import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { attachTicketCustomers, createWorkspaceLoader, WORKSPACE_TABLES, type WorkspaceRows, type WorkspaceTable } from '../services/workspaceData';

const emptyRows = ():WorkspaceRows => ({ customers:[],tickets:[],appointments:[],parts_orders:[],quotes:[] });
export function useWorkspaceData(location:string, onUnauthorized:()=>void) {
  const [snapshot,setSnapshot] = useState<{location:string;rows:WorkspaceRows;loading:boolean;loaded:Partial<Record<WorkspaceTable,boolean>>;error:string|null}>(()=>({location,rows:emptyRows(),loading:true,loaded:{},error:null}));
  const [related,setRelated] = useState<{location:string;rows:any[]}>({location,rows:[]});
  const loaderRef = useRef<ReturnType<typeof createWorkspaceLoader> | null>(null);
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;

  useEffect(()=>{
    let disposed=false;
    setSnapshot({location,rows:emptyRows(),loading:true,loaded:{},error:null});
    const loader = createWorkspaceLoader({ client:supabase,location,
      onRows:(table,rows)=>setSnapshot(current=>current.location !== location ? current : ({...current,loaded:{...current.loaded,[table]:true},rows:{...current.rows,[table]:rows}})),
      onError:error=>{
        if (error?.status === 401 || ['PGRST301','PGRST303'].includes(error?.code)) unauthorizedRef.current();
        else setSnapshot(current=>current.location !== location ? current : ({...current,error:'Some records could not refresh. Please retry.'}));
      },
    });
    loaderRef.current = loader;
    void loader.refresh().finally(()=>{ if (!disposed) setSnapshot(current=>current.location !== location ? current : ({...current,loading:false})); });
    let connected = false;
    const channel = supabase.channel(`workspace:${location}`);
    for (const table of WORKSPACE_TABLES) {
      channel.on('postgres_changes',{event:'*',schema:'public',table},()=>loader.schedule(table));
    }
    channel.subscribe(status=>{
      // Reconcile anything missed while disconnected, without polling full history.
      if (status === 'SUBSCRIBED') { if (connected) void loader.refresh(); connected=true; }
    });
    return ()=>{
      disposed=true;
      loader.dispose();
      if (loaderRef.current === loader) loaderRef.current=null;
      void supabase.removeChannel(channel);
    };
  },[location]);

  const visibleRows = snapshot.location === location ? snapshot.rows : emptyRows();
  // Normally all ticket customers are already in the directory. Preserve cross-store
  // links by fetching only missing IDs, once per related customer rather than per ticket.
  const missingIds = useMemo(()=>{
    const available = new Set(visibleRows.customers.map(c=>c.id));
    return [...new Set(visibleRows.tickets.map(t=>t.customer_id).filter(id=>id && !available.has(id)))].sort();
  },[visibleRows.customers,visibleRows.tickets]);
  const missingKey = missingIds.join(',');
  useEffect(()=>{
    let cancelled=false;
    if (!snapshot.loaded.customers || !snapshot.loaded.tickets || snapshot.location !== location) return;
    if (!missingKey) { setRelated({location,rows:[]}); return; }
    const ids=missingKey.split(',');
    void (async()=>{
      const rows:any[]=[];
      for (let start=0;start<ids.length;start+=200) {
        const { data,error } = await supabase.from('customers').select('*').in('id',ids.slice(start,start+200));
        if (cancelled) return;
        if (error) { setSnapshot(current=>({...current,error:'Some ticket customer details could not refresh. Please retry.'})); return; }
        rows.push(...data || []);
      }
      if (!cancelled) setRelated({location,rows});
    })().catch(()=>{ if (!cancelled) setSnapshot(current=>({...current,error:'Some ticket customer details could not refresh. Please retry.'})); });
    return ()=>{cancelled=true;};
  },[location,missingKey,visibleRows.customers,snapshot.loaded.customers,snapshot.loaded.tickets,snapshot.location]);
  const tickets = useMemo(()=>attachTicketCustomers(visibleRows.tickets,visibleRows.customers,related.location === location ? related.rows : []),[visibleRows.tickets,visibleRows.customers,related,location]);
  const refreshData = useCallback((tables?:readonly WorkspaceTable[])=>{
    setSnapshot(current=>({...current,error:null}));
    return loaderRef.current?.refresh(tables) ?? Promise.resolve();
  },[]);
  return {...visibleRows,tickets,refreshData,loading:snapshot.location !== location || snapshot.loading,error:snapshot.location === location ? snapshot.error : null};
}
