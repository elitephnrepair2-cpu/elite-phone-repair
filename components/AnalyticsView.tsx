import React, { useState, useMemo } from 'react';
import type { Customer, RepairTicket } from '../types';

interface AnalyticsViewProps {
  customers: Customer[];
  tickets: RepairTicket[];
  currentLocation: string;
  onBack: () => void;
  onNavigateToCampaigns: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  customers,
  tickets,
  currentLocation,
  onBack,
  onNavigateToCampaigns
}) => {
  const [timeRange, setTimeRange] = useState<'all' | '30days' | '7days' | 'this_month'>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  // Filtered dataset based on location and date range
  const filteredData = useMemo(() => {
    let tList = tickets;
    let cList = customers;

    if (selectedLocation !== 'all') {
      tList = tList.filter(t => t.location === selectedLocation);
      cList = cList.filter(c => c.location === selectedLocation);
    }

    if (timeRange !== 'all') {
      const now = new Date();
      let cutOffDate = new Date();

      if (timeRange === '7days') {
        cutOffDate.setDate(now.getDate() - 7);
      } else if (timeRange === '30days') {
        cutOffDate.setDate(now.getDate() - 30);
      } else if (timeRange === 'this_month') {
        cutOffDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      tList = tList.filter(t => t.created_at && new Date(t.created_at) >= cutOffDate);
      cList = cList.filter(c => c.created_at && new Date(c.created_at) >= cutOffDate);
    }

    return { tickets: tList, customers: cList };
  }, [tickets, customers, selectedLocation, timeRange]);

  // Overall Financial & Ticket Metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredData.tickets.reduce((sum, t) => sum + (Number(t.price) || Number((t as any).total_price) || 0), 0);
    const paidRevenue = filteredData.tickets.filter(t => t.is_paid).reduce((sum, t) => sum + (Number(t.price) || Number((t as any).total_price) || 0), 0);
    const unpaidRevenue = totalRevenue - paidRevenue;

    const totalTickets = filteredData.tickets.length;
    const avgTicketValue = totalTickets > 0 ? totalRevenue / totalTickets : 0;

    const totalCustomers = filteredData.customers.length;
    const consentedCustomers = filteredData.customers.filter(c => c.marketing_sms_consent !== false).length;
    const optedOutCustomers = filteredData.customers.filter(c => c.marketing_sms_consent === false || c.revoked_reason != null).length;

    return {
      totalRevenue,
      paidRevenue,
      unpaidRevenue,
      totalTickets,
      avgTicketValue,
      totalCustomers,
      consentedCustomers,
      optedOutCustomers,
      consentRate: totalCustomers > 0 ? (consentedCustomers / totalCustomers) * 100 : 0
    };
  }, [filteredData]);

  // Top Device Breakdown
  const deviceStats = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();

    filteredData.tickets.forEach(t => {
      const dev = (t.device || 'Unspecified Device').trim();
      const val = Number(t.price) || Number((t as any).total_price) || 0;
      const existing = map.get(dev) || { count: 0, revenue: 0 };
      map.set(dev, {
        count: existing.count + 1,
        revenue: existing.revenue + val
      });
    });

    const arr = Array.from(map.entries()).map(([device, data]) => ({
      device,
      count: data.count,
      revenue: data.revenue,
      pctOfTotal: metrics.totalTickets > 0 ? (data.count / metrics.totalTickets) * 100 : 0
    }));

    return arr.sort((a, b) => b.count - a.count);
  }, [filteredData.tickets, metrics.totalTickets]);

  // Repair Problem & Issue Type Breakdown
  const issueStats = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();

    filteredData.tickets.forEach(t => {
      const desc = (t.problem_description || (t as any).issue_description || 'General Repair').toLowerCase();
      let category = 'Other Repairs';

      if (desc.includes('screen') || desc.includes('glass') || desc.includes('lcd') || desc.includes('display')) {
        category = 'Screen & Display Replacement';
      } else if (desc.includes('battery') || desc.includes('power') || desc.includes('die')) {
        category = 'Battery Replacement';
      } else if (desc.includes('charge') || desc.includes('port') || desc.includes('plug')) {
        category = 'Charging Port Repair';
      } else if (desc.includes('water') || desc.includes('liquid') || desc.includes('wet')) {
        category = 'Water Damage Treatment';
      } else if (desc.includes('camera') || desc.includes('lens')) {
        category = 'Camera Repair';
      } else if (desc.includes('back') || desc.includes('housing')) {
        category = 'Back Glass / Housing';
      } else if (desc.includes('unlock') || desc.includes('software') || desc.includes('reset')) {
        category = 'Software & Unlocking';
      }

      const val = Number(t.price) || Number((t as any).total_price) || 0;
      const existing = map.get(category) || { count: 0, revenue: 0 };
      map.set(category, {
        count: existing.count + 1,
        revenue: existing.revenue + val
      });
    });

    return Array.from(map.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        revenue: data.revenue,
        avgPrice: data.count > 0 ? data.revenue / data.count : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredData.tickets]);

  // Customer Loyalty & Frequency Breakdown
  const customerFrequencyStats = useMemo(() => {
    const ticketCounts = new Map<string, number>();

    tickets.forEach(t => {
      ticketCounts.set(t.customer_id, (ticketCounts.get(t.customer_id) || 0) + 1);
    });

    let singleVisits = 0;
    let repeatVisits = 0;

    ticketCounts.forEach(count => {
      if (count === 1) singleVisits++;
      else if (count > 1) repeatVisits++;
    });

    const totalCusts = ticketCounts.size || 1;
    return {
      singleVisits,
      repeatVisits,
      repeatRate: (repeatVisits / totalCusts) * 100
    };
  }, [tickets]);

  // Export Analytics to CSV
  const handleExportCSV = () => {
    const headers = ['Device', 'Total Tickets', 'Revenue ($)', '% of Total Volume'];
    const rows = deviceStats.map(d => [
      `"${d.device}"`,
      d.count,
      d.revenue.toFixed(2),
      `${d.pctOfTotal.toFixed(1)}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `elite_repair_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={onBack}
                className="text-slate-300 hover:text-white font-bold text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-all flex items-center gap-1"
              >
                ← Back
              </button>
              <span className="px-3 py-1 bg-indigo-500/80 backdrop-blur-md text-white font-black text-xs uppercase tracking-wider rounded-full">
                Business Intelligence
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Shop Performance & Analytics</h1>
            <p className="text-slate-300 text-sm mt-1">
              Detailed breakdown of repair revenue, top devices, issue categories, and marketing metrics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/10 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV Report
            </button>

            <button
              onClick={onNavigateToCampaigns}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
            >
              🚀 Launch SMS Campaign
            </button>
          </div>
        </div>

        {/* Global Controls & Filters */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300">Time Range:</span>
            <div className="bg-white/10 p-1 rounded-xl flex border border-white/10">
              {(['all', 'this_month', '30days', '7days'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    timeRange === range ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {range === 'all' && 'All Time'}
                  {range === 'this_month' && 'This Month'}
                  {range === '30days' && 'Last 30 Days'}
                  {range === '7days' && 'Last 7 Days'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300">Location:</span>
            <select
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              className="px-3 py-1.5 bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="all" className="text-slate-900">All Locations</option>
              <option value="Beaumont" className="text-slate-900">Beaumont</option>
              <option value="Houston" className="text-slate-900">Houston</option>
            </select>
          </div>
        </div>
      </div>

      {/* Top Level Key Performance Indicator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Total Revenue</span>
            <span className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-xl">💰</span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            ${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span className="text-emerald-600 font-extrabold">${metrics.paidRevenue.toFixed(0)} Paid</span>
            <span>•</span>
            <span className="text-rose-600 font-extrabold">${metrics.unpaidRevenue.toFixed(0)} Unpaid</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Total Repairs</span>
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">🛠️</span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {metrics.totalTickets.toLocaleString()}
          </div>
          <p className="text-xs font-semibold text-slate-500">Total processed repair tickets</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Avg. Ticket Value</span>
            <span className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 rounded-xl">📈</span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            ${metrics.avgTicketValue.toFixed(2)}
          </div>
          <p className="text-xs font-semibold text-slate-500">Average revenue per repair ticket</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>SMS Consent Rate</span>
            <span className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 rounded-xl">📱</span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {metrics.consentRate.toFixed(1)}%
          </div>
          <div className="text-xs font-bold text-slate-500 flex justify-between">
            <span className="text-emerald-600 font-extrabold">{metrics.consentedCustomers} Consented</span>
            <span className="text-rose-600 font-extrabold">{metrics.optedOutCustomers} STOP</span>
          </div>
        </div>

      </div>

      {/* Main Charts & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left 7 Columns: Top Devices Ranking */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Top Repaired Devices</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Device ranking by total ticket volume & revenue generated.</p>
            </div>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-full text-xs font-black">
              {deviceStats.length} Device Types
            </span>
          </div>

          <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
            {deviceStats.slice(0, 10).map((d, index) => (
              <div key={d.device} className="p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl space-y-2 border border-slate-200 dark:border-slate-600">
                <div className="flex items-center justify-between text-sm font-extrabold">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center flex-shrink-0">
                      #{index + 1}
                    </span>
                    <span className="text-slate-900 dark:text-white truncate">{d.device}</span>
                  </div>

                  <div className="text-right flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">{d.count} tickets</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">${d.revenue.toFixed(2)}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-600 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, d.pctOfTotal * 2))}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Columns: Repair Issue Breakdown & Insights */}
        <div className="lg:col-span-5 space-y-6">

          {/* Issue Categories Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md space-y-4">
            <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Repair Type Breakdown</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Revenue & volume breakdown by repair issue category.</p>
            </div>

            <div className="space-y-3">
              {issueStats.map(item => (
                <div key={item.category} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                  <div>
                    <span className="font-extrabold text-slate-900 dark:text-white text-xs block">{item.category}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{item.count} tickets • Avg ${item.avgPrice.toFixed(0)}</span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    ${item.revenue.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Marketing Recommendations Card */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-indigo-700/60 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>🤖</span> Smart Marketing Recommendations
              </h3>
              <span className="px-2.5 py-0.5 bg-amber-400 text-slate-900 text-[10px] font-black rounded-md uppercase">
                Actionable Insights
              </span>
            </div>

            <div className="space-y-3 text-xs leading-relaxed font-medium">
              <div className="p-3 bg-white/10 rounded-2xl border border-white/10 space-y-1">
                <span className="font-bold text-amber-300 block">💡 Device Retention Opportunity</span>
                <p className="text-slate-200">
                  {deviceStats[0]?.device || 'iPhone'} represents your highest volume repair. Run a targeted SMS campaign offering discounted screen protectors to past {deviceStats[0]?.device || 'iPhone'} owners!
                </p>
              </div>

              <div className="p-3 bg-white/10 rounded-2xl border border-white/10 space-y-1">
                <span className="font-bold text-emerald-300 block">💡 Customer Repeat Rate: {customerFrequencyStats.repeatRate.toFixed(1)}%</span>
                <p className="text-slate-200">
                  You have {metrics.consentedCustomers} SMS-consented customers ready to receive updates. Send a seasonal battery maintenance broadcast to drive repeat visits.
                </p>
              </div>
            </div>

            <button
              onClick={onNavigateToCampaigns}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-emerald-600 hover:from-red-700 hover:to-emerald-700 text-white font-extrabold rounded-2xl text-xs shadow-lg transition-all flex items-center justify-center gap-2"
            >
              🎯 Open Campaign Creator Now
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
