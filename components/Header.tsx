
import React from 'react';

interface HeaderProps {
    onLogoClick: () => void;
    onGoToKiosk: () => void;
    onGoToCustomers: () => void;
    onGoToAppointments: () => void;
    onGoToParts: () => void;
    onGoToSettings: () => void;
    currentLocation: string;
    onLocationChange: (location: string) => void;
    businessName: string;
    isDarkMode: boolean;
    onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    onLogoClick,
    onGoToKiosk,
    onGoToCustomers,
    onGoToAppointments,
    onGoToParts,
    onGoToSettings,
    currentLocation,
    onLocationChange,
    businessName,
    isDarkMode,
    onToggleDarkMode
}) => {
    return (
        <header className="bg-white dark:bg-slate-800 shadow-md print:hidden sticky top-0 z-50 transition-colors duration-200">
            <div className="container mx-auto px-4 md:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                    <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={onLogoClick}
                    >
                        <img src="/logo.png" alt="Elite Phone Repair Logo" className="h-[40px] w-auto object-contain" onError={(e) => {
                            // Fallback if logo.png isn't placed yet
                            (e.target as HTMLImageElement).style.display = 'none';
                            ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).style.display = 'block';
                        }} />
                        <svg className="h-8 w-8 text-red-600 hidden" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                            {businessName}
                        </h1>
                    </div>

                    {/* Dark Mode & Location Toggle */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onToggleDarkMode}
                            className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
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

                        <div className="bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg flex items-center border border-slate-200 dark:border-slate-600">
                            <button
                                onClick={() => onLocationChange('Beaumont')}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currentLocation === 'Beaumont'
                                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                Beaumont
                            </button>
                            <button
                                onClick={() => onLocationChange('Houston')}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currentLocation === 'Houston'
                                    ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                            >
                                Houston
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onGoToCustomers}
                        className="bg-white border border-slate-300 text-slate-700 font-bold py-2 px-3 lg:px-5 rounded-lg hover:bg-slate-50 transition-colors flex items-center text-sm lg:text-base mr-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className="hidden sm:inline">Customers</span>
                        <span className="sm:hidden">Cust</span>
                    </button>
                    <button
                        onClick={onGoToParts}
                        className="bg-white border border-slate-300 text-slate-700 font-bold py-2 px-3 lg:px-5 rounded-lg hover:bg-slate-50 transition-colors flex items-center text-sm lg:text-base mr-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="hidden sm:inline">Parts</span>
                        <span className="sm:hidden">Parts</span>
                    </button>
                    <button
                        onClick={onGoToAppointments}
                        className="bg-white border border-slate-300 text-slate-700 font-bold py-2 px-3 lg:px-5 rounded-lg hover:bg-slate-50 transition-colors flex items-center text-sm lg:text-base"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden sm:inline">Appointments</span>
                        <span className="sm:hidden">Appts</span>
                    </button>
                    <button
                        onClick={onGoToSettings}
                        className="bg-white border border-slate-300 text-slate-700 font-bold py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                        title="Settings"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onGoToKiosk()}
                        className="bg-slate-800 text-white font-bold py-2 px-3 lg:px-5 rounded-lg hover:bg-slate-700 transition-colors flex items-center text-sm lg:text-base"
                        title="Switch to customer-facing check-in screen"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Check-in
                    </button>
                </div>
            </div>
        </header >
    );
};
