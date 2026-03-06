
import React from 'react';

interface FooterProps {
    businessName?: string;
}

export const Footer: React.FC<FooterProps> = ({ businessName }) => {
    return (
        <footer className="bg-white mt-8 py-4 border-t border-slate-200 print:hidden">
            <div className="container mx-auto px-4 md:px-6 text-center text-sm text-slate-500">
                <p>&copy; {new Date().getFullYear()} {businessName || 'Elite Phone Repair'} CRM. All rights reserved.</p>
            </div>
        </footer>
    );
};
