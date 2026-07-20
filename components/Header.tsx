import React, { useState } from 'react';

interface HeaderProps {
    currentView?: string;
    onLogoClick: () => void;
    onGoToKiosk: () => void;
    onGoToCustomers: () => void;
    onGoToAppointments: () => void;
    onGoToParts: () => void;
    onGoToSettings: () => void;
    onGoToCampaigns: () => void;
    onGoToMessages?: () => void;
    currentLocation: string;
    onLocationChange: (location: string) => void;
    businessName: string;
    isDarkMode: boolean;
    onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    currentView,
    onLogoClick,
    onGoToKiosk,
    onGoToCustomers,
    onGoToAppointments,
    onGoToParts,
    onGoToSettings,
    onGoToCampaigns,
    onGoToMessages,
    currentLocation,
    onLocationChange,
    businessName,
    isDarkMode,
    onToggleDarkMode
}) => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    return (
        <>
            <header className="bg-white dark:bg-slate-800 shadow-md print:hidden sticky top-0 z-40 transition-colors duration-200">
                <div className="container mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between gap-4">
                    {/* Left: Hamburger & Logo */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsDrawerOpen(true)}
                            className="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm"
                            title="Open Navigation Menu"
                            aria-label="Open Navigation Menu"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>

                        <div
                            className="flex items-center gap-3 cursor-pointer select-none"
                            onClick={onLogoClick}
                        >
                            <img
                                src="/logo.png"
                                alt="Elite Phone Repair Logo"
                                className="h-[36px] w-auto object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                                {businessName}
                            </h1>
                        </div>
                    </div>

                    {/* Right: Location Switcher & Dark Mode */}
                    <div className="flex items-center gap-3">
                        {/* Dark Mode Toggle */}
                        <button
                            onClick={onToggleDarkMode}
                            className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            title="Toggle Dark Mode"
                        >
                            {isDarkMode ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 3.366a1 1 0 011.415 0l.707.707a1 1 0 11-1.414 1.415l-.707-.707a1 1 0 010-1.415zM16 10a1 1 0 011 1h1a1 1 0 110-2h-1a1 1 0 01-1 1zm-3.366 4.22a1 1 0 010 1.415l-.707.707a1 1 0 11-1.414-1.415l.707-.707a1 1 0 011.415 0zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4.22-3.366a1 1 0 01-1.415 0l-.707-.707a1 1 0 111.414-1.415l.707.707a1 1 0 010 1.415zM4 10a1 1 0 01-1-1H2a1 1 0 110 2h1a1 1 0 011-1zm3.366-4.22a1 1 0 010-1.415l.707-.707a1 1 0 011.414 1.415l-.707.707a1 1 0 01-1.415 0zM10 5a5 5 0 100 10 5 5 0 000-10z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                </svg>
                            )}
                        </button>

                        {/* Location Switcher */}
                        <div className="bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg flex items-center border border-slate-200 dark:border-slate-600">
                            <button
                                onClick={() => onLocationChange('Beaumont')}
                                className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all ${currentLocation === 'Beaumont'
                                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                Beaumont
                            </button>
                            <button
                                onClick={() => onLocationChange('Houston')}
                                className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all ${currentLocation === 'Houston'
                                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                Houston
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Slide-over Left Navigation Drawer */}
            {isDrawerOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity"
                        onClick={() => setIsDrawerOpen(false)}
                    />

                    {/* Drawer Content */}
                    <div className="fixed inset-y-0 left-0 w-80 bg-slate-900 text-white z-50 shadow-2xl flex flex-col transform transition-transform duration-300">
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <div
                                className="flex items-center gap-3 cursor-pointer"
                                onClick={() => {
                                    onLogoClick();
                                    setIsDrawerOpen(false);
                                }}
                            >
                                <img
                                    src="/logo.png"
                                    alt="Logo"
                                    className="h-8 w-auto object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                    }}
                                />
                                <span className="font-bold text-lg text-white tracking-tight">{businessName}</span>
                            </div>
                            <button
                                onClick={() => setIsDrawerOpen(false)}
                                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Navigation Links */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            <button
                                onClick={() => {
                                    onLogoClick();
                                    setIsDrawerOpen(false);
                                }}
                                className={`w-full flex items-center gap-3.5 px-4 py-3 text-left font-bold rounded-xl transition-colors ${
                                    currentView === 'dashboard' || currentView === 'kanban' || currentView === 'dashboard_list'
                                        ? 'bg-red-600/20 text-white border border-red-500/40'
                                        : 'text-slate-200 hover:bg-slate-800 hover:text-white border border-transparent'
                                }`}
                            >
                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                <span>Dashboard / Kanban</span>
                            </button>

                            <button
                                onClick={() => {
                                    onGoToCustomers();
                                    setIsDrawerOpen(false);
                                }}
                                className={`w-full flex items-center gap-3.5 px-4 py-3 text-left font-bold rounded-xl transition-colors ${
                                    currentView === 'customers' || currentView === 'customers_table'
                                        ? 'bg-sky-500/20 text-white border border-sky-400/40'
                                        : 'text-slate-200 hover:bg-slate-800 hover:text-white border border-transparent'
                                }`}
                            >
                                <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                <span>Customers List</span>
                            </button>

                            <button
                                onClick={() => {
                                    onGoToCampaigns();
                                    setIsDrawerOpen(false);
                                }}
                                className={`w-full flex items-center gap-3.5 px-4 py-3 text-left font-bold rounded-xl transition-colors ${
                                    currentView === 'campaigns' || currentView === 'sms_inbox'
                                        ? 'bg-amber-500/20 text-white border border-amber-400/40'
                                        : 'text-slate-200 hover:bg-slate-800 hover:text-white border border-transparent'
                                }`}
                            >
                                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                </svg>
                                <div>
                                    <div className="text-white">Campaigns & Messaging</div>
                                    <div className="text-[11px] text-amber-300/80 font-normal">SMS Broadcasts & Inbox Replies</div>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    onGoToParts();
                                    setIsDrawerOpen(false);
                                }}
                                className={`w-full flex items-center gap-3.5 px-4 py-3 text-left font-bold rounded-xl transition-colors ${
                                    currentView === 'parts_dashboard'
                                        ? 'bg-emerald-500/20 text-white border border-emerald-400/40'
                                        : 'text-slate-200 hover:bg-slate-800 hover:text-white border border-transparent'
                                }`}
                            >
                                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                </svg>
                                <span>Parts & Inventory</span>
                            </button>

                            <button
                                onClick={() => {
                                    onGoToAppointments();
                                    setIsDrawerOpen(false);
                                }}
                                className={`w-full flex items-center gap-3.5 px-4 py-3 text-left font-bold rounded-xl transition-colors ${
                                    currentView === 'appointments_dashboard'
                                        ? 'bg-purple-500/20 text-white border border-purple-400/40'
                                        : 'text-slate-200 hover:bg-slate-800 hover:text-white border border-transparent'
                                }`}
                            >
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>Appointments</span>
                            </button>

                            <button
                                onClick={() => {
                                    onGoToSettings();
                                    setIsDrawerOpen(false);
                                }}
                                className={`w-full flex items-center gap-3.5 px-4 py-3 text-left font-bold rounded-xl transition-colors ${
                                    currentView === 'settings'
                                        ? 'bg-slate-700/60 text-white border border-slate-600'
                                        : 'text-slate-200 hover:bg-slate-800 hover:text-white border border-transparent'
                                }`}
                            >
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                </svg>
                                <span>Shop Settings</span>
                            </button>

                            <div className="pt-4 border-t border-slate-800 mt-2">
                                <button
                                    onClick={() => {
                                        onGoToKiosk();
                                        setIsDrawerOpen(false);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 font-bold text-white rounded-xl shadow-lg transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span>Check-in Kiosk Mode</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};
